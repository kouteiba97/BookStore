#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Lightweight Markdown -> PDF converter (reportlab Platypus) with Arabic shaping."""
import re
import sys

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, Preformatted, ListFlowable, ListItem,
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

import arabic_reshaper
from bidi.algorithm import get_display

# ---- Fonts (Arial has Arabic glyphs on Windows) ----
pdfmetrics.registerFont(TTFont("Body", r"C:\Windows\Fonts\arial.ttf"))
pdfmetrics.registerFont(TTFont("Body-Bold", r"C:\Windows\Fonts\arialbd.ttf"))
pdfmetrics.registerFont(TTFont("Mono", r"C:\Windows\Fonts\consola.ttf"))
pdfmetrics.registerFontFamily("Body", normal="Body", bold="Body-Bold",
                              italic="Body", boldItalic="Body-Bold")

ARABIC_RE = re.compile(r"[؀-ۿ]")


def shape(text: str) -> str:
    """Reshape + bidi any Arabic runs so they render connected and RTL."""
    if not ARABIC_RE.search(text):
        return text
    # Shape the whole string; bidi handles mixed LTR/RTL ordering.
    return get_display(arabic_reshaper.reshape(text))


def esc(text: str) -> str:
    return (text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def inline(text: str) -> str:
    """Handle **bold**, `code`, then escape + shape."""
    # Protect inline code
    codes = []
    def _code(m):
        codes.append(m.group(1))
        return f"\x00{len(codes)-1}\x00"
    text = re.sub(r"`([^`]+)`", _code, text)
    text = esc(text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", text)
    text = shape(text)
    def _restore(m):
        c = esc(codes[int(m.group(1))])
        return f'<font name="Mono" size="9" color="#b91c1c">{c}</font>'
    text = re.sub(r"\x00(\d+)\x00", _restore, text)
    return text


styles = getSampleStyleSheet()
S = {
    "h1": ParagraphStyle("h1", fontName="Body-Bold", fontSize=20, leading=25,
                         textColor=colors.HexColor("#0f172a"), spaceBefore=6, spaceAfter=10),
    "h2": ParagraphStyle("h2", fontName="Body-Bold", fontSize=15, leading=20,
                         textColor=colors.HexColor("#1e3a5f"), spaceBefore=16, spaceAfter=6,
                         borderColor=colors.HexColor("#cbd5e1"), borderWidth=0, leftIndent=0),
    "h3": ParagraphStyle("h3", fontName="Body-Bold", fontSize=12.5, leading=16,
                         textColor=colors.HexColor("#334155"), spaceBefore=10, spaceAfter=4),
    "h4": ParagraphStyle("h4", fontName="Body-Bold", fontSize=11, leading=14,
                         textColor=colors.HexColor("#475569"), spaceBefore=8, spaceAfter=3),
    "body": ParagraphStyle("body", fontName="Body", fontSize=10, leading=15,
                           textColor=colors.HexColor("#1f2937"), alignment=TA_LEFT, spaceAfter=5),
    "li": ParagraphStyle("li", fontName="Body", fontSize=10, leading=14.5,
                         textColor=colors.HexColor("#1f2937")),
    "quote": ParagraphStyle("quote", fontName="Body", fontSize=9.5, leading=14,
                            textColor=colors.HexColor("#475569"), leftIndent=10,
                            borderColor=colors.HexColor("#94a3b8"), spaceAfter=6),
    "cell": ParagraphStyle("cell", fontName="Body", fontSize=8.5, leading=11.5,
                           textColor=colors.HexColor("#1f2937")),
    "cellh": ParagraphStyle("cellh", fontName="Body-Bold", fontSize=8.5, leading=11.5,
                            textColor=colors.white),
}


def parse(md_path):
    with open(md_path, encoding="utf-8") as f:
        lines = f.read().split("\n")

    story = []
    i = 0
    n = len(lines)
    while i < n:
        line = lines[i]
        stripped = line.strip()

        # Fenced code
        if stripped.startswith("```"):
            i += 1
            buf = []
            while i < n and not lines[i].strip().startswith("```"):
                buf.append(lines[i])
                i += 1
            i += 1
            code_style = ParagraphStyle("code", fontName="Mono", fontSize=8, leading=10.5,
                                        textColor=colors.HexColor("#0f172a"),
                                        backColor=colors.HexColor("#f1f5f9"),
                                        borderPadding=6, leftIndent=2)
            story.append(Preformatted("\n".join(buf), code_style))
            story.append(Spacer(1, 6))
            continue

        # Horizontal rule
        if re.match(r"^---+$", stripped):
            story.append(Spacer(1, 4))
            story.append(HRFlowable(width="100%", thickness=0.7,
                                    color=colors.HexColor("#cbd5e1")))
            story.append(Spacer(1, 4))
            i += 1
            continue

        # Headings
        m = re.match(r"^(#{1,4})\s+(.*)$", stripped)
        if m:
            level = len(m.group(1))
            key = {1: "h1", 2: "h2", 3: "h3", 4: "h4"}[level]
            story.append(Paragraph(inline(m.group(2)), S[key]))
            if level == 2:
                story.append(HRFlowable(width="100%", thickness=0.5,
                                        color=colors.HexColor("#e2e8f0"), spaceAfter=4))
            i += 1
            continue

        # Tables
        if "|" in line and i + 1 < n and re.match(r"^\s*\|?\s*:?-{2,}", lines[i + 1]):
            header = [c.strip() for c in stripped.strip("|").split("|")]
            i += 2
            rows = []
            while i < n and "|" in lines[i] and lines[i].strip():
                rows.append([c.strip() for c in lines[i].strip().strip("|").split("|")])
                i += 1
            data = [[Paragraph(inline(c), S["cellh"]) for c in header]]
            for r in rows:
                while len(r) < len(header):
                    r.append("")
                data.append([Paragraph(inline(c), S["cell"]) for c in r[:len(header)]])
            avail = A4[0] - 30 * mm
            tbl = Table(data, colWidths=[avail / len(header)] * len(header), hAlign="LEFT")
            tbl.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a5f")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1),
                 [colors.white, colors.HexColor("#f8fafc")]),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#cbd5e1")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ]))
            story.append(Spacer(1, 3))
            story.append(tbl)
            story.append(Spacer(1, 8))
            continue

        # Blockquote
        if stripped.startswith(">"):
            buf = []
            while i < n and lines[i].strip().startswith(">"):
                buf.append(lines[i].strip()[1:].strip())
                i += 1
            story.append(Paragraph(inline(" ".join(buf)), S["quote"]))
            continue

        # Lists (bullet or numbered)
        if re.match(r"^\s*([-*]|\d+\.)\s+", line):
            items = []
            ordered = bool(re.match(r"^\s*\d+\.", line))
            while i < n and re.match(r"^\s*([-*]|\d+\.)\s+", lines[i]):
                content = re.sub(r"^\s*([-*]|\d+\.)\s+", "", lines[i])
                items.append(ListItem(Paragraph(inline(content), S["li"]),
                                      leftIndent=14, value=None))
                i += 1
            story.append(ListFlowable(
                items, bulletType="1" if ordered else "bullet",
                bulletFontName="Body", bulletFontSize=9,
                bulletColor=colors.HexColor("#1e3a5f"), leftIndent=16))
            story.append(Spacer(1, 5))
            continue

        # Blank line
        if not stripped:
            i += 1
            continue

        # Paragraph (gather until blank)
        buf = [stripped]
        i += 1
        while i < n and lines[i].strip() and not re.match(
                r"^(#{1,4}\s|>|\s*([-*]|\d+\.)\s|```|---+$)", lines[i].strip()) \
                and "|" not in lines[i]:
            buf.append(lines[i].strip())
            i += 1
        story.append(Paragraph(inline(" ".join(buf)), S["body"]))

    return story


def main():
    src, out = sys.argv[1], sys.argv[2]
    doc = SimpleDocTemplate(out, pagesize=A4,
                            leftMargin=15 * mm, rightMargin=15 * mm,
                            topMargin=15 * mm, bottomMargin=15 * mm,
                            title="BookStore — Audit & Upgrade Plan")
    doc.build(parse(src))
    print(f"Wrote {out}")


if __name__ == "__main__":
    main()
