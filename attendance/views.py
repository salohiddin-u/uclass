import truststore
truststore.inject_into_ssl()

from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User

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
    for course in enrolled_courses:
        professors = ws(token, "core_course_get_courses_by_field", field="id", value=course["id"])["courses"][0]["contacts"]
        categoryname = ws(token, "core_course_get_courses_by_field", field="id", value=course["id"])["courses"][0]["categoryname"]
        shortname = ws(token, "core_course_get_courses_by_field", field="id", value=course["id"])["courses"][0]["shortname"]
        for professor in professors:
            if professor["fullname"] != "Academic Affairs":
                professor_name = professor["fullname"]
        grades = ws(token, "gradereport_user_get_grade_items", userid=userid, courseid=course['id'])
        grade_str = grades['usergrades'][0]['gradeitems'][-1]['percentageformatted'][:6]
        grade = (float(grade_str)) if grade_str != "-" else "N/A"
        item = {
            'courseid': course["id"],
            "fullname": course["fullname"],
            "categoryname": categoryname,
            "professor": professor_name,
            "grade": grade,
            "shortname": shortname,
        }
        courses["courses"].append(item)

    return courses


def get_course_sections(courseid, token):
    try:
        print("="*32)
        print("came")
        print("="*32)
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
    except:
        print("="*32)
        print("error")
        print("="*32)


def login_view(request):
    if request.user.is_authenticated:
        return redirect('/')
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

                return redirect('/')
            elif not users.exists():

                user = User.objects.create_user(username=username, password=encryted_password)
                user.save()

                student = Student.objects.create(user=user, enc_password=encryted_password, first_name=first_name, last_name=last_name, userid=userid, consent_enabled=datetime.now(), last_sync=datetime.now())
                student.save()

                courses = get_user_courses(userid, token)

                for course in courses["courses"]:
                    if not Course.objects.filter(courseid=course["courseid"]).exists():
                        new_course = Course.objects.create(
                            courseid=course["courseid"],
                            fullname=course["fullname"],
                            categoryname=course["categoryname"],
                            professor=course["professor"],
                            shortname=course["shortname"],
                        )
                        new_course.save()
                        CourseEnrollment.objects.create(student=student, course=new_course)
                        course_sections = get_course_sections(course["courseid"], token)
                        for section in course_sections["sections"]:
                            new_section = CourseSection.objects.create(
                                course=new_course,
                                section_number=section["section_number"],
                                moodle_id=section["moodle_id"],
                                name=section["name"],
                            )
                            new_section.save()
                            for module in section["modules"]["modules"]:
                                new_module = CourseModule.objects.create(
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
                                new_module.save()
                                for content in module["contents"]:
                                    new_file = CourseFile.objects.create(
                                        module=new_module,
                                        filename=content["file_url"],
                                    )
                                    new_file.save()
                        
                    elif Course.objects.filter(courseid=course["courseid"]).exists():
                        existing_course = Course.objects.get(courseid=course["courseid"])
                        if not CourseEnrollment.objects.filter(student=student, course=existing_course).exists():
                            CourseEnrollment.objects.create(student=student, course=existing_course)

                login(request, user)

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


def privacy(request):
    pass

def terms(request):
    pass

def courses(request):
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