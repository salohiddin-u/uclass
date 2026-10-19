from django.db import models

class Student(models.Model):
    user = models.OneToOneField("auth.User", on_delete=models.CASCADE)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    enc_password = models.TextField(null=True)
    consent_enabled = models.DateField()
    last_sync = models.DateTimeField(auto_now=True)
    userid = models.CharField(max_length=20, unique=True, null=True)

    def __str__(self):
        return f"{self.first_name} {self.last_name}"

class Course(models.Model):
    name = models.CharField(max_length=100)
    short_name = models.CharField(max_length=20)
    moodle_id = models.CharField(max_length=20, unique=True)

    def __str__(self):
        return f"{self.name} ({self.short_name})"

class CourseEnrollment(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="enrollments")
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="enrollments")

    def __str__(self):
        return f"{self.student} enrolled in {self.course}"

class CourseSection(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="sections")
    section_number = models.IntegerField()
    moodle_id = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=100)

    def __str__(self):
        return f"{self.course.name} - Section {self.section_number}"

class CourseModule(models.Model):
    course_section = models.ForeignKey(CourseSection, on_delete=models.CASCADE, related_name="items")
    name = models.CharField(max_length=100)
    moodle_id = models.CharField(max_length=20, unique=True)
    file_url = models.URLField(max_length=200, null=True, blank=True)
    module_type = models.CharField(max_length=50)

    def __str__(self):
        return f"{self.module_type}"

class AttendanceSession(models.Model):
    module = models.ForeignKey(CourseModule, on_delete=models.CASCADE, related_name="attendance_sessions")
    session_id = models.CharField(max_length=20)
    session_date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()


class AttendanceRecord(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="attendance_records")
    attendance_session = models.ForeignKey(AttendanceSession, on_delete=models.CASCADE, related_name="attendance_records")
    record_time = models.DateTimeField()
    status = models.CharField(max_length=20, choices=[("present", "Present"), ("absent", "Absent"), ("active", "Active")])
    point_value = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    point_possible = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    remarks = models.CharField(max_length=200, null=True, blank=True)

    def __str__(self):
        return f"{self.student} - {self.course_section} on {self.date}: {self.status}"

class Chat(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="chat_messages")
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.student} at {self.timestamp}: {self.message}"

class ChatFile(models.Model):
    file = models.FileField(upload_to="chat_files/")

    def __str__(self):
        return f"File: {self.file.name} for message: {self.chat_message.message}"

class ChatMessage(models.Model):
    message = models.TextField()
    output = models.TextField()
    file = models.ManyToManyField(ChatFile, related_name="chat_messages", blank=True)
    chat_message = models.ForeignKey(Chat, on_delete=models.CASCADE, related_name="chat")

    def __str__(self):
        return f"Message: {self.message}"

