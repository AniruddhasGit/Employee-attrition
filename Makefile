PY ?= .venv/Scripts/python
ifeq ($(OS),)
PY = .venv/bin/python
endif

setup:
	uv venv .venv --python 3.12
	uv pip install --python $(PY) -r requirements.txt -r requirements-dev.txt

train:
	$(PY) -m ml.train

test:
	$(PY) -m pytest

lint:
	$(PY) -m ruff check .

notebook:
	$(PY) -m jupyter nbconvert --to notebook --execute notebooks/attrition.ipynb --inplace

ALEMBIC = $(PY) -m alembic -c api/alembic.ini

db-up:
	docker compose up -d db

migrate:
	$(ALEMBIC) upgrade head

seed:
	$(PY) -m api.seed

api:
	$(PY) -m uvicorn api.main:app --reload --port 8010

.PHONY: setup train test lint notebook db-up migrate seed api
