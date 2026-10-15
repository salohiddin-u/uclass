/* uclass.uz frontend demo. All records are synthetic; no API or backend is used. */
(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [
    ...root.querySelectorAll(selector),
  ];
  const escapeHTML = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[character],
    );
  const icon = (name) => `<i data-lucide="${name}" aria-hidden="true"></i>`;
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const mobileQuery = window.matchMedia("(max-width: 760px)");
  const statusColors = {
    Present: "#77b7a1",
    Active: "#8c85ec",
    Late: "#e2bb72",
    Absent: "#e2959d",
    Unrecorded: "#c6cbd8",
  };
  const courseColors = {
    violet: "#8c85ec",
    blue: "#82a8e1",
    amber: "#dfb76f",
    green: "#7bb8a3",
  };
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const offsetDate = (days) => {
    const result = new Date(today);
    result.setDate(result.getDate() + days);
    return result;
  };
  const dateText = (date, options = { month: "short", day: "numeric" }) =>
    new Intl.DateTimeFormat("en", options).format(date);
  const storage = {
    get(key) {
      try {
        return localStorage.getItem(`uclass-${key}`);
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(`uclass-${key}`, value);
      } catch {
        /* Private/file browser policies may restrict storage. */
      }
    },
  };

  /* Single mock-data boundary: replace this object when integrating real records.
     Points scores are independent of session completion and unknown records. */
  const mockData = {
    courses: [
      {
        id: "math",
        title: "Math (Calculus)-1",
        code: "MATH 101",
        icon: "sigma",
        color: "violet",
        points: 48,
        possible: 50,
        completed: 24,
        total: 32,
        schedule: "Mon · Wed · Fri",
      },
      {
        id: "programming",
        title: "Programming concepts and application development-1",
        code: "CS 102",
        icon: "code-xml",
        color: "blue",
        points: 46,
        possible: 50,
        completed: 22,
        total: 32,
        schedule: "Tue · Thu",
      },
      {
        id: "os",
        title: "Operating System",
        code: "CS 204",
        icon: "monitor",
        color: "amber",
        points: 44,
        possible: 50,
        completed: 21,
        total: 30,
        schedule: "Mon · Thu",
      },
      {
        id: "english",
        title: "English",
        code: "ENG 101",
        icon: "languages",
        color: "green",
        points: 47,
        possible: 50,
        completed: 24,
        total: 30,
        schedule: "Wed · Fri",
      },
    ],
    attendance: [
      {
        course: "math",
        days: 0,
        status: "Present",
        points: 2,
        remarks: "On time",
      },
      {
        course: "programming",
        days: 0,
        status: "Active",
        points: 2,
        remarks: "Participated",
      },
      {
        course: "os",
        days: -1,
        status: "Late",
        points: 1,
        remarks: "Arrived late",
      },
      {
        course: "english",
        days: -1,
        status: "Present",
        points: 2,
        remarks: "On time",
      },
      {
        course: "math",
        days: -2,
        status: "Unrecorded",
        points: null,
        remarks: "Not yet recorded",
      },
      {
        course: "os",
        days: -2,
        status: "Absent",
        points: 0,
        remarks: "No attendance",
      },
      {
        course: "programming",
        days: -3,
        status: "Present",
        points: 2,
        remarks: "On time",
      },
      {
        course: "english",
        days: -3,
        status: "Active",
        points: 2,
        remarks: "Participated",
      },
    ],
    assignments: [
      {
        id: "derivatives",
        course: "math",
        title: "Derivatives & applications",
        type: "Problem set",
        days: 1,
        status: "Not submitted",
        description:
          "Practice the chain rule, implicit differentiation, and real-world rate-of-change problems. This is a sample assignment for exploring the dashboard.",
      },
      {
        id: "task-manager",
        course: "programming",
        title: "Build a task manager",
        type: "Project",
        days: 3,
        status: "In progress",
        description:
          "Explore a sample programming project: design a simple task manager with add, edit, and complete actions. This preview has no submission service.",
      },
      {
        id: "scheduling",
        course: "os",
        title: "Process scheduling quiz",
        type: "Quiz",
        days: 5,
        status: "Not submitted",
        description:
          "An example quiz covering first-come-first-served, shortest-job-first, and round-robin scheduling. The quiz is not connected to a learning platform.",
      },
    ],
    // Daily counts for the illustrative chart, not official attendance percentages.
    trend: Array.from({ length: 90 }, (_, index) => ({
      date: offsetDate(index - 89),
      Present: 2 + Math.floor((Math.sin(index * 1.3) + 1) * 1.5),
      Active: 1 + Number(index % 4 === 0),
      Late: Number(index % 5 === 0),
      Absent: Number(index % 13 === 0),
      Unrecorded: Number(index % 9 === 0),
    })),
  };
  const getCourse = (id) => mockData.courses.find((course) => course.id === id);
  const score = (course) => Math.round((course.points / course.possible) * 100);
  const state = {
    range: 30,
    search: "",
    attendanceSearch: "",
    course: "all",
    status: "all",
    syncing: false,
  };
  let trendChart;
  let distributionChart;
  let toastTimer;
  let lastDialogTrigger;
  let drawerTrigger;

  function renderIcons() {
    if (window.lucide) window.lucide.createIcons();
  }

  function renderStats() {
    const earned = mockData.courses.reduce(
      (sum, course) => sum + course.points,
      0,
    );
    const possible = mockData.courses.reduce(
      (sum, course) => sum + course.possible,
      0,
    );
    const stats = [
      {
        label: "Overall Attendance",
        value: ((earned / possible) * 100).toFixed(1),
        suffix: "%",
        icon: "chart-no-axes-combined",
        color: "violet",
        note: `${earned}/${possible} sample points`,
        lead: "Points-based",
        noteIcon: "circle-check",
      },
      {
        label: "Active Courses",
        value: mockData.courses.length,
        suffix: "",
        icon: "book-open",
        color: "blue",
        note: "Current semester",
        lead: "4 enrolled",
        noteIcon: "circle-check",
      },
      {
        label: "Classes Attended",
        value: mockData.courses.reduce(
          (sum, course) => sum + course.completed,
          0,
        ),
        suffix: "",
        icon: "calendar-check-2",
        color: "green",
        note: "Sample sessions",
        lead: "Keep it up",
        noteIcon: "trending-up",
      },
      {
        label: "Upcoming Deadlines",
        value: mockData.assignments.length,
        suffix: "",
        icon: "clipboard-list",
        color: "amber",
        note: "Example deadline",
        lead: "1 tomorrow",
        noteIcon: "clock-3",
      },
    ];
    $("#stats").innerHTML = stats
      .map(
        (item, index) =>
          `<article class="stat-card reveal" style="--delay:${80 + index * 40}ms"><div class="stat-top"><h2 class="stat-label">${item.label}</h2><span class="colored-icon ${item.color}">${icon(item.icon)}</span></div><p class="stat-value">${item.value}<span>${item.suffix}</span></p><p class="stat-bottom">${icon(item.noteIcon)}<span class="stat-note"><b>${item.lead}</b> · ${item.note}</span></p></article>`,
      )
      .join("");
  }

  function renderCourses() {
    const courses = mockData.courses.filter((course) =>
      `${course.title} ${course.code}`.toLowerCase().includes(state.search),
    );
    $("#course-grid").innerHTML = courses
      .map(
        (course, index) =>
          `<article class="course-card"><div class="course-card-top"><span class="colored-icon ${course.color}">${icon(course.icon)}</span><span class="course-code">${course.code}</span></div><h3>${escapeHTML(course.title)}</h3><p class="course-schedule">${icon("calendar-days")}${course.schedule}</p><div class="course-progress-heading"><span>Attendance score</span><strong>${score(course)}%</strong></div><div class="progress-track" role="meter" aria-label="${escapeHTML(course.title)} sample attendance score" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${score(course)}"><div class="progress-fill" style="--progress:${score(course)}%;--bar-color:${courseColors[course.color]};--delay:${index * 80}ms"></div></div><div class="course-card-bottom"><span>${course.completed} / ${course.total} sessions completed</span><button class="text-button" data-course="${course.id}" aria-label="View details for ${escapeHTML(course.title)}">View details ${icon("arrow-up-right")}</button></div></article>`,
      )
      .join("");
    $("#course-empty").hidden = courses.length > 0;
    return courses.length;
  }

  function matchingAttendance() {
    return mockData.attendance.filter((row) => {
      const course = getCourse(row.course);
      const text =
        `${course.title} ${course.code} ${row.status} ${row.remarks} ${dateText(offsetDate(row.days))}`.toLowerCase();
      return (
        (state.course === "all" || row.course === state.course) &&
        (state.status === "all" || row.status === state.status) &&
        text.includes(state.search) &&
        text.includes(state.attendanceSearch)
      );
    });
  }

  function renderAttendance() {
    const rows = matchingAttendance();
    $("#attendance-rows").innerHTML = rows
      .map((row) => {
        const course = getCourse(row.course);
        return `<tr><td data-label="Course"><div class="table-course"><span class="colored-icon ${course.color}">${icon(course.icon)}</span><span><strong>${escapeHTML(course.title)}</strong><small>${course.code}</small></span></div></td><td data-label="Date">${dateText(offsetDate(row.days))}</td><td data-label="Status"><span class="status-badge status-${row.status.toLowerCase()}"><span aria-hidden="true"></span>${row.status}</span></td><td data-label="Points">${row.points === null ? '<span aria-label="Not recorded">—</span>' : `${row.points}<span class="points-max"> / 2</span>`}</td><td data-label="Remarks">${row.remarks}</td></tr>`;
      })
      .join("");
    $("#attendance-empty").hidden = rows.length > 0;
    $(".attendance-table-wrap").hidden = rows.length === 0;
    $("#record-count").textContent =
      `Showing ${rows.length} of ${mockData.attendance.length} records`;
    return rows.length;
  }

  function renderAssignments() {
    const items = mockData.assignments.filter((item) =>
      `${item.title} ${getCourse(item.course).title} ${item.type} ${item.status}`
        .toLowerCase()
        .includes(state.search),
    );
    $("#assignment-list").innerHTML = items.length
      ? items
          .map((item) => {
            const course = getCourse(item.course);
            return `<button class="assignment-item" data-assignment="${item.id}" aria-label="View example assignment: ${escapeHTML(item.title)}"><span class="assignment-course"><span class="key-dot" style="--bar-color:${courseColors[course.color]}" aria-hidden="true"></span>${escapeHTML(course.title)}</span><span class="assignment-title">${escapeHTML(item.title)}${icon("arrow-up-right")}</span><span class="assignment-meta"><span class="deadline ${item.days === 1 ? "urgent" : ""}">${icon("clock-3")}${item.days === 1 ? "Tomorrow" : dateText(offsetDate(item.days))} · ${item.type}</span><span class="submission-badge ${item.status === "In progress" ? "in-progress" : ""}">${item.status}</span></span></button>`;
          })
          .join("")
      : '<div class="empty-state"><h3>No matching assignments</h3><p>Try another search.</p><button class="text-button clear-search">Clear search</button></div>';
    return items.length;
  }

  function renderSearchResults() {
    const courses = renderCourses();
    const rows = renderAttendance();
    const assignments = renderAssignments();
    $("#search-feedback").hidden = !state.search;
    $("#search-feedback").textContent =
      `${courses} courses, ${rows} attendance records, and ${assignments} assignments match “${$("#global-search").value}”.`;
    renderIcons();
  }

  function chartData() {
    const days = mockData.trend.slice(-state.range);
    const totals = Object.keys(statusColors).map((status) =>
      days.reduce((sum, day) => sum + day[status], 0),
    );
    return { days, totals };
  }

  function chartTheme() {
    const computed = getComputedStyle(document.documentElement);
    return {
      text: computed.getPropertyValue("--muted").trim(),
      grid: computed.getPropertyValue("--border").trim(),
      surface: computed.getPropertyValue("--surface").trim(),
      ink: computed.getPropertyValue("--ink").trim(),
    };
  }

  function renderChartSummary() {
    const { totals } = chartData();
    $("#session-total").textContent = totals.reduce(
      (sum, value) => sum + value,
      0,
    );
    $("#distribution-period").textContent =
      `${state.range === 90 ? "Sample semester" : `Last ${state.range} days`} · sample sessions`;
    $("#distribution-legend").innerHTML = Object.keys(statusColors)
      .map(
        (status, index) =>
          `<li><span class="key-dot" style="background:${statusColors[status]}" aria-hidden="true"></span><span>${status}</span><b>${totals[index]}</b></li>`,
      )
      .join("");
    $("#distribution-chart").setAttribute(
      "aria-label",
      `Sample distribution: ${Object.keys(statusColors)
        .map((status, i) => `${status}: ${totals[i]}`)
        .join(", ")}`,
    );
  }

  function initializeCharts() {
    renderChartSummary();
    if (!window.Chart) {
      $(".chart-fallback").hidden = false;
      $("#attendance-chart").hidden = true;
      $("#distribution-chart").hidden = true;
      return;
    }
    const theme = chartTheme();
    const { days, totals } = chartData();
    Chart.defaults.font.family = "Inter, system-ui, sans-serif";
    Chart.defaults.color = theme.text;
    trendChart = new Chart($("#attendance-chart"), {
      type: "line",
      data: {
        labels: days.map((day) => dateText(day.date)),
        datasets: Object.entries(statusColors).map(
          ([status, color], index) => ({
            label: status,
            data: days.map((day) => day[status]),
            borderColor: color,
            backgroundColor: `${color}16`,
            fill: index < 2,
            borderWidth: index < 2 ? 2 : 1.3,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointHitRadius: 12,
            tension: 0.38,
          }),
        ),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: motionQuery.matches ? 0 : 650 },
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: theme.surface,
            titleColor: theme.ink,
            bodyColor: theme.text,
            borderColor: theme.grid,
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8,
            boxPadding: 4,
            titleFont: { size: 11 },
            bodyFont: { size: 10 },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              maxTicksLimit: 7,
              maxRotation: 0,
              font: { size: 9 },
              color: theme.text,
            },
          },
          y: {
            beginAtZero: true,
            suggestedMax: 6,
            grid: { color: theme.grid, drawTicks: false },
            border: { display: false },
            ticks: {
              stepSize: 2,
              padding: 8,
              font: { size: 9 },
              color: theme.text,
            },
            title: { display: false },
          },
        },
      },
    });
    distributionChart = new Chart($("#distribution-chart"), {
      type: "doughnut",
      data: {
        labels: Object.keys(statusColors),
        datasets: [
          {
            data: totals,
            backgroundColor: Object.values(statusColors),
            borderWidth: 4,
            borderColor: theme.surface,
            borderRadius: 3,
            hoverOffset: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "77%",
        animation: { duration: motionQuery.matches ? 0 : 800 },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: theme.surface,
            bodyColor: theme.ink,
            titleColor: theme.ink,
            borderColor: theme.grid,
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: (context) => ` ${context.label}: ${context.raw} sessions`,
            },
          },
        },
      },
    });
  }

  function updateCharts() {
    renderChartSummary();
    if (!trendChart) return;
    const { days, totals } = chartData();
    const theme = chartTheme();
    trendChart.data.labels = days.map((day) => dateText(day.date));
    trendChart.data.datasets.forEach((dataset) => {
      dataset.data = days.map((day) => day[dataset.label]);
    });
    for (const axis of ["x", "y"])
      trendChart.options.scales[axis].ticks.color = theme.text;
    trendChart.options.scales.y.grid.color = theme.grid;
    for (const chart of [trendChart, distributionChart]) {
      Object.assign(chart.options.plugins.tooltip, {
        backgroundColor: theme.surface,
        titleColor: theme.ink,
        bodyColor: theme.text,
        borderColor: theme.grid,
      });
      chart.options.animation.duration = motionQuery.matches ? 0 : 450;
    }
    distributionChart.data.datasets[0].data = totals;
    distributionChart.data.datasets[0].borderColor = theme.surface;
    trendChart.update(motionQuery.matches ? "none" : undefined);
    distributionChart.update(motionQuery.matches ? "none" : undefined);
  }

  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    $("#theme-preference").value = theme;
    $("#theme-toggle").setAttribute(
      "aria-label",
      `Switch to ${theme === "dark" ? "light" : "dark"} theme`,
    );
    $("#theme-toggle").innerHTML = icon(theme === "dark" ? "sun" : "moon");
    storage.set("theme", theme);
    if (trendChart) updateCharts();
    renderIcons();
  }

  function toast(message) {
    clearTimeout(toastTimer);
    $("#toast-region").innerHTML =
      `<div class="toast">${icon("circle-check")}<span>${escapeHTML(message)}</span></div>`;
    renderIcons();
    toastTimer = setTimeout(() => {
      $("#toast-region").replaceChildren();
    }, 5000);
  }

  function toggleDropdown(id, force) {
    const menu = $(`#${id}-menu`);
    const toggle = $(`#${id}-toggle`);
    const shouldOpen = force === undefined ? menu.hidden : force;
    closeDropdowns();
    if (shouldOpen) {
      menu.hidden = false;
      toggle.setAttribute("aria-expanded", "true");
    }
  }
  function closeDropdowns() {
    for (const id of ["notifications", "profile"]) {
      $(`#${id}-menu`).hidden = true;
      $(`#${id}-toggle`).setAttribute("aria-expanded", "false");
    }
  }

  function openDialog(id, trigger) {
    closeDropdowns();
    lastDialogTrigger = trigger;
    closeDrawer(false);
    $(`#${id}`).showModal();
  }

  function courseDetails(id, trigger) {
    const course = getCourse(id);
    $("#course-detail-content").innerHTML =
      `<h2 id="course-dialog-title">${escapeHTML(course.title)}</h2><p class="dialog-description">${course.code} · ${course.schedule}</p><p class="detail-score">${score(course)}%</p><p class="dialog-description">Sample points-based attendance score</p><div class="detail-grid"><div><strong>${course.points} / ${course.possible}</strong><span>Recorded attendance points</span></div><div><strong>${course.completed} / ${course.total}</strong><span>Completed sessions</span></div></div><p class="dialog-description">This score uses recorded points, not the ratio of sessions attended. Unrecorded sessions are unknown and excluded from scoring. These are synthetic values, not university records.</p>`;
    openDialog("course-dialog", trigger);
  }

  function assignmentDetails(id, trigger) {
    const assignment = mockData.assignments.find((item) => item.id === id);
    $("#assignment-detail-content").innerHTML =
      `<h2 id="assignment-dialog-title">${escapeHTML(assignment.title)}</h2><p class="dialog-description">${escapeHTML(getCourse(assignment.course).title)} · ${assignment.type}</p><div class="detail-grid"><div><strong>${dateText(offsetDate(assignment.days))}</strong><span>Example due date</span></div><div><strong>${assignment.status}</strong><span>Sample submission status</span></div></div><p class="dialog-description">${assignment.description}</p><p class="dialog-description">Preview only. Real deadlines and submission actions require a future university integration.</p>`;
    openDialog("assignment-dialog", trigger);
  }

  function closeDrawer(restoreFocus = true) {
    const wasOpen = document.body.classList.contains("drawer-open");
    document.body.classList.remove("drawer-open");
    $("#drawer-backdrop").hidden = true;
    $("#mobile-menu").setAttribute("aria-expanded", "false");
    $(".page-shell").inert = false;
    $("#sidebar").inert = mobileQuery.matches;
    if (wasOpen && restoreFocus) drawerTrigger?.focus();
  }
  function openDrawer() {
    drawerTrigger = document.activeElement;
    document.body.classList.add("drawer-open");
    $("#drawer-backdrop").hidden = false;
    $("#mobile-menu").setAttribute("aria-expanded", "true");
    $("#sidebar").inert = false;
    $(".page-shell").inert = true;
    $(".brand").focus();
  }

  function syncDemo() {
    if (state.syncing) return;
    state.syncing = true;
    document.body.classList.add("syncing");
    $("#refresh-button").disabled = true;
    $("#refresh-button").setAttribute("aria-busy", "true");
    $("#refresh-button span").textContent = "Simulating…";
    $("#sync-message").textContent =
      "Simulating a refresh. No data is being fetched.";
    setTimeout(
      () => {
        state.syncing = false;
        document.body.classList.remove("syncing");
        $("#refresh-button").disabled = false;
        $("#refresh-button").removeAttribute("aria-busy");
        $("#refresh-button span").textContent = "Refresh demo";
        const synced = new Date();
        const timestamp = dateText(synced, {
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
        });
        $("#sync-message").textContent =
          `Last demo refresh: ${timestamp}. Sample records unchanged; no live connection.`;
        toast("Demo refresh complete. No university data was fetched.");
      },
      motionQuery.matches ? 600 : 1600,
    );
  }

  function wireEvents() {
    $("#global-search").addEventListener("input", (event) => {
      state.search = event.target.value.trim().toLowerCase();
      renderSearchResults();
    });
    $("#attendance-search").addEventListener("input", (event) => {
      state.attendanceSearch = event.target.value.trim().toLowerCase();
      renderAttendance();
      renderIcons();
    });
    $("#course-filter").addEventListener("change", (event) => {
      state.course = event.target.value;
      renderAttendance();
      renderIcons();
    });
    $("#status-filter").addEventListener("change", (event) => {
      state.status = event.target.value;
      renderAttendance();
      renderIcons();
    });
    $("#reset-filters").addEventListener("click", () => {
      state.course = state.status = "all";
      state.attendanceSearch = state.search = "";
      $("#course-filter").value = $("#status-filter").value = "all";
      $("#attendance-search").value = $("#global-search").value = "";
      renderSearchResults();
    });
    $$("[data-range]").forEach((button) =>
      button.addEventListener("click", () => {
        state.range = Number(button.dataset.range);
        $$("[data-range]").forEach((item) => {
          item.classList.toggle("selected", item === button);
          item.setAttribute("aria-pressed", String(item === button));
        });
        updateCharts();
      }),
    );
    $("#theme-toggle").addEventListener("click", () =>
      setTheme(
        document.documentElement.dataset.theme === "dark" ? "light" : "dark",
      ),
    );
    $("#theme-preference").addEventListener("change", (event) =>
      setTheme(event.target.value),
    );
    $("#compact-preference").addEventListener("change", (event) => {
      document.body.classList.toggle("compact-records", event.target.checked);
      storage.set("compact", String(event.target.checked));
    });
    $("#collapse-sidebar").addEventListener("click", () => {
      const collapsed = document.body.classList.toggle("sidebar-collapsed");
      $("#collapse-sidebar").setAttribute(
        "aria-label",
        `${collapsed ? "Expand" : "Collapse"} sidebar`,
      );
      $("#collapse-sidebar").setAttribute("aria-expanded", String(!collapsed));
      $("#collapse-sidebar span").textContent = collapsed
        ? "Expand sidebar"
        : "Collapse sidebar";
      storage.set("collapsed", String(collapsed));
    });
    $("#mobile-menu").addEventListener("click", openDrawer);
    $("#drawer-backdrop").addEventListener("click", () => closeDrawer());
    mobileQuery.addEventListener("change", () => closeDrawer(false));
    motionQuery.addEventListener("change", updateCharts);
    $("#refresh-button").addEventListener("click", syncDemo);
    for (const id of ["notifications", "profile"])
      $(`#${id}-toggle`).addEventListener("click", () => toggleDropdown(id));
    $$("dialog").forEach((dialog) => {
      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) {
          const rect = dialog.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            dialog.close();
        }
      });
      dialog.addEventListener("close", () => {
        // A sidebar trigger may be hidden after the mobile drawer closes.
        if (
          lastDialogTrigger &&
          !lastDialogTrigger.closest("[inert]") &&
          lastDialogTrigger.getClientRects().length
        )
          lastDialogTrigger.focus();
        else if (mobileQuery.matches) $("#mobile-menu").focus();
      });
    });
    document.addEventListener("click", (event) => {
      const target = event.target.closest("button, a");
      if (target?.dataset.course) courseDetails(target.dataset.course, target);
      if (target?.dataset.assignment)
        assignmentDetails(target.dataset.assignment, target);
      if (target?.dataset.open) openDialog(target.dataset.open, target);
      if (target?.hasAttribute("data-close")) target.closest("dialog").close();
      if (target?.classList.contains("clear-search")) {
        state.search = "";
        $("#global-search").value = "";
        renderSearchResults();
        $("#global-search").focus();
      }
      if (target?.dataset.nav) {
        $$(".nav-item[data-nav]").forEach((item) => {
          item.classList.toggle("active", item === target);
          if (item === target) item.setAttribute("aria-current", "page");
          else item.removeAttribute("aria-current");
        });
        $("#breadcrumb-label").textContent = target.getAttribute("title");
        closeDrawer(false);
        const section = $(`#${target.dataset.nav}`);
        if (mobileQuery.matches && section) {
          section.setAttribute("tabindex", "-1");
          section.focus({ preventScroll: true });
        }
      }
      if (!event.target.closest(".dropdown-host")) closeDropdowns();
      if (target?.classList.contains("dropdown-link") && target.tagName === "A")
        closeDropdowns();
      if (target?.classList.contains("brand")) closeDrawer(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        if (document.body.classList.contains("drawer-open")) closeDrawer();
        const openMenu = $("#notifications-menu").hidden
          ? $("#profile-menu").hidden
            ? null
            : "profile"
          : "notifications";
        closeDropdowns();
        if (openMenu) $(`#${openMenu}-toggle`).focus();
      }
      if (
        event.key === "/" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !["INPUT", "SELECT", "TEXTAREA"].includes(
          document.activeElement.tagName,
        ) &&
        !$("dialog[open]") &&
        !document.body.classList.contains("drawer-open")
      ) {
        event.preventDefault();
        $("#global-search").focus();
      }
      if (
        event.key === "Tab" &&
        document.body.classList.contains("drawer-open")
      ) {
        const focusables = $$(
          "a[href], button:not([disabled])",
          $("#sidebar"),
        ).filter((element) => element.getClientRects().length);
        const first = focusables[0],
          last = focusables.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });
  }

  function initialize() {
    const hour = new Date().getHours();
    $("#greeting").textContent =
      hour < 12
        ? "Good morning"
        : hour < 18
          ? "Good afternoon"
          : "Good evening";
    $("#current-date").textContent = dateText(today, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    $("#current-date").dateTime =
      `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    mockData.courses.forEach((course) => {
      const option = new Option(course.title, course.id);
      $("#course-filter").add(option);
    });
    $("#calendar-events").innerHTML = mockData.assignments
      .map(
        (item) =>
          `<div class="calendar-event"><span class="calendar-date"><small>${dateText(offsetDate(item.days), { month: "short" })}</small>${offsetDate(item.days).getDate()}</span><div><strong>${escapeHTML(item.title)}</strong><p>${escapeHTML(getCourse(item.course).title)} · ${item.type}</p></div></div>`,
      )
      .join("");
    const compact = storage.get("compact") === "true";
    document.body.classList.toggle("compact-records", compact);
    $("#compact-preference").checked = compact;
    if (storage.get("collapsed") === "true") {
      document.body.classList.add("sidebar-collapsed");
      $("#collapse-sidebar").setAttribute("aria-expanded", "false");
      $("#collapse-sidebar").setAttribute("aria-label", "Expand sidebar");
    }
    $$(".nav-item").forEach((item) =>
      item.setAttribute("aria-label", item.getAttribute("title")),
    );
    $("#sidebar").inert = mobileQuery.matches;
    const savedTheme = storage.get("theme");
    setTheme(
      savedTheme === "light" || savedTheme === "dark"
        ? savedTheme
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light",
    );
    renderStats();
    renderSearchResults();
    initializeCharts();
    wireEvents();
    renderIcons();
  }

  initialize();
})();