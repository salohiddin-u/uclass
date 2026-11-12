
from decimal import Decimal
from html import unescape

from attendance.models import *
from attendance.services.moodle_api import *

from django.contrib.auth.models import User
from django.db import transaction
from django.utils import timezone
from django.shortcuts import redirect
from django.contrib.auth import login

from .encryption import encrypt, decrypt
from .utilities import to_datetime
from .get_attendance import moodle_login, get_attendance_page

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
                    "fullname": unescape(course.get("fullname", "")),
                    "categoryname": unescape(course.get("categoryname", "")),
                    "professor": unescape(course.get("professor", "")),
                    "shortname": unescape(course.get("shortname", "")),
                    "description": unescape(course.get("description", "")),
                    "ects": course.get("ects", None),
                    "semester": course.get("semester", None),
                    "started_at": course.get("started_at", None),
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
                        "section_number": section.get("section_number", 0),
                        "name": unescape(section.get("name", "")),
                    },
                )
                for module in section["modules"]["modules"]:
                    contents = []
                    new_module, _ = CourseModule.objects.update_or_create(
                        cmid=module["moodle_id"],
                        defaults={
                            "course": new_course,
                            "section": new_section,
                            "instance": module.get("instance", ""),
                            "modname": module.get("module_type", ""),
                            "name": unescape(module.get("name", "")),
                            "url": module.get("url") or "",
                            "description": unescape(module.get("description") or ""),
                            "opened_at": to_datetime(module.get("opened_at")),
                            "due_at": to_datetime(module.get("due_at")),
                        },
                    )
                    for content in module.get("contents", []):
                        if content.get("type") == "file":
                            contents.append({
                                "file_url": content.get("fileurl", ""),
                                "filename": content.get("filename", ""),
                                "filesize": content.get("filesize", 0),
                                "mimetype": content.get("mimetype", ""),
                                "author": content.get("author", ""),
                                "timemodified": content.get("timemodified"),
                            })

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
                            'max_grade': grade_item.get('grademax', 0),
                            'earned_grade': grade_item.get('graderaw', 0),
                            'percentage': (100/grade_item.get('grademax', 1))*grade_item.get('graderaw', 0) if grade_item.get('grademax') and grade_item.get('graderaw') else 0,
                            'letter_grade': unescape(grade_item.get('lettergradeformatted') or ''),
                            'last_updated': timezone.now(),
                            'rank': grade_item.get('rank', 0),
                            'numusers': grade_item.get('numusers', 0),

                        }
                    )
                elif grade_item['itemtype']=="mod":
                    module = CourseModule.objects.get(cmid=grade_item['cmid'])
                    grade, created = Grade.objects.update_or_create(
                        moodle_id=grade_item['id'],
                        defaults={
                            'name': unescape(grade_item.get('itemname') or ''),
                            'instance': grade_item.get('iteminstance'),
                            'category_id': grade_item.get('categoryid'),
                            'module': module,
                            'min_grade': grade_item.get('grademin', 0),
                            'max_grade': grade_item.get('grademax', 0),
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


def sync_attendance(pk):
    student = Student.objects.get(userid=pk)
    session = moodle_login(student.user.username, decrypt(student.enc_password))
    course_enrollments = CourseEnrollment.objects.filter(student=student)
    for enrollment in course_enrollments:
        course = enrollment.course
        attendance_page = get_attendance_page(session, course.courseid)
        for record in attendance_page:
            session_id = record.get("session_id")
            if session_id is not None:
                course_module = CourseModule.objects.filter(cmid=record.get("cmid")).first()
