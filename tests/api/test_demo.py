from datetime import UTC, date, datetime, timedelta

from sqlalchemy import func, select

from api import demo
from api.auth import verify_password
from api.db import SessionLocal
from api.models import ActionPlan, CheckIn, DemoState, Employee, User
from api.quarters import history, quarter_of
from api.scoring import CHECKIN_FIELDS, sharp_drop
from api.service import get_service
from api.settings import get_settings

COLUMNS = list(CHECKIN_FIELDS.values())


def _persona(s, story):
    p = next(p for p in demo.personas(s) if p["story"] == story)
    return s.get(Employee, p["employee_id"]) if p["employee_id"] else None


def _checkins(s, eid):
    return s.scalars(select(CheckIn).where(CheckIn.employee_id == eid)
                     .order_by(CheckIn.quarter)).all()


def test_seed_history_shape(seeded):
    quarters = history(quarter_of(date.today()))
    with SessionLocal() as s:
        assert sorted(s.scalars(select(CheckIn.quarter).distinct()).all()) == quarters
        former = s.scalars(select(Employee.employee_id).where(~Employee.is_current)).all()
        assert s.scalar(select(func.count()).select_from(CheckIn)
                        .where(CheckIn.employee_id.in_(former))) == 0
        staff = s.scalar(select(func.count()).select_from(Employee).where(Employee.is_current))
        for q in quarters[:3]:
            assert s.scalar(select(func.count()).select_from(CheckIn)
                            .where(CheckIn.quarter == q)) == staff
        answered = s.scalar(select(func.count()).select_from(CheckIn)
                            .where(CheckIn.quarter == quarters[3]))
        assert 0.6 <= answered / staff <= 0.7
        people = s.scalars(select(Employee).where(Employee.is_current)
                           .order_by(Employee.employee_id).limit(5)).all()
        for e in people:
            last = next(c for c in _checkins(s, e.employee_id) if c.quarter == quarters[2])
            assert last.answers == {c: e.features[c] for c in COLUMNS}
            assert e.name and " " in e.name


def test_personas_tell_their_story(seeded):
    settings = get_settings()
    svc = get_service()
    current = quarter_of(date.today())
    with SessionLocal() as s:
        users = s.scalars(select(User)).all()
        assert len([u for u in users if u.email.endswith("@retain.demo")]) == 5
        for u in users:
            if u.email.endswith("@retain.demo"):
                assert verify_password(u.password_hash, settings.demo_password)

        e = _persona(s, "sharp_drop")
        rows = _checkins(s, e.employee_id)
        prev, last = rows[-2], rows[-1]
        assert last.quarter == current
        assert [f for f in sharp_drop(prev.answers, last.answers, prev.risk_score,
                                      last.risk_score) if f != "risk"]
        assert e.risk_band == "high" and e.risk_score >= svc.threshold

        e = _persona(s, "not_answered")
        assert all(c.quarter != current for c in _checkins(s, e.employee_id))

        e = _persona(s, "stable")
        rows = _checkins(s, e.employee_id)
        assert rows[-1].quarter == current and rows[-1].answers == rows[-2].answers
        assert e.risk_band == "low"

        e = _persona(s, "plan_worked")
        plan = s.scalars(select(ActionPlan).where(ActionPlan.employee_id == e.employee_id,
                                                  ActionPlan.action == "pay_review",
                                                  ActionPlan.status == "done")).first()
        assert plan is not None
        after = next(c for c in _checkins(s, e.employee_id) if c.quarter == current)
        assert after.risk_score <= plan.score_at_creation - 0.05


def test_seed_deterministic(seeded):
    with SessionLocal() as s:
        before = [(p["story"], p["employee_id"]) for p in demo.personas(s)]
        scores = dict(s.execute(select(Employee.employee_id, Employee.risk_score)
                                .where(Employee.is_current).order_by(Employee.employee_id)
                                .limit(10)).all())
        demo.reset(s, date.today(), full=True)
        assert [(p["story"], p["employee_id"]) for p in demo.personas(s)] == before
        again = dict(s.execute(select(Employee.employee_id, Employee.risk_score)
                               .where(Employee.employee_id.in_(scores))).all())
        assert all(abs(scores[k] - again[k]) < 1e-12 for k in scores)


def _stamp(s, hours_ago):
    state = s.get(DemoState, "seed")
    state.value = {**state.value,
                   "last_reset": (datetime.now(UTC) - timedelta(hours=hours_ago)).isoformat()}
    s.commit()


def test_reset_removes_visitor_rows_and_restores_seeded(seeded):
    with SessionLocal() as s:
        e = _persona(s, "not_answered")
        s.add(CheckIn(employee_id=e.employee_id, quarter=quarter_of(date.today()),
                      answers={c: e.features[c] for c in COLUMNS}, keep_me=["pay"], comment="x",
                      risk_score=0.5, seeded=False))
        s.add(ActionPlan(employee_id=e.employee_id, action="stay_interview", note="",
                         created_quarter=quarter_of(date.today()), score_at_creation=0.5,
                         estimated_score=0.5, status="open", seeded=False))
        seeded_open = s.scalars(select(ActionPlan).where(ActionPlan.seeded,
                                                         ActionPlan.status == "open")).first()
        record_before = dict(s.get(Employee, seeded_open.employee_id).record)
        seeded_open.status = "done"
        s.get(Employee, seeded_open.employee_id).record = {"MonthlyIncome": 1}
        s.commit()
        _stamp(s, 25)

        assert demo.maybe_reset(s, datetime.now(UTC)) is True
        assert s.scalar(select(func.count()).select_from(CheckIn).where(~CheckIn.seeded)) == 0
        assert s.scalar(select(func.count()).select_from(ActionPlan)
                        .where(~ActionPlan.seeded)) == 0
        s.refresh(seeded_open)
        assert seeded_open.status == "open"
        assert s.get(Employee, seeded_open.employee_id).record == record_before


def test_maybe_reset_noop_within_24h(seeded):
    with SessionLocal() as s:
        _stamp(s, 1)
        assert demo.maybe_reset(s, datetime.now(UTC)) is False


def test_reset_regenerates_on_new_quarter(seeded):
    later = datetime.now(UTC) + timedelta(days=100)
    with SessionLocal() as s:
        assert demo.maybe_reset(s, later) is True
        quarters = sorted(s.scalars(select(CheckIn.quarter).distinct()).all())
        assert quarters == history(quarter_of(later.date()))
        assert len(demo.personas(s)) == 5
        demo.reset(s, date.today(), full=True)  # put the shared test DB back on today
