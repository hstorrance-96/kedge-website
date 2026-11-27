// Ambassadors tab: applications → approve (emails the agreement) → they accept online → activate (makes their code,
// share link and private page, emails them) → paperwork before payouts. All through the admin function.
"use strict";
(() => {
  const E = (tag, attrs = {}, text) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const day = (iso) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "");
  let list = [], flash = "", minPayout = 25;
  const money = (n) => "$" + Number(n || 0).toFixed(2);
  // A starting suggestion for the custom code: KEDGE + their first name, letters only, at most 12 characters.
  const suggest = (name) => ("KEDGE" + (name.split(/\s+/)[0] || "").toUpperCase().replace(/[^A-Z0-9]/g, "")).slice(0, 12);

  function row(label, value) {
    if (!value) return null;
    const p = E("p", { class: "small" });
    p.append(E("span", { class: "muted" }, label + ": "), document.createTextNode(value));
    return p;
  }
  function act(a, action, label, cls, confirmText) {
    const b = E("button", { type: "button", class: cls || "" }, label);
    b.addEventListener("click", async () => {
      if (confirmText && !confirm(confirmText)) return;
      b.disabled = true;
      const msg = b.parentNode.parentNode.querySelector(".ambmsg");
      msg.textContent = "Working…";
      try { const r = await window.kedgeCall({ action, id: a.id }); flash = `${a.name}: ${r.result || "Done."}`; await load(); }
      catch (e) { msg.textContent = e.message; b.disabled = false; }
    });
    return b;
  }
  function card(a) {
    const c = E("article", { class: "item amb" });
    const h = E("header");
    h.append(E("b", {}, a.name), E("span", {}, a.email), E("span", { class: "spacer" }), E("span", {}, "Applied " + day(a.applied_at)));
    c.append(h);
    for (const r of [row("Links", a.links), row("Audience", a.audience), row("Describes them", a.roles), row("Why", a.why)]) if (r) c.append(r);
    if (a.accepted_at) c.append(row("Accepted", `${day(a.accepted_at)}, signed as "${a.accepted_name}" (version ${a.agreement_version})`));
    const btns = E("div", { class: "row" });
    if (a.status === "applied") btns.append(act(a, "ambApprove", "Approve and email the agreement"), act(a, "ambDecline", "Decline", "ghost"));
    if (a.status === "approved") btns.append(E("span", { class: "muted small" }, `Agreement emailed ${day(a.approved_at)}. Waiting for them to accept.`), act(a, "ambApprove", "Resend the email", "ghost"), act(a, "ambDecline", "Decline", "ghost"));
    if (a.status === "accepted") {
      const lab = E("label", { class: "small muted" }, "Their code");
      const inp = E("input", { type: "text", value: suggest(a.name), maxlength: "12", "aria-label": "Custom code", class: "codein" });
      inp.addEventListener("input", () => { inp.value = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, ""); });
      const go = E("button", { type: "button" }, "Activate with this code");
      go.addEventListener("click", async () => {
        const msg = c.querySelector(".ambmsg");
        if (!/^[A-Z0-9]{4,12}$/.test(inp.value)) { msg.textContent = "Codes are 4 to 12 letters and numbers."; return; }
        go.disabled = true; msg.textContent = "Working…";
        try { const r = await window.kedgeCall({ action: "ambActivate", id: a.id, code: inp.value }); flash = `${a.name}: ${r.result}`; await load(); }
        catch (e) { msg.textContent = e.message; go.disabled = false; }
      });
      btns.append(lab, inp, go, act(a, "ambEnd", "End", "ghost", `End ${a.name}'s ambassador agreement?`));
    }
    if (a.status === "active") {
      const box = E("div", { class: "ambactive" });
      box.append(E("p", {}, `Code ${a.code} · ${a.joined} joined · active since ${day(a.activated_at)}`));
      if (a.money) box.append(E("p", { class: "small" }, `Earned ${money(a.money.earned)} · paid ${money(a.money.paid)} · due now ${money(Math.max(0, a.money.dueNow))}` + (a.money.nextMonth ? ` · ${money(a.money.nextMonth)} more due next month` : "") + (a.money.dueNow < 0 ? ` · ${money(-a.money.dueNow)} to take off the next payout (refunds)` : "")));
      box.append(E("p", { class: "small muted" }, a.link));
      const pay = E("div", { class: "paper" });
      const w9 = E("label", { class: "check" }); const w9i = E("input", { type: "checkbox" }); w9i.checked = !!a.w9_received_at;
      w9.append(w9i, document.createTextNode("W-9 received" + (a.w9_received_at ? ` (${day(a.w9_received_at)})` : "")));
      const sel = E("select", { "aria-label": "Payout method" });
      for (const [v, t] of [["", "Payout method…"], ["ACH", "Direct deposit (ACH)"], ["PayPal", "PayPal"]]) { const o = E("option", { value: v }, t); if ((a.payout_method || "") === v) o.selected = true; sel.append(o); }
      const det = E("label", { class: "check" }); const deti = E("input", { type: "checkbox" }); deti.checked = !!a.payout_details_received_at;
      det.append(deti, document.createTextNode("Payout details received"));
      const save = async (fields) => { const msg = c.querySelector(".ambmsg"); msg.textContent = "Saving…"; try { await window.kedgeCall({ action: "ambUpdate", id: a.id, ...fields }); await load(); } catch (e) { msg.textContent = e.message; } };
      w9i.addEventListener("change", () => save({ w9: w9i.checked }));
      sel.addEventListener("change", () => save({ payoutMethod: sel.value }));
      deti.addEventListener("change", () => save({ payoutDetails: deti.checked }));
      pay.append(w9, sel, det);
      box.append(pay);
      box.append(E("p", { class: a.payoutBlockers.length ? "warnline" : "okline" },
        a.payoutBlockers.length ? "Can't pay yet: " + a.payoutBlockers.join(", ") + "." : "Ready to be paid."));
      c.append(box);
      btns.append(act(a, "ambNewLink", "Email a new page link", "ghost"), act(a, "ambEnd", "End", "ghost", `End ${a.name}'s ambassador agreement? Their code stops working for new sign-ups.`));
    }
    c.append(btns, E("p", { class: "ambmsg small muted" }));
    return c;
  }
  function render() {
    const host = document.getElementById("amb");
    if (!host) return;
    host.replaceChildren();
    if (flash) host.append(E("p", { class: "okline", role: "status" }, flash));
    const groups = [
      ["applied", "New applications", "Approve to email them the agreement."],
      ["approved", "Agreement sent", "They accept it online at kedge.fit."],
      ["accepted", "Ready to activate", "They accepted the agreement. Activate to make their code, link and page."],
      ["active", "Active ambassadors", "Get the W-9 and payout details before their first payout. Never keep a Social Security number in email or here."],
    ];
    for (const [status, title, hint] of groups) {
      const rows = list.filter((a) => a.status === status);
      const s = E("section");
      s.append(E("h2", {}, `${title} (${rows.length})`), E("p", { class: "muted small" }, hint));
      if (!rows.length) s.append(E("p", { class: "empty" }, "None right now."));
      for (const a of rows) s.append(card(a));
      host.append(s);
    }
    // Payouts due this month: everyone with at least the minimum due, ready or not, so nothing is forgotten.
    const due = list.filter((a) => a.money && a.money.dueNow >= minPayout);
    const ps = E("section");
    ps.append(E("h2", {}, `Payouts due (${due.length})`), E("p", { class: "muted small" }, `Pay by the 15th for everything earned before the 1st. Under ${money(minPayout)} waits until next month. Send the money yourself, then record it here.`));
    if (!due.length) ps.append(E("p", { class: "empty" }, "Nothing due right now."));
    for (const a of due) {
      const r = E("article", { class: "item amb" });
      r.append(E("p", {}, `${a.name} · ${money(a.money.dueNow)} due · ${a.payout_method || "no payout method yet"}`));
      if (a.payoutBlockers.length) r.append(E("p", { class: "warnline" }, "Can't pay yet: " + a.payoutBlockers.join(", ") + "."));
      else {
        const amt = E("input", { type: "number", step: "0.01", min: "0", value: a.money.dueNow.toFixed(2), "aria-label": "Amount sent", class: "amtin" });
        const note = E("input", { type: "text", placeholder: "Note (optional), e.g. PayPal transaction id", "aria-label": "Note" });
        const b = E("button", { type: "button" }, "I sent it: record payout");
        b.addEventListener("click", async () => {
          const msg = r.querySelector(".ambmsg");
          if (!confirm(`Record ${money(amt.value)} sent to ${a.name} by ${a.payout_method}?`)) return;
          b.disabled = true; msg.textContent = "Saving…";
          try { const out = await window.kedgeCall({ action: "ambPaid", id: a.id, amount: Number(amt.value), method: a.payout_method, note: note.value }); flash = `${a.name}: ${out.result}`; await load(); }
          catch (e) { msg.textContent = e.message; b.disabled = false; }
        });
        const row2 = E("div", { class: "row" }); row2.append(amt, note, b); r.append(row2);
      }
      r.append(E("p", { class: "ambmsg small muted" }));
      ps.append(r);
    }
    host.insertBefore(ps, host.children[flash ? 1 : 0] || null);

    const old = list.filter((a) => a.status === "declined" || a.status === "ended");
    if (old.length) {
      const d = E("details"); d.append(E("summary", {}, `Declined or ended (${old.length})`));
      for (const a of old) d.append(E("p", { class: "small muted" }, `${a.name} · ${a.email} · ${a.status} ${day(a.ended_at || a.applied_at)}` + (a.money ? ` · earned ${money(a.money.earned)}, paid ${money(a.money.paid)}` : "")));
      host.append(d);
    }
    const n = list.filter((a) => a.status === "applied" || a.status === "accepted").length;
    const count = document.getElementById("ambcount");
    if (count) count.textContent = n ? String(n) : "";
  }
  async function load() {
    try { const r = await window.kedgeCall({ action: "ambassadors" }); list = r.ambassadors || []; minPayout = r.minPayout || 25; }
    catch (e) { const host = document.getElementById("amb"); if (host) host.replaceChildren(E("p", { class: "empty" }, "Couldn't load ambassadors: " + e.message)); return; }
    render();
  }
  window.loadAmbassadors = load;
})();
