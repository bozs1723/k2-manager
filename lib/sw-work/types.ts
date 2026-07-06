// Sw.Work — Smart Workflow & Production System
// ชนิดข้อมูลและตัวเลือกทั้งหมดของระบบ

export type SwOrderStatus =
  | "quotation"
  | "waiting_confirm"
  | "confirmed"
  | "design"
  | "production"
  | "qc"
  | "delivery"
  | "completed"
  | "cancelled";

export type SwDesignStatus =
  | "waiting_design"
  | "designing"
  | "sent_confirm"
  | "waiting_approval"
  | "ready_production";

export type SwProductType =
  | "acrylic_keychain"
  | "acrylic_sign"
  | "light_box"
  | "sticker"
  | "label"
  | "standee"
  | "pvc_board";

export type SwShape = "circle" | "square" | "rectangle" | "die_cut" | "custom";

export type SwMaterial =
  | "acrylic_3mm"
  | "acrylic_5mm"
  | "acrylic_frost"
  | "pvc"
  | "pp_board"
  | "sticker";

export type SwPrinting = "side_1" | "side_2" | "uv" | "uv_white" | "uv_white_varnish";

export type SwAccessory = "ring" | "star_ring" | "heart_ring" | "chain" | "tassel";

export type SwSizeUnit = "cm" | "mm" | "inch" | "m";

export type SwApprovalDecision = "pending" | "approved" | "revision";

export type SwProductionStatus = "waiting" | "printing" | "cutting" | "finishing" | "done";

export type SwDeliveryStatus = "waiting" | "packed" | "shipped" | "delivered";

export interface SwCustomer {
  id: string;
  name: string;
  phone: string;
  lineId: string;
  company: string;
}

export interface SwOrderFile {
  id: string;
  orderId: string;
  fileName: string;
  fileType: string;
  storagePath?: string;
  publicUrl?: string;
  kind: "artwork" | "mockup" | "reference" | "slip";
}

export interface SwOrder {
  id: string;
  orderCode: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  customerLineId: string;
  customerCompany: string;
  productType: SwProductType;
  width: number;
  height: number;
  sizeUnit: SwSizeUnit;
  quantity: number;
  shape: SwShape;
  material: SwMaterial;
  printing: SwPrinting;
  hasHole: boolean;
  holePosition: string;
  holeSize: string;
  accessories: SwAccessory[];
  notes: string;
  unitPrice: number;
  discount: number;
  vatEnabled: boolean;
  total: number;
  status: SwOrderStatus;
  createdByName: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SwQuotationItem {
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

export interface SwQuotation {
  id: string;
  orderId: string;
  docNumber: string;
  items: SwQuotationItem[];
  subtotal: number;
  discount: number;
  vat: number;
  total: number;
  validUntil?: string;
  status: "draft" | "sent" | "approved" | "rejected";
  sentVia: string[];
}

export interface SwApproval {
  id: string;
  orderId: string;
  docNumber: string;
  mockupUrl?: string;
  productImageUrl?: string;
  decision: SwApprovalDecision;
  customerNote: string;
  signatureName: string;
  decidedAt?: string;
  revisionCount: number;
}

export interface SwDesignTask {
  id: string;
  orderId: string;
  status: SwDesignStatus;
  designerName: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface SwProductionSheet {
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
  status: SwProductionStatus;
}

export interface SwQcChecklist {
  id: string;
  orderId: string;
  docNumber: string;
  checkSize: boolean;
  checkColor: boolean;
  checkQuantity: boolean;
  checkHole: boolean;
  checkMaterial: boolean;
  checkPacking: boolean;
  passed?: boolean | null;
  inspectorName: string;
  note: string;
  checkedAt?: string;
}

export interface SwDelivery {
  id: string;
  orderId: string;
  docNumber: string;
  carrier: string;
  trackingNumber: string;
  shipDate?: string;
  address: string;
  status: SwDeliveryStatus;
  shippedAt?: string;
  deliveredAt?: string;
}

export interface SwStatusHistory {
  id: string;
  orderId: string;
  fromStatus: string | null;
  toStatus: string;
  changedByName: string;
  createdAt: string;
}

// เอกสารครบชุดของออเดอร์เดียว (สร้างอัตโนมัติจาก Sales Order Form)
export interface SwDocumentBundle {
  order: SwOrder;
  quotation: SwQuotation;
  approval: SwApproval;
  designTask: SwDesignTask;
  productionSheet: SwProductionSheet;
  qcChecklist: SwQcChecklist;
  delivery: SwDelivery;
  files: SwOrderFile[];
  history: SwStatusHistory[];
}

// ---------- ป้ายชื่อภาษาไทยของตัวเลือกทั้งหมด ----------

export const SW_PRODUCT_TYPES: Record<SwProductType, string> = {
  acrylic_keychain: "พวงกุญแจอะคริลิค",
  acrylic_sign: "ป้ายอะคริลิค",
  light_box: "กล่องไฟ",
  sticker: "สติกเกอร์",
  label: "ฉลากสินค้า",
  standee: "สแตนดี้",
  pvc_board: "ป้าย PVC"
};

export const SW_SHAPES: Record<SwShape, string> = {
  circle: "วงกลม",
  square: "สี่เหลี่ยมจัตุรัส",
  rectangle: "สี่เหลี่ยมผืนผ้า",
  die_cut: "ไดคัทตามแบบ",
  custom: "กำหนดเอง"
};

export const SW_MATERIALS: Record<SwMaterial, string> = {
  acrylic_3mm: "อะคริลิค 3 มม.",
  acrylic_5mm: "อะคริลิค 5 มม.",
  acrylic_frost: "อะคริลิคฝ้า (Frost)",
  pvc: "PVC",
  pp_board: "PP Board",
  sticker: "สติกเกอร์"
};

export const SW_PRINTINGS: Record<SwPrinting, string> = {
  side_1: "พิมพ์ 1 ด้าน",
  side_2: "พิมพ์ 2 ด้าน",
  uv: "พิมพ์ UV",
  uv_white: "UV + White",
  uv_white_varnish: "UV + White + Varnish"
};

export const SW_ACCESSORIES: Record<SwAccessory, string> = {
  ring: "ห่วงกลม",
  star_ring: "ห่วงดาว",
  heart_ring: "ห่วงหัวใจ",
  chain: "โซ่",
  tassel: "พู่"
};

export const SW_SIZE_UNITS: Record<SwSizeUnit, string> = {
  cm: "ซม.",
  mm: "มม.",
  inch: "นิ้ว",
  m: "เมตร"
};

export const SW_ORDER_STATUSES: Record<SwOrderStatus, string> = {
  quotation: "เสนอราคา",
  waiting_confirm: "รอลูกค้าคอนเฟิร์ม",
  confirmed: "คอนเฟิร์มแล้ว",
  design: "ออกแบบ",
  production: "ผลิต",
  qc: "ตรวจคุณภาพ",
  delivery: "จัดส่ง",
  completed: "เสร็จสิ้น",
  cancelled: "ยกเลิก"
};

export const SW_DESIGN_STATUSES: Record<SwDesignStatus, string> = {
  waiting_design: "รอออกแบบ",
  designing: "กำลังออกแบบ",
  sent_confirm: "ส่งคอนเฟิร์มแล้ว",
  waiting_approval: "รออนุมัติ",
  ready_production: "พร้อมผลิต"
};

export const SW_PRODUCTION_STATUSES: Record<SwProductionStatus, string> = {
  waiting: "รอผลิต",
  printing: "กำลังพิมพ์",
  cutting: "กำลังตัด",
  finishing: "เก็บงาน",
  done: "ผลิตเสร็จ"
};

export const SW_DELIVERY_STATUSES: Record<SwDeliveryStatus, string> = {
  waiting: "รอแพ็ก",
  packed: "แพ็กแล้ว",
  shipped: "จัดส่งแล้ว",
  delivered: "ถึงมือลูกค้า"
};

export const SW_APPROVAL_DECISIONS: Record<SwApprovalDecision, string> = {
  pending: "รอลูกค้าตัดสินใจ",
  approved: "อนุมัติ",
  revision: "ขอแก้ไข"
};

export const SW_CARRIERS = ["Flash Express", "Kerry Express", "J&T Express", "ไปรษณีย์ไทย EMS", "Lalamove", "Grab", "ลูกค้ารับเอง", "ร้านไปส่งเอง"];

// ลำดับ pipeline หลักตาม Business Flow
export const SW_PIPELINE: SwOrderStatus[] = [
  "quotation",
  "waiting_confirm",
  "confirmed",
  "design",
  "production",
  "qc",
  "delivery",
  "completed"
];

// ข้อมูลฟอร์มฝ่ายขาย (กรอกครั้งเดียว)
export interface SwOrderFormInput {
  customerName: string;
  customerPhone: string;
  customerLineId: string;
  customerCompany: string;
  productType: SwProductType;
  width: number;
  height: number;
  sizeUnit: SwSizeUnit;
  quantity: number;
  shape: SwShape;
  material: SwMaterial;
  printing: SwPrinting;
  hasHole: boolean;
  holePosition: string;
  holeSize: string;
  accessories: SwAccessory[];
  notes: string;
  unitPrice: number;
  discount: number;
  vatEnabled: boolean;
  dueDate?: string;
  createdByName?: string;
}
