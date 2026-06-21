const state = {
  status: null,
  jobs: [],
  selectedJob: null,
  libraryOffset: 0,
  libraryLimit: 100,
  libraryTotal: 0,
  libraryItems: [],
  libraryLoading: false
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(body?.error || response.statusText);
  return body;
}

function toast(message) {
  const element = $("#toast");
  element.textContent = message;
  element.classList.add("visible");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove("visible"), 3200);
}

function formatStatus(status) {
  if (status === 1) return ["Geladen", "ok"];
  if (status === 2) return ["Fehler", "error"];
  return ["Nicht geladen", "warn"];
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function renderStatus() {
  const status = state.status;
  if (!status) return;
  const shortCommit = status.appCommit && status.appCommit !== "unknown" ? status.appCommit.slice(0, 7) : "local";
  $("#versionLine").textContent = `${status.libationVersion || "Libation CLI bereit"} | WebUI ${status.appVersion || "dev"} @ ${shortCommit}`;
  $("#publicIp").textContent = status.publicIp?.ip || (status.publicIp?.error ? "Fehler" : "unbekannt");
  $("#jobCount").textContent = `${status.runningJobs.length} aktiv`;
  $("#configPath").textContent = status.paths.libationFilesDir;
  $("#dbPath").textContent = status.paths.dbPath || "noch keine DB";
  $("#booksPath").textContent = status.paths.booksDir;
}

function renderJobs() {
  const active = state.jobs.filter((job) => job.status === "running");
  const recent = state.jobs.slice(0, 8);
  $("#activeJobs").innerHTML = active.length ? active.map(jobItem).join("") : "Keine aktiven Jobs";
  $("#activeJobs").classList.toggle("empty", active.length === 0);
  $("#recentJobs").innerHTML = recent.length ? recent.map(jobItem).join("") : "Noch keine Jobs";
  $("#recentJobs").classList.toggle("empty", recent.length === 0);
  const selectedId = $("#jobSelector").value || state.selectedJob?.id || "";
  $("#jobSelector").innerHTML = state.jobs.length
    ? state.jobs.map((job) => `<option value="${job.id}">${escapeHtml(job.label)} - ${job.status}</option>`).join("")
    : `<option value="">Keine Jobs</option>`;
  if (selectedId && state.jobs.some((job) => job.id === selectedId)) $("#jobSelector").value = selectedId;
}

function jobItem(job) {
  const klass = job.status === "succeeded" ? "ok" : job.status === "failed" ? "error" : "warn";
  return `
    <article class="item">
      <div class="item-row">
        <strong>${escapeHtml(job.label)}</strong>
        <span class="pill ${klass}">${job.status}</span>
      </div>
      <small>${formatDate(job.startedAt)}${job.finishedAt ? ` bis ${formatDate(job.finishedAt)}` : ""}</small>
    </article>
  `;
}

async function loadStatus() {
  state.status = await api("/api/status");
  renderStatus();
}

async function loadJobs() {
  state.jobs = await api("/api/jobs");
  renderJobs();
}

async function startAction(action, extra = {}) {
  const job = await api("/api/jobs", {
    method: "POST",
    body: JSON.stringify({ action, ...extra })
  });
  toast(`Job gestartet: ${job.label}`);
  await Promise.all([loadStatus(), loadJobs()]);
  await focusJob(job.id, false);
}

function resetLibrary() {
  state.libraryOffset = 0;
  state.libraryTotal = 0;
  state.libraryItems = [];
  $("#libraryRows").innerHTML = "";
  $("#libraryMeta").textContent = "Library wird geladen...";
  $("#loadMoreLibraryButton").disabled = true;
}

async function loadLibrary({ append = false } = {}) {
  if (state.libraryLoading) return;
  state.libraryLoading = true;
  $("#loadMoreLibraryButton").disabled = true;
  if (!append) resetLibrary();

  const params = new URLSearchParams({
    search: $("#librarySearch").value,
    status: $("#libraryStatus").value,
    sort: $("#librarySort").value,
    limit: state.libraryLimit,
    offset: state.libraryOffset
  });

  try {
    const result = await api(`/api/library?${params}`);
    state.libraryTotal = result.total || 0;
    state.libraryItems = append ? [...state.libraryItems, ...result.items] : result.items;
    state.libraryOffset = state.libraryItems.length;
    renderLibrary(result);
  } finally {
    state.libraryLoading = false;
    updateLibraryLoadButton();
  }
}

function renderLibrary(result = {}) {
  const shown = state.libraryItems.length;
  $("#libraryMeta").textContent = result.warning || `${shown} von ${state.libraryTotal} Titeln - DB: ${result.dbPath || "keine"}`;
  $("#libraryRows").innerHTML = state.libraryItems.length
    ? state.libraryItems.map(libraryRow).join("")
    : `<tr><td colspan="6" class="empty">Keine Titel gefunden</td></tr>`;
}

function updateLibraryLoadButton() {
  const button = $("#loadMoreLibraryButton");
  const hasMore = state.libraryItems.length < state.libraryTotal;
  button.disabled = state.libraryLoading || !hasMore;
  button.textContent = state.libraryLoading
    ? "Lade..."
    : hasMore
      ? `Mehr laden (${state.libraryItems.length}/${state.libraryTotal})`
      : state.libraryTotal
        ? `Alle geladen (${state.libraryTotal})`
        : "Mehr laden";
}

function libraryRow(item) {
  const [label, klass] = formatStatus(item.bookStatus);
  const subtitle = item.subtitle ? `<div class="book-subtitle">${escapeHtml(item.subtitle)}</div>` : "";
  const meta = [item.contributors, item.series].filter(Boolean).map(escapeHtml).join("<br>");
  return `
    <tr>
      <td>
        <div class="book-title">${escapeHtml(item.title || "Ohne Titel")}</div>
        ${subtitle}
        <small>${item.lengthInMinutes || 0} min ${item.locale ? `- ${escapeHtml(item.locale)}` : ""}</small>
      </td>
      <td>${meta || "<span class='empty'>-</span>"}</td>
      <td>
        <span class="pill ${klass}">${label}</span>
        ${item.lastDownloaded ? `<br><small>${formatDate(item.lastDownloaded)}</small>` : ""}
      </td>
      <td><code>${escapeHtml(item.asin || "")}</code></td>
      <td><small>${escapeHtml(formatDate(item.dateAdded) || "-")}</small></td>
      <td>
        <div class="row-actions">
          <button data-liberate="${escapeAttr(item.asin || "")}">Liberate</button>
          <button class="secondary" data-force="${escapeAttr(item.asin || "")}">Force</button>
          <button class="secondary" data-pdf="${escapeAttr(item.asin || "")}">PDF</button>
          <button class="secondary" data-status="${escapeAttr(item.asin || "")}">Status</button>
        </div>
      </td>
    </tr>
  `;
}

async function loadAccounts() {
  const result = await api("/api/accounts");
  $("#accountsList").innerHTML = result.accounts.length
    ? result.accounts.map((account) => `
      <article class="item">
        <div class="item-row">
          <strong>${escapeHtml(account.name || account.id)}</strong>
          <span class="pill ${account.authenticated ? "ok" : "error"}">${account.authenticated ? "auth" : "login needed"}</span>
        </div>
        <small>${escapeHtml(account.id || "")} - ${escapeHtml(account.locale || "")} - scan: ${account.scanLibrary ? "yes" : "no"}</small>
      </article>
    `).join("")
    : "Keine Accounts konfiguriert";
  $("#accountsList").classList.toggle("empty", result.accounts.length === 0);
}

async function loadSettings() {
  const result = await api("/api/settings");
  $("#settingsEditor").value = JSON.stringify(result.settings, null, 2);
  $("#accountsSettingsEditor").value = JSON.stringify(result.accountsSettings, null, 2);
}

async function saveSettings(kind) {
  const editor = kind === "settings" ? $("#settingsEditor") : $("#accountsSettingsEditor");
  const value = JSON.parse(editor.value);
  await api(`/api/settings/${kind}`, {
    method: "PUT",
    body: JSON.stringify(value)
  });
  toast(`${kind} gespeichert`);
}

async function loadSelectedJobLogs() {
  const id = $("#jobSelector").value;
  if (!id) return;
  const job = await api(`/api/jobs/${id}`);
  state.selectedJob = job;
  $("#jobLogs").textContent = job.logs.length
    ? job.logs.map((entry) => `[${entry.at}] ${entry.stream}: ${entry.line}`).join("\n")
    : "Noch keine Logs";
}

function showView(viewId) {
  $$(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.view === viewId));
  $$(".view").forEach((view) => view.classList.toggle("active", view.id === viewId));
}

async function focusJob(id, switchToLogs = true) {
  if (!id) return;
  await loadJobs();
  $("#jobSelector").value = id;
  await loadSelectedJobLogs();
  if (switchToLogs) showView("logs");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function wireEvents() {
  $$(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      showView(button.dataset.view);
    });
  });

  $$("[data-action]").forEach((button) => {
    button.addEventListener("click", () => startAction(button.dataset.action).catch((error) => toast(error.message)));
  });

  $("#refreshIpButton").addEventListener("click", async () => {
    await api("/api/public-ip?refresh=1");
    await loadStatus();
    toast("Public IP aktualisiert");
  });

  $("#loadLibraryButton").addEventListener("click", () => loadLibrary().catch((error) => toast(error.message)));
  $("#loadMoreLibraryButton").addEventListener("click", () => loadLibrary({ append: true }).catch((error) => toast(error.message)));
  $("#librarySearch").addEventListener("keydown", (event) => {
    if (event.key === "Enter") loadLibrary().catch((error) => toast(error.message));
  });
  $("#libraryStatus").addEventListener("change", () => loadLibrary().catch((error) => toast(error.message)));
  $("#librarySort").addEventListener("change", () => loadLibrary().catch((error) => toast(error.message)));

  const libraryObserver = new IntersectionObserver((entries) => {
    const active = $("#library").classList.contains("active");
    const hasMore = state.libraryItems.length < state.libraryTotal;
    if (active && hasMore && entries.some((entry) => entry.isIntersecting)) {
      loadLibrary({ append: true }).catch((error) => toast(error.message));
    }
  }, { rootMargin: "360px" });
  libraryObserver.observe($("#librarySentinel"));

  $("#libraryRows").addEventListener("click", async (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.liberate) await startAction("liberate", { asin: button.dataset.liberate });
    if (button.dataset.force) await startAction("liberate", { asin: button.dataset.force, force: true });
    if (button.dataset.pdf) await startAction("liberate", { asin: button.dataset.pdf, pdf: true });
    if (button.dataset.status) await startAction("set-status", { asin: button.dataset.status });
  });

  $("#loadAccountsButton").addEventListener("click", () => loadAccounts().catch((error) => toast(error.message)));
  $("#loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries());
    const job = await api("/api/accounts/login-external", { method: "POST", body: JSON.stringify(body) });
    toast("Login Job gestartet");
    await focusJob(job.id);
  });
  $("#importForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const job = await api("/api/accounts/import", {
      method: "POST",
      body: JSON.stringify({ json: form.get("json") })
    });
    toast("Import Job gestartet");
    await focusJob(job.id);
  });

  $("#loadSettingsButton").addEventListener("click", () => loadSettings().catch((error) => toast(error.message)));
  $("#saveSettingsButton").addEventListener("click", () => saveSettings("settings").catch((error) => toast(error.message)));
  $("#saveAccountsSettingsButton").addEventListener("click", () => saveSettings("accounts").catch((error) => toast(error.message)));
  $("#loadJobButton").addEventListener("click", () => loadSelectedJobLogs().catch((error) => toast(error.message)));
}

async function boot() {
  wireEvents();
  await Promise.all([loadStatus(), loadJobs(), loadLibrary(), loadAccounts(), loadSettings()]);
  setInterval(async () => {
    await Promise.all([loadStatus(), loadJobs()]);
    if (state.selectedJob?.id) await loadSelectedJobLogs();
  }, 5000);
}

boot().catch((error) => toast(error.message));
