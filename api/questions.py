"""HR-authored check-in questions and the recompute that folds their answers into the scores.

The base model was trained on IBM outcomes, so it cannot know a question HR wrote last week, and
nobody who answered that question has had time to leave yet. What we do have is the stay-intent
question every check-in asks ("A year from now, do you see yourself still working here?"), the
strongest early signal of leaving. A recompute fits, on top of the base model, how each new
question's answers shift the odds of saying "probably not" or "no", beyond what the base model
already predicts. Those shifts are centred (a typical answer moves nobody) and added to each
person's log-odds. A question joins the scores only once 75% of current staff have answered it.
"""

import math
import random
from datetime import UTC, date, datetime

import numpy as np
import pandas as pd
from fastapi import HTTPException
from sqlalchemy import delete, func, select, update
from sqlalchemy.dialects.postgresql import insert

from api.models import CustomAnswer, CustomQuestion, DemoState, Employee, StayIntent
from api.people import current_features_bulk
from api.quarters import quarter_of
from api.service import get_service

COVERAGE_NEEDED = 0.75
MAX_QUESTIONS = 10
MIN_OPTION_ANSWERS = 10  # an option chosen by fewer people gets no effect of its own
MIN_CLASS = 10  # people on each side of the stay-intent split needed to learn anything
L2 = 10.0
MAX_EFFECT = 1.5  # no single answer moves the log-odds more than this (odds x4.5)
LEAVING = 4  # stay intent of "Probably not" (4) or "No" (5) counts as leaning towards leaving
SIMULATED_SHARE = 0.8

INTENT_QUESTION = {
    "key": "stayIntent",
    "label": "A year from now, do you see yourself still working here?",
    "options": [{"value": 1, "label": "Yes, definitely"}, {"value": 2, "label": "Probably"},
                {"value": 3, "label": "Not sure"}, {"value": 4, "label": "Probably not"},
                {"value": 5, "label": "No"}],
}
INTENT_LABELS = {o["value"]: o["label"] for o in INTENT_QUESTION["options"]}


def asked(db) -> list[CustomQuestion]:
    """Questions employees are asked now, oldest first."""
    return db.scalars(select(CustomQuestion).where(CustomQuestion.status.in_(("pending", "active")))
                      .order_by(CustomQuestion.id)).all()


def latest_answers(db, employee_ids=None) -> dict[int, dict[int, int]]:
    """employee -> {question id: chosen option} from their most recent answer to each."""
    stmt = select(CustomAnswer).order_by(CustomAnswer.quarter, CustomAnswer.answered_at)
    if employee_ids is not None:
        stmt = stmt.where(CustomAnswer.employee_id.in_(list(employee_ids)))
    out: dict[int, dict[int, int]] = {}
    for a in db.scalars(stmt):
        out.setdefault(a.employee_id, {})[a.question_id] = a.option
    return out


def latest_intents(db) -> dict[int, int]:
    out: dict[int, int] = {}
    for row in db.scalars(select(StayIntent).order_by(StayIntent.quarter, StayIntent.answered_at)):
        out[row.employee_id] = row.value
    return out


def _weighted(db) -> list[CustomQuestion]:
    return db.scalars(select(CustomQuestion).where(CustomQuestion.weights.is_not(None))).all()


def shift_for(answers: dict[int, int], weighted: list[CustomQuestion]) -> float:
    """Log-odds shift from the answers to questions whose effect is in the scores."""
    return sum(q.weights[answers[q.id]] for q in weighted
               if q.id in answers and answers[q.id] < len(q.weights))


def adjust(p: float, shift: float) -> float:
    if not shift:
        return p
    p = min(max(p, 1e-6), 1 - 1e-6)
    return 1 / (1 + math.exp(-(math.log(p / (1 - p)) + shift)))


def adjusted(db, employee_id: int, p: float) -> float:
    """`p` from the base model, moved by this person's answers to questions in the scores."""
    weighted = _weighted(db)
    if not weighted:
        return p
    return adjust(p, shift_for(latest_answers(db, [employee_id]).get(employee_id, {}), weighted))


def save_answers(db, employee_id: int, quarter: str, custom: dict[int, int],
                 intent: int | None, simulated: bool = False) -> None:
    """Upsert this quarter's answers (no commit)."""
    now = datetime.now(UTC)
    for qid, option in custom.items():
        row = db.scalars(select(CustomAnswer).where(
            CustomAnswer.question_id == qid, CustomAnswer.employee_id == employee_id,
            CustomAnswer.quarter == quarter)).first()
        if row is None:
            db.add(CustomAnswer(question_id=qid, employee_id=employee_id, quarter=quarter,
                                option=option, simulated=simulated, answered_at=now))
        else:
            row.option, row.simulated, row.answered_at = option, simulated, now
    if intent is not None:
        row = db.scalars(select(StayIntent).where(StayIntent.employee_id == employee_id,
                                                  StayIntent.quarter == quarter)).first()
        if row is None:
            db.add(StayIntent(employee_id=employee_id, quarter=quarter, value=intent,
                              simulated=simulated, answered_at=now))
        else:
            row.value, row.simulated, row.answered_at = intent, simulated, now
    db.flush()


# ---------------------------------------------------------------- authoring


def add(db, items: list[dict], user_id: int | None, today: date) -> list[CustomQuestion]:
    if len(asked(db)) + len(items) > MAX_QUESTIONS:
        raise HTTPException(409, f"The check-in can carry up to {MAX_QUESTIONS} added questions.")
    made = []
    for item in items:
        options = [o.strip() for o in item["options"]]
        if len({o.lower() for o in options}) != len(options):
            raise HTTPException(422, "Each option must be different.")
        q = CustomQuestion(label=item["label"].strip(), options=options, status="pending",
                           created_quarter=quarter_of(today), created_by=user_id)
        db.add(q)
        made.append(q)
    db.commit()
    return made


def remove(db, question_id: int) -> None:
    """A question never in the scores goes at once; one in the scores waits for a recompute."""
    q = db.get(CustomQuestion, question_id)
    if q is None or q.status == "removed":
        raise HTTPException(404, "No such question.")
    if q.weights is None:
        db.delete(q)
    else:
        q.status = "removed"
    db.commit()


# ---------------------------------------------------------------- status


def _headcount(db) -> int:
    return db.scalar(select(func.count()).select_from(Employee).where(Employee.is_current)) or 0


def _answered(db) -> dict[int, int]:
    """question id -> current staff who have answered it."""
    rows = db.execute(select(CustomAnswer.question_id, func.count(func.distinct(
        CustomAnswer.employee_id))).join(Employee, Employee.employee_id == CustomAnswer.employee_id)
        .where(Employee.is_current).group_by(CustomAnswer.question_id))
    return dict(rows.all())


def _model_state(db) -> dict:
    state = db.get(DemoState, "questions")
    return state.value if state else {}


def status(db) -> dict:
    headcount = _headcount(db)
    answered = _answered(db)
    questions = db.scalars(select(CustomQuestion).order_by(CustomQuestion.id)).all()
    pending = [q for q in questions if q.status == "pending"]
    removed = [q for q in questions if q.status == "removed"]
    lowest = min((answered.get(q.id, 0) / headcount for q in pending), default=1.0) \
        if headcount else 0.0
    needed = bool(pending or removed)
    ready = needed and lowest >= COVERAGE_NEEDED
    if not needed:
        reason = "The scores already include every question."
    elif not ready:
        reason = (f"Waiting for answers: each new question needs {COVERAGE_NEEDED:.0%} of "
                  f"current staff before the model can learn from it.")
    else:
        reason = None

    def out(q: CustomQuestion) -> dict:
        n = answered.get(q.id, 0)
        effects = ([round(math.exp(w), 3) for w in q.weights] if q.weights is not None else None)
        return {"id": q.id, "label": q.label, "options": q.options, "status": q.status,
                "createdQuarter": q.created_quarter, "answered": n,
                "coverage": round(n / headcount, 4) if headcount else 0.0,
                "oddsRatios": effects}

    return {
        "headcount": headcount,
        "coverageNeeded": COVERAGE_NEEDED,
        "maxQuestions": MAX_QUESTIONS,
        "intentQuestion": INTENT_QUESTION,
        "questions": [out(q) for q in questions],
        "recompute": {"needed": needed, "ready": ready, "reason": reason,
                      "coverage": round(lowest, 4) if pending else None,
                      "last": _model_state(db).get("last")},
    }


# ---------------------------------------------------------------- learning


def _sigmoid(z):
    return 1 / (1 + np.exp(-z))


def _fit(offset: np.ndarray, X: np.ndarray, y: np.ndarray, l2: float = L2) -> np.ndarray:
    """Logistic regression on [base log-odds, 1, X] by Newton steps; L2 on the X weights only.

    Returns [slope on base log-odds, intercept, *weights].
    """
    A = np.column_stack([offset, np.ones(len(y)), X])
    beta = np.zeros(A.shape[1])
    penalty = np.full(A.shape[1], l2)
    penalty[:2] = 1e-6
    for _ in range(50):
        p = _sigmoid(A @ beta)
        grad = A.T @ (p - y) + penalty * beta
        hess = (A * (p * (1 - p))[:, None]).T @ A + np.diag(penalty)
        step = np.linalg.solve(hess, grad)
        beta -= step
        if np.abs(step).max() < 1e-8:
            break
    return beta


def _auc(y: np.ndarray, score: np.ndarray) -> float:
    order = np.argsort(score, kind="mergesort")
    ranks = np.empty(len(score))
    ranks[order] = np.arange(1, len(score) + 1)
    # Average ranks for ties.
    for s in np.unique(score):
        tie = score == s
        if tie.sum() > 1:
            ranks[tie] = ranks[tie].mean()
    pos = y == 1
    n_pos, n_neg = pos.sum(), (~pos).sum()
    return float((ranks[pos].sum() - n_pos * (n_pos + 1) / 2) / (n_pos * n_neg))


def _cv_auc(offset, X, y, k: int = 5) -> tuple[float, float]:
    """Held-out AUC for stay intent: base model alone vs base model plus the questions."""
    folds = np.arange(len(y)) % k
    np.random.default_rng(0).shuffle(folds)
    base, full = np.empty(len(y)), np.empty(len(y))
    empty = np.zeros((len(y), 0))
    for f in range(k):
        tr, te = folds != f, folds == f
        b0 = _fit(offset[tr], empty[tr], y[tr])
        b1 = _fit(offset[tr], X[tr], y[tr])
        base[te] = b0[0] * offset[te] + b0[1]
        full[te] = b1[0] * offset[te] + b1[1] + X[te] @ b1[2:]
    return _auc(y, base), _auc(y, full)


def _base_scores(db, staff: list[Employee]) -> dict[int, float]:
    feats = current_features_bulk(db, staff)
    frame = pd.DataFrame([{**feats[e.employee_id], "fold": e.fold} for e in staff])
    scores = get_service().score_frame(frame)
    return {e.employee_id: float(p) for e, p in zip(staff, scores, strict=True)}


def bulk_rescore(db, base: dict[int, float] | None = None) -> dict[int, tuple[float, str]]:
    """Every current person's score from the base model plus question effects (no commit).

    Written in one executemany, not 1,233 ORM updates. Returns {employee: (score, band)}.
    """
    svc = get_service()
    staff = db.scalars(select(Employee).where(Employee.is_current)).all()
    base = base or _base_scores(db, staff)
    weighted = _weighted(db)
    answers = latest_answers(db) if weighted else {}
    out = {}
    for e in staff:
        p = adjust(base[e.employee_id], shift_for(answers.get(e.employee_id, {}), weighted))
        out[e.employee_id] = (p, svc.band(p))
    db.execute(update(Employee), [{"employee_id": k, "risk_score": p, "risk_band": b}
                                  for k, (p, b) in out.items()])
    db.expire_all()
    return out


def recompute(db) -> dict:
    st = status(db)["recompute"]
    if not st["needed"]:
        raise HTTPException(409, st["reason"])
    if not st["ready"]:
        raise HTTPException(409, st["reason"])
    staff = db.scalars(select(Employee).where(Employee.is_current)).all()
    before = {e.employee_id: (e.risk_score, e.risk_band) for e in staff}
    keep = db.scalars(select(CustomQuestion).where(CustomQuestion.status.in_(("pending", "active")))
                      .order_by(CustomQuestion.id)).all()
    base = _base_scores(db, staff)  # the base model doesn't change; score everyone once
    lift = None
    if keep:
        lift = _learn(db, staff, keep, base)
    for q in db.scalars(select(CustomQuestion).where(CustomQuestion.status == "removed")):
        db.delete(q)
    db.flush()
    after = bulk_rescore(db, base)
    moved = sum(1 for k, (_, band) in after.items() if before[k][1] != band)
    mean_before = sum(s for s, _ in before.values()) / len(before)
    mean_after = sum(p for p, _ in after.values()) / len(after)
    result = {"computedAt": datetime.now(UTC).isoformat(), "questions": len(keep),
              "rescored": len(staff), "bandChanges": moved,
              "meanRiskBefore": round(mean_before, 4), "meanRiskAfter": round(mean_after, 4),
              "intentAuc": lift}
    state = db.get(DemoState, "questions")
    if state is None:
        db.add(DemoState(key="questions", value={"last": result}))
    else:
        state.value = {**state.value, "last": result}
    db.commit()
    return result


def _keep_company_mean(staff, questions, answers, base) -> None:
    """Shift every weight by one constant so the company-wide mean risk stays where the base
    model puts it: the questions re-rank people, they don't change how many are likely to leave.
    """
    target = sum(base.values()) / len(base)
    per_q = 1 / len(questions)

    def mean_with(k: float) -> float:
        total = 0.0
        for e in staff:
            mine = answers.get(e.employee_id, {})
            shift = sum(q.weights[mine[q.id]] + k * per_q for q in questions if q.id in mine)
            total += adjust(base[e.employee_id], shift)
        return total / len(staff)

    lo, hi = -20.0, 20.0
    for _ in range(40):
        mid = (lo + hi) / 2
        lo, hi = (mid, hi) if mean_with(mid) < target else (lo, mid)
    k = (lo + hi) / 2
    for q in questions:
        q.weights = [round(w + k * per_q, 4) for w in q.weights]


def _learn(db, staff: list[Employee], questions: list[CustomQuestion],
           base: dict[int, float]) -> dict:
    """Fit each question's per-option effect against stay intent; store centred weights."""
    intents = latest_intents(db)
    answers = latest_answers(db)
    rows = [e for e in staff if e.employee_id in intents]
    y = np.array([1.0 if intents[e.employee_id] >= LEAVING else 0.0 for e in rows])
    if y.sum() < MIN_CLASS or (1 - y).sum() < MIN_CLASS:
        raise HTTPException(409, "Not enough stay-intent answers on both sides to learn from yet.")
    offset = np.array([math.log(min(max(base[e.employee_id], 1e-6), 1 - 1e-6)
                                / (1 - min(max(base[e.employee_id], 1e-6), 1 - 1e-6)))
                       for e in rows])

    columns: list[tuple[int, int]] = []  # (question index, option) for each X column
    for qi, q in enumerate(questions):
        counts = [sum(1 for e in rows if answers.get(e.employee_id, {}).get(q.id) == o)
                  for o in range(len(q.options))]
        columns += [(qi, o) for o in range(len(q.options)) if counts[o] >= MIN_OPTION_ANSWERS]
    X = np.array([[1.0 if answers.get(e.employee_id, {}).get(questions[qi].id) == o else 0.0
                   for qi, o in columns] for e in rows]).reshape(len(rows), len(columns))

    beta = _fit(offset, X, y)
    auc_base, auc_full = _cv_auc(offset, X, y)
    raw = {col: float(w) for col, w in zip(columns, beta[2:], strict=True)}
    for qi, q in enumerate(questions):
        w = [raw.get((qi, o), 0.0) for o in range(len(q.options))]
        # Centre on the people who answered, so a typical answer leaves a score where it was.
        chosen = [answers[e.employee_id][q.id] for e in staff
                  if q.id in answers.get(e.employee_id, {})]
        centre = sum(w[o] for o in chosen) / len(chosen) if chosen else 0.0
        q.weights = [max(-MAX_EFFECT, min(MAX_EFFECT, x - centre)) for x in w]
        q.status = "active"
    _keep_company_mean(staff, questions, answers, base)
    return {"baseOnly": round(auc_base, 4), "withQuestions": round(auc_full, 4),
            "n": len(rows)}


# ---------------------------------------------------------------- sample answers


def simulate(db, today: date) -> int:
    """Answer the asked questions (and stay intent) for most people who haven't yet.

    Sample data so the recompute can be seen working: each person gets a hidden "restlessness",
    each option a hidden pull, and people choose options and stay intent consistent with both.
    """
    questions = asked(db)
    if not questions:
        raise HTTPException(409, "Add a question first.")
    quarter = quarter_of(today)
    staff = db.scalars(select(Employee).where(Employee.is_current)
                       .order_by(Employee.employee_id)).all()
    answers = latest_answers(db)
    intents = latest_intents(db)
    pulls = {q.id: [random.Random(q.id * 7919 + o).gauss(0, 1.0) for o in range(len(q.options))]
             for q in questions}
    todo = [e for e in staff
            if any(q.id not in answers.get(e.employee_id, {}) for q in questions)]
    filled = 0
    rows: list[dict] = []
    intent_rows: list[dict] = []
    now = datetime.now(UTC)
    for e in todo:
        rng = random.Random(e.employee_id * 104729 + len(questions))
        if rng.random() > SIMULATED_SHARE:
            continue
        restless = rng.gauss(0, 1.0)
        custom = {}
        for q in questions:
            if q.id in answers.get(e.employee_id, {}):
                continue
            logits = [restless * pull for pull in pulls[q.id]]
            top = max(logits)
            weights = [math.exp(v - top) for v in logits]
            custom[q.id] = rng.choices(range(len(q.options)), weights=weights)[0]
        intent = None
        if e.employee_id not in intents:
            p = min(max(e.risk_score, 1e-6), 1 - 1e-6)
            drift = 0.5 * sum(pulls[qid][o] for qid, o in custom.items())
            s = math.log(p / (1 - p)) + 0.8 * restless + drift + rng.gauss(0, 0.6)
            intent = 1 + sum(s > t for t in (-3.0, -2.0, -1.0, 0.0))
        rows += [{"question_id": qid, "employee_id": e.employee_id, "quarter": quarter,
                  "option": o, "simulated": True, "answered_at": now} for qid, o in custom.items()]
        if intent is not None:
            intent_rows.append({"employee_id": e.employee_id, "quarter": quarter, "value": intent,
                                "simulated": True, "answered_at": now})
        filled += 1
    # One round trip each: nobody filled here has a row for these questions this quarter.
    if rows:
        db.execute(insert(CustomAnswer).values(rows).on_conflict_do_nothing())
    if intent_rows:
        db.execute(insert(StayIntent).values(intent_rows).on_conflict_do_nothing())
    db.commit()
    return filled


# ---------------------------------------------------------------- reset


def clear(db) -> bool:
    """Remove every added question, answer and intent; True if scores need recomputing."""
    had_effects = bool(_weighted(db))
    db.execute(delete(CustomAnswer))
    db.execute(delete(StayIntent))
    db.execute(delete(CustomQuestion))
    db.execute(update(DemoState).where(DemoState.key == "questions").values(value={}))
    db.flush()
    return had_effects
