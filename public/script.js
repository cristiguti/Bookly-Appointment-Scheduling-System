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

// Same as getInitials, but drops a leading "Dr." title so "Dr. Maya Chen"
// reads as "MC" instead of "DC".
function getProviderInitials(name) {
  return getInitials(String(name || "").replace(/^dr\.?\s+/i, ""));
}

const STAR_ICON_SVG =
  '<svg class="star-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.9 6.26L22 9.27l-5 4.87L18.2 21 12 17.56 5.8 21 7 14.14l-5-4.87 7.1-1.01L12 2z"/></svg>';

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
      <span class="help-bar-icon" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 13v-1a8 8 0 0 1 16 0v1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <rect x="2.5" y="13" width="5" height="7" rx="2.5" stroke="currentColor" stroke-width="2"/>
          <rect x="16.5" y="13" width="5" height="7" rx="2.5" stroke="currentColor" stroke-width="2"/>
          <path d="M19.5 20v.5a3.5 3.5 0 0 1-3.5 3.5h-3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </span>
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

  const finderView = document.getElementById("finder-view");
  const providerDetail = document.getElementById("provider-detail");
  const backToProvidersBtn = document.getElementById("back-to-providers");
  const detailBookBtn = document.getElementById("detail-book-btn");
  const bookingPanel = document.getElementById("booking-panel");
  let detailProviderId = null;

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
      const card = document.createElement("div");
      card.className = "provider-card";
      if (provider.id === selectedProviderId) card.classList.add("selected");
      const rating = Number(provider.rating).toFixed(1);
      card.innerHTML = `
        <button type="button" class="provider-card-main">
          <span class="provider-avatar-lg">${getProviderInitials(provider.name)}</span>
          <div class="provider-card-info">
            <div class="name">${escapeHtml(provider.name)}</div>
            <div class="specialty">${escapeHtml(provider.specialty)}</div>
            <div class="provider-card-meta">
              <span class="provider-rating">${STAR_ICON_SVG} ${rating} (${provider.review_count} reviews)</span>
              <span class="dot">&bull;</span>
              <span>${provider.years_experience} years experience</span>
            </div>
          </div>
        </button>
        <button type="button" class="view-profile-btn">View Profile <span aria-hidden="true">&rarr;</span></button>
      `;
      card
        .querySelector(".provider-card-main")
        .addEventListener("click", () => selectProvider(provider.id));
      card.querySelector(".view-profile-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        showProviderDetail(provider.id);
      });
      providerList.appendChild(card);
    });
  }

  async function showProviderDetail(id) {
    detailProviderId = id;
    finderView.classList.add("hidden");
    providerDetail.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });

    document.getElementById("detail-name").textContent = "Loading…";
    document.getElementById("detail-specialty").textContent = "";
    document.getElementById("detail-rating").innerHTML = "";
    document.getElementById("detail-experience").textContent = "";
    document.getElementById("detail-bio").textContent = "";
    document.getElementById("detail-education").innerHTML = "";
    document.getElementById("detail-specialties").innerHTML = "";
    document.getElementById("detail-reviews").innerHTML = "";

    try {
      const provider = await api(`/api/providers/${id}`);
      renderProviderDetail(provider);
    } catch (err) {
      document.getElementById("detail-name").textContent = "Unable to load provider";
      document.getElementById("detail-bio").textContent = err.message;
    }
  }

  function renderProviderDetail(provider) {
    const rating = Number(provider.rating).toFixed(1);
    document.getElementById("detail-avatar").textContent = getProviderInitials(provider.name);
    document.getElementById("detail-name").textContent = provider.name;
    document.getElementById("detail-specialty").textContent = provider.specialty;
    document.getElementById("detail-rating").innerHTML =
      `${STAR_ICON_SVG} ${rating} (${provider.review_count} reviews)`;
    document.getElementById("detail-experience").textContent =
      `${provider.years_experience} years experience`;
    document.getElementById("detail-bio").textContent = provider.bio || "";

    document.getElementById("detail-education").innerHTML = (provider.education || [])
      .map((item) => `<li>${escapeHtml(item)}</li>`)
      .join("");
    document.getElementById("detail-specialties").innerHTML = (provider.specialties || [])
      .map((item) => `<li>${escapeHtml(item)}</li>`)
      .join("");

    document.getElementById("detail-exp-stat").textContent = `${provider.years_experience} years`;
    document.getElementById("detail-location-stat").textContent = provider.location || "—";
    document.getElementById("detail-rating-stat").textContent =
      `${rating} / 5 — ${provider.review_count} reviews`;

    const reviews = provider.reviews || [];
    document.getElementById("detail-reviews").innerHTML = reviews.length
      ? reviews
          .map(
            (r) => `
        <div class="review-card">
          <div class="provider-rating">${STAR_ICON_SVG} ${r.rating}/5</div>
          <p>${escapeHtml(r.comment)}</p>
          <div class="review-author">${escapeHtml(r.patient)}</div>
        </div>`
          )
          .join("")
      : `<p class="muted">No reviews yet.</p>`;
  }

  function hideProviderDetail() {
    providerDetail.classList.add("hidden");
    finderView.classList.remove("hidden");
  }

  backToProvidersBtn.addEventListener("click", hideProviderDetail);

  detailBookBtn.addEventListener("click", () => {
    if (detailProviderId == null) return;
    hideProviderDetail();
    selectProvider(detailProviderId);
    bookingPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  });

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
      timesGrid.innerHTML = `<p class="muted">Select a provider to view available appointment times.</p>`;
      return;
    }
    const daySlots = slots.filter((s) => s.dateValue === selectedDate);
    if (daySlots.length === 0) {
      timesHeading.textContent = "Available Times";
      timesGrid.innerHTML = `<p class="muted">No appointment times are currently available for this provider. Please select another provider or check again later.</p>`;
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
    bookBtn.disabled = !(selectedProviderId && selectedSlotId);
  }

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

  // Initial load — a `?q=` param (from the dashboard's Find Care search
  // or specialty pills) pre-fills and pre-filters the list.
  (async () => {
    try {
      providers = await api("/api/providers");
      const query = new URLSearchParams(window.location.search).get("q") || "";
      if (query) searchInput.value = query;
      renderProviders(query);
    } catch (err) {
      providerList.innerHTML = `<p class="muted">${err.message}</p>`;
    }
  })();

  renderTimes();
  updateBookButton();
}

const LOCATION_PIN_SVG =
  '<svg class="pin-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="9.5" r="2.5" stroke="currentColor" stroke-width="2"/></svg>';

const CALENDAR_ICON_SVG =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" stroke="currentColor" stroke-width="2"/><path d="M3 9h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M8 3v4M16 3v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

const CLOCK_ICON_SVG =
  '<svg class="clock-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const BELL_ICON_SVG =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3a5 5 0 0 0-5 5v3.5c0 .8-.3 1.6-.9 2.2L5 15h14l-1.1-1.3c-.6-.6-.9-1.4-.9-2.2V8a5 5 0 0 0-5-5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.5 18a2.5 2.5 0 0 0 5 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

const CHECK_BADGE_SVG =
  '<svg class="check-badge" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M7.5 12.5l3 3 6-6" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>';

/* ---------- DASHBOARD PAGE ---------- */
function initDashboardPage() {
  const greetingEl = document.getElementById("dashboard-greeting");
  if (!greetingEl) return;

  const nextApptContainer = document.getElementById("next-appt-container");
  const reminderContainer = document.getElementById("reminder-container");
  const secondaryGrid = document.querySelector(".dashboard-secondary-grid");

  // With no reminder banner, let the care-hero panel fill the row instead
  // of floating alone next to empty space.
  function setSecondaryGridHasReminder(hasReminder) {
    if (secondaryGrid) secondaryGrid.classList.toggle("no-reminder", !hasReminder);
  }

  loadCurrentUser()
    .then((user) => {
      const firstName = String(user.name || "").trim().split(/\s+/)[0] || "";
      greetingEl.textContent = firstName
        ? `Welcome back, ${firstName}`
        : "Welcome back";
    })
    .catch(() => {});

  function renderNextAppointment(appointments) {
    const upcoming = appointments.filter((a) => !a.isPast);

    if (upcoming.length === 0) {
      nextApptContainer.innerHTML = `
        <div class="next-appt-card empty">
          <p class="next-appt-empty-text">No upcoming appointments</p>
          <a class="btn-primary" href="/providers.html">Schedule an Appointment</a>
        </div>
      `;
      reminderContainer.innerHTML = "";
      setSecondaryGridHasReminder(false);
      return;
    }

    const next = upcoming[0];
    nextApptContainer.innerHTML = `
      <div class="next-appt-card">
        <div class="next-appt-top">
          <span class="next-appt-icon" aria-hidden="true">${CALENDAR_ICON_SVG}</span>
          <div>
            <div class="provider-name">${escapeHtml(next.providerName)}</div>
            <div class="provider-specialty">${escapeHtml(next.providerSpecialty)}</div>
          </div>
        </div>
        <div class="next-appt-datetime">
          <span>${CALENDAR_ICON_SVG} ${next.dayLabel}</span>
          <span>${CLOCK_ICON_SVG} ${next.timeLabel}</span>
        </div>
        ${next.location ? `<div class="next-appt-location">${LOCATION_PIN_SVG} ${escapeHtml(next.location)}</div>` : ""}
        ${next.reason ? `<div class="reason">Reason: ${escapeHtml(next.reason)}</div>` : ""}
        <div class="appt-actions">
          <a class="btn-outline" href="/Appointments.html">View Details</a>
          <a class="btn-outline" href="/providers.html">Reschedule</a>
          <button type="button" class="btn-outline" id="dashboard-cancel-btn">Cancel</button>
        </div>
      </div>
    `;

    document.getElementById("dashboard-cancel-btn").addEventListener("click", () => {
      confirmCancelAppointment(next, load);
    });

    const remindersOn = localStorage.getItem("notif-reminders") !== "off";
    setSecondaryGridHasReminder(remindersOn);
    reminderContainer.innerHTML = remindersOn
      ? `
        <div class="reminder-banner">
          <div class="reminder-banner-inner">
            <span class="reminder-icon" aria-hidden="true">${BELL_ICON_SVG}</span>
            <div class="reminder-content">
              <div class="reminder-title">Appointment Reminder</div>
              <div class="reminder-body">
                Your appointment with ${escapeHtml(next.providerName)} is on <strong>${next.dayLabel} at ${next.timeLabel}</strong>.
              </div>
              <hr class="reminder-divider" />
              <div class="reminder-note">${CHECK_BADGE_SVG} Email reminder enabled</div>
            </div>
          </div>
        </div>
      `
      : "";
  }

  function load() {
    api("/api/appointments")
      .then((appointments) => {
        renderNextAppointment(appointments);
      })
      .catch((err) => {
        nextApptContainer.innerHTML = `<p class="muted">${err.message}</p>`;
      });
  }

  load();
}

/* ---------- CANCEL APPOINTMENT CONFIRMATION (shared: dashboard + appointments page) ---------- */
let pendingCancelAppt = null;
let pendingCancelCallback = null;

function initCancelModal() {
  if (document.getElementById("cancel-modal-overlay")) return;

  document.body.insertAdjacentHTML(
    "beforeend",
    `
    <div class="confirm-modal-overlay" id="cancel-modal-overlay">
      <div class="confirm-modal">
        <h3>Cancel appointment?</h3>
        <p class="confirm-modal-desc" id="cancel-modal-message"></p>
        <div class="confirm-modal-actions">
          <button type="button" class="btn-outline" id="cancel-modal-keep">Keep Appointment</button>
          <button type="button" class="btn-danger" id="cancel-modal-confirm">Yes, Cancel Appointment</button>
        </div>
      </div>
    </div>
    `
  );

  const overlay = document.getElementById("cancel-modal-overlay");
  const keepBtn = document.getElementById("cancel-modal-keep");
  const confirmBtn = document.getElementById("cancel-modal-confirm");

  function closeCancelModal() {
    pendingCancelAppt = null;
    pendingCancelCallback = null;
    overlay.classList.remove("open");
  }

  keepBtn.addEventListener("click", closeCancelModal);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeCancelModal();
  });

  confirmBtn.addEventListener("click", async () => {
    if (!pendingCancelAppt) return;
    const appt = pendingCancelAppt;
    const callback = pendingCancelCallback;
    closeCancelModal();
    try {
      await api(`/api/appointments/${appt.id}/cancel`, { method: "POST" });
      if (callback) callback();
    } catch (err) {
      alert(err.message);
    }
  });
}

// Opens the shared cancel-confirmation modal for `appt`
// ({id, providerName, dayLabel, timeLabel, ...}); calls `onCancelled`
// after the cancellation succeeds.
function confirmCancelAppointment(appt, onCancelled) {
  const overlay = document.getElementById("cancel-modal-overlay");
  const message = document.getElementById("cancel-modal-message");
  if (!overlay || !message) return;
  pendingCancelAppt = appt;
  pendingCancelCallback = onCancelled;
  message.textContent =
    `Are you sure you want to cancel your appointment with ${appt.providerName} on ${appt.dayLabel} at ${appt.timeLabel}?`;
  overlay.classList.add("open");
}

/* ---------- MY APPOINTMENTS PAGE ---------- */
function initAppointmentsPage() {
  const upcomingEl = document.getElementById("appt-list-upcoming");
  const pastEl = document.getElementById("appt-list-past");
  if (!upcomingEl || !pastEl) return;

  let upcomingAppointments = [];

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
      upcomingAppointments = upcoming;
      renderUpcoming(upcoming);
      renderPast(past);
    } catch (err) {
      upcomingEl.innerHTML = `<p class="empty-msg">${err.message}</p>`;
      pastEl.innerHTML = "";
    }
  }

  upcomingEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    const id = Number(btn.dataset.id);
    const action = btn.dataset.action;

    if (action === "cancel") {
      const appt = upcomingAppointments.find((a) => a.id === id);
      if (appt) confirmCancelAppointment(appt, load);
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
  initCancelModal();
  initLoginPage();
  initRegisterPage();
  initForgotPasswordPage();
  initDashboardPage();
  initProvidersPage();
  initAppointmentsPage();
  initProfilePage();
});
