import requests
from bs4 import BeautifulSoup

BASE_URL = "https://edu.inha.uz"


def moodle_login(username, password):
    session = requests.Session()

    response = session.get(
        f"{BASE_URL}/login/index.php",
        timeout=20,
    )
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")

    token_input = soup.select_one(
        'input[name="logintoken"]'
    )

    if token_input is None:
        raise RuntimeError("Moodle login token not found")

    login_token = token_input.get("value", "")

    response = session.post(
        f"{BASE_URL}/login/index.php",
        data={
            "username": username,
            "password": password,
            "logintoken": login_token,
        },
        timeout=20,
    )
    response.raise_for_status()

    if "/login/index.php" in response.url:
        raise RuntimeError("Moodle browser login failed")

    return session


def get_attendance_page(session, cmid):
    response = session.get(
        "https://edu.inha.uz/mod/attendance/view.php",
        params={
            "id": cmid,
            "mode": 2,
            "sesscourses": "all",
            "view": 5,
        },
        timeout=20,
    )

    response.raise_for_status()

    return BeautifulSoup(response.text, "html.parser")

