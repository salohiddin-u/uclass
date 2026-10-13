# Attendance tracker for edu.inha.uz (unofficial)

## Setup
    pip install django cryptography beautifulsoup4 lxml requests
    # PowerShell:
    $env:FIELD_ENCRYPTION_KEY = python -c "from cryptography.fernet import Fernet;print(Fernet.generate_key().decode())"
    python manage.py migrate
    python manage.py runserver

Keep FIELD_ENCRYPTION_KEY the same between runs and OUT of Git and database backups.
If you lose it, stored passwords become unreadable and students must log in again.

## Background sync (every 3 hours)
    python manage.py sync_all
Run it with Windows Task Scheduler or cron (`0 */3 * * *`).

## Before production
- DEBUG=False, own DJANGO SECRET_KEY, HTTPS (cookies are secure when DEBUG is off)
- Use PostgreSQL and a shared cache (Redis) so login lockout works across workers
- Do not log request bodies; keep the privacy notice in templates/tracker/login.html accurate
- Optional: MIN_ATTENDANCE_PERCENT env var turns on a "below required level" flag
- Tests: python manage.py test tracker   (fake Moodle, never touches the real server)
- Planner math tests: node tracker/static/tracker/app.test.js
- Static files: run `python manage.py collectstatic` and serve /static/ with your web server in production

## Data layout
Shared (no personal data): Course, AttendanceModule, Session.
Per student: Enrollment, SummarySnapshot, SessionRecord, SessionChange.
Deleting a student removes only their rows; shared rows stay for classmates.
