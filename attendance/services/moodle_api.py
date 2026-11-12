import requests
import environs
import re
from bs4 import BeautifulSoup

from django.http import JsonResponse

from .utilities import to_datetime

URL = "https://edu.inha.uz/webservice/rest/server.php"


def ws(token, function, **params):
    data = {"wstoken": token, "wsfunction": function, "moodlewsrestformat": "json", **params}
    return requests.post(URL, data=data, timeout=45).json()


def get_token(username, password):
    url = "https://edu.inha.uz/login/token.php"

    response = requests.post(
        url,
        data={
            "username": username,
            "password": password,
            "service": "moodle_mobile_app",
        },
        timeout=20,
    )

    response.raise_for_status()

    data = response.json()

    token = data.get("token")

    if not token:
        raise RuntimeError(
            f"Moodle authentication failed: "
            f"{data.get('error', 'Unknown error')}"
        )

    return token

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
        course_data = ws(token, "core_course_get_courses_by_field", field="id", value=course["id"])["courses"][0]

        professors = course_data["contacts"]
        categoryname = course_data["categoryname"]
        shortname = course_data["shortname"]
        for professor in professors:
            if professor["fullname"] != "Academic Affairs":
                professor_name = professor["fullname"]
        for field in course_data.get("customfields", []):
            if field["shortname"] == "ects":
                ects = field["valueraw"]
            elif field["shortname"] == "semester":
                semester = field["valueraw"]
        
        item = {
            'courseid': course["id"],
            "fullname": course["fullname"],
            "categoryname": categoryname,
            "professor": professor_name or "",
            "shortname": shortname,
            "ects": ects,
            "semester": semester,
            "started_at": to_datetime(course_data.get("startdate")),

        }
        courses["courses"].append(item)

    return courses

def get_course_sections(courseid, token):
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


        for module in r_modules:
            contents = []

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

def get_course_grade_book(userid, token):
    grades = ws(token, "gradereport_overview_get_course_grades", userid=userid)
    return grades

def get_grade_items(userid, courseid, token):
    grade_items = ws(token, "gradereport_user_get_grade_items", userid=userid, courseid=courseid)
    return grade_items

def get_assignments(courseid, token):
    assignments = ws(token, "mod_assign_get_assignments", courseid=courseid)
    return assignments

def get_quizzes(courseid, token):
    quizzes = ws(token, "mod_quiz_get_quizzes_by_courses", courseid=courseid)
    return quizzes

def get_assignment_status(assignid, token):
    return ws(
        token,
        "mod_assign_get_submission_status",
        assignid=assignid,
    )

def get_quiz_attempts(quizid, userid, token):
    return ws(
        token,
        "mod_quiz_get_user_attempts",
        quizid=quizid,
        userid=userid,
        status="all",
    )