// Sw.Work — เครื่องคำนวณราคาอัตโนมัติ
// ไฟล์นี้ standalone (ไม่ import ไฟล์อื่น) เพื่อให้คอมไพล์ทดสอบเดี่ยว ๆ ได้ตามแนวทางของ repo

export type SwPricingInput = {
  productType: string;   // acrylic_keychain | acrylic_sign | light_box | sticker | label | standee | pvc_board
  material: string;      // acrylic_3mm | acrylic_5mm | acrylic_frost | pvc | pp_board | sticker
  printing: string;      // side_1 | side_2 | uv | uv_white | uv_white_varnish
  width: number;
  height: number;
  sizeUnit: string;      // cm | mm | inch | m
  quantity: number;
  hasHole: boolean;
  accessories: string[]; // ring | star_ring | heart_ring | chain | tassel
};

export type SwPricingResult = {
  areaCm2: number;
  materialCost: number;
  printingCost: number;
  holeCost: number;
  accessoryCost: number;
  unitPrice: number;
  subtotal: number;
  tierDiscountRate: number;
  tierDiscount: number;
  total: number;
};

// อัตราค่าวัสดุ (บาท/ตร.ซม.) และราคาขั้นต่ำต่อชิ้น
const MATERIAL_RATE: Record<string, { perCm2: number; minPerPiece: number }> = {
  acrylic_3mm: { perCm2: 0.45, minPerPiece: 25 },
  acrylic_5mm: { perCm2: 0.65, minPerPiece: 35 },
  acrylic_frost: { perCm2: 0.55, minPerPiece: 30 },
  pvc: { perCm2: 0.12, minPerPiece: 15 },
  pp_board: { perCm2: 0.1, minPerPiece: 15 },
  sticker: { perCm2: 0.06, minPerPiece: 5 }
};

// ตัวคูณตามวิธีพิมพ์
const PRINTING_MULTIPLIER: Record<string, number> = {
  side_1: 1,
  side_2: 1.7,
  uv: 1.25,
  uv_white: 1.5,
  uv_white_varnish: 1.75
};

// ค่าอุปกรณ์เสริม (บาท/ชิ้น)
const ACCESSORY_PRICE: Record<string, number> = {
  ring: 2,
  star_ring: 4,
  heart_ring: 4,
  chain: 8,
  tassel: 10
};

// ค่าเจาะรู (บาท/ชิ้น)
const HOLE_PRICE = 3;

// ส่วนลดตามจำนวน (ยิ่งสั่งมาก ยิ่งถูก)
const QUANTITY_TIERS: Array<{ min: number; rate: number }> = [
  { min: 500, rate: 0.2 },
  { min: 200, rate: 0.15 },
  { min: 100, rate: 0.1 },
  { min: 50, rate: 0.05 },
  { min: 1, rate: 0 }
];

const UNIT_TO_CM: Record<string, number> = {
  cm: 1,
  mm: 0.1,
  inch: 2.54,
  m: 100
};

export function swAreaCm2(width: number, height: number, sizeUnit: string): number {
  const factor = UNIT_TO_CM[sizeUnit] ?? 1;
  const w = Math.max(width, 0) * factor;
  const h = Math.max(height, 0) * factor;
  return Math.round(w * h * 100) / 100;
}

export function swTierDiscountRate(quantity: number): number {
  for (const tier of QUANTITY_TIERS) {
    if (quantity >= tier.min) return tier.rate;
  }
  return 0;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// คำนวณราคาอัตโนมัติจากข้อมูลใน Sales Order Form
export function swCalculatePrice(input: SwPricingInput): SwPricingResult {
  const quantity = Math.max(Math.floor(input.quantity) || 0, 0);
  const area = swAreaCm2(input.width, input.height, input.sizeUnit);
  const rate = MATERIAL_RATE[input.material] ?? MATERIAL_RATE.acrylic_3mm;
  const multiplier = PRINTING_MULTIPLIER[input.printing] ?? 1;

  const materialCost = round2(Math.max(area * rate.perCm2, rate.minPerPiece));
  const printingCost = round2(materialCost * (multiplier - 1));
  const holeCost = input.hasHole ? HOLE_PRICE : 0;
  const accessoryCost = round2(
    input.accessories.reduce((sum, acc) => sum + (ACCESSORY_PRICE[acc] ?? 0), 0)
  );

  const unitPrice = round2(materialCost + printingCost + holeCost + accessoryCost);
  const subtotal = round2(unitPrice * quantity);
  const tierDiscountRate = swTierDiscountRate(quantity);
  const tierDiscount = round2(subtotal * tierDiscountRate);
  const total = round2(subtotal - tierDiscount);

  return {
    areaCm2: area,
    materialCost,
    printingCost,
    holeCost,
    accessoryCost,
    unitPrice,
    subtotal,
    tierDiscountRate,
    tierDiscount,
    total
  };
}

export function swVatAmount(amountAfterDiscount: number, vatEnabled: boolean): number {
  if (!vatEnabled) return 0;
  return round2(Math.max(amountAfterDiscount, 0) * 0.07);
}

export function swGrandTotal(subtotal: number, discount: number, vatEnabled: boolean): number {
  const after = Math.max(subtotal - Math.max(discount, 0), 0);
  return round2(after + swVatAmount(after, vatEnabled));
}
