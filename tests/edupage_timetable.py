"""Public EduPage timetable (iut.edupage.org) -> weekly lessons for one class.

No login is needed for the public timetable. Fetch it once or twice a day and cache it.
Output matches next_class.py:  {"weekday", "start", "end", "subject", "room", ...}
"""
import json
import requests

URL = "https://iut.edupage.org/timetable/server/regulartt.js?__func=regularttGetData"
VERSION = "145"          # timetable version seen in the page's request; it changes when the school publishes a new one


def fetch_raw(version=VERSION, timeout=20):
    payload = {"__args": [None, version], "__gsh": "00000000"}
    r = requests.post(URL, json=payload, timeout=timeout)
    r.raise_for_status()
    return r.json()


def _tables(raw):
    root = raw["r"] if "r" in raw else raw
    return {t["id"]: {row["id"]: row for row in t["data_rows"]}
            for t in root["dbiAccessorRes"]["tables"]}


def list_classes(raw):
    """[(class_id, name)] for a 'choose your class' dropdown."""
    t = _tables(raw)
    return sorted(((i, r["name"]) for i, r in t["classes"].items()), key=lambda x: x[1])


def class_groups(raw, class_id):
    """[(group_id, name, is_entire_class)] so a student can pick Group 1, Group 2, ..."""
    t = _tables(raw)
    return [(i, r["name"], r["entireclass"]) for i, r in t["groups"].items() if r["classid"] == class_id]


def weekly_lessons(raw, class_id, group_ids=()):
    """Lessons of the class for the whole week. Entire-class lessons are always included;
    group_ids adds the student's own groups (for example 'Group 1')."""
    t = _tables(raw)
    allowed = {i for i, r in t["groups"].items() if r["classid"] == class_id and r["entireclass"]} | set(group_ids)
    by_period = {int(r["period"]): r for r in t["periods"].values()}
    out = []
    for les in t["lessons"].values():
        if class_id not in les["classids"] or not (set(les["groupids"]) & allowed):
            continue
        subj = t["subjects"].get(les["subjectid"], {})
        teachers = ", ".join(t["teachers"][x]["short"] for x in les["teacherids"] if x in t["teachers"])
        for card in (c for c in t["cards"].values() if c["lessonid"] == les["id"]):
            if not str(card["period"]).isdigit():
                continue                                           # lesson not placed in the week yet
            first = int(card["period"])
            last = first + int(les["durationperiods"]) - 1
            if first not in by_period or last not in by_period:
                continue                                           # period outside the bell schedule
            room = ", ".join(t["classrooms"][x]["short"] for x in card["classroomids"] if x in t["classrooms"])
            for weekday, flag in enumerate(card["days"]):
                if flag == "1":
                    out.append({"weekday": weekday, "start": by_period[first]["starttime"],
                                "end": by_period[last]["endtime"], "subject": subj.get("short", "?"),
                                "subject_name": subj.get("name", ""), "teacher": teachers, "room": room})
    return sorted(out, key=lambda x: (x["weekday"], x["start"]))


if __name__ == "__main__":
    import sys
    from datetime import datetime
    from next_class import next_class, TZ
    raw = json.load(open(sys.argv[1], encoding="utf-8"))
    classes = dict(list_classes(raw))
    cid = next(i for i, n in classes.items() if n == "CIE26-1")
    lessons = weekly_lessons(raw, cid)
    print(len(classes), "classes;", len(lessons), "weekly lessons for CIE26-1")
    # checks against the public page you showed me
    mo = [l for l in lessons if l["weekday"] == 0]
    assert (mo[0]["start"], mo[0]["end"], mo[0]["subject"], mo[0]["room"]) == ("08:00", "09:30", "AE1", "A308")
    th = [l for l in lessons if l["weekday"] == 3 and l["subject"] == "Mental Education"][0]
    assert (th["start"], th["end"], th["room"]) == ("11:00", "12:00", "B304 Conf")
    assert len(lessons) == 13
    nxt = next_class(lessons, datetime(2026, 10, 21, 10, 0, tzinfo=TZ))     # Wednesday 10:00
    print("Wed 10:00 ->", nxt["subject"], nxt["start"], nxt["room"], "(in progress)" if nxt["in_progress"] else "")
    nxt = next_class(lessons, datetime(2026, 10, 21, 14, 0, tzinfo=TZ))     # Wednesday 14:00
    print("Wed 14:00 ->", nxt["subject"], nxt["start_dt"].strftime("%a %H:%M"), nxt["room"])
    print("groups of CIE26-1:", [g[1] for g in class_groups(raw, cid)])
    print("all checks ok")
