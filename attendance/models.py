from django.db import models

class Student(models.Model):
    user = models.OneToOneField("auth.User", on_delete=models.CASCADE)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    enc_password = models.TextField(blank=True)
    consent_enabled = models.DateTimeField(null=True, blank=True)
    last_sync = models.DateTimeField()
    userid = models.CharField(max_length=20, unique=True, null=True)

    def __str__(self):
        return f"{self.first_name} {self.last_name}"

class Course(models.Model):
    fullname = models.CharField(max_length=250)
    categoryname = models.CharField(max_length=20, null=True, blank=True)
    shortname = models.CharField(max_length=100, null=True, blank=True)
    courseid = models.IntegerField(unique=True, null=True, blank=True)
    professor = models.CharField(max_length=250)

    def __str__(self):
        return f"{self.fullname} ({self.categoryname})"

class CourseEnrollment(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="enrollments")
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="enrollments")

    def __str__(self):
        return f"{self.student} enrolled in {self.course}"

class CourseSection(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="sections")
    section_number = models.IntegerField()
    moodle_id = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=250)

    def __str__(self):
        return f"{self.name} - Section {self.section_number}"

class CourseModule(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="modules")
    section = models.ForeignKey(CourseSection, on_delete=models.CASCADE, related_name="modules")
    cmid = models.IntegerField(unique=True)                 
    instance = models.IntegerField(null=True, blank=True)   
    modname = models.CharField(max_length=250)
    name = models.CharField(max_length=255)
    url = models.URLField(max_length=500, blank=True)
    description = models.TextField(blank=True)
    position = models.IntegerField(default=0)
    opened_at = models.DateTimeField(null=True, blank=True)
    due_at = models.DateTimeField(null=True, blank=True)
    last_seen_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["position"]

        
class CourseFile(models.Model):
    module = models.ForeignKey(CourseModule, on_delete=models.CASCADE, related_name="files")
    filename = models.CharField(max_length=255)
    size = models.BigIntegerField(default=0)
    mimetype = models.CharField(max_length=250, blank=True)
    author = models.CharField(max_length=250, blank=True)
    modified = models.DateTimeField(null=True, blank=True)
    url = models.TextField()  

    def __str__(self):
        return f"Content for {self.module.name}: {self.url}"

class AttendanceSession(models.Model):
    module = models.ForeignKey(CourseModule, on_delete=models.CASCADE, related_name="attendance_sessions")
    session_id = models.CharField(max_length=20)
    session_date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()


class AttendanceRecord(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="attendance_records")
    session = models.ForeignKey(AttendanceSession, on_delete=models.CASCADE, related_name="attendance_records")
    record_time = models.DateTimeField()
    status = models.CharField(max_length=20, choices=[("present", "Present"), ("absent", "Absent"), ("active", "Active")])
    points = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    points_possible = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    remarks = models.CharField(max_length=200, null=True, blank=True)
    self_recorded = models.BooleanField(default=False)

    class Meta:
        unique_together = ("student", "session")

    def __str__(self):
        return f"{self.student} - {self.session} on {self.record_time}: {self.status}"

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

