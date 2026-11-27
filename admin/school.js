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

  window.renderSchool = (items, itemCard) => {
    const host = document.getElementById("school");
    if (!host) return;
    host.replaceChildren();
    const open = items.filter((i) => isSchool(i) && i.status === "open");
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
