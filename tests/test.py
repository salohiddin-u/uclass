import os
os.environ.setdefault("REQUESTS_CA_BUNDLE", "/home/salohiddin/certs/inha-bundle.pem")

import truststore
truststore.inject_into_ssl()

import requests

url = "https://edu.inha.uz/webservice/rest/server.php"

def ws(token, function, **params):
    data = {"wstoken": token, "wsfunction": function, "moodlewsrestformat": "json", **params}
    return requests.post(url, data=data, timeout=25).json()


def get_course_sections(courseid, token):
    r_sections = ws(token, "core_course_get_contents", courseid=courseid)
    sections = {'sections': []}
    for section in r_sections:
        moodle_id = section['id']
        visible = section['visible']
        uservisible = section['uservisible']
        name = section['name']
        description = section.get('description', '')
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


shortname = ws("", "core_course_get_courses_by_field", field="id", value=230)["courses"][0]["shortname"]
print(shortname)