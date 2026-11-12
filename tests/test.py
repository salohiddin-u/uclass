# import os
# os.environ.setdefault("REQUESTS_CA_BUNDLE", "/home/salohiddin/certs/inha-bundle.pem")

# import truststore
# truststore.inject_into_ssl()

# import requests

# url = "https://edu.inha.uz/webservice/rest/server.php"

# def ws(token, function, **params):
#     data = {"wstoken": token, "wsfunction": function, "moodlewsrestformat": "json", **params}
#     return requests.post(url, data=data, timeout=25).json()


# def get_course_sections(courseid, token):
#     r_sections = ws(token, "core_course_get_contents", courseid=courseid)
#     sections = {'sections': []}
#     for section in r_sections:
#         moodle_id = section['id']
#         visible = section['visible']
#         uservisible = section['uservisible']
#         name = section['name']
#         description = section.get('description', '')
#         section_number = section['section']
#         r_modules = section.get('modules', [])
#         modules = {'modules': []}
#         contents = []

#         for module in r_modules:
#             module_name = module['name']
#             module_moodle_id = module['id']
#             module_type = module.get('modname', '')
#             module_contents = module.get('contents', [])
#             module_visible = module.get('visible', 0)
#             module_uservisible = module.get('uservisible', False)
#             url = module.get('url', '')
#             instance = module.get('instance', None)
#             opened_at = module.get('opened_at', None)
#             due_at = module.get('due_at', None)

#             for content in module_contents:
#                 content_file_url = content.get('fileurl', '')
#                 contents.append({'file_url': content_file_url})
#             modules['modules'].append({
#                 'moodle_id': module_moodle_id,
#                 'name': module_name,
#                 'module_type': module_type,
#                 'visible': module_visible,
#                 'uservisible': module_uservisible,
#                 'url': url,
#                 'instance': instance,
#                 'opened_at': opened_at,
#                 'due_at': due_at,
#                 'contents': contents
#             })

#         item = {
#             'moodle_id': moodle_id,
#             'name': name,
#             'visible': visible,
#             'section_number': section_number,
#             'modules': modules,
#         }
#         sections['sections'].append(item)
#     return sections


# # shortname = ws("", "core_course_get_courses_by_field", field="id", value=230)["courses"][0]["shortname"]
# # grades = ws("", "gradereport_user_get_grade_items", userid=238, courseid=230)
# # grade_str = grades['usergrades'][0]['gradeitems'][-1]['percentageformatted'][:6]
# # grade = (float(grade_str)) if grade_str != "-" else "N/A"
# # print(f"Course Shortname: {shortname}, Grade: {grade}")

# # grade = ws("", "gradereport_overview_get_course_grades", userid=238)
# # print(grade)



# def get_course_grades(userid, token):
#     try:
#         grades = ws(token, "core_course_get_courses_by_field", field="id", value=230)
#         return grades
#     except Exception as e:
#         return print({"error": str(e), "message": "Error fetching course grades. Please try again later."}, status=500)


# grades = get_course_grades(userid=238, token="")
# print(grades)





"""students.inha.uz  POST /api/public/finance  {"lang": "en"}  ->  plain dicts.

The endpoint needs the logged-in session cookie (connect.sid). Never store that cookie.
Amounts are integers in UZS; dates are 'dd.mm.yyyy' strings.
"""
from datetime import datetime
from decimal import Decimal

URL = "https://students.inha.uz/api/public/finance"

METHODS = {"BANK1C": "Bank (1C)", "BANKTRANSFER": "Bank transfer"}   # other codes (Click, Payme, Uzum...) are shown as-is
TYPES = {"TUITION": "Contract"}


def _d(value):
    return Decimal(str(value if value is not None else 0))


def _date(text):
    try:
        return datetime.strptime(text, "%d.%m.%Y").date()
    except (TypeError, ValueError):
        return None


def format_uzs(amount):
    """18250000 -> '18 250 000'"""
    return f"{int(amount):,}".replace(",", " ")


def parse_finance(resp):
    s = resp.get("summary") or {}
    summary = {"accrued": _d(s.get("total_accrued")), "paid": _d(s.get("total_paid")),
               "debt": _d(s.get("balance")),            # assumed to be the 'Debt' tile: verify with an account that owes money
               "overpayment": _d(s.get("overpayment")), "overdue": _d(s.get("overdue_debt"))}
    accruals = [{"type": TYPES.get(a.get("type_code"), a.get("type_code", "")), "academic_year": a.get("academic_year", ""),
                 "semester": a.get("semester"), "date": _date(a.get("operation_date")), "due": _date(a.get("due_date")),
                 "amount": _d(a.get("amount")), "remaining": _d(a.get("remaining")), "status": a.get("status", ""),
                 "opening": bool(a.get("is_opening"))} for a in resp.get("accruals") or []]
    payments = [{"category": TYPES.get(p.get("category_code"), p.get("category_code", "")),
                 "method": METHODS.get(p.get("method_code"), p.get("method_code", "")), "method_code": p.get("method_code", ""),
                 "date": _date(p.get("operation_date")), "amount": _d(p.get("amount")), "kind": p.get("kind", "")}
                for p in resp.get("payments") or []]
    unpaid = [a for a in accruals if a["remaining"] > 0 and a["due"]]
    return {"summary": summary, "accruals": accruals,
            "payments": sorted(payments, key=lambda p: p["date"] or datetime.min.date(), reverse=True),
            "next_due": min(unpaid, key=lambda a: a["due"]) if unpaid else None,
            "installment": resp.get("installment") or [], "pay_status": resp.get("pay_status", "")}


def fetch_finance(session, lang="en", timeout=20):
    """`session` is a requests.Session that is ALREADY signed in. Signing in still needs the login
    request from the Network tab; it is not written yet."""
    r = session.post(URL, json={"lang": lang}, timeout=timeout)
    r.raise_for_status()
    return parse_finance(r.json())


if __name__ == "__main__":
    sample = {"summary": {"balance": 0, "total_paid": 18250000, "overpayment": 0, "overdue_debt": 0, "total_accrued": 18250000},
              "accruals": [{"amount": 18250000, "status": "Paid", "due_date": "10.09.2026", "semester": 1, "remaining": 0,
                            "type_code": "TUITION", "is_opening": False, "academic_year": "2026/2027", "operation_date": "01.09.2026"}],
              "payments": [{"kind": "payment", "amount": 9125000, "method_code": "BANK1C", "category_code": "TUITION", "operation_date": "19.08.2026"},
                           {"kind": "payment", "amount": 9125000, "method_code": "BANKTRANSFER", "category_code": "TUITION", "operation_date": "24.07.2026"}],
              "has_payer": True, "pay_status": "green", "installment": []}
    f = parse_finance(sample)
    assert format_uzs(f["summary"]["accrued"]) == "18 250 000" and f["summary"]["debt"] == 0
    assert f["accruals"][0]["type"] == "Contract" and str(f["accruals"][0]["due"]) == "2026-09-10"
    assert [p["method"] for p in f["payments"]] == ["Bank (1C)", "Bank transfer"]       # newest first
    assert f["next_due"] is None                                                         # everything is paid
    sample["accruals"][0].update(remaining=5000000, status="Partial")                    # an unpaid case
    assert str(parse_finance(sample)["next_due"]["due"]) == "2026-09-10"
    assert parse_finance({})["summary"]["accrued"] == 0                                  # empty answer does not crash
    print("finance parser ok")





