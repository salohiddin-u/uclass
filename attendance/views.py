from asyncio.log import logger

import truststore

truststore.inject_into_ssl()

from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.http import JsonResponse
from django.utils import timezone
from django.db import transaction
from django.db.models import Avg, OuterRef, Subquery

import requests
import environs
import re
from bs4 import BeautifulSoup

from datetime import datetime

from .services.encryption import encrypt, decrypt
from .models import *

from .services.moodle_api import *
from .services.sync import sync_courses, sync_grades

env = environs.Env()
env.read_env()



def login_view(request):
    if request.user.is_authenticated:
        return redirect("/")

    if request.method == "POST":
        username = (request.POST.get("username") or "").strip()
        password = request.POST.get("password") or ""

        if not username or not password:
            return render(request, "registration/login.html", {
                "error": "Enter username and password."
            })

        try:
            token = get_token(username, password)

            if not isinstance(token, str) or not token:
                raise ValueError("Invalid token")

            userid, first_name, last_name = get_user_info(token)

            if not userid:
                raise ValueError("Missing Moodle user ID")

        except Exception:
            return render(request, "registration/login.html", {
                "error": "Invalid Moodle credentials or server unavailable."
            })

        try:
            with transaction.atomic():
                student = (
                    Student.objects.select_related("user")
                    .filter(userid=userid)
                    .first()
                )

                if student:
                    user = student.user
                else:
                    if User.objects.filter(username=username).exists():
                        raise ValueError("Account conflict")

                    user = User(username=username)
                    user.set_unusable_password()
                    user.save()


                if student:
                    student.first_name = first_name
                    student.last_name = last_name
                    student.consent_enabled = timezone.now()
                    student.enc_password = encrypt(password)
                    
                    student.save(
                        update_fields=["first_name", "last_name", "consent_enabled", "enc_password"]
                    )
                else:
                    student = Student.objects.create(
                        user=user,
                        userid=userid,
                        first_name=first_name,
                        last_name=last_name,
                        consent_enabled=timezone.now(),
                        enc_password=encrypt(password),
                        last_sync=timezone.now(),
                    )

        except ValueError:
            return render(request, "registration/login.html", {
                "error": "Account conflict. Contact support."
            })

        

        try:
            sync_courses(student.userid)
            sync_grades(student.userid)
        except Exception:
            logger.exception(
                "Moodle synchronization failed for student %s",
                student.pk,
            )

        student = (
                Student.objects.select_related("user")
                .filter(userid=userid)
                .first()
                )
        student.last_sync = timezone.now()
        student.consent_enabled = timezone.now()
        student.save(update_fields=["last_sync", "consent_enabled"])
        login(request, student.user)
        return redirect("/")

    return render(request, "login.html")


def home(request):
    if not request.user.is_authenticated:
        return render(request, 'home.html')
    else:
        course_enrollments = CourseEnrollment.objects.filter(student__user=request.user).select_related('course').annotate(
            earned_grade=Subquery(
            GradeBook.objects
            .filter(student=OuterRef("student"), course=OuterRef("course"))
            .values("earned_grade")[:1]
        ),
        max_grade=Subquery(
            GradeBook.objects
            .filter(student=OuterRef("student"), course=OuterRef("course"))
            .values("max_grade")[:1]
        ),
        percent_grade=Subquery(
            GradeBook.objects
            .filter(student=OuterRef("student"), course=OuterRef("course"))
            .values("percentage")[:1]
        ))

        
        for enrollment in course_enrollments:
            enrollment.course.earned_grade = enrollment.earned_grade
            enrollment.course.max_grade = enrollment.max_grade
            print(f"Course: {enrollment.course.fullname}, Earned Grade: {enrollment.percent_grade}, Max Grade: {enrollment.max_grade}")
        context = {
            'courses': course_enrollments,
            'student': Student.objects.get(user=request.user),
            'current_average': GradeBook.objects.filter(student__user=request.user).aggregate(average=Avg('percentage'))['average'],

        }
        return render(request, 'dashboard.html', context)

@login_required
def courses(request):
    course_enrollments = CourseEnrollment.objects.filter(student__user=request.user).select_related('course').annotate(
                earned_grade=Subquery(
                GradeBook.objects
                .filter(student=OuterRef("student"), course=OuterRef("course"))
                .values("earned_grade")[:1]
            ),
            max_grade=Subquery(
                GradeBook.objects
                .filter(student=OuterRef("student"), course=OuterRef("course"))
                .values("max_grade")[:1]
            ),
            percent_grade=Subquery(
                GradeBook.objects
                .filter(student=OuterRef("student"), course=OuterRef("course"))
                .values("percentage")[:1]
            ))
    context = {
        'courses': course_enrollments,
        'student': Student.objects.get(user=request.user),
    }
    return render(request, 'courses.html', context)

def privacy(request):
    pass

def terms(request):
    pass

def attendance(request):
    pass

@login_required
def grades(request):
    return render(request, 'grades.html')


def timetable(request):
    pass

def assignments(request):
    pass

def profile(request):
    pass

@login_required
def course_detail(request, course_id):
    course = Course.objects.get(courseid=course_id)
    return render(request, 'course_detail.html', {
        'course': course,
        'student': Student.objects.get(user=request.user),
        'sections': CourseSection.objects.filter(course=course),
        'grade': GradeBook.objects.get(student__user=request.user, course=course),
    })

def logout_view(request):
    logout(request)
    return redirect("/login/")