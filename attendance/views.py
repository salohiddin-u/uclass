from django.db import transaction
import truststore
truststore.inject_into_ssl()

from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.http import JsonResponse
from django.utils import timezone

import requests
import environs
import re
from bs4 import BeautifulSoup

from datetime import datetime

from .encryption import encrypt, decrypt
from .models import *

env = environs.Env()
env.read_env()

url = "https://edu.inha.uz/webservice/rest/server.php"


def normalize_group(name):
    match = re.fullmatch(
        r"([A-Za-z]+)-?(\d{2})-(\d+)",
        name.strip()
    )

    if not match:
        return None

    program, year, number = match.groups()

    return f"{program.upper()}{year}-{int(number)}"



def ws(token, function, **params):
    data = {"wstoken": token, "wsfunction": function, "moodlewsrestformat": "json", **params}
    return requests.post(url, data=data, timeout=45).json()

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
    timeout=45,
)
    userid = r.json()["userid"]
    first_name = r.json()["firstname"]
    last_name = r.json()["lastname"]
    return userid, first_name, last_name


def get_user_courses(userid, token):
    enrolled_courses = ws(token, "core_enrol_get_users_courses", userid=userid)
    courses = {'courses': []}
    request = ws(token, "core_course_get_courses_by_field", field="id", value=course["id"])["courses"][0]
    for course in enrolled_courses:
        professors = request["contacts"]
        categoryname = request["categoryname"]
        shortname = request["shortname"]
        for professor in professors:
            if professor["fullname"] != "Academic Affairs":
                professor_name = professor["fullname"]
        item = {
            'courseid': course["id"],
            "fullname": course["fullname"],
            "categoryname": categoryname,
            "professor": professor_name,
            "shortname": shortname,
        }
        courses["courses"].append(item)

    return courses


def get_course_sections(courseid, token):
    try:
        r_sections = ws(token, "core_course_get_contents", courseid=courseid)
        sections = {'sections': []}
        for section in r_sections:
            moodle_id = section['id']
            visible = section['visible']
            description = section.get('description', '')
            uservisible = section['uservisible']
            name = section['name']
            section_number = section['section']
            r_modules = section.get('modules', [])
            modules = {'modules': []}
            contents = []

            for module in r_modules:
                module_name = module['name']
                module_moodle_id = module['id']
                module_type = module.get('modname', '')
                module_contents = module.get('contents', [])
                module_visible = module.get('visible', 0)
                module_uservisible = module.get('uservisible', False)
                url = module.get('url', '')
                instance = module.get('instance', None)
                opened_at = module.get('opened_at', None)
                due_at = module.get('due_at', None)

                for content in module_contents:
                    content_file_url = content.get('fileurl', '')
                    contents.append({'file_url': content_file_url})
                modules['modules'].append({
                    'moodle_id': module_moodle_id,
                    'name': module_name,
                    'module_type': module_type,
                    'visible': module_visible,
                    'uservisible': module_uservisible,
                    'url': url,
                    'instance': instance,
                    'opened_at': opened_at,
                    'due_at': due_at,
                    'contents': contents
                })

            item = {
                'moodle_id': moodle_id,
                'name': name,
                'visible': visible,
                'section_number': section_number,
                'modules': modules,
            }
            sections['sections'].append(item)
        return sections
    except Exception as e:
        return JsonResponse({"error": str(e), "message": "Error fetching course sections. Please try again later."}, status=500)

def sync_courses(request):
    try:
        student = Student.objects.get(user=request.user)
        token = get_token(request.user.username, decrypt(student.enc_password))
        courses = get_user_courses(student.userid, token)

        for course in courses["courses"]:
            with transaction.atomic():
                new_course, created = Course.objects.update_or_create(
                    courseid=course["courseid"],
                    fullname=course["fullname"],
                    categoryname=course["categoryname"],
                    professor=course["professor"],
                    shortname=course["shortname"],
                )
                CourseEnrollment.objects.get_or_create(student=student, course=new_course)
            
            course_sections = get_course_sections(course["courseid"], token)
            with transaction.atomic():
                for section in course_sections["sections"]:
                    new_section, created = CourseSection.objects.update_or_create(
                        course=new_course,
                        section_number=section["section_number"],
                        moodle_id=section["moodle_id"],
                        name=section["name"],
                    )
                    for module in section["modules"]["modules"]:
                        new_module, created = CourseModule.objects.update_or_create(
                            course=new_course,
                            section=new_section,
                            cmid=module["moodle_id"],
                            instance=module["instance"],
                            modname=module["module_type"],
                            name=module["name"],
                            url=module["url"],
                            description=module.get("description", ""),
                            opened_at=datetime.fromtimestamp(module["opened_at"]) if module["opened_at"] else None,
                            due_at=datetime.fromtimestamp(module["due_at"]) if module["due_at"] else None,
                        )
                        for content in module["contents"]:
                            new_file, created = CourseFile.objects.update_or_create(
                                module=new_module,
                                filename=content["file_url"],
                            )
        student.last_sync = timezone.now()
        student.save()
            
                
        return JsonResponse({"message": "Courses synced successfully."})
    except Exception as e:
        return JsonResponse({"error": str(e), "message": "Error syncing courses. Please try again later."}, status=500)

def sync_user(request):
    try:
        with transaction.atomic():
            username = request.POST.get('username')
            password = request.POST.get('password')
            token = get_token(username, password)
            userid, first_name, last_name = get_user_info(token)

            users = User.objects.filter(username=username)
            if users.exists():
                login(request, users.first())
                return redirect('/')
            elif not users.exists():
                                
                user = User(username=username)
                user.set_unusable_password()
                user.save()
                student, created = Student.objects.update_or_create(
                    user=request.user,
                    defaults={
                        'enc_password': encrypt(password),
                        'first_name': first_name,
                        'last_name': last_name,
                        'userid': userid,
                        'consent_enabled': timezone.now(),
                        'last_sync': timezone.now()
                    }
                )
                login(request, user)


        return JsonResponse({"message": "User synced successfully."})
    except Exception as e:
        return JsonResponse({"error": str(e), "message": "Error syncing user. Please try again later."}, status=500)

def login_view(request):
    if request.user.is_authenticated:
        return redirect('/')
    else:
        if request.method == 'POST':
            
            sync_user(request)
            sync_courses(request)
                
            return redirect('/')

    return render(request, 'registration/login.html')



def index(request):
    if not request.user.is_authenticated:
        return render(request, 'index.html')
    else:
        course_enrollments = CourseEnrollment.objects.filter(student__user=request.user)
        courses = [enrollment.course for enrollment in course_enrollments]
        context = {
            'courses': courses,
            'student': Student.objects.get(user=request.user),

        }
        return render(request, 'dashboard.html', context)

@login_required
def courses(request):
    course_enrollments = CourseEnrollment.objects.filter(student__user=request.user)
    courses = [enrollment.course for enrollment in course_enrollments]
    context = {
        'courses': courses,
        'student': Student.objects.get(user=request.user),
    }
    return render(request, 'courses.html', context)

def privacy(request):
    pass

def terms(request):
    pass

def attendance(request):
    pass

def grades(request):
    pass

def timetable(request):
    pass

def assignments(request):
    pass

def profile(request):
    pass

def course_detail(request, course_id):
    pass