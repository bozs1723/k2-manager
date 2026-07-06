// Sw.Work — ชั้นข้อมูล
// ใช้ Supabase เมื่อคอนฟิกและล็อกอินแล้ว, ถ้าไม่มีก็ทำงานในโหมดเดโม (localStorage)
// เพื่อให้พรีวิว UI ได้เสมอ ตามแนวทางเดียวกับแอปหลัก

import { supabase } from "../supabase";
import {
  swGenerateDocuments,
  swNextOrderCode,
  swQrPayload
} from "./documents";
import type {
  SwApproval,
  SwDelivery,
  SwDesignStatus,
  SwDesignTask,
  SwDocumentBundle,
  SwOrder,
  SwOrderFile,
  SwOrderFormInput,
  SwOrderStatus,
  SwProductionSheet,
  SwQcChecklist,
  SwQuotation,
  SwStatusHistory
} from "./types";

const DEMO_KEY = "sw-work-demo-v2";

export type SwMode = "cloud" | "demo";

type DemoDb = {
  orders: SwOrder[];
  quotations: SwQuotation[];
  approvals: SwApproval[];
  designTasks: SwDesignTask[];
  productionSheets: SwProductionSheet[];
  qcChecklists: SwQcChecklist[];
  deliveries: SwDelivery[];
  files: SwOrderFile[];
  history: SwStatusHistory[];
};

function emptyDb(): DemoDb {
  return {
    orders: [],
    quotations: [],
    approvals: [],
    designTasks: [],
    productionSheets: [],
    qcChecklists: [],
    deliveries: [],
    files: [],
    history: []
  };
}

function makeId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `sw-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function loadDemo(): DemoDb {
  if (typeof window === "undefined") return emptyDb();
  try {
    const raw = window.localStorage.getItem(DEMO_KEY);
    if (!raw) return seedDemo();
    return { ...emptyDb(), ...(JSON.parse(raw) as DemoDb) };
  } catch {
    return seedDemo();
  }
}

function saveDemo(db: DemoDb) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DEMO_KEY, JSON.stringify(db));
  } catch {
    // เต็ม/ปิดใช้งาน localStorage — โหมดเดโมยอมให้ข้อมูลหายได้
  }
}

// ตัวอย่างข้อมูลเริ่มต้นของโหมดเดโม เพื่อให้เห็นภาพ pipeline ทันที
function seedDemo(): DemoDb {
  const db = emptyDb();
  const samples: Array<{ form: SwOrderFormInput; status: SwOrderStatus }> = [
    {
      status: "waiting_confirm",
      form: {
        customerName: "คุณมายด์",
        customerPhone: "081-234-5678",
        customerLineId: "@mind.shop",
        customerCompany: "",
        productType: "acrylic_keychain",
        width: 5,
        height: 5,
        sizeUnit: "cm",
        quantity: 100,
        shape: "die_cut",
        material: "acrylic_3mm",
        printing: "uv_white",
        hasHole: true,
        holePosition: "บนกลาง",
        holeSize: "3 มม.",
        accessories: ["ring"],
        notes: "งานแฟนมีต ขอสีสดตามไฟล์",
        unitPrice: 42.5,
        discount: 425,
        vatEnabled: false,
        createdByName: "ฝ่ายขาย (เดโม)"
      }
    },
    {
      status: "design",
      form: {
        customerName: "บจก. เอสเจ คาเฟ่",
        customerPhone: "02-111-2222",
        customerLineId: "",
        customerCompany: "SJ Cafe Co., Ltd.",
        productType: "acrylic_sign",
        width: 60,
        height: 40,
        sizeUnit: "cm",
        quantity: 1,
        shape: "rectangle",
        material: "acrylic_5mm",
        printing: "uv",
        hasHole: true,
        holePosition: "4 มุม",
        holeSize: "6 มม.",
        accessories: [],
        notes: "ป้ายหน้าร้าน ติดตั้งเองได้",
        unitPrice: 1950,
        discount: 0,
        vatEnabled: true,
        createdByName: "ฝ่ายขาย (เดโม)"
      }
    },
    {
      status: "production",
      form: {
        customerName: "คุณเบนซ์",
        customerPhone: "089-999-0000",
        customerLineId: "benz_p",
        customerCompany: "",
        productType: "sticker",
        width: 8,
        height: 8,
        sizeUnit: "cm",
        quantity: 500,
        shape: "die_cut",
        material: "sticker",
        printing: "side_1",
        hasHole: false,
        holePosition: "",
        holeSize: "",
        accessories: [],
        notes: "สติกเกอร์ติดแก้ว กันน้ำ",
        unitPrice: 5,
        discount: 500,
        vatEnabled: false,
        createdByName: "ฝ่ายขาย (เดโม)"
      }
    }
  ];
  const now = new Date();
  for (const sample of samples) {
    createDemoOrder(db, sample.form, now);
    const order = db.orders[db.orders.length - 1];
    if (order.status !== sample.status) {
      pushDemoStatus(db, order, sample.status);
    }
  }
  saveDemo(db);
  return db;
}

function createDemoOrder(db: DemoDb, form: SwOrderFormInput, now: Date): SwDocumentBundle {
  const id = makeId();
  const orderCode = swNextOrderCode(db.orders.map((o) => o.orderCode), now);
  const subtotal = form.unitPrice * form.quantity;
  const afterDiscount = Math.max(subtotal - form.discount, 0);
  const vat = form.vatEnabled ? Math.round(afterDiscount * 7) / 100 : 0;

  const order: SwOrder = {
    id,
    orderCode,
    customerName: form.customerName,
    customerPhone: form.customerPhone,
    customerLineId: form.customerLineId,
    customerCompany: form.customerCompany,
    productType: form.productType,
    width: form.width,
    height: form.height,
    sizeUnit: form.sizeUnit,
    quantity: form.quantity,
    shape: form.shape,
    material: form.material,
    printing: form.printing,
    hasHole: form.hasHole,
    holePosition: form.holePosition,
    holeSize: form.holeSize,
    accessories: form.accessories,
    notes: form.notes,
    unitPrice: form.unitPrice,
    discount: form.discount,
    vatEnabled: form.vatEnabled,
    total: Math.round((afterDiscount + vat) * 100) / 100,
    status: "quotation",
    createdByName: form.createdByName ?? "",
    dueDate: form.dueDate,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };

  const docs = swGenerateDocuments(
    {
      id,
      orderCode,
      productType: form.productType,
      width: form.width,
      height: form.height,
      sizeUnit: form.sizeUnit,
      quantity: form.quantity,
      material: form.material,
      printing: form.printing,
      holePosition: form.holePosition,
      unitPrice: form.unitPrice,
      discount: form.discount,
      vatEnabled: form.vatEnabled
    },
    now,
    makeId
  );

  db.orders.push(order);
  db.quotations.push(docs.quotation as unknown as SwQuotation);
  db.approvals.push(docs.approval as unknown as SwApproval);
  db.designTasks.push(docs.designTask as unknown as SwDesignTask);
  db.productionSheets.push(docs.productionSheet as unknown as SwProductionSheet);
  db.qcChecklists.push(docs.qcChecklist as unknown as SwQcChecklist);
  db.deliveries.push(docs.delivery as unknown as SwDelivery);
  db.history.push({
    id: makeId(),
    orderId: id,
    fromStatus: null,
    toStatus: "quotation",
    changedByName: order.createdByName,
    createdAt: now.toISOString()
  });

  return bundleFromDemo(db, order);
}

function pushDemoStatus(db: DemoDb, order: SwOrder, status: SwOrderStatus, byName = "") {
  db.history.push({
    id: makeId(),
    orderId: order.id,
    fromStatus: order.status,
    toStatus: status,
    changedByName: byName,
    createdAt: new Date().toISOString()
  });
  order.status = status;
  order.updatedAt = new Date().toISOString();
}

function bundleFromDemo(db: DemoDb, order: SwOrder): SwDocumentBundle {
  return {
    order,
    quotation: db.quotations.find((d) => d.orderId === order.id)!,
    approval: db.approvals.find((d) => d.orderId === order.id)!,
    designTask: db.designTasks.find((d) => d.orderId === order.id)!,
    productionSheet: db.productionSheets.find((d) => d.orderId === order.id)!,
    qcChecklist: db.qcChecklists.find((d) => d.orderId === order.id)!,
    delivery: db.deliveries.find((d) => d.orderId === order.id)!,
    files: db.files.filter((f) => f.orderId === order.id),
    history: db.history
      .filter((h) => h.orderId === order.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  };
}

// ---------- แปลง row (snake_case) ↔ type (camelCase) ----------

function orderFromRow(row: any): SwOrder {
  return {
    id: row.id,
    orderCode: row.order_code,
    customerId: row.customer_id ?? undefined,
    customerName: row.customer_name ?? "",
    customerPhone: row.customer_phone ?? "",
    customerLineId: row.customer_line_id ?? "",
    customerCompany: row.customer_company ?? "",
    productType: row.product_type,
    width: Number(row.width) || 0,
    height: Number(row.height) || 0,
    sizeUnit: row.size_unit ?? "cm",
    quantity: Number(row.quantity) || 0,
    shape: row.shape ?? "rectangle",
    material: row.material,
    printing: row.printing,
    hasHole: Boolean(row.has_hole),
    holePosition: row.hole_position ?? "",
    holeSize: row.hole_size ?? "",
    accessories: row.accessories ?? [],
    notes: row.notes ?? "",
    unitPrice: Number(row.unit_price) || 0,
    discount: Number(row.discount) || 0,
    vatEnabled: Boolean(row.vat_enabled),
    total: Number(row.total) || 0,
    status: row.status,
    createdByName: row.created_by_name ?? "",
    dueDate: row.due_date ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function quotationFromRow(row: any): SwQuotation {
  return {
    id: row.id,
    orderId: row.order_id,
    docNumber: row.doc_number,
    items: row.items ?? [],
    subtotal: Number(row.subtotal) || 0,
    discount: Number(row.discount) || 0,
    vat: Number(row.vat) || 0,
    total: Number(row.total) || 0,
    validUntil: row.valid_until ?? undefined,
    status: row.status,
    sentVia: row.sent_via ?? []
  };
}

function approvalFromRow(row: any): SwApproval {
  return {
    id: row.id,
    orderId: row.order_id,
    docNumber: row.doc_number,
    mockupUrl: row.mockup_url ?? undefined,
    productImageUrl: row.product_image_url ?? undefined,
    decision: row.decision,
    customerNote: row.customer_note ?? "",
    signatureName: row.signature_name ?? "",
    decidedAt: row.decided_at ?? undefined,
    revisionCount: Number(row.revision_count) || 0
  };
}

function designFromRow(row: any): SwDesignTask {
  return {
    id: row.id,
    orderId: row.order_id,
    status: row.status,
    designerName: row.designer_name ?? "",
    startedAt: row.started_at ?? undefined,
    finishedAt: row.finished_at ?? undefined
  };
}

function productionFromRow(row: any): SwProductionSheet {
  return {
    id: row.id,
    orderId: row.order_id,
    docNumber: row.doc_number,
    whiteLayer: Boolean(row.white_layer),
    varnishLayer: Boolean(row.varnish_layer),
    cutLine: row.cut_line ?? "",
    holePosition: row.hole_position ?? "",
    qrPayload: row.qr_payload ?? "",
    machine: row.machine ?? "",
    operatorName: row.operator_name ?? "",
    status: row.status
  };
}

function qcFromRow(row: any): SwQcChecklist {
  return {
    id: row.id,
    orderId: row.order_id,
    docNumber: row.doc_number,
    checkSize: Boolean(row.check_size),
    checkColor: Boolean(row.check_color),
    checkQuantity: Boolean(row.check_quantity),
    checkHole: Boolean(row.check_hole),
    checkMaterial: Boolean(row.check_material),
    checkPacking: Boolean(row.check_packing),
    passed: row.passed,
    inspectorName: row.inspector_name ?? "",
    note: row.note ?? "",
    checkedAt: row.checked_at ?? undefined
  };
}

function deliveryFromRow(row: any): SwDelivery {
  return {
    id: row.id,
    orderId: row.order_id,
    docNumber: row.doc_number,
    carrier: row.carrier ?? "",
    trackingNumber: row.tracking_number ?? "",
    shipDate: row.ship_date ?? undefined,
    address: row.address ?? "",
    status: row.status,
    shippedAt: row.shipped_at ?? undefined,
    deliveredAt: row.delivered_at ?? undefined
  };
}

function fileFromRow(row: any): SwOrderFile {
  return {
    id: row.id,
    orderId: row.order_id,
    fileName: row.file_name,
    fileType: row.file_type ?? "",
    storagePath: row.storage_path ?? undefined,
    publicUrl: row.public_url ?? undefined,
    kind: row.kind ?? "artwork"
  };
}

function historyFromRow(row: any): SwStatusHistory {
  return {
    id: row.id,
    orderId: row.order_id,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    changedByName: row.changed_by_name ?? "",
    createdAt: row.created_at
  };
}

// ---------- โหมดการทำงาน ----------

export async function swResolveMode(): Promise<SwMode> {
  if (!supabase) return "demo";
  try {
    const { data } = await supabase.auth.getSession();
    return data.session ? "cloud" : "demo";
  } catch {
    return "demo";
  }
}

// ---------- API หลักของชั้นข้อมูล ----------

export async function swListBundles(mode: SwMode): Promise<SwDocumentBundle[]> {
  if (mode === "cloud" && supabase) {
    const [orders, quotations, approvals, designs, productions, qcs, deliveries, files, history] =
      await Promise.all([
        supabase.from("sw_orders").select("*").order("created_at", { ascending: false }).limit(300),
        supabase.from("sw_quotations").select("*"),
        supabase.from("sw_approvals").select("*"),
        supabase.from("sw_design_tasks").select("*"),
        supabase.from("sw_production_sheets").select("*"),
        supabase.from("sw_qc_checklists").select("*"),
        supabase.from("sw_deliveries").select("*"),
        supabase.from("sw_order_files").select("*"),
        supabase.from("sw_status_history").select("*").order("created_at", { ascending: false }).limit(1000)
      ]);
    const firstError =
      orders.error || quotations.error || approvals.error || designs.error ||
      productions.error || qcs.error || deliveries.error || files.error || history.error;
    if (firstError) throw firstError;

    const byOrder = <T extends { order_id?: string }>(rows: T[] | null) => {
      const map = new Map<string, T>();
      for (const row of rows ?? []) if (row.order_id) map.set(row.order_id, row);
      return map;
    };
    const quotationMap = byOrder(quotations.data as any[]);
    const approvalMap = byOrder(approvals.data as any[]);
    const designMap = byOrder(designs.data as any[]);
    const productionMap = byOrder(productions.data as any[]);
    const qcMap = byOrder(qcs.data as any[]);
    const deliveryMap = byOrder(deliveries.data as any[]);

    return (orders.data ?? [])
      .filter((row: any) =>
        quotationMap.has(row.id) && approvalMap.has(row.id) && designMap.has(row.id) &&
        productionMap.has(row.id) && qcMap.has(row.id) && deliveryMap.has(row.id)
      )
      .map((row: any) => ({
        order: orderFromRow(row),
        quotation: quotationFromRow(quotationMap.get(row.id)),
        approval: approvalFromRow(approvalMap.get(row.id)),
        designTask: designFromRow(designMap.get(row.id)),
        productionSheet: productionFromRow(productionMap.get(row.id)),
        qcChecklist: qcFromRow(qcMap.get(row.id)),
        delivery: deliveryFromRow(deliveryMap.get(row.id)),
        files: ((files.data ?? []) as any[]).filter((f) => f.order_id === row.id).map(fileFromRow),
        history: ((history.data ?? []) as any[]).filter((h) => h.order_id === row.id).map(historyFromRow)
      }));
  }

  const db = loadDemo();
  return [...db.orders]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((order) => bundleFromDemo(db, order));
}

// "กรอกครั้งเดียว → เอกสารครบชุด": สร้างออเดอร์ แล้วเอกสารทั้ง 5 ใบเกิดขึ้นอัตโนมัติ
// (cloud: trigger ในฐานข้อมูล / demo: swGenerateDocuments)
export async function swCreateOrder(mode: SwMode, form: SwOrderFormInput): Promise<SwDocumentBundle> {
  if (mode === "cloud" && supabase) {
    const existing = await supabase
      .from("sw_orders")
      .select("order_code")
      .order("created_at", { ascending: false })
      .limit(500);
    if (existing.error) throw existing.error;
    const orderCode = swNextOrderCode(
      (existing.data ?? []).map((r: any) => r.order_code),
      new Date()
    );
    const subtotal = form.unitPrice * form.quantity;
    const afterDiscount = Math.max(subtotal - form.discount, 0);
    const vat = form.vatEnabled ? Math.round(afterDiscount * 7) / 100 : 0;

    const { data: userData } = await supabase.auth.getUser();
    const inserted = await supabase
      .from("sw_orders")
      .insert({
        order_code: orderCode,
        customer_name: form.customerName,
        customer_phone: form.customerPhone,
        customer_line_id: form.customerLineId,
        customer_company: form.customerCompany,
        product_type: form.productType,
        width: form.width,
        height: form.height,
        size_unit: form.sizeUnit,
        quantity: form.quantity,
        shape: form.shape,
        material: form.material,
        printing: form.printing,
        has_hole: form.hasHole,
        hole_position: form.holePosition,
        hole_size: form.holeSize,
        accessories: form.accessories,
        notes: form.notes,
        unit_price: form.unitPrice,
        discount: form.discount,
        vat_enabled: form.vatEnabled,
        total: Math.round((afterDiscount + vat) * 100) / 100,
        due_date: form.dueDate || null,
        created_by: userData.user?.id ?? null,
        created_by_name: form.createdByName ?? ""
      })
      .select("*")
      .single();
    if (inserted.error) throw inserted.error;

    const bundles = await swListBundles(mode);
    const bundle = bundles.find((b) => b.order.id === inserted.data.id);
    if (!bundle) throw new Error("สร้างออเดอร์แล้วแต่โหลดเอกสารไม่สำเร็จ");
    return bundle;
  }

  const db = loadDemo();
  const bundle = createDemoOrder(db, form, new Date());
  saveDemo(db);
  return bundle;
}

export async function swUpdateOrderStatus(
  mode: SwMode,
  orderId: string,
  status: SwOrderStatus,
  byName = ""
): Promise<void> {
  if (mode === "cloud" && supabase) {
    const { error } = await supabase.from("sw_orders").update({ status }).eq("id", orderId);
    if (error) throw error;
    return;
  }
  const db = loadDemo();
  const order = db.orders.find((o) => o.id === orderId);
  if (order) {
    pushDemoStatus(db, order, status, byName);
    saveDemo(db);
  }
}

async function updateDoc(
  mode: SwMode,
  table: string,
  demoList: keyof DemoDb,
  id: string,
  cloudPatch: Record<string, unknown>,
  demoPatch: Record<string, unknown>
): Promise<void> {
  if (mode === "cloud" && supabase) {
    const { error } = await supabase.from(table).update(cloudPatch).eq("id", id);
    if (error) throw error;
    return;
  }
  const db = loadDemo();
  const list = db[demoList] as Array<{ id: string }>;
  const item = list.find((d) => d.id === id);
  if (item) {
    Object.assign(item, demoPatch);
    saveDemo(db);
  }
}

export async function swUpdateQuotation(
  mode: SwMode,
  id: string,
  patch: { status?: SwQuotation["status"]; sentVia?: string[] }
): Promise<void> {
  await updateDoc(
    mode,
    "sw_quotations",
    "quotations",
    id,
    {
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.sentVia ? { sent_via: patch.sentVia } : {})
    },
    patch
  );
}

export async function swUpdateApproval(
  mode: SwMode,
  id: string,
  patch: {
    decision?: SwApproval["decision"];
    customerNote?: string;
    signatureName?: string;
    mockupUrl?: string;
    revisionCount?: number;
  }
): Promise<void> {
  const decidedAt = patch.decision && patch.decision !== "pending" ? new Date().toISOString() : undefined;
  await updateDoc(
    mode,
    "sw_approvals",
    "approvals",
    id,
    {
      ...(patch.decision ? { decision: patch.decision } : {}),
      ...(patch.customerNote !== undefined ? { customer_note: patch.customerNote } : {}),
      ...(patch.signatureName !== undefined ? { signature_name: patch.signatureName } : {}),
      ...(patch.mockupUrl !== undefined ? { mockup_url: patch.mockupUrl } : {}),
      ...(patch.revisionCount !== undefined ? { revision_count: patch.revisionCount } : {}),
      ...(decidedAt ? { decided_at: decidedAt } : {})
    },
    { ...patch, ...(decidedAt ? { decidedAt } : {}) }
  );
}

export async function swUpdateDesign(
  mode: SwMode,
  id: string,
  patch: { status?: SwDesignStatus; designerName?: string }
): Promise<void> {
  const stamps: Record<string, unknown> = {};
  if (patch.status === "designing") stamps.started_at = new Date().toISOString();
  if (patch.status === "ready_production") stamps.finished_at = new Date().toISOString();
  await updateDoc(
    mode,
    "sw_design_tasks",
    "designTasks",
    id,
    {
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.designerName !== undefined ? { designer_name: patch.designerName } : {}),
      ...stamps
    },
    {
      ...patch,
      ...(stamps.started_at ? { startedAt: stamps.started_at } : {}),
      ...(stamps.finished_at ? { finishedAt: stamps.finished_at } : {})
    }
  );
}

export async function swUpdateProduction(
  mode: SwMode,
  id: string,
  patch: {
    status?: SwProductionSheet["status"];
    machine?: string;
    operatorName?: string;
    cutLine?: string;
  }
): Promise<void> {
  await updateDoc(
    mode,
    "sw_production_sheets",
    "productionSheets",
    id,
    {
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.machine !== undefined ? { machine: patch.machine } : {}),
      ...(patch.operatorName !== undefined ? { operator_name: patch.operatorName } : {}),
      ...(patch.cutLine !== undefined ? { cut_line: patch.cutLine } : {})
    },
    patch
  );
}

export async function swUpdateQc(
  mode: SwMode,
  id: string,
  patch: Partial<Pick<
    SwQcChecklist,
    "checkSize" | "checkColor" | "checkQuantity" | "checkHole" | "checkMaterial" | "checkPacking" | "passed" | "inspectorName" | "note"
  >>
): Promise<void> {
  const checkedAt =
    patch.passed === true || patch.passed === false ? new Date().toISOString() : undefined;
  await updateDoc(
    mode,
    "sw_qc_checklists",
    "qcChecklists",
    id,
    {
      ...(patch.checkSize !== undefined ? { check_size: patch.checkSize } : {}),
      ...(patch.checkColor !== undefined ? { check_color: patch.checkColor } : {}),
      ...(patch.checkQuantity !== undefined ? { check_quantity: patch.checkQuantity } : {}),
      ...(patch.checkHole !== undefined ? { check_hole: patch.checkHole } : {}),
      ...(patch.checkMaterial !== undefined ? { check_material: patch.checkMaterial } : {}),
      ...(patch.checkPacking !== undefined ? { check_packing: patch.checkPacking } : {}),
      ...(patch.passed !== undefined ? { passed: patch.passed } : {}),
      ...(patch.inspectorName !== undefined ? { inspector_name: patch.inspectorName } : {}),
      ...(patch.note !== undefined ? { note: patch.note } : {}),
      ...(checkedAt ? { checked_at: checkedAt } : {})
    },
    { ...patch, ...(checkedAt ? { checkedAt } : {}) }
  );
}

export async function swUpdateDelivery(
  mode: SwMode,
  id: string,
  patch: {
    status?: SwDelivery["status"];
    carrier?: string;
    trackingNumber?: string;
    shipDate?: string;
    address?: string;
  }
): Promise<void> {
  const stamps: Record<string, unknown> = {};
  if (patch.status === "shipped") stamps.shipped_at = new Date().toISOString();
  if (patch.status === "delivered") stamps.delivered_at = new Date().toISOString();
  await updateDoc(
    mode,
    "sw_deliveries",
    "deliveries",
    id,
    {
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.carrier !== undefined ? { carrier: patch.carrier } : {}),
      ...(patch.trackingNumber !== undefined ? { tracking_number: patch.trackingNumber } : {}),
      ...(patch.shipDate !== undefined ? { ship_date: patch.shipDate } : {}),
      ...(patch.address !== undefined ? { address: patch.address } : {}),
      ...stamps
    },
    {
      ...patch,
      ...(stamps.shipped_at ? { shippedAt: stamps.shipped_at } : {}),
      ...(stamps.delivered_at ? { deliveredAt: stamps.delivered_at } : {})
    }
  );
}

// อัปโหลดไฟล์งาน (cloud: Supabase Storage / demo: เก็บเป็น data URL ขนาดเล็ก)
export async function swUploadFile(
  mode: SwMode,
  orderId: string,
  file: File,
  kind: SwOrderFile["kind"] = "artwork"
): Promise<SwOrderFile> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (mode === "cloud" && supabase) {
    const path = `${orderId}/${Date.now()}-${file.name}`;
    const uploaded = await supabase.storage.from("sw-work-files").upload(path, file, { upsert: false });
    if (uploaded.error) throw uploaded.error;
    const { data: pub } = supabase.storage.from("sw-work-files").getPublicUrl(path);
    const inserted = await supabase
      .from("sw_order_files")
      .insert({
        order_id: orderId,
        file_name: file.name,
        file_type: ext,
        storage_path: path,
        public_url: pub.publicUrl,
        kind
      })
      .select("*")
      .single();
    if (inserted.error) throw inserted.error;
    return fileFromRow(inserted.data);
  }

  // โหมดเดโม: แปลงเฉพาะรูปเล็ก ๆ เป็น data URL เพื่อพรีวิวได้ ไฟล์อื่นเก็บชื่อไว้
  let publicUrl: string | undefined;
  if (file.type.startsWith("image/") && file.size <= 700 * 1024) {
    publicUrl = await new Promise<string | undefined>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : undefined);
      reader.onerror = () => resolve(undefined);
      reader.readAsDataURL(file);
    });
  }
  const record: SwOrderFile = {
    id: makeId(),
    orderId,
    fileName: file.name,
    fileType: ext,
    publicUrl,
    kind
  };
  const db = loadDemo();
  db.files.push(record);
  saveDemo(db);
  return record;
}

export async function swSetMockupFromFile(
  mode: SwMode,
  approvalId: string,
  orderId: string,
  file: File
): Promise<SwOrderFile> {
  const record = await swUploadFile(mode, orderId, file, "mockup");
  if (record.publicUrl) {
    await swUpdateApproval(mode, approvalId, { mockupUrl: record.publicUrl });
  }
  return record;
}

export function swResetDemo(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(DEMO_KEY);
}

export { swQrPayload };
