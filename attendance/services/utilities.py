import re
from datetime import datetime, timezone as dt_timezone

def normalize_group(name):
    match = re.fullmatch(
        r"([A-Za-z]+)-?(\d{2})-(\d+)",
        name.strip()
    )

    if not match:
        return None

    program, year, number = match.groups()

    return f"{program.upper()}{year}-{int(number)}"



def to_datetime(timestamp):
    if timestamp is None or timestamp == 0:
        return None
    return datetime.fromtimestamp(timestamp, tz=dt_timezone.utc)