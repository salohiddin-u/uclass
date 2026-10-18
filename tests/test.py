import truststore
truststore.inject_into_ssl()

import requests

url = "https://edu.inha.uz/webservice/rest/server.php"

def ws(token, function, **params):
    data = {"wstoken": token, "wsfunction": function, "moodlewsrestformat": "json", **params}
    return requests.post(url, data=data, timeout=25).json()




info = ws("", "tool_mobile_get_content", component="mod_attendance",
    method="mobile_view_activity",
    **{
        "args[0][name]": "cmid",     "args[0][value]": 1553,
        "args[1][name]": "courseid", "args[1][value]": 230,
    },
)
print(info)

# courses = ws("", "core_enrol_get_users_courses", userid=238)
# grades = ws("", "gradereport_user_get_grade_items", userid=238, courseid=230)

# grades_overview = ws("", "gradereport_overview_get_course_grades", userid=238)



# print("Student", grades["usergrades"][0]["userfullname"])
# print("Course", grades["usergrades"][0]["courseid"])
# course_name = next((course["fullname"] for course in courses if course["id"] == grades["usergrades"][0]["courseid"]), "Unknown Course")
# print("Course Name:", course_name)
# print("Grade Items:")
# for item in grades["usergrades"][0]["gradeitems"]:
#     print(f"  - {item['itemname'] if item['itemname'] else 'Total'}: {item['graderaw'] if item['graderaw'] is not None else 'N/A'}/{item['grademax']} (Percentage: {item['percentageformatted']})")
# print("="*20)

# for course in courses:
#     print("Course ID:", course["id"])
#     print("Course Name:", course["fullname"])
#     print("Overall Grade: ", [grade['grade'] for grade in grades_overview["grades"] if grade['courseid'] == course["id"]][0])
#     print("="*20)

