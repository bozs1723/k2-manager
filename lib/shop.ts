// Types + helper สำหรับหน้าร้านออนไลน์ (storefront) และหน้าแอดมินจัดการสินค้า

export type ProductOptionChoice = {
  label: string;
  priceDelta?: number;
};

export type ProductOption = {
  name: string; // เช่น "ฐาน", "ไซซ์"
  choices: ProductOptionChoice[];
};

export type PriceTier = {
  minQty: number;
  price: number;
};

export type ProductCategory = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  sort: number;
  active: boolean;
};

export type Product = {
  id: string;
  categoryId: string | null;
  categoryName?: string | null;
  name: string;
  slug?: string | null;
  description?: string | null;
  basePrice: number;
  unit: string;
  leadTimeDays?: number | null;
  badge?: string | null;
  images: string[];
  options: ProductOption[];
  priceTiers: PriceTier[];
  minQty: number;
  active: boolean;
  sort: number;
};

export type ShopSettings = {
  shopName: string;
  heroTitle: string;
  heroSubtitle: string;
  lineUrl?: string | null;
  phone?: string | null;
  facebookUrl?: string | null;
};

export type SelectedOption = { name: string; value: string };

export type ShopOrderStatus = "new" | "contacting" | "quoted" | "won" | "lost";

export type ShopOrder = {
  id: string;
  productId: string | null;
  productName: string;
  categoryName?: string | null;
  customerName: string;
  customerPhone: string;
  lineId?: string | null;
  quantity: number;
  options: SelectedOption[];
  unitPrice: number;
  totalPrice: number;
  note?: string | null;
  status: ShopOrderStatus;
  createdAt: string;
};

// ===== คำนวณราคา =====

/** ราคาต่อหน่วยตามจำนวน (ราคาขั้นบันได ยิ่งสั่งเยอะยิ่งถูก) */
export function unitPriceForQty(product: Pick<Product, "basePrice" | "priceTiers">, qty: number): number {
  const tiers = [...(product.priceTiers ?? [])].sort((a, b) => a.minQty - b.minQty);
  let price = product.basePrice;
  for (const tier of tiers) {
    if (qty >= tier.minQty) price = tier.price;
  }
  return price;
}

/** ส่วนต่างราคาจากตัวเลือกที่เลือก (เช่น ฐานปูน +320) */
export function optionsPriceDelta(product: Pick<Product, "options">, selected: SelectedOption[]): number {
  let delta = 0;
  for (const sel of selected) {
    const opt = product.options.find((o) => o.name === sel.name);
    const choice = opt?.choices.find((c) => c.label === sel.value);
    if (choice?.priceDelta) delta += choice.priceDelta;
  }
  return delta;
}

/** ราคาต่อหน่วยสุทธิ (รวมตัวเลือก) */
export function netUnitPrice(product: Product, qty: number, selected: SelectedOption[]): number {
  return unitPriceForQty(product, qty) + optionsPriceDelta(product, selected);
}

/** ราคารวมทั้งคำสั่งซื้อ */
export function totalPrice(product: Product, qty: number, selected: SelectedOption[]): number {
  return netUnitPrice(product, qty, selected) * Math.max(qty, 1);
}

/** ราคาเริ่มต้นที่โชว์บนการ์ด ("เริ่มต้น ฿X") = ราคาต่ำสุดที่เป็นไปได้ */
export function startingPrice(product: Product): number {
  const tierPrices = (product.priceTiers ?? []).map((t) => t.price);
  const lowestTier = tierPrices.length ? Math.min(...tierPrices, product.basePrice) : product.basePrice;
  return lowestTier;
}

export function formatBaht(n: number): string {
  return "฿" + Math.round(n).toLocaleString("th-TH");
}

// ===== แปลงข้อมูลจาก Supabase rows =====

// eslint-disable-next-line
type Row = { [key: string]: any };

export function mapProduct(row: Row): Product {
  return {
    id: row.id,
    categoryId: row.category_id ?? null,
    categoryName: row.category_name ?? row.product_categories?.name ?? null,
    name: row.name,
    slug: row.slug ?? null,
    description: row.description ?? null,
    basePrice: Number(row.base_price ?? 0),
    unit: row.unit ?? "ชิ้น",
    leadTimeDays: row.lead_time_days ?? null,
    badge: row.badge ?? null,
    images: Array.isArray(row.images) ? row.images : [],
    options: Array.isArray(row.options) ? row.options : [],
    priceTiers: Array.isArray(row.price_tiers) ? row.price_tiers : [],
    minQty: Number(row.min_qty ?? 1),
    active: row.active ?? true,
    sort: Number(row.sort ?? 0)
  };
}

export function mapCategory(row: Row): ProductCategory {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? null,
    sort: Number(row.sort ?? 0),
    active: row.active ?? true
  };
}

export function mapSettings(row: Row): ShopSettings {
  return {
    shopName: row?.shop_name ?? "K2Smart",
    heroTitle: row?.hero_title ?? "งานพิมพ์ & ป้าย สั่งทำคุณภาพ ผลิตไว",
    heroSubtitle: row?.hero_subtitle ?? "เลือกสินค้าที่ต้องการ แจ้งจำนวน แล้วสั่งผ่าน LINE ได้ทันที",
    lineUrl: row?.line_url ?? null,
    phone: row?.phone ?? null,
    facebookUrl: row?.facebook_url ?? null
  };
}

export function mapShopOrder(row: Row): ShopOrder {
  return {
    id: row.id,
    productId: row.product_id ?? null,
    productName: row.product_name,
    categoryName: row.category_name ?? null,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    lineId: row.line_id ?? null,
    quantity: Number(row.quantity ?? 1),
    options: Array.isArray(row.options) ? row.options : [],
    unitPrice: Number(row.unit_price ?? 0),
    totalPrice: Number(row.total_price ?? 0),
    note: row.note ?? null,
    status: (row.status ?? "new") as ShopOrderStatus,
    createdAt: row.created_at ?? new Date().toISOString()
  };
}
