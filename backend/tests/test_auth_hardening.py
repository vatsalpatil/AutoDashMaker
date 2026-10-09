"""Lockout (20 wrong tries / 10 min -> 10 min block), login proxy, and changing a verified email / mobile number.
Run: backend/.venv/Scripts/python.exe tests/test_auth_hardening.py"""
import os
import sys
import tempfile
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

TMP = tempfile.mkdtemp(prefix="adm_hard_")
os.environ.update(AUTH_ENABLED="true", SUPABASE_JWT_SECRET="s" * 40, SUPABASE_URL="http://auth.invalid", SUPABASE_ANON_KEY="anon",
                  METADATA_DB=f"{TMP}/metadata.duckdb", ANALYTICS_DB=f"{TMP}/analytics.duckdb", UPLOAD_DIR=f"{TMP}/uploads",
                  DUCKDB_TEMP_DIR=f"{TMP}/spill", VERIFICATION_REQUIRED="true", VERIFICATION_GRACE_DAYS="0",
                  VERIFICATION_DEV_ECHO="true", DISK_USAGE_LIMIT_PCT="0")
os.makedirs(f"{TMP}/uploads", exist_ok=True)

import httpx  # noqa: E402
import jwt  # noqa: E402
from fastapi import HTTPException  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402
from app.core.config import settings  # noqa: E402
from app.core.store import store  # noqa: E402
from app.services import gotrue, throttle  # noqa: E402

settings.supabase_service_key = ""  # a developer's real backend/.env must not leak into the test
now = [1000.0]
throttle.clock = lambda: now[0]


def token(uid: str, email: str | None = None, google: bool = True) -> dict:
    claims = {"sub": uid, "email": email or f"{uid}@x.com", "aud": "authenticated", "exp": time.time() + 600}
    if google:
        claims["app_metadata"] = {"provider": "google"}  # email already proven; the mobile number is still needed
    return {"Authorization": "Bearer " + jwt.encode(claims, "s" * 40, algorithm="HS256")}


def expire_cooldown(uid: str) -> None:
    store.execute("UPDATE verification_codes SET created_at = created_at - INTERVAL 2 MINUTE WHERE user_id = ?", [uid])


c = TestClient(main.app)

# --- 1. the lockout rule itself: 19 misses are fine, the 20th blocks for 10 minutes, then it clears
for _ in range(19):
    throttle.fail("k")
throttle.check("k")
throttle.fail("k")
try:
    throttle.check("k")
    raise AssertionError("20th miss should block")
except HTTPException as e:
    assert e.status_code == 429 and "10 minute" in e.detail, e.detail
now[0] += 599
try:
    throttle.check("k")
    raise AssertionError("still blocked at 599 s")
except HTTPException:
    pass
now[0] += 2
throttle.check("k")  # block over

# misses older than the window don't add up
for _ in range(15):
    throttle.fail("slow")
now[0] += 601
for _ in range(15):
    throttle.fail("slow")
throttle.check("slow")

# --- 2. login proxy: wrong password x20 -> 429 "try again in 10 minutes", other addresses still work after the window
calls = {"n": 0}


def fake_login(email, password):
    calls["n"] += 1
    if password == "right":
        return httpx.Response(200, json={"access_token": "a", "refresh_token": "r"})
    return httpx.Response(400, json={"error_code": "invalid_credentials", "msg": "Invalid login credentials"})


gotrue.password_login = fake_login
for i in range(19):
    r = c.post("/api/auth/login", json={"email": "Eve@x.com", "password": "bad"})
    assert r.status_code == 401, (i, r.status_code, r.text)
r = c.post("/api/auth/login", json={"email": "eve@x.com", "password": "bad"})   # 20th (case-insensitive email)
assert r.status_code == 429 and "10 minute" in r.json()["detail"], r.text
n = calls["n"]
assert c.post("/api/auth/login", json={"email": "eve@x.com", "password": "right"}).status_code == 429  # even the right one waits
assert calls["n"] == n, "blocked tries must not reach the auth service"
now[0] += 601
ok = c.post("/api/auth/login", json={"email": "eve@x.com", "password": "right"})
assert ok.status_code == 200 and ok.json()["access_token"] == "a"

# --- 3. wrong verification codes also count (per account, across fresh codes)
X = token("mallory")
for round_ in range(4):
    if round_:
        expire_cooldown("mallory")
    assert c.post("/api/verify/send", json={"channel": "phone", "phone": "+919000000001"}, headers=X).status_code == 200
    for _ in range(5):
        r = c.post("/api/verify/confirm", json={"channel": "phone", "code": "000000"}, headers=X)
        assert r.status_code in (400, 429), r.text
r = c.post("/api/verify/confirm", json={"channel": "phone", "code": "000000"}, headers=X)
assert r.status_code == 429 and "10 minute" in r.json()["detail"], r.text

# --- 4. numbers are unique; a verified number can't be re-sent through the plain flow
A, B = token("alice"), token("bob")


def verify_phone(h, uid, number):
    s = c.post("/api/verify/send", json={"channel": "phone", "phone": number}, headers=h)
    assert s.status_code == 200, s.text
    r = c.post("/api/verify/confirm", json={"channel": "phone", "code": s.json()["dev_code"]}, headers=h)
    assert r.status_code == 200 and r.json()["complete"], r.text


verify_phone(A, "alice", "+919800000001")
assert c.post("/api/verify/send", json={"channel": "phone", "phone": "+919800000001"}, headers=B).status_code == 409
assert c.post("/api/verify/send", json={"channel": "phone", "phone": "+919800000002"}, headers=A).status_code == 409  # use "change"

# --- 5. change mobile number: needs the new number's code AND a code to the verified email
r = c.post("/api/verify/change/start", json={"channel": "phone", "new_value": "+919800000001"}, headers=A)
assert r.status_code == 400  # same number
verify_phone(B, "bob", "+919800000003")
r = c.post("/api/verify/change/start", json={"channel": "phone", "new_value": "+919800000003"}, headers=A)
assert r.status_code == 409, r.text  # taken by bob
expire_cooldown("alice")
st = c.post("/api/verify/change/start", json={"channel": "phone", "new_value": "+91 98000 00004"}, headers=A)
assert st.status_code == 200, st.text
new_code, proof_code = st.json()["new"]["dev_code"], st.json()["proof"]["dev_code"]
bad = c.post("/api/verify/change/confirm", json={"channel": "phone", "proof_code": proof_code, "new_code": "000000"}, headers=A)
assert bad.status_code == 400
done = c.post("/api/verify/change/confirm", json={"channel": "phone", "proof_code": proof_code, "new_code": new_code}, headers=A)
assert done.status_code == 200 and done.json()["phone_verified"], done.text
assert store.execute("SELECT phone FROM user_contacts WHERE user_id = 'alice'")[0]["phone"] == "+919800000004"
verify_phone(token("carol"), "carol", "+919800000001")  # alice's old number is free again

# --- 6. change email: off without the service key; with it, codes to the new email + the verified mobile; old tokens keep working
r = c.post("/api/verify/change/start", json={"channel": "email", "new_value": "alice2@x.com"}, headers=A)
assert r.status_code == 501, r.text
settings.supabase_service_key = "service-key"
changed = []
gotrue.set_email = lambda uid, email: changed.append((uid, email))
expire_cooldown("alice")
r = c.post("/api/verify/change/start", json={"channel": "email", "new_value": "bob@x.com"}, headers=A)
assert r.status_code == 409, r.text  # another account's email
expire_cooldown("alice")
st = c.post("/api/verify/change/start", json={"channel": "email", "new_value": "Alice2@X.com"}, headers=A)
assert st.status_code == 200, st.text
done = c.post("/api/verify/change/confirm", json={"channel": "email", "proof_code": st.json()["proof"]["dev_code"],
                                                   "new_code": st.json()["new"]["dev_code"]}, headers=A)
assert done.status_code == 200 and done.json()["email_verified"], done.text
assert changed == [("alice", "alice2@x.com")], changed
s = c.get("/api/verify/status", headers=A).json()  # the old token still says alice@x.com: must stay verified
assert s["complete"] and not s["blocked"], s
s = c.get("/api/verify/status", headers=token("alice", "alice2@x.com")).json()  # a refreshed token carries the new address
assert s["complete"] and s["email"] == "alice2@x.com", s

# --- 7. mobile verification switched off: only email counts, and an email change is proven with a code to the CURRENT email
settings.verification_phone = False
D = token("dave")
s = c.get("/api/verify/status", headers=D).json()
assert s["complete"] and s["missing"] == [] and not s["channels"]["phone"], s
assert c.post("/api/verify/send", json={"channel": "phone", "phone": "+919700000001"}, headers=D).status_code == 400
assert c.post("/api/verify/change/start", json={"channel": "phone", "new_value": "+919700000001"}, headers=D).status_code == 400
st = c.post("/api/verify/change/start", json={"channel": "email", "new_value": "dave2@x.com"}, headers=D)
assert st.status_code == 200, st.text
done = c.post("/api/verify/change/confirm", json={"channel": "email", "proof_code": st.json()["proof"]["dev_code"],
                                                   "new_code": st.json()["new"]["dev_code"]}, headers=D)
assert done.status_code == 200 and done.json()["email_verified"], done.text
assert ("dave", "dave2@x.com") in changed
settings.verification_phone = True

# --- 8. delete my account: needs the emailed code AND the typed email; removes the sign-in account, rows, files, folders
import glob  # noqa: E402

settings.verification_phone = False  # like production for now: a verified email is enough to use the app
E, F = token("erin"), token("frank")
up = c.post("/api/datasets/upload", files={"file": ("sales.csv", b"a,b\n1,2\n3,4\n", "text/csv")}, headers=E)
assert up.status_code == 200, up.text
c.post("/api/charts", json={"name": "mine", "spec": {}}, headers=E)
c.post("/api/datasets/upload", files={"file": ("other.csv", b"x\n1\n", "text/csv")}, headers=F)  # a bystander whose data must survive
deleted_users = []
gotrue.delete_user = lambda uid: deleted_users.append(uid)

settings.supabase_service_key = ""
assert c.post("/api/account/delete/start", headers=E).status_code == 501      # not configured: refuses before anything happens
settings.supabase_service_key = "service-key"
expire_cooldown("erin")
st = c.post("/api/account/delete/start", headers=E)
assert st.status_code == 200 and st.json()["dev_code"], st.text
code = st.json()["dev_code"]
assert c.post("/api/account/delete/confirm", json={"code": code, "email": "wrong@x.com"}, headers=E).status_code == 400
assert c.post("/api/account/delete/confirm", json={"code": "000000", "email": "erin@x.com"}, headers=E).status_code == 400
assert deleted_users == [], "nothing may be deleted before both proofs pass"
assert c.post("/api/account/delete/confirm", json={"code": code, "email": "ERIN@x.com"}, headers=E).status_code == 200
assert deleted_users == ["erin"]
from app.core import tenant  # noqa: E402
with tenant.all_workspaces():
    assert not store.list("datasets", where="workspace_id = ?", params=["ws_erin"], order=None)
    assert not store.list("charts", where="workspace_id = ?", params=["ws_erin"], order=None)
    assert store.list("datasets", where="workspace_id = ?", params=["ws_frank"], order=None), "other users keep their data"
assert not store.execute("SELECT 1 FROM user_contacts WHERE user_id = 'erin'")
assert not os.path.exists(f"{TMP}/ws/ws_erin") and not os.path.exists(f"{TMP}/uploads/ws/ws_erin")
assert glob.glob(f"{TMP}/ws/ws_frank/parquet/*.parquet"), "other users keep their files"

# --- 9. confirmation-link sign-up: Supabase only issues a session after the link was clicked, so a signed-in user counts as email-verified
settings.verification_phone = False
G = token("gina", google=False)  # a password user: no provider proof, no email_verified claim in the token
assert not c.get("/api/verify/status", headers=G).json()["email_verified"]
settings.auth_confirms_email = True
gotrue.autoconfirm_on = lambda: True    # Supabase still signs people in without a link: AUTH_CONFIRMS_EMAIL must NOT be trusted
assert not c.get("/api/verify/status", headers=token("iris", google=False)).json()["email_verified"]
gotrue.autoconfirm_on = lambda: True    # ...and the token's own email_verified claim is worthless too: autoconfirm sets it for everyone
claimed = jwt.encode({"sub": "jo", "email": "jo@x.com", "aud": "authenticated", "exp": time.time() + 600,
                      "user_metadata": {"email_verified": True}}, "s" * 40, algorithm="HS256")
assert not c.get("/api/verify/status", headers={"Authorization": "Bearer " + claimed}).json()["email_verified"]
gotrue.autoconfirm_on = lambda: False   # Supabase really requires the link: a signed-in password user has proven the email
s = c.get("/api/verify/status", headers=token("hank", google=False)).json()
assert s["email_verified"] and s["complete"] and not s["blocked"], s
settings.auth_confirms_email = False


def not_confirmed(email, password):
    return httpx.Response(400, json={"error_code": "email_not_confirmed", "msg": "Email not confirmed"})


gotrue.password_login = not_confirmed
now[0] += 5000  # clear any lockout state from the earlier sections
r = c.post("/api/auth/login", json={"email": "newbie@x.com", "password": "whatever1"})
assert r.status_code == 403 and "confirm your email" in r.json()["detail"], r.text
for _ in range(25):  # an unconfirmed email is not a wrong password: it must never lock anyone out
    assert c.post("/api/auth/login", json={"email": "newbie@x.com", "password": "whatever1"}).status_code == 403

# --- 10. forgot password: branded code email -> code + new password; never reveals who has an account
import re  # noqa: E402
from app.services import delivery  # noqa: E402

mails, passwords = [], []
delivery.send_email = lambda to, subject, body, html=None: (mails.append((to, subject, body, html)), "smtp")[1]
gotrue.set_password = lambda uid, pw: passwords.append((uid, pw))
gotrue.find_user_id = lambda email: None   # the admin list is only the fallback; known users come from user_contacts
now[0] += 5000
known = c.post("/api/auth/password/forgot", json={"email": "Gina@X.com"})
unknown = c.post("/api/auth/password/forgot", json={"email": "nobody@x.com"})
assert known.status_code == unknown.status_code == 200 and known.json() == unknown.json() == {"sent": True}
assert len(mails) == 1 and mails[0][0] == "gina@x.com", mails                      # only the real account got an email
assert "password" in mails[0][1].lower() and mails[0][3].startswith("<!doctype html>"), mails[0][1]
code = re.search(r"Your code: (\d{6})", mails[0][2]).group(1)

assert c.post("/api/auth/password/reset", json={"email": "gina@x.com", "code": "000000", "password": "newpassword1"}).status_code == 400
assert c.post("/api/auth/password/reset", json={"email": "gina@x.com", "code": code, "password": "short"}).status_code == 400
assert c.post("/api/auth/password/reset", json={"email": "nobody@x.com", "code": code, "password": "newpassword1"}).status_code == 400
assert passwords == [], "nothing may change before the code and a valid password are both right"
ok = c.post("/api/auth/password/reset", json={"email": "gina@x.com", "code": code, "password": "newpassword1"})
assert ok.status_code == 200 and passwords == [("gina", "newpassword1")], (ok.text, passwords)
assert c.post("/api/auth/password/reset", json={"email": "gina@x.com", "code": code, "password": "another-pass1"}).status_code == 400  # a code works once

# a flood of reset requests is throttled like password guessing (20 in 10 minutes)
r = None
for _ in range(25):
    r = c.post("/api/auth/password/forgot", json={"email": "flood@x.com"})
assert r.status_code == 429 and "10 minute" in r.json()["detail"], r.text

# --- 11. a failed sign-in says what is actually wrong
gotrue.password_login = fake_login          # always 'invalid_credentials' unless the password is "right"
accounts = {"has@x.com": {"id": "u1", "app_metadata": {"providers": ["email"]}},
            "g@x.com": {"id": "u2", "app_metadata": {"providers": ["google"]}}}
gotrue.find_user = lambda email: accounts.get(email)
now[0] += 5000


def why(email):
    r = c.post("/api/auth/login", json={"email": email, "password": "bad"})
    assert r.status_code == 401, r.text
    return r.json()["detail"]


assert why("nobody@x.com") == "No account found for this email. Create an account first."
assert "Google" in why("g@x.com")
assert why("has@x.com") == "Wrong email or password."
settings.supabase_service_key = ""                                       # without the admin key it can only say "wrong"
assert why("nobody@x.com") == "Wrong email or password."
settings.supabase_service_key = "service-key"

print("auth hardening tests OK")
