"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Clock3,
  MessageCircle,
  Phone,
  ShoppingBag,
  Sparkles,
  Star,
  Truck,
  X
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  Product,
  ProductCategory,
  SelectedOption,
  ShopSettings,
  areaPricePerSqm,
  areaSqm,
  formatBaht,
  mapCategory,
  mapProduct,
  mapSettings,
  matrixTierForQty,
  matrixUnitPrice,
  netUnitPrice,
  startingPrice,
  totalPrice
} from "@/lib/shop";

const DEFAULT_SETTINGS: ShopSettings = {
  shopName: "K2Smart",
  heroTitle: "งานพิมพ์ & ป้าย สั่งทำคุณภาพ ผลิตไว",
  heroSubtitle: "เลือกสินค้าที่ต้องการ แจ้งจำนวน แล้วสั่งผ่าน LINE ได้ทันที",
  lineUrl: null,
  phone: null,
  facebookUrl: null
};

// ตัวอย่างสำหรับพรีวิวเมื่อยังไม่ได้ตั้งค่า Supabase
const FALLBACK_PRODUCTS: Product[] = [
  {
    id: "demo-flag",
    categoryId: "c1",
    categoryName: "ป้ายธง / ธงญี่ปุ่น",
    name: "ป้ายธงญี่ปุ่น (J-Flag)",
    description: "ธงญี่ปุ่นพร้อมฐาน ผลิตไว ใช้หน้าร้าน/อีเวนต์ ขนาดมาตรฐาน 50x150 ซม.",
    basePrice: 970,
    unit: "ชุด",
    leadTimeDays: 3,
    badge: "ขายดี",
    images: ["https://images.unsplash.com/photo-1561049501-e1f96bdd98fd?w=800"],
    options: [
      { name: "ฐาน", choices: [{ label: "ฐานกลม", priceDelta: 0 }, { label: "ฐานเหลี่ยม", priceDelta: 120 }, { label: "ฐานปูน", priceDelta: 320 }] },
      { name: "ขนาด", choices: [{ label: "50x150 ซม.", priceDelta: 0 }, { label: "60x180 ซม.", priceDelta: 180 }] }
    ],
    priceTiers: [{ minQty: 1, price: 970 }, { minQty: 6, price: 920 }, { minQty: 12, price: 870 }],
    minQty: 1,
    active: true,
    sort: 1,
    pricingMode: "fixed"
  },
  {
    id: "demo-tee",
    categoryId: "c2",
    categoryName: "เสื้อ DTG / สกรีน",
    name: "เสื้อยืดพิมพ์ลาย DTG",
    description: "เสื้อ Cotton 100% พิมพ์ DTG สีคมชัด สั่งขั้นต่ำ 1 ตัว",
    basePrice: 250,
    unit: "ตัว",
    leadTimeDays: 5,
    badge: null,
    images: ["https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800"],
    options: [{ name: "ไซซ์", choices: [{ label: "S" }, { label: "M" }, { label: "L" }, { label: "XL", priceDelta: 20 }, { label: "2XL", priceDelta: 40 }] }],
    priceTiers: [{ minQty: 1, price: 250 }, { minQty: 10, price: 220 }, { minQty: 50, price: 190 }],
    minQty: 1,
    active: true,
    sort: 1,
    pricingMode: "fixed"
  }
];

const FALLBACK_CATEGORIES: ProductCategory[] = [
  { id: "c1", slug: "flags", name: "ป้ายธง / ธงญี่ปุ่น", sort: 1, active: true },
  { id: "c2", slug: "shirts", name: "เสื้อ DTG / สกรีน", sort: 2, active: true }
];

export default function ShopPage() {
  const [settings, setSettings] = useState<ShopSettings>(DEFAULT_SETTINGS);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState<string>("all");
  const [selected, setSelected] = useState<Product | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!isSupabaseConfigured || !supabase) {
        setProducts(FALLBACK_PRODUCTS);
        setCategories(FALLBACK_CATEGORIES);
        setLoading(false);
        return;
      }
      const [{ data: prodRows }, { data: catRows }, { data: setRow }] = await Promise.all([
        supabase.from("products").select("*, product_categories(name)").eq("active", true).order("sort"),
        supabase.from("product_categories").select("*").eq("active", true).order("sort"),
        supabase.from("shop_settings").select("*").eq("id", 1).maybeSingle()
      ]);
      if (!alive) return;
      const prods = (prodRows ?? []).map(mapProduct);
      setProducts(prods.length ? prods : FALLBACK_PRODUCTS);
      setCategories((catRows ?? []).map(mapCategory));
      if (setRow) setSettings(mapSettings(setRow));
      setLoading(false);
    }
    load();
    return () => {
      alive = false;
    };
  }, []);

  const shown = useMemo(
    () => (activeCat === "all" ? products : products.filter((p) => p.categoryId === activeCat)),
    [products, activeCat]
  );

  return (
    <main className="min-h-screen pb-24">
      {/* Hero */}
      <section className="px-4 pt-8 sm:pt-14">
        <div className="mx-auto max-w-5xl glass rounded-[2rem] p-6 sm:p-10 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-1.5 text-sm font-bold text-k2-ink">
            <ShoppingBag className="h-4 w-4" /> {settings.shopName} · ร้านค้าออนไลน์
          </div>
          <h1 className="mt-4 text-3xl sm:text-5xl text-k2-ink leading-tight">{settings.heroTitle}</h1>
          <p className="mt-3 text-base sm:text-lg text-k2-muted max-w-2xl mx-auto">{settings.heroSubtitle}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {settings.lineUrl && (
              <a href={settings.lineUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-2xl bg-k2-ink px-6 py-3 font-bold text-white">
                <MessageCircle className="h-5 w-5" /> สั่งผ่าน LINE
              </a>
            )}
            {settings.phone && (
              <a href={`tel:${settings.phone}`} className="inline-flex items-center gap-2 rounded-2xl bg-white/80 px-6 py-3 font-bold text-k2-ink">
                <Phone className="h-5 w-5" /> {settings.phone}
              </a>
            )}
          </div>
          <div className="mt-7 grid grid-cols-3 gap-3 max-w-xl mx-auto text-sm">
            <Feature icon={<Truck className="h-5 w-5" />} text="ผลิตไว ส่งทั่วไทย" />
            <Feature icon={<Star className="h-5 w-5" />} text="คุณภาพงานพรีเมียม" />
            <Feature icon={<Sparkles className="h-5 w-5" />} text="สั่งทำตามแบบ" />
          </div>
        </div>
      </section>

      {/* Category filter */}
      <section className="px-4 mt-8">
        <div className="mx-auto max-w-5xl flex flex-wrap gap-2">
          <CatChip label="ทั้งหมด" active={activeCat === "all"} onClick={() => setActiveCat("all")} />
          {categories.map((c) => (
            <CatChip key={c.id} label={c.name} active={activeCat === c.id} onClick={() => setActiveCat(c.id)} />
          ))}
        </div>
      </section>

      {/* Product grid */}
      <section className="px-4 mt-6">
        <div className="mx-auto max-w-5xl">
          {loading ? (
            <p className="text-center text-k2-muted py-16">กำลังโหลดสินค้า…</p>
          ) : shown.length === 0 ? (
            <p className="text-center text-k2-muted py-16">ยังไม่มีสินค้าในหมวดนี้</p>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((p) => (
                <ProductCard key={p.id} product={p} onSelect={() => setSelected(p)} />
              ))}
            </div>
          )}
        </div>
      </section>

      <footer className="mt-16 text-center text-sm text-k2-muted">
        <Link href="/" className="underline">เข้าสู่ระบบหลังบ้าน</Link>
        {" · "}
        <Link href="/shop/admin" className="underline">จัดการสินค้า</Link>
      </footer>

      <AnimatePresence>
        {selected && <ProductModal product={selected} settings={settings} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </main>
  );
}

function Feature({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl bg-white/55 px-2 py-3 text-k2-ink font-bold">
      {icon}
      <span className="text-xs leading-tight text-center">{text}</span>
    </div>
  );
}

function CatChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-bold ${active ? "bg-k2-ink text-white" : "bg-white/70 text-k2-ink"}`}
    >
      {label}
    </button>
  );
}

function ProductCard({ product, onSelect }: { product: Product; onSelect: () => void }) {
  return (
    <motion.button
      whileHover={{ y: -4 }}
      onClick={onSelect}
      className="group text-left glass rounded-3xl overflow-hidden flex flex-col"
    >
      <div className="relative aspect-[4/3] bg-k2-cloud overflow-hidden">
        {product.images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-k2-muted">
            <ShoppingBag className="h-10 w-10" />
          </div>
        )}
        {product.badge && (
          <span className="absolute top-3 left-3 rounded-full bg-k2-ink px-3 py-1 text-xs font-bold text-white">{product.badge}</span>
        )}
        {product.leadTimeDays != null && (
          <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-k2-ink">
            <Clock3 className="h-3.5 w-3.5" /> ผลิตเร็ว {product.leadTimeDays} วัน
          </span>
        )}
      </div>
      <div className="p-4 flex-1 flex flex-col">
        {product.categoryName && <p className="text-xs font-bold text-k2-muted">{product.categoryName}</p>}
        <h3 className="mt-1 text-lg text-k2-ink leading-snug">{product.name}</h3>
        {product.description && <p className="mt-1 text-sm text-k2-muted line-clamp-2">{product.description}</p>}
        <div className="mt-3 flex items-end justify-between">
          <div>
            {product.pricingMode === "quote" ? (
              <p className="text-lg font-extrabold text-k2-ink">ขอใบเสนอราคา</p>
            ) : (
              <>
                <p className="text-xs text-k2-muted">{product.pricingMode === "area" ? `เริ่มต้น (ต่อ ${product.unit})` : "เริ่มต้น"}</p>
                <p className="text-xl font-extrabold text-k2-ink">{formatBaht(startingPrice(product))}</p>
              </>
            )}
          </div>
          <span className="rounded-xl bg-k2-ink px-4 py-2 text-sm font-bold text-white">{product.pricingMode === "quote" ? "ดูรายละเอียด" : "เลือก / สั่งซื้อ"}</span>
        </div>
      </div>
    </motion.button>
  );
}

function ProductModal({ product, settings, onClose }: { product: Product; settings: ShopSettings; onClose: () => void }) {
  const mode = product.pricingMode;
  const [qty, setQty] = useState(Math.max(product.minQty, 1));
  const [opts, setOpts] = useState<SelectedOption[]>(
    product.options.map((o) => ({ name: o.name, value: o.choices[0]?.label ?? "" }))
  );
  // matrix (พวงกุญแจ)
  const [sizeIndex, setSizeIndex] = useState(0);
  const [matrixAddons, setMatrixAddons] = useState<string[]>([]);
  // area (ไวนิล/สติกเกอร์)
  const [material, setMaterial] = useState(product.area?.materials[0]?.name ?? "");
  const [width, setWidth] = useState(1);
  const [height, setHeight] = useState(1);
  const [pieces, setPieces] = useState(1);
  const [areaAddons, setAreaAddons] = useState<string[]>([]);

  const [form, setForm] = useState({ name: "", phone: "", lineId: "", note: "" });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setOpt = (name: string, value: string) => setOpts((cur) => cur.map((o) => (o.name === name ? { name, value } : o)));
  const toggleIn = (list: string[], set: (v: string[]) => void, name: string) =>
    set(list.includes(name) ? list.filter((x) => x !== name) : [...list, name]);

  // คำนวณราคาตามรูปแบบสินค้า
  const priced = useMemo(() => {
    if (mode === "matrix" && product.matrix) {
      const cfg = product.matrix;
      const unit = matrixUnitPrice(cfg, sizeIndex, qty, matrixAddons);
      const selected: SelectedOption[] = [
        { name: cfg.sizeLabel, value: cfg.sizes[sizeIndex] ?? "" },
        ...matrixAddons.map((a) => ({ name: a, value: "เลือก" }))
      ];
      return { unit, total: unit * Math.max(qty, 1), selected, orderQty: qty, hasPrice: true };
    }
    if (mode === "area" && product.area) {
      const cfg = product.area;
      const sqm = areaSqm(width, height, cfg.minSqm ?? 0);
      const rate = areaPricePerSqm(cfg, material, sqm, areaAddons);
      const selected: SelectedOption[] = [
        { name: "วัสดุ", value: material },
        { name: "ขนาด", value: `${width}×${height} ม. (${sqm.toFixed(2)} ${cfg.unitLabel ?? "ตร.ม."})` },
        ...(pieces > 1 ? [{ name: "จำนวนแผ่น", value: String(pieces) }] : []),
        ...areaAddons.map((a) => ({ name: a, value: "เลือก" }))
      ];
      return { unit: rate, total: sqm * rate * Math.max(pieces, 1), selected, orderQty: pieces, hasPrice: true };
    }
    if (mode === "quote") {
      return { unit: 0, total: 0, selected: opts, orderQty: qty, hasPrice: false };
    }
    return { unit: netUnitPrice(product, qty, opts), total: totalPrice(product, qty, opts), selected: opts, orderQty: qty, hasPrice: true };
  }, [mode, product, qty, opts, sizeIndex, matrixAddons, material, width, height, pieces, areaAddons]);

  const orderSummary = useCallback(() => {
    const optText = priced.selected.map((o) => `${o.name}: ${o.value}`).join(", ");
    const priceText = priced.hasPrice ? ` · รวม ${formatBaht(priced.total)}` : " · ขอใบเสนอราคา";
    return `สนใจสั่ง: ${product.name} x${priced.orderQty}${optText ? ` (${optText})` : ""}${priceText}`;
  }, [priced, product.name]);

  async function submit() {
    setError(null);
    if (!form.name.trim() || !form.phone.trim()) {
      setError("กรุณากรอกชื่อและเบอร์โทร");
      return;
    }
    setSubmitting(true);
    try {
      if (isSupabaseConfigured && supabase) {
        const { error: err } = await supabase.from("shop_orders").insert({
          product_id: product.id.startsWith("demo-") ? null : product.id,
          product_name: product.name,
          category_name: product.categoryName ?? null,
          customer_name: form.name.trim(),
          customer_phone: form.phone.trim(),
          line_id: form.lineId.trim() || null,
          quantity: priced.orderQty,
          options: priced.selected,
          unit_price: priced.unit,
          total_price: priced.total,
          note: form.note.trim() || null
        });
        if (err) throw err;
      }
      setDone(true);
    } catch (e) {
      setError("ส่งคำสั่งซื้อไม่สำเร็จ กรุณาลองใหม่ หรือทักผ่าน LINE");
      // eslint-disable-next-line no-console
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  }

  const lineHref = settings.lineUrl
    ? `${settings.lineUrl}${settings.lineUrl.includes("?") ? "&" : "?"}text=${encodeURIComponent(orderSummary())}`
    : null;
  const matrixTier = mode === "matrix" && product.matrix ? matrixTierForQty(product.matrix, qty) : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="glass w-full max-w-3xl max-h-[92vh] overflow-y-auto soft-scrollbar rounded-t-[2rem] sm:rounded-[2rem]"
      >
        <div className="relative">
          {product.images[0] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.images[0]} alt={product.name} className="h-56 w-full object-cover rounded-t-[2rem]" />
          )}
          <button onClick={onClose} className="absolute top-3 right-3 rounded-full bg-white/90 p-2 text-k2-ink">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {done ? (
            <div className="text-center py-8">
              <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-500" />
              <h3 className="mt-4 text-2xl text-k2-ink">รับคำสั่งซื้อแล้ว!</h3>
              <p className="mt-2 text-k2-muted">ทีมงานจะติดต่อกลับโดยเร็ว หรือทักผ่าน LINE เพื่อความรวดเร็ว</p>
              {lineHref && (
                <a href={lineHref} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-k2-ink px-6 py-3 font-bold text-white">
                  <MessageCircle className="h-5 w-5" /> ทักผ่าน LINE
                </a>
              )}
              <div>
                <button onClick={onClose} className="mt-4 rounded-2xl bg-white/80 px-6 py-2.5 font-bold text-k2-ink">ปิด</button>
              </div>
            </div>
          ) : (
            <>
              {product.categoryName && <p className="text-sm font-bold text-k2-muted">{product.categoryName}</p>}
              <h2 className="text-2xl text-k2-ink">{product.name}</h2>
              {product.description && <p className="mt-2 text-k2-muted">{product.description}</p>}

              {product.leadTimeDays != null && (
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 text-sm font-bold text-k2-ink">
                  <Clock3 className="h-4 w-4" /> ผลิตเร็วภายใน {product.leadTimeDays} วัน
                </p>
              )}

              {/* ===== ตัวเลือกแบบ fixed/quote ===== */}
              {(mode === "fixed" || mode === "quote") && product.options.map((o) => (
                <div key={o.name} className="mt-4">
                  <p className="text-sm font-bold text-k2-ink mb-2">{o.name}</p>
                  <div className="flex flex-wrap gap-2">
                    {o.choices.map((c) => {
                      const isSel = opts.find((s) => s.name === o.name)?.value === c.label;
                      return (
                        <button
                          key={c.label}
                          onClick={() => setOpt(o.name, c.label)}
                          className={`rounded-xl px-3 py-2 text-sm font-bold ${isSel ? "bg-k2-ink text-white" : "bg-white/70 text-k2-ink"}`}
                        >
                          {c.label}
                          {c.priceDelta ? <span className="ml-1 opacity-80">(+{formatBaht(c.priceDelta)})</span> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* ===== matrix: เลือกขนาด + ตัวเลือกเสริม (พวงกุญแจ) ===== */}
              {mode === "matrix" && product.matrix && (
                <>
                  {product.matrix.freebie && (
                    <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-k2-mint/60 px-3 py-1.5 text-sm font-bold text-k2-ink">🎁 {product.matrix.freebie}</p>
                  )}
                  <div className="mt-4">
                    <p className="text-sm font-bold text-k2-ink mb-2">{product.matrix.sizeLabel}</p>
                    <div className="flex flex-wrap gap-2">
                      {product.matrix.sizes.map((s, i) => (
                        <button key={s} onClick={() => setSizeIndex(i)} className={`rounded-xl px-3 py-2 text-sm font-bold ${sizeIndex === i ? "bg-k2-ink text-white" : "bg-white/70 text-k2-ink"}`}>{s}</button>
                      ))}
                    </div>
                  </div>
                  {(product.matrix.addons ?? []).length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-bold text-k2-ink mb-2">ตัวเลือกเสริม</p>
                      <div className="flex flex-wrap gap-2">
                        {product.matrix.addons!.map((a) => (
                          <button key={a.name} onClick={() => toggleIn(matrixAddons, setMatrixAddons, a.name)} className={`rounded-xl px-3 py-2 text-sm font-bold ${matrixAddons.includes(a.name) ? "bg-k2-ink text-white" : "bg-white/70 text-k2-ink"}`}>
                            {a.name} <span className="opacity-80">(+{formatBaht(a.perSize[sizeIndex] ?? 0)})</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {matrixTier && (
                    <div className="mt-4 rounded-2xl bg-white/55 p-3">
                      <p className="text-sm font-bold text-k2-ink mb-2">ยิ่งสั่งเยอะยิ่งถูก (ขนาด {product.matrix.sizes[sizeIndex]})</p>
                      <div className="flex flex-wrap gap-2 text-sm">
                        {[...product.matrix.tiers].sort((a, b) => a.minQty - b.minQty).map((t) => (
                          <span key={t.minQty} className={`rounded-lg px-2.5 py-1 ${t.minQty === matrixTier.minQty ? "bg-k2-mint text-k2-ink font-bold" : "bg-white/70 text-k2-muted"}`}>
                            {t.label ?? `≥${t.minQty}`} · {formatBaht(t.prices[sizeIndex] ?? 0)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ===== area: เลือกวัสดุ + ใส่ขนาด (ไวนิล/สติกเกอร์) ===== */}
              {mode === "area" && product.area && (
                <>
                  <div className="mt-4">
                    <p className="text-sm font-bold text-k2-ink mb-2">เลือกวัสดุ</p>
                    <select value={material} onChange={(e) => setMaterial(e.target.value)} className="w-full rounded-xl bg-white/80 px-3 py-2.5 text-k2-ink font-bold">
                      {product.area.materials.map((m) => (
                        <option key={m.name} value={m.name}>{m.name} · {formatBaht(m.tiers[0]?.price ?? 0)}/{product.area!.unitLabel ?? "ตร.ม."}</option>
                      ))}
                    </select>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <label className="text-sm font-bold text-k2-ink">กว้าง (ม.)
                      <input type="number" step="0.1" min={0} value={width} onChange={(e) => setWidth(Math.max(0, Number(e.target.value)))} className="mt-1 w-full rounded-xl bg-white/80 px-3 py-2 text-k2-ink" />
                    </label>
                    <label className="text-sm font-bold text-k2-ink">ยาว (ม.)
                      <input type="number" step="0.1" min={0} value={height} onChange={(e) => setHeight(Math.max(0, Number(e.target.value)))} className="mt-1 w-full rounded-xl bg-white/80 px-3 py-2 text-k2-ink" />
                    </label>
                    <label className="text-sm font-bold text-k2-ink">จำนวนแผ่น
                      <input type="number" min={1} value={pieces} onChange={(e) => setPieces(Math.max(1, Number(e.target.value) || 1))} className="mt-1 w-full rounded-xl bg-white/80 px-3 py-2 text-k2-ink" />
                    </label>
                  </div>
                  {(product.area.addons ?? []).length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-bold text-k2-ink mb-2">บริการเสริม (ต่อ {product.area.unitLabel ?? "ตร.ม."})</p>
                      <div className="flex flex-wrap gap-2">
                        {product.area.addons!.map((a) => (
                          <button key={a.name} onClick={() => toggleIn(areaAddons, setAreaAddons, a.name)} className={`rounded-xl px-3 py-2 text-sm font-bold ${areaAddons.includes(a.name) ? "bg-k2-ink text-white" : "bg-white/70 text-k2-ink"}`}>
                            {a.name} <span className="opacity-80">(+{formatBaht(a.pricePerSqm)})</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ===== จำนวน (fixed/quote) ===== */}
              {(mode === "fixed" || mode === "quote") && (
                <div className="mt-4 flex items-center gap-3">
                  <p className="text-sm font-bold text-k2-ink">จำนวน ({product.unit})</p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setQty((q) => Math.max(product.minQty, q - 1))} className="h-9 w-9 rounded-xl bg-white/80 text-k2-ink font-bold">−</button>
                    <input type="number" min={product.minQty} value={qty} onChange={(e) => setQty(Math.max(product.minQty, Number(e.target.value) || product.minQty))} className="h-9 w-20 rounded-xl bg-white/80 text-center font-bold text-k2-ink" />
                    <button onClick={() => setQty((q) => q + 1)} className="h-9 w-9 rounded-xl bg-white/80 text-k2-ink font-bold">+</button>
                  </div>
                </div>
              )}

              {/* ===== จำนวน (matrix) ===== */}
              {mode === "matrix" && (
                <div className="mt-4 flex items-center gap-3">
                  <p className="text-sm font-bold text-k2-ink">จำนวน ({product.unit})</p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="h-9 w-9 rounded-xl bg-white/80 text-k2-ink font-bold">−</button>
                    <input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} className="h-9 w-24 rounded-xl bg-white/80 text-center font-bold text-k2-ink" />
                    <button onClick={() => setQty((q) => q + 1)} className="h-9 w-9 rounded-xl bg-white/80 text-k2-ink font-bold">+</button>
                  </div>
                </div>
              )}

              {/* ===== สรุปราคา ===== */}
              {priced.hasPrice ? (
                <div className="mt-4 rounded-2xl bg-k2-cloud p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-k2-muted">
                      {mode === "area" ? `${formatBaht(priced.unit)}/${product.unit}` : `ต่อหน่วย ${formatBaht(priced.unit)}`}
                    </p>
                    <p className="text-2xl font-extrabold text-k2-ink">รวม {formatBaht(priced.total)}</p>
                  </div>
                  <span className="text-sm text-k2-muted">ราคาประเมิน*</span>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl bg-k2-cloud p-4">
                  <p className="text-lg font-extrabold text-k2-ink">สินค้าสั่งทำ — ขอใบเสนอราคา</p>
                  <p className="text-sm text-k2-muted">กรอกรายละเอียด/ขนาดงานในช่องหมายเหตุ ทีมงานจะประเมินราคาและติดต่อกลับ</p>
                </div>
              )}

              {/* ฟอร์มสั่งซื้อ */}
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ชื่อผู้สั่ง *" className="rounded-xl bg-white/80 px-3 py-2.5 text-k2-ink" />
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="เบอร์โทร *" className="rounded-xl bg-white/80 px-3 py-2.5 text-k2-ink" />
                <input value={form.lineId} onChange={(e) => setForm({ ...form, lineId: e.target.value })} placeholder="LINE ID (ถ้ามี)" className="rounded-xl bg-white/80 px-3 py-2.5 text-k2-ink" />
                <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="หมายเหตุ / รายละเอียดงาน" className="rounded-xl bg-white/80 px-3 py-2.5 text-k2-ink" />
              </div>

              {error && <p className="mt-3 text-sm font-bold text-rose-600">{error}</p>}

              <div className="mt-5 flex flex-col sm:flex-row gap-3">
                <button onClick={submit} disabled={submitting} className="flex-1 rounded-2xl bg-k2-ink px-6 py-3.5 font-bold text-white disabled:opacity-60">
                  {submitting ? "กำลังส่ง…" : mode === "quote" ? "ส่งขอใบเสนอราคา" : "ยืนยันสั่งซื้อ"}
                </button>
                {lineHref && (
                  <a href={lineHref} target="_blank" rel="noreferrer" className="flex-1 text-center rounded-2xl bg-white/80 px-6 py-3.5 font-bold text-k2-ink inline-flex items-center justify-center gap-2">
                    <MessageCircle className="h-5 w-5" /> สั่งผ่าน LINE
                  </a>
                )}
              </div>
              <p className="mt-3 text-xs text-k2-muted">*ราคาประเมินเบื้องต้น ทีมงานจะยืนยันราคาสุทธิอีกครั้งตามแบบงานจริง</p>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
