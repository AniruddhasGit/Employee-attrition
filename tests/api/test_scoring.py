from api.scoring import (
    ACTIONS,
    CHECKIN_FIELDS,
    KEEP_ME,
    apply_action,
    change_sentence,
    effective_features,
    sharp_drop,
)

BASE = {
    "MonthlyIncome": 5000, "JobLevel": 2, "YearsSinceLastPromotion": 4, "OverTime": "Yes",
    "StockOptionLevel": 1, "TrainingTimesLastYear": 2, "BusinessTravel": "Travel_Frequently",
    "WorkLifeBalance": 3,
}


def test_vocabularies():
    assert len(CHECKIN_FIELDS) == 8 and CHECKIN_FIELDS["workLifeBalance"] == "WorkLifeBalance"
    assert list(KEEP_ME)[:2] == ["pay", "growth"] and len(KEEP_ME) == 9
    assert set(ACTIONS) == {"pay_review", "promotion", "reduce_overtime", "stock_grant",
                            "training_plan", "reduce_travel", "stay_interview"}


def test_apply_action_levers():
    assert apply_action(BASE, "pay_review")["MonthlyIncome"] == 5500
    promoted = apply_action({**BASE, "JobLevel": 5}, "promotion")
    assert promoted["JobLevel"] == 5 and promoted["YearsSinceLastPromotion"] == 0
    assert apply_action(BASE, "promotion")["JobLevel"] == 3
    assert apply_action(BASE, "reduce_overtime")["OverTime"] == "No"
    assert apply_action({**BASE, "StockOptionLevel": 3}, "stock_grant")["StockOptionLevel"] == 3
    assert apply_action(BASE, "stock_grant")["StockOptionLevel"] == 2
    assert apply_action({**BASE, "TrainingTimesLastYear": 5}, "training_plan")[
        "TrainingTimesLastYear"] == 6
    assert apply_action(BASE, "reduce_travel")["BusinessTravel"] == "Travel_Rarely"
    rarely = {**BASE, "BusinessTravel": "Travel_Rarely"}
    assert apply_action(rarely, "reduce_travel")["BusinessTravel"] == "Non-Travel"
    none = {**BASE, "BusinessTravel": "Non-Travel"}
    assert apply_action(none, "reduce_travel")["BusinessTravel"] == "Non-Travel"
    assert apply_action(BASE, "stay_interview") == BASE


def test_apply_action_does_not_mutate():
    before = dict(BASE)
    apply_action(BASE, "pay_review")
    assert BASE == before


def test_effective_features_precedence():
    out = effective_features({"A": 1, "B": 1, "C": 1}, {"B": 2, "C": 2}, {"C": 3})
    assert out == {"A": 1, "B": 2, "C": 3}
    assert effective_features({"A": 1}, {}, None) == {"A": 1}


def test_sharp_drop():
    assert sharp_drop({"WorkLifeBalance": 3}, {"WorkLifeBalance": 1}, 0.2, 0.25) == [
        "WorkLifeBalance"]
    assert sharp_drop(None, {"WorkLifeBalance": 1}, None, 0.9) == []
    assert sharp_drop({"WorkLifeBalance": 3}, {"WorkLifeBalance": 3}, 0.20, 0.31) == ["risk"]
    assert sharp_drop({"WorkLifeBalance": 3}, {"WorkLifeBalance": 2}, 0.20, 0.25) == []


def test_change_sentence():
    s = change_sentence({"WorkLifeBalance": 3}, {"WorkLifeBalance": 1}, 0.20, 0.38, "2026-Q3")
    assert s == ("Risk rose 18 pts since 2026-Q3, mostly because work-life balance dropped"
                 " from 3 to 1.")
    assert change_sentence({"WorkLifeBalance": 3}, {"WorkLifeBalance": 3}, 0.20, 0.205,
                           "2026-Q3") == "Risk is steady since 2026-Q3."
    s = change_sentence({"JobSatisfaction": 1}, {"JobSatisfaction": 3}, 0.40, 0.30, "2026-Q3")
    assert s == "Risk fell 10 pts since 2026-Q3, mostly because job satisfaction rose from 1 to 3."
