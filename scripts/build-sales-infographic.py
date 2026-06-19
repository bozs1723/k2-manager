#!/usr/bin/env python3
"""สร้างอินโฟกราฟิกคู่มือพนักงานขาย (โปสเตอร์แนวตั้ง ภาษาไทย) ด้วย reportlab + Loma

ใช้ฟอนต์ TTF ที่แปลงจาก tlwg/Loma (ดู build-sales-pdf.py)
รัน: python3 scripts/build-sales-infographic.py
ผลลัพธ์: docs/sales-infographic.pdf และ docs/sales-infographic.png
"""
import os

from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont as RLTTFont

# ใช้ตัวแปลงฟอนต์ร่วมจากสคริปต์ PDF
from importlib.machinery import SourceFileLoader

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
_pdf = SourceFileLoader("buildpdf", os.path.join(HERE, "build-sales-pdf.py")).load_module()
_pdf.ensure_fonts()  # ลงทะเบียน Loma / Loma-Bold (แปลง otf->ttf ให้อัตโนมัติ)

REG, BOLD = "Loma", "Loma-Bold"

# ---- palette ----
TEAL = colors.HexColor("#0f766e")
TEAL_D = colors.HexColor("#115e59")
TEAL2 = colors.HexColor("#0d9488")
MINT = colors.HexColor("#5eead4")
MINT_BG = colors.HexColor("#f0fdfa")
MINT_CARD = colors.HexColor("# effdf9".replace(" ", ""))
LINE = colors.HexColor("#99f6e4")
INK = colors.HexColor("#1f2937")
GREY = colors.HexColor("#6b7280")
WHITE = colors.white
WARN_BG = colors.HexColor("#fff7ed")
WARN_BAR = colors.HexColor("#f97316")
WARN_INK = colors.HexColor("#9a3412")

W, H = 820, 1840
MX = 40  # margin x


def main():
    out_pdf = os.path.join(ROOT, "docs", "sales-infographic.pdf")
    c = canvas.Canvas(out_pdf, pagesize=(W, H))

    def top(y):
        return H - y

    def center_text(txt, cx, y_top, font=BOLD, size=14, col=INK):
        c.setFont(font, size)
        c.setFillColor(col)
        c.drawCentredString(cx, top(y_top) - size, txt)

    def text(txt, x, y_top, font=REG, size=12, col=INK):
        c.setFont(font, size)
        c.setFillColor(col)
        c.drawString(x, top(y_top) - size, txt)

    def rrect(x, yt, w, h, r, fill=None, stroke=None, sw=1):
        c.saveState()
        if fill:
            c.setFillColor(fill)
        if stroke:
            c.setStrokeColor(stroke)
            c.setLineWidth(sw)
        c.roundRect(x, top(yt) - h, w, h, r, stroke=1 if stroke else 0, fill=1 if fill else 0)
        c.restoreState()

    # ---------- พื้นหลัง ----------
    c.setFillColor(MINT_BG)
    c.rect(0, 0, W, H, fill=1, stroke=0)

    # ---------- ส่วนหัว ----------
    head_h = 150
    c.setFillColor(TEAL)
    c.rect(0, H - head_h, W, head_h, fill=1, stroke=0)
    c.setFillColor(MINT)
    c.rect(0, H - head_h - 8, W, 8, fill=1, stroke=0)
    center_text("คู่มือพนักงานขาย", W / 2, 52, BOLD, 40, WHITE)
    center_text("ระบบ K2 Manager · ทำตามนี้ทุกวัน งานไม่ตกหล่น", W / 2, 104, REG, 17, colors.HexColor("#ccfbf1"))

    # ---------- ไอคอนเวกเตอร์ ----------
    def badge_circle(cx, cy, r, fill):
        c.setFillColor(fill)
        c.circle(cx, cy, r, fill=1, stroke=0)

    def ic_clock(cx, cy, s):
        c.setStrokeColor(WHITE); c.setLineWidth(2.2)
        c.circle(cx, cy, s, fill=0, stroke=1)
        c.line(cx, cy, cx, cy + s * 0.55)
        c.line(cx, cy, cx + s * 0.45, cy)

    def ic_person(cx, cy, s):
        c.setFillColor(WHITE); c.setStrokeColor(WHITE); c.setLineWidth(2.2)
        c.circle(cx, cy + s * 0.45, s * 0.42, fill=1, stroke=0)
        c.saveState()
        p = c.beginPath()
        p.moveTo(cx - s * 0.75, cy - s * 0.75)
        p.curveTo(cx - s * 0.75, cy + s * 0.15, cx + s * 0.75, cy + s * 0.15, cx + s * 0.75, cy - s * 0.75)
        c.drawPath(p, stroke=1, fill=0)
        c.restoreState()

    def ic_doc(cx, cy, s):
        c.setStrokeColor(WHITE); c.setLineWidth(2.2)
        c.rect(cx - s * 0.55, cy - s * 0.8, s * 1.1, s * 1.6, fill=0, stroke=1)
        for i, dy in enumerate((0.45, 0.1, -0.25)):
            c.line(cx - s * 0.3, cy + s * dy, cx + s * 0.3, cy + s * dy)

    def ic_money(cx, cy, s):
        c.setStrokeColor(WHITE); c.setLineWidth(2.2)
        c.roundRect(cx - s * 0.8, cy - s * 0.5, s * 1.6, s * 1.0, 3, fill=0, stroke=1)
        c.circle(cx, cy, s * 0.28, fill=0, stroke=1)

    def ic_check(cx, cy, s):
        c.setStrokeColor(WHITE); c.setLineWidth(3.2); c.setLineCap(1)
        c.line(cx - s * 0.6, cy, cx - s * 0.1, cy - s * 0.55)
        c.line(cx - s * 0.1, cy - s * 0.55, cx + s * 0.7, cy + s * 0.6)

    def ic_flag(cx, cy, s):
        c.setStrokeColor(WHITE); c.setLineWidth(2.2); c.setFillColor(WHITE)
        c.line(cx - s * 0.55, cy - s * 0.8, cx - s * 0.55, cy + s * 0.85)
        p = c.beginPath()
        p.moveTo(cx - s * 0.55, cy + s * 0.85)
        p.lineTo(cx + s * 0.7, cy + s * 0.5)
        p.lineTo(cx - s * 0.55, cy + s * 0.15)
        p.close()
        c.drawPath(p, fill=1, stroke=0)

    def ic_download(cx, cy, s):
        c.setStrokeColor(WHITE); c.setLineWidth(2.2); c.setLineCap(1)
        c.line(cx, cy + s * 0.7, cx, cy - s * 0.3)
        c.line(cx - s * 0.4, cy + s * 0.05, cx, cy - s * 0.35)
        c.line(cx + s * 0.4, cy + s * 0.05, cx, cy - s * 0.35)
        c.line(cx - s * 0.7, cy - s * 0.7, cx + s * 0.7, cy - s * 0.7)

    def ic_bars(cx, cy, s):
        c.setFillColor(WHITE)
        for i, hh in enumerate((0.6, 1.0, 0.4)):
            bx = cx - s * 0.6 + i * (s * 0.6)
            c.rect(bx, cy - s * 0.7, s * 0.32, s * 1.4 * hh, fill=1, stroke=0)

    icons = [ic_clock, ic_person, ic_doc, ic_money, ic_check, ic_flag, ic_download, ic_bars]

    # ---------- ขั้นตอน 8 ข้อ ----------
    steps = [
        ("เข้างาน — ลงเวลา", ["เช็คอินด้วยเซลฟี่ + เปิด GPS", "เลิกงานกดเช็คเอาท์ทุกครั้ง"]),
        ("รับลูกค้า", ["เพิ่มลูกค้าใหม่: ชื่อ · เบอร์ · LINE", "ขอใบกำกับภาษี = กรอกข้อมูลภาษีให้ครบ"]),
        ("เปิดงาน / ใบสั่งงาน", ["เลือกประเภทงาน + ราคา + มัดจำ + กำหนดส่ง", "งานที่เซลเปิด รอผู้จัดการสาขายอมรับก่อน"]),
        ("รับมัดจำ", ["กรอกยอดมัดจำ + แนบสลิป", "รอการเงินยืนยัน » \"มัดจำแล้ว\" จึงเข้าผลิต"]),
        ("ตรวจงานดีไซน์", ["ดีไซเนอร์ส่งให้เซลตรวจ » ส่งลูกค้าดู", "ลูกค้าโอเคกด \"ยืนยัน\" / ขอแก้กด \"ตีกลับ\""]),
        ("ปิดงาน", ["รับยอดคงเหลือ + แนบสลิป", "ดันสถานะจนถึง \"เสร็จสิ้น\""]),
        ("ออกเอกสารให้ลูกค้า", ["ดาวน์โหลดใบเสนอราคา / ใบสั่งงาน", "ระบบออกเลขที่เอกสารให้อัตโนมัติ"]),
        ("รายงานเย็นอัตโนมัติ", ["ทุก 18:30 สรุปเช็คอิน/เอาท์ + OT เข้ากลุ่ม LINE", "20:00 สรุปงานเสร็จ + เงินรับเข้าวันนี้"]),
    ]

    y = head_h + 34
    card_h = 138
    gap = 16
    badge_r = 30
    bx = MX + badge_r + 6           # ศูนย์กลางเลขลำดับ
    card_x = bx + badge_r + 18
    card_w = W - card_x - MX

    for i, (title, lines) in enumerate(steps):
        cy_center = top(y + card_h / 2)
        # เส้นเชื่อมระหว่างขั้นตอน
        if i < len(steps) - 1:
            c.setStrokeColor(LINE); c.setLineWidth(3)
            c.line(bx, cy_center - badge_r, bx, cy_center - card_h + 4)
        # การ์ด
        rrect(card_x, y, card_w, card_h, 14, fill=WHITE, stroke=LINE, sw=1.2)
        c.setFillColor(MINT_BG)
        c.roundRect(card_x, top(y) - card_h, 8, card_h, 4, fill=1, stroke=0)
        # ไอคอนวงกลมขวา
        icx, icy = card_x + card_w - 52, cy_center
        badge_circle(icx, icy, 30, MINT_BG)
        c.setStrokeColor(LINE); c.setLineWidth(1)
        c.circle(icx, icy, 30, fill=0, stroke=1)
        c.setStrokeColor(TEAL2)
        icons[i](icx, icy, 15)
        # หัวข้อ + บรรยาย
        text(title, card_x + 26, y + 38, BOLD, 19, TEAL_D)
        text(lines[0], card_x + 26, y + 72, REG, 13.5, INK)
        if len(lines) > 1:
            text(lines[1], card_x + 26, y + 98, REG, 13.5, GREY)
        # เลขลำดับ
        badge_circle(bx, cy_center, badge_r, TEAL)
        c.setFont(BOLD, 30); c.setFillColor(WHITE)
        c.drawCentredString(bx, cy_center - 11, str(i + 1))

        y += card_h + gap

    # ---------- กล่องข้อควรจำ ----------
    y += 6
    warn_h = 150
    rrect(MX, y, W - 2 * MX, warn_h, 14, fill=WARN_BG, stroke=WARN_BAR, sw=1.4)
    c.setFillColor(WARN_BAR)
    c.roundRect(MX, top(y) - warn_h, 8, warn_h, 4, fill=1, stroke=0)
    text("ข้อควรจำ 3 ข้อ", MX + 26, y + 34, BOLD, 19, WARN_INK)
    warns = [
        "เปิดงานแล้วต้องรอผู้จัดการสาขายอมรับก่อน งานจึงเดินหน้า",
        "แนบสลิปมัดจำแล้วต้องรอฝ่ายการเงินยืนยัน จึงเข้าผลิตได้",
        "ลืมรหัสผ่าน / เช็คอินไม่ได้ » แจ้งเจ้าของร้าน หรือ HR",
    ]
    wy = y + 64
    for w_ in warns:
        c.setFillColor(WARN_BAR)
        c.circle(MX + 32, top(wy) - 6, 3.2, fill=1, stroke=0)
        text(w_, MX + 44, wy, REG, 13.5, WARN_INK)
        wy += 27

    # ---------- ฟุตเตอร์ ----------
    center_text("K2 Manager · คู่มือฝ่ายขาย — ติดบอร์ดให้ทีมดูได้เลย", W / 2, H - 26, REG, 11, GREY)

    c.showPage()
    c.save()
    print("written:", out_pdf)

    # export PNG
    import fitz
    d = fitz.open(out_pdf)
    out_png = os.path.join(ROOT, "docs", "sales-infographic.png")
    d[0].get_pixmap(matrix=fitz.Matrix(2.5, 2.5)).save(out_png)
    print("written:", out_png)


if __name__ == "__main__":
    main()
