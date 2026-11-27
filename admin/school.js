// Coach school tab: Hunter's own daily cases, the trainers' disagreements, and the trainer agent's reports.
// Cases arrive as agent items (agent "trainer", kind "report") whose source_path starts with ops/inbox/school-
// and whose body holds a ```json block. Answers go back through the existing "decide" action as a compact JSON note.
"use strict";
(() => {
  const isSchool = (it) => (it.source_path || "").startsWith("ops/inbox/school-");
  window.isSchoolItem = isSchool;
  const SEV = ["None", "Minor", "Moderate", "Major"];
  const VERD = [["a", "Agree"], ["c", "Change it"], ["u", "Not sure"]];
  const MAX = 3900;

  function payload(it) {
    const m = /```json\s*([\s\S]*?)```/.exec(it.body || "");
    if (!m) return null;
    try { return JSON.parse(m[1]); } catch { return null; }
  }
  const E = (tag, attrs = {}, text) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const draftKey = (it) => "kedgeSchool-" + it.id;
  const loadDraft = (it) => { try { return JSON.parse(localStorage.getItem(draftKey(it)) || "{}"); } catch { return {}; } };
  const saveDraft = (it, d) => { try { localStorage.setItem(draftKey(it), JSON.stringify(d)); } catch { /* ignore */ } };

  function chips(options, current, onPick, cls = "chip") {
    const row = E("div", { class: "chips" });
    for (const [val, label] of options) {
      const b = E("button", { type: "button", class: cls, "aria-pressed": String(current === val) }, label);
      b.addEventListener("click", () => { onPick(val); for (const x of row.children) x.setAttribute("aria-pressed", String(x === b)); });
      row.append(b);
    }
    return row;
  }
  function box(label, value, onInput, rows = 2) {
    const wrap = E("label", { class: "field" });
    wrap.append(E("span", { class: "muted small" }, label));
    const t = E("textarea", { rows: String(rows) });
    t.value = value || "";
    t.addEventListener("input", () => onInput(t.value));
    wrap.append(t);
    return wrap;
  }

  function caseCard(c, d, save) {
    const a = (d.v && d.v[c.n]) || "";
    const card = E("article", { class: "case" + (c.kind === "deep" ? " deep" : "") });
    card.append(E("div", { class: "muted small" }, (c.kind === "deep" ? "Deep dive" : "Quick call") + " " + c.n + (c.breakit ? " · try to break it" : "") + " · " + (c.areaName || "")));
    card.append(E("h3", {}, c.title));
    card.append(E("p", {}, c.situation || ""));
    if (c.data) {
      const f = E("div", { class: "casefile" });
      if (c.data.said) f.append(E("p", { class: "said" }, c.data.said));
      if (c.data.checkin) f.append(E("p", {}, "This morning: " + c.data.checkin));
      if (c.data.log?.length) {
        const t = E("table");
        for (const r of c.data.log) { const tr = E("tr"); for (const x of r) tr.append(E("td", {}, x)); t.append(tr); }
        f.append(t);
      }
      if (c.data.food) f.append(E("p", {}, "Food: " + c.data.food));
      card.append(f);
    }
    card.append(E("h4", {}, "Kedge recommends"));
    card.append(E("p", { class: "rec" }, c.kind === "quick" ? (c.short || c.rec || "") : (c.rec || "")));
    if (c.reply) { card.append(E("h4", {}, "What the coach would say")); card.append(E("p", { class: "bubble" }, c.reply)); }
    if (c.why || c.sources?.length) {
      const det = E("details"); det.append(E("summary", {}, "Why, and sources"));
      if (c.why) det.append(E("p", {}, c.why));
      for (const s of c.sources || []) { const p = E("p"); p.append(E("a", { href: s.u, target: "_blank", rel: "noopener" }, s.t)); det.append(p); }
      card.append(det);
    }
    const extra = E("div");
    const draw = () => {
      extra.replaceChildren();
      const v = (d.v && d.v[c.n]) || "";
      if (!v) return;
      const t = d.t || (d.t = {});
      const label = v === "c" ? "What would you do instead?" : v === "u" ? "What would you need to know? (optional)" : "Anything to add? (optional)";
      extra.append(box(label, t[c.n], (val) => { t[c.n] = val; save(); }));
      if (c.kind === "deep") { const s = d.s || (d.s = {}); extra.append(box("Say it your way (optional)", s[c.n], (val) => { s[c.n] = val; save(); })); }
    };
    card.append(chips(VERD, a, (val) => { (d.v || (d.v = {}))[c.n] = val; save(); draw(); }, "verdict"));
    card.append(extra);
    draw();
    return card;
  }

  function faultCard(lift, d, save) {
    const card = E("article", { class: "case" });
    card.append(E("div", { class: "muted small" }, "Weekly fault list"));
    card.append(E("h3", {}, "Fault list: " + lift));
    card.append(E("p", { class: "muted small" }, "The five faults you see most, worst first. Fill as many as you can."));
    const f = d.f || (d.f = {});
    for (let i = 1; i <= 5; i++) {
      const r = f[i] || (f[i] = {});
      const row = E("div", { class: "frow" });
      row.append(E("h4", {}, "Fault " + i));
      row.append(box("What it looks like", r.a, (v) => { r.a = v; save(); }, 1));
      row.append(box("Your cue", r.c, (v) => { r.c = v; save(); }, 1));
      row.append(chips(SEV.map((x) => [x, x]), r.s, (v) => { r.s = v; save(); }));
      row.append(box("Corrective drill if it keeps happening", r.d, (v) => { r.d = v; save(); }, 1));
      card.append(row);
    }
    return card;
  }

  function programCard(pg, d, save) {
    const card = E("article", { class: "case" });
    card.append(E("div", { class: "muted small" }, "Weekly program review"));
    card.append(E("h3", {}, "Would you hand this to a client?"));
    if (pg.athlete) card.append(E("p", {}, pg.athlete));
    const t = E("table");
    for (const [day, work] of pg.days || []) { const tr = E("tr"); tr.append(E("td", {}, day), E("td", {}, work)); t.append(tr); }
    card.append(t);
    if (pg.note) card.append(E("p", { class: "muted small" }, pg.note));
    const p = d.p || (d.p = {});
    card.append(chips([["As is", "As is"], ["With changes", "With changes"], ["Not as is", "Not as is"]], p.v, (v) => { p.v = v; save(); }));
    card.append(box("What would you change, and why?", p.t, (v) => { p.t = v; save(); }, 3));
    return card;
  }

  function sendRow(it, build, msgHost) {
    const row = E("div", { class: "row" });
    const btn = E("button", {}, "Send answers");
    const msg = E("span", { class: "muted small" });
    btn.addEventListener("click", async () => {
      const note = JSON.stringify(build());
      if (note.length > MAX) { msg.textContent = `That's ${note.length} characters; the limit is ${MAX}. Shorten a few notes and send again.`; return; }
      btn.disabled = true; msg.textContent = "Sending…";
      try {
        const r = await window.kedgeCall({ action: "decide", id: it.id, decision: "approve", note });
        msg.textContent = r.error ? r.error : "Sent. The coach-school agent picks these up on its next run.";
        if (!r.error) { try { localStorage.removeItem(draftKey(it)); } catch { /* ignore */ } await window.kedgeReload(); }
        else btn.disabled = false;
      } catch (e) { msg.textContent = e.message; btn.disabled = false; }
    });
    row.append(btn, msg);
    (msgHost || row).append();
    return row;
  }

  function casesItem(it, p) {
    const wrap = E("section", { class: "school" });
    wrap.append(E("h2", {}, "Your cases · " + (p.date || "")));
    const d = loadDraft(it);
    const save = () => saveDraft(it, d);
    for (const c of p.cases || []) wrap.append(caseCard(c, d, save));
    if (p.weekly?.faultLift) wrap.append(faultCard(p.weekly.faultLift, d, save));
    if (p.weekly?.program) wrap.append(programCard(p.weekly.program, d, save));
    wrap.append(sendRow(it, () => {
      const f = Object.fromEntries(Object.entries(d.f || {}).filter(([, r]) => r && (r.a || r.c || r.s || r.d)));
      return { k: "cases", date: p.date, v: d.v || {}, t: d.t || {}, s: d.s || {}, f, p: d.p || {} };
    }));
    return wrap;
  }

  function disagreeItem(it, p) {
    const wrap = E("section", { class: "school" });
    wrap.append(E("h2", {}, "Where the trainers don't agree with Kedge · " + (p.date || "")));
    wrap.append(E("p", { class: "muted small" }, "Each trainer changed or questioned one of Kedge's recommendations. Your call decides; nothing becomes a rule until you pick."));
    const d = loadDraft(it);
    const save = () => saveDraft(it, d);
    const picks = d.x || (d.x = {});
    const notes = d.y || (d.y = {});
    for (const x of p.items || []) {
      const card = E("article", { class: "case" });
      card.append(E("div", { class: "muted small" }, "Trainer " + x.who + " · " + (x.area || "")));
      card.append(E("h3", {}, x.title));
      if (x.situation) card.append(E("p", {}, x.situation));
      card.append(E("h4", {}, "Kedge recommended"));
      card.append(E("p", { class: "rec" }, x.kedge || ""));
      card.append(E("h4", {}, "Trainer " + x.who + " said"));
      card.append(E("p", { class: "bubble alt" }, x.trainer || ""));
      if (x.touchesSafety) card.append(E("p", { class: "warnline" }, "This touches a safety rule. A change here needs your explicit OK."));
      card.append(chips([["t", "Go with the trainer"], ["k", "Keep Kedge's"], ["talk", "Talk it through"]], picks[x.id], (v) => { picks[x.id] = v; save(); }));
      card.append(box("Note (optional)", notes[x.id], (v) => { notes[x.id] = v; save(); }));
      wrap.append(card);
    }
    if (!(p.items || []).length) wrap.append(E("p", { class: "empty" }, "No disagreements today."));
    wrap.append(sendRow(it, () => ({ k: "disagreements", date: p.date, x: picks, y: notes })));
    return wrap;
  }


  // Trainer KPIs: the newest "school-kpis" item (any status), written by the coach-school agent each run.
  const isKpi = (it) => isSchool(it) && /-kpis\.json$/.test(it.source_path || "");
  const SVGNS = "http://www.w3.org/2000/svg";
  const S = (tag, attrs = {}, text) => {
    const n = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const sum = (a) => (a || []).reduce((t, v) => t + (+v || 0), 0);
  const last = (a) => (a && a.length ? a[a.length - 1] : 0);
  function tile(value, label, sub) {
    const c = E("div", { class: "card" });
    c.append(E("b", {}, String(value)), E("span", {}, label));
    if (sub) c.append(E("small", { class: "muted kpisub" }, sub));
    return c;
  }
  function weekBars(weeks, vals, goal) {
    const W = 320, H = 156, L = 28, B = 22, T = 16, n = weeks.length || 1;
    const max = Math.max(goal || 0, ...vals.map((v) => +v || 0), 10);
    const y = (v) => T + (H - T - B) * (1 - v / max);
    const svg = S("svg", { viewBox: `0 0 ${W} ${H}`, class: "kpichart", role: "img",
      "aria-label": "Cases answered per week: " + weeks.map((w, i) => w + " " + (vals[i] || 0)).join(", ") });
    for (const t of [0, Math.round(max / 2), max]) {
      svg.append(S("line", { x1: L, x2: W, y1: y(t), y2: y(t), class: "grid" }));
      svg.append(S("text", { x: L - 6, y: y(t) + 4, "text-anchor": "end", class: "ax" }, String(t)));
    }
    const slot = (W - L) / n, bw = Math.min(26, slot * 0.6);
    weeks.forEach((w, i) => {
      const v = +vals[i] || 0, x = L + slot * i + (slot - bw) / 2, top = y(v), h = Math.max(0, y(0) - top);
      const g = S("g", { class: "bar" + (i === n - 1 ? " now" : "") });
      g.append(S("rect", { x: L + slot * i, y: T, width: slot, height: H - T - B, fill: "transparent" }));
      if (h > 0) g.append(S("path", { d: `M${x},${y(0)} V${top + 4} q0,-4 4,-4 h${bw - 8} q4,0 4,4 V${y(0)} Z` }));
      g.append(S("title", {}, `Week of ${w}: ${v} answered`));
      svg.append(g);
      if (n <= 8 || i % 2 === n % 2) svg.append(S("text", { x: x + bw / 2, y: H - 6, "text-anchor": "middle", class: "ax" }, w));
    });
    if (goal) {
      svg.append(S("line", { x1: L, x2: W, y1: y(goal), y2: y(goal), class: "goal" }));
      svg.append(S("text", { x: W, y: y(goal) - 4, "text-anchor": "end", class: "ax" }, "Goal " + goal));
    }
    return svg;
  }
  function kpiPerson(p, weeks, goal) {
    const box = E("article", { class: "kpi" });
    box.append(E("h3", {}, p.name || "Trainer " + p.who));
    const cards = E("div", { class: "cards" });
    const thisWk = last(p.answered), days = last(p.days), agree = last(p.agree);
    cards.append(
      tile(sum(p.answered), "Answered, all time"),
      tile(thisWk, "Answered this week", "of " + goal),
      tile(days + " of 5", "Days done this week"),
      tile(agree === null || agree === undefined ? "–" : agree + "%", "Agreed with Kedge this week"));
    if (p.own) cards.append(tile(sum(p.own), "Own cases, all time", last(p.own) + " this week"));
    if (p.qualifyingWeeks !== undefined) cards.append(tile(p.qualifyingWeeks, "Qualifying weeks", p.qualifyingWeeks < 26 ? "1.5% at 26" : "3% at 52"));
    box.append(cards);
    const fig = E("figure");
    fig.append(E("figcaption", {}, "Cases answered per week"));
    fig.append(weekBars(weeks, p.answered || [], goal));
    const det = E("details");
    det.append(E("summary", { class: "small muted" }, "Show as table"));
    const tb = E("table");
    const hr = E("tr");
    for (const h of ["Week of", "Answered", "Days done", ...(p.own ? ["Own cases"] : []), "Agreed"]) hr.append(E("th", {}, h));
    tb.append(hr);
    weeks.forEach((w, i) => {
      const r = E("tr");
      const a = p.agree?.[i];
      for (const v of [w, p.answered?.[i] ?? 0, (p.days?.[i] ?? 0) + " of 5", ...(p.own ? [p.own[i] ?? 0] : []), a === null || a === undefined ? "–" : a + "%"]) r.append(E("td", {}, String(v)));
      tb.append(r);
    });
    det.append(tb);
    fig.append(det);
    box.append(fig);
    return box;
  }
  function renderKpis(items) {
    const host = document.getElementById("school-kpis");
    if (!host) return;
    host.replaceChildren();
    const k = items.filter(isKpi).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
    const p = k && payload(k);
    if (!p || !(p.people || []).length) {
      host.append(E("p", { class: "empty" }, "No numbers yet. They appear after the coach school's next morning run, once the trainers start sending answers."));
      return;
    }
    host.append(E("p", { class: "muted small" }, "As of " + (p.asOf || "") + ". A week runs Monday to Sunday."));
    const grid = E("div", { class: "kpis" });
    for (const person of p.people) grid.append(kpiPerson(person, p.weeks || [], p.goal || 50));
    host.append(grid);
  }

  window.renderSchool = (items, itemCard) => {
    const host = document.getElementById("school");
    if (!host) return;
    host.replaceChildren();
    renderKpis(items);
    const open = items.filter((i) => isSchool(i) && !isKpi(i) && i.status === "open");
    const count = document.getElementById("schoolcount");
    const reports = items.filter((i) => i.agent === "trainer" && !isSchool(i));
    const openReports = reports.filter((i) => i.status === "open");
    if (count) count.textContent = open.length + openReports.length ? String(open.length + openReports.length) : "";
    for (const it of open) {
      const p = payload(it);
      if (!p) { host.append(itemCard(it)); continue; }
      host.append(p.type === "school-disagreements" ? disagreeItem(it, p) : casesItem(it, p));
    }
    if (!open.length) host.append(E("p", { class: "empty" }, "No new cases right now. Coach school posts yours each morning."));
    const rep = document.getElementById("school-reports");
    rep.replaceChildren();
    if (!reports.length) rep.append(E("p", { class: "empty" }, "No trainer reports yet. The weekly coach report comes on Fridays."));
    for (const it of reports.slice(0, 6)) rep.append(itemCard(it));
  };
})();
