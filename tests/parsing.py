import truststore

truststore.inject_into_ssl()

import requests

import re

from bs4 import BeautifulSoup

from datetime import datetime

session = requests.Session()

response = session.get(
    "https://edu.inha.uz/login/index.php",
    timeout=20
)
response.raise_for_status()

soup = BeautifulSoup(response.text, "html.parser")

login_token = soup.select_one('input[name="logintoken"]').get('value')

session.post("https://edu.inha.uz/login/index.php", data={
    "username": "",
    "password": "",
    "logintoken": login_token
})

# print(login.text)
response = session.get(
    "https://edu.inha.uz/mod/attendance/view.php",
    params={
        "id": 1553,
        "mode": 2,
        "sesscourses": "all",
        "view": 5,
    }
)

response.raise_for_status()

soup = BeautifulSoup(response.text, "html.parser")
rows = soup.select("tr")
# print(rows)
for row in rows:
    date_text = row.select_one("td.colcourse").get_text(" ", strip=True) if row.select_one("td.desccol") else "N/A"
    date_split = date_text.split(" ", 1)
    text = date_split[1] if len(date_split) > 1 else "N/A"
    text = text.replace("Sept", "Sep")
    date = re.search(
        r"(\d{1,2} \w+ \d{4}) (\d{1,2}(?::\d{2})?[AP]M)",
        text
    )
    date = date if date else re.search(
        r"(\d{1,2} \w+ \d{4})",
        text
    )

    time = re.search(
        r"(\d{1,2}(?::\d{2})?[AP]M)",
        text
    )
    print("Date:", datetime.strptime(date.group(1), "%d %b %Y").date() if date else "N/A")


    status = row.select_one("td.desccol").get_text(strip=True) if row.select_one("td.desccol") else "N/A"

session.close()