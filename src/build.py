"""Build index.html from template.html + legal/*.md."""
import pathlib, re, markdown

ROOT = pathlib.Path(__file__).parent  # src/; writes ../index.html
EMAIL = "info@kedge.fit"
MAILTO = '<a href="mailto:info@kedge.fit">info@kedge.fit</a>'
ADDR_REQ = ('<a href="mailto:info@kedge.fit?subject=Mailing%20address%20request">'
            'mailing address available on request</a>')

REPL = [
    ("- **By mail:** [COMPANY NAME, LLC], [MAILING ADDRESS].",
     "- **By mail:** email " + MAILTO + " and we'll send you our mailing address."),
    ("{{APP}}", "Kedge"),
    ("[COMPANY NAME, LLC]", "Kedge Fit LLC"),
    ("[MAILING ADDRESS]", ADDR_REQ),
    ("[PRIVACY EMAIL]", MAILTO),
    ("[SUPPORT EMAIL]", MAILTO),
    (" ([PROVIDER])", ""),
    ("Effective date: [DATE]", "Effective date: not yet in effect. This draft takes effect when the app launches."),
]

SUPPORT_BTN = ('\n\n<p><a class="btn-link" href="mailto:info@kedge.fit?subject=Mailing%20address%20request">'
               'Request our mailing address</a></p>\n')

DRAFT = '<p class="draft">Draft. This page will be finalized and reviewed by a lawyer before the app launches.</p>'
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
    html = re.sub(r"(</h1>)", r"\1" + DRAFT, html, count=1)
    parts.append(f'<main class="doc" id="doc-{slug}" hidden>\n  <div class="wrap">\n'
                 f'    <a class="back" href="#">← Back to Kedge</a>\n{html}\n  </div>\n</main>')

out = fill((ROOT / "template.html").read_text()).replace("<!--LEGAL-->", "\n".join(parts))
left = sorted(set(re.findall(r"\[[A-Z][A-Z ,]*\]|\{\{\w+\}\}", out)))
(ROOT.parent / "index.html").write_text(out)
print("built index.html; leftover placeholders:", left)
