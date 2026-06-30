export type AppNotification = {
  id: string;
  type: "assigned" | "status_moved" | "comment" | "due_soon" | "express_request" | "express_decision";
  jobId: string;
  jobTitle: string;
  message: string;
  at: string;
  read: boolean;
};

export type Role =
  | "Owner"
  | "Manager"
  | "Admin"
  | "HR"
  | "Accounting"
  | "Designer"
  | "Production Staff"
  | "Packing Staff"
  | "Sales Staff";

export type JobType = "DTG Shirt" | "UV Print" | "Laser Cut" | "Signage" | "Acrylic" | "3D Print" | "Keychain" | "Other";
export type Priority = "Normal" | "Urgent" | "Very Urgent" | "Today";
export type PaymentStatus = "unpaid" | "partial" | "paid";
export type QuoteStatus = "draft" | "sent" | "approved" | "expired";

export type JobStatus =
  | "Quotation"
  | "Waiting Deposit"
  | "Verifying Payment"
  | "Deposit Confirmed"
  | "New Order"
  | "Waiting for File"
  | "Designing"
  | "Waiting for Customer Approval"
  | "Ready for Production"
  | "In Production"
  | "QC"
  | "Packing"
  | "Delivered / Picked Up"
  | "Completed"
  | "Cancelled";

export type TeamMember = {
  id: string;
  name: string;
  role: Role;
  roles?: Role[];
  avatar: string;
  avatarUrl?: string;
  username?: string;
  phone?: string;
  branch?: string;
  nickname?: string;
  avatarBorderColor?: string;
  statusEmoji?: string;
  statusText?: string;
};

export type Lead = {
  id: string;
  name: string;
  phone: string;
  channel: string;
  page: string;
  message: string;
  status: "new" | "contacting" | "quoted" | "won" | "lost";
  createdByName?: string;
  createdAt: string;
};

export type Quotation = {
  id: string;
  quoteNumber?: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  title: string;
  description: string;
  amount: number;
  status: "draft" | "sent" | "approved" | "rejected" | "converted";
  createdByName?: string;
  convertedJobId?: string;
  createdAt: string;
};

// ข้อมูลการจัดส่ง/พัสดุ สำหรับเรียกขนส่ง (เช่น Flash) เข้ารับเมื่องานเสร็จ
export type ShipmentStatus = "draft" | "booked" | "failed";

export type Shipment = {
  courier: string;            // ขนส่ง เช่น Flash / Kerry / J&T / ไปรษณีย์ไทย
  recipientName: string;      // ชื่อผู้รับ (ลิงก์จากลูกค้า)
  recipientPhone: string;     // เบอร์ผู้รับ
  address: string;            // บ้านเลขที่ / รายละเอียดที่อยู่
  subdistrict: string;        // ตำบล / แขวง
  district: string;           // อำเภอ / เขต
  province: string;           // จังหวัด
  postalCode: string;         // รหัสไปรษณีย์
  parcelCategory: string;     // ประเภทสินค้า
  weightKg: number;           // น้ำหนัก (กก.)
  widthCm?: number;
  lengthCm?: number;
  heightCm?: number;
  codEnabled: boolean;        // เก็บเงินปลายทาง
  codAmount?: number;         // ยอด COD
  insured?: boolean;          // ประกันพัสดุ
  insuredValue?: number;      // มูลค่าที่แจ้งประกัน
  note?: string;              // หมายเหตุถึงขนส่ง
  trackingNumber?: string;    // เลขพัสดุจากขนส่ง (เช่น pno ของ Flash)
  sortCode?: string;          // รหัสคัดแยกของ Flash (ถ้ามี)
  status?: ShipmentStatus;    // draft = ยังไม่เชื่อม API, booked = เรียกเข้ารับแล้ว, failed = ล้มเหลว
  message?: string;           // ข้อความผลลัพธ์จากขนส่ง
  shippedAt?: string;         // เวลาเรียกเข้ารับ
  shippedBy?: string;         // พนักงานที่กดส่ง
};

export type ExpressRequest = {
  id: string;
  requestedById: string;
  requestedByName: string;
  status: "pending" | "approved" | "rejected";
  approvedById?: string;
  approvedByName?: string;
  consumed: boolean;
  createdAt: string;
};

export type Customer = {
  id: string;
  dbId?: string;
  name: string;
  phone: string;
  lineId: string;
  email: string;
  notes?: string;
  companyName?: string;
  taxId?: string;
  branch?: string;
  billingAddress?: string;
  accountingEmail?: string;
  requiresInvoice?: boolean;
  sourceChannel?: string;
  sourcePage?: string;
  customerCode?: string;
  codePage?: string;
  codeAdmin?: string;
  codeSeq?: number;
  codeYear?: string;
  lineFriend?: boolean;
  loyaltyPoints?: number;
  totalOrders: number;
  lifetimeValue: number;
  lastOrderDate: string;
};

export type LeaveRequest = {
  id: string;
  profileId: string;
  leaveType: "sick" | "personal" | "vacation";
  startDate: string;
  endDate: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};

export type Holiday = {
  id: string;
  date: string;
  name: string;
};

export type Overtime = {
  id: string;
  profileId: string;
  workDate: string;
  hours: number;
  note: string;
  branch?: string;
  approvedBy?: string;
  createdAt: string;
};

export type Attendance = {
  id: string;
  profileId: string;
  workDate: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  checkInSelfie: string | null;
  checkOutSelfie: string | null;
  checkInLat: number | null;
  checkInLng: number | null;
  lateMinutes: number;
  status: "on_time" | "late" | "absent";
};

export type BranchSetting = {
  branch: string;
  workStart: string;
  workEnd: string;
  lateGraceMinutes: number;
  gpsLat: number | null;
  gpsLng: number | null;
  radiusM: number;
};

export type FileAsset = {
  id: string;
  name: string;
  type: "image" | "pdf" | "ai" | "zip";
  size: string;
  url?: string;
};

export type StatusEvent = {
  id: string;
  from: JobStatus | "Created";
  to: JobStatus;
  by: string;
  at: string;
};

export type Comment = {
  id: string;
  by: string;
  at: string;
  text: string;
};

export type AuditEvent = {
  id: string;
  actor: string;
  action: string;
  target: string;
  at: string;
};

export type Job = {
  id: string;
  dbId?: string;
  quoteNumber?: string;
  quoteStatus?: QuoteStatus;
  customerId: string;
  customerName: string;
  phone: string;
  lineId: string;
  companyName?: string;
  taxId?: string;
  branch?: string;
  billingAddress?: string;
  accountingEmail?: string;
  requiresInvoice?: boolean;
  title: string;
  type: JobType;
  description: string;
  quantity: number;
  files: FileAsset[];
  orderDate: string;
  dueDate: string;
  priority: Priority;
  isExpress?: boolean;
  productionBranch?: string;
  incomeBranch?: string;
  salesPage?: string;
  acceptance?: "pending" | "accepted" | "rejected";
  rejectReason?: string;
  handoffStatus?: "pending" | "accepted";
  handoffGate?: string;
  handoffFromUser?: string;
  handoffFromStatus?: JobStatus;
  handoffNote?: string;
  status: JobStatus;
  assignedDesigner: string;
  assignedProduction: string;
  createdBy?: string;
  price: number;
  vatMode?: import("./vat").VatMode;
  deposit: number;
  depositSlip?: string;
  depositReceivedDate?: string;
  depositConfirmed?: boolean;
  depositConfirmedBy?: string;
  depositWaived?: boolean;
  balanceSlip?: string;
  balanceReceivedDate?: string;
  remainingBalance: number;
  paymentStatus: PaymentStatus;
  internalNotes: string;
  shipping?: Shipment;
  comments: Comment[];
  statusHistory: StatusEvent[];
};
