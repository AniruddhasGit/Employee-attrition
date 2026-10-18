"""Check-in answers and action plans as changes to a person's model inputs.

The IBM record is never modified. A person's current inputs are the baseline, then the HR record
overlay (completed action plans), then the mapped fields of their latest check-in.
"""

# API key -> model column. These are the only inputs an employee's check-in can change.
CHECKIN_FIELDS: dict[str, str] = {
    "environmentSatisfaction": "EnvironmentSatisfaction",
    "jobSatisfaction": "JobSatisfaction",
    "relationshipSatisfaction": "RelationshipSatisfaction",
    "workLifeBalance": "WorkLifeBalance",
    "jobInvolvement": "JobInvolvement",
    "overTime": "OverTime",
    "businessTravel": "BusinessTravel",
    "trainingTimesLastYear": "TrainingTimesLastYear",
}
SCALE_FIELDS = [
    "EnvironmentSatisfaction", "JobSatisfaction", "RelationshipSatisfaction", "WorkLifeBalance",
    "JobInvolvement",
]
TRAVEL = ["Non-Travel", "Travel_Rarely", "Travel_Frequently"]

KEEP_ME: dict[str, str] = {
    "pay": "Pay",
    "growth": "Growth and promotion",
    "flexibility": "Flexible hours or remote work",
    "recognition": "Recognition",
    "manager": "A better manager relationship",
    "less_overtime": "Less overtime",
    "learning": "Learning and training",
    "less_travel": "Less travel",
    "security": "Job security",
}

ACTIONS: dict[str, str] = {
    "pay_review": "Pay review",
    "promotion": "Promotion conversation",
    "reduce_overtime": "Reduce overtime",
    "stock_grant": "Stock grant",
    "training_plan": "Training plan",
    "reduce_travel": "Reduce travel",
    "stay_interview": "Stay interview",
}

PLAIN_NAMES = {
    "EnvironmentSatisfaction": "workplace satisfaction",
    "JobSatisfaction": "job satisfaction",
    "RelationshipSatisfaction": "working relationships",
    "WorkLifeBalance": "work-life balance",
    "JobInvolvement": "job involvement",
    "OverTime": "overtime",
    "BusinessTravel": "travel",
    "TrainingTimesLastYear": "training",
}
TRAVEL_WORDS = {"Non-Travel": "none", "Travel_Rarely": "rarely", "Travel_Frequently": "frequently"}

SHARP_DROP_POINTS = 2
SHARP_RISE = 0.10
STEADY = 0.02


def apply_action(features: dict, action: str) -> dict:
    """A copy of `features` with the action's lever change applied."""
    f = dict(features)
    if action == "pay_review":
        f["MonthlyIncome"] = round(f["MonthlyIncome"] * 1.10)
    elif action == "promotion":
        f["JobLevel"] = min(5, f["JobLevel"] + 1)
        f["YearsSinceLastPromotion"] = 0
    elif action == "reduce_overtime":
        f["OverTime"] = "No"
    elif action == "stock_grant":
        f["StockOptionLevel"] = min(3, f["StockOptionLevel"] + 1)
    elif action == "training_plan":
        f["TrainingTimesLastYear"] = min(6, f["TrainingTimesLastYear"] + 2)
    elif action == "reduce_travel":
        f["BusinessTravel"] = TRAVEL[max(0, TRAVEL.index(f["BusinessTravel"]) - 1)]
    elif action != "stay_interview":
        raise ValueError(f"unknown action {action!r}")
    return f


def effective_features(base: dict, record: dict, answers: dict | None) -> dict:
    return {**base, **record, **(answers or {})}


def _worse(column: str, old, new) -> int:
    """+n when the answer moved in the direction that tends to raise risk, -n when it improved."""
    if column == "OverTime":
        return (new == "Yes") - (old == "Yes")
    if column == "BusinessTravel":
        return TRAVEL.index(new) - TRAVEL.index(old)
    return int(old) - int(new)  # satisfaction scales and training: lower is worse


def sharp_drop(prev_answers: dict | None, answers: dict, prev_score: float | None,
               score: float) -> list[str]:
    """Columns whose 1-4 answer fell by 2+ points, plus 'risk' when risk rose 10+ points."""
    if prev_answers is None or prev_score is None:
        return []
    out = [c for c in SCALE_FIELDS
           if c in answers and c in prev_answers
           and int(prev_answers[c]) - int(answers[c]) >= SHARP_DROP_POINTS]
    if score - prev_score >= SHARP_RISE - 1e-9:
        out.append("risk")
    return out


def _describe(column: str, old, new) -> str:
    name = PLAIN_NAMES[column]
    if column == "OverTime":
        return "they started working overtime" if new == "Yes" else "they stopped working overtime"
    if column == "BusinessTravel":
        return f"travel went from {TRAVEL_WORDS[old]} to {TRAVEL_WORDS[new]}"
    verb = "dropped" if int(new) < int(old) else "rose"
    return f"{name} {verb} from {old} to {new}"


def change_sentence(prev_answers: dict, answers: dict, prev_score: float, score: float,
                    prev_quarter: str) -> str:
    delta = score - prev_score
    if abs(delta) < STEADY:
        return f"Risk is steady since {prev_quarter}."
    direction = "rose" if delta > 0 else "fell"
    head = f"Risk {direction} {round(abs(delta) * 100)} pts since {prev_quarter}"
    changed = [(c, prev_answers[c], answers[c]) for c in CHECKIN_FIELDS.values()
               if c in prev_answers and c in answers and prev_answers[c] != answers[c]]
    sign = 1 if delta > 0 else -1
    matching = [x for x in changed if _worse(*x) * sign > 0]
    if not matching:
        return head + "."
    column, old, new = max(matching, key=lambda x: abs(_worse(*x)))
    return f"{head}, mostly because {_describe(column, old, new)}."
