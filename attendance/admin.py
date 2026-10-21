from django.contrib import admin

from .models import *

# Register your models here.
admin.site.register(Student)
admin.site.register(Course)
admin.site.register(CourseSection)
admin.site.register(CourseModule)
admin.site.register(AttendanceSession)
admin.site.register(AttendanceRecord)
admin.site.register(Chat)
admin.site.register(ChatFile)
admin.site.register(ChatMessage)
admin.site.register(CourseEnrollment)