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
  let list = [], flash = "";

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
    if (a.status === "accepted") btns.append(act(a, "ambActivate", "Activate: make their code and page, email them"), act(a, "ambEnd", "End", "ghost", `End ${a.name}'s ambassador agreement?`));
    if (a.status === "active") {
      const box = E("div", { class: "ambactive" });
      box.append(E("p", {}, `Code ${a.code} · ${a.joined} joined · active since ${day(a.activated_at)}`));
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
    const old = list.filter((a) => a.status === "declined" || a.status === "ended");
    if (old.length) {
      const d = E("details"); d.append(E("summary", {}, `Declined or ended (${old.length})`));
      for (const a of old) d.append(E("p", { class: "small muted" }, `${a.name} · ${a.email} · ${a.status} ${day(a.ended_at || a.applied_at)}`));
      host.append(d);
    }
    const n = list.filter((a) => a.status === "applied" || a.status === "accepted").length;
    const count = document.getElementById("ambcount");
    if (count) count.textContent = n ? String(n) : "";
  }
  async function load() {
    try { list = (await window.kedgeCall({ action: "ambassadors" })).ambassadors || []; }
    catch (e) { const host = document.getElementById("amb"); if (host) host.replaceChildren(E("p", { class: "empty" }, "Couldn't load ambassadors: " + e.message)); return; }
    render();
  }
  window.loadAmbassadors = load;
})();
