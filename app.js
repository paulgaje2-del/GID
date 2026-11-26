const screen = document.querySelector("#screen");
const navigation = document.querySelector("#navigation");
const toast = document.querySelector("#toast");
const storageKey = "morrow-planner";
const today = new Date();
today.setHours(0, 0, 0, 0);
const keyOf = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const days = (() => {
  const monday = new Date(today);
  monday.setDate(today.getDate() - (today.getDay() + 6) % 7);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return date;
  });
})();
const initial = {
  account: null,
  signedIn: false,
  selectedDay: keyOf(today),
  duration: 25,
  goal: 8,
  sessions: [
    { id: "biology", subject: "Biology", title: "Cell structure", date: keyOf(today), start: "09:00", duration: 60, done: true },
    { id: "math", subject: "Mathematics", title: "Limits & continuity", date: keyOf(today), start: "14:00", duration: 25, done: false },
    { id: "history", subject: "History", title: "The industrial age", date: keyOf(today), start: "16:00", duration: 45, done: false }
  ],
  minutes: [100, 110, 95, 85, 0, 0, 0]
};
let data = initial;
let view = "signin";
let authError = "";
let selectedDuration = 25;
let focusId = null;
let focusStart = 0;
let ticker;
let toastTimer;

try {
  const saved = localStorage.getItem(storageKey);
  if (saved) data = { ...initial, ...JSON.parse(saved) };
  view = data.signedIn ? "today" : "signin";
} catch (error) {
  console.warn("Saved planner data could not be loaded.", error);
}

const save = () => {
  try {
    localStorage.setItem(storageKey, JSON.stringify(data));
  } catch (error) {
    console.error("Planner changes could not be saved.", error);
    notify("Changes could not be saved in this browser.");
  }
};
const safe = value => String(value).replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[char]);
const notify = message => {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
};
const dateText = (date, options) => new Intl.DateTimeFormat("en", options).format(date);
const name = () => data.account?.name || "Alex Morgan";
const firstName = () => name().split(/\s+/)[0];
const sessionsOn = date => data.sessions.filter(item => item.date === date).sort((a, b) => a.start.localeCompare(b.start));
const timeText = time => {
  const [hour, minute] = time.split(":").map(Number);
  return `${String(hour % 12 || 12).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};
const addTime = (time, minutes) => {
  const [hour, minute] = time.split(":").map(Number);
  const date = new Date(2000, 0, 1, hour, minute + minutes);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};
const durationText = minutes => minutes >= 60
  ? `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`
  : `${minutes} min`;
const dayIndex = date => days.findIndex(day => keyOf(day) === date);

function sessionCards(sessions) {
  if (!sessions.length) return `<div class="empty">No sessions planned for this day yet.</div>`;
  return `<div class="session-list">${sessions.map(session => `
    <article class="session-card ${session.done ? "done" : ""}" data-action="toggle" data-id="${safe(session.id)}" tabindex="0" role="button">
      <span class="check">${session.done ? "✓" : ""}</span>
      <span class="session-copy"><strong>${safe(session.title)}</strong><span>${safe(session.subject)} · ${durationText(session.duration)}</span></span>
      <span class="session-time">${timeText(session.start)}</span>
    </article>`).join("")}</div>`;
}

function todayPage() {
  const sessions = sessionsOn(keyOf(today));
  const next = sessions.find(session => !session.done);
  const complete = sessions.filter(session => session.done).length;
  return `
    <p class="eyebrow">${safe(dateText(today, { weekday: "long", month: "long", day: "numeric" }))}</p>
    <h1>A good day to grow.</h1>
    <p class="muted">Let’s take it one session at a time, ${safe(firstName())}.</p>
    <section class="rhythm">
      <div class="rhythm-top"><p class="eyebrow">Your daily rhythm</p><button class="pill" data-action="keep-going">Keep going</button></div>
      <div class="rhythm-bottom"><p class="rhythm-count">${complete} of ${sessions.length}</p><p class="rhythm-caption">sessions complete</p></div>
    </section>
    <div class="section-heading"><h2>Up next</h2><button class="text-button" data-view="plan">View plan</button></div>
    ${next ? `<article class="next-card" data-action="start" data-id="${safe(next.id)}" tabindex="0" role="button">
      <p class="eyebrow">${safe(next.subject)}</p><h3>${safe(next.title)}</h3>
      <p>${timeText(next.start)}–${timeText(addTime(next.start, next.duration))} · ${next.duration} min focus</p>
      <div class="next-footer"><strong>Start focus session</strong><span aria-hidden="true">→</span></div>
    </article>` : `<div class="empty">You’re all caught up for today. Nice work.</div>`}
    <div class="section-heading"><h2>Your sessions</h2></div>
    ${sessionCards(sessions)}`;
}

function planPage() {
  const selected = new Date(`${data.selectedDay}T12:00:00`);
  const sessions = sessionsOn(data.selectedDay);
  const weekLabel = `${dateText(days[0], { day: "numeric" })}–${dateText(days[6], { day: "numeric", month: "long", year: "numeric" })}`;
  return `
    <div class="heading-row"><div><p class="eyebrow">A little structure</p><h1>Your week, in view.</h1></div>
      <button class="primary" data-action="new" aria-label="Add session" style="min-width:42px;padding:0;font-size:23px">+</button>
    </div>
    <p class="muted week-range">${safe(weekLabel)}</p>
    <div class="week-strip">${days.map(date => {
      const key = keyOf(date);
      const active = key === data.selectedDay;
      const hasPlan = sessionsOn(key).length > 0;
      return `<button class="day ${active ? "selected" : ""}" data-action="day" data-date="${key}" aria-pressed="${active}">
        <span>${dateText(date, { weekday: "narrow" })}</span><strong>${date.getDate()}</strong><i style="visibility:${hasPlan ? "visible" : "hidden"}"></i>
      </button>`;
    }).join("")}</div>
    <h2 class="plan-day-title">${safe(dateText(selected, { weekday: "long", day: "numeric", month: "short" }))}</h2>
    ${sessions.length ? `<div class="timeline">${sessions.map(session => `
      <div class="timeline-row"><div class="timeline-time">${timeText(session.start)}<span>${timeText(addTime(session.start, session.duration))}</span></div>
        <article class="timeline-card ${session.done ? "done" : ""}" data-action="toggle" data-id="${safe(session.id)}" tabindex="0" role="button">
          <strong>${safe(session.title)}</strong><span>${safe(session.subject)} · ${session.done ? "Completed" : "Study session"}</span><small>${session.done ? "Completed" : durationText(session.duration)}</small>
        </article>
      </div>`).join("")}</div>` : `<div class="empty">Nothing planned yet. Add a little structure to your day.</div>`}
    <aside class="note">♧ <div>A plan with breathing room.<span>Leave a little space between sessions.</span></div></aside>`;
}

function progressPage() {
  const total = data.minutes.reduce((sum, minutes) => sum + minutes, 0);
  const goal = Number(data.goal) * 60;
  const max = Math.max(...data.minutes, 1);
  const totals = { Mathematics: 180, Biology: 120, History: 90 };
  data.sessions.filter(session => session.done).forEach(session => { totals[session.subject] = (totals[session.subject] || 0) + session.duration; });
  return `
    <p class="eyebrow">Little by little</p><h1>Look how far you’ve come.</h1>
    <p class="muted">This week · ${safe(dateText(days[0], { day: "numeric" }))}–${safe(dateText(days[6], { day: "numeric", month: "long" }))}</p>
    <section class="progress-card"><p class="eyebrow">Study time</p>
      <div class="progress-stat"><strong>${durationText(total)}</strong><span>of ${data.goal}h goal</span></div>
      <div class="track"><span style="width:${Math.min(100, Math.round(total / goal * 100))}%"></span></div>
    </section>
    <div class="section-heading"><h2>Your rhythm</h2><span class="muted" style="font-size:11px">4-day streak</span></div>
    <div class="chart">${data.minutes.map((minutes, index) => `<div class="bar-column"><small>${minutes || "0"}</small>
      <i class="bar" style="height:${minutes ? Math.max(5, Math.round(minutes / max * 58)) : 2}px"></i>${dateText(days[index], { weekday: "narrow" })}</div>`).join("")}</div>
    <div class="section-heading"><h2>Time by subject</h2></div>
    ${Object.entries(totals).map(([subject, minutes]) => `<div class="subject-row"><span>${safe(subject)}</span><span>${durationText(minutes)}</span></div>`).join("")}
    <p class="muted" style="margin-top:14px;text-align:center;font-size:10px">Consistency matters more than a perfect day.</p>`;
}

function accountPage() {
  const email = data.account?.email || "alex@university.edu";
  return `
    <p class="eyebrow">Your space</p><h1>A plan that fits you.</h1>
    <section class="account-card" style="margin:18px 0 22px"><h2>${safe(name())}</h2><p>${safe(email)}</p><p class="eyebrow">Student account</p></section>
    <div class="section-heading" style="margin-top:0"><h2>Study preferences</h2></div>
    <div class="preference-list">
      <button class="preference" data-action="goal"><span><strong>Weekly study goal</strong><span>${data.goal} hours · Build a steady rhythm</span></span><b>›</b></button>
      <button class="preference" data-action="duration"><span><strong>Default focus session</strong><span>${data.duration} minutes · Short and intentional</span></span><b>›</b></button>
      <button class="preference" data-action="schedule"><span><strong>Your study schedule</strong><span>A little structure for the week ahead</span></span><b>›</b></button>
    </div>
    <aside class="privacy">♧ &nbsp; Your plan is personal.<span>Your account keeps your study life in one calm place.</span></aside>
    <button class="secondary full" data-action="signout">Sign out</button>`;
}

function signinPage() {
  return `<section class="auth">
    <div class="auth-logo">morrow</div><h1>A little structure.<br>A clearer mind.</h1>
    <p class="muted" style="margin-bottom:26px">Your study days, thoughtfully planned.</p>
    <form data-form="signin">
      <div class="field"><label for="email">University email</label><input id="email" name="email" type="email" placeholder="alex@university.edu" required></div>
      <div class="field"><label for="password">Password</label><input id="password" name="password" type="password" placeholder="Your password" required></div>
      ${authError ? `<p class="form-error">${safe(authError)}</p>` : ""}
      <button class="primary full" type="submit" style="margin-top:12px">Sign in</button>
    </form>
    <p class="muted" style="margin:12px 0 28px;font-size:11px">A fresh start for every study day.</p>
    <button class="secondary full" data-action="signup">Create an account</button>
    <p class="auth-note">By continuing, you agree to our terms &amp; privacy.</p>
  </section>`;
}

function signupPage() {
  return `<div class="form-top"><button class="back" data-action="signin" aria-label="Back">‹</button></div>
    <p class="eyebrow">Your next chapter</p><h1>Make room<br>for better study.</h1>
    <form data-form="signup" style="margin-top:22px">
      <div class="field"><label for="name">Full name</label><input id="name" name="name" autocomplete="name" placeholder="Alex Morgan" required></div>
      <div class="field"><label for="signup-email">University email</label><input id="signup-email" name="email" type="email" placeholder="alex@university.edu" required></div>
      <div class="field"><label for="signup-password">Password</label><input id="signup-password" name="password" type="password" minlength="8" placeholder="At least 8 characters" required></div>
      <p class="helper">Use at least 8 characters.</p>${authError ? `<p class="form-error">${safe(authError)}</p>` : ""}
      <button class="primary full" type="submit">Create account</button>
    </form>
    <p class="auth-note">Already have an account? <button class="link-button" data-action="signin">Sign in</button></p>`;
}

function newPage() {
  return `<div class="form-top"><button class="back" data-action="back">‹</button><strong>New session</strong></div>
    <p class="eyebrow">Your next chapter</p><h1>Small steps,<br>real progress.</h1>
    <p class="muted">Give your next study session a place.</p>
    <form data-form="session" style="margin-top:22px">
      <div class="field"><label for="subject">Subject</label><select id="subject" name="subject"><option>Mathematics</option><option>Biology</option><option>History</option><option>Other</option></select></div>
      <div class="field"><label for="title">What will you work on?</label><input id="title" name="title" placeholder="Limits &amp; continuity" maxlength="70" required></div>
      <div class="field-row"><div class="field"><label for="date">Date</label><input id="date" name="date" type="date" value="${data.selectedDay}" required></div>
        <div class="field"><label for="start">Start time</label><input id="start" name="start" type="time" value="14:00" required></div></div>
      <div class="field"><label>Focus duration</label><div class="duration-options">${[25, 45, 60].map(minutes =>
        `<button type="button" class="duration-option ${selectedDuration === minutes ? "chosen" : ""}" data-action="choose-duration" data-duration="${minutes}">${minutes} min</button>`).join("")}</div></div>
      <button class="primary full" type="submit">Save session</button>
    </form>`;
}

function focusPage() {
  const session = data.sessions.find(item => item.id === focusId);
  if (!session) { view = "today"; return todayPage(); }
  const remaining = Math.max(0, session.duration * 60 - Math.floor((Date.now() - focusStart) / 1000));
  const progress = Math.min(360, Math.floor((Date.now() - focusStart) / (session.duration * 60) * 360));
  return `<div class="focus-screen">
    <div class="focus-top"><p class="eyebrow">Focus session</p><button class="back" data-action="leave">×</button></div>
    <h2>One thing at a time.</h2><p class="muted">Make a little space for deep work.</p>
    <div class="timer-wrap"><div class="timer-ring" style="--progress:${progress}deg"><div class="timer-copy">
      <strong id="timer">${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}</strong><span>Minutes of focus</span>
    </div></div></div>
    <p class="focus-subject">${safe(session.subject)}</p><h2 class="focus-title">${safe(session.title)}</h2>
    <p class="focus-caption">One session, one small win.</p>
    <div class="focus-actions"><button class="primary full" data-action="complete">Complete session</button><button class="link-button" data-action="end-early">End session early</button></div>
  </div>`;
}

function render() {
  clearInterval(ticker);
  navigation.hidden = ["signin", "signup", "new", "focus"].includes(view);
  navigation.querySelectorAll(".nav-item").forEach(button => button.classList.toggle("active", button.dataset.tab === view));
  const pages = { signin: signinPage, signup: signupPage, today: todayPage, plan: planPage, progress: progressPage, account: accountPage, new: newPage, focus: focusPage };
  screen.innerHTML = (pages[view] || todayPage)();
  navigation.hidden = ["signin", "signup", "new", "focus"].includes(view);
  if (view === "focus") ticker = setInterval(updateTimer, 1000);
}

function startFocus(id) {
  focusId = id;
  focusStart = Date.now();
  view = "focus";
  render();
}

function finishFocus(minutes) {
  const session = data.sessions.find(item => item.id === focusId);
  if (!session) return;
  session.done = true;
  const index = dayIndex(session.date);
  if (index >= 0) data.minutes[index] += Math.max(1, Math.min(session.duration, minutes));
  focusId = null;
  view = "today";
  save();
  render();
  notify("Session complete. Well done.");
}

function action(name, target) {
  if (name === "signup") { authError = ""; view = "signup"; render(); }
  if (name === "signin") { authError = ""; view = "signin"; render(); }
  if (name === "new") { selectedDuration = Number(data.duration); view = "new"; render(); }
  if (name === "back") { view = "plan"; render(); }
  if (name === "keep-going") { view = "plan"; render(); }
  if (name === "day") { data.selectedDay = target.dataset.date; save(); render(); }
  if (name === "choose-duration") {
    selectedDuration = Number(target.dataset.duration);
    screen.querySelectorAll(".duration-option").forEach(button => button.classList.toggle("chosen", button === target));
  }
  if (name === "start") startFocus(target.dataset.id);
  if (name === "toggle") {
    const session = data.sessions.find(item => item.id === target.dataset.id);
    if (session) {
      session.done = !session.done;
      const index = dayIndex(session.date);
      if (index >= 0) data.minutes[index] = Math.max(0, data.minutes[index] + (session.done ? session.duration : -session.duration));
      save();
      render();
    }
  }
  if (name === "complete") {
    if (focusStart) finishFocus(Math.max(1, Math.floor((Date.now() - focusStart) / 60000)));
  }
  if (name === "end-early") {
    const elapsed = Math.floor((Date.now() - focusStart) / 60000);
    if (elapsed < 1) { focusId = null; view = "today"; render(); notify("Focus session ended."); }
    else finishFocus(elapsed);
  }
  if (name === "leave") { focusId = null; view = "today"; render(); }
  if (name === "signout") { data.signedIn = false; save(); view = "signin"; render(); }
  if (name === "goal") editPreference("goal");
  if (name === "duration") editPreference("duration");
  if (name === "schedule") editPreference("schedule");
}

function editPreference(key) {
  const labels = { goal: "Weekly goal (hours)", duration: "Focus session (minutes)", schedule: "Schedule note" };
  const current = key === "schedule" ? "A little structure for the week ahead" : data[key];
  const answer = window.prompt(`Update ${labels[key]}`, String(current));
  if (answer === null || !answer.trim()) return;
  if (key !== "schedule" && (!Number.isFinite(Number(answer)) || Number(answer) < 1)) {
    notify("Enter a number greater than zero.");
    return;
  }
  data[key] = key === "schedule" ? answer.trim() : Number(answer);
  save();
  render();
  notify("Preference saved.");
}

function updateTimer() {
  const session = data.sessions.find(item => item.id === focusId);
  const timer = document.querySelector("#timer");
  if (!session || !timer) return;
  const elapsed = Math.floor((Date.now() - focusStart) / 1000);
  const left = Math.max(0, session.duration * 60 - elapsed);
  timer.textContent = `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`;
  document.querySelector(".timer-ring").style.setProperty("--progress", `${Math.min(360, Math.floor(elapsed / (session.duration * 60) * 360))}deg`);
  if (!left) finishFocus(session.duration);
}

screen.addEventListener("click", event => {
  const target = event.target.closest("[data-action], [data-view]");
  if (!target) return;
  if (target.dataset.view) { view = target.dataset.view; render(); return; }
  action(target.dataset.action, target);
});
screen.addEventListener("keydown", event => {
  if ((event.key === "Enter" || event.key === " ") && event.target.matches('[role="button"][data-action]')) {
    event.preventDefault();
    action(event.target.dataset.action, event.target);
  }
});
navigation.addEventListener("click", event => {
  const button = event.target.closest("[data-tab]");
  if (button && data.signedIn) { view = button.dataset.tab; render(); }
});
screen.addEventListener("submit", event => {
  event.preventDefault();
  const form = event.target;
  const values = new FormData(form);
  if (form.dataset.form === "signin") {
    const email = String(values.get("email") || "").trim().toLowerCase();
    if (!data.account || data.account.email.toLowerCase() !== email) {
      authError = "No saved account found for this email. Create an account to begin.";
      render();
      return;
    }
    data.signedIn = true;
    authError = "";
    save();
    view = "today";
  }
  if (form.dataset.form === "signup") {
    const name = String(values.get("name") || "").trim();
    const email = String(values.get("email") || "").trim();
    const password = String(values.get("password") || "");
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
      authError = "Enter your name, a valid email, and a password of at least 8 characters.";
      render();
      return;
    }
    data.account = { name, email };
    data.signedIn = true;
    save();
    view = "today";
    notify("Your study space is ready.");
  }
  if (form.dataset.form === "session") {
    const session = {
      id: `session-${Date.now()}`,
      subject: String(values.get("subject")),
      title: String(values.get("title") || "").trim(),
      date: String(values.get("date")),
      start: String(values.get("start")),
      duration: selectedDuration,
      done: false
    };
    if (!session.title) return;
    data.sessions.push(session);
    data.selectedDay = session.date;
    save();
    view = "plan";
    notify("Session added to your plan.");
  }
  render();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && view === "focus") { focusId = null; view = "today"; render(); }
});

render();
