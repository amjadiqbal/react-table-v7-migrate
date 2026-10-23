"""Generate SVG art for @amjadiqbal/react-table-v7-migrate."""
import sys, os

OUT = sys.argv[1]
SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif"
MONO = "Menlo, 'SF Mono', Consolas, monospace"

# Accent: indigo (siblings use emerald, sky, lime, violet, pink, teal, cyan). No brown, no warm fills.
DARK = dict(bg1="#0B1220", bg2="#111C33", text="#F8FAFC", accent="#818CF8", sub="#C7D2FE",
            muted="#64748B", chip="#16213A", chipstroke="#24324F", chiptext="#CBD5E1",
            foot="#64748B", panel="#0F172A", panelstroke="#24324F", old="#64748B", new="#A5B4FC",
            code="#E2E8F0")
LIGHT = dict(bg1="#F8FAFC", bg2="#E8EEF6", text="#0F172A", accent="#4F46E5", sub="#4338CA",
             muted="#475569", chip="#FFFFFF", chipstroke="#CBD5E1", chiptext="#334155",
             foot="#64748B", panel="#FFFFFF", panelstroke="#CBD5E1", old="#94A3B8", new="#4338CA",
             code="#1E293B")


def mini_table(x, y, w, h, head, body, rows, label, label_fill, label_text):
    r = []
    r.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="22" fill="{body}"/>')
    r.append(f'<path d="M{x} {y+22} a22 22 0 0 1 22 -22 h{w-44} a22 22 0 0 1 22 22 v26 h-{w} z" fill="{head}"/>')
    for i in range(rows):
        ry = y + 66 + i * 30
        r.append(f'<rect x="{x+20}" y="{ry}" width="{w*0.32:.0f}" height="12" rx="6" fill="{label_fill}" opacity="0.85"/>')
        r.append(f'<rect x="{x+20+w*0.40:.0f}" y="{ry}" width="{w*0.40:.0f}" height="12" rx="6" fill="{label_fill}" opacity="0.55"/>')
    r.append(f'<text x="{x+w/2}" y="{y+h+52}" text-anchor="middle" font-family="{SANS}" font-size="44" font-weight="800" fill="{label_text}">{label}</text>')
    return "".join(r)


def icon_body():
    """512x512 icon: a faded v7 table becomes a bright v9 table."""
    return f"""
  <defs>
    <linearGradient id="ibg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0F172A"/><stop offset="1" stop-color="#131C3F"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#ibg)"/>
  {mini_table(44, 126, 170, 190, "#334155", "#1E293B", 4, "v7", "#64748B", "#94A3B8")}
  {mini_table(298, 126, 170, 190, "#818CF8", "#1E2550", 4, "v9", "#C7D2FE", "#C7D2FE")}
  <g stroke="#818CF8" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M228 221 H282"/><path d="M262 199 L284 221 L262 243"/>
  </g>
  <path d="M352 150 l9 12 l9 -12 z" fill="#0F172A"/>
"""


def icon_svg():
    return f'<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">{icon_body()}</svg>\n'


def chips(x, y, labels, c, size=15, h=32, gap=10, cw=8.6):
    out, cx = [], x
    for lab in labels:
        w = round(len(lab) * cw + 36)
        out.append(f'<g transform="translate({cx},{y})"><rect width="{w}" height="{h}" rx="{h/2}" fill="{c["chip"]}" stroke="{c["chipstroke"]}"/>'
                   f'<text x="{w/2}" y="{h*0.66:.1f}" text-anchor="middle">{lab}</text></g>')
        cx += w + gap
    return (f'<g font-family="{SANS}" font-size="{size}" font-weight="600" fill="{c["chiptext"]}">' + "".join(out) + "</g>")


DIFF = [
    ("-", "accessor: 'age',"),
    ("+", "accessorKey: 'age',"),
    ("-", "cell.render('Cell')"),
    ("+", "flexRender(columnDef.cell, …)"),
]


def card(x, y, w, c, s=1.0):
    """A small diff card: removed v7 lines (muted, struck), added v9 lines (accent)."""
    lh = 26 * s
    h = lh * len(DIFF) + 24 * s
    g = [f'<g font-family="{MONO}">',
         f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{12*s}" fill="{c["panel"]}" stroke="{c["panelstroke"]}"/>']
    for i, (sign, txt) in enumerate(DIFF):
        ty = y + 30 * s + i * lh
        col = c["old"] if sign == "-" else c["new"]
        deco = ' text-decoration="line-through"' if sign == "-" else ' font-weight="700"'
        g.append(f'<text x="{x+16*s}" y="{ty:.1f}" font-size="{14*s:.1f}" fill="{col}"{deco} xml:space="preserve">{sign} {txt}</text>')
    g.append("</g>")
    return "".join(g)


TITLE = "react-table v7 → v9"


def banner(c, name):
    return f'''<svg width="1200" height="300" viewBox="0 0 1200 300" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{c["bg1"]}"/><stop offset="1" stop-color="{c["bg2"]}"/></linearGradient></defs>
  <rect width="1200" height="300" fill="url(#bg)"/>
  <g transform="translate(60,75) scale({150/512:.5f})">{icon_body()}</g>
  <text x="238" y="98" font-family="{MONO}" font-size="16" font-weight="600" fill="{c["accent"]}">codemod + compat layer</text>
  <text x="235" y="160" font-family="{SANS}" font-size="56" font-weight="700" fill="{c["text"]}">{TITLE}</text>
  <text x="238" y="198" font-family="{SANS}" font-size="22" font-weight="500" fill="{c["sub"]}">Move react-table v7 apps to TanStack Table v9 and React 19.</text>
  {chips(238, 220, ["useSortBy", "useFilters", "usePagination", "useRowSelect"], c)}
  {card(850, 52, 320, c, 0.86)}
  <text x="1160" y="285" text-anchor="end" font-family="{SANS}" font-size="15" fill="{c["foot"]}">{name}</text>
</svg>
'''


def social(c, name):
    return f'''<svg width="1280" height="640" viewBox="0 0 1280 640" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{c["bg1"]}"/><stop offset="1" stop-color="{c["bg2"]}"/></linearGradient></defs>
  <rect width="1280" height="640" fill="url(#bg)"/>
  <g transform="translate(80,96) scale({176/512:.5f})">{icon_body()}</g>
  <text x="292" y="128" font-family="{MONO}" font-size="20" font-weight="600" fill="{c["accent"]}">{name}</text>
  <text x="288" y="208" font-family="{SANS}" font-size="70" font-weight="700" fill="{c["text"]}">{TITLE}</text>
  <text x="292" y="256" font-family="{SANS}" font-size="28" font-weight="500" fill="{c["sub"]}">A codemod and a compat layer for TanStack Table v9 and React 19</text>
  {chips(80, 320, ["useTable", "useSortBy", "useFilters", "useGlobalFilter"], c, size=18, h=40, gap=12, cw=10.2)}
  {chips(80, 372, ["usePagination", "useRowSelect", "useExpanded"], c, size=18, h=40, gap=12, cw=10.2)}
  {chips(80, 424, ["dry-run report", "TODO notes where unsafe"], c, size=18, h=40, gap=12, cw=10.2)}
  {card(720, 330, 480, c, 1.0)}
  <text x="80" y="590" font-family="{SANS}" font-size="20" fill="{c["foot"]}">npx @amjadiqbal/react-table-v7-migrate src · Free and open source · MIT · by Amjad</text>
</svg>
'''


NAME = "@amjadiqbal/react-table-v7-migrate"
files = {
    "icon.svg": icon_svg(),
    "banner-dark.svg": banner(DARK, NAME),
    "banner-light.svg": banner(LIGHT, NAME),
    "social-preview.svg": social(DARK, NAME),
}
for fn, s in files.items():
    with open(os.path.join(OUT, fn), "w") as f:
        f.write(s)
print("wrote", ", ".join(files))
