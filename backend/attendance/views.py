from django.shortcuts import render
from django.contrib.auth.decorators import login_required

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


def index(request):
    return render(request, 'index.html')

@login_required
def dashboard(request):
    
    courses = ws(env.str("WS_TOKEN"), "core_enrol_get_users_courses", userid=238)
    grades = ws(env.str("WS_TOKEN"), "gradereport_user_get_grade_items", userid=238, courseid=230)

    grades_overview = ws(env.str("WS_TOKEN"), "gradereport_overview_get_course_grades", userid=238)["grades"]
    info = ws(env.str("WS_TOKEN"), "core_course_get_enrolled_courses_by_timeline_classification", classification="inprogress")    

    context = {
        "student_name": grades["usergrades"][0]["userfullname"],
        "student_initials": "".join(map(lambda word: word[0], (grades["usergrades"][0]["userfullname"]).split())),
        "course_id": grades["usergrades"][0]["courseid"],
        "course_name": next((course["fullname"] for course in courses if course["id"] == grades["usergrades"][0]["courseid"]), "Unknown Course"),
        "courses": courses,
        "grades": grades,
        "grades_overview": grades_overview,
        "number_of_courses": len(info.get("courses"))


    }
    return render(request, 'dashboard.html', context)