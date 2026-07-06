"use client";

// Sw.Work — Sales Order Form
// "ฝ่ายขายกรอกข้อมูลเพียงครั้งเดียว แล้วระบบสร้างเอกสารทั้งหมดอัตโนมัติ"

import { useMemo, useRef, useState } from "react";
import { swCalculatePrice, swGrandTotal } from "../../lib/sw-work/pricing";
import type {
  SwAccessory,
  SwMaterial,
  SwOrderFormInput,
  SwPrinting,
  SwProductType,
  SwShape,
  SwSizeUnit
} from "../../lib/sw-work/types";
import {
  SW_ACCESSORIES,
  SW_MATERIALS,
  SW_PRINTINGS,
  SW_PRODUCT_TYPES,
  SW_SHAPES,
  SW_SIZE_UNITS
} from "../../lib/sw-work/types";
import { thb } from "./SwDocuments";

const ACCEPT_FILES = ".jpg,.jpeg,.png,.ai,.pdf,.psd";

function Section({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-extrabold">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-xs text-white">
          {step}
        </span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function Chip({
  active,
  label,
  onClick
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
        active
          ? "border-orange-500 bg-orange-500 text-white"
          : "border-gray-200 bg-white text-gray-600 hover:border-orange-300"
      }`}
    >
      {label}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-semibold text-gray-600">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:outline-none";

export function SwOrderForm({
  submitting,
  onSubmit
}: {
  submitting: boolean;
  onSubmit: (form: SwOrderFormInput, files: File[]) => Promise<void>;
}) {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerLineId, setCustomerLineId] = useState("");
  const [customerCompany, setCustomerCompany] = useState("");
  const [productType, setProductType] = useState<SwProductType>("acrylic_keychain");
  const [width, setWidth] = useState(5);
  const [height, setHeight] = useState(5);
  const [sizeUnit, setSizeUnit] = useState<SwSizeUnit>("cm");
  const [quantity, setQuantity] = useState(100);
  const [shape, setShape] = useState<SwShape>("die_cut");
  const [material, setMaterial] = useState<SwMaterial>("acrylic_3mm");
  const [printing, setPrinting] = useState<SwPrinting>("uv_white");
  const [hasHole, setHasHole] = useState(true);
  const [holePosition, setHolePosition] = useState("บนกลาง");
  const [holeSize, setHoleSize] = useState("3 มม.");
  const [accessories, setAccessories] = useState<SwAccessory[]>(["ring"]);
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [autoPrice, setAutoPrice] = useState(true);
  const [manualUnitPrice, setManualUnitPrice] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [vatEnabled, setVatEnabled] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const pricing = useMemo(
    () =>
      swCalculatePrice({
        productType,
        material,
        printing,
        width,
        height,
        sizeUnit,
        quantity,
        hasHole,
        accessories
      }),
    [productType, material, printing, width, height, sizeUnit, quantity, hasHole, accessories]
  );

  const unitPrice = autoPrice ? pricing.unitPrice : manualUnitPrice;
  const subtotal = Math.round(unitPrice * quantity * 100) / 100;
  const grandTotal = swGrandTotal(subtotal, discount, vatEnabled);

  const toggleAccessory = (acc: SwAccessory) => {
    setAccessories((prev) =>
      prev.includes(acc) ? prev.filter((a) => a !== acc) : [...prev, acc]
    );
  };

  const handleSubmit = async () => {
    if (!customerName.trim()) {
      setError("กรุณากรอกชื่อลูกค้า");
      return;
    }
    if (quantity < 1) {
      setError("จำนวนต้องอย่างน้อย 1 ชิ้น");
      return;
    }
    if (unitPrice <= 0) {
      setError("ราคา/หน่วยต้องมากกว่า 0");
      return;
    }
    setError("");
    await onSubmit(
      {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerLineId: customerLineId.trim(),
        customerCompany: customerCompany.trim(),
        productType,
        width,
        height,
        sizeUnit,
        quantity,
        shape,
        material,
        printing,
        hasHole,
        holePosition: hasHole ? holePosition : "",
        holeSize: hasHole ? holeSize : "",
        accessories,
        notes: notes.trim(),
        unitPrice,
        discount,
        vatEnabled,
        dueDate: dueDate || undefined
      },
      files
    );
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <Section step={1} title="ข้อมูลลูกค้า (Customer)">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="ชื่อลูกค้า *">
              <input className={inputCls} value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="เช่น คุณมายด์" />
            </Field>
            <Field label="เบอร์โทร">
              <input className={inputCls} value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="08x-xxx-xxxx" />
            </Field>
            <Field label="LINE ID">
              <input className={inputCls} value={customerLineId} onChange={(e) => setCustomerLineId(e.target.value)} placeholder="@shop" />
            </Field>
            <Field label="บริษัท">
              <input className={inputCls} value={customerCompany} onChange={(e) => setCustomerCompany(e.target.value)} placeholder="(ถ้ามี)" />
            </Field>
          </div>
        </Section>

        <Section step={2} title="สินค้า (Product)">
          <div className="flex flex-wrap gap-2">
            {(Object.entries(SW_PRODUCT_TYPES) as Array<[SwProductType, string]>).map(([key, label]) => (
              <Chip key={key} active={productType === key} label={label} onClick={() => setProductType(key)} />
            ))}
          </div>
        </Section>

        <Section step={3} title="ขนาดและจำนวน (Size & Quantity)">
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="กว้าง (Width)">
              <input type="number" min={0} step="0.1" className={inputCls} value={width} onChange={(e) => setWidth(Number(e.target.value))} />
            </Field>
            <Field label="สูง (Height)">
              <input type="number" min={0} step="0.1" className={inputCls} value={height} onChange={(e) => setHeight(Number(e.target.value))} />
            </Field>
            <Field label="หน่วย">
              <select className={inputCls} value={sizeUnit} onChange={(e) => setSizeUnit(e.target.value as SwSizeUnit)}>
                {(Object.entries(SW_SIZE_UNITS) as Array<[SwSizeUnit, string]>).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </Field>
            <Field label="จำนวน (ชิ้น)">
              <input type="number" min={1} className={inputCls} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
            </Field>
          </div>
        </Section>

        <Section step={4} title="รูปทรง (Shape)">
          <div className="flex flex-wrap gap-2">
            {(Object.entries(SW_SHAPES) as Array<[SwShape, string]>).map(([key, label]) => (
              <Chip key={key} active={shape === key} label={label} onClick={() => setShape(key)} />
            ))}
          </div>
        </Section>

        <Section step={5} title="วัสดุ (Material)">
          <div className="flex flex-wrap gap-2">
            {(Object.entries(SW_MATERIALS) as Array<[SwMaterial, string]>).map(([key, label]) => (
              <Chip key={key} active={material === key} label={label} onClick={() => setMaterial(key)} />
            ))}
          </div>
        </Section>

        <Section step={6} title="การพิมพ์ (Printing)">
          <div className="flex flex-wrap gap-2">
            {(Object.entries(SW_PRINTINGS) as Array<[SwPrinting, string]>).map(([key, label]) => (
              <Chip key={key} active={printing === key} label={label} onClick={() => setPrinting(key)} />
            ))}
          </div>
        </Section>

        <Section step={7} title="รูเจาะ (Hole)">
          <div className="flex flex-wrap gap-2">
            <Chip active={!hasHole} label="ไม่เจาะรู" onClick={() => setHasHole(false)} />
            <Chip active={hasHole} label="เจาะรู" onClick={() => setHasHole(true)} />
          </div>
          {hasHole ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="ตำแหน่งรู (Hole Position)">
                <input className={inputCls} value={holePosition} onChange={(e) => setHolePosition(e.target.value)} placeholder="เช่น บนกลาง / 4 มุม" />
              </Field>
              <Field label="ขนาดรู (Hole Size)">
                <input className={inputCls} value={holeSize} onChange={(e) => setHoleSize(e.target.value)} placeholder="เช่น 3 มม." />
              </Field>
            </div>
          ) : null}
        </Section>

        <Section step={8} title="อุปกรณ์เสริม (Accessory)">
          <div className="flex flex-wrap gap-2">
            {(Object.entries(SW_ACCESSORIES) as Array<[SwAccessory, string]>).map(([key, label]) => (
              <Chip key={key} active={accessories.includes(key)} label={label} onClick={() => toggleAccessory(key)} />
            ))}
          </div>
        </Section>

        <Section step={9} title="ไฟล์งาน (Uploaded Files — JPG / PNG / AI / PDF / PSD)">
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPT_FILES}
            multiple
            className="hidden"
            onChange={(e) => {
              const chosen = Array.from(e.target.files ?? []);
              if (chosen.length) setFiles((prev) => [...prev, ...chosen]);
              if (fileInput.current) fileInput.current.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="rounded-xl border border-dashed border-gray-300 px-4 py-3 text-sm font-semibold text-gray-500 hover:border-orange-400 hover:text-orange-600"
          >
            + เลือกไฟล์
          </button>
          {files.length > 0 ? (
            <ul className="mt-3 space-y-1 text-sm">
              {files.map((file, i) => (
                <li key={`${file.name}-${i}`} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                  <span className="truncate">{file.name}</span>
                  <button
                    type="button"
                    className="ml-3 text-xs font-bold text-red-500"
                    onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    ลบ
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </Section>

        <Section step={10} title="หมายเหตุ (Notes) และกำหนดส่ง">
          <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
            <Field label="หมายเหตุถึงกราฟิก/ฝ่ายผลิต">
              <textarea className={`${inputCls} min-h-[80px]`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="เช่น ขอสีสดตามไฟล์ งานด่วนรับก่อนวันศุกร์" />
            </Field>
            <Field label="กำหนดส่ง (Due Date)">
              <input type="date" className={inputCls} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
          </div>
        </Section>
      </div>

      {/* สรุปราคาอัตโนมัติ */}
      <aside className="lg:sticky lg:top-24 h-fit space-y-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-extrabold">คำนวณราคาอัตโนมัติ</h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>พื้นที่</span>
              <span>{pricing.areaCm2.toLocaleString("th-TH")} ตร.ซม.</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>วัสดุ + พิมพ์</span>
              <span>{thb(pricing.materialCost + pricing.printingCost)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>รูเจาะ + อุปกรณ์</span>
              <span>{thb(pricing.holeCost + pricing.accessoryCost)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>ราคาแนะนำ/ชิ้น</span>
              <span className="text-orange-600">{thb(pricing.unitPrice)}</span>
            </div>
          </div>

          <div className="mt-4 space-y-3 border-t border-gray-100 pt-4 text-sm">
            <label className="flex items-center gap-2 font-semibold">
              <input type="checkbox" checked={autoPrice} onChange={(e) => {
                setAutoPrice(e.target.checked);
                if (!e.target.checked) setManualUnitPrice(pricing.unitPrice);
              }} />
              ใช้ราคาแนะนำอัตโนมัติ
            </label>
            {!autoPrice ? (
              <Field label="ราคา/ชิ้น (กำหนดเอง)">
                <input type="number" min={0} step="0.01" className={inputCls} value={manualUnitPrice} onChange={(e) => setManualUnitPrice(Number(e.target.value))} />
              </Field>
            ) : null}
            <Field label={`ส่วนลด (บาท)${pricing.tierDiscount > 0 ? ` — แนะนำ ${thb(pricing.tierDiscount)} (${pricing.tierDiscountRate * 100}%)` : ""}`}>
              <div className="flex gap-2">
                <input type="number" min={0} step="0.01" className={inputCls} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
                {pricing.tierDiscount > 0 ? (
                  <button
                    type="button"
                    onClick={() => setDiscount(pricing.tierDiscount)}
                    className="shrink-0 rounded-xl bg-orange-100 px-3 text-xs font-bold text-orange-700"
                  >
                    ใช้เลย
                  </button>
                ) : null}
              </div>
            </Field>
            <label className="flex items-center gap-2 font-semibold">
              <input type="checkbox" checked={vatEnabled} onChange={(e) => setVatEnabled(e.target.checked)} />
              คิด VAT 7%
            </label>
          </div>

          <div className="mt-4 space-y-1 border-t border-gray-100 pt-4 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>{quantity.toLocaleString("th-TH")} ชิ้น x {thb(unitPrice)}</span>
              <span>{thb(subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>ส่วนลด</span>
              <span>-{thb(discount)}</span>
            </div>
            <div className="flex justify-between pt-1 text-lg font-extrabold">
              <span>ยอดสุทธิ</span>
              <span className="text-orange-600">{thb(grandTotal)} ฿</span>
            </div>
          </div>
        </div>

        {error ? (
          <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-600">{error}</p>
        ) : null}

        <button
          type="button"
          disabled={submitting}
          onClick={handleSubmit}
          className="w-full rounded-2xl bg-orange-500 py-4 text-base font-extrabold text-white hover:bg-orange-600 disabled:opacity-50"
        >
          {submitting ? "กำลังสร้างเอกสาร..." : "สร้างออเดอร์ + เอกสารทั้ง 5 ใบ"}
        </button>
        <p className="text-center text-xs text-gray-400">
          ระบบจะสร้าง ใบเสนอราคา • ใบคอนเฟิร์ม • ใบสั่งผลิต • ใบ QC • ใบจัดส่ง ให้อัตโนมัติ
        </p>
      </aside>
    </div>
  );
}
