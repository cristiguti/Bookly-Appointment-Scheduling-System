/* ==========================================================
   Bookly - script.js
   Talks to the Express + MySQL backend via fetch().
   Runs on every page; each init*() no-ops if its elements
   aren't present, so one shared file is fine.
   ========================================================== */

/* ---------- Shared validation ---------- */
// Requires a domain with an extension, e.g. name@example.com — rejects
// things like "name@example" that have no ".com"/".org"/etc.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// At least 6 characters, with an uppercase letter, a lowercase letter, and a number.
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/;
const PASSWORD_REQUIREMENTS_MSG =
  "Password must be at least 6 characters and include an uppercase letter, a lowercase letter, and a number.";

// Escapes free-text (e.g. a patient's typed "reason for visit") before it's
// dropped into an innerHTML template.
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = String(str || "");
  return div.innerHTML;
}

/* ---------- API helper ---------- */
// Wraps fetch: sends/receives JSON, sends the session cookie, and
// bounces to the login page if the server says we're not authenticated.
async function api(path, options = {}) {
  const res = await fetch(path, {
    method: options.method || "GET",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401 && options.redirectOn401 !== false) {
    window.location.href = "/login.html";
    throw new Error("Not authenticated");
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    throw new Error((data && data.error) || "Request failed");
  }
  return data;
}

/* ---------- LOGOUT (any page with a logout button) ---------- */
function initLogout() {
  document.querySelectorAll('[data-action="logout"]').forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await fetch("/api/logout", {
          method: "POST",
          credentials: "same-origin",
        });
      } finally {
        window.location.href = "/login.html";
      }
    });
  });
}

/* ---------- CURRENT USER (shared across logged-in pages) ---------- */
let currentUserPromise = null;
function loadCurrentUser() {
  if (!currentUserPromise) currentUserPromise = api("/api/me");
  return currentUserPromise;
}

function getInitials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

/* ---------- PROFILE DROPDOWN (header, any logged-in page) ---------- */
function initProfileMenu() {
  const trigger = document.getElementById("profile-trigger");
  const dropdown = document.getElementById("profile-dropdown");
  if (!trigger || !dropdown) return;

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.classList.toggle("open");
  });
  document.addEventListener("click", () => dropdown.classList.remove("open"));

  loadCurrentUser()
    .then((user) => {
      const initials = getInitials(user.name);
      document.querySelectorAll(".profile-avatar").forEach((el) => {
        el.textContent = initials;
      });
    })
    .catch(() => {});
}

/* ---------- HELP BAR (every page) ---------- */
function initHelpBar() {
  if (document.getElementById("help-bar")) return;

  document.body.classList.add("has-help-bar");
  document.body.insertAdjacentHTML(
    "beforeend",
    `
    <div class="help-bar" id="help-bar">
      <span class="help-bar-text">Need Help? Call <a href="tel:+15551234567">(555) 123-4567</a></span>
      <button type="button" class="help-bar-btn" id="help-chat-btn">Chat Now</button>
    </div>
    <div class="help-modal-overlay" id="help-modal-overlay">
      <div class="help-modal">
        <button type="button" class="help-modal-close" id="help-modal-close" aria-label="Close">&times;</button>
        <h3>Need Help?</h3>
        <p class="help-modal-desc">Send us a message and we'll reply to your email.</p>
        <form id="help-modal-form">
          <input type="email" id="help-email" placeholder="Your email" required />
          <textarea id="help-message" placeholder="How can we help?" rows="4" required></textarea>
          <button type="submit" class="btn-primary">Send Message</button>
          <div class="error-msg" id="help-modal-error"></div>
          <div class="success-msg" id="help-modal-success"></div>
        </form>
      </div>
    </div>
    <div class="help-confirmation" id="help-confirmation">
      <div class="reminder-banner">
        <div class="reminder-title">Message Sent</div>
        <div class="reminder-body">
          We've received your message and a member of our team will follow up by email.
        </div>
        <div class="reminder-note">Expect a response within 1 business day</div>
      </div>
    </div>
    `
  );

  const overlay = document.getElementById("help-modal-overlay");
  const form = document.getElementById("help-modal-form");
  const errorEl = document.getElementById("help-modal-error");
  const successEl = document.getElementById("help-modal-success");
  const confirmationBanner = document.getElementById("help-confirmation");

  const openModal = () => overlay.classList.add("open");
  const closeModal = () => overlay.classList.remove("open");

  let confirmationTimeout;
  function showConfirmationBanner() {
    confirmationBanner.classList.add("show");
    clearTimeout(confirmationTimeout);
    confirmationTimeout = setTimeout(() => {
      confirmationBanner.classList.remove("show");
    }, 6000);
  }

  document.getElementById("help-chat-btn").addEventListener("click", openModal);
  document.getElementById("help-modal-close").addEventListener("click", closeModal);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.textContent = "";
    successEl.textContent = "";

    const email = document.getElementById("help-email").value.trim();
    const message = document.getElementById("help-message").value.trim();

    if (!EMAIL_PATTERN.test(email)) {
      errorEl.textContent = "Please enter a valid email address.";
      return;
    }
    if (!message) {
      errorEl.textContent = "Please enter a message.";
      return;
    }

    try {
      await api("/api/support", {
        method: "POST",
        body: { email, message },
        redirectOn401: false,
      });
      successEl.textContent = "Message sent! We'll respond within 1 business day.";
      form.reset();
      setTimeout(() => {
        closeModal();
        showConfirmationBanner();
      }, 1200);
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });
}

/* ---------- LOGIN PAGE ---------- */
function initLoginPage() {
  const form = document.getElementById("login-form");
  if (!form) return;

  const errorEl = document.getElementById("login-error");
  const successEl = document.getElementById("login-success");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.textContent = "";
    successEl.textContent = "";

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    if (!email || !password) {
      errorEl.textContent = "Please enter both email and password.";
      return;
    }
    if (!EMAIL_PATTERN.test(email)) {
      errorEl.textContent = "Please enter a valid email address.";
      return;
    }

    try {
      await api("/api/login", {
        method: "POST",
        body: { email, password },
        redirectOn401: false,
      });
      successEl.textContent = "Login successful! Redirecting…";
      setTimeout(() => (window.location.href = "/"), 800);
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });
}

/* ---------- REGISTER PAGE ---------- */
function initRegisterPage() {
  const form = document.getElementById("register-form");
  if (!form) return;

  const errorEl = document.getElementById("register-error");
  const successEl = document.getElementById("register-success");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.textContent = "";
    successEl.textContent = "";

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    if (!name || !email || !password) {
      errorEl.textContent = "Please fill in all fields.";
      return;
    }
    if (!EMAIL_PATTERN.test(email)) {
      errorEl.textContent = "Please enter a valid email address.";
      return;
    }
    if (!PASSWORD_PATTERN.test(password)) {
      errorEl.textContent = PASSWORD_REQUIREMENTS_MSG;
      return;
    }

    try {
      await api("/api/register", {
        method: "POST",
        body: { name, email, password },
      });
      successEl.textContent = "Account created! Redirecting…";
      setTimeout(() => (window.location.href = "/"), 800);
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });
}

/* ---------- FORGOT PASSWORD PAGE ---------- */
function initForgotPasswordPage() {
  const form = document.getElementById("forgot-password-form");
  if (!form) return;

  const errorEl = document.getElementById("forgot-password-error");
  const successEl = document.getElementById("forgot-password-success");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.textContent = "";
    successEl.textContent = "";

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    if (!email || !password) {
      errorEl.textContent = "Please enter your email and a new password.";
      return;
    }
    if (!EMAIL_PATTERN.test(email)) {
      errorEl.textContent = "Please enter a valid email address.";
      return;
    }
    if (!PASSWORD_PATTERN.test(password)) {
      errorEl.textContent = PASSWORD_REQUIREMENTS_MSG;
      return;
    }

    try {
      await api("/api/forgot-password", {
        method: "POST",
        body: { email, password },
      });
      successEl.textContent = "Password reset. Redirecting to login…";
      setTimeout(() => (window.location.href = "/login.html"), 1200);
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });
}

/* ---------- FIND A PROVIDER PAGE ---------- */
const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function initProvidersPage() {
  const providerList = document.getElementById("provider-list");
  if (!providerList) return;

  const searchInput = document.getElementById("provider-search");
  const timesGrid = document.getElementById("times-grid");
  const timesHeading = document.getElementById("times-heading");
  const bookBtn = document.getElementById("book-btn");
  const reasonInput = document.getElementById("reason-input");

  const datePicker = document.getElementById("date-picker");
  const dateTrigger = document.getElementById("date-picker-trigger");
  const dateLabel = document.getElementById("date-picker-label");
  const datePanel = document.getElementById("date-picker-panel");
  const monthLabel = document.getElementById("date-picker-month-label");
  const calendarGrid = document.getElementById("date-picker-grid");
  const prevMonthBtn = document.getElementById("date-picker-prev");
  const nextMonthBtn = document.getElementById("date-picker-next");

  let providers = []; // loaded from API
  let slots = []; // availability for the selected provider (all dates)
  let selectedProviderId = null;
  let selectedDate = null; // dateValue (YYYY-MM-DD) chosen in the calendar
  let selectedSlotId = null;
  let datesWithSlots = new Set(); // dateValues that have open slots
  let viewMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  function toDateValue(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  }

  function labelForDate(dateValue) {
    const match = slots.find((s) => s.dateValue === dateValue);
    return match ? match.dayLabel : "Select a date";
  }

  function closeDatePanel() {
    datePanel.classList.remove("open");
  }

  // Availability is seeded 6 months out from today (a date offset, not a
  // calendar-month one), so it can spill into a 7th distinct month — cap
  // navigation there so every seeded slot stays reachable.
  function renderCalendar() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const currentMonthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
    const maxMonthStart = new Date(currentMonthStart);
    maxMonthStart.setMonth(maxMonthStart.getMonth() + 6);

    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    monthLabel.textContent = `${MONTH_LABELS[month]} ${year}`;
    prevMonthBtn.disabled = viewMonth <= currentMonthStart;
    nextMonthBtn.disabled = viewMonth >= maxMonthStart;

    calendarGrid.innerHTML = "";
    WEEKDAY_LABELS.forEach((label) => {
      const el = document.createElement("div");
      el.className = "date-picker-weekday";
      el.textContent = label;
      calendarGrid.appendChild(el);
    });

    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstWeekday; i++) {
      calendarGrid.appendChild(document.createElement("div"));
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const cellDate = new Date(year, month, day);
      const dateValue = toDateValue(cellDate);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "date-picker-day";
      btn.textContent = String(day);

      if (!datesWithSlots.has(dateValue) || cellDate < todayStart) {
        btn.disabled = true;
        btn.classList.add("muted");
      } else {
        if (dateValue === selectedDate) btn.classList.add("selected");
        btn.addEventListener("click", () => {
          selectedDate = dateValue;
          selectedSlotId = null;
          dateLabel.textContent = labelForDate(selectedDate);
          closeDatePanel();
          renderTimes();
          updateBookButton();
          renderCalendar();
        });
      }
      calendarGrid.appendChild(btn);
    }
  }

  dateTrigger.addEventListener("click", (e) => {
    e.stopPropagation();
    datePanel.classList.toggle("open");
  });
  document.addEventListener("click", (e) => {
    if (!datePicker.contains(e.target)) closeDatePanel();
  });
  prevMonthBtn.addEventListener("click", () => {
    viewMonth.setMonth(viewMonth.getMonth() - 1);
    renderCalendar();
  });
  nextMonthBtn.addEventListener("click", () => {
    viewMonth.setMonth(viewMonth.getMonth() + 1);
    renderCalendar();
  });

  function renderProviders(filter = "") {
    const query = filter.toLowerCase();
    const filtered = providers.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.specialty.toLowerCase().includes(query)
    );

    providerList.innerHTML = "";
    if (filtered.length === 0) {
      providerList.innerHTML = `<p class="muted">No providers match your search.</p>`;
      return;
    }

    filtered.forEach((provider) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "provider-card";
      if (provider.id === selectedProviderId) card.classList.add("selected");
      card.innerHTML = `
        <div class="name">${provider.name}</div>
        <div class="specialty">${provider.specialty}</div>
      `;
      card.addEventListener("click", () => selectProvider(provider.id));
      providerList.appendChild(card);
    });
  }

  async function selectProvider(id) {
    selectedProviderId = id;
    selectedSlotId = null;
    selectedDate = null;
    renderProviders(searchInput.value);
    updateBookButton();

    timesHeading.textContent = "Loading times…";
    timesGrid.innerHTML = "";
    closeDatePanel();
    datePicker.classList.add("hidden");
    try {
      slots = await api(`/api/providers/${id}/availability`);
      populateDates();
      renderTimes();
    } catch (err) {
      timesHeading.textContent = "Available Times";
      timesGrid.innerHTML = `<p class="muted">${err.message}</p>`;
    }
  }

  // Builds the set of bookable dates from `slots` and points the calendar
  // at the soonest one (the API already sorts slots earliest-first).
  function populateDates() {
    datesWithSlots = new Set(slots.map((s) => s.dateValue));

    if (datesWithSlots.size === 0) {
      selectedDate = null;
      datePicker.classList.add("hidden");
      return;
    }
    selectedDate = slots[0].dateValue;
    dateLabel.textContent = labelForDate(selectedDate);
    const [y, m] = selectedDate.split("-").map(Number);
    viewMonth = new Date(y, m - 1, 1);
    datePicker.classList.remove("hidden");
    renderCalendar();
  }

  function renderTimes() {
    timesGrid.innerHTML = "";

    if (!selectedProviderId) {
      timesHeading.textContent = "Available Times";
      return;
    }
    const daySlots = slots.filter((s) => s.dateValue === selectedDate);
    if (daySlots.length === 0) {
      timesHeading.textContent = "Available Times";
      timesGrid.innerHTML = `<p class="muted">No open times for this provider.</p>`;
      return;
    }

    timesHeading.textContent = `Available Times — ${daySlots[0].dayLabel}`;
    daySlots.forEach((slot) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "time-slot";
      if (slot.id === selectedSlotId) btn.classList.add("selected");
      btn.textContent = slot.timeLabel;
      btn.addEventListener("click", () => {
        selectedSlotId = slot.id;
        renderTimes();
        updateBookButton();
      });
      timesGrid.appendChild(btn);
    });
  }

  function updateBookButton() {
    bookBtn.disabled = !(
      selectedProviderId &&
      selectedSlotId &&
      reasonInput.value.trim()
    );
  }

  reasonInput.addEventListener("input", updateBookButton);

  bookBtn.addEventListener("click", async () => {
    if (bookBtn.disabled) return;
    bookBtn.disabled = true;
    try {
      await api("/api/appointments", {
        method: "POST",
        body: { slotId: selectedSlotId, reason: reasonInput.value.trim() },
      });
      window.location.href = "/Appointments.html";
    } catch (err) {
      alert(err.message);
      bookBtn.disabled = false;
    }
  });

  searchInput.addEventListener("input", () =>
    renderProviders(searchInput.value)
  );

  // Initial load
  (async () => {
    try {
      providers = await api("/api/providers");
      renderProviders();
    } catch (err) {
      providerList.innerHTML = `<p class="muted">${err.message}</p>`;
    }
  })();

  renderTimes();
  updateBookButton();
}

/* ---------- DASHBOARD PAGE ---------- */
function initDashboardPage() {
  const greetingEl = document.getElementById("dashboard-greeting");
  if (!greetingEl) return;

  const nextApptContainer = document.getElementById("next-appt-container");
  const reminderContainer = document.getElementById("reminder-container");

  loadCurrentUser()
    .then((user) => {
      const firstName = String(user.name || "").trim().split(/\s+/)[0] || "";
      greetingEl.textContent = firstName
        ? `Welcome back, ${firstName}`
        : "Welcome back";
    })
    .catch(() => {});

  api("/api/appointments")
    .then((appointments) => {
      const upcoming = appointments.filter((a) => !a.isPast);

      if (upcoming.length === 0) {
        nextApptContainer.innerHTML = `
          <div class="empty-card">
            You have no upcoming appointments.
            <a href="/providers.html">Schedule one now</a>.
          </div>
        `;
        reminderContainer.innerHTML = "";
        return;
      }

      const next = upcoming[0];
      nextApptContainer.innerHTML = `
        <div class="next-appt-card">
          <div class="provider-name">${next.providerName}</div>
          <div class="provider-specialty">${next.providerSpecialty}</div>
          <div class="next-appt-meta">
            <span>${next.dayLabel}</span>
            <span>${next.timeLabel}</span>
            <span>${next.location || ""}</span>
          </div>
          ${next.reason ? `<div class="reason">Reason: ${escapeHtml(next.reason)}</div>` : ""}
          <div class="appt-actions">
            <a class="btn-outline" href="/Appointments.html">View Details</a>
            <a class="btn-outline" href="/providers.html">Reschedule</a>
          </div>
        </div>
      `;

      const remindersOn = localStorage.getItem("notif-reminders") !== "off";
      reminderContainer.innerHTML = remindersOn
        ? `
          <div class="reminder-banner">
            <div class="reminder-title">Appointment Reminder</div>
            <div class="reminder-body">
              Your appointment with ${next.providerName} is on ${next.dayLabel} at ${next.timeLabel}.
            </div>
            <div class="reminder-note">Email reminder enabled</div>
          </div>
        `
        : "";
    })
    .catch((err) => {
      nextApptContainer.innerHTML = `<p class="muted">${err.message}</p>`;
    });
}

/* ---------- MY APPOINTMENTS PAGE ---------- */
function initAppointmentsPage() {
  const upcomingEl = document.getElementById("appt-list-upcoming");
  const pastEl = document.getElementById("appt-list-past");
  if (!upcomingEl || !pastEl) return;

  function renderUpcoming(appointments) {
    upcomingEl.innerHTML = "";
    if (appointments.length === 0) {
      upcomingEl.innerHTML = `<p class="empty-msg">You have no upcoming appointments.</p>`;
      return;
    }
    appointments.forEach((appt) => {
      const card = document.createElement("div");
      card.className = "appt-card";
      card.innerHTML = `
        <div class="appt-card-main">
          <div class="name">${appt.providerName}</div>
          <div class="specialty">${appt.providerSpecialty}</div>
          <div class="datetime">${appt.dayLabel}, ${appt.timeLabel}</div>
          ${appt.reason ? `<div class="reason">Reason: ${escapeHtml(appt.reason)}</div>` : ""}
          <span class="status-badge confirmed">Confirmed</span>
        </div>
        <div class="appt-actions">
          <button type="button" class="btn-outline" data-action="reschedule" data-id="${appt.id}">Reschedule</button>
          <button type="button" class="btn-outline" data-action="cancel" data-id="${appt.id}">Cancel</button>
        </div>
      `;
      upcomingEl.appendChild(card);
    });
  }

  function renderPast(appointments) {
    pastEl.innerHTML = "";
    if (appointments.length === 0) {
      pastEl.innerHTML = `<p class="empty-msg">You have no past appointments.</p>`;
      return;
    }
    appointments.forEach((appt) => {
      const card = document.createElement("div");
      card.className = "appt-card past";
      card.innerHTML = `
        <div class="appt-card-main">
          <div class="name">${appt.providerName}</div>
          <div class="specialty">${appt.providerSpecialty}</div>
          <div class="datetime">${appt.dayLabel}, ${appt.timeLabel}</div>
          ${appt.reason ? `<div class="reason">Reason: ${escapeHtml(appt.reason)}</div>` : ""}
          <span class="status-badge past">Past</span>
        </div>
      `;
      pastEl.appendChild(card);
    });
  }

  async function load() {
    try {
      const appointments = await api("/api/appointments");
      const upcoming = appointments.filter((a) => !a.isPast);
      const past = appointments.filter((a) => a.isPast).reverse();
      renderUpcoming(upcoming);
      renderPast(past);
    } catch (err) {
      upcomingEl.innerHTML = `<p class="empty-msg">${err.message}</p>`;
      pastEl.innerHTML = "";
    }
  }

  upcomingEl.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    const id = Number(btn.dataset.id);
    const action = btn.dataset.action;

    if (action === "cancel") {
      try {
        await api(`/api/appointments/${id}/cancel`, { method: "POST" });
        load(); // refresh the lists
      } catch (err) {
        alert(err.message);
      }
    }

    if (action === "reschedule") {
      // Simple flow: go back to the finder to book a new time.
      window.location.href = "/providers.html";
    }
  });

  load();
}

/* ---------- PROFILE / NOTIFICATION SETTINGS PAGE ---------- */
function initProfilePage() {
  const nameEl = document.getElementById("profile-page-name");
  const emailEl = document.getElementById("profile-page-email");
  if (!nameEl || !emailEl) return;

  loadCurrentUser()
    .then((user) => {
      nameEl.textContent = user.name;
      emailEl.textContent = user.email;
    })
    .catch((err) => {
      nameEl.textContent = "Unable to load profile.";
      emailEl.textContent = err.message;
    });

  const toggleIds = ["notif-confirmations", "notif-reminders", "notif-changes"];
  toggleIds.forEach((id) => {
    const input = document.getElementById(id);
    if (!input) return;
    const stored = localStorage.getItem(id);
    if (stored !== null) input.checked = stored !== "off";
    input.addEventListener("change", () => {
      localStorage.setItem(id, input.checked ? "on" : "off");
    });
  });
}

/* ---------- INIT ---------- */
document.addEventListener("DOMContentLoaded", () => {
  initLogout();
  initProfileMenu();
  initHelpBar();
  initLoginPage();
  initRegisterPage();
  initForgotPasswordPage();
  initDashboardPage();
  initProvidersPage();
  initAppointmentsPage();
  initProfilePage();
});
