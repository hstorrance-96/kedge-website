// Kedge admin dashboard. Talks only to the admin edge function; the password never leaves this browser except in that call.
"use strict";
const API = "https://jkaszobhblvpupaayyoy.supabase.co/functions/v1/admin";
const AGENT = { ops: "App ops", trainer: "Trainer", marketing: "Marketing" };
const $ = (id) => document.getElementById(id);
let token = "";
let data = null;
let tab = "all";

function storedToken() {
  try { return sessionStorage.getItem("kedgeAdmin") || localStorage.getItem("kedgeAdmin") || ""; } catch { return ""; }
}
function saveToken(t, remember) {
  try {
    sessionStorage.setItem("kedgeAdmin", t);
    if (remember) localStorage.setItem("kedgeAdmin", t); else localStorage.removeItem("kedgeAdmin");
  } catch { /* private mode: keep it in memory only */ }
}
function clearToken() {
  try { sessionStorage.removeItem("kedgeAdmin"); localStorage.removeItem("kedgeAdmin"); } catch { /* ignore */ }
  token = "";
}

async function call(body) {
  const res = await fetch(API, {
    method: "POST", headers: { "Content-Type": "application/json", "x-admin-token": token }, body: JSON.stringify(body),
  });
  const out = await res.json().catch(() => ({}));
  if (res.status === 403) { const e = new Error("locked"); e.locked = true; throw e; }
  if (!res.ok) throw new Error(out.error || `Error ${res.status}`);
  return out;
}

function el(tag, attrs = {}, text) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text !== undefined) n.textContent = text;
  return n;
}
const usd = (n) => (n == null ? "–" : `$${Number(n).toFixed(2)}`);
const num = (n) => (n == null ? "–" : Number(n).toLocaleString("en-US"));
const when = (iso) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function showLocked(msg = "") {
  $("app").hidden = true; $("refresh").hidden = true; $("signout").hidden = true;
  $("locked").hidden = false; $("lockmsg").textContent = msg; $("token").focus();
}

async function load() {
  try {
    data = await call({ action: "overview" });
  } catch (e) {
    if (e.locked) { clearToken(); return showLocked("That password didn't work."); }
    $("runmsg").textContent = e.message; return;
  }
  $("locked").hidden = true; $("app").hidden = false; $("refresh").hidden = false; $("signout").hidden = false;
  render();
}

// ── Rendering ─────────────────────────────────────────────────────
function render() {
  const n = data.numbers || {};
  const latest = (data.history || [])[0];
  $("asof").textContent = latest ? `Live now · nightly snapshot ${latest.day}` : "Live now";

  const snap = latest?.data || {};
  const crashes = snap.crashes || {};
  const subs = snap.subscriptions?.metrics || {};
  const cards = [
    ["Users", num(n.users_total)], ["New this week", num(n.users_new_7d)], ["Active, 7 days", num(n.active_7d)],
    ["Active, 28 days", num(n.active_28d)], ["Trials", num(n.plans?.trial ?? subs.active_trials)],
    ["Paid", num((n.plans?.monthly || 0) + (n.plans?.yearly || 0))], ["AI spend this month", usd(n.ai_spend_month_usd)],
    ["Near AI limit", num(n.near_limit_users), n.near_limit_users ? "warn" : ""],
    ["At AI limit", num(n.at_limit_users), n.at_limit_users ? "bad" : ""],
    ["Crashes, 24h", crashes.connected ? num(crashes.events_24h) : "not connected", crashes.events_24h ? "bad" : ""],
    ["Waitlist", snap.marketing?.connected ? num(snap.marketing.waitlist) : "not connected"],
  ];
  if (subs.mrr != null) cards.push(["Monthly revenue", usd(subs.mrr)]);
  const box = $("cards"); box.replaceChildren();
  for (const [label, value, cls] of cards) {
    const c = el("div", { class: `card ${cls || ""}` }); c.append(el("b", {}, value), el("span", {}, label)); box.append(c);
  }

  const hist = [...(data.history || [])].reverse();
  drawLine($("chart-users"), hist.map((h) => h.data?.business?.users_total ?? 0), hist.map((h) => h.day));
  drawLine($("chart-spend"), hist.map((h) => h.data?.business?.ai_spend_month_usd ?? 0), hist.map((h) => h.day));

  const t = $("spend"); t.replaceChildren();
  const head = el("tr"); ["Plan", "Users", "Average", "Highest", "Cap"].forEach((h, i) => head.append(el("th", i ? { class: "num" } : {}, h)));
  t.append(head);
  for (const [plan, s] of Object.entries(n.ai_spend_by_plan || {})) {
    const r = el("tr");
    r.append(el("td", {}, plan), el("td", { class: "num" }, num(s.users)), el("td", { class: "num" }, usd(s.avg_usd)),
      el("td", { class: "num" }, usd(s.max_usd)), el("td", { class: "num" }, usd(s.cap_usd)));
    t.append(r);
  }

  const cr = $("crashes"); cr.replaceChildren();
  if (!crashes.connected) cr.append(el("p", { class: "empty" }, "Sentry isn't connected yet (SENTRY_TOKEN)."));
  else if (!crashes.top?.length) cr.append(el("p", { class: "empty" }, "No unresolved crashes."));
  else for (const c of crashes.top) {
    const p = el("p"); const a = el("a", { href: c.link || "#", target: "_blank", rel: "noopener" }, c.title);
    p.append(a, el("span", { class: "muted small" }, ` · ${c.events} events on ${c.devices} devices`)); cr.append(p);
  }

  const co = $("coaching"); co.replaceChildren();
  const groups = snap.coaching?.groups || [];
  if (!groups.length) co.append(el("p", { class: "empty" }, "Shown once 20 or more people are training. Small groups are never shown."));
  else {
    const ct = el("table"); const h = el("tr");
    ["Group", "People", "Adherence", "Workouts/wk", "Sets/workout", "Easy sets", "Hard sets", "Readiness", "Food logged"].forEach((x, i) => h.append(el("th", i ? { class: "num" } : {}, x)));
    ct.append(h);
    for (const g of groups) {
      const r = el("tr");
      r.append(el("td", {}, g.grp), ...[g.users, `${g.adherence_pct}%`, g.workouts_per_week, g.sets_per_workout, `${g.easy_set_pct ?? "–"}%`,
        `${g.hard_set_pct ?? "–"}%`, g.avg_readiness ?? "–", `${g.food_logging_pct}%`].map((v) => el("td", { class: "num" }, String(v))));
      ct.append(r);
    }
    co.append(ct);
  }

  const items = data.items || [];
  const waiting = items.filter((i) => i.status === "open" && i.kind === "approval");
  $("waitcount").textContent = waiting.length ? String(waiting.length) : "";
  fillItems($("waiting"), waiting, "Nothing waiting. The agents will add things here.");
  fillItems($("feed"), items.filter((i) => tab === "all" || i.agent === tab), "No reports yet.");

  const conn = $("connections"); conn.replaceChildren();
  const names = { github: "GitHub (agents' inbox, merging)", email: "Brevo email (notifications)", waitlist: "Brevo waitlist list",
    sentry: "Sentry (crashes)", revenuecat: "RevenueCat (subscriptions)" };
  for (const [k, label] of Object.entries(names)) conn.append(el("li", data.connected?.[k] ? { class: "on" } : {}, label));
  const pool = data.offerCodesLeft || {};
  conn.append(el("li", (pool.friend > 0 && pool.referrer > 0) ? { class: "on" } : {},
    `Referral free-month codes left: ${pool.friend ?? 0} for friends, ${pool.referrer ?? 0} for referrers`));

  // Reported coach replies
  const reports = data.reports || [];
  $("reportcount").textContent = reports.length ? String(reports.length) : "";
  const rhost = $("reports");
  rhost.replaceChildren();
  if (!reports.length) rhost.append(el("p", { class: "empty" }, "Nothing reported."));
  const reasonText = { unsafe: "Could get someone hurt", wrong: "Wrong", unhelpful: "Didn't help", other: "Something else" };
  for (const r of reports) {
    const card = el("article", { class: "item" });
    card.append(el("h3", {}, `${reasonText[r.reason] || r.reason} · ${new Date(r.created_at).toLocaleString()}`));
    if (r.question) card.append(el("p", { class: "muted small" }, `Athlete asked: ${r.question}`));
    card.append(el("p", {}, `Coach said: ${r.reply}`));
    if (r.note) card.append(el("p", { class: "small" }, `Their note: ${r.note}`));
    const done = el("button", { class: "ghost" }, "Mark as handled");
    done.addEventListener("click", async () => {
      done.disabled = true;
      try { await call({ action: "closeReport", id: r.id }); card.remove(); }
      catch { done.disabled = false; done.textContent = "Couldn't save. Try again"; }
    });
    card.append(done);
    rhost.append(card);
  }
}

function drawLine(host, values, labels) {
  host.replaceChildren();
  if (values.length < 2) { host.append(el("p", { class: "empty" }, "Builds up after a few nights.")); return; }
  const w = 300, h = 90, max = Math.max(...values, 1), step = w / (values.length - 1);
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(h - 6 - (v / max) * (h - 12)).toFixed(1)}`).join(" ");
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg"); svg.setAttribute("viewBox", `0 0 ${w} ${h}`); svg.setAttribute("class", "line");
  svg.setAttribute("preserveAspectRatio", "none"); svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `${labels[0]} to ${labels[labels.length - 1]}: ${values[0]} to ${values[values.length - 1]}`);
  const pl = document.createElementNS(ns, "polyline");
  pl.setAttribute("points", pts); pl.setAttribute("fill", "none"); pl.setAttribute("stroke", "#7C9DFF"); pl.setAttribute("stroke-width", "2");
  pl.setAttribute("vector-effect", "non-scaling-stroke");
  svg.append(pl); host.append(svg);
  host.append(el("div", { class: "muted small" }, `Now ${values[values.length - 1]} · high ${max}`));
}

function fillItems(host, items, emptyText) {
  host.replaceChildren();
  if (!items.length) { host.append(el("p", { class: "empty" }, emptyText)); return; }
  for (const it of items) host.append(itemCard(it));
}

function itemCard(it) {
  const node = $("item-tpl").content.firstElementChild.cloneNode(true);
  node.querySelector(".agent").textContent = AGENT[it.agent] || it.agent;
  const st = node.querySelector(".status");
  st.textContent = it.status === "open" ? (it.kind === "approval" ? "needs approval" : "new") : it.status;
  st.classList.add(it.status);
  node.querySelector("time").textContent = when(it.created_at);
  node.querySelector(".title").textContent = it.title;

  const pr = node.querySelector(".pr");
  if (it.pr_number) {
    const a = el("a", { href: it.pr?.url || `https://github.com/hstorrance-96/kedge-app/pull/${it.pr_number}`, target: "_blank", rel: "noopener" }, `Pull request #${it.pr_number}`);
    pr.append(a);
    if (it.pr) pr.append(` · tests ${it.pr.checks} · ${it.pr.state}`);
  }

  const body = node.querySelector(".body");
  body.innerHTML = it.body_html || ""; // server-side escaped markdown
  if ((it.body || "").length > 600) {
    const more = el("button", { class: "more" }, "Show all");
    more.addEventListener("click", () => { body.classList.toggle("open"); more.textContent = body.classList.contains("open") ? "Show less" : "Show all"; });
    body.after(more);
  }

  const act = node.querySelector(".action");
  if (it.action?.type === "post") {
    act.append(el("div", { class: "muted small" }, `Post for ${it.action.channel}`), el("pre", {}, it.action.text));
    const copy = el("button", { class: "ghost" }, "Copy text");
    copy.addEventListener("click", async () => { await navigator.clipboard.writeText(it.action.text); copy.textContent = "Copied"; });
    act.append(copy);
  } else if (it.action?.type === "email") {
    act.append(el("div", { class: "muted small" }, `Email to the waitlist · subject: ${it.action.subject}`));
    const frame = el("iframe", { sandbox: "", title: "Email preview", referrerpolicy: "no-referrer" });
    frame.srcdoc = it.action.html;
    act.append(frame);
  }

  if (it.result) node.querySelector(".result").textContent = it.result;
  if (it.decision_note) node.querySelector(".result").append(el("div", {}, `Your note: ${it.decision_note}`));

  const decide = node.querySelector(".decide");
  if (it.status !== "open") decide.remove();
  else {
    const approve = node.querySelector(".approve"), reject = node.querySelector(".reject"), note = node.querySelector("textarea");
    approve.textContent = it.kind === "report" ? (it.agent === "trainer" ? "Send feedback" : "Mark read")
      : it.pr_number ? "Approve and merge" : it.action?.type === "email" ? "Approve and send to waitlist" : "Approve";
    if (it.kind === "report") reject.remove();
    const go = async (decision) => {
      if (decision === "approve" && it.action?.type === "email" && !confirm(`Send "${it.action.subject}" to everyone on the waitlist now?`)) return;
      approve.disabled = true; if (reject.isConnected) reject.disabled = true;
      try {
        const r = await call({ action: "decide", id: it.id, decision, note: note.value.trim() });
        node.querySelector(".result").textContent = r.result || r.error || r.status;
        await load();
      } catch (e) { node.querySelector(".result").textContent = e.message; approve.disabled = false; if (reject.isConnected) reject.disabled = false; }
    };
    approve.addEventListener("click", () => go("approve"));
    reject.addEventListener("click", () => go("reject"));
  }
  return node;
}

// ── Wiring ────────────────────────────────────────────────────────
$("unlock").addEventListener("submit", async (e) => {
  e.preventDefault();
  token = $("token").value.trim();
  saveToken(token, $("remember").checked);
  $("token").value = "";
  await load();
});
$("signout").addEventListener("click", () => { clearToken(); showLocked(); });
$("refresh").addEventListener("click", load);
// Top-level pages: the dashboard, and "Waiting for you" on its own page with its count on the tab.
for (const b of document.querySelectorAll(".pages button")) {
  b.addEventListener("click", () => {
    for (const x of document.querySelectorAll(".pages button")) x.setAttribute("aria-selected", String(x === b));
    $("page-waiting").hidden = b.dataset.page !== "waiting";
    $("page-dash").hidden = b.dataset.page !== "dash";
  });
}

for (const b of document.querySelectorAll(".tabs button")) {
  b.addEventListener("click", () => {
    tab = b.dataset.agent;
    for (const x of document.querySelectorAll(".tabs button")) x.setAttribute("aria-selected", String(x === b));
    if (data) render();
  });
}
for (const [id, action] of [["run-collect", "collect"], ["run-inbox", "inbox"]]) {
  $(id).addEventListener("click", async () => {
    $("runmsg").textContent = "Running…";
    try { const r = await call({ action }); $("runmsg").textContent = JSON.stringify(r); await load(); }
    catch (e) { $("runmsg").textContent = e.message; }
  });
}

token = storedToken();
if (token) load(); else showLocked();
