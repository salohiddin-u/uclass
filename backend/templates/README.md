# Campus — separate HTML templates

A responsive Tailwind CSS student portal, with **example data written directly in HTML**. There is no JavaScript data array, API request, JSON data file, or client-side page renderer.

## Open the project

Open `index.html` in your browser. Compiled CSS, UI JavaScript, and sample downloads are local, so no CDN, npm installation, build step, or backend is needed to preview it.

For consistent browser storage and development, serve the folder:

```bash
python -m http.server 8000
```

Then visit http://localhost:8000.

## Pages

| File | Purpose |
| --- | --- |
| `index.html` | Dashboard with current grades, attendance, schedule, and course cards |
| `courses.html` | Search, filter, sort, save courses; grid and list modes |
| `course-detail.html` | Object-Oriented Programming course detail template |
| `course-database.html` | Database Systems sample detail page |
| `course-mathematics.html` | Discrete Mathematics sample detail page |
| `course-web.html` | Web Development sample detail page |
| `course-networks.html` | Computer Networks sample detail page |
| `course-english.html` | Academic English sample detail page |
| `grades.html` | All-course gradebook and grade comparisons |
| `attendance.html` | All-course attendance and session links |

Every page contains its own actual HTML content and uses ordinary links. There is no single-page router. Course detail tabs, file-preview dialogs, and assessments are prewritten in each HTML document.

## Shared assets

```text
assets/
  css/
    input.css       # Tailwind source and shared components
    styles.css      # Compiled CSS; ready to use
  js/
    ui.js           # UI interactions only
  files/
    *.md            # Sample notes and syllabi
    *.csv           # Sample practice datasets
```

`ui.js` handles menus, dark mode, DOM filtering/sorting, tabs, previews, CSV export, bookmarks, and completed-section preferences. Academic content and numbers originate in HTML. It does not construct course lists, fetch data, or calculate academic records. Exports read the visible HTML tables.

Theme, saved courses, and completed sections use browser local storage. These are demo preferences, not account-synced records. Without JavaScript, academic content still renders; course-detail sections are shown together.

## Edit styling

Edit the HTML classes or `assets/css/input.css`, then rebuild:

```bash
npm ci
npm run build:css
# Or while editing:
npm run watch:css
```

The Tailwind dependencies are development-only. The delivered pages load only `styles.css` and `ui.js`.

## Move into Django later

Suggested structure:

```text
your_app/
  templates/campus/
    base.html
    dashboard.html
    courses.html
    course_detail.html
    grades.html
    attendance.html
    includes/sidebar.html
    includes/topbar.html
  static/campus/
    css/styles.css
    js/ui.js
    files/
```

1. Extract the repeated `<head>`, sidebar, topbar, and footer into `base.html` and includes. Put the current `<main>` contents in a `{% block content %}`.
2. Load assets with Django static tags:

   ```django
   {% load static %}
   <link rel="stylesheet" href="{% static 'campus/css/styles.css' %}">
   <script src="{% static 'campus/js/ui.js' %}" defer></script>
   ```

3. Replace ordinary page links with your named Django URLs, for example `{% url 'campus:course_detail' course.pk %}`.
4. Replace the repeated course-card HTML and table rows with `{% for course in courses %}` loops. Use Django's normal autoescaped variables for displayed values. Keep data attributes used by filters, such as `data-grade`, in sync with those values.
5. Pass grades, attendance rates, policy thresholds, and summary totals from the Django view. Keep these calculations on the server. The present numbers are literal examples, not connected to a backend.
6. Use one `course_detail.html` template populated by the requested course. The six supplied static detail pages show how it looks with different example content.
7. After moving the templates, update the `@source` paths in `input.css` to point to your Django template directory before rebuilding Tailwind.

No Django application, authentication, database, or live Moodle integration is included at this stage.

## Example policies

- Current course grade: weighted average of graded assessments; ungraded work excluded.
- Overall grade: weighted by course credits.
- Attendance: present plus late, divided by recorded sessions.
- Attention threshold: 75% as an illustrative rule.
- Dates: fall 2026. Times: Asia/Tashkent.

Update the sample numbers, notes, and policy labels for your institution. Sample resource files are editable Markdown and CSV files, not official university documents.
