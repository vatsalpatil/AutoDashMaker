# Host your own AI model (Ollama on the Oracle VPS, via Dokploy)

Goal: every Dashtor user gets AI (dashboards, Ask, SQL help) from a model on YOUR server, no API keys, no daily limits.
Your VPS: Ubuntu 24.04 on ARM (aarch64), 24 GB RAM (about 16 GB free), 4 cores, no GPU. That means a **CPU model of 4B-9B parameters**.

## 1. The model: Qwen 3.5 9B, Q4_K_M
Decided: **`qwen3.5:9b-q4_K_M`** (6.6 GB download, ~7-8 GB in RAM with the context cache). Use this exact tag: the plain `qwen3.5:9b` tag does not say which
quantisation it is. Avoid the `-mlx`, `-mtp-` and `nvfp4` variants (different formats, larger). It leaves ~8 GB of the VPS free for Supabase, the backend and Dokploy.
Faster fallback if it ever feels too slow: `qwen3.5:4b`. Step 4 measures real speed and quality on your hardware.

## 2. Create the Ollama service in Dokploy
1. Same project as backend/frontend → **Create Service → Application** → Provider **Docker**, image `ollama/ollama:latest` (multi-arch, includes arm64).
2. **Environment**
   ```
   OLLAMA_HOST=0.0.0.0
   OLLAMA_KEEP_ALIVE=30m          # keep the model in RAM between requests (loading takes a minute)
   OLLAMA_NUM_PARALLEL=3          # decoding is memory-bound: 3 requests at once cost far less than 3x (the app plans pages in parallel)
   OLLAMA_MAX_LOADED_MODELS=1
   OLLAMA_FLASH_ATTENTION=1
   ```
3. **Volumes**: a persistent volume mounted at `/root/.ollama` (the downloaded models live here).
4. **Do NOT add a domain and do not publish port 11434.** Ollama has no authentication; it must only be reachable from other containers.
5. **Advanced → Resources**: memory limit ~12 GB, CPU limit 3, so Supabase, the backend and Dokploy itself always keep room. Deploy.
6. Note the service's internal name (Dokploy shows the app name, e.g. `autodashmaker-ollama-ab12cd`). That is the host in every URL below.

## 3. Pull the candidate models
In the Ollama service → **Terminal**: `ollama pull qwen3.5:9b-q4_K_M` (about 6.6 GB, a few minutes). Optional fallback: `ollama pull qwen3.5:4b`.
Watch memory in a host SSH session while a model is loaded: `free -h` (keep **swap usage at 0%**; swapping makes everything crawl).

## 4. Check it on your server (about 10-20 minutes per model)
The backend container has a benchmark that runs the app's real pipeline (understand, plan, build, insights) on a synthetic sales table:
```
python bench_models.py --url http://<ollama-service-name>:11434 --models qwen3.5:9b-q4_K_M --quick
```
(Dokploy → backend service → **Terminal**.) `--quick` stops after the plan. Then run it once without `--quick` (add `qwen3.5:4b` after a comma to compare). Run it when nobody is using the site.
It prints tokens/second, seconds per phase, how many planned queries were right on the first try, widgets built, repairs, and a score, and names a winner.
A full dashboard under ~10 minutes is fine for a data tool (the page shows live progress). If it is much slower, use the smaller model.

## 5. Make the winner the server's model (all users)
Backend service → **Environment**, then redeploy the backend:
```
OLLAMA_URL=http://<ollama-service-name>:11434/v1
OLLAMA_MODEL=qwen3.5:9b-q4_K_M
```
Every user without a personal provider now uses it (Settings → AI models lists it first as "Server model (self-hosted)").
Users can still add their own provider; custom provider addresses are restricted to public hosts on this multi-user server, plus any host in
`ALLOWED_AI_HOSTS` (comma separated) if you want to allow the Ollama service name for personal providers too.

## 6. If it is too slow or too heavy
- Smaller model (`qwen3.5:4b`, then set `OLLAMA_MODEL` to it) or fewer parallel requests (`OLLAMA_NUM_PARALLEL=2`, and `LOCAL_AI_PARALLEL=2` on the backend).
- Keep a cloud provider as your personal default for heavy requests (Settings → AI models) and let everyone else use the server model.
- The first request after a restart loads the model (about a minute); `OLLAMA_KEEP_ALIVE` prevents reloads while it is in use.
- Disk: models are a few GB each; you have ~145 GB free.

## How the app talks to it
Dashtor uses Ollama's native `/api/chat` with `think: false` (no hidden reasoning transcript, which costs minutes on a CPU), `format: "json"`
for dashboard planning (the server can only return valid JSON), a fixed `num_ctx` (8192) and `keep_alive`, and streams the answer into the
live progress view. Settings: `OLLAMA_NUM_CTX`, `OLLAMA_KEEP_ALIVE`, `LOCAL_AI_PARALLEL`, `LOCAL_AI_TIMEOUT_S`.
