"""Demo data: 10 realistic multi-file projects, messy on purpose (blanks, duplicates, quotes and commas in text, unicode,
mixed date formats, negative stock, -999 sensor placeholders, case variants, one JSON file), seeded so every run is the same.

    backend/.venv/Scripts/python.exe Scripts/seed_demo.py                  write CSV/JSON files to demo-data/<project>/
    backend/.venv/Scripts/python.exe Scripts/seed_demo.py --load           ...and import them into the LOCAL workspace
    backend/.venv/Scripts/python.exe Scripts/seed_demo.py --only HR,IoT    just some projects
    backend/.venv/Scripts/python.exe Scripts/seed_demo.py --scale 0.1      10% of the rows (fast)

Used for manual testing and demos; the same shapes found real bugs (see AI-Memory/sessions/2026-11-24-ten-project-campaign.md).
"""
from __future__ import annotations

import argparse
import csv
import json
import random
import sys
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "demo-data"
REGIONS = ["North", "South", "East", "West"]
CITIES = ["Mumbai", "Delhi", "Pune", "Bengaluru", "Chennai", "Kolkata", "Jaipur", "Ahmedabad", "Lucknow", "Kochi"]
NAMES = ["Aarav", "Diya", "Kabir", "Meera", "Rohan", "Ishita", "Arjun", "Saanvi", "José", "Zoë", "O'Brien", "Smith, Jr."]


def projects(r: random.Random, k: float) -> dict[str, dict[str, list[dict]]]:
    n = lambda x: max(5, int(x * k))  # noqa: E731
    d = lambda y, span: (date(y, 1, 1) + timedelta(days=r.randint(0, span))).isoformat()  # noqa: E731
    P = lambda a: r.choice(a)  # noqa: E731
    pad = lambda p, i, w=5: f"{p}{i:0{w}d}"  # noqa: E731
    return {
        "HR": {
            "hr_departments": [{"dept_id": pad("D", i, 3), "dept_name": x, "region": P(REGIONS)} for i, x in enumerate(
                ["Sales", "Engineering", "Finance", "HR", "Ops", "Legal", "Support", "Marketing", "IT", "R&D", "Admin", "Procurement"])],
            "hr_employees": [{"emp_id": pad("E", i), "name": f"{P(NAMES)} {i}", "dept_id": pad("D", r.randint(0, 11), 3), "hire_date": d(2015, 3500),
                              "city": None if r.random() < 0.03 else P(CITIES), "manager_id": pad("E", r.randint(0, 20)) if i > 20 else None} for i in range(n(1500))],
            "hr_attendance": [{"emp_id": pad("E", r.randint(0, n(1500) - 1)), "date": d(2025, 300), "hours": round(r.random() * 10, 1),
                               "status": P(["Present", "Present", "Present", "Leave", "WFH", "absent"])} for _ in range(n(60000))],
        },
        "Finance": {
            "fin_accounts": [{"account_id": f"A{i}", "type": P(["Asset", "Liability", "Revenue", "Expense"]), "cost_center": P(["CC1", "CC2", "CC3"])} for i in range(200)],
            "fin_transactions": [{"txn_id": f"T{i}", "account_id": f"A{r.randint(0, 199)}", "txn_date": d(2024, 700),
                                  "amount": round((r.random() - 0.4) * 100000, 2), "memo": "refund, partial" if r.random() < 0.1 else "regular"} for i in range(n(90000))],
            "fin_budgets": [{"account_id": f"A{i % 200}", "month": f"2025-{i // 200 + 1:02d}-01", "budget": r.randint(10000, 900000)} for i in range(2400)],
        },
        "Healthcare": {
            "hc_patients": [{"patient_id": f"PT{i}", "birth_year": r.randint(1940, 2020), "sex": P("MF"), "city": P(CITIES),
                             "insurance": None if r.random() < 0.05 else P(["Gov", "Private", "None"])} for i in range(n(5000))],
            "hc_doctors": [{"doctor_id": f"DR{i}", "specialty": P(["Cardio", "Ortho", "General", "Pediatrics", "Neuro"]), "years_exp": r.randint(1, 35)} for i in range(60)],
            "hc_visits": [{"visit_id": f"V{i}", "patient_id": f"PT{r.randint(0, n(5000) - 1)}", "doctor_id": f"DR{r.randint(0, 59)}", "visit_date": d(2024, 690),
                           "charge": r.randint(300, 25000), "diagnosis": P(["Hypertension", "Diabetes", "Fracture", "Flu", "Migraine"])} for i in range(n(40000))],
        },
        "Education": {
            "edu_students": [{"student_id": f"ST{i}", "name": P(NAMES), "grade_level": r.randint(1, 12), "school": P(["Alpha", "Beta", "Gamma"])} for i in range(n(3000))],
            "edu_courses": [{"course_id": f"C{i}", "subject": P(["Math", "Science", "English", "History", "Art"]), "credits": r.randint(1, 5)} for i in range(80)],
            "edu_enrollments": [{"student_id": f"ST{r.randint(0, n(3000) - 1)}", "course_id": f"C{r.randint(0, 79)}", "term": P(["2024-T1", "2024-T2", "2025-T1"]),
                                 "score": None if r.random() < 0.04 else r.randint(20, 100)} for _ in range(n(24000))],
        },
        "Logistics": {
            "lg_drivers": [{"driver_id": f"DV{i}", "name": P(NAMES), "licence_years": r.randint(1, 30), "base_city": P(CITIES)} for i in range(300)],
            "lg_vehicles": [{"vehicle_id": f"VH{i}", "type": P(["Truck", "Van", "Bike"]), "capacity_kg": r.randint(100, 20000)} for i in range(150)],
            "lg_trips": [{"trip_id": f"TR{i}", "driver_id": f"DV{r.randint(0, 299)}", "vehicle_id": f"VH{r.randint(0, 149)}", "trip_date": d(2025, 320),
                          "km": round(r.random() * 800, 1), "fuel_l": round(r.random() * 120, 1), "on_time": P("YYYN")} for i in range(n(70000))],
        },
        "SaaS": {
            "saas_customers": [{"customer_id": f"SC{i}", "industry": P(["Retail", "Fintech", "Health", "Edu"]), "plan": P(["Free", "Pro", "Enterprise"])} for i in range(n(1200))],
            "saas_subscriptions": [{"sub_id": f"SB{i}", "customer_id": f"SC{r.randint(0, n(1200) - 1)}", "start_date": d(2023, 1000),
                                    "end_date": d(2025, 300) if r.random() < 0.3 else None, "mrr": r.randint(0, 90000)} for i in range(n(1500))],
            "saas_usage": [{"customer_id": f"SC{r.randint(0, n(1200) - 1)}", "day": d(2025, 320), "api_calls": r.randint(0, 50000), "active_users": r.randint(0, 400)} for _ in range(n(200000))],
        },
        "Marketing": {
            "mk_campaigns": [{"campaign_id": f"CP{i}", "channel": P(["Google", "Meta", "LinkedIn", "Email"]), "start": d(2025, 200), "budget": r.randint(50000, 2000000)} for i in range(50)],
            "mk_daily_spend": [{"campaign_id": f"CP{i % 50}", "day": d(2025, 330), "spend": round(r.random() * 20000, 2), "clicks": r.randint(0, 5000)} for i in range(6000)],
            "mk_leads": [{"lead_id": f"L{i}", "campaign_id": f"CP{r.randint(0, 49)}", "created": d(2025, 330), "stage": P(["New", "MQL", "SQL", "Won", "Lost"]),
                          "value": None if r.random() < 0.5 else r.randint(10000, 900000)} for i in range(n(15000))],
        },
        "IoT": {
            "iot_sensors": [{"sensor_id": f"SN{i}", "site": P(CITIES), "kind": P(["temp", "humidity", "vibration"])} for i in range(100)],
            "iot_readings": [{"sensor_id": f"SN{r.randint(0, 99)}", "ts": f"{d(2025, 300)}T{r.randint(0, 23):02d}:00:00",
                              "value": -999 if r.random() < 0.01 else round(r.random() * 100, 3)} for _ in range(n(200000))],
            "iot_maintenance": [{"sensor_id": f"SN{r.randint(0, 99)}", "date": d(2024, 600), "action": P(["calibrate", "replace", "clean"]), "cost": r.randint(500, 50000)} for _ in range(900)],
        },
    }


def write(projs: dict, out: Path) -> list[tuple[str, Path]]:
    files = []
    for proj, tables in projs.items():
        folder = out / proj
        folder.mkdir(parents=True, exist_ok=True)
        for name, rows in tables.items():
            if name == "mk_leads":   # one JSON file, so JSON import is exercised too
                path = folder / f"{name}.json"
                path.write_text(json.dumps(rows), encoding="utf-8")
            else:
                path = folder / f"{name}.csv"
                with path.open("w", newline="", encoding="utf-8") as f:
                    w = csv.DictWriter(f, fieldnames=list(rows[0]))
                    w.writeheader()
                    w.writerows(rows)
            files.append((proj, path))
    return files


def load(files: list[tuple[str, Path]]) -> None:
    """Import into the local workspace through the real upload endpoint (same code path as the UI)."""
    import os
    os.environ.setdefault("AUTH_ENABLED", "false")   # load into the local single-user workspace (what dev mode shows)
    sys.path.insert(0, str(ROOT / "backend"))
    from starlette.testclient import TestClient
    import Main
    client = TestClient(Main.app)
    for proj, path in files:
        with path.open("rb") as f:
            res = client.post("/api/datasets/upload", files={"file": (path.name, f)}, data={"folder": proj})
        print(f"  {res.status_code}  {proj}/{path.name}" + ("" if res.status_code < 400 else f"  {res.json().get('detail')}"))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--load", action="store_true")
    ap.add_argument("--only", default="")
    ap.add_argument("--scale", type=float, default=1.0)
    a = ap.parse_args()
    projs = projects(random.Random(42), a.scale)
    if a.only:
        projs = {k: v for k, v in projs.items() if k in {x.strip() for x in a.only.split(",")}}
    files = write(projs, OUT)
    print(f"wrote {len(files)} files to {OUT}")
    if a.load:
        load(files)
    return 0


if __name__ == "__main__":
    sys.exit(main())
