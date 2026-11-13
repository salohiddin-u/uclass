from asyncio.log import logger

import truststore
from django.http import HttpResponse, StreamingHttpResponse

from .models import Student

truststore.inject_into_ssl()

from urllib.parse import urlparse, unquote
from pathlib import PurePosixPath

from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib.auth import login, logout
from django.contrib.auth.models import User
from django.utils import timezone
from django.db import transaction
from django.db.models import Avg, OuterRef, Subquery
from django.db.models import Prefetch
from django.utils.http import content_disposition_header

from .services.encryption import encrypt, decrypt
from .models import *

from .services.moodle_api import *
from .services.sync import *

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
            print(f"Token: {token}")  # Debugging line to print the token

            if not isinstance(token, str) or not token:
                raise ValueError("Invalid token")

            userid, first_name, last_name = get_user_info(token)

            if not userid:
                raise ValueError("Missing Moodle user ID")

        except Exception:
            return render(request, "login.html", {
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
            return render(request, "login.html", {
                "error": "Account conflict. Contact support."
            })

        

        try:
            sync_courses(student.userid)
            sync_grades(student.userid)
            sync_assignments(student.userid)
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
        return render(request, 'landing.html')
    else:
        gradebook = GradeBook.objects.filter(
            student_id=OuterRef("student_id"),
            course_id=OuterRef("course_id")
        )

        courses = (
            CourseEnrollment.objects
            .filter(student__user=request.user)
            .select_related("course")
            .annotate(
                earned_grade=Subquery(
                    gradebook.values("earned_grade")[:1]
                ),
                percentage=Subquery(
                    gradebook.values("percentage")[:1]
                )
            )
        )
        for i in courses:
            print(i.course.fullname)
        context = {
            'courses': courses,
            'student': Student.objects.get(user=request.user),
            'current_average': GradeBook.objects.filter(student__user=request.user).aggregate(average=Avg('percentage'))['average'],

        }
        return render(request, 'home.html', context)

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
            ),
            attendance=Subquery(
                AttendanceRecord.objects
                .filter(student=OuterRef("student"), session__module__course=OuterRef("course"), status="present")
                .values("points")[:1]
            
            )
            )
    # for item in course_enrollments:
    #     print(item.attendance)
    context = {
        'courses': course_enrollments,
        'student': Student.objects.get(user=request.user),
    }
    return render(request, 'courses.html', context)

def privacy(request):
    return render(request, 'privacy.html')

def terms(request):
    return render(request, 'terms.html')

def attendance(request):
    return render(request, 'attendance.html')

@login_required
def grades(request):
    context = {
        "grades": Grade.objects.all().select_related("grade")
    }
    print(Grade.objects.all().select_related("grade"))
    return render(request, 'grades.html', context)


def timetable(request):
    return render(request, 'timetable.html')

def assignments(request):
    return render(request, 'assignments.html', {
        'student': Student.objects.get(user=request.user),
    })

def profile(request):
    return render(request, 'profile.html', {
        'student': Student.objects.get(user=request.user),
    })

@login_required
def course_detail(request, course_id):
    course = Course.objects.get(courseid=course_id)
    sections = (
        CourseSection.objects
        .filter(course=course)
        .order_by("section_number")
        .prefetch_related(
            Prefetch(
                "modules",
                queryset=CourseModule.objects
                    .order_by("position")
                    .prefetch_related("files")
            )
        )
    )
    return render(request, 'course_detail.html', {
        'course': course,
        'student': Student.objects.get(user=request.user),
        'sections': sections,
        'grade': GradeBook.objects.get(student__user=request.user, course=course),
    })

def logout_view(request):
    logout(request)
    return redirect("/login/")

@login_required
def download_course_file(request, file_id):
    student = request.user.student

    file = get_object_or_404(
        CourseFile.objects.select_related("module__course"),
        pk=file_id,
    )

    if not CourseEnrollment.objects.filter(
        student=student,
        course=file.module.course,
    ).exists():
        return HttpResponse(status=403)

    parsed = urlparse(file.url)

    if (
        parsed.scheme != "https"
        or parsed.hostname != "edu.inha.uz"
        or not parsed.path.startswith("/webservice/pluginfile.php/")
    ):
        return HttpResponse("Invalid file URL", status=400)

    token = get_token(
        request.user.username,
        decrypt(student.enc_password),
    )

    try:
        response = requests.get(
            file.url,
            params={"token": token},
            stream=True,
            timeout=(10, 60),
            allow_redirects=False,
        )
        response.raise_for_status()

        if response.is_redirect:
            response.close()
            return HttpResponse("Unexpected redirect", status=502)

        content_type = response.headers.get(
            "Content-Type", "application/octet-stream"
        )

        if "application/json" in content_type:
            response.close()
            return HttpResponse(
                "Moodle refused the file download",
                status=502,
            )

    except requests.RequestException:
        return HttpResponse(
            "Unable to download file from Moodle",
            status=502,
        )

    filename = file.filename or unquote(
        PurePosixPath(parsed.path).name
    )

    def stream_file():
        try:
            for chunk in response.iter_content(chunk_size=65536):
                if chunk:
                    yield chunk
        finally:
            response.close()

    result = StreamingHttpResponse(
        stream_file(),
        content_type=content_type,
    )

    result["Content-Disposition"] = content_disposition_header(
        as_attachment=True,
        filename=filename,
    )

    return result
