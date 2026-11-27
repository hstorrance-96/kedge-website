"""Build the ambassador accept page and private ambassador page from ambassadors/index.html's look + agreement.md.
Run: python3 src/ambassadors/build.py"""
import pathlib, markdown
ROOT = pathlib.Path(__file__).resolve().parents[2]
base = (ROOT / "ambassadors" / "index.html").read_text()
head = base[:base.index("</style>")]
foot = base[base.index("<footer>"):base.index("<script>")]
agreement = markdown.markdown((pathlib.Path(__file__).parent / "agreement.md").read_text(), extensions=["tables"])
API = "https://jkaszobhblvpupaayyoy.supabase.co/functions/v1/ambassador"
EXTRA_CSS = """.doc h2 { font-size: 30px; margin: 36px 0 10px; }
.doc table { border-collapse: collapse; width: 100%; font-size: 16px; } .doc th, .doc td { text-align: left; padding: 8px 8px 8px 0; border-bottom: 1px solid var(--rule); vertical-align: top; }
.doc li { margin: 6px 0; }
.big { font: 900 clamp(30px, 10vw, 54px)/1 var(--display); letter-spacing: 2px; margin: 6px 0 0; overflow-wrap: anywhere; }
.panel { margin: 28px 0 0; background: var(--paper); border: 2px solid var(--ink); border-radius: 16px; padding: 22px 24px; }
.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 28px 0 0; }
.stats div { background: var(--paper); border: 1px solid var(--rule); border-radius: 12px; padding: 14px; }
.stats b { display: block; font: 900 40px/1 var(--display); } .stats span { font-size: 15px; color: var(--graphite); }
@media (max-width: 560px) { .stats { grid-template-columns: 1fr 1fr; } }
.copyrow { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; } .copyrow code { font-size: 16px; word-break: break-all; }
.copy { height: 44px; padding: 0 16px; font-size: 16px; }
.todo { list-style: none; padding: 0; margin: 10px 0 0; } .todo li { padding: 8px 0; border-bottom: 1px solid var(--rule); }
.todo li::before { content: "○ "; color: var(--red); font-weight: 700; } .todo li.done::before { content: "✓ "; color: var(--green); } .todo.plain li::before { content: ""; }
details summary { cursor: pointer; font-weight: 600; margin-top: 28px; }
"""
def page(title, body, script):
    h = head.replace("<title>Kedge ambassadors: earn for every member you bring</title>", f"<title>{title}</title>")
    h = h.replace('<meta name="viewport"', '<meta name="robots" content="noindex">\n<meta name="referrer" content="no-referrer">\n<meta name="viewport"', 1)
    return h + EXTRA_CSS + "</style>\n</head>\n<body>\n" + base[base.index('<header class="top">'):base.index("<main")] + body + "\n" + foot + "<script>\nvar API = \"" + API + "\";\nvar T = (location.hash.match(/t=([A-Za-z0-9_-]+)/) || [])[1] || \"\";\n" + script + "\n</script>\n</body>\n</html>\n"

accept = page("Kedge ambassador agreement", f"""<main class="wrap">
  <h1 id="hi">Your ambassador agreement.</h1>
  <p class="lede" id="lede">Loading…</p>
  <div class="doc" id="doc" hidden>{agreement}</div>
  <form id="acc" hidden novalidate>
    <h2>Accept</h2>
    <div><label for="legal">Your full legal name</label><input id="legal" type="text" autocomplete="name" required></div>
    <label class="agree"><input type="checkbox" id="agree"> I've read the Kedge Ambassador Agreement (version <span id="ver"></span>) and I agree to it.</label>
    <button type="submit">Accept the agreement</button>
    <p class="note" id="note" role="status"></p>
  </form>
</main>""", """
var lede = document.getElementById("lede");
function call(body) { return fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || "Something went wrong."); return j; }); }); }
if (!T) { lede.textContent = "This page needs the link from your approval email."; }
else call({ action: "terms", t: T }).then(function (d) {
  var first = d.name.split(/\\s+/)[0];
  document.getElementById("hi").textContent = "Welcome, " + first + ".";
  document.getElementById("ver").textContent = d.version;
  document.getElementById("doc").hidden = false;
  if (d.status !== "approved") { lede.textContent = "You've already accepted. Hunter will email your code and ambassador page once you're set up."; return; }
  lede.textContent = "Read it through, then accept at the bottom. It covers what you earn, when you're paid and the ground rules.";
  document.getElementById("acc").hidden = false;
}).catch(function (e) { lede.textContent = e.message; });
document.getElementById("acc").addEventListener("submit", function (e) {
  e.preventDefault();
  var note = document.getElementById("note"), legal = document.getElementById("legal").value.trim();
  note.className = "note";
  if (legal.length < 3 || legal.indexOf(" ") < 0) { note.textContent = "Type your full legal name, first and last."; note.classList.add("err"); return; }
  if (!document.getElementById("agree").checked) { note.textContent = "Tick the box to accept."; note.classList.add("err"); return; }
  note.textContent = "Saving…";
  call({ action: "accept", t: T, legalName: legal, agree: true }).then(function () {
    e.target.hidden = true; lede.textContent = "Done, thank you. Hunter will set up your code and ambassador page and email you the details.";
    window.scrollTo({ top: 0 });
  }).catch(function (x) { note.textContent = x.message; note.classList.add("err"); });
});
""")

me = page("Your Kedge ambassador page", f"""<main class="wrap">
  <h1 id="hi">Your ambassador page.</h1>
  <p class="lede" id="lede">Loading…</p>
  <div id="body" hidden>
    <div class="panel"><div>Your code</div><p class="big" id="code"></p><p class="fine">People type it in Kedge when they join to get their first month free.</p></div>
    <div class="panel"><div>Your share link</div><div class="copyrow"><code id="link"></code><button type="button" class="copy" id="copy">Copy</button></div><p class="fine">Same free month, no typing.</p></div>
    <div class="stats">
      <div><b id="joined">0</b><span>Joined with your code</span></div>
      <div><b id="paying">0</b><span>Paying members now</span></div>
      <div><b id="earned">–</b><span>Earned so far</span></div>
    </div>
    <p class="fine" id="earnnote" style="margin-top:10px"></p>
    <div class="panel" id="hist" hidden><div><b>Recent earnings</b></div><ul class="todo plain" id="recent"></ul><div id="paidwrap" hidden><div style="margin-top:14px"><b>Payouts</b></div><ul class="todo plain" id="paid"></ul></div></div>
    <div class="panel"><div><b>Before your first payout</b></div><ul class="todo" id="todo"></ul><p class="fine" style="margin-top:10px">Hunter will reach out about these. Never send your Social Security number by email.</p></div>
    <details><summary>Your agreement</summary><div class="doc">{agreement}</div></details>
    <p class="fine" style="margin-top:28px">This page is private to you. Don't share its link. When you post, always say you earn from your code ("#ad" works).</p>
  </div>
</main>""", """
var lede = document.getElementById("lede");
if (!T) { lede.textContent = "This page needs the link from your welcome email."; }
else fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "me", t: T }) })
  .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || "Something went wrong."); return j; }); })
  .then(function (d) {
    document.getElementById("hi").textContent = "Hi, " + d.name.split(/\\s+/)[0] + ".";
    lede.textContent = "Here's your code, your link and how it's going.";
    document.getElementById("code").textContent = d.code;
    document.getElementById("link").textContent = d.link;
    document.getElementById("joined").textContent = d.joined;
    document.getElementById("paying").textContent = d.paying;
    var m = function (n) { return "$" + Number(n || 0).toFixed(2); };
    document.getElementById("earned").textContent = m(d.earned);
    document.getElementById("earnnote").textContent = "Paid so far: " + m(d.paid) + ". In your next payout (by the 15th): " + m(d.dueNow) + (d.dueNow > 0 && d.dueNow < d.minPayout ? " (under " + m(d.minPayout) + ", so it rolls into the month after)" : "") + (d.nextMonth ? ". Earned this month, paid next month: " + m(d.nextMonth) : "") + ".";
    var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
    if (d.recent && d.recent.length) {
      document.getElementById("recent").innerHTML = d.recent.map(function (e) { return "<li>" + esc(e.on) + ": " + m(e.amount) + " · " + esc(e.reason) + "</li>"; }).join("");
      document.getElementById("hist").hidden = false;
    }
    if (d.payouts && d.payouts.length) {
      document.getElementById("paid").innerHTML = d.payouts.map(function (p) { return "<li>" + esc(p.on) + ": " + m(p.amount) + " by " + esc(p.method) + "</li>"; }).join("");
      document.getElementById("paidwrap").hidden = false; document.getElementById("hist").hidden = false;
    }
    var items = [["W-9 tax form", d.missing.indexOf("W-9 not received") < 0], ["How you'd like to be paid (direct deposit or PayPal)", !d.missing.some(function (m) { return /Payout method|details/.test(m); })]];
    document.getElementById("todo").innerHTML = items.map(function (i) { return '<li class="' + (i[1] ? "done" : "") + '">' + i[0] + (i[1] ? ": received" : ": needed") + "</li>"; }).join("");
    document.getElementById("body").hidden = false;
  }).catch(function (e) { lede.textContent = e.message; });
document.getElementById("copy").addEventListener("click", function () {
  var t = document.getElementById("link").textContent, b = this;
  (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { b.textContent = "Copied"; setTimeout(function () { b.textContent = "Copy"; }, 1500); }).catch(function () { b.textContent = "Select and copy"; });
});
""")
for name, html in [("accept", accept), ("me", me)]:
    d = ROOT / "ambassadors" / name; d.mkdir(exist_ok=True); (d / "index.html").write_text(html)
print("built ambassadors/accept and ambassadors/me")
