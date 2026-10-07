# Deploy on Oracle with Dokploy (Nixpacks)

Two services in one Dokploy project (`AutoDashMaker` / `production`), both from this repo/branch.

## 1. backend
- Create Service → Application → Git → Build Type **Nixpacks**, Base Directory `/backend`.
- Environment: copy `backend/.env.example` (set the Supabase values).
- **Volumes (required, or data is lost on redeploy):** mount a persistent volume at `/app/data` (DuckDB files) and `/app/uploads`.
- No public domain needed; note its internal name (Dokploy shows the app name, e.g. `autodashmaker-backend`).

## 2. frontend
- Build Type **Nixpacks**, Base Directory `/frontend`.
- Environment: `BACKEND_URL=http://<backend-app-name>:8000` and `PORT=3000`.
- Domain: your app domain → container port 3000, HTTPS via Let's Encrypt.

## 3. Supabase (self-hosted)
Deploy the Supabase template in a separate Dokploy project. In its auth settings set Site URL and
redirect URLs to the frontend domain. Put its public URL + anon key into the backend env above.

## Notes
- `AUTH_ENABLED=false` (default) = no login; never expose that publicly.
- Single backend instance only: DuckDB allows one writer process.

## Multi-user safety (AUTH_ENABLED=true)
- Every user gets their own workspace: separate DuckDB file under `/app/data/ws/` and uploads under `/app/uploads/ws/` (both on your volumes).
- File/SQLite sources can only read the user's own uploads; connections to private/internal addresses are refused; SQL cannot read files.
- Python transforms are off (`ALLOW_USER_PYTHON=false`). Turn on only for people you fully trust.
- Back up both volumes (`adm-data`, `adm-uploads`): they hold every user's data.
