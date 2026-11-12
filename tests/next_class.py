"""Next class from a weekly timetable (the same shape EduPage-style data reduces to).

lessons = [{"weekday": 0, "start": "16:00", "end": "18:00", "subject": "OS", "room": "B304"}, ...]
weekday: Monday=0 ... Sunday=6. Times are local (Asia/Tashkent).
"""
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

TZ = ZoneInfo("Asia/Tashkent")


def _at(day, hhmm):
    h, m = map(int, hhmm.split(":"))
    return datetime.combine(day, time(h, m), TZ)


def next_class(lessons, now=None, days_ahead=14):
    """Returns the lesson in progress, or the next one to start, with its datetimes."""
    now = (now or datetime.now(TZ)).astimezone(TZ)
    for offset in range(days_ahead + 1):
        day = (now + timedelta(days=offset)).date()
        todays = sorted((l for l in lessons if l["weekday"] == day.weekday()), key=lambda l: l["start"])
        for l in todays:
            start, end = _at(day, l["start"]), _at(day, l["end"])
            if end <= now:
                continue                                  # already finished
            return {**l, "start_dt": start, "end_dt": end, "in_progress": start <= now,
                    "minutes_until": max(0, int((start - now).total_seconds() // 60))}
    return None


if __name__ == "__main__":
    plan = [{"weekday": 2, "start": "16:00", "end": "18:00", "subject": "OS", "room": "B304"},
            {"weekday": 3, "start": "16:00", "end": "18:00", "subject": "Math", "room": "A101"}]
    wed_3pm = datetime(2026, 10, 21, 15, 0, tzinfo=TZ)            # a Wednesday
    assert next_class(plan, wed_3pm)["subject"] == "OS" and next_class(plan, wed_3pm)["minutes_until"] == 60
    wed_5pm = datetime(2026, 10, 21, 17, 0, tzinfo=TZ)
    assert next_class(plan, wed_5pm)["in_progress"] is True
    wed_7pm = datetime(2026, 10, 21, 19, 0, tzinfo=TZ)
    assert next_class(plan, wed_7pm)["subject"] == "Math"          # tomorrow
    fri = datetime(2026, 10, 23, 10, 0, tzinfo=TZ)
    assert next_class(plan, fri)["start_dt"].date().isoformat() == "2026-10-28"   # next Wednesday
    print("next_class tests ok")
