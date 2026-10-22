import requests
import environs
import re
from bs4 import BeautifulSoup

from django.http import JsonResponse

URL = "https://edu.inha.uz/webservice/rest/server.php"


def ws(token, function, **params):
    data = {"wstoken": token, "wsfunction": function, "moodlewsrestformat": "json", **params}
    return requests.post(URL, data=data, timeout=45).json()

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
        course_data = ws(token, "core_course_get_courses_by_field", field="id", value=course["id"])["courses"][0]

        professors = course_data["contacts"]
        categoryname = course_data["categoryname"]
        shortname = course_data["shortname"]
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

def get_course_grade_book(userid, token):
    try:
        grades = ws(token, "gradereport_overview_get_course_grades", userid=userid)
        return grades
    except Exception as e:
        return JsonResponse({"error": str(e), "message": "Error fetching course grades. Please try again later."}, status=500)

def get_grade_items(userid, courseid, token):
    try:
        grade_items = ws(token, "gradereport_user_get_grade_items", userid=userid, courseid=courseid)
        return grade_items
    except Exception as e:
        return JsonResponse({"error": str(e), "message": "Error fetching grade items. Please try again later."}, status=500)