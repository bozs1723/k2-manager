#!/usr/bin/env python3
"""สร้างคู่มือฝ่ายขายเป็น PDF (ภาษาไทย) ด้วย reportlab + ฟอนต์ Loma

ฟอนต์ระบบ tlwg/Loma เป็น .otf (CFF) ซึ่ง reportlab ไม่รองรับ จึงแปลงเป็น .ttf ก่อน
รัน: python3 scripts/build-sales-pdf.py
ผลลัพธ์: docs/user-guide-sales.pdf
"""
import os

from fontTools.ttLib import TTFont, newTable
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib.tables._g_l_y_f import table__g_l_y_f

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm, mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont as RLTTFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, ListFlowable, ListItem, HRFlowable,
)

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
FONTDIR = "/tmp/fonts"
OTF = {
    "Loma": "/usr/share/fonts/opentype/tlwg/Loma.otf",
    "Loma-Bold": "/usr/share/fonts/opentype/tlwg/Loma-Bold.otf",
}


def otf_to_ttf(src, dst, max_err=1.0):
    f = TTFont(src)
    gs = f.getGlyphSet()
    order = f.getGlyphOrder()
    glyf = table__g_l_y_f()
    glyf.glyphOrder = order
    glyf.glyphs = {}
    for name in order:
        pen = TTGlyphPen(gs)
        gs[name].draw(Cu2QuPen(pen, max_err, reverse_direction=True))
        glyf[name] = pen.glyph()
    for t in ("CFF ", "CFF2", "VORG"):
        if t in f:
            del f[t]
    f["glyf"] = glyf
    f["loca"] = newTable("loca")
    f.sfntVersion = "\x00\x01\x00\x00"
    f["head"].indexToLocFormat = 0
    maxp = newTable("maxp")
    maxp.tableVersion = 0x00010000
    maxp.numGlyphs = len(order)
    mp = mc = cel = cd = 0
    for name in order:
        g = glyf[name]
        nc = getattr(g, "numberOfContours", 0)
        if nc > 0:
            mp = max(mp, len(g.getCoordinates(glyf)[0]))
            mc = max(mc, nc)
        elif nc < 0:
            cel = max(cel, len(getattr(g, "components", [])))
            cd = max(cd, 1)
    for k, v in dict(
        maxPoints=mp, maxContours=mc, maxCompositePoints=0, maxCompositeContours=0,
        maxZones=1, maxTwilightPoints=0, maxStorage=0, maxFunctionDefs=0,
        maxInstructionDefs=0, maxStackElements=0, maxSizeOfInstructions=0,
        maxComponentElements=cel, maxComponentDepth=cd,
    ).items():
        setattr(maxp, k, v)
    f["maxp"] = maxp
    f.save(dst)


def ensure_fonts():
    os.makedirs(FONTDIR, exist_ok=True)
    for name, src in OTF.items():
        dst = os.path.join(FONTDIR, name + ".ttf")
        if not os.path.exists(dst):
            otf_to_ttf(src, dst)
        pdfmetrics.registerFont(RLTTFont(name, dst))
    pdfmetrics.registerFontFamily("Loma", normal="Loma", bold="Loma-Bold")


# ---- palette (มิ้นต์/teal ตามธีมแอป) ----
TEAL = colors.HexColor("#0f766e")
TEAL2 = colors.HexColor("#0d9488")
MINT_HEAD = colors.HexColor("#ccfbf1")
MINT_LINE = colors.HexColor("#99f6e4")
MINT_BG = colors.HexColor("#f0fdfa")
GREY = colors.HexColor("#6b7280")
INK = colors.HexColor("#1f2937")
WARN_BG = colors.HexColor("#fff7ed")
WARN_BAR = colors.HexColor("#f97316")
WARN_INK = colors.HexColor("#9a3412")
FLOW_BG = colors.HexColor("#ecfeff")
FLOW_INK = colors.HexColor("#155e75")
BOX_BG = colors.HexColor("#f8fafc")
BOX_LINE = colors.HexColor("#e2e8f0")


def styles():
    return {
        "title": ParagraphStyle("title", fontName="Loma-Bold", fontSize=22, textColor=TEAL, leading=26, spaceAfter=2),
        "sub": ParagraphStyle("sub", fontName="Loma", fontSize=10, textColor=GREY, leading=13, spaceAfter=10),
        "h2": ParagraphStyle("h2", fontName="Loma-Bold", fontSize=14, textColor=TEAL, leading=18, spaceBefore=14, spaceAfter=4),
        "h3": ParagraphStyle("h3", fontName="Loma-Bold", fontSize=11.5, textColor=TEAL2, leading=15, spaceBefore=8, spaceAfter=2),
        "body": ParagraphStyle("body", fontName="Loma", fontSize=10.5, textColor=INK, leading=16, spaceAfter=3),
        "li": ParagraphStyle("li", fontName="Loma", fontSize=10.5, textColor=INK, leading=15),
        "cell": ParagraphStyle("cell", fontName="Loma", fontSize=9.5, textColor=INK, leading=13),
        "cellh": ParagraphStyle("cellh", fontName="Loma-Bold", fontSize=9.5, textColor=colors.HexColor("#115e59"), leading=13),
        "note": ParagraphStyle("note", fontName="Loma", fontSize=9.5, textColor=colors.HexColor("#115e59"), leading=14),
        "warn": ParagraphStyle("warn", fontName="Loma", fontSize=9.5, textColor=WARN_INK, leading=14),
        "flow": ParagraphStyle("flow", fontName="Loma-Bold", fontSize=10, textColor=FLOW_INK, leading=14),
        "foot": ParagraphStyle("foot", fontName="Loma", fontSize=8.5, textColor=colors.HexColor("#9ca3af"), leading=11, alignment=TA_CENTER),
    }


def b(t):
    return f"<b>{t}</b>"


def main():
    ensure_fonts()
    S = styles()
    story = []

    def P(text, st="body"):
        story.append(Paragraph(text, S[st]))

    def bullets(items, st="li"):
        story.append(ListFlowable(
            [ListItem(Paragraph(t, S[st]), leftIndent=10, value="•") for t in items],
            bulletType="bullet", bulletFontName="Loma", bulletColor=TEAL2, leftIndent=14, spaceAfter=4,
        ))

    def numbered(items, st="li"):
        story.append(ListFlowable(
            [ListItem(Paragraph(t, S[st]), leftIndent=10) for t in items],
            bulletType="1", bulletFontName="Loma-Bold", bulletColor=TEAL2, leftIndent=16, spaceAfter=4,
        ))

    def callout(text, kind="note"):
        bg = {"note": MINT_BG, "warn": WARN_BG, "flow": FLOW_BG}[kind]
        bar = {"note": colors.HexColor("#14b8a6"), "warn": WARN_BAR, "flow": colors.HexColor("#06b6d4")}[kind]
        st = {"note": "note", "warn": "warn", "flow": "flow"}[kind]
        t = Table([[Paragraph(text, S[st])]], colWidths=[16.8 * cm])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), bg),
            ("LINEBEFORE", (0, 0), (0, -1), 3, bar),
            ("TOPPADDING", (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ]))
        story.append(Spacer(1, 4))
        story.append(t)
        story.append(Spacer(1, 4))

    def table(rows, widths):
        data = [[Paragraph(rows[0][0], S["cellh"]), Paragraph(rows[0][1], S["cellh"])]]
        for r in rows[1:]:
            data.append([Paragraph(r[0], S["cell"]), Paragraph(r[1], S["cell"])])
        t = Table(data, colWidths=widths, repeatRows=1)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), MINT_HEAD),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
            ("LINEBELOW", (0, 0), (-1, 0), 1, MINT_LINE),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, MINT_BG]),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ]))
        story.append(t)
        story.append(Spacer(1, 2))

    # ---------- เนื้อหา ----------
    P("คู่มือการใช้งานสำหรับพนักงานขาย", "title")
    P("ฝ่ายขาย (Sales Staff) · ระบบ K2 Manager", "sub")

    role = ("%s สร้าง/แก้ลูกค้า · สร้าง/แก้งาน · ดูยอดเงิน · บันทึกการชำระเงิน · "
            "ออกใบเสนอราคา/ใบสั่งงาน · ตรวจงานที่ดีไซเนอร์ส่งมา<br/>"
            "%s ยืนยันมัดจำขั้นสุดท้าย (ฝ่ายการเงิน) · อนุมัติเข้าผลิต (ผู้จัดการสาขา) · "
            "จัดการพนักงาน/ตั้งค่าบริษัท") % (b("สิ่งที่ฝ่ายขายทำได้:"), b("สิ่งที่ทำไม่ได้ (สิทธิ์อื่นดูแล):"))
    rb = Table([[Paragraph(role, S["note"])]], colWidths=[16.8 * cm])
    rb.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BOX_BG),
        ("BOX", (0, 0), (-1, -1), 0.6, BOX_LINE),
        ("TOPPADDING", (0, 0), (-1, -1), 9), ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
        ("LEFTPADDING", (0, 0), (-1, -1), 12), ("RIGHTPADDING", (0, 0), (-1, -1), 12),
    ]))
    story.append(rb)
    story.append(Spacer(1, 6))

    P("1. เข้าสู่ระบบ", "h2")
    numbered([
        "เปิดแอป (เพิ่มลงหน้าจอโฮมของมือถือได้ ใช้เหมือนแอปจริง)",
        "ใส่ %s และ %s ที่ได้รับจากเจ้าของร้าน/HR" % (b("ชื่อผู้ใช้ (username)"), b("รหัสผ่าน")),
        "ลืมรหัสผ่าน » แจ้งเจ้าของร้าน/HR รีเซ็ตให้ในเมนูตั้งค่า",
    ])

    P("2. ลงเวลาเข้า&#8211;ออกงาน (เมนู \"ลงเวลา\")", "h2")
    P("เช็คอิน (เข้างาน)", "h3")
    numbered([
        "ไปเมนู %s" % b("ลงเวลา"),
        "กด %s » แอปจะขอ %s และ %s" % (b("เช็คอิน"), b("ถ่ายเซลฟี่"), b("เปิด GPS")),
        "ระบบเช็กว่าอยู่ในพื้นที่สาขา (geofence) &#8212; อยู่นอกรัศมีจะมีคำเตือน",
        "มาสายระบบนับจำนวนนาทีที่สายให้อัตโนมัติ",
    ])
    P("เช็คเอาท์ (เลิกงาน)", "h3")
    bullets(["ก่อนกลับกด %s + ถ่ายเซลฟี่อีกครั้ง" % b("เช็คเอาท์")])
    callout("ทุกเย็น 18:30 ระบบสรุป \"ใครเข้า/ออก/ขาด + OT วันนี้\" เข้ากลุ่ม LINE ของสาขาอัตโนมัติ "
            "เช็คอินตรงเวลาและอย่าลืมเช็คเอาท์ เพราะมีผลต่อการคิดเงินเดือน/OT", "note")

    P("3. เมนูที่ฝ่ายขายใช้บ่อย", "h2")
    table([
        ("เมนู", "ใช้ทำอะไร"),
        ("แดชบอร์ด", "ภาพรวมงานวันนี้ / งานเร่งด่วน / ยอดที่ต้องตาม"),
        ("กล่องลูกค้า (Leads)", "ลูกค้าที่ติดต่อเข้ามา ยังไม่เปิดงาน"),
        ("ลูกค้า", "ฐานข้อมูลลูกค้าทั้งหมด เพิ่ม/แก้ไขข้อมูล"),
        ("สร้างงาน", "เปิดออเดอร์ใหม่"),
        ("งานของฉัน / บอร์ดคิวงาน", "ติดตามสถานะงานที่ดูแล"),
        ("ใบเสนอราคา / ใบสั่งงาน", "ออก/ดาวน์โหลดเอกสารให้ลูกค้า"),
        ("การชำระเงิน", "บันทึกมัดจำ / ยอดคงเหลือ + แนบสลิป"),
        ("ปฏิทิน", "ดูกำหนดส่งงาน"),
    ], [5.6 * cm, 11.2 * cm])

    P("4. เพิ่มลูกค้าใหม่", "h2")
    numbered([
        "เมนู %s » %s" % (b("ลูกค้า"), b("เพิ่มลูกค้า")),
        "กรอก: ชื่อ, เบอร์โทร, LINE, อีเมล (ถ้ามี)",
        "ลูกค้าที่ต้องการ %s กรอกเพิ่ม: ชื่อบริษัท, เลขผู้เสียภาษี, ที่อยู่วางบิล, อีเมลบัญชี" % b("ใบกำกับภาษี"),
        "กดบันทึก &#8212; ระบบออก %s ให้อัตโนมัติ" % b("รหัสลูกค้า"),
    ])
    callout("เปิดงานให้ลูกค้าใหม่ได้เลยจากหน้าสร้างงาน โดยไม่ต้องเพิ่มลูกค้าก่อนก็ได้ (ระบบบันทึกให้ในตัว)", "note")

    P("5. สร้างงาน / ออกใบสั่งงาน (หัวใจของฝ่ายขาย)", "h2")
    numbered([
        "เมนู %s" % b("สร้างงาน"),
        "เลือกลูกค้า (เดิม) หรือกรอกลูกค้าใหม่",
        "กรอกรายละเอียดงาน: %s (เสื้อ DTG · พิมพ์ UV · เลเซอร์คัต · ป้าย · งานอะคริลิค · พิมพ์ 3D · อื่น ๆ), "
        "รายละเอียด/จำนวน, %s, %s, %s &#8212; ติ๊ก %s ถ้าลูกค้าต้องการเร่ง"
        % (b("ประเภทงาน"), b("ราคา"), b("มัดจำ"), b("กำหนดส่ง"), b("งานด่วน")),
        "กดบันทึก",
    ])
    callout("%s งานที่ฝ่ายขายเปิด จะอยู่สถานะ %s ก่อน เมื่อผู้จัดการสาขารับงานแล้ว งานจึงเดินหน้าเข้าคิวจริง"
            % (b("สำคัญ:"), b("\"รอผู้จัดการสาขายอมรับ\"")), "warn")

    P("6. รับมัดจำ + แนบสลิป (เมนู \"การชำระเงิน\")", "h2")
    P("งานจะเข้าสู่การผลิตได้ก็ต่อเมื่อ %s ลำดับสถานะการเงิน:" % b("ผ่านขั้นมัดจำ"))
    callout("รอเสนอราคา » รอมัดจำ » รอตรวจสอบยอด » มัดจำแล้ว", "flow")
    numbered([
        "เปิดงาน » ส่วน %s" % b("การชำระเงิน"),
        "กรอก %s + %s" % (b("ยอดมัดจำที่รับ"), b("วันที่รับเงิน")),
        "%s การโอน (ถ่าย/อัปโหลด)" % b("แนบสลิป"),
        "บันทึก » งานขึ้นสถานะ %s" % b("\"รอตรวจสอบยอด\""),
        "%s » กลายเป็น %s แล้วเข้าผลิตได้" % (b("ฝ่ายการเงินเป็นผู้ยืนยันมัดจำขั้นสุดท้าย"), b("\"มัดจำแล้ว\"")),
    ])
    callout("กรณีไม่เก็บมัดจำ (ลูกค้าประจำ/เครดิต) ให้แจ้งหัวหน้าใช้สิทธิ์ \"ยกเว้นมัดจำ\"", "note")

    P("7. ตรวจงานที่ดีไซเนอร์ส่งมา (Handoff)", "h2")
    P("ฝ่ายขายเป็น %s ก่อนถึงมือลูกค้า" % b("ผู้ตรวจงานดีไซน์"))
    callout("ดีไซเนอร์ส่งงานให้เซลตรวจ » เซลตรวจ/ยืนยัน » (อัตโนมัติ) ผู้จัดการสาขาอนุมัติเข้าผลิต", "flow")
    numbered([
        "มีแจ้งเตือนเมื่อดีไซเนอร์ส่งงานมา (สถานะ \"รอลูกค้าอนุมัติ\")",
        "เปิดงาน ดูไฟล์ดีไซน์ » ส่งให้ลูกค้าดู",
        "ลูกค้าโอเค » กด %s (งานส่งต่อให้ผู้จัดการสาขาอนุมัติเข้าผลิต)" % b("ยืนยัน"),
        "ลูกค้าขอแก้ » กด %s งานเด้งกลับให้ดีไซเนอร์แก้ พร้อมใส่หมายเหตุ" % b("ตีกลับ"),
    ])

    P("8. รับยอดคงเหลือ + ปิดงาน", "h2")
    numbered([
        "เปิดงาน » %s » กรอก %s + %s + %s" % (b("การชำระเงิน"), b("ยอดคงเหลือที่รับ"), b("วันที่"), b("แนบสลิป")),
        "เมื่อชำระครบ สถานะการชำระจะเป็น %s" % b("\"ชำระครบแล้ว\""),
        "ดันสถานะงานไปจน %s" % b("\"จัดส่ง / รับแล้ว\" » \"เสร็จสิ้น\""),
    ])
    callout("ยอดที่รับเข้าจริงในวันนั้น (มัดจำ + ยอดคงเหลือ) จะถูกรวมในรายงานสรุปสิ้นวัน 20:00 เข้ากลุ่ม LINE", "note")

    P("9. ออก/ดาวน์โหลดเอกสารให้ลูกค้า", "h2")
    bullets([
        "เมนู %s » เลือกงาน » %s เป็นเอกสาร" % (b("ใบเสนอราคา / ใบสั่งงาน"), b("ดาวน์โหลด/ส่งออก")),
        "ระบบออก %s ให้อัตโนมัติ" % b("เลขที่เอกสาร"),
        "ลูกค้าที่ขอใบกำกับภาษี ตรวจให้แน่ใจว่ากรอกข้อมูลภาษีในประวัติลูกค้าครบก่อน",
    ])

    P("10. ความหมายของสถานะงาน (ย่อ)", "h2")
    table([
        ("สถานะ", "หมายความว่า"),
        ("รอเสนอราคา", "เพิ่งเปิด ยังไม่ตกลงราคา"),
        ("รอมัดจำ / รอตรวจสอบยอด / มัดจำแล้ว", "ขั้นการเงินก่อนเข้าผลิต"),
        ("รับงานใหม่ / รอไฟล์", "รอข้อมูล/ไฟล์จากลูกค้า"),
        ("กำลังออกแบบ / รอลูกค้าอนุมัติ", "ดีไซน์อยู่ / รอเซล-ลูกค้าตรวจ"),
        ("พร้อมผลิต / กำลังผลิต / ตรวจคุณภาพ / แพ็กของ", "อยู่ในสายผลิต"),
        ("จัดส่ง / รับแล้ว » เสร็จสิ้น", "ปิดงาน"),
        ("ยกเลิก", "งานถูกยกเลิก"),
    ], [8.4 * cm, 8.4 * cm])

    P("11. ปัญหาที่พบบ่อย", "h2")
    bullets([
        "%s » เปิด GPS ให้แม่นยำ และอยู่ในบริเวณสาขา ถ้ายังไม่ได้แจ้งหัวหน้า" % b("เช็คอินไม่ได้ / ขึ้นอยู่นอกพื้นที่"),
        "%s » ปกติ ต้องรอผู้จัดการสาขายอมรับงานก่อน" % b("เปิดงานแล้วไม่เดินหน้า"),
        "%s » รอฝ่ายการเงินยืนยันยอด" % b("มัดจำแนบสลิปแล้วแต่ยังไม่ \"มัดจำแล้ว\""),
        "%s » แจ้งเจ้าของร้าน/HR รีเซ็ตให้" % b("ลืมรหัสผ่าน"),
    ])

    story.append(Spacer(1, 12))
    story.append(HRFlowable(width="100%", thickness=0.6, color=colors.HexColor("#e5e7eb")))
    story.append(Spacer(1, 4))
    P("K2 Manager · คู่มือฝ่ายขาย — มีคำถามเพิ่มเติมหรืออยากได้เวอร์ชันสั้นติดผนัง แจ้งหัวหน้าได้เลย", "foot")

    out = os.path.join(ROOT, "docs", "user-guide-sales.pdf")
    doc = SimpleDocTemplate(
        out, pagesize=A4,
        leftMargin=1.5 * cm, rightMargin=1.5 * cm, topMargin=1.5 * cm, bottomMargin=1.4 * cm,
        title="คู่มือฝ่ายขาย - K2 Manager", author="K2 Manager",
    )
    doc.build(story)
    print("written:", out)


if __name__ == "__main__":
    main()
