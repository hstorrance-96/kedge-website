"""Build index.html from template.html + legal/*.md."""
import os, pathlib, re, markdown

ROOT = pathlib.Path(__file__).parent  # src/; writes ../index.html
EMAIL = "info@kedge.fit"
MAILTO = '<a href="mailto:info@kedge.fit">info@kedge.fit</a>'
ADDR_REQ = '2728 Geneva St, Dearborn, MI 48124'

REPL = [
    ("- **By mail:** [COMPANY NAME, LLC], [MAILING ADDRESS].",
     "- **By mail:** Kedge Fit LLC, 2728 Geneva St, Dearborn, MI 48124."),
    ("{{APP}}", "Kedge"),
    ("[COMPANY NAME, LLC]", "Kedge Fit LLC"),
    ("[MAILING ADDRESS]", ADDR_REQ),
    ("[PRIVACY EMAIL]", MAILTO),
    ("[SUPPORT EMAIL]", MAILTO),
    ("cloud hosting and database ([PROVIDER])", "cloud hosting and database (Supabase)"),
    ("subscription management ([PROVIDER])", "subscription management (RevenueCat)"),
    ("crash reporting and analytics ([PROVIDER])", "crash reporting (Sentry)"),
    ("crash reporting ([PROVIDER])", "crash reporting (Sentry)"),
    ("email for support ([PROVIDER])", "email for support (Brevo)"),
    ("Effective date: [DATE]", "Effective date: November 19, 2026"),
    ("[30]", "30"),
    ("[35]", "35"),
]

SUPPORT_BTN = '\n\n**Mail:** Kedge Fit LLC, 2728 Geneva St, Dearborn, MI 48124\n'

DOCS = [("privacy", "privacy.md"), ("terms", "terms.md"), ("health-data", "health-data.md"), ("support", "support.md")]


def fill(text):
    for a, b in REPL:
        text = text.replace(a, b)
    return text


parts = []
for slug, fn in DOCS:
    md = fill((ROOT / "legal" / fn).read_text())
    if slug == "support":
        md = md.replace("We answer within 1–2 business days.",
                        "We answer within 1–2 business days." + SUPPORT_BTN, 1)
    html = markdown.markdown(md)
    parts.append(f'<main class="doc" id="doc-{slug}" hidden>\n  <div class="wrap">\n'
                 f'    <a class="back" href="#">← Back to Kedge</a>\n{html}\n  </div>\n</main>')

TEMPLATE = os.environ.get("KEDGE_TEMPLATE", "template.html")
OUT = os.environ.get("KEDGE_OUT", "index.html")
out = fill((ROOT / TEMPLATE).read_text()).replace("<!--LEGAL-->", "\n".join(parts))
left = sorted(set(re.findall(r"\[(?:[A-Z][A-Z ,]*|\d\d)\]|\{\{\w+\}\}|\(\[PROVIDER\]\)", out)) - {"[HEADLINE]"})
(ROOT.parent / OUT).parent.mkdir(parents=True, exist_ok=True)
(ROOT.parent / OUT).write_text(out)
print(f"built {OUT}; leftover placeholders:", left)
