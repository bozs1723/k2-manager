// Sw.Work — AI Automation: สร้างเอกสารครบชุดจาก Sales Order เดียว
// ตรรกะนี้ mirror กับ trigger sw_generate_documents ใน Supabase
// (ใช้ตอน demo mode / preview ก่อนบันทึก และเป็น single source ของเลขเอกสาร)
// ไฟล์นี้ standalone (ไม่ import ไฟล์อื่น) เพื่อให้คอมไพล์ทดสอบเดี่ยว ๆ ได้ตามแนวทางของ repo

export type SwDocOrderInput = {
  id: string;
  orderCode: string;
  productType: string;
  width: number;
  height: number;
  sizeUnit: string;
  quantity: number;
  material: string;
  printing: string;
  holePosition: string;
  unitPrice: number;
  discount: number;
  vatEnabled: boolean;
};

// ป้ายชื่อภาษาไทยสำหรับสร้างคำอธิบายในเอกสาร (mirror กับ lib/sw-work/types.ts)
const PRODUCT_LABEL: Record<string, string> = {
  acrylic_keychain: "พวงกุญแจอะคริลิค",
  acrylic_sign: "ป้ายอะคริลิค",
  light_box: "กล่องไฟ",
  sticker: "สติกเกอร์",
  label: "ฉลากสินค้า",
  standee: "สแตนดี้",
  pvc_board: "ป้าย PVC"
};

const MATERIAL_LABEL: Record<string, string> = {
  acrylic_3mm: "อะคริลิค 3 มม.",
  acrylic_5mm: "อะคริลิค 5 มม.",
  acrylic_frost: "อะคริลิคฝ้า (Frost)",
  pvc: "PVC",
  pp_board: "PP Board",
  sticker: "สติกเกอร์"
};

const PRINTING_LABEL: Record<string, string> = {
  side_1: "พิมพ์ 1 ด้าน",
  side_2: "พิมพ์ 2 ด้าน",
  uv: "พิมพ์ UV",
  uv_white: "UV + White",
  uv_white_varnish: "UV + White + Varnish"
};

const UNIT_LABEL: Record<string, string> = {
  cm: "ซม.",
  mm: "มม.",
  inch: "นิ้ว",
  m: "ม."
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// รหัสงานรูปแบบ SWYYMM-0001 (นับต่อจากเลขล่าสุดของเดือนเดียวกัน)
export function swNextOrderCode(existingCodes: string[], now: Date): string {
  const yy = String(now.getFullYear() % 100).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `SW${yy}${mm}-`;
  let max = 0;
  for (const code of existingCodes) {
    if (code.startsWith(prefix)) {
      const run = parseInt(code.slice(prefix.length), 10);
      if (Number.isFinite(run) && run > max) max = run;
    }
  }
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

export function swDocNumbers(orderCode: string): {
  quotation: string;
  approval: string;
  production: string;
  qc: string;
  delivery: string;
} {
  return {
    quotation: `Q-${orderCode}`,
    approval: `CA-${orderCode}`,
    production: `PS-${orderCode}`,
    qc: `QC-${orderCode}`,
    delivery: `DL-${orderCode}`
  };
}

// คำอธิบายรายการสินค้า เช่น "พวงกุญแจอะคริลิค 5x5 ซม. / อะคริลิค 3 มม. / UV + White"
export function swOrderDescription(order: {
  productType: string;
  width: number;
  height: number;
  sizeUnit: string;
  material: string;
  printing: string;
}): string {
  const product = PRODUCT_LABEL[order.productType] ?? order.productType;
  const material = MATERIAL_LABEL[order.material] ?? order.material;
  const printing = PRINTING_LABEL[order.printing] ?? order.printing;
  const unit = UNIT_LABEL[order.sizeUnit] ?? order.sizeUnit;
  return `${product} ${order.width}x${order.height} ${unit} / ${material} / ${printing}`;
}

export function swQrPayload(orderCode: string, orderId: string): string {
  return `SWWORK|${orderCode}|${orderId}`;
}

export function swHasWhiteLayer(printing: string): boolean {
  return printing === "uv_white" || printing === "uv_white_varnish";
}

export function swHasVarnishLayer(printing: string): boolean {
  return printing === "uv_white_varnish";
}

export type SwGeneratedDocuments = {
  quotation: {
    id: string;
    orderId: string;
    docNumber: string;
    items: Array<{ description: string; quantity: number; unit_price: number; amount: number }>;
    subtotal: number;
    discount: number;
    vat: number;
    total: number;
    validUntil: string;
    status: "draft";
    sentVia: string[];
  };
  approval: {
    id: string;
    orderId: string;
    docNumber: string;
    decision: "pending";
    customerNote: string;
    signatureName: string;
    revisionCount: number;
  };
  designTask: {
    id: string;
    orderId: string;
    status: "waiting_design";
    designerName: string;
  };
  productionSheet: {
    id: string;
    orderId: string;
    docNumber: string;
    whiteLayer: boolean;
    varnishLayer: boolean;
    cutLine: string;
    holePosition: string;
    qrPayload: string;
    machine: string;
    operatorName: string;
    status: "waiting";
  };
  qcChecklist: {
    id: string;
    orderId: string;
    docNumber: string;
    checkSize: boolean;
    checkColor: boolean;
    checkQuantity: boolean;
    checkHole: boolean;
    checkMaterial: boolean;
    checkPacking: boolean;
    passed: null;
    inspectorName: string;
    note: string;
  };
  delivery: {
    id: string;
    orderId: string;
    docNumber: string;
    carrier: string;
    trackingNumber: string;
    address: string;
    status: "waiting";
  };
};

// สร้างเอกสารทั้ง 5 ใบ + คิวงานออกแบบ จากออเดอร์เดียว
export function swGenerateDocuments(
  order: SwDocOrderInput,
  now: Date,
  makeId: () => string
): SwGeneratedDocuments {
  const doc = swDocNumbers(order.orderCode);
  const subtotal = round2(order.unitPrice * order.quantity);
  const afterDiscount = Math.max(subtotal - order.discount, 0);
  const vat = order.vatEnabled ? round2(afterDiscount * 0.07) : 0;
  const validUntil = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  return {
    quotation: {
      id: makeId(),
      orderId: order.id,
      docNumber: doc.quotation,
      items: [
        {
          description: swOrderDescription(order),
          quantity: order.quantity,
          unit_price: order.unitPrice,
          amount: subtotal
        }
      ],
      subtotal,
      discount: order.discount,
      vat,
      total: round2(afterDiscount + vat),
      validUntil,
      status: "draft",
      sentVia: []
    },
    approval: {
      id: makeId(),
      orderId: order.id,
      docNumber: doc.approval,
      decision: "pending",
      customerNote: "",
      signatureName: "",
      revisionCount: 0
    },
    designTask: {
      id: makeId(),
      orderId: order.id,
      status: "waiting_design",
      designerName: ""
    },
    productionSheet: {
      id: makeId(),
      orderId: order.id,
      docNumber: doc.production,
      whiteLayer: swHasWhiteLayer(order.printing),
      varnishLayer: swHasVarnishLayer(order.printing),
      cutLine: "",
      holePosition: order.holePosition,
      qrPayload: swQrPayload(order.orderCode, order.id),
      machine: "",
      operatorName: "",
      status: "waiting"
    },
    qcChecklist: {
      id: makeId(),
      orderId: order.id,
      docNumber: doc.qc,
      checkSize: false,
      checkColor: false,
      checkQuantity: false,
      checkHole: false,
      checkMaterial: false,
      checkPacking: false,
      passed: null,
      inspectorName: "",
      note: ""
    },
    delivery: {
      id: makeId(),
      orderId: order.id,
      docNumber: doc.delivery,
      carrier: "",
      trackingNumber: "",
      address: "",
      status: "waiting"
    }
  };
}
