"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, LogOut, Plus, Save, Trash2 } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  PriceTier,
  Product,
  ProductCategory,
  ProductOption,
  ShopOrder,
  ShopSettings,
  formatBaht,
  mapCategory,
  mapProduct,
  mapSettings,
  mapShopOrder
} from "@/lib/shop";

type Tab = "products" | "categories" | "orders" | "settings";

export default function ShopAdminPage() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<Tab>("products");

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(Boolean(data.session));
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setAuthed(Boolean(session)));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!ready) {
    return <Center><Loader2 className="h-8 w-8 animate-spin text-k2-ink" /></Center>;
  }

  if (!isSupabaseConfigured) {
    return (
      <Center>
        <div className="glass rounded-3xl p-8 max-w-md text-center">
          <h1 className="text-2xl text-k2-ink">ยังไม่ได้ตั้งค่า Supabase</h1>
          <p className="mt-2 text-k2-muted">ตั้งค่า NEXT_PUBLIC_SUPABASE_URL และ key ก่อนใช้งานหน้าจัดการสินค้า</p>
          <Link href="/shop" className="mt-4 inline-block underline text-k2-ink">กลับหน้าร้าน</Link>
        </div>
      </Center>
    );
  }

  if (!authed) return <LoginCard />;

  return (
    <main className="min-h-screen px-4 py-6">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl text-k2-ink">จัดการร้านค้าออนไลน์</h1>
            <Link href="/shop" className="text-sm underline text-k2-muted">เปิดหน้าร้าน →</Link>
          </div>
          <button onClick={() => supabase?.auth.signOut()} className="inline-flex items-center gap-2 rounded-xl bg-white/80 px-4 py-2 font-bold text-k2-ink">
            <LogOut className="h-4 w-4" /> ออกจากระบบ
          </button>
        </header>

        <nav className="mt-5 flex flex-wrap gap-2">
          {([["products", "สินค้า"], ["categories", "หมวด"], ["orders", "คำสั่งซื้อ"], ["settings", "ตั้งค่าร้าน"]] as [Tab, string][]).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} className={`rounded-full px-4 py-2 text-sm font-bold ${tab === k ? "bg-k2-ink text-white" : "bg-white/70 text-k2-ink"}`}>
              {label}
            </button>
          ))}
        </nav>

        <div className="mt-5">
          {tab === "products" && <ProductsTab />}
          {tab === "categories" && <CategoriesTab />}
          {tab === "orders" && <OrdersTab />}
          {tab === "settings" && <SettingsTab />}
        </div>
      </div>
    </main>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen flex items-center justify-center p-4">{children}</main>;
}

function LoginCard() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function login() {
    setErr(null);
    setBusy(true);
    const { error } = await supabase!.auth.signInWithPassword({ email, password });
    if (error) setErr("เข้าสู่ระบบไม่สำเร็จ ตรวจสอบอีเมล/รหัสผ่าน");
    setBusy(false);
  }

  return (
    <Center>
      <div className="glass rounded-3xl p-8 max-w-sm w-full">
        <h1 className="text-2xl text-k2-ink text-center">เข้าสู่ระบบจัดการสินค้า</h1>
        <p className="mt-1 text-center text-sm text-k2-muted">ใช้บัญชีทีมงาน (Owner/Manager/Admin)</p>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="อีเมล" className="mt-5 w-full rounded-xl bg-white/80 px-3 py-2.5 text-k2-ink" />
        <input value={password} type="password" onChange={(e) => setPassword(e.target.value)} placeholder="รหัสผ่าน" className="mt-3 w-full rounded-xl bg-white/80 px-3 py-2.5 text-k2-ink" onKeyDown={(e) => e.key === "Enter" && login()} />
        {err && <p className="mt-3 text-sm font-bold text-rose-600">{err}</p>}
        <button onClick={login} disabled={busy} className="mt-4 w-full rounded-2xl bg-k2-ink px-6 py-3 font-bold text-white disabled:opacity-60">
          {busy ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
        </button>
        <Link href="/shop" className="mt-4 block text-center text-sm underline text-k2-muted">กลับหน้าร้าน</Link>
      </div>
    </Center>
  );
}

// ===================== สินค้า =====================
const EMPTY_PRODUCT: Partial<Product> = {
  name: "",
  description: "",
  basePrice: 0,
  unit: "ชิ้น",
  images: [],
  options: [],
  priceTiers: [],
  minQty: 1,
  active: true,
  sort: 0
};

function ProductsTab() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const [{ data: p }, { data: c }] = await Promise.all([
      supabase!.from("products").select("*, product_categories(name)").order("sort"),
      supabase!.from("product_categories").select("*").order("sort")
    ]);
    setProducts((p ?? []).map(mapProduct));
    setCategories((c ?? []).map(mapCategory));
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function remove(id: string) {
    if (!confirm("ลบสินค้านี้?")) return;
    await supabase!.from("products").delete().eq("id", id);
    reload();
  }

  if (editing) {
    return <ProductForm draft={editing} categories={categories} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />;
  }

  return (
    <div>
      <button onClick={() => setEditing({ ...EMPTY_PRODUCT })} className="inline-flex items-center gap-2 rounded-2xl bg-k2-ink px-5 py-2.5 font-bold text-white">
        <Plus className="h-4 w-4" /> เพิ่มสินค้า
      </button>
      {loading ? (
        <p className="mt-6 text-k2-muted">กำลังโหลด…</p>
      ) : (
        <div className="mt-4 grid gap-3">
          {products.map((p) => (
            <div key={p.id} className="glass rounded-2xl p-4 flex items-center gap-4">
              <div className="h-16 w-16 rounded-xl bg-k2-cloud overflow-hidden flex-shrink-0">
                {p.images[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-k2-ink truncate">{p.name}</p>
                <p className="text-sm text-k2-muted">{p.categoryName ?? "ไม่มีหมวด"} · {formatBaht(p.basePrice)} / {p.unit} {p.active ? "" : "· (ปิดขาย)"}</p>
              </div>
              <button onClick={() => setEditing(p)} className="rounded-xl bg-white/80 px-4 py-2 text-sm font-bold text-k2-ink">แก้ไข</button>
              <button onClick={() => remove(p.id)} className="rounded-xl bg-white/80 p-2 text-rose-600"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
          {products.length === 0 && <p className="text-k2-muted">ยังไม่มีสินค้า กดเพิ่มสินค้าด้านบน</p>}
        </div>
      )}
    </div>
  );
}

function ProductForm({ draft, categories, onClose, onSaved }: { draft: Partial<Product>; categories: ProductCategory[]; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<Partial<Product>>({ ...draft });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const set = (patch: Partial<Product>) => setD((cur) => ({ ...cur, ...patch }));

  async function uploadImage(file: File) {
    if (!supabase) return;
    setUploading(true);
    const path = `products/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
    const { error } = await supabase.storage.from("shop-images").upload(path, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from("shop-images").getPublicUrl(path);
      set({ images: [...(d.images ?? []), data.publicUrl] });
    }
    setUploading(false);
  }

  async function save() {
    setSaving(true);
    const payload = {
      category_id: d.categoryId || null,
      name: d.name,
      description: d.description || null,
      base_price: Number(d.basePrice) || 0,
      unit: d.unit || "ชิ้น",
      lead_time_days: d.leadTimeDays ? Number(d.leadTimeDays) : null,
      badge: d.badge || null,
      images: d.images ?? [],
      options: d.options ?? [],
      price_tiers: d.priceTiers ?? [],
      min_qty: Number(d.minQty) || 1,
      active: d.active ?? true,
      sort: Number(d.sort) || 0,
      updated_at: new Date().toISOString()
    };
    if (d.id) {
      await supabase!.from("products").update(payload).eq("id", d.id);
    } else {
      await supabase!.from("products").insert(payload);
    }
    setSaving(false);
    onSaved();
  }

  return (
    <div className="glass rounded-3xl p-6">
      <h2 className="text-xl text-k2-ink">{d.id ? "แก้ไขสินค้า" : "เพิ่มสินค้า"}</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="ชื่อสินค้า *"><input value={d.name ?? ""} onChange={(e) => set({ name: e.target.value })} className={inputCls} /></Field>
        <Field label="หมวด">
          <select value={d.categoryId ?? ""} onChange={(e) => set({ categoryId: e.target.value || null })} className={inputCls}>
            <option value="">— ไม่ระบุ —</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="ราคาเริ่มต้น (ต่อหน่วย)"><input type="number" value={d.basePrice ?? 0} onChange={(e) => set({ basePrice: Number(e.target.value) })} className={inputCls} /></Field>
        <Field label="หน่วย"><input value={d.unit ?? ""} onChange={(e) => set({ unit: e.target.value })} className={inputCls} /></Field>
        <Field label="ผลิตเร็วกี่วัน (ว่างได้)"><input type="number" value={d.leadTimeDays ?? ""} onChange={(e) => set({ leadTimeDays: e.target.value ? Number(e.target.value) : null })} className={inputCls} /></Field>
        <Field label="ป้ายมุมการ์ด เช่น ขายดี"><input value={d.badge ?? ""} onChange={(e) => set({ badge: e.target.value })} className={inputCls} /></Field>
        <Field label="ลำดับการแสดง"><input type="number" value={d.sort ?? 0} onChange={(e) => set({ sort: Number(e.target.value) })} className={inputCls} /></Field>
        <Field label="ขั้นต่ำ (ชิ้น)"><input type="number" value={d.minQty ?? 1} onChange={(e) => set({ minQty: Number(e.target.value) })} className={inputCls} /></Field>
      </div>

      <Field label="รายละเอียด"><textarea value={d.description ?? ""} onChange={(e) => set({ description: e.target.value })} rows={3} className={inputCls} /></Field>

      {/* รูปภาพ */}
      <div className="mt-4">
        <p className="text-sm font-bold text-k2-ink mb-2">รูปสินค้า</p>
        <div className="flex flex-wrap gap-2">
          {(d.images ?? []).map((url, i) => (
            <div key={url + i} className="relative h-20 w-20 rounded-xl overflow-hidden bg-k2-cloud">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
              <button onClick={() => set({ images: (d.images ?? []).filter((_, j) => j !== i) })} className="absolute top-0.5 right-0.5 rounded-full bg-white/90 p-0.5 text-rose-600"><Trash2 className="h-3 w-3" /></button>
            </div>
          ))}
          <label className="h-20 w-20 rounded-xl bg-white/70 flex items-center justify-center cursor-pointer text-k2-muted">
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} />
          </label>
        </div>
        <input value="" placeholder="หรือวางลิงก์รูปแล้ว Enter" onKeyDown={(e) => {
          if (e.key === "Enter") {
            const v = (e.target as HTMLInputElement).value.trim();
            if (v) { set({ images: [...(d.images ?? []), v] }); (e.target as HTMLInputElement).value = ""; }
          }
        }} className={inputCls + " mt-2"} />
      </div>

      {/* ราคาขั้นบันได */}
      <TiersEditor tiers={d.priceTiers ?? []} unit={d.unit ?? "ชิ้น"} onChange={(t) => set({ priceTiers: t })} />

      {/* ตัวเลือก */}
      <OptionsEditor options={d.options ?? []} onChange={(o) => set({ options: o })} />

      <label className="mt-4 flex items-center gap-2 text-k2-ink font-bold">
        <input type="checkbox" checked={d.active ?? true} onChange={(e) => set({ active: e.target.checked })} /> เปิดขาย (แสดงบนหน้าร้าน)
      </label>

      <div className="mt-5 flex gap-3">
        <button onClick={save} disabled={saving || !d.name} className="inline-flex items-center gap-2 rounded-2xl bg-k2-ink px-6 py-3 font-bold text-white disabled:opacity-60">
          <Save className="h-4 w-4" /> {saving ? "กำลังบันทึก…" : "บันทึก"}
        </button>
        <button onClick={onClose} className="rounded-2xl bg-white/80 px-6 py-3 font-bold text-k2-ink">ยกเลิก</button>
      </div>
    </div>
  );
}

function TiersEditor({ tiers, unit, onChange }: { tiers: PriceTier[]; unit: string; onChange: (t: PriceTier[]) => void }) {
  return (
    <div className="mt-4 rounded-2xl bg-white/55 p-4">
      <p className="text-sm font-bold text-k2-ink mb-2">ราคาขั้นบันได (ยิ่งสั่งเยอะยิ่งถูก)</p>
      {tiers.map((t, i) => (
        <div key={i} className="flex items-center gap-2 mb-2">
          <span className="text-sm text-k2-muted">ตั้งแต่</span>
          <input type="number" value={t.minQty} onChange={(e) => onChange(tiers.map((x, j) => j === i ? { ...x, minQty: Number(e.target.value) } : x))} className="w-20 rounded-lg bg-white/80 px-2 py-1.5 text-k2-ink" />
          <span className="text-sm text-k2-muted">{unit} ราคา</span>
          <input type="number" value={t.price} onChange={(e) => onChange(tiers.map((x, j) => j === i ? { ...x, price: Number(e.target.value) } : x))} className="w-24 rounded-lg bg-white/80 px-2 py-1.5 text-k2-ink" />
          <button onClick={() => onChange(tiers.filter((_, j) => j !== i))} className="text-rose-600"><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}
      <button onClick={() => onChange([...tiers, { minQty: 1, price: 0 }])} className="text-sm font-bold text-k2-ink inline-flex items-center gap-1"><Plus className="h-3.5 w-3.5" /> เพิ่มขั้นราคา</button>
    </div>
  );
}

function OptionsEditor({ options, onChange }: { options: ProductOption[]; onChange: (o: ProductOption[]) => void }) {
  return (
    <div className="mt-4 rounded-2xl bg-white/55 p-4">
      <p className="text-sm font-bold text-k2-ink mb-2">ตัวเลือกสินค้า (เช่น ขนาด, วัสดุ)</p>
      {options.map((opt, oi) => (
        <div key={oi} className="mb-3 rounded-xl bg-white/70 p-3">
          <div className="flex items-center gap-2 mb-2">
            <input value={opt.name} placeholder="ชื่อตัวเลือก เช่น ฐาน" onChange={(e) => onChange(options.map((x, j) => j === oi ? { ...x, name: e.target.value } : x))} className="flex-1 rounded-lg bg-white/90 px-2 py-1.5 text-k2-ink font-bold" />
            <button onClick={() => onChange(options.filter((_, j) => j !== oi))} className="text-rose-600"><Trash2 className="h-4 w-4" /></button>
          </div>
          {opt.choices.map((ch, ci) => (
            <div key={ci} className="flex items-center gap-2 mb-1.5 pl-2">
              <input value={ch.label} placeholder="ตัวเลือก เช่น ฐานปูน" onChange={(e) => onChange(options.map((x, j) => j === oi ? { ...x, choices: x.choices.map((c, k) => k === ci ? { ...c, label: e.target.value } : c) } : x))} className="flex-1 rounded-lg bg-white/90 px-2 py-1.5 text-k2-ink" />
              <span className="text-xs text-k2-muted">+ราคา</span>
              <input type="number" value={ch.priceDelta ?? 0} onChange={(e) => onChange(options.map((x, j) => j === oi ? { ...x, choices: x.choices.map((c, k) => k === ci ? { ...c, priceDelta: Number(e.target.value) } : c) } : x))} className="w-20 rounded-lg bg-white/90 px-2 py-1.5 text-k2-ink" />
              <button onClick={() => onChange(options.map((x, j) => j === oi ? { ...x, choices: x.choices.filter((_, k) => k !== ci) } : x))} className="text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          <button onClick={() => onChange(options.map((x, j) => j === oi ? { ...x, choices: [...x.choices, { label: "", priceDelta: 0 }] } : x))} className="text-xs font-bold text-k2-ink pl-2">+ เพิ่มตัวเลือกย่อย</button>
        </div>
      ))}
      <button onClick={() => onChange([...options, { name: "", choices: [{ label: "", priceDelta: 0 }] }])} className="text-sm font-bold text-k2-ink inline-flex items-center gap-1"><Plus className="h-3.5 w-3.5" /> เพิ่มกลุ่มตัวเลือก</button>
    </div>
  );
}

// ===================== หมวด =====================
function CategoriesTab() {
  const [cats, setCats] = useState<ProductCategory[]>([]);
  const [name, setName] = useState("");

  const reload = useCallback(async () => {
    const { data } = await supabase!.from("product_categories").select("*").order("sort");
    setCats((data ?? []).map(mapCategory));
  }, []);
  useEffect(() => { reload(); }, [reload]);

  async function add() {
    if (!name.trim()) return;
    const slug = name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^\w\-ก-๙]/g, "") + "-" + Date.now().toString(36);
    await supabase!.from("product_categories").insert({ name: name.trim(), slug, sort: cats.length + 1 });
    setName("");
    reload();
  }
  async function toggle(c: ProductCategory) {
    await supabase!.from("product_categories").update({ active: !c.active }).eq("id", c.id);
    reload();
  }
  async function remove(id: string) {
    if (!confirm("ลบหมวดนี้?")) return;
    await supabase!.from("product_categories").delete().eq("id", id);
    reload();
  }

  return (
    <div>
      <div className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อหมวดใหม่" className={inputCls} onKeyDown={(e) => e.key === "Enter" && add()} />
        <button onClick={add} className="rounded-2xl bg-k2-ink px-5 py-2.5 font-bold text-white whitespace-nowrap">เพิ่ม</button>
      </div>
      <div className="mt-4 grid gap-2">
        {cats.map((c) => (
          <div key={c.id} className="glass rounded-2xl p-4 flex items-center gap-3">
            <span className="flex-1 font-bold text-k2-ink">{c.name} {c.active ? "" : "· (ซ่อน)"}</span>
            <button onClick={() => toggle(c)} className="rounded-xl bg-white/80 px-3 py-1.5 text-sm font-bold text-k2-ink">{c.active ? "ซ่อน" : "แสดง"}</button>
            <button onClick={() => remove(c.id)} className="rounded-xl bg-white/80 p-2 text-rose-600"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===================== คำสั่งซื้อ =====================
const ORDER_STATUSES: ShopOrder["status"][] = ["new", "contacting", "quoted", "won", "lost"];
const STATUS_LABEL: Record<ShopOrder["status"], string> = { new: "ใหม่", contacting: "กำลังติดต่อ", quoted: "เสนอราคาแล้ว", won: "ปิดการขาย", lost: "ไม่สำเร็จ" };

function OrdersTab() {
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase!.from("shop_orders").select("*").order("created_at", { ascending: false });
    setOrders((data ?? []).map(mapShopOrder));
    setLoading(false);
  }, []);
  useEffect(() => { reload(); }, [reload]);

  async function setStatus(id: string, status: ShopOrder["status"]) {
    await supabase!.from("shop_orders").update({ status }).eq("id", id);
    setOrders((cur) => cur.map((o) => o.id === id ? { ...o, status } : o));
  }

  if (loading) return <p className="text-k2-muted">กำลังโหลด…</p>;
  if (orders.length === 0) return <p className="text-k2-muted">ยังไม่มีคำสั่งซื้อ — คำสั่งซื้อจากหน้าร้านจะเข้าระบบเป็น Lead อัตโนมัติด้วย</p>;

  return (
    <div className="grid gap-3">
      {orders.map((o) => (
        <div key={o.id} className="glass rounded-2xl p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="font-bold text-k2-ink">{o.productName} <span className="text-k2-muted font-normal">x{o.quantity}</span></p>
              <p className="text-sm text-k2-muted">{o.customerName} · {o.customerPhone}{o.lineId ? ` · LINE: ${o.lineId}` : ""}</p>
              {o.options.length > 0 && <p className="text-sm text-k2-muted">{o.options.map((x) => `${x.name}: ${x.value}`).join(" · ")}</p>}
              {o.note && <p className="text-sm text-k2-muted">หมายเหตุ: {o.note}</p>}
              <p className="text-xs text-k2-muted mt-1">{new Date(o.createdAt).toLocaleString("th-TH")}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-extrabold text-k2-ink">{formatBaht(o.totalPrice)}</p>
              <select value={o.status} onChange={(e) => setStatus(o.id, e.target.value as ShopOrder["status"])} className="mt-1 rounded-lg bg-white/80 px-2 py-1.5 text-sm font-bold text-k2-ink">
                {ORDER_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ===================== ตั้งค่าร้าน =====================
function SettingsTab() {
  const [s, setS] = useState<ShopSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase!.from("shop_settings").select("*").eq("id", 1).maybeSingle().then(({ data }) => setS(mapSettings(data)));
  }, []);

  async function save() {
    if (!s) return;
    setSaving(true);
    await supabase!.from("shop_settings").update({
      shop_name: s.shopName,
      hero_title: s.heroTitle,
      hero_subtitle: s.heroSubtitle,
      line_url: s.lineUrl || null,
      phone: s.phone || null,
      facebook_url: s.facebookUrl || null,
      updated_at: new Date().toISOString()
    }).eq("id", 1);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!s) return <p className="text-k2-muted">กำลังโหลด…</p>;

  return (
    <div className="glass rounded-3xl p-6 max-w-xl">
      <Field label="ชื่อร้าน"><input value={s.shopName} onChange={(e) => setS({ ...s, shopName: e.target.value })} className={inputCls} /></Field>
      <Field label="หัวข้อใหญ่ (Hero)"><input value={s.heroTitle} onChange={(e) => setS({ ...s, heroTitle: e.target.value })} className={inputCls} /></Field>
      <Field label="คำโปรย"><input value={s.heroSubtitle} onChange={(e) => setS({ ...s, heroSubtitle: e.target.value })} className={inputCls} /></Field>
      <Field label="ลิงก์ LINE (เช่น https://lin.ee/xxxx)"><input value={s.lineUrl ?? ""} onChange={(e) => setS({ ...s, lineUrl: e.target.value })} className={inputCls} /></Field>
      <Field label="เบอร์โทร"><input value={s.phone ?? ""} onChange={(e) => setS({ ...s, phone: e.target.value })} className={inputCls} /></Field>
      <Field label="ลิงก์ Facebook"><input value={s.facebookUrl ?? ""} onChange={(e) => setS({ ...s, facebookUrl: e.target.value })} className={inputCls} /></Field>
      <button onClick={save} disabled={saving} className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-k2-ink px-6 py-3 font-bold text-white disabled:opacity-60">
        <Save className="h-4 w-4" /> {saving ? "กำลังบันทึก…" : saved ? "บันทึกแล้ว ✓" : "บันทึก"}
      </button>
    </div>
  );
}

// ===================== shared =====================
const inputCls = "w-full rounded-xl bg-white/80 px-3 py-2.5 text-k2-ink";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mt-4 first:mt-0">
      <span className="text-sm font-bold text-k2-ink">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
