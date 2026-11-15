FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    EAF_WARM=0 \
    OFFLINE=0

WORKDIR /app
COPY requirements-runtime.txt ./
RUN python -m pip install --no-cache-dir --only-binary=:all: -r requirements-runtime.txt

COPY src ./src
COPY data ./data
COPY web ./web
COPY cache/predictors.zarr ./cache/predictors.zarr

RUN mkdir -p /app/cache/raw && chown -R 10001:10001 /app/cache
USER 10001:10001
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
