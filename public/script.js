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
function initProvidersPage() {
  const providerList = document.getElementById("provider-list");
  if (!providerList) return;

  const searchInput = document.getElementById("provider-search");
  const dateSelect = document.getElementById("date-select");
  const timesGrid = document.getElementById("times-grid");
  const timesHeading = document.getElementById("times-heading");
  const bookBtn = document.getElementById("book-btn");

  let providers = []; // loaded from API
  let slots = []; // availability for the selected provider (all dates)
  let selectedProviderId = null;
  let selectedDate = null; // dateValue (YYYY-MM-DD) chosen in the calendar dropdown
  let selectedSlotId = null;

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
    dateSelect.innerHTML = "";
    dateSelect.classList.add("hidden");
    try {
      slots = await api(`/api/providers/${id}/availability`);
      populateDates();
      renderTimes();
    } catch (err) {
      timesHeading.textContent = "Available Times";
      timesGrid.innerHTML = `<p class="muted">${err.message}</p>`;
    }
  }

  // Builds the calendar dropdown from the distinct dates in `slots`,
  // preserving the date order the API already sorted them in.
  function populateDates() {
    const seen = new Set();
    dateSelect.innerHTML = "";
    slots.forEach((slot) => {
      if (seen.has(slot.dateValue)) return;
      seen.add(slot.dateValue);
      const opt = document.createElement("option");
      opt.value = slot.dateValue;
      opt.textContent = slot.dayLabel;
      dateSelect.appendChild(opt);
    });

    if (seen.size === 0) {
      selectedDate = null;
      dateSelect.classList.add("hidden");
      return;
    }
    selectedDate = dateSelect.options[0].value;
    dateSelect.value = selectedDate;
    dateSelect.classList.remove("hidden");
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

  dateSelect.addEventListener("change", () => {
    selectedDate = dateSelect.value;
    selectedSlotId = null;
    renderTimes();
    updateBookButton();
  });

  function updateBookButton() {
    bookBtn.disabled = !(selectedProviderId && selectedSlotId);
  }

  bookBtn.addEventListener("click", async () => {
    if (bookBtn.disabled) return;
    bookBtn.disabled = true;
    try {
      await api("/api/appointments", {
        method: "POST",
        body: { slotId: selectedSlotId },
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
  initLoginPage();
  initRegisterPage();
  initForgotPasswordPage();
  initDashboardPage();
  initProvidersPage();
  initAppointmentsPage();
  initProfilePage();
});
