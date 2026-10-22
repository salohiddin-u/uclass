from decimal import Decimal

from attendance.models import *
from attendance.services.moodle_api import *

from django.contrib.auth.models import User
from django.db import transaction
from django.utils import timezone
from django.shortcuts import redirect
from django.contrib.auth import login

from .encryption import encrypt, decrypt
from .utilities import to_datetime

from datetime import datetime


def sync_courses(pk):
    print("Syncing courses for user:", pk)
    student = Student.objects.get(userid=pk)
    username = (
        Student.objects
        .values_list("user__username", flat=True)
        .get(userid=pk)
        )
    token = get_token(username, decrypt(student.enc_password))
    courses = get_user_courses(student.userid, token)

    for course in courses["courses"]:
        with transaction.atomic():
            new_course, _ = Course.objects.update_or_create(
                courseid=course["courseid"],
                defaults={
                    "fullname": course["fullname"],
                    "categoryname": course["categoryname"],
                    "professor": course.get("professor", ""),
                    "shortname": course["shortname"],
                },
            )
            CourseEnrollment.objects.get_or_create(student=student, course=new_course)
        
        course_sections = get_course_sections(course["courseid"], token)
        with transaction.atomic():
            for section in course_sections["sections"]:
                new_section, _ = CourseSection.objects.update_or_create(
                    moodle_id=section["moodle_id"],
                    defaults={
                        "course": new_course,
                        "section_number": section["section_number"],
                        "name": section["name"],
                    },
                )
                for module in section["modules"]["modules"]:
                    new_module, _ = CourseModule.objects.update_or_create(
                        cmid=module["moodle_id"],
                        defaults={
                            "course": new_course,
                            "section": new_section,
                            "instance": module["instance"],
                            "modname": module["module_type"],
                            "name": module["name"],
                            "url": module.get("url") or "",
                            "description": module.get("description") or "",
                            "opened_at": to_datetime(module.get("opened_at")),
                            "due_at": to_datetime(module.get("due_at")),
                        },
                    )
                    for content in module["contents"]:
                        new_file, created = CourseFile.objects.update_or_create(
                            module=new_module,
                            filename=content["file_url"],
                        )
    student.last_sync = timezone.now()
    student.save()
        
            
    return True

def sync_grades(pk):
    student = Student.objects.get(userid=pk)
    username = (
        Student.objects
        .values_list("user__username", flat=True)
        .get(userid=pk)
    )
    token = get_token(username, decrypt(student.enc_password))
    grades = get_course_grade_book(userid=student.userid, token=token)
    for course_grade in grades.get("grades", []):
        course_id = course_grade["courseid"]
        grade_items = get_grade_items(token=token, userid=student.userid, courseid=course_id)
        course = Course.objects.get(courseid=course_id)
        for user_grade in grade_items.get("usergrades", []):
            for grade_item in user_grade.get("gradeitems", []):
                if grade_item['itemtype']=="course":
                    GradeBook.objects.update_or_create(
                        course=course,
                        student=student,
                        defaults={
                            'max_grade': grade_item['grademax'],
                            'earned_grade': grade_item["graderaw"],
                            'percentage': (100/grade_item['grademax'])*grade_item["graderaw"] if grade_item['grademax'] and grade_item['graderaw'] else 0,
                            'letter_grade': grade_item['lettergradeformatted'],
                            'last_updated': timezone.now(),
                            'rank': grade_item["rank"],
                            'numusers': grade_item['numusers'],

                        }
                    )
                elif grade_item['itemtype']=="mod":
                    module = CourseModule.objects.get(cmid=grade_item['cmid'])
                    grade, created = Grade.objects.update_or_create(
                        moodle_id=grade_item['id'],
                        defaults={
                            'name': grade_item.get('itemname') or '',
                            'instance': grade_item.get('iteminstance'),
                            'category_id': grade_item['categoryid'],
                            'module': module,
                            'min_grade': grade_item['grademin'],
                            'max_grade': grade_item['grademax'],
                            "weightraw": (
                                        Decimal(str(grade_item["weightraw"]))
                                        if grade_item.get("weightraw") is not None
                                        else None
                                    ),
                                                            }
                    )
                    graded_at = to_datetime(
                        grade_item.get("gradedategraded")
                    )
                    GradeItem.objects.update_or_create(
                        grade=grade,
                        student=student,
                        defaults={
                            'earned_grade': grade_item.get('graderaw'),
                            'rank': grade_item.get('rank'),
                            'numusers': grade_item.get('numusers'),
                            'is_hidden': grade_item.get('gradeishidden', False),
                            'is_overridden': bool(grade_item.get('gradeisoverridden')),
                            'graded_at': graded_at,
                        }
                    )
    return True