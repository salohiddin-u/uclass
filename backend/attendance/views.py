from django.shortcuts import render
from django.contrib.auth.decorators import login_required
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User

import requests
import environs
from bs4 import BeautifulSoup

from datetime import datetime

from .encryption import encrypt, decrypt
from .models import *

import truststore
truststore.inject_into_ssl()


env = environs.Env()
env.read_env(".env")

url = "https://edu.inha.uz/webservice/rest/server.php"

def ws(token, function, **params):
    data = {"wstoken": token, "wsfunction": function, "moodlewsrestformat": "json", **params}
    return requests.post(url, data=data, timeout=25).json()

def get_token(username, password):
    r = requests.post(
        "https://edu.inha.uz/login/token.php",
        data={
            "username": username,
            "password": password,
            "service": "moodle_mobile_app",
        },
        timeout=20,
    )
    data = r.json()
    if "token" in data:
        return data["token"]
    raise RuntimeError(data.get("error", "token request failed"))

def get_user_info(token):
    r = requests.post(
    "https://edu.inha.uz/webservice/rest/server.php",
    data={
        "wstoken": token,
        "wsfunction": "core_webservice_get_site_info",
        "moodlewsrestformat": "json",
    },
    timeout=25,
)
    userid = r.json()["userid"]
    first_name = r.json()["firstname"]
    last_name = r.json()["lastname"]
    return userid, first_name, last_name


def index(request):
    return render(request, 'index.html')

def login_view(request):
    if request.user.is_authenticated:
        return render(request, 'dashboard.html')
    else:
        if request.method == 'POST':
            username = request.POST.get('username')
            password = request.POST.get('password')
            token = get_token(username, password)
            encryted_password = encrypt(password)
            userid = get_user_info(token)[0]
            first_name = get_user_info(token)[1]
            last_name = get_user_info(token)[2]
            users = User.objects.filter(username=username)
            if users.exists():
                login(request, users.first())
                return dashboard(request)
            else:
                user = User.objects.create_user(username=username, password=encryted_password)
                user.save()
                student = Student.objects.create(user=user, enc_password=encryted_password, first_name=first_name, last_name=last_name, userid=userid, consent_enabled=datetime.now())
                student.save()
                login(request, user)
                return dashboard(request)

    return render(request, 'registration/login.html')

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


def privacy(request):
    pass

def terms(request):
    pass