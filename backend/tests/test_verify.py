"""Email + mobile verification: gating, codes, limits, existing users, grace period. Run: python tests/test_verify.py"""
import os
import shutil
import sys
import tempfile
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

TMP = tempfile.mkdtemp(prefix="adm_verify_")
os.environ.update(AUTH_ENABLED="true", SUPABASE_JWT_SECRET="s" * 40, METADATA_DB=f"{TMP}/metadata.duckdb",
                  ANALYTICS_DB=f"{TMP}/analytics.duckdb", UPLOAD_DIR=f"{TMP}/uploads", DUCKDB_TEMP_DIR=f"{TMP}/spill",
                  VERIFICATION_REQUIRED="true", VERIFICATION_GRACE_DAYS="0", VERIFICATION_DEV_ECHO="true")
os.makedirs(f"{TMP}/uploads", exist_ok=True)

import jwt  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402
from app.core.config import settings  # noqa: E402
from app.services import verification  # noqa: E402


def token(uid: str, google: bool = False) -> dict:
    claims = {"sub": uid, "email": f"{uid}@x.com", "aud": "authenticated", "exp": time.time() + 600}
    if google:
        claims["app_metadata"] = {"provider": "google"}
    return {"Authorization": "Bearer " + jwt.encode(claims, "s" * 40, algorithm="HS256")}


def expire_cooldown(uid: str, channel: str) -> None:
    """Pretend the last code was requested 2 minutes ago (tests must not sleep for the 60 s resend cooldown)."""
    from app.core.store import store
    store.execute("UPDATE verification_codes SET created_at = created_at - INTERVAL 2 MINUTE WHERE user_id = ? AND channel = ?", [uid, channel])


c = TestClient(main.app)
A, B = token("alice"), token("bob")

try:
    assert c.get("/api/verify/status").status_code == 401  # sign-in required

    # --- an existing user (no contact row yet) is unverified and, with grace 0, blocked from the app
    s = c.get("/api/verify/status", headers=A).json()
    assert s["email_verified"] is False and s["phone_verified"] is False and s["blocked"] is True, s
    blocked = c.get("/api/datasets", headers=A)
    assert blocked.status_code == 403 and blocked.json()["detail"]["code"] == "verification_required", blocked.text
    assert c.get("/api/auth/me", headers=A).status_code == 200      # login bootstrap and verification stay reachable
    assert c.get("/api/auth/config").status_code == 200

    # --- email: wrong code, then the right one
    r = c.post("/api/verify/send", headers=A, json={"channel": "email"})
    assert r.status_code == 200 and r.json()["delivery"] == "console" and len(r.json()["dev_code"]) == 6, r.text
    code = r.json()["dev_code"]
    assert c.post("/api/verify/send", headers=A, json={"channel": "email"}).status_code == 429          # resend cooldown
    bad = c.post("/api/verify/confirm", headers=A, json={"channel": "email", "code": "000000" if code != "000000" else "111111"})
    assert bad.status_code == 400 and "attempt" in bad.json()["detail"], bad.text
    ok = c.post("/api/verify/confirm", headers=A, json={"channel": "email", "code": code})
    assert ok.status_code == 200 and ok.json()["email_verified"] is True and ok.json()["blocked"] is True   # phone still missing
    assert c.post("/api/verify/confirm", headers=A, json={"channel": "email", "code": code}).status_code == 400  # a code works once

    # --- phone: format check, send, confirm
    assert c.post("/api/verify/send", headers=A, json={"channel": "phone", "phone": "98765"}).status_code == 400
    assert c.post("/api/verify/send", headers=A, json={"channel": "phone"}).status_code == 400
    p = c.post("/api/verify/send", headers=A, json={"channel": "phone", "phone": "+91 98765 43210"})
    assert p.status_code == 200 and p.json()["to"].startswith("+91") and "98765" not in p.json()["to"], p.text
    done = c.post("/api/verify/confirm", headers=A, json={"channel": "phone", "code": p.json()["dev_code"]})
    assert done.json()["complete"] is True and done.json()["blocked"] is False, done.text
    assert c.get("/api/datasets", headers=A).status_code == 200                                          # unblocked

    # --- one verified number per account
    c.post("/api/verify/send", headers=B, json={"channel": "email"})
    dup = c.post("/api/verify/send", headers=B, json={"channel": "phone", "phone": "+919876543210"})
    assert dup.status_code == 409, dup.text

    # --- five wrong tries burn the code
    r = c.post("/api/verify/send", headers=B, json={"channel": "phone", "phone": "+14155550123"})
    good = r.json()["dev_code"]
    wrong = "000000" if good != "000000" else "111111"
    for _ in range(5):
        assert c.post("/api/verify/confirm", headers=B, json={"channel": "phone", "code": wrong}).status_code == 400
    locked = c.post("/api/verify/confirm", headers=B, json={"channel": "phone", "code": good})
    assert locked.status_code == 429, locked.text
    expire_cooldown("bob", "phone")
    again = c.post("/api/verify/send", headers=B, json={"channel": "phone", "phone": "+14155550123"})
    assert again.status_code == 200
    assert c.post("/api/verify/confirm", headers=B, json={"channel": "phone", "code": again.json()["dev_code"]}).status_code == 200

    # --- hourly cap
    for _ in range(4):
        expire_cooldown("bob", "email")
        c.post("/api/verify/send", headers=B, json={"channel": "email"})
    expire_cooldown("bob", "email")
    assert c.post("/api/verify/send", headers=B, json={"channel": "email"}).status_code == 429

    # --- Google sign-in already proved the email: only the phone is missing
    g = c.get("/api/verify/status", headers=token("gina", google=True)).json()
    assert g["email_verified"] is True and g["missing"] == ["phone"], g

    # --- grace period: a user first seen now is not blocked yet
    settings.verification_grace_days = 7
    cz = c.get("/api/verify/status", headers=token("carol")).json()
    assert cz["blocked"] is False and cz["missing"] == ["email", "phone"], cz
    assert c.get("/api/datasets", headers=token("carol")).status_code == 200

    # --- enforcement off: nobody is blocked, whatever their state
    settings.verification_grace_days, settings.verification_required = 0, False
    assert c.get("/api/datasets", headers=token("dave")).status_code == 200

    # --- codes are stored hashed, never in clear
    from app.core.store import store
    leaked = store.execute("SELECT code_hash FROM verification_codes")
    assert leaked and all(len(r["code_hash"]) == 64 for r in leaked)
    assert verification.mask("email", "alice@x.com") == "a****@x.com" and verification.mask("phone", "+919876543210").endswith("210")
    print("verification tests passed")
finally:
    shutil.rmtree(TMP, ignore_errors=True)
