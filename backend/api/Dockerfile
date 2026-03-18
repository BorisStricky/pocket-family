FROM python:3.11-slim

WORKDIR /app

# Build context is ./backend (set in docker-compose.yaml).
# requirements.txt lives at backend/requirements.txt — the context root.
COPY requirements.txt ./
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copy the contents of backend/api/ directly into /app/.
# COPY api/ . copies the directory's *contents* (not the directory itself),
# so the app package lands at /app/app/main.py where uvicorn expects it.
COPY api/ .

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
