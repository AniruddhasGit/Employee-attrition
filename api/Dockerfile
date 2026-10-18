# Build context: repository root.
FROM python:3.12-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY ml ./ml
COPY data ./data
# Train inside the image so the model ships with it (about a minute, deterministic).
RUN python -m ml.train

COPY api ./api
RUN useradd --create-home retain && chown -R retain /app
USER retain
EXPOSE 8010
CMD ["sh", "-c", "python -m alembic -c api/alembic.ini upgrade head && python -m api.seed && uvicorn api.main:app --host 0.0.0.0 --port 8010"]
