"""HR area: questions added to the quarterly check-in, and recomputing the scores with them."""

from datetime import date

from fastapi import APIRouter, HTTPException
from pydantic import Field

from api import questions, ratelimit
from api.auth import HrUser
from api.db import SessionDep
from api.schemas import CamelModel

router = APIRouter(prefix="/api/hr/questions")

WRITES_PER_HOUR = 60


class QuestionIn(CamelModel):
    label: str = Field(min_length=5, max_length=160)
    options: list[str] = Field(min_length=2, max_length=6)


class QuestionsIn(CamelModel):
    questions: list[QuestionIn] = Field(min_length=1, max_length=10)


def _limit(user, what: str) -> None:
    if not ratelimit.allow(f"questions:{user.id}", WRITES_PER_HOUR, 3600):
        raise HTTPException(429, f"That's a lot of {what} this hour. Come back later.")


@router.get("")
def list_questions(user: HrUser, db: SessionDep) -> dict:
    return questions.status(db)


@router.post("", status_code=201)
def add_questions(body: QuestionsIn, user: HrUser, db: SessionDep) -> dict:
    _limit(user, "question changes")
    items = []
    for q in body.questions:
        options = [o.strip() for o in q.options]
        if not q.label.strip() or any(not o or len(o) > 60 for o in options):
            raise HTTPException(422, "Each question needs text, each option 1-60 characters.")
        items.append({"label": q.label, "options": options})
    questions.add(db, items, user.id, date.today())
    return questions.status(db)


@router.delete("/{question_id}")
def remove_question(question_id: int, user: HrUser, db: SessionDep) -> dict:
    _limit(user, "question changes")
    questions.remove(db, question_id)
    return questions.status(db)


@router.post("/recompute")
def recompute(user: HrUser, db: SessionDep) -> dict:
    _limit(user, "recomputes")
    result = questions.recompute(db)
    return {**questions.status(db), "result": result}


@router.post("/sample-answers")
def sample_answers(user: HrUser, db: SessionDep) -> dict:
    """Fill in sample answers so a showcase can reach the 75% needed to recompute."""
    _limit(user, "sample answers")
    filled = questions.simulate(db, date.today())
    return {**questions.status(db), "filled": filled}
