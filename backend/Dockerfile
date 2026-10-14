# Dokploy service "backend": Build Type = Dockerfile, Base Directory = /backend, Dockerfile = Dockerfile
# Official python image (Docker Hub), no nixpkgs download. Data stays in /app/data and /app/uploads (mount volumes there).
FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_DISABLE_PIP_VERSION_CHECK=1
COPY requirements.txt .
RUN pip install --no-cache-dir --prefer-binary -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["sh", "-c", "uvicorn Main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]
