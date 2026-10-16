from django.shortcuts import render
import truststore
truststore.inject_into_ssl()

import requests
import environs
from bs4 import BeautifulSoup

from datetime import datetime


env = environs.Env()
env.read_env(".env")

url = "https://edu.inha.uz/webservice/rest/server.php"

def ws(token, function, **params):
    data = {"wstoken": token, "wsfunction": function, "moodlewsrestformat": "json", **params}
    return requests.post(url, data=data, timeout=25).json()

def dashboard(request):
    
    courses = ws(env.str("WS_TOKEN"), "core_enrol_get_users_courses", userid=238)
    grades = ws(env.str("WS_TOKEN"), "gradereport_user_get_grade_items", userid=238, courseid=230)

    grades_overview = ws(env.str("WS_TOKEN"), "gradereport_overview_get_course_grades", userid=238)["grades"]

    

    session = requests.Session()

    response = session.get(
        "https://edu.inha.uz/login/index.php",
        timeout=20
    )
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")

    login_token = soup.select_one('input[name="logintoken"]').get('value')

    session.post("https://edu.inha.uz/login/index.php", data={
        "username": "",
        "password": "",
        "logintoken": login_token
    })

    # print(login.text)
    response = session.get(
        "https://edu.inha.uz/mod/attendance/view.php",
        params={
            "id": 1553,
            "mode": 2,
            "sesscourses": "all",
            "view": 5,
        }
    )

    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    rows = soup.select("tr")
    # print(rows)
    attendance_data = []
    for row in rows:
        date_text = row.select_one("td.colcourse").get_text(" ", strip=True) if row.select_one("td.desccol") else "N/A"
        status = row.select_one("td.desccol").get_text(strip=True) if row.select_one("td.desccol") else "N/A"
        date = datetime.strptime(date_text.split(" "), "%d %B %Y").date() if date_text != "N/A" else None
        attendance_data.append({"date": date, "status": status})

    session.close()





    context = {
        "student_name": grades["usergrades"][0]["userfullname"],
        "course_id": grades["usergrades"][0]["courseid"],
        "course_name": next((course["fullname"] for course in courses if course["id"] == grades["usergrades"][0]["courseid"]), "Unknown Course"),
        "courses": courses,
        "grades": grades,
        "grades_overview": grades_overview,
        "attendance_data": attendance_data

    }
    return render(request, 'index.html', context)