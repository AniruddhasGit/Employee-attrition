"""Demo personas, seeded quarterly history and the daily reset.

The IBM data is a single snapshot, so the seed invents believable history around it: the last
closed quarter's check-in is exactly the IBM answers, the two before it drift a little, and about
65% of current staff have answered the open quarter. Five accounts (one HR, four employees) each
tell one story. Everything is deterministic, so a reset rebuilds the same demo.
"""

import random
from datetime import UTC, date, datetime, time, timedelta

import pandas as pd
from sqlalchemy import delete, insert, select, update

from api.auth import hash_password
from api.models import ActionPlan, CheckIn, DemoState, Employee, TeamUpdate, User
from api.models import Session as UserSession
from api.people import rescore
from api.quarters import history, quarter_of
from api.scoring import (
    CHECKIN_FIELDS,
    KEEP_ME,
    SCALE_FIELDS,
    apply_action,
    effective_features,
    sharp_drop,
)
from api.service import get_service
from api.settings import get_settings

SEED = 20261018
DOMAIN = "retain.demo"
COLUMNS = list(CHECKIN_FIELDS.values())
RESPONSE_RATE = 0.65
SHARP_DROP_RATE = 0.04
N_PLANS = 40
RESET_EVERY = timedelta(hours=24)

HR_PERSONA = {"story": "hr", "role": "hr", "employee_id": None,
              "display_name": "Priya Shah", "email": f"priya.shah@{DOMAIN}",
              "label": "Priya Shah · HR manager"}
STORIES = ("sharp_drop", "stable", "not_answered", "plan_worked")

# The action an HR partner would reach for first, given someone's biggest risk driver.
ACTION_FOR_DRIVER = {
    "MonthlyIncome": "pay_review", "OverTime": "reduce_overtime", "StockOptionLevel": "stock_grant",
    "JobLevel": "promotion", "YearsSinceLastPromotion": "promotion",
    "TrainingTimesLastYear": "training_plan", "BusinessTravel": "reduce_travel",
}
PLAN_NOTES = {
    "pay_review": "Benchmark against the role's market range.",
    "promotion": "Talk through the path to the next level.",
    "reduce_overtime": "Rebalance the team's on-call rota.",
    "stock_grant": "Include in the next refresh cycle.",
    "training_plan": "Enrol in two courses this quarter.",
    "reduce_travel": "Move client check-ins to video where possible.",
    "stay_interview": "Ask what would make the next year great.",
}
COMMENTS = {
    "pay": ["My pay hasn't kept up with what the role now involves.",
            "A clearer salary band would help me plan."],
    "growth": ["I'd like to know what the next step looks like for me.",
               "It's been a while since my role changed."],
    "flexibility": ["Two remote days a week would make a big difference.",
                    "Flexible start times would help with the school run."],
    "recognition": ["A quick thank-you when a project lands goes a long way.",
                    "Wins on our team rarely get mentioned."],
    "manager": ["More regular one-to-ones with my manager would help.",
                "I'd like clearer feedback on how I'm doing."],
    "less_overtime": ["The late finishes are wearing me down.",
                      "Overtime has become the norm, not the exception."],
    "learning": ["I'd love time for a certification this year.",
                 "Mentoring from a senior colleague would help me grow."],
    "less_travel": ["The travel is hard on my family.",
                    "Fewer overnight trips would help a lot."],
    "security": ["I'd like more clarity on where the team is heading.",
                 "Restructuring rumours make it hard to focus."],
}
UPDATES = {
    "pay": ("Pay hasn't kept up with the role.",
            "We benchmarked every role against market rates and adjusted 14 salaries."),
    "growth": ("It's unclear how to move up.",
               "Each level now has a written path, and managers review it twice a year."),
    "flexibility": ("We want more flexible hours.",
                    "Core hours are now 10 to 3; the rest is up to you and your team."),
    "recognition": ("Good work goes unnoticed.",
                    "Team leads now share wins in the monthly all-hands."),
    "manager": ("We'd like more time with our managers.",
                "Every manager now holds a fortnightly one-to-one with each report."),
    "less_overtime": ("Overtime has become routine.",
                      "We hired two people to cover peak weeks and capped on-call shifts."),
    "learning": ("We want more time for learning.",
                 "Everyone now has two learning days a quarter, with a budget to match."),
    "less_travel": ("There's too much travel.",
                    "Routine client check-ins moved to video; travel is now for kick-offs."),
    "security": ("We'd like more clarity about the future.",
                 "Leadership now shares the plan and the numbers each quarter."),
}


# ---------------------------------------------------------------- dates


def _quarter_start(q: str) -> date:
    year, n = q.split("-Q")
    return date(int(year), 3 * (int(n) - 1) + 1, 1)


def _at(d: date) -> datetime:
    return datetime.combine(d, time(10, 0), tzinfo=UTC)


# ---------------------------------------------------------------- answers


def _drift(rng: random.Random, answers: dict) -> dict:
    out = dict(answers)
    for c in SCALE_FIELDS:
        r = rng.random()
        step = -1 if r < 0.15 else (1 if r > 0.85 else 0)
        out[c] = min(4, max(1, int(out[c]) + step))
    if rng.random() < 0.08:
        out["OverTime"] = "No" if out["OverTime"] == "Yes" else "Yes"
    out["TrainingTimesLastYear"] = min(6, max(0, int(out["TrainingTimesLastYear"])
                                              + rng.choice((-1, 0, 0, 1))))
    return out


def _sharp(rng: random.Random, answers: dict, base: dict) -> dict:
    out = dict(answers)
    options = [c for c in SCALE_FIELDS if int(base[c]) >= 3]
    if options:
        c = rng.choice(options)
        out[c] = max(1, int(base[c]) - 2)
    return out


def _keep_me(rng: random.Random, features: dict, income_median: dict) -> list[str]:
    weights = {k: 1.0 for k in KEEP_ME}
    if int(features["WorkLifeBalance"]) <= 2:
        weights["flexibility"] += 4
    if features["OverTime"] == "Yes":
        weights["less_overtime"] += 4
    if features["MonthlyIncome"] < income_median[int(features["JobLevel"])]:
        weights["pay"] += 3
    if int(features["YearsSinceLastPromotion"]) >= 3:
        weights["growth"] += 3
    if int(features["RelationshipSatisfaction"]) <= 2:
        weights["manager"] += 3
    if features["BusinessTravel"] == "Travel_Frequently":
        weights["less_travel"] += 3
    if int(features["TrainingTimesLastYear"]) <= 1:
        weights["learning"] += 2
    picks: list[str] = []
    for _ in range(rng.randint(1, 3)):
        keys = [k for k in weights if k not in picks]
        picks.append(rng.choices(keys, [weights[k] for k in keys])[0])
    return picks


# ---------------------------------------------------------------- personas


def personas(db) -> list[dict]:
    state = db.get(DemoState, "seed")
    return state.value["personas"] if state else []


def _email(name: str) -> str:
    return ".".join("".join(ch for ch in part.lower() if ch.isalpha())
                    for part in name.split()) + f"@{DOMAIN}"


# ---------------------------------------------------------------- seeding


def _wipe(db) -> None:
    db.execute(delete(UserSession))
    db.execute(delete(User).where(User.email.like(f"%@{DOMAIN}")))
    db.execute(delete(CheckIn))
    db.execute(delete(ActionPlan))
    db.execute(delete(TeamUpdate))
    db.execute(update(Employee).values(record={}, record_at=None))
    db.flush()


class _Scorer:
    """Scores (employee, answers, record) combinations in batches."""

    def __init__(self, staff: dict[int, Employee]):
        self.svc = get_service()
        self.staff = staff

    def frame(self, items: list[tuple[int, dict, dict]]) -> pd.DataFrame:
        return pd.DataFrame([
            {**effective_features(self.staff[eid].features, record, answers),
             "fold": self.staff[eid].fold}
            for eid, answers, record in items
        ])

    def scores(self, items: list[tuple[int, dict, dict]]) -> list[float]:
        if not items:
            return []
        return [float(p) for p in self.svc.score_frame(self.frame(items))]

    def one(self, eid: int, answers: dict, record: dict) -> float:
        return self.scores([(eid, answers, record)])[0]


def seed_history(db, today: date) -> None:
    """Replace all demo rows with freshly generated history relative to `today`'s quarter."""
    _wipe(db)
    rng = random.Random(SEED)
    svc = get_service()
    quarters = history(quarter_of(today))
    closed, cur = quarters[:3], quarters[3]
    last = closed[-1]

    staff = {e.employee_id: e for e in db.scalars(
        select(Employee).where(Employee.is_current).order_by(Employee.employee_id))}
    ids = list(staff)
    scorer = _Scorer(staff)
    base = {eid: {c: staff[eid].features[c] for c in COLUMNS} for eid in ids}

    answers: dict[int, dict[str, dict]] = {}
    for eid in ids:
        a = {last: base[eid]}
        a[closed[1]] = _drift(rng, base[eid])
        a[closed[0]] = _drift(rng, a[closed[1]])
        if rng.random() < RESPONSE_RATE:
            now = _drift(rng, base[eid])
            if rng.random() < SHARP_DROP_RATE:
                now = _sharp(rng, now, base[eid])
            a[cur] = now
        answers[eid] = a

    # Action plans: created last quarter for the highest-risk people, half of them done.
    base_scores = dict(zip(ids, scorer.scores([(eid, base[eid], {}) for eid in ids]),
                           strict=True))
    candidates = sorted((eid for eid in ids if svc.band(base_scores[eid]) == "high"),
                        key=lambda eid: (-base_scores[eid], eid))[:N_PLANS]
    top = dict(zip(candidates, svc.drivers_frame(scorer.frame(
        [(eid, base[eid], {}) for eid in candidates])), strict=True))
    plans: dict[int, dict] = {}
    for i, eid in enumerate(candidates):
        raising = [d["feature"] for d in top[eid] if d["direction"] == "raises"]
        action = next((ACTION_FOR_DRIVER[f] for f in raising if f in ACTION_FOR_DRIVER),
                      "stay_interview")
        plans[eid] = {"action": action, "done": i % 2 == 0}
    done = [eid for eid in candidates if plans[eid]["done"]]
    if not any(plans[eid]["action"] == "pay_review" for eid in done):
        plans[done[0]]["action"] = "pay_review"

    def record_for(eid: int) -> dict:
        p = plans.get(eid)
        if not p or not p["done"]:
            return {}
        f = staff[eid].features
        return {k: v for k, v in apply_action(f, p["action"]).items() if f.get(k) != v}

    def score_of(eid: int, q: str) -> float:
        return scorer.one(eid, answers[eid][q], record_for(eid) if q == cur else {})

    # Score every check-in in one batch.
    keys = [(eid, q) for eid in ids for q in quarters if q in answers[eid]]
    scores = dict(zip(keys, scorer.scores(
        [(eid, answers[eid][q], record_for(eid) if q == cur else {}) for eid, q in keys]),
        strict=True))

    # Personas: the lowest employee ID that fits each story, nudged into shape if none does.
    used: set[int] = set()

    def pick(ok, force=None) -> int:
        for eid in ids:
            if eid not in used and ok(eid):
                used.add(eid)
                return eid
        for eid in ids:
            if eid not in used and force and force(eid):
                used.add(eid)
                return eid
        raise RuntimeError("could not build a demo persona")

    def is_sharp(eid):
        if cur not in answers[eid] or eid in plans:
            return False
        fields = sharp_drop(answers[eid][last], answers[eid][cur], scores[(eid, last)],
                            scores[(eid, cur)])
        return any(f != "risk" for f in fields) and svc.band(scores[(eid, cur)]) == "high"

    def force_sharp(eid):
        if eid in plans or svc.band(base_scores[eid]) != "high":
            return False
        c = next((c for c in SCALE_FIELDS if int(base[eid][c]) >= 3), None)
        if c is None:
            return False
        answers[eid][cur] = {**base[eid], c: int(base[eid][c]) - 2}
        scores[(eid, cur)] = score_of(eid, cur)
        return svc.band(scores[(eid, cur)]) == "high"

    def is_stable(eid):
        return (cur in answers[eid] and eid not in plans
                and answers[eid][cur] == answers[eid][last]
                and svc.band(scores[(eid, cur)]) == "low")

    def force_stable(eid):
        if eid in plans or svc.band(base_scores[eid]) != "low":
            return False
        answers[eid][cur] = dict(base[eid])
        scores[(eid, cur)] = score_of(eid, cur)
        return True

    def is_not_answered(eid):
        return cur not in answers[eid] and eid not in plans

    def is_plan_worked(eid):
        p = plans.get(eid)
        return (p is not None and p["done"] and p["action"] == "pay_review"
                and cur in answers[eid] and scores[(eid, cur)] <= base_scores[eid] - 0.05)

    def force_plan_worked(eid):
        p = plans.get(eid)
        if not (p and p["done"] and p["action"] == "pay_review"):
            return False
        now = dict(answers[eid].get(cur, base[eid]))
        for c in SCALE_FIELDS:
            now[c] = min(4, max(int(now[c]), int(base[eid][c])) + 1)
            answers[eid][cur] = now
            scores[(eid, cur)] = score_of(eid, cur)
            if scores[(eid, cur)] <= base_scores[eid] - 0.05:
                return True
        now["OverTime"] = "No"
        answers[eid][cur] = now
        scores[(eid, cur)] = score_of(eid, cur)
        return scores[(eid, cur)] <= base_scores[eid] - 0.05

    chosen = {
        "sharp_drop": pick(is_sharp, force_sharp),
        "stable": pick(is_stable, force_stable),
        "not_answered": pick(is_not_answered),
        "plan_worked": pick(is_plan_worked, force_plan_worked),
    }

    # Check-in rows (with expectations and some comments).
    income_median = (pd.DataFrame([staff[eid].features for eid in ids])
                     .groupby("JobLevel")["MonthlyIncome"].median().to_dict())
    elapsed = max(0, (today - _quarter_start(cur)).days)
    rows = []
    for eid, q in sorted(scores):
        if q not in answers[eid]:
            continue
        feats = effective_features(staff[eid].features, record_for(eid) if q == cur else {},
                                   answers[eid][q])
        keep = _keep_me(rng, feats, income_median)
        day = (_quarter_start(q) + timedelta(days=rng.randint(0, elapsed)) if q == cur
               else _quarter_start(q) + timedelta(days=20))
        rows.append({
            "employee_id": eid, "quarter": q, "answers": answers[eid][q], "keep_me": keep,
            "comment": rng.choice(COMMENTS[keep[0]]) if rng.random() < 0.3 else "",
            "risk_score": scores[(eid, q)], "drivers": None, "submitted_at": _at(day),
            "seeded": True,
        })
    db.execute(insert(CheckIn), rows)

    done_at = _at(_quarter_start(last) + timedelta(days=45))
    plan_rows = []
    for eid in candidates:
        p = plans[eid]
        est = scorer.one(eid, base[eid], {
            k: v for k, v in apply_action(staff[eid].features, p["action"]).items()
            if staff[eid].features.get(k) != v})
        status = "done" if p["done"] else "open"
        plan_rows.append({
            "employee_id": eid, "action": p["action"], "note": PLAN_NOTES[p["action"]],
            "created_quarter": last, "score_at_creation": base_scores[eid],
            "estimated_score": est, "status": status,
            "done_at": done_at if p["done"] else None, "seeded": True,
            "seed_snapshot": {"status": status, "done_at": done_at.isoformat() if p["done"]
                              else None, "note": PLAN_NOTES[p["action"]]},
        })
    db.execute(insert(ActionPlan), plan_rows)

    departments = sorted({staff[eid].department for eid in ids})
    update_rows = []
    for q in closed:
        for dept in departments:
            for key in rng.sample(list(UPDATES), 2):
                said, did = UPDATES[key]
                update_rows.append({"department": dept, "quarter": q, "said": said, "did": did,
                                    "seeded": True})
    db.execute(insert(TeamUpdate), update_rows)

    # Current scores and drivers for everyone, from their latest inputs.
    latest = {eid: answers[eid][cur] if cur in answers[eid] else answers[eid][last] for eid in ids}
    # Plans were finished after last quarter's check-in, so for people who haven't answered
    # this quarter the record outranks those older answers (see people.current_features).
    now_items = [(eid, latest[eid] if cur in answers[eid]
                  else {k: record_for(eid).get(k, v) for k, v in latest[eid].items()},
                  record_for(eid)) for eid in ids]
    now_frame = scorer.frame(now_items)
    now_scores = svc.score_frame(now_frame)
    now_drivers = svc.drivers_frame(now_frame)
    db.execute(update(Employee), [
        {"employee_id": eid, "risk_score": float(p), "risk_band": svc.band(float(p)),
         "drivers": drv, "record": record_for(eid),
         "record_at": done_at if record_for(eid) else None}
        for eid, p, drv in zip(ids, now_scores, now_drivers, strict=True)
    ])
    latest_q = {eid: cur if cur in answers[eid] else last for eid in ids}
    for eid, drv in zip(ids, now_drivers, strict=True):
        db.execute(update(CheckIn).where(CheckIn.employee_id == eid,
                                         CheckIn.quarter == latest_q[eid]).values(drivers=drv))

    # Accounts.
    password = hash_password(get_settings().demo_password)
    people = [HR_PERSONA]
    for story in STORIES:
        e = staff[chosen[story]]
        people.append({"story": story, "role": "employee", "employee_id": e.employee_id,
                       "display_name": e.name, "email": _email(e.name),
                       "label": f"{e.name} · {e.department}"})
    db.execute(insert(User), [
        {"email": p["email"], "password_hash": password, "role": p["role"],
         "employee_id": p["employee_id"], "display_name": p["display_name"]} for p in people
    ])

    value = {"quarter": cur, "last_reset": datetime.now(UTC).isoformat(), "personas": people}
    state = db.get(DemoState, "seed")
    if state is None:
        db.add(DemoState(key="seed", value=value))
    else:
        state.value = value
    db.commit()


# ---------------------------------------------------------------- reset


def reset(db, today: date, full: bool = False) -> None:
    """Undo what visitors did. A full reset regenerates history for `today`'s quarter."""
    if full:
        seed_history(db, today)
        return
    touched: set[int] = set()
    for model in (CheckIn, ActionPlan):
        touched |= set(db.scalars(select(model.employee_id).where(~model.seeded)))
        db.execute(delete(model).where(~model.seeded))
    db.execute(delete(TeamUpdate).where(~TeamUpdate.seeded))
    db.execute(delete(UserSession))

    for plan in db.scalars(select(ActionPlan).where(ActionPlan.seeded)):
        snap = plan.seed_snapshot or {}
        done_at = datetime.fromisoformat(snap["done_at"]) if snap.get("done_at") else None
        if (plan.status, plan.done_at, plan.note) != (snap.get("status"), done_at,
                                                      snap.get("note")):
            plan.status, plan.done_at, plan.note = snap["status"], done_at, snap["note"]
            touched.add(plan.employee_id)

    expected: dict[int, dict] = {}
    seeded_done_at = None
    for plan in db.scalars(select(ActionPlan).where(ActionPlan.seeded,
                                                    ActionPlan.status == "done")):
        seeded_done_at = plan.done_at
        e = db.get(Employee, plan.employee_id)
        expected[e.employee_id] = {k: v for k, v in apply_action(e.features, plan.action).items()
                                   if e.features.get(k) != v}
    for e in db.scalars(select(Employee).where(Employee.is_current)):
        want = expected.get(e.employee_id, {})
        if (e.record or {}) != want or (not want and e.record_at is not None):
            e.record = want
            touched.add(e.employee_id)
        if want and e.record_at != seeded_done_at:
            e.record_at = seeded_done_at
            touched.add(e.employee_id)
        elif not want:
            e.record_at = None

    for eid in touched:
        rescore(db, db.get(Employee, eid))
    state = db.get(DemoState, "seed")
    state.value = {**state.value, "last_reset": datetime.now(UTC).isoformat()}
    db.commit()


def maybe_reset(db, now: datetime, allow_full: bool = True) -> bool:
    """Run the daily reset if it is due (24 h passed, or a new quarter began).

    Regenerating history for a new quarter takes about a minute, so sign-in passes
    allow_full=False and leaves that to startup, where the seed already does it.
    """
    state = db.get(DemoState, "seed")
    if state is None:
        return False
    if allow_full and quarter_of(now.date()) != state.value["quarter"]:
        reset(db, now.date(), full=True)
        return True
    if now - datetime.fromisoformat(state.value["last_reset"]) >= RESET_EVERY:
        reset(db, now.date())
        return True
    return False

