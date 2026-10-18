from datetime import date

from api.quarters import history, previous, quarter_of


def test_quarter_of():
    assert quarter_of(date(2026, 10, 18)) == "2026-Q4"
    assert quarter_of(date(2026, 1, 1)) == "2026-Q1"
    assert quarter_of(date(2026, 6, 30)) == "2026-Q2"


def test_previous_wraps_year():
    assert previous("2026-Q1") == "2025-Q4"
    assert previous("2026-Q3") == "2026-Q2"


def test_history_three_closed_plus_current():
    assert history("2026-Q4") == ["2026-Q1", "2026-Q2", "2026-Q3", "2026-Q4"]
    assert history("2027-Q1") == ["2026-Q2", "2026-Q3", "2026-Q4", "2027-Q1"]
