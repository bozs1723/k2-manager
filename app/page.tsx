"use client";

import Image from "next/image";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import * as XLSX from "xlsx";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ClipboardList,
  ClipboardPlus,
  Clock3,
  Coins,
  Factory,
  Inbox,
  FileImage,
  Home,
  KeyRound,
  LayoutDashboard,
  ListTodo,
  Lock,
  LogOut,
  Menu,
  MessageSquare,
  Pencil,
  Plus,
  Phone,
  ReceiptText,
  Search,
  ShieldCheck,
  Sparkles,
  Settings,
  Trash2,
  Upload,
  UserPlus,
  UserRound,
  UsersRound,
  WalletCards,
  Zap
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { customers as initialCustomers, initialAuditLog, initialJobs, statuses, team as initialTeam } from "@/lib/mock-data"; import ExecutiveDashboard from "@/components/ExecutiveDashboard";
import { createSupabaseAuthWorker, isSupabaseConfigured, supabase } from "@/lib/supabase";
import { CUSTOMER_CODE_ADMINS, CUSTOMER_CODE_PAGES, customerCodeYear, formatCustomerCode, nextCustomerSeq } from "@/lib/customer-code";
import { checkGeofence, lateMinutes } from "@/lib/attendance";
import { branchForJobType } from "@/lib/job-routing";
import { computeVat, normalizeVatMode, vatModeLabel, VAT_MODES, type VatMode } from "@/lib/vat";
import type { AppNotification, Attendance, AuditEvent, BranchSetting, Customer, ExpressRequest, FileAsset, Holiday, Job, JobStatus, JobType, Lead, LeaveRequest, Overtime, PaymentStatus, Priority, Quotation, QuoteStatus, Role, TeamMember } from "@/lib/types";

type ImportedCustomer = Pick<Customer, "name" | "phone" | "lineId" | "email"> & {
  notes: string;
  companyName: string;
  taxId: string;
  branch: string;
  billingAddress: string;
  accountingEmail: string;
  requiresInvoice: boolean;
  duplicateReason?: string;
};

type CompanyProfile = {
  name: string;
  legalName: string;
  taxId: string;
  branch: string;
  address: string;
  phone: string;
  email: string;
  bankName: string;
  bankAccount: string;
  bankAccountName: string;
  quotePrefix: string;
  quoteTerms: string;
  facebookPages: string[];
};

type PermissionKey =
  | "view_dashboard"
  | "create_job"
  | "edit_job"
  | "delete_job"
  | "move_status"
  | "assign_staff"
  | "view_finance"
  | "edit_payment"
  | "create_customer"
  | "edit_customer"
  | "delete_customer"
  | "export_quote"
  | "manage_users"
  | "manage_permissions"
  | "manage_company_settings"
  | "view_audit_log"
  | "manage_hr"
  | "manage_finance";

type SupabaseProfileRow = {
  id: string;
  email: string | null;
  username?: string | null;
  full_name: string | null;
  role: Role | null;
  extra_roles?: Role[] | null;
  avatar_url?: string | null;
  phone?: string | null;
  branch?: string | null;
  is_active?: boolean | null;
};

type SupabaseCustomerRow = {
  id: string;
  name: string;
  phone: string;
  line_id: string | null;
  email: string | null;
  notes: string | null;
  company_name: string | null;
  tax_id: string | null;
  branch: string | null;
  billing_address: string | null;
  accounting_email: string | null;
  requires_invoice: boolean;
  source_channel: string | null;
  source_page: string | null;
  customer_code?: string | null;
  code_page?: string | null;
  code_admin?: string | null;
  code_seq?: number | null;
  code_year?: string | null;
  line_friend?: boolean | null;
  loyalty_points?: number | null;
  created_at: string;
};

type SupabaseJobRow = {
  id: string;
  job_number: string;
  quote_number: string | null;
  quote_status: QuoteStatus;
  customer_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_line_id: string | null;
  company_name: string | null;
  tax_id: string | null;
  branch: string | null;
  billing_address: string | null;
  accounting_email: string | null;
  requires_invoice: boolean;
  title: string;
  type: JobType;
  description: string;
  quantity: number;
  order_date: string;
  due_date: string;
  priority: Priority;
  status: JobStatus;
  is_express?: boolean | null;
  production_branch?: string | null;
  income_branch?: string | null;
  sales_page?: string | null;
  acceptance?: "pending" | "accepted" | "rejected" | null;
  reject_reason?: string | null;
  handoff_status?: string | null;
  handoff_gate?: string | null;
  handoff_from_user?: string | null;
  handoff_from_status?: JobStatus | null;
  handoff_note?: string | null;
  assigned_designer: string | null;
  assigned_production: string | null;
  price: number | string;
  vat_mode?: string | null;
  deposit: number | string;
  remaining_balance: number | string;
  payment_status: PaymentStatus;
  internal_notes: string | null;
  deposit_slip?: string | null;
  deposit_received_date?: string | null;
  deposit_confirmed?: boolean | null;
  deposit_confirmed_by?: string | null;
  deposit_waived?: boolean | null;
  balance_slip?: string | null;
  balance_received_date?: string | null;
  created_by?: string | null;
  created_at: string;
};

type SupabaseNotificationRow = {
  id: string;
  recipient_id: string;
  type: AppNotification["type"];
  job_id: string | null;
  job_number: string | null;
  job_title: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
};

type SupabaseCompanyRow = {
  id: string;
  name: string;
  legal_name: string;
  tax_id: string | null;
  branch: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  bank_name: string | null;
  bank_account: string | null;
  bank_account_name: string | null;
  quote_prefix: string;
  quote_terms: string | null;
  facebook_pages?: string[] | null;
};

type SupabaseRolePermissionRow = {
  role: Role;
  permissions: PermissionKey[] | null;
};

type SupabaseExpressRequestRow = {
  id: string;
  requested_by: string;
  requested_by_name: string | null;
  status: string | null;
  approved_by: string | null;
  approved_by_name: string | null;
  consumed: boolean | null;
  created_at: string;
};

type SupabaseQuotationRow = {
  id: string;
  quote_number: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  title: string;
  description: string | null;
  amount: number | string | null;
  status: string | null;
  created_by_name: string | null;
  converted_job_id: string | null;
  created_at: string;
};

type SupabaseLeadRow = {
  id: string;
  name: string;
  phone: string | null;
  channel: string | null;
  page: string | null;
  message: string | null;
  status: string | null;
  created_by_name: string | null;
  created_at: string;
};

function leadRowToLead(row: SupabaseLeadRow): Lead {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone ?? "",
    channel: row.channel ?? "",
    page: row.page ?? "",
    message: row.message ?? "",
    status: (row.status as Lead["status"]) ?? "new",
    createdByName: row.created_by_name ?? undefined,
    createdAt: row.created_at
  };
}

function quotationRowToQuotation(row: SupabaseQuotationRow): Quotation {
  return {
    id: row.id,
    quoteNumber: row.quote_number ?? undefined,
    customerId: row.customer_id ?? undefined,
    customerName: row.customer_name ?? "",
    customerPhone: row.customer_phone ?? "",
    title: row.title,
    description: row.description ?? "",
    amount: Number(row.amount ?? 0),
    status: (row.status as Quotation["status"]) ?? "draft",
    createdByName: row.created_by_name ?? undefined,
    convertedJobId: row.converted_job_id ?? undefined,
    createdAt: row.created_at
  };
}

function expressRowToRequest(row: SupabaseExpressRequestRow): ExpressRequest {
  return {
    id: row.id,
    requestedById: row.requested_by,
    requestedByName: row.requested_by_name ?? "",
    status: (row.status as ExpressRequest["status"]) ?? "pending",
    approvedById: row.approved_by ?? undefined,
    approvedByName: row.approved_by_name ?? undefined,
    consumed: Boolean(row.consumed),
    createdAt: row.created_at
  };
}

type NewTeamMemberInput = Omit<TeamMember, "id" | "avatar"> & {
  password?: string;
};

const money = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 0
});

const quoteMoney = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const priorityClass: Record<Priority, string> = {
  Normal: "bg-slate-100 text-slate-600",
  Urgent: "bg-amber-100 text-amber-700",
  "Very Urgent": "bg-rose-100 text-rose-700",
  Today: "bg-fuchsia-100 text-fuchsia-700"
};

const statusTint: Record<JobStatus, string> = {
  Quotation: "bg-slate-100 text-slate-600",
  "Waiting Deposit": "bg-amber-100 text-amber-700",
  "Verifying Payment": "bg-yellow-100 text-yellow-700",
  "Deposit Confirmed": "bg-teal-100 text-teal-700",
  "New Order": "bg-sky-100 text-sky-700",
  "Waiting for File": "bg-slate-100 text-slate-600",
  Designing: "bg-violet-100 text-violet-700",
  "Waiting for Customer Approval": "bg-amber-100 text-amber-700",
  "Ready for Production": "bg-emerald-100 text-emerald-700",
  "In Production": "bg-cyan-100 text-cyan-700",
  QC: "bg-indigo-100 text-indigo-700",
  Packing: "bg-orange-100 text-orange-700",
  "Delivered / Picked Up": "bg-lime-100 text-lime-700",
  Completed: "bg-green-100 text-green-700",
  Cancelled: "bg-red-100 text-red-700"
};

const statusDot: Record<JobStatus, string> = {
  Quotation: "bg-slate-400",
  "Waiting Deposit": "bg-amber-400",
  "Verifying Payment": "bg-yellow-400",
  "Deposit Confirmed": "bg-teal-400",
  "New Order": "bg-sky-400",
  "Waiting for File": "bg-slate-400",
  Designing: "bg-violet-400",
  "Waiting for Customer Approval": "bg-amber-400",
  "Ready for Production": "bg-emerald-400",
  "In Production": "bg-cyan-400",
  QC: "bg-indigo-400",
  Packing: "bg-orange-400",
  "Delivered / Picked Up": "bg-lime-400",
  Completed: "bg-green-400",
  Cancelled: "bg-red-400"
};

const permissionGroups: Array<{ title: string; permissions: PermissionKey[] }> = [
  { title: "งานและคิวผลิต", permissions: ["view_dashboard", "create_job", "edit_job", "delete_job", "move_status", "assign_staff"] },
  { title: "ลูกค้าและบัญชี", permissions: ["create_customer", "edit_customer", "delete_customer", "view_finance", "edit_payment", "export_quote", "manage_finance"] },
  { title: "ผู้ใช้และระบบ", permissions: ["manage_users", "manage_permissions", "manage_company_settings", "view_audit_log"] },
  { title: "บุคคล (HR)", permissions: ["manage_hr"] }
];

const allPermissionKeys = permissionGroups.flatMap((group) => group.permissions);

const defaultRolePermissions: Record<Role, PermissionKey[]> = {
  Owner: ["view_dashboard", "create_job", "edit_job", "delete_job", "move_status", "assign_staff", "view_finance", "edit_payment", "create_customer", "edit_customer", "delete_customer", "export_quote", "manage_users", "manage_permissions", "manage_company_settings", "view_audit_log", "manage_hr", "manage_finance"],
  Manager: ["view_dashboard", "create_job", "edit_job", "move_status", "assign_staff", "view_finance", "edit_payment", "create_customer", "edit_customer", "export_quote", "view_audit_log"],
  Admin: ["view_dashboard", "create_job", "edit_job", "move_status", "assign_staff", "view_finance", "edit_payment", "create_customer", "edit_customer", "export_quote", "manage_users", "view_audit_log"],
  HR: ["view_dashboard", "manage_hr", "manage_users"],
  Accounting: ["view_dashboard", "move_status", "view_finance", "edit_payment", "manage_finance", "export_quote"],
  Designer: ["view_dashboard", "edit_job", "move_status"],
  "Production Staff": ["view_dashboard", "edit_job", "move_status"],
  "Packing Staff": ["view_dashboard", "edit_job", "move_status"],
  "Sales Staff": ["view_dashboard", "create_job", "edit_job", "create_customer", "edit_customer", "view_finance", "edit_payment", "export_quote"]
};

const roleSummaryPermissions: Record<Role, string[]> = {
  Owner: ["Full access", "Financials", "Audit log", "Team assignments"],
  Manager: ["Jobs", "Financials", "Assignments", "Reports"],
  Admin: ["Jobs", "Payments", "Assignments", "Audit log"],
  HR: ["HR & payroll", "Salaries", "Attendance", "Leave"],
  Accounting: ["Payments", "Financials", "manage_finance", "export_quote"],
  Designer: ["Design queue", "Files", "Comments", "Approval status"],
  "Production Staff": ["Production queue", "QC", "Internal notes"],
  "Packing Staff": ["Packing", "Delivery status", "QC notes"],
  "Sales Staff": ["Orders", "Customers", "Payment intake"]
};

const roles: Role[] = ["Owner", "Manager", "Admin", "HR", "Accounting", "Designer", "Production Staff", "Packing Staff", "Sales Staff"];
const BRANCH_LIST = ["พระรามเก้า", "พะเยา"];

// เพจที่รับงาน → สาขา (ใช้แยกรายได้/สาขาที่รับผิดชอบ ตอนสร้างงาน)
//   พะเยา: K2sign, k2 phayao · พระรามเก้า: Sweetdesign, Fluffi
const SALES_PAGES: Array<{ page: string; branch: string }> = [
  { page: "K2sign", branch: "พะเยา" },
  { page: "k2 phayao", branch: "พะเยา" },
  { page: "Sweetdesign", branch: "พระรามเก้า" },
  { page: "Fluffi", branch: "พระรามเก้า" }
];
const PAGE_TO_BRANCH: Record<string, string> = Object.fromEntries(SALES_PAGES.map((p) => [p.page, p.branch]));

type CheckInResult = { ok: boolean; msg: string; checkInAt?: string; status?: "on_time" | "late"; lateMinutes?: number; geofenced?: boolean };

// ระยะห่างระหว่างพิกัด (เมตร) — สูตร haversine
const defaultBranchSetting = (branch: string): BranchSetting => ({ branch, workStart: "09:00", workEnd: "18:00", lateGraceMinutes: 5, gpsLat: null, gpsLng: null, radiusM: 150 });
const jobTypes: JobType[] = ["DTG Shirt", "UV Print", "Laser Cut", "Signage", "Acrylic", "3D Print", "Keychain", "Other"];
const priorities: Priority[] = ["Normal", "Urgent", "Very Urgent", "Today"];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const appTagline = "คุมงานผลิตครบในที่เดียว";
const facebookPagesStorageKey = "k2-facebook-pages";
const internalAuthDomain = "k2smart.local";
const usernamePattern = /^[a-z0-9][a-z0-9._-]{2,31}$/;
const legacyQuotePrefix = "Q" + "T";

function normalizeUsername(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

function authEmailFromLogin(value: string) {
  const login = value.trim().toLowerCase();
  return login.includes("@") ? login : `${normalizeUsername(login)}@${internalAuthDomain}`;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// แปลงค่าที่กรอก (อีเมลจริง หรือ username) ให้เป็นอีเมลสำหรับ Supabase Auth + username สำหรับโปรไฟล์
function resolveLoginIdentity(value: string): { authEmail: string; username: string } {
  const login = value.trim().toLowerCase();
  if (login.includes("@")) {
    if (!emailPattern.test(login)) throw new Error("รูปแบบอีเมลไม่ถูกต้อง");
    return { authEmail: login, username: normalizeUsername(login.split("@")[0]) };
  }
  const username = normalizeUsername(login);
  if (!usernamePattern.test(username)) {
    throw new Error("กรอก Username (3-32 ตัว a-z, 0-9, จุด, ขีดกลาง, _) หรืออีเมลจริง");
  }
  return { authEmail: `${username}@${internalAuthDomain}`, username };
}

function usernameFromEmail(email?: string | null) {
  if (!email) return "";
  return email.endsWith(`@${internalAuthDomain}`) ? email.split("@")[0] : "";
}

function normalizeFacebookPages(pages: string[]) {
  return Array.from(new Set(pages.map((page) => page.trim()).filter(Boolean)));
}

const initialCompanyProfile: CompanyProfile = {
  name: "K2Smart",
  legalName: "บริษัท เคทู ไซน์ มีเดีย จำกัด",
  taxId: "0565567000869",
  branch: "สาขาที่ 00001",
  address: "38 ซอยศูนย์วิจัย 8 แขวงบางกะปิ เขตห้วยขวาง กรุงเทพมหานคร 10310",
  phone: "02-000-0000",
  email: "accounting@k2work.example",
  bankName: "Kasikorn Bank",
  bankAccount: "000-0-00000-0",
  bankAccountName: "บริษัท เคทู ไซน์ มีเดีย จำกัด",
  quotePrefix: "WO",
  quoteTerms: "ใบสั่งงานนี้ใช้ยืนยันรายละเอียดการผลิต และเริ่มผลิตหลังลูกค้ายืนยันแบบพร้อมชำระมัดจำ",
  facebookPages: ["K2sign media", "K2 Smart"]
};

const viewLabel: Record<string, string> = {
  Dashboard: "แดชบอร์ด", Executive: "ภาพรวมผู้บริหาร",
  "My Jobs": "งานของฉัน",
  Board: "บอร์ดคิวงาน",
  Completed: "งานที่เสร็จแล้ว",
  Leads: "กล่องลูกค้า",
  Quotations: "ใบเสนอราคา",
  "Create Job": "สร้างงาน",
  Calendar: "ปฏิทิน",
  Customers: "ลูกค้า",
  Payments: "การชำระเงิน",
  Reports: "รายงาน",
  Finance: "การเงิน",
  Settings: "ตั้งค่า",
  HR: "ฝ่ายบุคคล (HR)",
  Attendance: "ลงเวลา",
  Leave: "การลา",
  Payroll: "เงินเดือน / สลิป",
  Detail: "รายละเอียดออเดอร์",
  Audit: "ประวัติการแก้ไข"
};

const statusLabel: Record<JobStatus, string> = {
  Quotation: "รอเสนอราคา",
  "Waiting Deposit": "รอมัดจำ",
  "Verifying Payment": "รอตรวจสอบยอด",
  "Deposit Confirmed": "มัดจำแล้ว",
  "New Order": "รับงานใหม่",
  "Waiting for File": "รอไฟล์",
  Designing: "กำลังออกแบบ",
  "Waiting for Customer Approval": "รอลูกค้าอนุมัติ",
  "Ready for Production": "พร้อมผลิต",
  "In Production": "กำลังผลิต",
  QC: "ตรวจคุณภาพ",
  Packing: "แพ็กของ",
  "Delivered / Picked Up": "จัดส่ง / รับแล้ว",
  Completed: "เสร็จสิ้น",
  Cancelled: "ยกเลิก"
};

const priorityLabel: Record<Priority, string> = {
  Normal: "ปกติ",
  Urgent: "ด่วน",
  "Very Urgent": "ด่วนมาก",
  Today: "ต้องเสร็จวันนี้"
};

const roleLabel: Record<Role, string> = {
  Owner: "เจ้าของ",
  Manager: "ผู้จัดการ",
  Admin: "แอดมิน",
  HR: "ฝ่ายบุคคล (HR)",
  Accounting: "ฝ่ายการเงิน",
  Designer: "ดีไซเนอร์",
  "Production Staff": "ฝ่ายผลิต",
  "Packing Staff": "ฝ่ายแพ็กของ",
  "Sales Staff": "ฝ่ายขาย"
};

const jobTypeLabel: Record<JobType, string> = {
  "DTG Shirt": "เสื้อ DTG",
  "UV Print": "พิมพ์ UV",
  "Laser Cut": "เลเซอร์คัต",
  Signage: "ป้าย",
  Acrylic: "งานอะคริลิค",
  "3D Print": "พิมพ์ 3D",
  Keychain: "พวงกุญแจ",
  Other: "อื่น ๆ"
};

const paymentLabel: Record<PaymentStatus, string> = {
  unpaid: "ยังไม่ชำระ",
  partial: "ชำระบางส่วน",
  paid: "ชำระครบแล้ว"
};

const quoteLabel: Record<QuoteStatus, string> = {
  draft: "ร่างใบสั่งงาน",
  sent: "ส่งใบสั่งงานแล้ว",
  approved: "อนุมัติใบสั่งงานแล้ว",
  expired: "ยกเลิก / หมดอายุ"
};

const permissionLabel: Record<string, string> = {
  view_dashboard: "ดูแดชบอร์ด",
  create_job: "สร้างงาน",
  edit_job: "แก้ไขงาน",
  delete_job: "ลบงาน",
  move_status: "ย้ายสถานะงาน",
  assign_staff: "มอบหมายงาน",
  view_finance: "ดูยอดเงิน",
  edit_payment: "แก้ไขการชำระเงิน",
  create_customer: "เพิ่มลูกค้า",
  edit_customer: "แก้ไขลูกค้า",
  delete_customer: "ลบลูกค้า",
  export_quote: "ออกใบสั่งงาน",
  manage_users: "จัดการผู้ใช้",
  manage_permissions: "จัดการสิทธิ์",
  manage_company_settings: "ตั้งค่าบริษัท",
  view_audit_log: "ดูประวัติการแก้ไข",
  manage_hr: "จัดการ HR / เงินเดือน",
  manage_finance: "ยืนยันมัดจำ / การเงิน",
  "HR & payroll": "HR / เงินเดือน",
  Salaries: "เงินเดือน",
  Attendance: "ลงเวลา",
  Leave: "การลา",
  "Full access": "เข้าถึงทั้งหมด",
  Financials: "ดูการเงิน",
  "Audit log": "ดูประวัติการแก้ไข",
  "Team assignments": "มอบหมายทีม",
  Jobs: "จัดการงาน",
  Payments: "จัดการชำระเงิน",
  Assignments: "มอบหมายงาน",
  "Design queue": "คิวออกแบบ",
  Files: "ไฟล์งาน",
  Comments: "คอมเมนต์",
  "Approval status": "สถานะอนุมัติ",
  "Production queue": "คิวผลิต",
  QC: "ตรวจคุณภาพ",
  "Internal notes": "โน้ตภายใน",
  Packing: "แพ็กของ",
  "Delivery status": "สถานะจัดส่ง",
  "QC notes": "โน้ต QC",
  Orders: "ออเดอร์",
  Customers: "ลูกค้า",
  "Payment intake": "รับชำระเงิน"
};

function staffLabel(name: string) {
  return name === "Unassigned" ? "ยังไม่มอบหมาย" : name;
}

function auditActionLabel(action: string) {
  if (action.startsWith("moved status to ")) {
    const status = action.replace("moved status to ", "") as JobStatus;
    return `ย้ายสถานะเป็น ${statusLabel[status] ?? status}`;
  }
  const labels: Record<string, string> = {
    "updated payment": "อัปเดตการชำระเงิน",
    "added comment": "เพิ่มคอมเมนต์",
    "created job": "สร้างงาน",
    "assigned designer": "มอบหมายดีไซเนอร์",
    "moved status to approval": "ย้ายสถานะไปรอลูกค้าอนุมัติ",
    "updated production start": "อัปเดตเริ่มผลิต",
    "added QC note": "เพิ่มโน้ตตรวจคุณภาพ",
    "added team member": "เพิ่มสมาชิกทีม",
    "updated team member": "แก้ไขสมาชิกทีม",
    "removed team member": "ลบสมาชิกทีม",
    "created customer": "สร้างลูกค้าใหม่",
    "updated customer": "แก้ไขลูกค้า",
    "removed customer": "ลบลูกค้า"
  };
  return labels[action] ?? action;
}

function daysFromToday(date: string) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = new Date(`${date}T00:00:00`);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// ระยะเวลาผลิตเริ่มต้น (วัน) ใช้ตั้งกำหนดส่งล่วงหน้าจากวันรับงาน
const DEFAULT_LEAD_TIME_DAYS = 7;

function addDaysISO(isoDate: string, days: number) {
  const base = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(base.getTime())) return isoDate;
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
}

// สถานะที่ถือว่างานจบแล้ว ไม่ต้องเตือน/แสดงสีเร่งด่วน
const FINISHED_STATUSES: JobStatus[] = ["Delivered / Picked Up", "Completed", "Cancelled"];
// ด่านการเงิน (ก่อนเข้าผลิต) — ต้องผ่าน "มัดจำแล้ว" ก่อนงานจึงเข้าสู่ขั้นผลิตได้
const FINANCE_PHASE: JobStatus[] = ["Quotation", "Waiting Deposit", "Verifying Payment", "Deposit Confirmed"];

// ด่านส่ง–รับงาน (handoff): ผู้ส่งกดส่ง → งานไปสถานะ "รอตรวจรับ" → ผู้รับ รับ(ผ่าน) หรือ ตีกลับ(พร้อมเหตุผล)
type HandoffGate = {
  id: string;
  label: string;
  fromStatus: JobStatus;
  reviewStatus: JobStatus;
  approveStatus: JobStatus;
  rejectStatus: JobStatus;
  senderRoles: Role[];
  reviewerRoles: Role[];
  nextGate?: string;        // ถ้ามี = อนุมัติแล้วส่งต่อด่านถัดไปอัตโนมัติ (ไม่ปิด handoff)
  branchManager?: boolean;  // ผู้ตรวจต้องเป็นผู้จัดการของสาขาที่ผลิต (productionBranch)
};
// flow: กราฟิกส่ง → เซลยืนยัน → (auto) ผจก.สาขาอนุมัติ → พร้อมผลิต (เด้งหาฝ่ายผลิตทั้งสาขา)
const HANDOFF_GATES: HandoffGate[] = [
  {
    id: "design_review",
    label: "ส่งงานให้เซลตรวจ",
    fromStatus: "Designing",
    reviewStatus: "Waiting for Customer Approval",
    approveStatus: "Waiting for Customer Approval",
    rejectStatus: "Designing",
    senderRoles: ["Designer"],
    reviewerRoles: ["Sales Staff"],
    nextGate: "production_approval"
  },
  {
    id: "production_approval",
    label: "ผู้จัดการสาขาอนุมัติเข้าผลิต",
    fromStatus: "Waiting for Customer Approval",
    reviewStatus: "Waiting for Customer Approval",
    approveStatus: "Ready for Production",
    rejectStatus: "Designing",
    senderRoles: ["Sales Staff"],
    reviewerRoles: ["Manager"],
    branchManager: true
  }
];
// กำหนดสาขาที่รับผิดชอบผลิตตามประเภทงาน — ดู lib/job-routing.ts (มีเทสที่ lib/job-routing.test.mjs)
const gateById = (id?: string) => HANDOFF_GATES.find((gate) => gate.id === id);
const gateFromStatus = (status: JobStatus) => HANDOFF_GATES.find((gate) => gate.fromStatus === status);
const userHasRole = (member: TeamMember, role: Role) => member.role === role || (member.roles ?? []).includes(role);
const userHasAnyRole = (member: TeamMember, list: Role[]) => list.some((role) => userHasRole(member, role));

type DueUrgency = { days: number; label: string; tone: string; dot: string };

// คำนวณความเร่งด่วนจากจำนวนวันที่เหลือถึงกำหนดส่ง เพื่อแสดงสีและเตือนกันพลาด
function dueUrgency(dueDate: string, status: JobStatus): DueUrgency | null {
  if (FINISHED_STATUSES.includes(status)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${dueDate}T00:00:00`);
  if (Number.isNaN(due.getTime())) return null;
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return { days, label: `เลยกำหนด ${Math.abs(days)} วัน`, tone: "bg-rose-100 text-rose-700", dot: "bg-rose-500" };
  if (days <= 1) return { days, label: days === 0 ? "ครบกำหนดวันนี้" : "ครบกำหนดพรุ่งนี้", tone: "bg-orange-100 text-orange-700", dot: "bg-orange-500" };
  if (days <= 3) return { days, label: `เหลือ ${days} วัน`, tone: "bg-amber-100 text-amber-800", dot: "bg-amber-500" };
  if (days <= 7) return { days, label: `เหลือ ${days} วัน`, tone: "bg-sky-100 text-sky-700", dot: "bg-sky-500" };
  return { days, label: `เหลือ ${days} วัน`, tone: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" };
}

function getPaymentStatus(price: number, deposit: number): PaymentStatus {
  if (deposit <= 0) return "unpaid";
  if (deposit >= price) return "paid";
  return "partial";
}

function quoteNumberFor(index: number, prefix: string) {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${prefix || "WO"}${stamp}${String(index).padStart(4, "0")}`;
}

function nextSequentialNumber(values: string[], prefix: string, fallback = 1028) {
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^${escapedPrefix}(\\d+)$`);
  const maxNumber = values.reduce((max, value) => {
    const match = value.match(pattern);
    const parsed = match ? Number(match[1]) : Number.NaN;
    return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
  }, fallback - 1);
  return maxNumber + 1;
}

function jobNumberFromValues(values: string[], offset = 0) {
  const next = nextSequentialNumber(values, "K2-", 1028) + offset;
  return `K2-${next}`;
}

function jobNumberFor(existingJobs: Job[], offset = 0) {
  return jobNumberFromValues(existingJobs.map((job) => job.id), offset);
}

function quoteNumberFromValues(values: string[], prefix: string, offset = 0) {
  const safePrefix = prefix || "WO";
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const next = nextSequentialNumber(values, `${safePrefix}${stamp}`, 1) + offset;
  return quoteNumberFor(next, safePrefix);
}

function isDuplicateKeyError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const detail = error as { code?: string; message?: string };
  return detail.code === "23505" || detail.message?.toLowerCase().includes("duplicate key");
}

function initialsFromName(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "K2"
  );
}

type PersonalizationPrefs = Partial<Pick<TeamMember, "nickname" | "avatarBorderColor" | "statusEmoji" | "statusText">>;

const AVATAR_BORDER_PRESETS: Array<{ value: string; label: string }> = [
  { value: "", label: "ค่าเริ่มต้น" },
  { value: "#ec4899", label: "ชมพู" },
  { value: "#f43f5e", label: "โรส" },
  { value: "#f97316", label: "ส้ม" },
  { value: "#f59e0b", label: "ทอง" },
  { value: "#84cc16", label: "ไลม์" },
  { value: "#10b981", label: "เขียว" },
  { value: "#06b6d4", label: "ฟ้าคราม" },
  { value: "#3b82f6", label: "ฟ้า" },
  { value: "#6366f1", label: "อินดิโก้" },
  { value: "#a855f7", label: "ม่วง" },
  { value: "#64748b", label: "เทา" },
  { value: "#0f172a", label: "ดำ" }
];

const STATUS_PRESETS: Array<{ emoji: string; text: string }> = [
  { emoji: "🟢", text: "พร้อมทำงาน" },
  { emoji: "🔴", text: "ยุ่งอยู่" },
  { emoji: "🟡", text: "อาจไม่อยู่ที่เครื่อง" },
  { emoji: "☕", text: "พักสักครู่" },
  { emoji: "🎯", text: "โฟกัสสูง" },
  { emoji: "💪", text: "กำลังผลิต!" },
  { emoji: "🚀", text: "ไปส่งของ" },
  { emoji: "😴", text: "วันหยุด" }
];

// Personalization (nickname, avatar border color, status) is stored per-member in
// localStorage so it works without any database change. mergePersonalization reads it
// at render time, so personalized avatars/names show everywhere automatically.
function readPersonalization(): Record<string, PersonalizationPrefs> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem("k2-personalization") ?? "{}") as Record<string, PersonalizationPrefs>;
  } catch {
    return {};
  }
}

function mergePersonalization(member: TeamMember): TeamMember {
  const prefs = readPersonalization()[member.id];
  return prefs ? { ...member, ...prefs } : member;
}

function memberDisplayName(member: TeamMember): string {
  return member.nickname?.trim() || member.name;
}

// เทียบข้อมูลที่เพิ่งโหลดมากับ state เดิมแบบ deep (ผ่าน JSON) — ใช้ใน refreshWorkspaceData
// ถ้าเหมือนเดิมให้คืน reference เดิมเพื่อให้ React bail out ไม่ re-render
// (กรณีหลักคือ realtime echo ของ action ที่ผู้ใช้ทำเองอยู่แล้ว → ซิงก์กลับมาเหมือนเดิม)
function reuseIfSame<T>(current: T, next: T): T {
  return JSON.stringify(current) === JSON.stringify(next) ? current : next;
}

function profileToMember(profile: { id: string; email?: string | null; username?: string | null; full_name: string | null; role: Role | null; extra_roles?: Role[] | null; avatar_url?: string | null; phone?: string | null; branch?: string | null }): TeamMember {
  const name = profile.full_name || "K2 User";
  const extra = (profile.extra_roles ?? []).filter((value): value is Role => roles.includes(value as Role));
  return {
    id: profile.id,
    name,
    role: profile.role ?? "Sales Staff",
    roles: extra.length ? extra : undefined,
    avatar: initialsFromName(name),
    avatarUrl: profile.avatar_url ?? undefined,
    username: profile.username || usernameFromEmail(profile.email),
    phone: profile.phone ?? undefined,
    branch: profile.branch ?? undefined
  };
}

function readImageAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("อ่านไฟล์รูปภาพไม่สำเร็จ"));
    reader.readAsDataURL(file);
  });
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[\s_\-./()]/g, "");
}

function pickSpreadsheetValue(row: Record<string, unknown>, aliases: string[]) {
  const normalizedAliases = aliases.map(normalizeHeader);
  const match = Object.entries(row).find(([key]) => normalizedAliases.includes(normalizeHeader(key)));
  return String(match?.[1] ?? "").trim();
}

function parseCustomerRows(rows: Record<string, unknown>[], existingCustomers: Customer[]): ImportedCustomer[] {
  return rows
    .map((row) => {
      const imported: ImportedCustomer = {
        name: pickSpreadsheetValue(row, ["name", "customer", "customername", "ชื่อลูกค้า", "ลูกค้า", "บริษัท"]),
        phone: pickSpreadsheetValue(row, ["phone", "tel", "telephone", "mobile", "เบอร์โทร", "โทร", "เบอร์"]),
        lineId: pickSpreadsheetValue(row, ["line", "lineid", "line id", "ไลน์", "ไอดีไลน์"]),
        email: pickSpreadsheetValue(row, ["email", "e-mail", "mail", "อีเมล", "อีเมล์"]),
        notes: pickSpreadsheetValue(row, ["notes", "note", "remark", "remarks", "หมายเหตุ", "โน้ต"]),
        companyName: pickSpreadsheetValue(row, ["company", "companyname", "company_name", "ชื่อบริษัท", "นิติบุคคล"]),
        taxId: pickSpreadsheetValue(row, ["taxid", "tax_id", "vat", "เลขผู้เสียภาษี", "เลขภาษี"]),
        branch: pickSpreadsheetValue(row, ["branch", "สาขา"]),
        billingAddress: pickSpreadsheetValue(row, ["billingaddress", "billing_address", "invoiceaddress", "ที่อยู่ใบกำกับ", "ที่อยู่ออกบิล"]),
        accountingEmail: pickSpreadsheetValue(row, ["accountingemail", "accounting_email", "billingemail", "อีเมลบัญชี", "อีเมลออกบิล"]),
        requiresInvoice: ["yes", "true", "1", "y", "ใช่", "ต้องการ"].includes(
          pickSpreadsheetValue(row, ["requiresinvoice", "requires_invoice", "invoice", "taxinvoice", "ใบกำกับ", "ต้องการใบกำกับ"]).toLowerCase()
        )
      };
      const duplicate = existingCustomers.find((customer) =>
        (imported.phone && customer.phone === imported.phone) ||
        (imported.lineId && customer.lineId === imported.lineId) ||
        (imported.email && customer.email === imported.email)
      );
      return {
        ...imported,
        duplicateReason: duplicate ? `ซ้ำกับ ${duplicate.name}` : undefined
      };
    })
    .filter((customer) => customer.name);
}

function companyFromRow(row: SupabaseCompanyRow): CompanyProfile {
  return {
    name: row.name,
    legalName: row.legal_name,
    taxId: row.tax_id ?? "",
    branch: row.branch ?? "",
    address: row.address ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    bankName: row.bank_name ?? "",
    bankAccount: row.bank_account ?? "",
    bankAccountName: row.bank_account_name ?? "",
    quotePrefix: row.quote_prefix === legacyQuotePrefix ? "WO" : row.quote_prefix,
    quoteTerms: row.quote_terms?.includes("เสนอราคา") ? initialCompanyProfile.quoteTerms : row.quote_terms ?? "",
    facebookPages: Array.isArray(row.facebook_pages) && row.facebook_pages.length ? row.facebook_pages : initialCompanyProfile.facebookPages
  };
}

function customerFromRow(row: SupabaseCustomerRow, jobs: SupabaseJobRow[]): Customer {
  const customerJobs = jobs.filter((job) => job.customer_id === row.id);
  return {
    id: row.id,
    dbId: row.id,
    name: row.name,
    phone: row.phone,
    lineId: row.line_id ?? "",
    email: row.email ?? "",
    notes: row.notes ?? "",
    companyName: row.company_name ?? "",
    taxId: row.tax_id ?? "",
    branch: row.branch ?? "",
    billingAddress: row.billing_address ?? "",
    accountingEmail: row.accounting_email ?? "",
    requiresInvoice: row.requires_invoice,
    sourceChannel: row.source_channel ?? "",
    sourcePage: row.source_page ?? "",
    customerCode: row.customer_code ?? "",
    codePage: row.code_page ?? "",
    codeAdmin: row.code_admin ?? "",
    codeSeq: row.code_seq ?? undefined,
    codeYear: row.code_year ?? "",
    lineFriend: row.line_friend ?? false,
    loyaltyPoints: row.loyalty_points ?? 0,
    totalOrders: customerJobs.length,
    lifetimeValue: customerJobs.reduce((sum, job) => sum + Number(job.price), 0),
    lastOrderDate: customerJobs[0]?.order_date ?? "-"
  };
}

function jobFromRow(
  row: SupabaseJobRow,
  profileNames: Map<string, string>,
  comments: Array<{ id: string; job_id: string; comment: string; created_at: string; author_id: string | null }>,
  history: Array<{ id: string; job_id: string; from_status: JobStatus | null; to_status: JobStatus; created_at: string; changed_by: string | null }>,
  files: Array<{ id: string; job_id: string; file_name: string; file_type: string; file_size: number | null; url?: string | null }>
): Job {
  const price = Number(row.price);
  const deposit = Number(row.deposit);
  return {
    id: row.job_number,
    dbId: row.id,
    quoteNumber: row.quote_number ?? undefined,
    quoteStatus: row.quote_status,
    customerId: row.customer_id,
    customerName: row.customer_name ?? "",
    phone: row.customer_phone ?? "",
    lineId: row.customer_line_id ?? "",
    companyName: row.company_name ?? "",
    taxId: row.tax_id ?? "",
    branch: row.branch ?? "",
    billingAddress: row.billing_address ?? "",
    accountingEmail: row.accounting_email ?? "",
    requiresInvoice: row.requires_invoice,
    title: row.title,
    type: row.type,
    description: row.description,
    quantity: row.quantity,
    files: files.filter((file) => file.job_id === row.id).map((file) => ({
      id: file.id,
      name: file.file_name,
      type: file.file_type.includes("pdf") ? "pdf" : file.file_type.includes("zip") ? "zip" : file.file_type.includes("ai") ? "ai" : "image",
      size: file.file_size ? `${Math.max(file.file_size / 1000000, 0.01).toFixed(2)} MB` : "ไฟล์แนบ",
      url: file.url ?? undefined
    })),
    orderDate: row.order_date,
    dueDate: row.due_date,
    priority: row.priority,
    isExpress: row.is_express ?? false,
    productionBranch: row.production_branch ?? "",
    incomeBranch: row.income_branch ?? undefined,
    salesPage: row.sales_page ?? undefined,
    acceptance: row.acceptance ?? "accepted",
    rejectReason: row.reject_reason ?? "",
    handoffStatus: row.handoff_status === "pending" || row.handoff_status === "accepted" ? row.handoff_status : undefined,
    handoffGate: row.handoff_gate ?? undefined,
    handoffFromUser: row.handoff_from_user ?? undefined,
    handoffFromStatus: row.handoff_from_status ?? undefined,
    handoffNote: row.handoff_note ?? undefined,
    status: row.status,
    assignedDesigner: row.assigned_designer ? profileNames.get(row.assigned_designer) ?? "Unassigned" : "Unassigned",
    assignedProduction: row.assigned_production ? profileNames.get(row.assigned_production) ?? "Unassigned" : "Unassigned",
    price,
    vatMode: normalizeVatMode(row.vat_mode),
    deposit,
    depositSlip: row.deposit_slip ?? undefined,
    depositReceivedDate: row.deposit_received_date ?? undefined,
    depositConfirmed: Boolean(row.deposit_confirmed),
    depositConfirmedBy: row.deposit_confirmed_by ? profileNames.get(row.deposit_confirmed_by) ?? undefined : undefined,
    depositWaived: Boolean(row.deposit_waived),
    balanceSlip: row.balance_slip ?? undefined,
    balanceReceivedDate: row.balance_received_date ?? undefined,
    createdBy: row.created_by ? profileNames.get(row.created_by) ?? undefined : undefined,
    remainingBalance: Number(row.remaining_balance),
    paymentStatus: row.payment_status,
    internalNotes: row.internal_notes ?? "",
    comments: comments.filter((comment) => comment.job_id === row.id).map((comment) => ({
      id: comment.id,
      by: comment.author_id ? profileNames.get(comment.author_id) ?? "K2 User" : "K2 User",
      at: new Date(comment.created_at).toLocaleString("en-GB"),
      text: comment.comment
    })),
    statusHistory: history.filter((event) => event.job_id === row.id).map((event) => ({
      id: event.id,
      from: event.from_status ?? "Created",
      to: event.to_status,
      by: event.changed_by ? profileNames.get(event.changed_by) ?? "K2 User" : "K2 User",
      at: new Date(event.created_at).toLocaleString("en-GB")
    }))
  };
}

function attendanceFromRow(row: { id: string; profile_id: string; work_date: string; check_in_at: string | null; check_out_at: string | null; check_in_selfie: string | null; check_out_selfie?: string | null; check_in_lat: number | string | null; check_in_lng: number | string | null; late_minutes: number | null; status: string | null }): Attendance {
  return {
    id: row.id,
    profileId: row.profile_id,
    workDate: row.work_date,
    checkInAt: row.check_in_at,
    checkOutAt: row.check_out_at,
    checkInSelfie: row.check_in_selfie,
    checkOutSelfie: row.check_out_selfie ?? null,
    checkInLat: row.check_in_lat != null ? Number(row.check_in_lat) : null,
    checkInLng: row.check_in_lng != null ? Number(row.check_in_lng) : null,
    lateMinutes: row.late_minutes ?? 0,
    status: (row.status as Attendance["status"]) ?? "on_time"
  };
}

function leaveFromRow(row: { id: string; profile_id: string; leave_type: string | null; start_date: string; end_date: string; reason: string | null; status: string | null; created_at: string }): LeaveRequest {
  return {
    id: row.id,
    profileId: row.profile_id,
    leaveType: (row.leave_type as LeaveRequest["leaveType"]) ?? "sick",
    startDate: row.start_date,
    endDate: row.end_date,
    reason: row.reason ?? "",
    status: (row.status as LeaveRequest["status"]) ?? "pending",
    createdAt: row.created_at
  };
}

function holidayFromRow(row: { id: string; holiday_date: string; name: string }): Holiday {
  return { id: row.id, date: row.holiday_date, name: row.name };
}

function notifFromRow(row: SupabaseNotificationRow): AppNotification {
  return {
    id: row.id,
    type: row.type,
    jobId: row.job_number ?? "",
    jobTitle: row.job_title ?? "",
    message: row.message,
    at: new Date(row.created_at).toLocaleString("th-TH", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
    read: row.is_read
  };
}

function auditFromRow(row: { id: string; action: string; target_table: string; target_id: string | null; metadata: Record<string, unknown>; created_at: string; actor_id: string | null }, profileNames: Map<string, string>): AuditEvent {
  return {
    id: row.id,
    actor: row.actor_id ? profileNames.get(row.actor_id) ?? "K2 User" : "K2 User",
    action: row.action,
    target: String(row.metadata?.target ?? row.target_id ?? row.target_table),
    at: new Date(row.created_at).toLocaleString("en-GB")
  };
}

// ===== ระบบรหัสลูกค้า K2 (SOP v1) =====
// ตรรกะ/ทะเบียนแยกไว้ที่ lib/customer-code.ts เพื่อให้เทสได้ (ดู lib/customer-code.test.mjs)

function customerInsertPayload(customer: Omit<Customer, "id" | "totalOrders" | "lifetimeValue" | "lastOrderDate">) {
  return {
    name: customer.name,
    phone: customer.phone,
    line_id: customer.lineId,
    email: customer.email,
    notes: customer.notes ?? "",
    company_name: customer.companyName ?? "",
    tax_id: customer.taxId ?? "",
    branch: customer.branch ?? "",
    billing_address: customer.billingAddress ?? "",
    accounting_email: customer.accountingEmail ?? "",
    requires_invoice: customer.requiresInvoice ?? false,
    source_channel: customer.sourceChannel ?? "",
    source_page: customer.sourcePage ?? "",
    line_friend: customer.lineFriend ?? false,
    loyalty_points: customer.loyaltyPoints ?? 0
  };
}

function teamIdByName(teamMembers: TeamMember[], name?: string) {
  if (!name || name === "Unassigned") return null;
  return teamMembers.find((member) => member.name === name)?.id ?? null;
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const details = error as { message?: string; code?: string; details?: string; hint?: string };
    return [details.code, details.message, details.details, details.hint].filter(Boolean).join(" - ") || fallback;
  }
  return fallback;
}

export default function Page() {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(initialTeam);
  const [currentUser, setCurrentUser] = useState(initialTeam[0]);
  const [permissionMatrix, setPermissionMatrix] = useState<Record<Role, PermissionKey[]>>(defaultRolePermissions);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>(initialCompanyProfile);
  const [customerRecords, setCustomerRecords] = useState<Customer[]>(initialCustomers);
  const [isAuthed, setIsAuthed] = useState(false);
  const [authMode, setAuthMode] = useState<"signIn" | "signUp">("signIn");
  const [authForm, setAuthForm] = useState({ username: "", password: "", fullName: "", role: "Sales Staff" as Role });
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState("");
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [auditLog, setAuditLog] = useState<AuditEvent[]>(initialAuditLog);
  const [activeView, setActiveView] = useState("Dashboard");
  const [selectedJobId, setSelectedJobId] = useState(initialJobs[0].id);
  const [query, setQuery] = useState("");
  const [draggedJobId, setDraggedJobId] = useState<string | null>(null);
  const [personalizationVersion, setPersonalizationVersion] = useState(0);
  const [showPersonalization, setShowPersonalization] = useState(false);
  const [showMyProfile, setShowMyProfile] = useState(false);
  // personalizationVersion is an intentional trigger: bumping it re-reads localStorage prefs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const currentUserPrefs = useMemo(() => mergePersonalization(currentUser), [currentUser, personalizationVersion]);

  function updatePersonalization(updates: PersonalizationPrefs) {
    if (typeof window === "undefined") return;
    const all = readPersonalization();
    const merged: PersonalizationPrefs = { ...(all[currentUser.id] ?? {}), ...updates };
    (Object.keys(merged) as Array<keyof PersonalizationPrefs>).forEach((key) => {
      if (!merged[key]) delete merged[key];
    });
    all[currentUser.id] = merged;
    window.localStorage.setItem("k2-personalization", JSON.stringify(all));
    setPersonalizationVersion((value) => value + 1);
  }
  const [pendingMove, setPendingMove] = useState<{ jobId: string; from: JobStatus; to: JobStatus } | null>(null);
  const [hrRecords, setHrRecords] = useState<Record<string, { salary: number; position: string; startDate: string }>>({});
  const [branchSettings, setBranchSettings] = useState<Record<string, BranchSetting>>({});
  const [myAttendance, setMyAttendance] = useState<Attendance | null>(null);
  const [allAttendance, setAllAttendance] = useState<Attendance[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [payrollMonth, setPayrollMonth] = useState(todayISO().slice(0, 7));
  const [payrollSummary, setPayrollSummary] = useState<Record<string, { present: number; late: number; lateMin: number; leaveDays: number; otHours: number }>>({});
  const [overtimeRecords, setOvertimeRecords] = useState<Overtime[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const notifPanelRef = useRef<HTMLDivElement>(null);
  const [expressOrdersEnabled, setExpressOrdersEnabled] = useState(false);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [createJobPrefill, setCreateJobPrefill] = useState<Partial<Job> | null>(null);
  const [createJobNonce, setCreateJobNonce] = useState(0);
  const [expressRequests, setExpressRequests] = useState<ExpressRequest[]>([]);
  const [showExpressPanel, setShowExpressPanel] = useState(false);
  const expressPanelRef = useRef<HTMLDivElement>(null);

  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? jobs[0] ?? null;
  const currentRolePermissions = useMemo(() => {
    const activeRoles = [currentUser.role, ...(currentUser.roles ?? [])];
    const merged = new Set<PermissionKey>();
    for (const activeRole of activeRoles) {
      for (const permission of permissionMatrix[activeRole] ?? []) merged.add(permission);
    }
    return Array.from(merged);
  }, [permissionMatrix, currentUser.role, currentUser.roles]);
  const can = (permission: PermissionKey) => currentRolePermissions.includes(permission);
  const canSeeMoney = can("view_finance");
  const activeJobs = useMemo(() => jobs.filter((job) => !["Completed", "Cancelled"].includes(job.status)), [jobs]);
  // callback คงที่สำหรับเปิดรายละเอียดงาน — ช่วยให้ view ที่ครอบด้วย memo ไม่ re-render เพราะ prop เปลี่ยน reference
  const openJobDetail = useCallback((id: string) => {
    setSelectedJobId(id);
    setActiveView("Detail");
  }, []);
  const navigationItems = useMemo(
    () =>
      [
        { label: "Dashboard", icon: LayoutDashboard, visible: currentRolePermissions.includes("view_dashboard") }, { label: "Executive", icon: BarChart3, visible: currentRolePermissions.includes("view_finance") },
        { label: "My Jobs", icon: ListTodo, visible: true },
        { label: "Board", icon: ClipboardList, visible: currentRolePermissions.includes("view_dashboard") },
        { label: "Completed", icon: CheckCircle2, visible: currentRolePermissions.includes("assign_staff") },
        { label: "Leads", icon: Inbox, visible: currentRolePermissions.includes("create_job") },
        { label: "Quotations", icon: ReceiptText, visible: currentRolePermissions.includes("create_job") },
        { label: "Create Job", icon: ClipboardPlus, visible: currentRolePermissions.includes("create_job") },
        { label: "Calendar", icon: CalendarDays, visible: currentRolePermissions.includes("view_dashboard") },
        { label: "Customers", icon: UsersRound, visible: currentRolePermissions.includes("create_customer") || currentRolePermissions.includes("edit_customer") || currentRolePermissions.includes("delete_customer") },
        { label: "Payments", icon: WalletCards, visible: currentRolePermissions.includes("view_finance") || currentRolePermissions.includes("edit_payment") },
        { label: "Reports", icon: BarChart3, visible: currentRolePermissions.includes("view_dashboard") },
        { label: "Finance", icon: Coins, visible: currentRolePermissions.includes("view_finance") },
        { label: "Attendance", icon: Clock3, visible: currentRolePermissions.includes("view_dashboard") },
        { label: "Leave", icon: CalendarDays, visible: currentRolePermissions.includes("view_dashboard") },
        { label: "HR", icon: UsersRound, visible: currentRolePermissions.includes("manage_hr") },
        { label: "Payroll", icon: WalletCards, visible: currentRolePermissions.includes("manage_hr") },
        { label: "Settings", icon: Settings, visible: currentUser.role === "Owner" },
        { label: "Detail", icon: FileImage, visible: currentRolePermissions.includes("view_dashboard") },
        { label: "Audit", icon: ShieldCheck, visible: currentRolePermissions.includes("view_audit_log") }
      ].filter((item) => item.visible),
    [currentRolePermissions, currentUser.role]
  );
  // เมนูที่แสดงจริง — ตัด "Detail" (เปิดผ่านการเลือกงานเท่านั้น ไม่ใช่ปุ่มเมนู)
  const menuItems = useMemo(() => navigationItems.filter((item) => item.label !== "Detail"), [navigationItems]);
  // หน้าแรก = เมนูแรกที่ผู้ใช้มีสิทธิ์เห็น
  const homeView = navigationItems[0]?.label ?? "Dashboard";
  // เมนูมือถือแบบหุบ/กางได้ (ประหยัดพื้นที่ ไม่บังเนื้อหา)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showPendingPanel, setShowPendingPanel] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let isMounted = true;

    async function loadProfile(userId: string) {
      const { data, error } = await supabase!
        .from("profiles")
        .select("id, email, full_name, role, extra_roles, avatar_url, phone, branch")
        .eq("id", userId)
        .single();
      if (!isMounted || error || !data) return;
      const member = profileToMember(data as SupabaseProfileRow);
      setCurrentUser(member);
      setTeamMembers((current) => (current.some((item) => item.id === member.id) ? current.map((item) => (item.id === member.id ? member : item)) : [member, ...current]));
      setIsAuthed(true);
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user.id) void loadProfile(data.session.user.id);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user.id) {
        void loadProfile(session.user.id);
      } else if (isMounted) {
        setIsAuthed(false);
      }
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem("k2-permission-matrix");
    if (!saved) return;
    try {
      setPermissionMatrix({ ...defaultRolePermissions, ...JSON.parse(saved) });
    } catch {
      window.localStorage.removeItem("k2-permission-matrix");
    }
  }, []);

  // โหมด mock (ไม่มี Supabase): โหลด/บันทึก notification ลง localStorage ต่อผู้ใช้
  // โหมด Supabase: notification มาจากตาราง + Realtime จึงไม่ใช้ localStorage
  useEffect(() => {
    if (isSupabaseConfigured) return;
    try {
      const stored = window.localStorage.getItem(`k2-notifs-${currentUser.id}`);
      setNotifications(stored ? (JSON.parse(stored) as AppNotification[]) : []);
    } catch { setNotifications([]); }
  }, [currentUser.id]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    try {
      window.localStorage.setItem(`k2-notifs-${currentUser.id}`, JSON.stringify(notifications));
    } catch {}
  }, [notifications, currentUser.id]);

  // สถานะเปิดรับงานด่วน — โหมด mock อ่านจาก localStorage / โหมด Supabase อ่านจาก shop_state (ใน refreshWorkspaceData)
  useEffect(() => {
    if (isSupabaseConfigured) return;
    setExpressOrdersEnabled(window.localStorage.getItem("k2-express-enabled") === "1");
  }, []);

  function toggleExpressOrders() {
    const next = !expressOrdersEnabled;
    setExpressOrdersEnabled(next);
    if (supabase && isSupabaseConfigured) {
      void supabase
        .from("shop_state")
        .update({ express_orders_enabled: next, updated_by: uuidPattern.test(currentUser.id) ? currentUser.id : null })
        .eq("id", true);
    } else {
      try { window.localStorage.setItem("k2-express-enabled", next ? "1" : "0"); } catch {}
    }
  }

  // โหลดคำขอด่วน (เปิด/ที่อนุมัติแล้ว) สำหรับโหมด Supabase
  async function reloadExpressRequests() {
    if (!supabase || !isSupabaseConfigured) return;
    const { data, error } = await supabase
      .from("express_requests")
      .select("id, requested_by, requested_by_name, status, approved_by, approved_by_name, consumed, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return;
    const next = ((data ?? []) as SupabaseExpressRequestRow[]).map(expressRowToRequest);
    setExpressRequests((current) => reuseIfSame(current, next));
  }

  // เซลส์กด "ขออนุมัติงานด่วน" → สร้างคำขอ + แจ้งผู้จัดการ/เจ้าของ + log
  async function requestExpress() {
    if (!can("create_job")) {
      setDataError("บทบาทนี้ยังไม่มีสิทธิ์สร้างงาน");
      return;
    }
    if (myLatestExpressRequest?.status === "pending") {
      setDataError("คุณมีคำขอด่วนที่รออนุมัติอยู่แล้ว");
      return;
    }
    if (myApprovedExpressRequest) {
      setDataError("คำขอด่วนของคุณได้รับอนุมัติแล้ว สร้างงานด่วนได้เลย");
      return;
    }
    if (supabase && isSupabaseConfigured && uuidPattern.test(currentUser.id)) {
      const { error } = await supabase.from("express_requests").insert({
        requested_by: currentUser.id,
        requested_by_name: currentUser.name,
        status: "pending"
      });
      if (error) {
        setDataError(error.message);
        return;
      }
      // แจ้งเตือนผู้จัดการ/เจ้าของทุกคน
      const managerIds = teamMembers
        .filter((member) => (member.role === "Owner" || member.role === "Manager") && uuidPattern.test(member.id))
        .map((member) => member.id);
      if (managerIds.length) {
        void supabase.from("notifications").insert(
          managerIds.map((recipientId) => ({
            recipient_id: recipientId,
            type: "express_request",
            message: `${currentUser.name} ขออนุมัติสร้างงานด่วน`
          }))
        );
      }
      void appendAudit("requested express order", currentUser.name, "express_requests", null);
      await reloadExpressRequests();
    } else {
      // โหมด mock
      setExpressRequests((current) => [
        { id: crypto.randomUUID(), requestedById: currentUser.id, requestedByName: currentUser.name, status: "pending", consumed: false, createdAt: new Date().toISOString() },
        ...current
      ]);
    }
  }

  // ผู้จัดการ/เจ้าของ อนุมัติหรือปฏิเสธคำขอด่วน
  async function decideExpress(requestId: string, decision: "approved" | "rejected") {
    if (!canManageExpress) {
      setDataError("เฉพาะผู้จัดการ/เจ้าของเท่านั้นที่อนุมัติงานด่วนได้");
      return;
    }
    const target = expressRequests.find((req) => req.id === requestId);
    if (supabase && isSupabaseConfigured) {
      const { error } = await supabase
        .from("express_requests")
        .update({ status: decision, approved_by: uuidPattern.test(currentUser.id) ? currentUser.id : null, approved_by_name: currentUser.name, decided_at: new Date().toISOString() })
        .eq("id", requestId);
      if (error) {
        setDataError(error.message);
        return;
      }
      // แจ้งเตือนผู้ขอ
      if (target && uuidPattern.test(target.requestedById)) {
        void supabase.from("notifications").insert({
          recipient_id: target.requestedById,
          type: "express_decision",
          message: decision === "approved" ? `${currentUser.name} อนุมัติงานด่วนของคุณแล้ว — สร้างงานด่วนได้เลย` : `${currentUser.name} ปฏิเสธคำขอด่วนของคุณ`
        });
      }
      void appendAudit(decision === "approved" ? "approved express order" : "rejected express order", target?.requestedByName ?? requestId, "express_requests", requestId);
      await reloadExpressRequests();
    } else {
      setExpressRequests((current) => current.map((req) => (req.id === requestId ? { ...req, status: decision, approvedByName: currentUser.name } : req)));
    }
  }

  // ทำเครื่องหมายว่าคำขอด่วนถูกใช้สร้างงานแล้ว (เรียกหลังสร้างงานด่วนสำเร็จ)
  async function consumeExpressRequest() {
    const req = myApprovedExpressRequest;
    if (!req) return;
    if (supabase && isSupabaseConfigured) {
      await supabase.from("express_requests").update({ consumed: true }).eq("id", req.id);
      await reloadExpressRequests();
    } else {
      setExpressRequests((current) => current.map((r) => (r.id === req.id ? { ...r, consumed: true } : r)));
    }
  }

  // ===== ใบเสนอราคา (Quotation) =====
  async function reloadQuotations() {
    if (!supabase || !isSupabaseConfigured) return;
    const { data, error } = await supabase
      .from("quotations")
      .select("id, quote_number, customer_id, customer_name, customer_phone, title, description, amount, status, created_by_name, converted_job_id, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) return;
    const next = ((data ?? []) as SupabaseQuotationRow[]).map(quotationRowToQuotation);
    setQuotations((current) => reuseIfSame(current, next));
  }

  async function createQuotation(input: { customerId?: string; customerName: string; customerPhone: string; title: string; description: string; amount: number }) {
    if (!can("create_job")) {
      setDataError("บทบาทนี้ยังไม่มีสิทธิ์สร้างใบเสนอราคา");
      return;
    }
    if (!input.title.trim() || !input.customerName.trim()) {
      setDataError("กรุณากรอกชื่อลูกค้าและชื่องาน");
      return;
    }
    if (supabase && isSupabaseConfigured) {
      const { error } = await supabase.from("quotations").insert({
        customer_id: input.customerId && uuidPattern.test(input.customerId) ? input.customerId : null,
        customer_name: input.customerName.trim(),
        customer_phone: input.customerPhone.trim(),
        title: input.title.trim(),
        description: input.description.trim(),
        amount: input.amount,
        status: "draft",
        created_by: uuidPattern.test(currentUser.id) ? currentUser.id : null,
        created_by_name: currentUser.name
      });
      if (error) { setDataError(error.message); return; }
      void appendAudit("created quotation", input.title.trim(), "quotations", null);
      await reloadQuotations();
    } else {
      setQuotations((current) => [
        { id: crypto.randomUUID(), customerId: input.customerId, customerName: input.customerName, customerPhone: input.customerPhone, title: input.title, description: input.description, amount: input.amount, status: "draft", createdByName: currentUser.name, createdAt: new Date().toISOString() },
        ...current
      ]);
    }
  }

  async function updateQuotationStatus(id: string, status: Quotation["status"]) {
    if (!can("create_job")) return;
    const patch: Record<string, unknown> = { status };
    if (status === "approved") patch.approved_at = new Date().toISOString();
    setQuotations((current) => current.map((q) => (q.id === id ? { ...q, status } : q)));
    if (supabase && isSupabaseConfigured) {
      const { error } = await supabase.from("quotations").update(patch).eq("id", id);
      if (error) { setDataError(error.message); void reloadQuotations(); return; }
    }
    void appendAudit(`quotation ${status}`, id, "quotations", id);
  }

  // แปลงใบเสนอราคา → เด้งไปหน้าสร้างงาน พร้อมเติมข้อมูลให้ (เซลส์แนบสลิปแล้วสร้างใบงานตามระบบเดิม)
  function convertQuotationToJob(quotation: Quotation) {
    setCreateJobPrefill({
      customerId: quotation.customerId ?? "new",
      customerName: quotation.customerName,
      phone: quotation.customerPhone,
      title: quotation.title,
      description: quotation.description,
      price: quotation.amount
    });
    setCreateJobNonce((n) => n + 1);
    setActiveView("Create Job");
    void updateQuotationStatus(quotation.id, "converted");
  }

  // ===== กล่อง Lead ภายใน =====
  async function reloadLeads() {
    if (!supabase || !isSupabaseConfigured) return;
    const { data, error } = await supabase
      .from("leads")
      .select("id, name, phone, channel, page, message, status, created_by_name, created_at")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) return;
    const next = ((data ?? []) as SupabaseLeadRow[]).map(leadRowToLead);
    setLeads((current) => reuseIfSame(current, next));
  }

  async function createLead(input: { name: string; phone: string; channel: string; page: string; message: string }) {
    if (!input.name.trim()) {
      setDataError("กรุณากรอกชื่อลูกค้า");
      return;
    }
    if (supabase && isSupabaseConfigured) {
      const { error } = await supabase.from("leads").insert({
        name: input.name.trim(),
        phone: input.phone.trim(),
        channel: input.channel,
        page: input.page.trim(),
        message: input.message.trim(),
        status: "new",
        created_by: uuidPattern.test(currentUser.id) ? currentUser.id : null,
        created_by_name: currentUser.name
      });
      if (error) { setDataError(error.message); return; }
      void appendAudit("created lead", input.name.trim(), "leads", null);
      await reloadLeads();
    } else {
      setLeads((current) => [{ id: crypto.randomUUID(), name: input.name, phone: input.phone, channel: input.channel, page: input.page, message: input.message, status: "new", createdByName: currentUser.name, createdAt: new Date().toISOString() }, ...current]);
    }
  }

  async function updateLeadStatus(id: string, status: Lead["status"]) {
    setLeads((current) => current.map((l) => (l.id === id ? { ...l, status } : l)));
    if (supabase && isSupabaseConfigured) {
      const { error } = await supabase.from("leads").update({ status }).eq("id", id);
      if (error) { setDataError(error.message); void reloadLeads(); return; }
    }
    void appendAudit(`lead ${status}`, id, "leads", id);
  }

  // แปลง Lead → ใบเสนอราคา (สถานะ lead เป็น quoted แล้วเด้งไปหน้าใบเสนอราคา)
  async function convertLeadToQuotation(lead: Lead) {
    await createQuotation({
      customerName: lead.name,
      customerPhone: lead.phone,
      title: `งานของ ${lead.name}`,
      description: lead.message,
      amount: 0
    });
    await updateLeadStatus(lead.id, "quoted");
    setActiveView("Quotations");
  }

  const canManageExpress = currentUser.role === "Owner" || currentUser.role === "Manager";
  const pendingExpressRequests = useMemo(
    () => expressRequests.filter((req) => req.status === "pending"),
    [expressRequests]
  );
  // คำขอด่วนของฉันที่อนุมัติแล้วและยังไม่ได้ใช้สร้างงาน (ปลดล็อกการติ๊ก "งานด่วน")
  const myApprovedExpressRequest = useMemo(
    () => expressRequests.find((req) => req.requestedById === currentUser.id && req.status === "approved" && !req.consumed),
    [expressRequests, currentUser.id]
  );
  // คำขอด่วนล่าสุดของฉัน (ไว้แสดงสถานะปุ่มฝั่งเซลส์)
  const myLatestExpressRequest = useMemo(
    () => expressRequests.filter((req) => req.requestedById === currentUser.id)[0],
    [expressRequests, currentUser.id]
  );
  // ติ๊กงานด่วนได้เมื่อ: เป็นผู้จัดการ/เจ้าของ หรือมีคำขอที่อนุมัติแล้ว
  const canCreateExpress = canManageExpress || Boolean(myApprovedExpressRequest);

  // Realtime: รับแจ้งเตือน + สวิตช์งานด่วน + ซิงก์ลูกค้า/งานจากเซิร์ฟเวอร์กลาง (เฉพาะโหมด Supabase)
  useEffect(() => {
    if (!supabase || !isSupabaseConfigured || !uuidPattern.test(currentUser.id)) return;
    const client = supabase;
    // รวมการเปลี่ยนแปลงหลายรายการแล้วค่อยรีโหลดทีเดียวแบบเงียบ ๆ (ไม่ดีดงานที่กำลังดู/ไม่รีเซ็ตฟอร์ม)
    let syncTimer: ReturnType<typeof setTimeout> | null = null;
    function scheduleSync() {
      if (syncTimer) clearTimeout(syncTimer);
      syncTimer = setTimeout(() => {
        void refreshWorkspaceData({ silent: true });
      }, 400);
    }
    const channel = client
      .channel(`k2-rt-${currentUser.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${currentUser.id}` },
        (payload) => {
          const row = payload.new as SupabaseNotificationRow;
          setNotifications((current) => (current.some((item) => item.id === row.id) ? current : [notifFromRow(row), ...current].slice(0, 50)));
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shop_state" },
        (payload) => {
          const row = payload.new as { express_orders_enabled?: boolean };
          if (typeof row?.express_orders_enabled === "boolean") setExpressOrdersEnabled(row.express_orders_enabled);
        }
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "customers" }, scheduleSync)
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, scheduleSync)
      .on("postgres_changes", { event: "*", schema: "public", table: "job_comments" }, scheduleSync)
      .on("postgres_changes", { event: "*", schema: "public", table: "job_status_history" }, scheduleSync)
      .subscribe();
    return () => {
      if (syncTimer) clearTimeout(syncTimer);
      void client.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser.id]);

  // ปิด notification panel เมื่อคลิกนอกกล่อง
  useEffect(() => {
    if (!showNotifPanel) return;
    function handleClickOutside(event: MouseEvent) {
      if (notifPanelRef.current && !notifPanelRef.current.contains(event.target as Node)) {
        setShowNotifPanel(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showNotifPanel]);

  // ปิด express panel เมื่อคลิกนอกกล่อง
  useEffect(() => {
    if (!showExpressPanel) return;
    function handleClickOutside(event: MouseEvent) {
      if (expressPanelRef.current && !expressPanelRef.current.contains(event.target as Node)) {
        setShowExpressPanel(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showExpressPanel]);

  // เตือนงานของตัวเองที่ใกล้ถึงกำหนดส่ง (ภายใน 2 วัน หรือเลยกำหนด) วันละครั้งต่อหนึ่งงาน
  useEffect(() => {
    const stampKey = `k2-due-notified-${currentUser.id}`;
    let notified: string[] = [];
    try { notified = JSON.parse(window.localStorage.getItem(stampKey) ?? "[]"); } catch {}
    const today = todayISO();
    const fresh: string[] = [];
    jobs.forEach((job) => {
      if (job.assignedDesigner !== currentUser.name && job.assignedProduction !== currentUser.name) return;
      const urgency = dueUrgency(job.dueDate, job.status);
      if (!urgency || urgency.days > 2) return;
      const key = `${job.id}|${job.dueDate}|${today}`;
      if (notified.includes(key)) return;
      fresh.push(key);
      const detail = urgency.days < 0
        ? `เลยกำหนดส่ง ${Math.abs(urgency.days)} วันแล้ว`
        : urgency.days === 0
          ? "ครบกำหนดส่งวันนี้"
          : `อีก ${urgency.days} วันถึงกำหนดส่ง`;
      notifyDueSoonSelf(job, `⏰ งาน ${job.id} – ${detail}`);
    });
    if (fresh.length) {
      try { window.localStorage.setItem(stampKey, JSON.stringify([...notified, ...fresh].slice(-200))); } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, currentUser.id, currentUser.name]);

  useEffect(() => {
    const saved = window.localStorage.getItem(facebookPagesStorageKey);
    if (!saved) return;
    try {
      const savedPages = normalizeFacebookPages(JSON.parse(saved));
      if (savedPages.length) {
        setCompanyProfile((current) => ({ ...current, facebookPages: savedPages }));
      }
    } catch {
      window.localStorage.removeItem(facebookPagesStorageKey);
    }
  }, []);

  useEffect(() => {
    if (!isAuthed || !supabase) return;
    void refreshWorkspaceData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed]);

  useEffect(() => {
    if (!isAuthed || navigationItems.some((item) => item.label === activeView)) return;
    setActiveView(navigationItems[0]?.label ?? "Dashboard");
  }, [activeView, isAuthed, navigationItems]);

  // ผูกการนำทางเข้ากับ browser history เพื่อให้ปุ่มย้อนกลับ (มือถือ) กลับ view เดิม ไม่หลุดออกจากแอป
  const historyPopRef = useRef(false);
  const historyInitRef = useRef(false);
  useEffect(() => {
    if (!isAuthed) return;
    if (historyPopRef.current) { historyPopRef.current = false; return; }
    const entry = { k2view: activeView, k2job: selectedJobId };
    if (!historyInitRef.current) {
      historyInitRef.current = true;
      window.history.replaceState(entry, "");
    } else {
      window.history.pushState(entry, "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, isAuthed]);
  useEffect(() => {
    function onPop(event: PopStateEvent) {
      const state = event.state as { k2view?: string; k2job?: string } | null;
      if (!state || typeof state.k2view !== "string") return;
      historyPopRef.current = true;
      if (state.k2job) setSelectedJobId(state.k2job);
      setActiveView(state.k2view);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (!isAuthed) return;
    if (activeView === "HR") {
      void loadHrRecords();
      void loadBranchSettings();
      void loadHolidays();
    }
    if (activeView === "Attendance") {
      void loadBranchSettings();
      void loadAttendance();
      void loadOvertime(payrollMonth);
    }
    if (activeView === "Leave") {
      void loadLeaves();
      void loadHolidays();
    }
    if (activeView === "Payroll") {
      void loadHrRecords();
      void loadOvertime(payrollMonth);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed, activeView]);

  useEffect(() => {
    if (isAuthed && activeView === "Payroll") void loadPayroll(payrollMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed, activeView, payrollMonth]);

  // โหลดสถานะลงเวลา + ตั้งค่าสาขา ตั้งแต่ login เพื่อให้ปุ่มลอยเช็คอิน/เช็คเอาท์ทำงานได้ทุกหน้า
  useEffect(() => {
    if (!isAuthed) return;
    void loadBranchSettings();
    void loadAttendance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed]);

  async function refreshWorkspaceData(options?: { silent?: boolean }) {
    if (!supabase) return;
    const silent = options?.silent ?? false;
    if (!silent) setDataLoading(true);
    setDataError("");
    try {
      const [
        profilesResult,
        companyResult,
        customersResult,
        jobsResult,
        commentsResult,
        historyResult,
        filesResult,
        auditResult,
        rolePermissionsResult,
        shopStateResult,
        notificationsResult
      ] = await Promise.all([
        supabase.from("profiles").select("id, email, full_name, role, extra_roles, avatar_url, phone, branch, is_active").eq("is_active", true).order("created_at", { ascending: true }),
        supabase.from("company_settings").select("*").order("created_at", { ascending: true }).limit(1),
        supabase.from("customers").select("*").order("created_at", { ascending: false }),
        supabase.from("jobs").select("*").order("created_at", { ascending: false }),
        supabase.from("job_comments").select("id, job_id, comment, created_at, author_id").order("created_at", { ascending: false }),
        supabase.from("job_status_history").select("id, job_id, from_status, to_status, created_at, changed_by").order("created_at", { ascending: true }),
        supabase.from("job_files").select("id, job_id, file_name, file_type, file_size, url").order("created_at", { ascending: true }),
        supabase.from("audit_log").select("id, action, target_table, target_id, metadata, created_at, actor_id").order("created_at", { ascending: false }).limit(80),
        supabase.from("role_permissions").select("role, permissions"),
        supabase.from("shop_state").select("express_orders_enabled").limit(1),
        supabase.from("notifications").select("*").eq("recipient_id", currentUser.id).order("created_at", { ascending: false }).limit(50)
      ]);

      const failures = [profilesResult, customersResult, jobsResult, commentsResult, historyResult, filesResult].filter((result) => result.error);
      if (failures[0]?.error) throw failures[0].error;

      const profileRows = (profilesResult.data ?? []) as SupabaseProfileRow[];
      const profileNames = new Map(profileRows.map((profile) => [profile.id, profile.full_name || "K2 User"]));
      const members = profileRows.map(profileToMember);
      if (members.length) setTeamMembers((current) => reuseIfSame(current, members));

      const companyRows = companyResult.error ? [] : (companyResult.data ?? []) as SupabaseCompanyRow[];
      if (companyRows[0]) {
        const savedFacebookPages = (() => {
          try {
            return normalizeFacebookPages(JSON.parse(window.localStorage.getItem(facebookPagesStorageKey) ?? "[]"));
          } catch {
            return [];
          }
        })();
        const nextCompany = { ...companyFromRow(companyRows[0]), ...(savedFacebookPages.length ? { facebookPages: savedFacebookPages } : {}) };
        setCompanyProfile((current) => reuseIfSame(current, nextCompany));
      }

      if (!rolePermissionsResult.error) {
        const savedPermissions = ((rolePermissionsResult.data ?? []) as SupabaseRolePermissionRow[]).reduce<Record<string, PermissionKey[]>>((acc, row) => {
          acc[row.role] = (row.permissions ?? []).filter((permission): permission is PermissionKey => allPermissionKeys.includes(permission as PermissionKey));
          return acc;
        }, {});
        setPermissionMatrix({ ...defaultRolePermissions, ...savedPermissions });
      }

      const jobRows = (jobsResult.data ?? []) as SupabaseJobRow[];
      const customerRows = (customersResult.data ?? []) as SupabaseCustomerRow[];
      const nextJobs = jobRows.map((row) =>
        jobFromRow(
          row,
          profileNames,
          (commentsResult.data ?? []) as Array<{ id: string; job_id: string; comment: string; created_at: string; author_id: string | null }>,
          (historyResult.data ?? []) as Array<{ id: string; job_id: string; from_status: JobStatus | null; to_status: JobStatus; created_at: string; changed_by: string | null }>,
          (filesResult.data ?? []) as Array<{ id: string; job_id: string; file_name: string; file_type: string; file_size: number | null; url?: string | null }>
        )
      );
      setJobs((current) => reuseIfSame(current, nextJobs));
      const nextCustomers = customerRows.map((row) => customerFromRow(row, jobRows));
      setCustomerRecords((current) => reuseIfSame(current, nextCustomers));
      const nextAudit = auditResult.error ? [] : ((auditResult.data ?? []) as Parameters<typeof auditFromRow>[0][]).map((row) => auditFromRow(row, profileNames));
      setAuditLog((current) => reuseIfSame(current, nextAudit));

      if (!shopStateResult.error && shopStateResult.data?.[0]) {
        setExpressOrdersEnabled(Boolean((shopStateResult.data[0] as { express_orders_enabled?: boolean }).express_orders_enabled));
      }
      if (!notificationsResult.error) {
        const nextNotifs = ((notificationsResult.data ?? []) as SupabaseNotificationRow[]).map(notifFromRow);
        setNotifications((current) => reuseIfSame(current, nextNotifs));
      }
      void reloadExpressRequests();
      void reloadQuotations();
      void reloadLeads();
      // คงงานที่กำลังเปิดดูไว้ ไม่ดีดออกเวลามีข้อมูลซิงก์เข้ามา
      setSelectedJobId((current) => (current && nextJobs.some((job) => job.id === current) ? current : nextJobs[0]?.id ?? ""));
    } catch (error) {
      setDataError(errorMessage(error, "โหลดข้อมูลจาก Supabase ไม่สำเร็จ"));
    } finally {
      if (!silent) setDataLoading(false);
    }
  }

  // เจ้าของ/คนไม่มีสาขาประจำ → เห็นทุกสาขา; คนมีสาขา → เห็นเฉพาะงานสาขาตัวเอง + งานที่ยังไม่ระบุสาขา
  const branchScopedJobs = useMemo(() => {
    const byBranch = (currentUser.role === "Owner" || !currentUser.branch)
      ? jobs
      : jobs.filter((job) => !job.productionBranch || job.productionBranch === currentUser.branch);
    // ฝ่ายผลิต (ดีไซเนอร์/ผลิต/แพ็ก) เห็นเฉพาะงานที่ยืนยันมัดจำแล้ว
    // งานเก่าที่ไม่มีสลิป (ก่อนมีระบบนี้) ไม่ถูกกั้น เพื่อไม่ให้งานเดิมหายจากคิว
    const depositOk = (job: Job) => job.depositConfirmed || (!job.depositSlip && !job.depositWaived);
    const unassigned = (name?: string) => !name || name === "Unassigned";
    // ดีไซเนอร์: เห็นเฉพาะงานที่ "มอบหมายให้ตัวเอง" เท่านั้น (ผู้จัดการมอบหมายให้แล้ว อีกคนจะไม่เห็น)
    if (currentUser.role === "Designer") {
      return byBranch.filter((job) => depositOk(job) && job.assignedDesigner === currentUser.name);
    }
    // ฝ่ายผลิต: เห็นเฉพาะงานที่มอบหมายให้ตัวเอง หรือยังไม่ได้มอบหมาย (กันงานหลุดถ้ายังไม่ระบุคน)
    if (currentUser.role === "Production Staff") {
      return byBranch.filter((job) => depositOk(job) && (job.assignedProduction === currentUser.name || unassigned(job.assignedProduction)));
    }
    // ฝ่ายแพ็ก: เห็นงานทั้งสาขา (ไม่มีการมอบหมายรายคน)
    if (currentUser.role === "Packing Staff") {
      return byBranch.filter(depositOk);
    }
    return byBranch;
  }, [jobs, currentUser.role, currentUser.branch, currentUser.name]);

  const filteredJobs = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return branchScopedJobs;
    return branchScopedJobs.filter((job) =>
      [job.id, job.customerName, job.title, job.type, job.status, job.assignedDesigner, job.assignedProduction]
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    );
  }, [branchScopedJobs, query]);

  const metrics = useMemo(() => {
    const monthKey = todayISO().slice(0, 7);
    const thisMonthCompleted = jobs.filter((job) => job.status === "Completed" && job.dueDate.startsWith(monthKey)).length;
    return [
      { label: "งานที่ยังเปิดอยู่", value: activeJobs.length, icon: ClipboardList, tone: "bg-k2-sky" },
      { label: "งานครบกำหนดวันนี้", value: jobs.filter((job) => daysFromToday(job.dueDate) === 0).length, icon: CalendarDays, tone: "bg-k2-mint" },
      { label: "งานเลยกำหนด", value: activeJobs.filter((job) => daysFromToday(job.dueDate) < 0).length, icon: AlertTriangle, tone: "bg-k2-rose" },
      { label: "กำลังผลิต", value: jobs.filter((job) => job.status === "In Production").length, icon: Factory, tone: "bg-k2-lilac" },
      {
        label: "รอลูกค้าอนุมัติ",
        value: jobs.filter((job) => job.status === "Waiting for Customer Approval").length,
        icon: Clock3,
        tone: "bg-k2-peach"
      },
      {
        label: "ยอดค้างชำระ",
        value: money.format(jobs.reduce((sum, job) => sum + job.remainingBalance, 0)),
        icon: WalletCards,
        tone: "bg-white"
      },
      { label: "งานเสร็จเดือนนี้", value: thisMonthCompleted, icon: CheckCircle2, tone: "bg-emerald-100" }
    ];
  }, [jobs, activeJobs]);

  async function appendAudit(action: string, target: string, targetTable = "jobs", targetId?: string | null) {
    setAuditLog((events) => [
      { id: crypto.randomUUID(), actor: currentUser.name, action, target, at: new Date().toLocaleString("en-GB") },
      ...events
    ]);
    if (!supabase || !isSupabaseConfigured || !uuidPattern.test(currentUser.id)) return;
    await supabase.from("audit_log").insert({
      actor_id: currentUser.id,
      action,
      target_table: targetTable,
      target_id: targetId && uuidPattern.test(targetId) ? targetId : null,
      metadata: { target }
    });
  }

  async function submitSupabaseAuth() {
    if (!supabase) return;
    setAuthError("");
    setAuthLoading(true);
    try {
      const { authEmail, username } = resolveLoginIdentity(authForm.username);
      if (authMode === "signUp") {
        const { data, error } = await supabase.auth.signUp({
          email: authEmail,
          password: authForm.password,
          options: {
            data: {
              full_name: authForm.fullName,
              role: authForm.role,
              username
            }
          }
        });
        if (error) throw error;
        if (data.user && data.session) {
          const member = profileToMember({ id: data.user.id, email: authEmail, username, full_name: authForm.fullName, role: authForm.role });
          setCurrentUser(member);
          setTeamMembers((current) => [member, ...current]);
          setIsAuthed(true);
        } else {
          setAuthError("สร้างผู้ใช้แล้ว หากระบบเปิดยืนยันอีเมล กรุณาปิด Confirm email ใน Supabase Auth Settings สำหรับการใช้ username ภายใน");
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authForm.password
        });
        if (error) throw error;
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id, email, full_name, role, extra_roles, avatar_url, phone, branch")
          .eq("id", data.user.id)
          .single();
        if (profileError) throw profileError;
        const member = profileToMember(profile as SupabaseProfileRow);
        setCurrentUser(member);
        setTeamMembers((current) => (current.some((item) => item.id === member.id) ? current.map((item) => (item.id === member.id ? member : item)) : [member, ...current]));
        setIsAuthed(true);
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setAuthLoading(false);
    }
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    setIsAuthed(false);
    setActiveView("Dashboard");
  }

  // เพิ่มแจ้งเตือนลง state ปัจจุบัน (ใช้ในโหมด mock และ due_soon ของตัวเอง)
  function pushLocalNotif(type: AppNotification["type"], job: Pick<Job, "id" | "title">, message: string) {
    setNotifications((current) => [
      {
        id: crypto.randomUUID(),
        type,
        jobId: job.id,
        jobTitle: job.title,
        message,
        at: new Date().toLocaleString("th-TH", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
        read: false
      },
      ...current
    ].slice(0, 50));
  }

  // แจ้งเตือนผู้รับผิดชอบงาน (ออกแบบ/ผลิต) ยกเว้นตัวผู้กระทำเอง
  // โหมด Supabase: insert ลงตาราง notifications -> Realtime ส่งถึงเครื่องผู้รับ
  // โหมด mock: ถ้าผู้รับคือ user ปัจจุบัน ค่อยเด้งในเครื่อง (เดโมเครื่องเดียว)
  function notifyAssignees(
    type: AppNotification["type"],
    job: Pick<Job, "id" | "title" | "dbId" | "assignedDesigner" | "assignedProduction">,
    message: string
  ) {
    const recipients = Array.from(new Set([job.assignedDesigner, job.assignedProduction])).filter(
      (name): name is string => Boolean(name) && name !== "Unassigned"
    );
    if (supabase && isSupabaseConfigured) {
      const rows = recipients
        .filter((name) => name !== currentUser.name)
        .map((name) => teamMembers.find((member) => member.name === name)?.id)
        .filter((id): id is string => typeof id === "string" && uuidPattern.test(id))
        .map((recipientId) => ({
          recipient_id: recipientId,
          type,
          job_id: job.dbId ?? null,
          job_number: job.id,
          job_title: job.title,
          message
        }));
      if (rows.length) void supabase.from("notifications").insert(rows);
    } else if (recipients.includes(currentUser.name)) {
      pushLocalNotif(type, job, message);
    }
  }

  // แจ้งเตือนพนักงานรายคน (ใช้ตอนมอบหมายงานให้คนใดคนหนึ่ง) — เด้งผ่าน Realtime ในแอปของคนนั้น
  function notifyUser(name: string, type: AppNotification["type"], job: Pick<Job, "id" | "title" | "dbId">, message: string) {
    if (!name || name === "Unassigned" || name === currentUser.name) return;
    if (supabase && isSupabaseConfigured) {
      const recipientId = teamMembers.find((member) => member.name === name)?.id;
      if (recipientId && uuidPattern.test(recipientId)) {
        void supabase.from("notifications").insert({
          recipient_id: recipientId,
          type,
          job_id: job.dbId ?? null,
          job_number: job.id,
          job_title: job.title,
          message
        });
      }
    }
  }

  // แจ้งเตือนพนักงานเป็นกลุ่มตามสาขา (เด้งหาผจก.สาขา หรือฝ่ายผลิตทั้งสาขา)
  function notifyBranchStaff(branch: string, roleMatch: (member: TeamMember) => boolean, type: AppNotification["type"], job: Pick<Job, "id" | "title" | "dbId">, message: string) {
    if (!supabase || !isSupabaseConfigured) return;
    const rows = teamMembers
      .filter((member) => member.id !== currentUser.id && roleMatch(member) && (!branch || member.branch === branch) && uuidPattern.test(member.id))
      .map((member) => ({ recipient_id: member.id, type, job_id: job.dbId ?? null, job_number: job.id, job_title: job.title, message }));
    if (rows.length) void supabase.from("notifications").insert(rows);
  }

  // มอบหมาย/เปลี่ยนผู้รับผิดชอบ (ออกแบบ/ผลิต) ของงานที่เปิดแล้ว + แจ้งเตือนคนที่ถูกมอบใหม่
  async function assignStaff(jobId: string, designer: string, production: string) {
    if (!can("assign_staff")) {
      setDataError("บทบาทนี้ยังไม่มีสิทธิ์มอบหมายงาน");
      return;
    }
    const existing = jobs.find((job) => job.id === jobId);
    if (!existing) return;
    // มอบหมายได้เฉพาะผู้จัดการ/แอดมินของสาขาที่ผลิต (เจ้าของทำได้ทุกสาขา) — ตรงกับกติกาอนุมัติรับงาน
    if (!canAcceptJob(existing)) {
      setDataError("เฉพาะผู้จัดการของสาขาที่ผลิต (หรือเจ้าของ) เท่านั้นที่มอบหมายงานได้");
      return;
    }
    if (supabase && existing.dbId && uuidPattern.test(existing.dbId)) {
      const { error } = await supabase
        .from("jobs")
        .update({
          assigned_designer: teamIdByName(teamMembers, designer),
          assigned_production: teamIdByName(teamMembers, production)
        })
        .eq("id", existing.dbId);
      if (error) {
        setDataError(error.message);
        return;
      }
    }
    setJobs((current) => current.map((job) => (job.id === jobId ? { ...job, assignedDesigner: designer, assignedProduction: production } : job)));
    const updated = { ...existing, assignedDesigner: designer, assignedProduction: production };
    if (designer !== existing.assignedDesigner) notifyUser(designer, "assigned", updated, `ได้รับมอบหมายงาน ${existing.id} – ${existing.title} (ออกแบบ)`);
    if (production !== existing.assignedProduction) notifyUser(production, "assigned", updated, `ได้รับมอบหมายงาน ${existing.id} – ${existing.title} (ผลิต)`);
    void appendAudit("assigned staff", existing.id, "jobs", existing.dbId);
  }

  // แจ้งเตือนตัวเอง (งานใกล้ถึงกำหนด) — โหมด Supabase insert ถึงตัวเอง แล้ว Realtime ส่งกลับ
  function notifyDueSoonSelf(job: Pick<Job, "id" | "title" | "dbId">, message: string) {
    if (supabase && isSupabaseConfigured && uuidPattern.test(currentUser.id)) {
      void supabase.from("notifications").insert({
        recipient_id: currentUser.id,
        type: "due_soon",
        job_id: job.dbId ?? null,
        job_number: job.id,
        job_title: job.title,
        message
      });
    } else {
      pushLocalNotif("due_soon", job, message);
    }
  }

  function markAllNotifsRead() {
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
    if (supabase && isSupabaseConfigured && uuidPattern.test(currentUser.id)) {
      void supabase.from("notifications").update({ is_read: true }).eq("recipient_id", currentUser.id).eq("is_read", false);
    }
  }

  function clearAllNotifs() {
    setNotifications([]);
    if (supabase && isSupabaseConfigured && uuidPattern.test(currentUser.id)) {
      void supabase.from("notifications").delete().eq("recipient_id", currentUser.id);
    }
  }

  // ขอย้ายสถานะ -> เปิด popup ยืนยันก่อนเสมอ (กันลากผิด/กดพลาด โดยเฉพาะย้ายถอยหลัง)
  function requestMove(jobId: string, nextStatus: JobStatus) {
    if (!can("move_status")) {
      setDataError("บทบาทนี้ยังไม่มีสิทธิ์ย้ายสถานะงาน");
      return;
    }
    const job = jobs.find((item) => item.id === jobId);
    if (!job || job.status === nextStatus) return;
    if (job.acceptance === "pending") {
      setDataError("งานนี้รอผู้จัดการสาขายอมรับก่อน จึงจะย้ายสถานะได้");
      return;
    }
    // ด่านส่ง–รับงาน: งานที่รอตรวจรับอยู่ ห้ามย้ายตรงๆ ต้องให้ผู้ตรวจรับ/ตีกลับก่อน
    if (job.handoffStatus === "pending") {
      setDataError("งานนี้กำลังรอตรวจรับ — ให้ผู้ตรวจกดรับหรือตีกลับก่อน");
      return;
    }
    const sendGate = gateFromStatus(job.status);
    if (sendGate && nextStatus === sendGate.approveStatus) {
      setDataError(`ต้องส่งตรวจผ่านปุ่ม "${sendGate.label}" ก่อน (กันงานข้ามขั้น)`);
      return;
    }
    // ด่านการเงิน 1: ยืนยันมัดจำ ทำได้โดยฝ่ายการเงิน หรือ เจ้าของ/ผู้จัดการ/แอดมิน
    if (nextStatus === "Deposit Confirmed" && !can("manage_finance") && !["Owner", "Manager", "Admin"].includes(currentUser.role)) {
      setDataError("เฉพาะฝ่ายการเงิน/เจ้าของ/ผู้จัดการ/แอดมินเท่านั้นที่ยืนยันมัดจำได้");
      return;
    }
    // ด่านการเงิน 2: ห้ามข้ามเข้าขั้นผลิต จนกว่าฝ่ายการเงินจะยืนยันมัดจำ (สถานะต้องถึง "มัดจำแล้ว" ก่อน)
    const movingIntoProduction = !FINANCE_PHASE.includes(nextStatus) && nextStatus !== "Cancelled";
    if (movingIntoProduction && FINANCE_PHASE.includes(job.status) && job.status !== "Deposit Confirmed") {
      setDataError("ต้องผ่านการยืนยันมัดจำจากฝ่ายการเงินก่อน จึงจะเข้าสู่ขั้นผลิตได้");
      return;
    }
    setPendingMove({ jobId, from: job.status, to: nextStatus });
  }

  // ยอมรับงานได้: เจ้าของ (ทุกสาขา) หรือ ผจก./แอดมิน เฉพาะงานที่ผลิตที่สาขาตัวเองเท่านั้น (ต้องตรงเป๊ะ)
  // ไม่มี fallback "งานไม่มีสาขา = เห็นทุกคน" อีก เพื่อกันงานสาขาอื่น (เช่น DTG พระรามเก้า) เด้งให้ผจก.พะเยา
  function canAcceptJob(job: Job) {
    if (currentUser.role === "Owner") return true;
    if (currentUser.role === "Manager" || currentUser.role === "Admin") {
      return !!currentUser.branch && job.productionBranch === currentUser.branch;
    }
    return false;
  }

  async function acceptJob(jobId: string) {
    const job = jobs.find((item) => item.id === jobId);
    if (!job) return;
    if (!canAcceptJob(job)) {
      setDataError("เฉพาะผู้จัดการสาขานั้นหรือเจ้าของเท่านั้นที่ยอมรับงานได้");
      return;
    }
    setJobs((current) => current.map((item) => (item.id === jobId ? { ...item, acceptance: "accepted", rejectReason: "" } : item)));
    if (supabase && job.dbId) {
      const { error } = await supabase.from("jobs").update({ acceptance: "accepted", reject_reason: null }).eq("id", job.dbId);
      if (error) {
        setDataError(error.message);
        void refreshWorkspaceData();
        return;
      }
    }
    void appendAudit("accepted job", job.id, "jobs", job.dbId ?? null);
    // เด้ง LINE กลุ่มกลางแบบเรียลไทม์ ว่าผู้จัดการอนุมัติงานนี้แล้ว
    if (supabase && job.dbId) {
      try {
        await supabase.functions.invoke("notify-new-order", { body: { job_id: job.dbId, event: "approved", by: currentUser.name } });
      } catch {
        /* แจ้ง LINE ล้มเหลว ไม่ให้กระทบการอนุมัติ */
      }
    }
  }

  async function rejectJob(jobId: string, reason: string) {
    const job = jobs.find((item) => item.id === jobId);
    if (!job) return;
    if (!canAcceptJob(job)) {
      setDataError("เฉพาะผู้จัดการสาขานั้นหรือเจ้าของเท่านั้นที่ปฏิเสธงานได้");
      return;
    }
    const cleanReason = reason.trim() || "ไม่ระบุเหตุผล";
    setJobs((current) => current.map((item) => (item.id === jobId ? { ...item, acceptance: "rejected", rejectReason: cleanReason } : item)));
    if (supabase && job.dbId) {
      const { error } = await supabase.from("jobs").update({ acceptance: "rejected", reject_reason: cleanReason }).eq("id", job.dbId);
      if (error) {
        setDataError(error.message);
        void refreshWorkspaceData();
        return;
      }
    }
    void appendAudit("rejected job", job.id, "jobs", job.dbId ?? null);
  }

  // ===== ด่านส่ง–รับงาน (handoff) =====
  async function submitHandoff(jobId: string) {
    const job = jobs.find((item) => item.id === jobId);
    if (!job) return;
    const gate = gateFromStatus(job.status);
    if (!gate) {
      setDataError("ขั้นตอนนี้ยังไม่มีด่านส่งงาน");
      return;
    }
    if (job.handoffStatus === "pending") {
      setDataError("งานนี้ส่งตรวจไปแล้ว");
      return;
    }
    if (currentUser.role !== "Owner" && !userHasAnyRole(currentUser, gate.senderRoles)) {
      setDataError("คุณไม่มีสิทธิ์ส่งงานในขั้นตอนนี้");
      return;
    }
    setJobs((current) => current.map((item) => (item.id === jobId ? { ...item, handoffStatus: "pending", handoffGate: gate.id, handoffFromUser: currentUser.id, handoffFromStatus: job.status, handoffNote: undefined, status: gate.reviewStatus } : item)));
    if (supabase && job.dbId) {
      const { error } = await supabase.from("jobs").update({ status: gate.reviewStatus, handoff_status: "pending", handoff_gate: gate.id, handoff_from_user: uuidPattern.test(currentUser.id) ? currentUser.id : null, handoff_from_status: job.status, handoff_note: null }).eq("id", job.dbId);
      if (error) {
        setDataError(error.message);
        void refreshWorkspaceData();
        return;
      }
    }
    void appendAudit(`submitted handoff ${gate.id}`, job.id, "jobs", job.dbId ?? null);
    notifyAssignees("status_moved", job, `งาน ${job.id} ส่งตรวจ "${gate.label}" แล้ว`);
  }

  async function acceptHandoff(jobId: string) {
    const job = jobs.find((item) => item.id === jobId);
    if (!job || job.handoffStatus !== "pending") return;
    const gate = gateById(job.handoffGate);
    if (!gate) return;
    const allowedReviewer = currentUser.role === "Owner" || (gate.branchManager
      ? userHasRole(currentUser, "Manager") && currentUser.branch === job.productionBranch
      : userHasAnyRole(currentUser, gate.reviewerRoles));
    if (!allowedReviewer) {
      setDataError(gate.branchManager ? "ต้องเป็นผู้จัดการของสาขาที่ผลิตเท่านั้น" : "คุณไม่มีสิทธิ์ตรวจรับงานในขั้นตอนนี้");
      return;
    }
    if (currentUser.role !== "Owner" && job.handoffFromUser && job.handoffFromUser === currentUser.id) {
      setDataError("ผู้ส่งกับผู้รับต้องเป็นคนละคน (กฎกันพลาด)");
      return;
    }
    const nextGate = gate.nextGate ? gateById(gate.nextGate) : undefined;
    if (nextGate) {
      // อนุมัติด่านนี้แล้วส่งต่อด่านถัดไปอัตโนมัติ (เช่น เซลยืนยัน → รอผจก.สาขาอนุมัติ)
      setJobs((current) => current.map((item) => (item.id === jobId ? { ...item, handoffStatus: "pending", handoffGate: nextGate.id, handoffFromUser: currentUser.id, handoffFromStatus: job.status, handoffNote: undefined, status: gate.approveStatus } : item)));
      if (supabase && job.dbId) {
        const { error } = await supabase.from("jobs").update({ status: gate.approveStatus, handoff_status: "pending", handoff_gate: nextGate.id, handoff_from_user: uuidPattern.test(currentUser.id) ? currentUser.id : null, handoff_from_status: job.status, handoff_note: null }).eq("id", job.dbId);
        if (error) {
          setDataError(error.message);
          void refreshWorkspaceData();
          return;
        }
      }
      void appendAudit(`accepted handoff ${gate.id}`, job.id, "jobs", job.dbId ?? null);
      if (nextGate.branchManager) {
        notifyBranchStaff(job.productionBranch ?? "", (member) => userHasRole(member, "Manager"), "assigned", job, `งาน ${job.id} รออนุมัติเข้าผลิต · สาขา ${job.productionBranch || "-"}`);
      }
      return;
    }
    // ด่านสุดท้าย: อนุมัติเข้าผลิต → เด้งหาฝ่ายผลิตทุกคนในสาขานั้น
    setJobs((current) => current.map((item) => (item.id === jobId ? { ...item, handoffStatus: undefined, handoffGate: undefined, handoffFromUser: undefined, handoffFromStatus: undefined, handoffNote: undefined, status: gate.approveStatus } : item)));
    if (supabase && job.dbId) {
      const { error } = await supabase.from("jobs").update({ status: gate.approveStatus, handoff_status: null, handoff_gate: null, handoff_from_user: null, handoff_from_status: null, handoff_note: null }).eq("id", job.dbId);
      if (error) {
        setDataError(error.message);
        void refreshWorkspaceData();
        return;
      }
    }
    void appendAudit(`accepted handoff ${gate.id}`, job.id, "jobs", job.dbId ?? null);
    notifyBranchStaff(job.productionBranch ?? "", (member) => userHasRole(member, "Production Staff"), "assigned", job, `งานเข้าผลิต: ${job.id} – ${job.title} · สาขา ${job.productionBranch || "-"}`);
  }

  async function rejectHandoff(jobId: string, reason: string) {
    const job = jobs.find((item) => item.id === jobId);
    if (!job || job.handoffStatus !== "pending") return;
    const gate = gateById(job.handoffGate);
    if (!gate) return;
    const allowedReviewer = currentUser.role === "Owner" || (gate.branchManager
      ? userHasRole(currentUser, "Manager") && currentUser.branch === job.productionBranch
      : userHasAnyRole(currentUser, gate.reviewerRoles));
    if (!allowedReviewer) {
      setDataError(gate.branchManager ? "ต้องเป็นผู้จัดการของสาขาที่ผลิตเท่านั้น" : "คุณไม่มีสิทธิ์ตรวจรับงานในขั้นตอนนี้");
      return;
    }
    if (currentUser.role !== "Owner" && job.handoffFromUser && job.handoffFromUser === currentUser.id) {
      setDataError("ผู้ส่งกับผู้รับต้องเป็นคนละคน (กฎกันพลาด)");
      return;
    }
    const cleanReason = reason.trim() || "ไม่ระบุเหตุผล";
    const bounceTo = job.handoffFromStatus ?? gate.rejectStatus;
    setJobs((current) => current.map((item) => (item.id === jobId ? { ...item, handoffStatus: undefined, handoffGate: undefined, handoffFromUser: undefined, handoffFromStatus: undefined, handoffNote: cleanReason, status: bounceTo } : item)));
    if (supabase && job.dbId) {
      const { error } = await supabase.from("jobs").update({ status: bounceTo, handoff_status: null, handoff_gate: null, handoff_from_user: null, handoff_from_status: null, handoff_note: cleanReason }).eq("id", job.dbId);
      if (error) {
        setDataError(error.message);
        void refreshWorkspaceData();
        return;
      }
    }
    void appendAudit(`rejected handoff ${gate.id}`, job.id, "jobs", job.dbId ?? null);
    notifyAssignees("status_moved", job, `งาน ${job.id} ถูกตีกลับ: ${cleanReason}`);
  }

  async function moveJob(jobId: string, nextStatus: JobStatus) {
    if (!can("move_status")) {
      setDataError("บทบาทนี้ยังไม่มีสิทธิ์ย้ายสถานะงาน");
      return;
    }
    const existingJob = jobs.find((job) => job.id === jobId);
    if (!existingJob || existingJob.status === nextStatus) return;
    setJobs((current) =>
      current.map((job) => {
        if (job.id !== jobId || job.status === nextStatus) return job;
        return {
          ...job,
          status: nextStatus,
          statusHistory: [
            ...job.statusHistory,
            {
              id: crypto.randomUUID(),
              from: job.status,
              to: nextStatus,
              by: currentUser.name,
              at: new Date().toLocaleString("en-GB")
            }
          ]
        };
      })
    );
    if (supabase && existingJob.dbId && uuidPattern.test(currentUser.id)) {
      const { error } = await supabase.from("jobs").update({ status: nextStatus }).eq("id", existingJob.dbId);
      if (error) {
        setDataError(error.message);
        void refreshWorkspaceData();
        return;
      }
      await supabase.from("job_status_history").insert({
        job_id: existingJob.dbId,
        from_status: existingJob.status,
        to_status: nextStatus,
        changed_by: currentUser.id
      });
    }
    void appendAudit(`moved status to ${nextStatus}`, jobId, "jobs", existingJob.dbId);
    notifyAssignees("status_moved", existingJob, `งาน ${existingJob.id} ย้ายไป "${statusLabel[nextStatus]}" แล้ว`);
  }

  async function updatePayment(jobId: string, deposit: number) {
    if (!can("edit_payment")) {
      setDataError("บทบาทนี้ยังไม่มีสิทธิ์แก้ไขการชำระเงิน");
      return;
    }
    const existingJob = jobs.find((job) => job.id === jobId);
    if (!existingJob) return;
    setJobs((current) =>
      current.map((job) => {
        if (job.id !== jobId) return job;
        const safeDeposit = Math.max(0, Math.min(job.price, deposit));
        return {
          ...job,
          deposit: safeDeposit,
          remainingBalance: job.price - safeDeposit,
          paymentStatus: getPaymentStatus(job.price, safeDeposit)
        };
      })
    );
    const safeDeposit = Math.max(0, Math.min(existingJob.price, deposit));
    if (supabase && existingJob.dbId) {
      const { error } = await supabase.from("jobs").update({ deposit: safeDeposit }).eq("id", existingJob.dbId);
      if (error) {
        setDataError(error.message);
        void refreshWorkspaceData();
        return;
      }
    }
    void appendAudit("updated payment", jobId, "jobs", existingJob.dbId);
  }

  // ผู้จัดการ/แอดมิน ยืนยันยอดมัดจำ → ปลดล็อกให้งานเข้าคิวผลิต
  // เคสยกเว้นมัดจำ (deposit_waived) ต้องเป็น "เจ้าของ" เท่านั้นที่อนุมัติได้
  async function confirmDeposit(jobId: string) {
    const existingJob = jobs.find((job) => job.id === jobId);
    if (!existingJob) return;
    if (existingJob.depositWaived) {
      if (currentUser.role !== "Owner") {
        setDataError("เฉพาะเจ้าของเท่านั้นที่อนุมัติยกเว้นมัดจำได้");
        return;
      }
    } else if (!can("manage_finance") && !["Owner", "Manager", "Admin"].includes(currentUser.role)) {
      setDataError("เฉพาะฝ่ายการเงิน/เจ้าของ/ผู้จัดการ/แอดมินเท่านั้นที่ยืนยันยอดมัดจำได้");
      return;
    }
    setJobs((current) => current.map((job) => (job.id === jobId ? { ...job, depositConfirmed: true, depositConfirmedBy: currentUser.name } : job)));
    if (supabase && existingJob.dbId) {
      const { error } = await supabase
        .from("jobs")
        .update({ deposit_confirmed: true, deposit_confirmed_by: uuidPattern.test(currentUser.id) ? currentUser.id : null, deposit_confirmed_at: new Date().toISOString() })
        .eq("id", existingJob.dbId);
      if (error) {
        setDataError(error.message);
        void refreshWorkspaceData();
        return;
      }
    }
    void appendAudit("confirmed deposit", jobId, "jobs", existingJob.dbId);
  }

  // รับเงินส่วนที่เหลือ (ยอดคงเหลือ) + แนบสลิป → ตั้งยอดเป็นชำระครบ
  async function receiveBalance(jobId: string, slip: string, receivedDate: string) {
    if (!can("edit_payment")) {
      setDataError("บทบาทนี้ยังไม่มีสิทธิ์รับชำระเงิน");
      return;
    }
    const existingJob = jobs.find((job) => job.id === jobId);
    if (!existingJob) return;
    setJobs((current) => current.map((job) => (job.id === jobId
      ? { ...job, deposit: job.price, remainingBalance: 0, paymentStatus: getPaymentStatus(job.price, job.price), balanceSlip: slip || undefined, balanceReceivedDate: receivedDate || undefined }
      : job)));
    if (supabase && existingJob.dbId) {
      const { error } = await supabase
        .from("jobs")
        .update({ deposit: existingJob.price, balance_slip: slip || null, balance_received_date: receivedDate || null })
        .eq("id", existingJob.dbId);
      if (error) { setDataError(error.message); void refreshWorkspaceData(); return; }
    }
    void appendAudit("received balance payment", jobId, "jobs", existingJob.dbId);
  }

  // แก้ไขข้อมูลงาน (เมื่อกรอกผิด / อัปเดตก่อนอนุมัติเข้าผลิต) — ราคา/มัดจำแก้ผ่านส่วนการเงิน
  async function updateJob(jobId: string, fields: { title: string; type: JobType; description: string; quantity: number; dueDate: string; priority: Priority; internalNotes: string }) {
    if (!can("edit_job")) {
      setDataError("บทบาทนี้ยังไม่มีสิทธิ์แก้ไขงาน");
      return;
    }
    const existing = jobs.find((job) => job.id === jobId);
    if (!existing) return;
    const lockedStatuses: JobStatus[] = ["Ready for Production", "In Production", "QC", "Packing", "Delivered / Picked Up", "Completed", "Cancelled"];
    if (lockedStatuses.includes(existing.status) && currentUser.role !== "Owner") {
      setDataError("งานนี้อนุมัติเข้าผลิตแล้ว — แก้ไขข้อมูลไม่ได้ (ให้เจ้าของแก้)");
      return;
    }
    if (supabase && existing.dbId && uuidPattern.test(existing.dbId)) {
      const { error } = await supabase.from("jobs").update({
        title: fields.title,
        type: fields.type,
        description: fields.description,
        quantity: fields.quantity,
        due_date: fields.dueDate,
        priority: fields.priority,
        internal_notes: fields.internalNotes
      }).eq("id", existing.dbId);
      if (error) {
        setDataError(error.message);
        return;
      }
    }
    setJobs((current) => current.map((job) => (job.id === jobId ? { ...job, ...fields } : job)));
    void appendAudit("updated job", jobId, "jobs", existing.dbId);
  }

  // แนบไฟล์เข้างาน (อัปโหลดจริงขึ้น Supabase Storage bucket "job-files") + ดู/ดาวน์โหลดในแอป
  async function uploadJobFile(job: Job, file: File) {
    if (!can("edit_job")) {
      setDataError("บทบาทนี้ยังไม่มีสิทธิ์แนบไฟล์");
      return;
    }
    if (!file) return;
    if (file.size > 10_000_000) {
      setDataError("ไฟล์ต้องไม่เกิน 10 MB");
      return;
    }
    const kind: FileAsset["type"] = file.type.includes("pdf") ? "pdf" : file.name.toLowerCase().endsWith(".zip") ? "zip" : file.name.toLowerCase().endsWith(".ai") ? "ai" : "image";
    const sizeText = `${Math.max(file.size / 1000000, 0.01).toFixed(2)} MB`;
    if (supabase && isSupabaseConfigured && job.dbId && uuidPattern.test(job.dbId)) {
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${job.dbId}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from("job-files").upload(path, file, { contentType: file.type || undefined });
      if (upErr) {
        setDataError(`อัปโหลดไฟล์ไม่สำเร็จ: ${upErr.message}`);
        return;
      }
      const { data: pub } = supabase.storage.from("job-files").getPublicUrl(path);
      const { data: row, error } = await supabase.from("job_files").insert({ job_id: job.dbId, file_name: file.name, file_type: file.type || "file", file_size: file.size, url: pub.publicUrl }).select("id").single();
      if (error) {
        setDataError(error.message);
        return;
      }
      const asset: FileAsset = { id: row.id as string, name: file.name, type: kind, size: sizeText, url: pub.publicUrl };
      setJobs((current) => current.map((item) => (item.id === job.id ? { ...item, files: [...item.files, asset] } : item)));
    } else {
      const dataUrl = await readImageAsDataUrl(file);
      const asset: FileAsset = { id: crypto.randomUUID(), name: file.name, type: kind, size: sizeText, url: dataUrl };
      setJobs((current) => current.map((item) => (item.id === job.id ? { ...item, files: [...item.files, asset] } : item)));
    }
    void appendAudit("attached file", `${job.id} · ${file.name}`, "jobs", job.dbId);
  }

  async function removeJobFile(job: Job, fileId: string) {
    if (!can("edit_job")) {
      setDataError("บทบาทนี้ยังไม่มีสิทธิ์ลบไฟล์");
      return;
    }
    if (supabase && isSupabaseConfigured && uuidPattern.test(fileId)) {
      const { error } = await supabase.from("job_files").delete().eq("id", fileId);
      if (error) {
        setDataError(error.message);
        return;
      }
    }
    setJobs((current) => current.map((item) => (item.id === job.id ? { ...item, files: item.files.filter((file) => file.id !== fileId) } : item)));
    void appendAudit("removed file", job.id, "jobs", job.dbId);
  }

  async function addComment(jobId: string, text: string) {
    if (!text.trim()) return;
    const existingJob = jobs.find((job) => job.id === jobId);
    if (!existingJob) return;
    setJobs((current) =>
      current.map((job) =>
        job.id === jobId
          ? {
              ...job,
              comments: [
                { id: crypto.randomUUID(), by: currentUser.name, at: new Date().toLocaleString("en-GB"), text },
                ...job.comments
              ]
            }
          : job
      )
    );
    if (supabase && existingJob.dbId && uuidPattern.test(currentUser.id)) {
      const { error } = await supabase.from("job_comments").insert({
        job_id: existingJob.dbId,
        author_id: currentUser.id,
        comment: text.trim()
      });
      if (error) {
        setDataError(error.message);
        void refreshWorkspaceData();
        return;
      }
    }
    void appendAudit("added comment", jobId, "jobs", existingJob.dbId);
    notifyAssignees("comment", existingJob, `${currentUser.name} คอมเมนต์ใน ${existingJob.id}: "${text.slice(0, 40)}${text.length > 40 ? "…" : ""}"`);
  }

  async function createJob(input?: Partial<Job>, attachments?: File[]) {
    if (!can("create_job")) {
      setDataError("บทบาทนี้ยังไม่มีสิทธิ์สร้างงาน");
      return;
    }
    const isNewCustomer = input?.customerId === "new";
    const fallbackCustomer: Customer = {
      id: "new",
      name: input?.customerName?.trim() || "ลูกค้าใหม่",
      phone: input?.phone ?? "",
      lineId: input?.lineId ?? "",
      email: input?.accountingEmail ?? "",
      companyName: input?.companyName ?? "",
      taxId: input?.taxId ?? "",
      branch: input?.branch ?? "สำนักงานใหญ่",
      billingAddress: input?.billingAddress ?? "",
      accountingEmail: input?.accountingEmail ?? "",
      requiresInvoice: input?.requiresInvoice ?? false,
      totalOrders: 0,
      lifetimeValue: 0,
      lastOrderDate: input?.orderDate ?? todayISO()
    };
    const existingCustomer = customerRecords.find((item) => item.id === input?.customerId) ?? customerRecords[0] ?? fallbackCustomer;
    const customer = isNewCustomer
      ? {
          id: `c-${crypto.randomUUID()}`,
          name: input?.customerName?.trim() || "ลูกค้าใหม่",
          phone: input?.phone ?? "",
          lineId: input?.lineId ?? "",
          email: input?.accountingEmail ?? "",
          companyName: input?.companyName ?? "",
          taxId: input?.taxId ?? "",
          branch: input?.branch ?? "",
          billingAddress: input?.billingAddress ?? "",
          accountingEmail: input?.accountingEmail ?? "",
          requiresInvoice: input?.requiresInvoice ?? false,
          totalOrders: 0,
          lifetimeValue: 0,
          lastOrderDate: input?.orderDate ?? todayISO()
        }
      : existingCustomer;
    const price = input?.price ?? 14400;
    const deposit = input?.deposit ?? 4000;
    // ทุกงานต้องให้ผู้จัดการสาขาอนุมัติก่อน — ยกเว้นคนสร้างเป็น "เจ้าของ" หรือ "ผู้จัดการของสาขาที่ผลิตเอง" (เป็นผู้อนุมัติอยู่แล้ว)
    const newJobBranch = input?.productionBranch ?? null;
    const creatorIsApprover =
      currentUser.role === "Owner" ||
      (currentUser.role === "Manager" && (!currentUser.branch || !newJobBranch || newJobBranch === currentUser.branch));
    const jobAcceptance: "pending" | "accepted" = creatorIsApprover ? "accepted" : "pending";
    const initialJobNumber = jobNumberFor(jobs);
    const initialQuoteNumber = quoteNumberFromValues(
      jobs.map((job) => job.quoteNumber ?? ""),
      companyProfile.quotePrefix
    );

    if (supabase && isSupabaseConfigured) {
      try {
        let customerId = customer.id;
        if (isNewCustomer || !uuidPattern.test(customerId)) {
          const { data: insertedCustomer, error: customerError } = await supabase
            .from("customers")
            .insert(customerInsertPayload({
              name: customer.name,
              phone: customer.phone,
              lineId: customer.lineId,
              email: customer.email,
              notes: customer.notes,
              companyName: customer.companyName,
              taxId: customer.taxId,
              branch: customer.branch,
              billingAddress: customer.billingAddress,
              accountingEmail: customer.accountingEmail,
              requiresInvoice: customer.requiresInvoice
            }))
            .select("id")
            .single();
          if (customerError) throw customerError;
          customerId = insertedCustomer.id;
        }

        const { data: existingNumbers, error: existingNumbersError } = await supabase
          .from("jobs")
          .select("job_number, quote_number");
        if (existingNumbersError) throw existingNumbersError;

        const existingJobNumbers = [
          ...jobs.map((job) => job.id),
          ...(existingNumbers ?? []).map((job) => job.job_number).filter(Boolean)
        ];
        const existingQuoteNumbers = [
          ...jobs.map((job) => job.quoteNumber ?? ""),
          ...(existingNumbers ?? []).map((job) => job.quote_number ?? "").filter(Boolean)
        ];

        let insertedJob: { id: string; job_number: string } | null = null;
        let insertedJobNumber = initialJobNumber;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          insertedJobNumber = jobNumberFromValues(existingJobNumbers, attempt);
          const insertedQuoteNumber = quoteNumberFromValues(existingQuoteNumbers, companyProfile.quotePrefix, attempt);
          const { data, error: jobError } = await supabase
            .from("jobs")
            .insert({
              job_number: insertedJobNumber,
              quote_number: insertedQuoteNumber,
              quote_status: "draft",
              customer_id: customerId,
              customer_name: input?.customerName ?? customer.name,
              customer_phone: input?.phone ?? customer.phone,
              customer_line_id: input?.lineId ?? customer.lineId,
              company_name: input?.companyName ?? customer.companyName,
              tax_id: input?.taxId ?? customer.taxId,
              branch: input?.branch ?? customer.branch,
              billing_address: input?.billingAddress ?? customer.billingAddress,
              accounting_email: input?.accountingEmail ?? customer.accountingEmail,
              requires_invoice: input?.requiresInvoice ?? customer.requiresInvoice ?? false,
              title: input?.title ?? "งานสินค้าใหม่",
              type: input?.type ?? "UV Print",
              description: input?.description ?? "ออเดอร์ใหม่จากฝ่ายขาย",
              quantity: input?.quantity ?? 1,
              order_date: input?.orderDate ?? todayISO(),
              due_date: input?.dueDate ?? todayISO(),
              priority: input?.priority ?? "Normal",
              is_express: input?.isExpress ?? false,
              deposit_slip: input?.depositSlip ?? null,
              deposit_received_date: input?.depositReceivedDate || null,
              deposit_waived: input?.depositWaived ?? false,
              production_branch: input?.productionBranch ?? null,
              income_branch: input?.incomeBranch || null,
              sales_page: input?.salesPage || null,
              acceptance: jobAcceptance,
              reject_reason: null,
              status: "Quotation",
              assigned_designer: teamIdByName(teamMembers, input?.assignedDesigner),
              assigned_production: teamIdByName(teamMembers, input?.assignedProduction),
              price,
              vat_mode: normalizeVatMode(input?.vatMode),
              deposit,
              internal_notes: input?.internalNotes ?? "",
              created_by: uuidPattern.test(currentUser.id) ? currentUser.id : null
            })
            .select("id, job_number")
            .single();
          if (!jobError) {
            insertedJob = data;
            break;
          }
          if (!isDuplicateKeyError(jobError)) throw jobError;
        }
        if (!insertedJob) throw new Error("เลขงานซ้ำ กรุณากดสร้างงานอีกครั้ง");
        if (insertedJob && uuidPattern.test(currentUser.id)) {
          await supabase.from("job_status_history").insert({
            job_id: insertedJob.id,
            from_status: null,
            to_status: "Quotation",
            changed_by: currentUser.id
          });
        }
        // อัปโหลดรูปแบบงานลูกค้าที่แนบตอนสร้าง → storage job-files + บันทึกลง job_files
        if (attachments?.length) {
          for (const file of attachments) {
            try {
              const safeName = file.name.replace(/[^\w.\-]+/g, "_");
              const path = `${insertedJob.id}/${Date.now()}-${safeName}`;
              const { error: upErr } = await supabase.storage.from("job-files").upload(path, file, { contentType: file.type || undefined });
              if (upErr) continue;
              const { data: pub } = supabase.storage.from("job-files").getPublicUrl(path);
              await supabase.from("job_files").insert({ job_id: insertedJob.id, file_name: file.name, file_type: file.type || "image", file_size: file.size, url: pub.publicUrl });
            } catch {
              /* ข้ามไฟล์ที่อัปไม่สำเร็จ ไม่ให้ล้มทั้งการสร้างงาน */
            }
          }
        }
        await appendAudit("created job", insertedJobNumber, "jobs", insertedJob.id);
        // งานที่รอผู้จัดการอนุมัติ → ยิงแจ้งเตือนเข้ากลุ่ม LINE กลาง (ไม่บล็อกการสร้างงานถ้าล้มเหลว)
        if (jobAcceptance === "pending") {
          try {
            await supabase.functions.invoke("notify-new-order", { body: { job_id: insertedJob.id } });
          } catch {
            /* แจ้งเตือน LINE ล้มเหลว ไม่ให้กระทบการสร้างงาน */
          }
        }
        notifyAssignees(
          "assigned",
          {
            id: insertedJobNumber,
            title: input?.title ?? "งานใหม่",
            dbId: insertedJob.id,
            assignedDesigner: input?.assignedDesigner ?? "Unassigned",
            assignedProduction: input?.assignedProduction ?? "Unassigned"
          },
          `ได้รับมอบหมายงาน ${insertedJobNumber} – ${input?.title ?? "งานใหม่"}`
        );
        await refreshWorkspaceData();
        setSelectedJobId(insertedJobNumber);
        setActiveView("Detail");
        return;
      } catch (error) {
        setDataError(errorMessage(error, "สร้างงานใน Supabase ไม่สำเร็จ"));
        return;
      }
    }

    const job: Job = {
      id: initialJobNumber,
      quoteNumber: initialQuoteNumber,
      quoteStatus: "draft",
      customerId: customer.id,
      customerName: input?.customerName ?? customer.name,
      phone: input?.phone ?? customer.phone,
      lineId: input?.lineId ?? customer.lineId,
      companyName: input?.companyName ?? customer.companyName,
      taxId: input?.taxId ?? customer.taxId,
      branch: input?.branch ?? customer.branch,
      billingAddress: input?.billingAddress ?? customer.billingAddress,
      accountingEmail: input?.accountingEmail ?? customer.accountingEmail,
      requiresInvoice: input?.requiresInvoice ?? customer.requiresInvoice,
      title: input?.title ?? "ป้ายสปอนเซอร์ UV งานด่วน",
      type: input?.type ?? "UV Print",
      description: input?.description ?? "ออเดอร์ใหม่จากฝ่ายขาย พร้อมไฟล์อาร์ตตัวอย่างและผู้รับผิดชอบเริ่มต้น",
      quantity: input?.quantity ?? 12,
      files: attachments?.length
        ? await Promise.all(attachments.map(async (file) => ({ id: crypto.randomUUID(), name: file.name, type: "image" as const, size: `${Math.max(file.size / 1000000, 0.01).toFixed(2)} MB`, url: await readImageAsDataUrl(file) })))
        : input?.files?.length ? input.files : [{ id: crypto.randomUUID(), name: "sponsor-plaque-artwork.pdf", type: "pdf", size: "4.2 MB" }],
      orderDate: input?.orderDate ?? todayISO(),
      dueDate: input?.dueDate ?? todayISO(),
      priority: input?.priority ?? "Urgent",
      isExpress: input?.isExpress ?? false,
      depositSlip: input?.depositSlip ?? undefined,
      depositReceivedDate: input?.depositReceivedDate ?? undefined,
      depositConfirmed: false,
      depositWaived: input?.depositWaived ?? false,
      productionBranch: input?.productionBranch ?? "",
      incomeBranch: input?.incomeBranch || undefined,
      salesPage: input?.salesPage || undefined,
      acceptance: jobAcceptance,
      rejectReason: "",
      status: "Quotation",
      assignedDesigner: input?.assignedDesigner ?? "Beam S.",
      assignedProduction: input?.assignedProduction ?? "Unassigned",
      createdBy: currentUser.name,
      price,
      vatMode: normalizeVatMode(input?.vatMode),
      deposit,
      remainingBalance: Math.max(price - deposit, 0),
      paymentStatus: getPaymentStatus(price, deposit),
      internalNotes: input?.internalNotes ?? "สร้างจากฟอร์มสร้างงาน",
      comments: [],
      statusHistory: [{ id: crypto.randomUUID(), from: "Created", to: "Quotation", by: currentUser.name, at: new Date().toLocaleString("en-GB") }]
    };
    if (isNewCustomer) {
      setCustomerRecords((current) => [
        {
          ...customer,
          totalOrders: 1,
          lifetimeValue: price,
          lastOrderDate: job.orderDate
        },
        ...current
      ]);
      void appendAudit("created customer", customer.name, "customers");
    } else {
      setCustomerRecords((current) =>
        current.map((item) =>
          item.id === customer.id
            ? {
                ...item,
                totalOrders: item.totalOrders + 1,
                lifetimeValue: item.lifetimeValue + price,
                lastOrderDate: job.orderDate
              }
            : item
        )
      );
    }
    setJobs((current) => [job, ...current]);
    notifyAssignees("assigned", job, `ได้รับมอบหมายงาน ${job.id} – ${job.title}`);
    // งานด่วนที่สร้างโดยเซลส์ (ไม่ใช่ผู้จัดการ) → ใช้สิทธิ์คำขอที่อนุมัติแล้ว 1 ครั้ง
    if (job.isExpress && !canManageExpress) {
      void consumeExpressRequest();
    }
    setSelectedJobId(job.id);
    setActiveView("Detail");
    void appendAudit("created job", job.id);
  }

  async function addTeamMember(member: NewTeamMemberInput) {
    if (!can("manage_users")) {
      setDataError("บทบาทนี้ยังไม่มีสิทธิ์จัดการผู้ใช้");
      return;
    }
    const username = normalizeUsername(member.username ?? "");
    if (!usernamePattern.test(username)) {
      setDataError("Username ต้องมี 3-32 ตัว ใช้ a-z, 0-9, จุด, ขีดกลาง หรือ _ เท่านั้น");
      return;
    }
    if (teamMembers.some((item) => item.username === username)) {
      setDataError("Username นี้ถูกใช้แล้ว");
      return;
    }
    if (supabase && isSupabaseConfigured && (!member.password || member.password.length < 6)) {
      setDataError("รหัสผ่านพนักงานต้องมีอย่างน้อย 6 ตัว");
      return;
    }
    const initials = member.name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "K2";
    const nextMember = { ...member, id: crypto.randomUUID(), avatar: initials };
    if (supabase && isSupabaseConfigured) {
      const authWorker = createSupabaseAuthWorker();
      if (!authWorker) {
        setDataError("ยังไม่ได้ตั้งค่า Supabase Auth");
        return;
      }
      const authEmail = authEmailFromLogin(username);
      const { data: authData, error: authError } = await authWorker.auth.signUp({
        email: authEmail,
        password: member.password!,
        options: {
          data: {
            full_name: member.name,
            role: member.role,
            username
          }
        }
      });
      if (authError) {
        setDataError(authError.message);
        return;
      }
      const profileId = authData.user?.id ?? nextMember.id;
      const { data, error } = await supabase
        .from("profiles")
        .upsert({ id: profileId, email: authEmail, full_name: member.name, role: member.role, avatar_url: member.avatarUrl ?? null, branch: member.branch || null, is_active: true }, { onConflict: "id" })
        .select("id, email, full_name, role, extra_roles, avatar_url, phone, branch")
        .single();
      if (error) {
        setDataError(error.message);
        return;
      }
      const savedMember = profileToMember(data as SupabaseProfileRow);
      setTeamMembers((current) => [...current, savedMember]);
      void appendAudit("added team member", savedMember.name, "profiles", savedMember.id);
      return;
    }
    setTeamMembers((current) => [...current, nextMember]);
    void appendAudit("added team member", member.name, "profiles");
  }

  // HR: โหลด/บันทึกข้อมูลเงินเดือน (เห็น/แก้ได้เฉพาะเจ้าของ + HR ผ่าน RLS)
  async function loadHrRecords() {
    if (!can("manage_hr") || !supabase) return;
    const { data, error } = await supabase.from("employee_hr").select("id, monthly_salary, position, start_date");
    if (error) {
      setDataError(error.message);
      return;
    }
    const map: Record<string, { salary: number; position: string; startDate: string }> = {};
    ((data ?? []) as Array<{ id: string; monthly_salary: number | string | null; position: string | null; start_date: string | null }>).forEach((row) => {
      map[row.id] = { salary: Number(row.monthly_salary ?? 0), position: row.position ?? "", startDate: row.start_date ?? "" };
    });
    setHrRecords(map);
  }

  async function loadBranchSettings() {
    if (!supabase) return;
    const { data, error } = await supabase.from("branch_settings").select("branch, work_start, work_end, late_grace_minutes, gps_lat, gps_lng, radius_m");
    if (error) {
      setDataError(error.message);
      return;
    }
    const map: Record<string, BranchSetting> = {};
    ((data ?? []) as Array<{ branch: string; work_start: string | null; work_end: string | null; late_grace_minutes: number | null; gps_lat: number | string | null; gps_lng: number | string | null; radius_m: number | null }>).forEach((row) => {
      map[row.branch] = {
        branch: row.branch,
        workStart: row.work_start ?? "09:00",
        workEnd: row.work_end ?? "18:00",
        lateGraceMinutes: row.late_grace_minutes ?? 5,
        gpsLat: row.gps_lat != null ? Number(row.gps_lat) : null,
        gpsLng: row.gps_lng != null ? Number(row.gps_lng) : null,
        radiusM: row.radius_m ?? 150
      };
    });
    setBranchSettings(map);
  }

  async function saveBranchSetting(setting: BranchSetting) {
    if (!can("manage_hr")) {
      setDataError("เฉพาะเจ้าของหรือ HR เท่านั้นที่ตั้งค่าสาขาได้");
      return;
    }
    setBranchSettings((current) => ({ ...current, [setting.branch]: setting }));
    if (supabase) {
      const { error } = await supabase
        .from("branch_settings")
        .upsert({ branch: setting.branch, work_start: setting.workStart, work_end: setting.workEnd, late_grace_minutes: setting.lateGraceMinutes, gps_lat: setting.gpsLat, gps_lng: setting.gpsLng, radius_m: setting.radiusM }, { onConflict: "branch" });
      if (error) {
        setDataError(error.message);
        return;
      }
    }
    void appendAudit("updated branch settings", setting.branch, "branch_settings", null);
  }

  async function loadAttendance() {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("attendance")
      .select("id, profile_id, work_date, check_in_at, check_out_at, check_in_selfie, check_out_selfie, check_in_lat, check_in_lng, late_minutes, status")
      .eq("work_date", todayISO());
    if (error) {
      setDataError(error.message);
      return;
    }
    const rows = ((data ?? []) as Parameters<typeof attendanceFromRow>[0][]).map(attendanceFromRow);
    setAllAttendance(rows);
    setMyAttendance(rows.find((row) => row.profileId === currentUser.id) ?? null);
  }

  // พนักงานเช็คอิน: ขอ GPS -> ตรวจอยู่ในรัศมีสาขา -> คำนวณสาย -> บันทึก
  async function checkIn(): Promise<CheckInResult> {
    if (!currentUser.branch) return { ok: false, msg: "ยังไม่ได้กำหนดสาขาประจำ — ให้ HR ตั้งค่าก่อน" };
    const setting = branchSettings[currentUser.branch];
    if (!navigator.geolocation) return { ok: false, msg: "เบราว์เซอร์ไม่รองรับ GPS" };
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const geo = checkGeofence(setting, lat, lng);
          if (geo.geofenced && !geo.withinRadius) {
            resolve({ ok: false, msg: `อยู่นอกรัศมีสาขา (${geo.distance} ม. / อนุญาต ${geo.radius} ม.)` });
            return;
          }
          const late = setting ? lateMinutes(setting.workStart, setting.lateGraceMinutes, new Date()) : 0;
          const status = late > 0 ? "late" : "on_time";
          const checkInAt = new Date().toISOString();
          if (supabase && uuidPattern.test(currentUser.id)) {
            const { error } = await supabase
              .from("attendance")
              .upsert({ profile_id: currentUser.id, work_date: todayISO(), check_in_at: checkInAt, check_in_selfie: null, check_in_lat: lat, check_in_lng: lng, late_minutes: late, status }, { onConflict: "profile_id,work_date" });
            if (error) {
              resolve({ ok: false, msg: error.message });
              return;
            }
            await loadAttendance();
          } else {
            setMyAttendance({ id: crypto.randomUUID(), profileId: currentUser.id, workDate: todayISO(), checkInAt, checkOutAt: null, checkInSelfie: null, checkOutSelfie: null, checkInLat: lat, checkInLng: lng, lateMinutes: late, status });
          }
          void appendAudit("checked in", currentUser.name, "attendance", null);
          resolve({ ok: true, msg: late > 0 ? `เช็คอินแล้ว — สาย ${late} นาที` : "เช็คอินตรงเวลา ✓", checkInAt, status, lateMinutes: late, geofenced: geo.geofenced });
        },
        () => resolve({ ok: false, msg: "ดึงตำแหน่งไม่สำเร็จ — อนุญาตให้เข้าถึงตำแหน่งก่อน" }),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }

  async function checkOut(): Promise<{ ok: boolean; msg: string }> {
    if (!myAttendance) return { ok: false, msg: "ยังไม่ได้เช็คอินวันนี้" };
    // กติกา: ออกงานได้ตั้งแต่เวลาเลิกงานของสาขา (default 18:00) เป็นต้นไป — กันกดออกงานพลาดตอนเช้า
    const workEnd = branchSettings[currentUser.branch ?? ""]?.workEnd || "18:00";
    const toMin = (t: string) => {
      const [h, m] = t.split(":").map((v) => Number(v) || 0);
      return h * 60 + m;
    };
    const bkk = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
    const nowMin = Number(bkk.find((p) => p.type === "hour")?.value ?? 0) * 60 + Number(bkk.find((p) => p.type === "minute")?.value ?? 0);
    if (nowMin < toMin(workEnd)) {
      return { ok: false, msg: `ยังไม่ถึงเวลาเลิกงาน — ออกงานได้ตั้งแต่ ${workEnd} น.` };
    }
    const checkOutAt = new Date().toISOString();
    if (supabase && uuidPattern.test(currentUser.id)) {
      const { error } = await supabase.from("attendance").update({ check_out_at: checkOutAt, check_out_selfie: null }).eq("id", myAttendance.id);
      if (error) return { ok: false, msg: error.message };
      await loadAttendance();
    } else {
      setMyAttendance({ ...myAttendance, checkOutAt, checkOutSelfie: null });
    }
    void appendAudit("checked out", currentUser.name, "attendance", null);
    return { ok: true, msg: "เช็คเอาท์แล้ว ✓" };
  }

  async function loadLeaves() {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("leave_requests")
      .select("id, profile_id, leave_type, start_date, end_date, reason, status, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      setDataError(error.message);
      return;
    }
    setLeaveRequests(((data ?? []) as Parameters<typeof leaveFromRow>[0][]).map(leaveFromRow));
  }

  async function submitLeave(input: { leaveType: LeaveRequest["leaveType"]; startDate: string; endDate: string; reason: string }) {
    if (!input.startDate || !input.endDate) {
      setDataError("กรุณาเลือกวันที่เริ่มและสิ้นสุดการลา");
      return;
    }
    if (supabase && uuidPattern.test(currentUser.id)) {
      const { error } = await supabase
        .from("leave_requests")
        .insert({ profile_id: currentUser.id, leave_type: input.leaveType, start_date: input.startDate, end_date: input.endDate, reason: input.reason || null, status: "pending" });
      if (error) {
        setDataError(error.message);
        return;
      }
      await loadLeaves();
    } else {
      setLeaveRequests((current) => [
        { id: crypto.randomUUID(), profileId: currentUser.id, leaveType: input.leaveType, startDate: input.startDate, endDate: input.endDate, reason: input.reason, status: "pending", createdAt: new Date().toISOString() },
        ...current
      ]);
    }
    void appendAudit("requested leave", currentUser.name, "leave_requests", null);
  }

  async function reviewLeave(id: string, status: "approved" | "rejected") {
    if (!can("manage_hr")) {
      setDataError("เฉพาะเจ้าของหรือ HR เท่านั้นที่อนุมัติ/ปฏิเสธการลาได้");
      return;
    }
    setLeaveRequests((current) => current.map((leave) => (leave.id === id ? { ...leave, status } : leave)));
    if (supabase && uuidPattern.test(currentUser.id)) {
      const { error } = await supabase.from("leave_requests").update({ status, reviewed_by: currentUser.id }).eq("id", id);
      if (error) {
        setDataError(error.message);
        void loadLeaves();
        return;
      }
    }
    void appendAudit(status === "approved" ? "approved leave" : "rejected leave", id, "leave_requests", id);
  }

  async function loadHolidays() {
    if (!supabase) return;
    const { data, error } = await supabase.from("holidays").select("id, holiday_date, name").order("holiday_date", { ascending: true });
    if (error) {
      setDataError(error.message);
      return;
    }
    setHolidays(((data ?? []) as Parameters<typeof holidayFromRow>[0][]).map(holidayFromRow));
  }

  async function addHoliday(date: string, name: string) {
    if (!can("manage_hr")) {
      setDataError("เฉพาะเจ้าของหรือ HR เท่านั้นที่เพิ่มวันหยุดได้");
      return;
    }
    if (!date || !name.trim()) {
      setDataError("กรอกวันที่และชื่อวันหยุดก่อน");
      return;
    }
    if (supabase) {
      const { error } = await supabase.from("holidays").upsert({ holiday_date: date, name: name.trim() }, { onConflict: "holiday_date" });
      if (error) {
        setDataError(error.message);
        return;
      }
      await loadHolidays();
    } else {
      setHolidays((current) => [...current, { id: crypto.randomUUID(), date, name: name.trim() }]);
    }
    void appendAudit("added holiday", name, "holidays", null);
  }

  async function removeHoliday(id: string) {
    if (!can("manage_hr")) return;
    setHolidays((current) => current.filter((holiday) => holiday.id !== id));
    if (supabase && uuidPattern.test(id)) {
      await supabase.from("holidays").delete().eq("id", id);
    }
  }

  // HR-4: ดึงข้อมูลลงเวลา + ลา ของเดือนที่เลือก มาสรุปต่อพนักงาน (ใช้คำนวณเงินเดือน)
  async function loadPayroll(month: string) {
    if (!can("manage_hr") || !supabase) return;
    const start = `${month}-01`;
    const [year, mon] = month.split("-").map(Number);
    const lastDay = new Date(year, mon, 0).getDate();
    const end = `${month}-${String(lastDay).padStart(2, "0")}`;
    const [attRes, leaveRes, otRes] = await Promise.all([
      supabase.from("attendance").select("profile_id, status, late_minutes, check_in_at").gte("work_date", start).lte("work_date", end),
      supabase.from("leave_requests").select("profile_id, start_date, end_date, status").eq("status", "approved").lte("start_date", end).gte("end_date", start),
      supabase.from("overtime").select("profile_id, hours").gte("work_date", start).lte("work_date", end)
    ]);
    const summary: Record<string, { present: number; late: number; lateMin: number; leaveDays: number; otHours: number }> = {};
    const ensure = (id: string) => (summary[id] = summary[id] ?? { present: 0, late: 0, lateMin: 0, leaveDays: 0, otHours: 0 });
    ((attRes.data ?? []) as Array<{ profile_id: string; status: string | null; late_minutes: number | null; check_in_at: string | null }>).forEach((row) => {
      const s = ensure(row.profile_id);
      if (row.check_in_at) s.present += 1;
      if (row.status === "late") {
        s.late += 1;
        s.lateMin += row.late_minutes ?? 0;
      }
    });
    ((leaveRes.data ?? []) as Array<{ profile_id: string; start_date: string; end_date: string }>).forEach((row) => {
      const s = ensure(row.profile_id);
      const ls = new Date(row.start_date > start ? row.start_date : start);
      const le = new Date(row.end_date < end ? row.end_date : end);
      s.leaveDays += Math.max(0, Math.round((le.getTime() - ls.getTime()) / 86400000) + 1);
    });
    ((otRes.data ?? []) as Array<{ profile_id: string; hours: number | string | null }>).forEach((row) => {
      ensure(row.profile_id).otHours += Number(row.hours ?? 0);
    });
    setPayrollSummary(summary);
  }

  // โหลดรายการ OT ของเดือนที่เลือก (สำหรับผู้จัดการ/HR ดู+จัดการ)
  async function loadOvertime(month: string) {
    if (!supabase || !isSupabaseConfigured) return;
    const start = `${month}-01`;
    const [year, mon] = month.split("-").map(Number);
    const end = `${month}-${String(new Date(year, mon, 0).getDate()).padStart(2, "0")}`;
    const { data, error } = await supabase
      .from("overtime")
      .select("id, profile_id, work_date, hours, note, branch, approved_by, created_at")
      .gte("work_date", start)
      .lte("work_date", end)
      .order("work_date", { ascending: false });
    if (error) return;
    const next = ((data ?? []) as Array<{ id: string; profile_id: string; work_date: string; hours: number | string | null; note: string | null; branch: string | null; approved_by: string | null; created_at: string }>).map((row) => ({
      id: row.id,
      profileId: row.profile_id,
      workDate: row.work_date,
      hours: Number(row.hours ?? 0),
      note: row.note ?? "",
      branch: row.branch ?? undefined,
      approvedBy: row.approved_by ?? undefined,
      createdAt: row.created_at
    }));
    setOvertimeRecords((current) => reuseIfSame(current, next));
  }

  // ผู้จัดการสาขา (หรือ HR/เจ้าของ) เปิด/บันทึก OT ให้พนักงานของสาขาตัวเอง
  async function addOvertime(profileId: string, workDate: string, hours: number, note: string) {
    if (!(userHasRole(currentUser, "Manager") || can("manage_hr") || currentUser.role === "Owner")) {
      setDataError("เฉพาะผู้จัดการสาขา / HR / เจ้าของเท่านั้นที่เปิด OT ได้");
      return;
    }
    if (!profileId || !hours || hours <= 0) {
      setDataError("เลือกพนักงานและกรอกจำนวนชั่วโมง OT ให้ถูกต้อง");
      return;
    }
    const target = teamMembers.find((member) => member.id === profileId);
    // ผู้จัดการเปิดได้เฉพาะพนักงานสาขาตัวเอง (เจ้าของ/HR ได้ทุกสาขา)
    if (userHasRole(currentUser, "Manager") && !can("manage_hr") && currentUser.role !== "Owner" && target?.branch !== currentUser.branch) {
      setDataError("ผู้จัดการเปิด OT ได้เฉพาะพนักงานสาขาของตัวเอง");
      return;
    }
    if (supabase && isSupabaseConfigured && uuidPattern.test(profileId)) {
      const { error } = await supabase.from("overtime").insert({
        profile_id: profileId,
        work_date: workDate,
        hours,
        note: note || null,
        branch: target?.branch ?? currentUser.branch ?? null,
        approved_by: uuidPattern.test(currentUser.id) ? currentUser.id : null
      });
      if (error) {
        setDataError(error.message);
        return;
      }
      await loadOvertime(payrollMonth);
      if (activeView === "Payroll") void loadPayroll(payrollMonth);
    } else {
      setOvertimeRecords((current) => [
        { id: crypto.randomUUID(), profileId, workDate, hours, note, branch: target?.branch, approvedBy: currentUser.id, createdAt: new Date().toISOString() },
        ...current
      ]);
    }
    void appendAudit("granted overtime", `${target?.name ?? profileId} · ${hours} ชม.`, "overtime", null);
    notifyUser(target?.name ?? "", "assigned", { id: "OT", title: "OT", dbId: undefined }, `คุณได้รับ OT ${hours} ชม. วันที่ ${workDate}`);
  }

  async function saveHrRecord(memberId: string, record: { salary: number; position: string; startDate: string }) {
    if (!can("manage_hr")) {
      setDataError("เฉพาะเจ้าของหรือ HR เท่านั้นที่แก้ข้อมูลเงินเดือนได้");
      return;
    }
    setHrRecords((current) => ({ ...current, [memberId]: record }));
    if (supabase && uuidPattern.test(memberId)) {
      const { error } = await supabase
        .from("employee_hr")
        .upsert({ id: memberId, monthly_salary: record.salary, position: record.position || null, start_date: record.startDate || null }, { onConflict: "id" });
      if (error) {
        setDataError(error.message);
        return;
      }
    }
    void appendAudit("updated salary", memberId, "employee_hr", memberId);
  }

  async function updateTeamMember(memberId: string, updates: Pick<TeamMember, "name" | "role" | "branch"> & { roles?: Role[]; phone?: string }) {
    const isOwnProfile = currentUser.id === memberId;
    if (!can("manage_users") && !isOwnProfile) {
      setDataError("บทบาทนี้ยังไม่มีสิทธิ์จัดการผู้ใช้");
      return;
    }
    const existingMember = teamMembers.find((member) => member.id === memberId);
    if (!existingMember) return;
    // ข้อมูลเจ้าของ แก้ได้เฉพาะเจ้าของเท่านั้น (HR/แอดมิน แก้พนักงานคนอื่นได้หมด ยกเว้นเจ้าของ)
    if (existingMember.role === "Owner" && currentUser.role !== "Owner") {
      setDataError("แก้ไขข้อมูลเจ้าของได้เฉพาะเจ้าของเท่านั้น");
      return;
    }
    const nextRole = can("manage_users") ? updates.role : existingMember.role;
    // บทบาทเสริม (multi-role): แก้ได้เฉพาะผู้มีสิทธิ์จัดการผู้ใช้ · ไม่ซ้ำกับบทบาทหลัก · กรองค่าที่ไม่ถูกต้อง
    const requestedRoles = can("manage_users") ? (updates.roles ?? existingMember.roles ?? []) : (existingMember.roles ?? []);
    const nextRoles = Array.from(new Set(requestedRoles.filter((value) => roles.includes(value) && value !== nextRole)));
    // เจ้าของไม่มีสาขาประจำ (เห็นทุกสาขา); บทบาทอื่นกำหนดสาขาได้เฉพาะผู้มีสิทธิ์จัดการผู้ใช้
    const nextBranch = nextRole === "Owner"
      ? ""
      : (can("manage_users") ? (updates.branch ?? existingMember.branch ?? "") : existingMember.branch ?? "");
    const nextPhone = updates.phone !== undefined ? updates.phone.trim() : (existingMember.phone ?? "");
    const safeUpdates = {
      name: updates.name,
      role: nextRole,
      roles: nextRoles.length ? nextRoles : undefined,
      branch: nextBranch,
      phone: nextPhone || undefined
    };
    if (supabase && uuidPattern.test(memberId)) {
      const { error } = await supabase.from("profiles").update({ full_name: safeUpdates.name, role: safeUpdates.role, extra_roles: nextRoles, branch: safeUpdates.branch || null, phone: nextPhone || null }).eq("id", memberId);
      if (error) {
        setDataError(error.message);
        return;
      }
    }
    const updatedMember = { ...existingMember, ...safeUpdates, avatar: existingMember.avatarUrl ? existingMember.avatar : initialsFromName(safeUpdates.name) };
    setTeamMembers((current) => current.map((member) => (member.id === memberId ? updatedMember : member)));
    if (currentUser.id === memberId) setCurrentUser(updatedMember);
    void appendAudit(isOwnProfile && !can("manage_users") ? "updated own profile" : "updated team member", safeUpdates.name, "profiles", memberId);
  }

  async function updateTeamMemberAvatar(memberId: string, avatarUrl: string) {
    const isOwnProfile = currentUser.id === memberId;
    if (!can("manage_users") && !isOwnProfile) {
      setDataError("บทบาทนี้ยังไม่มีสิทธิ์จัดการผู้ใช้");
      return;
    }
    const existingMember = teamMembers.find((member) => member.id === memberId);
    if (!existingMember) return;
    if (supabase && uuidPattern.test(memberId)) {
      const { error } = await supabase.from("profiles").update({ avatar_url: avatarUrl || null }).eq("id", memberId);
      if (error) {
        setDataError(error.message);
        return;
      }
    }
    const updatedMember = { ...existingMember, avatarUrl: avatarUrl || undefined };
    setTeamMembers((current) => current.map((member) => (member.id === memberId ? updatedMember : member)));
    if (currentUser.id === memberId) setCurrentUser(updatedMember);
    void appendAudit(avatarUrl ? "updated profile image" : "removed profile image", existingMember.name, "profiles", memberId);
  }

  // เปลี่ยนรหัสผ่านของตัวเอง (ผ่าน Supabase Auth) — คืนค่า true ถ้าสำเร็จ
  // เจ้าของรีเซ็ตรหัสผ่านให้พนักงานคนอื่น (ผ่าน Edge Function ที่ตรวจสิทธิ์ Owner ฝั่งเซิร์ฟเวอร์)
  async function resetMemberPassword(memberId: string): Promise<{ ok: boolean; password?: string; msg: string }> {
    if (currentUser.role !== "Owner") return { ok: false, msg: "เฉพาะเจ้าของเท่านั้นที่รีเซ็ตรหัสผู้อื่นได้" };
    if (!supabase || !isSupabaseConfigured) return { ok: false, msg: "ใช้ได้เมื่อเชื่อมต่อ Supabase แล้วเท่านั้น" };
    // รหัสตัวเลข 6 หลัก สุ่มแบบปลอดภัย
    const rnd = new Uint32Array(1);
    crypto.getRandomValues(rnd);
    const newPassword = String(100000 + (rnd[0] % 900000));
    const { data, error } = await supabase.functions.invoke("admin-reset-password", { body: { userId: memberId, newPassword } });
    if (error) return { ok: false, msg: error.message };
    if (data && (data as { error?: string }).error) return { ok: false, msg: (data as { error: string }).error };
    void appendAudit("reset member password", currentUser.name, "profiles", memberId);
    return { ok: true, password: newPassword, msg: "รีเซ็ตรหัสผ่านแล้ว" };
  }

  async function changeOwnPassword(newPassword: string): Promise<boolean> {
    if (newPassword.length < 6) {
      setDataError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      return false;
    }
    if (!supabase || !isSupabaseConfigured) {
      setDataError("เปลี่ยนรหัสผ่านได้เมื่อเชื่อมต่อ Supabase แล้วเท่านั้น");
      return false;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setDataError(error.message);
      return false;
    }
    void appendAudit("changed own password", currentUser.name, "profiles", currentUser.id);
    return true;
  }

  async function removeTeamMember(memberId: string) {
    if (!can("manage_users")) {
      setDataError("บทบาทนี้ยังไม่มีสิทธิ์จัดการผู้ใช้");
      return;
    }
    const member = teamMembers.find((item) => item.id === memberId);
    if (!member || member.role === "Owner") return;
    if (supabase && uuidPattern.test(memberId)) {
      const { error } = await supabase.from("profiles").update({ is_active: false }).eq("id", memberId);
      if (error) {
        setDataError(error.message);
        return;
      }
    }
    setTeamMembers((current) => current.filter((item) => item.id !== memberId));
    if (currentUser.id === memberId) {
      setCurrentUser(teamMembers.find((item) => item.role === "Owner" && item.id !== memberId) ?? teamMembers[0]);
    }
    void appendAudit("removed team member", member.name, "profiles", memberId);
  }

  // ดึงเลขลำดับถัดไปจาก DB (กันเลขซ้ำตอนหลายเพจปิดงานพร้อมกัน) — fallback เป็น state ในโหมด mock
  async function nextCustomerSeqFromSource(): Promise<number> {
    if (supabase && isSupabaseConfigured) {
      const { data } = await supabase
        .from("customers")
        .select("code_seq")
        .order("code_seq", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      return Number((data as { code_seq?: number | null } | null)?.code_seq ?? 0) + 1;
    }
    return nextCustomerSeq(customerRecords);
  }

  async function addCustomer(customer: Omit<Customer, "id" | "totalOrders" | "lifetimeValue" | "lastOrderDate">) {
    if (!can("create_customer")) {
      setDataError("บทบาทนี้ยังไม่มีสิทธิ์เพิ่มลูกค้า");
      return;
    }
    // ออกรหัสลูกค้าเมื่อเลือกเพจ + แอดมินครบ (เลขลำดับ = ระบบแจกเท่านั้น ตาม SOP)
    let codeColumns: Record<string, unknown> = {};
    let codeLocal: Partial<Customer> = {};
    if (customer.codePage && customer.codeAdmin) {
      const year = customerCodeYear();
      const seq = await nextCustomerSeqFromSource();
      const code = formatCustomerCode(customer.codePage, customer.codeAdmin, seq, year);
      codeColumns = { customer_code: code, code_page: customer.codePage, code_admin: customer.codeAdmin, code_seq: seq, code_year: year };
      codeLocal = { customerCode: code, codePage: customer.codePage, codeAdmin: customer.codeAdmin, codeSeq: seq, codeYear: year };
    }
    if (supabase && isSupabaseConfigured) {
      const { data, error } = await supabase.from("customers").insert({ ...customerInsertPayload(customer), ...codeColumns }).select("*").single();
      if (error) {
        setDataError(error.message);
        return;
      }
      const nextCustomer = customerFromRow(data as SupabaseCustomerRow, []);
      setCustomerRecords((current) => [nextCustomer, ...current]);
      void appendAudit("created customer", nextCustomer.name, "customers", nextCustomer.dbId);
      return;
    }
    const nextCustomer: Customer = {
      ...customer,
      ...codeLocal,
      id: `c-${crypto.randomUUID()}`,
      totalOrders: 0,
      lifetimeValue: 0,
      lastOrderDate: "-"
    };
    setCustomerRecords((current) => [nextCustomer, ...current]);
    void appendAudit("created customer", nextCustomer.name, "customers");
  }

  // ออกรหัสให้ลูกค้าเก่าที่ยังไม่มีรหัส (backfill) — ไม่ออกซ้ำถ้ามีรหัสแล้ว
  async function assignCustomerCode(customerId: string, page: string, admin: string) {
    if (!can("edit_customer")) {
      setDataError("บทบาทนี้ยังไม่มีสิทธิ์แก้ไขลูกค้า");
      return;
    }
    if (!page || !admin) return;
    const target = customerRecords.find((customer) => customer.id === customerId);
    if (!target || target.customerCode) return;
    const year = customerCodeYear();
    const seq = await nextCustomerSeqFromSource();
    const code = formatCustomerCode(page, admin, seq, year);
    if (supabase && uuidPattern.test(customerId)) {
      const { error } = await supabase
        .from("customers")
        .update({ customer_code: code, code_page: page, code_admin: admin, code_seq: seq, code_year: year })
        .eq("id", customerId);
      if (error) {
        setDataError(error.message);
        return;
      }
    }
    setCustomerRecords((current) =>
      current.map((customer) =>
        customer.id === customerId
          ? { ...customer, customerCode: code, codePage: page, codeAdmin: admin, codeSeq: seq, codeYear: year }
          : customer
      )
    );
    void appendAudit("assigned customer code", code, "customers", uuidPattern.test(customerId) ? customerId : null);
  }

  async function updateCustomer(customerId: string, updates: Pick<Customer, "name" | "phone" | "lineId" | "email" | "companyName" | "taxId" | "branch" | "billingAddress" | "accountingEmail" | "requiresInvoice" | "notes" | "sourceChannel" | "sourcePage" | "lineFriend" | "loyaltyPoints">) {
    if (!can("edit_customer")) {
      setDataError("บทบาทนี้ยังไม่มีสิทธิ์แก้ไขลูกค้า");
      return;
    }
    if (supabase && uuidPattern.test(customerId)) {
      const { error } = await supabase.from("customers").update(customerInsertPayload(updates)).eq("id", customerId);
      if (error) {
        setDataError(error.message);
        return;
      }
    }
    setCustomerRecords((current) => current.map((customer) => (customer.id === customerId ? { ...customer, ...updates } : customer)));
    setJobs((current) =>
      current.map((job) =>
        job.customerId === customerId
          ? {
              ...job,
              customerName: updates.name,
              phone: updates.phone,
              lineId: updates.lineId,
              companyName: updates.companyName,
              taxId: updates.taxId,
              branch: updates.branch,
              billingAddress: updates.billingAddress,
              accountingEmail: updates.accountingEmail,
              requiresInvoice: updates.requiresInvoice
            }
          : job
      )
    );
    void appendAudit("updated customer", updates.name, "customers", customerId);
  }

  // ชวนแอด LINE สำเร็จ → ทำเครื่องหมายว่าเป็นเพื่อน LINE แล้ว (อัปเดตเฉพาะ field เดียว ปลอดภัย)
  async function markCustomerLineFriend(customerId: string) {
    if (!can("edit_customer")) {
      setDataError("บทบาทนี้ยังไม่มีสิทธิ์แก้ไขลูกค้า");
      return;
    }
    setCustomerRecords((current) => current.map((customer) => (customer.id === customerId ? { ...customer, lineFriend: true } : customer)));
    if (supabase && uuidPattern.test(customerId)) {
      const { error } = await supabase.from("customers").update({ line_friend: true }).eq("id", customerId);
      if (error) {
        setDataError(error.message);
        void refreshWorkspaceData();
        return;
      }
    }
    void appendAudit("marked LINE friend", customerId, "customers", customerId);
  }

  async function removeCustomer(customerId: string) {
    if (!can("delete_customer")) {
      setDataError("บทบาทนี้ยังไม่มีสิทธิ์ลบลูกค้า");
      return;
    }
    const customer = customerRecords.find((item) => item.id === customerId);
    const hasJobs = jobs.some((job) => job.customerId === customerId);
    if (!customer || hasJobs) return;
    if (supabase && uuidPattern.test(customerId)) {
      const { error } = await supabase.from("customers").delete().eq("id", customerId);
      if (error) {
        setDataError(error.message);
        return;
      }
    }
    setCustomerRecords((current) => current.filter((item) => item.id !== customerId));
    void appendAudit("removed customer", customer.name, "customers", customerId);
  }

  async function removeJob(jobId: string) {
    if (!can("delete_job")) {
      setDataError("บทบาทนี้ยังไม่มีสิทธิ์ลบงาน");
      return;
    }
    const existingJob = jobs.find((job) => job.id === jobId);
    if (!existingJob) return;
    if (supabase && existingJob.dbId && uuidPattern.test(currentUser.id)) {
      const { error } = await supabase.from("jobs").delete().eq("id", existingJob.dbId);
      if (error) {
        setDataError(error.message);
        return;
      }
    }
    setJobs((current) => current.filter((job) => job.id !== jobId));
    setSelectedJobId((current) => (current === jobId ? "" : current));
    setActiveView("Dashboard");
    void appendAudit("removed job", jobId, "jobs", existingJob.dbId);
  }

  async function saveCompanyProfile(profile: CompanyProfile) {
    if (!can("manage_company_settings")) {
      setDataError("บทบาทนี้ยังไม่มีสิทธิ์ตั้งค่าบริษัท");
      return;
    }
    const normalizedProfile = { ...profile, facebookPages: normalizeFacebookPages(profile.facebookPages) };
    window.localStorage.setItem(facebookPagesStorageKey, JSON.stringify(normalizedProfile.facebookPages));
    setCompanyProfile(normalizedProfile);
    if (!supabase || !isSupabaseConfigured) return;
    const payload = {
      name: normalizedProfile.name,
      legal_name: normalizedProfile.legalName,
      tax_id: normalizedProfile.taxId,
      branch: normalizedProfile.branch,
      address: normalizedProfile.address,
      phone: normalizedProfile.phone,
      email: normalizedProfile.email,
      bank_name: normalizedProfile.bankName,
      bank_account: normalizedProfile.bankAccount,
      bank_account_name: normalizedProfile.bankAccountName,
      quote_prefix: normalizedProfile.quotePrefix,
      quote_terms: normalizedProfile.quoteTerms
    };
    const { data: existing, error: readError } = await supabase.from("company_settings").select("id").limit(1);
    if (readError) {
      setDataError(readError.message);
      return;
    }
    const existingId = existing?.[0]?.id;
    const { error } = existingId
      ? await supabase.from("company_settings").update(payload).eq("id", existingId)
      : await supabase.from("company_settings").insert(payload);
    if (error) {
      setDataError(error.message);
      return;
    }
    if (existingId) {
      const pagesResult = await supabase
        .from("company_settings")
        .update({ facebook_pages: normalizedProfile.facebookPages })
        .eq("id", existingId);
      if (pagesResult.error && !pagesResult.error.message.includes("facebook_pages")) {
        setDataError(pagesResult.error.message);
        return;
      }
    }
    void appendAudit("updated company settings", profile.legalName, "company_settings", existingId);
  }

  async function persistRolePermissions(role: Role, permissions: PermissionKey[]) {
    if (!supabase || !isSupabaseConfigured) return;
    const { error } = await supabase.from("role_permissions").upsert({ role, permissions }, { onConflict: "role" });
    if (error) setDataError(error.message);
  }

  function updateRolePermission(role: Role, permission: PermissionKey, enabled: boolean) {
    if (!can("manage_permissions") || role === "Owner") return;
    setPermissionMatrix((current) => {
      const currentPermissions = new Set(current[role] ?? []);
      if (enabled) currentPermissions.add(permission);
      else currentPermissions.delete(permission);
      const next = { ...current, [role]: Array.from(currentPermissions) as PermissionKey[] };
      window.localStorage.setItem("k2-permission-matrix", JSON.stringify(next));
      void persistRolePermissions(role, next[role]);
      void appendAudit(enabled ? "enabled permission" : "disabled permission", `${role}:${permission}`, "role_permissions");
      return next;
    });
  }

  function resetRolePermissions() {
    if (!can("manage_permissions")) return;
    setPermissionMatrix(defaultRolePermissions);
    window.localStorage.removeItem("k2-permission-matrix");
    roles.filter((role) => role !== "Owner").forEach((role) => {
      void persistRolePermissions(role, defaultRolePermissions[role]);
    });
    void appendAudit("reset permissions", "default role permissions", "role_permissions");
  }

  if (!isAuthed) {
    return (
      <main className="min-h-screen px-5 py-8 text-k2-ink sm:px-8">
        <section className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/65 px-4 py-2 text-sm font-semibold shadow-sm backdrop-blur">
              <Sparkles className="h-4 w-4 text-violet-500" />
              {appTagline}
            </div>
            <div className="space-y-5">
              <KLogoLockup size="hero" />
              <p className="max-w-2xl text-lg leading-8 text-k2-muted">
                K2Smart Keep every job flowing
              </p>
            </div>
            <div className="flex max-w-2xl flex-wrap gap-2.5">
              {statuses.slice(0, 6).map((status, index) => (
                <span
                  key={status}
                  className="inline-flex items-center gap-2 rounded-full border border-white/75 bg-white/55 px-3.5 py-2 text-sm font-extrabold text-k2-ink shadow-sm backdrop-blur"
                >
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-white/80 text-[10px] text-k2-muted">
                    {index + 1}
                  </span>
                  <span className={`h-2 w-2 rounded-full ${statusDot[status]}`} />
                  {statusLabel[status]}
                </span>
              ))}
            </div>
          </div>

          <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-[2rem] p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-k2-muted">{isSupabaseConfigured ? "Supabase Auth" : "โหมดทดลอง"}</p>
                <h2 className="text-2xl font-semibold">{isSupabaseConfigured ? "เข้าสู่ระบบผู้ใช้" : "เลือกบทบาทในทีม"}</h2>
              </div>
              <div className="rounded-2xl bg-k2-lilac p-3">
                <Lock className="h-6 w-6 text-violet-700" />
              </div>
            </div>

            {isSupabaseConfigured ? (
              <div className="mb-5 rounded-[1.35rem] border border-white/70 bg-white/50 p-3">
                <div className="mb-3 grid grid-cols-2 gap-2 rounded-2xl bg-white/55 p-1">
                  {[
                    { id: "signIn", label: "เข้าสู่ระบบ" },
                    { id: "signUp", label: "สร้างผู้ใช้" }
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setAuthMode(item.id as "signIn" | "signUp")}
                      className={`rounded-xl px-3 py-2 text-sm font-extrabold ${
                        authMode === item.id ? "bg-k2-ink text-white" : "bg-transparent text-k2-muted shadow-none"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <div className="grid gap-3">
                  {authMode === "signUp" ? (
                    <>
                      <input
                        value={authForm.fullName}
                        onChange={(event) => setAuthForm((current) => ({ ...current, fullName: event.target.value }))}
                        placeholder="ชื่อผู้ใช้"
                        className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-semibold outline-none"
                      />
                      <select
                        value={authForm.role}
                        onChange={(event) => setAuthForm((current) => ({ ...current, role: event.target.value as Role }))}
                        className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-semibold outline-none"
                      >
                        {roles.map((role) => (
                          <option key={role} value={role}>{roleLabel[role]}</option>
                        ))}
                      </select>
                    </>
                  ) : null}
                  <input
                    value={authForm.username}
                    onChange={(event) => setAuthForm((current) => ({ ...current, username: event.target.value.toLowerCase() }))}
                    placeholder="Username หรืออีเมล เช่น beam หรือ you@email.com"
                    type="text"
                    autoCapitalize="none"
                    autoComplete="username"
                    className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-semibold outline-none"
                  />
                  <input
                    value={authForm.password}
                    onChange={(event) => setAuthForm((current) => ({ ...current, password: event.target.value }))}
                    placeholder="รหัสผ่าน"
                    type="password"
                    autoComplete={authMode === "signUp" ? "new-password" : "current-password"}
                    className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-semibold outline-none"
                  />
                  {authError ? <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700">{authError}</p> : null}
                  <button
                    type="button"
                    onClick={submitSupabaseAuth}
                    disabled={authLoading || !authForm.username || !authForm.password || (authMode === "signUp" && !authForm.fullName)}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-k2-ink px-5 py-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ShieldCheck className="h-5 w-5" />
                    {authLoading ? "กำลังตรวจสอบ..." : authMode === "signUp" ? "สร้าง Username และเข้าสู่ระบบ" : "เข้าสู่ระบบ"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mb-5 rounded-[1.35rem] border border-white/70 bg-white/50 p-4 text-sm font-semibold text-k2-muted">
                ยังไม่ได้ตั้งค่า Supabase env จึงใช้โหมดทดลองอยู่ เมื่อตั้งค่า `NEXT_PUBLIC_SUPABASE_URL` และ `NEXT_PUBLIC_SUPABASE_ANON_KEY` แล้ว หน้านี้จะเปิดใช้งาน Supabase Auth จริง
              </div>
            )}

          </motion.div>
        </section>
      </main>
    );
  }

  // งานที่ "ผู้ใช้คนนี้" มีสิทธิ์อนุมัติและยังค้างอยู่ → ใช้ทำหน้าจอกระพริบเตือน ผจก.
  const pendingApprovalJobs = jobs.filter((job) => job.acceptance === "pending" && canAcceptJob(job));

  return (
    <main className="min-h-screen px-3 py-3 text-k2-ink sm:px-5 sm:py-5">
      {pendingApprovalJobs.length > 0 ? (
        <>
          {/* ขอบจอกระพริบสีแดงเมื่อมีงานรออนุมัติ */}
          <motion.div
            aria-hidden
            className="pointer-events-none fixed inset-0 z-[80]"
            style={{ boxShadow: "inset 0 0 0 6px rgba(244,63,94,0.95)" }}
            animate={{ opacity: [0.12, 1, 0.12] }}
            transition={{ repeat: Infinity, duration: 1.1, ease: "easeInOut" }}
          />
          {/* แถบแจ้งเตือนกดเพื่อดูงานค้างทั้งแผนก */}
          <motion.button
            type="button"
            onClick={() => setShowPendingPanel(true)}
            animate={{ scale: [1, 1.04, 1] }}
            transition={{ repeat: Infinity, duration: 1.1, ease: "easeInOut" }}
            className="fixed left-1/2 top-3 z-[81] flex -translate-x-1/2 items-center gap-2 rounded-2xl bg-rose-600 px-5 py-2.5 text-sm font-extrabold text-white shadow-2xl ring-2 ring-white/70"
          >
            <Bell className="h-4 w-4" />
            มีงานรออนุมัติ {pendingApprovalJobs.length} งาน — กดดูงานค้าง
          </motion.button>
        </>
      ) : null}

      {/* กล่องงานค้างรออนุมัติทั้งแผนก */}
      {showPendingPanel ? (
        <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm" onClick={() => setShowPendingPanel(false)}>
          <div className="glass-solid my-6 w-full max-w-lg rounded-[1.6rem] p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-rose-600">งานค้างรออนุมัติ</p>
                <h3 className="text-xl font-extrabold">{pendingApprovalJobs.length} งานในแผนกของคุณ</h3>
              </div>
              <button type="button" onClick={() => setShowPendingPanel(false)} className="rounded-2xl bg-white/80 px-3 py-2 text-sm font-bold text-k2-ink shadow-sm">ปิด</button>
            </div>
            {pendingApprovalJobs.length === 0 ? (
              <p className="rounded-2xl bg-white/60 p-4 text-center text-sm font-semibold text-k2-muted">ไม่มีงานค้าง 🎉</p>
            ) : (
              <div className="soft-scrollbar max-h-[70vh] space-y-2 overflow-y-auto">
                {pendingApprovalJobs.map((job) => (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => { setSelectedJobId(job.id); setActiveView("Detail"); setShowPendingPanel(false); }}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white/75 px-4 py-3 text-left shadow-sm ring-1 ring-white/70 transition hover:bg-k2-mint hover:ring-k2-ink/30"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold text-k2-ink">{job.id} · {job.title}</p>
                      <p className="truncate text-xs font-semibold text-k2-muted">
                        {job.customerName || "-"}{job.productionBranch ? ` · 🏭 ${job.productionBranch}` : ""}{job.isExpress ? " · ⚡️ด่วน" : ""}
                      </p>
                      {job.salesPage ? (
                        <p className="truncate text-xs font-bold text-teal-700">📣 เพจ {job.salesPage}{job.incomeBranch ? ` · รายได้→${job.incomeBranch}` : ""}</p>
                      ) : null}
                    </div>
                    <span className="shrink-0 rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-700">กดอนุมัติ</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
      <div className="mx-auto flex max-w-[1800px] gap-4">
        <aside className="glass soft-scrollbar sticky top-5 hidden h-[calc(100dvh-2.5rem)] w-72 shrink-0 overflow-y-auto rounded-[1.7rem] p-4 lg:block">
          <BrandBlock currentUser={currentUserPrefs} onEditProfile={() => setShowPersonalization(true)} />
          <Nav activeView={activeView} items={menuItems} onChange={setActiveView} />
          <div className="mt-6 rounded-3xl bg-white/55 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-k2-muted">สิทธิ์ปัจจุบัน</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {roleSummaryPermissions[currentUser.role].slice(0, 4).map((item) => (
                <span key={item} className="rounded-full bg-white px-3 py-1 text-xs font-semibold shadow-sm">
                  {permissionLabel[item] ?? item}
                </span>
              ))}
            </div>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="glass glass-solid sticky top-3 z-30 mb-4 rounded-[1.5rem] p-3">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-3">
                {activeView !== homeView ? (
                  <>
                    <button
                      type="button"
                      onClick={() => window.history.back()}
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/75 text-k2-ink shadow-sm"
                      title="กลับ"
                      aria-label="กลับ"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveView(homeView)}
                      className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-k2-ink px-4 py-2.5 text-sm font-bold text-white shadow-sm"
                      title="กลับหน้าแรก"
                    >
                      <Home className="h-4 w-4" />
                      หน้าแรก
                    </button>
                  </>
                ) : null}
                <KLogoMark className="h-[5.25rem] w-[5.25rem] shrink-0 lg:hidden" />
                <div>
                  <p className="text-sm font-semibold text-k2-muted">{appTagline}</p>
                  <h2 className="text-2xl font-semibold">{viewLabel[activeView] ?? activeView}</h2>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <label className="flex min-w-0 items-center gap-2 rounded-2xl border border-white/70 bg-white/70 px-3 py-2 shadow-sm">
                  <Search className="h-4 w-4 shrink-0 text-k2-muted" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="ค้นหางาน ลูกค้า หรือทีมงาน"
                    className="w-full min-w-0 bg-transparent text-sm outline-none sm:w-72"
                  />
                </label>

                {/* งานด่วน — ผู้จัดการ/เจ้าของ: สวิตช์รับงานด่วน + อนุมัติคำขอ */}
                {canManageExpress ? (
                  <>
                    <button
                      onClick={toggleExpressOrders}
                      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold shadow-sm transition ${
                        expressOrdersEnabled ? "bg-rose-500 text-white shadow-rose-500/25" : "bg-white/70 text-k2-muted"
                      }`}
                      title={expressOrdersEnabled ? "ปิดรับงานด่วน" : "เปิดรับงานด่วน"}
                    >
                      <Zap className="h-4 w-4" />
                      {expressOrdersEnabled ? "รับงานด่วน: เปิด" : "รับงานด่วน: ปิด"}
                    </button>
                    {/* อนุมัติคำขอด่วน */}
                    <div ref={expressPanelRef} className="relative">
                      <button
                        onClick={() => { setShowExpressPanel((prev) => !prev); void reloadExpressRequests(); }}
                        className="relative inline-flex items-center gap-2 rounded-2xl bg-white/70 px-4 py-2.5 text-sm font-semibold text-k2-muted shadow-sm"
                        title="คำขอสร้างงานด่วน"
                      >
                        <Zap className="h-4 w-4" />
                        อนุมัติด่วน
                        {pendingExpressRequests.length > 0 && (
                          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
                            {Math.min(pendingExpressRequests.length, 9)}{pendingExpressRequests.length > 9 ? "+" : ""}
                          </span>
                        )}
                      </button>
                      {showExpressPanel && (
                        <div className="absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-[1.25rem] border border-white/80 bg-white/97 shadow-2xl backdrop-blur-xl">
                          <div className="border-b border-white/60 px-4 py-3 text-sm font-bold">คำขอสร้างงานด่วน</div>
                          <div className="max-h-96 overflow-y-auto">
                            {pendingExpressRequests.length === 0 ? (
                              <p className="px-4 py-8 text-center text-sm font-semibold text-k2-muted">ไม่มีคำขอรออนุมัติ</p>
                            ) : (
                              pendingExpressRequests.map((req) => (
                                <div key={req.id} className="flex flex-col gap-2 border-b border-white/40 px-4 py-3">
                                  <div>
                                    <p className="text-sm font-bold">{req.requestedByName || "พนักงาน"}</p>
                                    <p className="text-xs text-k2-muted">{new Date(req.createdAt).toLocaleString("th-TH")}</p>
                                  </div>
                                  <div className="flex gap-2">
                                    <button onClick={() => void decideExpress(req.id, "approved")} className="flex-1 rounded-xl bg-teal-500 px-3 py-2 text-xs font-extrabold text-white">อนุมัติ</button>
                                    <button onClick={() => void decideExpress(req.id, "rejected")} className="flex-1 rounded-xl bg-white/70 px-3 py-2 text-xs font-extrabold text-rose-600 shadow-sm">ปฏิเสธ</button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : can("create_job") ? (
                  /* เซลส์: ปุ่มขออนุมัติงานด่วน ตามสถานะคำขอ */
                  myApprovedExpressRequest ? (
                    <span className="inline-flex items-center gap-1.5 rounded-2xl bg-teal-100 px-3 py-2.5 text-sm font-bold text-teal-700" title="สร้างงานด่วนได้เลย">
                      <Zap className="h-4 w-4" />
                      อนุมัติด่วนแล้ว ✓
                    </span>
                  ) : myLatestExpressRequest?.status === "pending" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-2xl bg-amber-100 px-3 py-2.5 text-sm font-bold text-amber-700">
                      <Zap className="h-4 w-4" />
                      รออนุมัติด่วน...
                    </span>
                  ) : (
                    <button
                      onClick={() => void requestExpress()}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/70 px-4 py-2.5 text-sm font-semibold text-rose-600 shadow-sm"
                      title="ขออนุมัติสร้างงานด่วน"
                    >
                      <Zap className="h-4 w-4" />
                      ขออนุมัติงานด่วน
                    </button>
                  )
                ) : null}

                {/* กระดิ่งแจ้งเตือน */}
                <div ref={notifPanelRef} className="relative">
                  <button
                    onClick={() => {
                      setShowNotifPanel((prev) => !prev);
                      markAllNotifsRead();
                    }}
                    className="relative inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/70 text-k2-muted shadow-sm"
                    aria-label="การแจ้งเตือน"
                  >
                    <Bell className="h-4 w-4" />
                    {notifications.some((n) => !n.read) && (
                      <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
                        {Math.min(notifications.filter((n) => !n.read).length, 9)}
                        {notifications.filter((n) => !n.read).length > 9 ? "+" : ""}
                      </span>
                    )}
                  </button>

                  {showNotifPanel && (
                    <div className="absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-[1.25rem] border border-white/80 bg-white/97 shadow-2xl backdrop-blur-xl">
                      <div className="flex items-center justify-between border-b border-white/60 px-4 py-3">
                        <span className="text-sm font-bold">การแจ้งเตือน</span>
                        {notifications.length > 0 && (
                          <button
                            onClick={clearAllNotifs}
                            className="text-xs font-semibold text-k2-muted hover:text-k2-ink"
                          >
                            ล้างทั้งหมด
                          </button>
                        )}
                      </div>
                      <div className="max-h-96 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <p className="px-4 py-8 text-center text-sm font-semibold text-k2-muted">ยังไม่มีการแจ้งเตือน</p>
                        ) : (
                          notifications.map((notif) => (
                            <button
                              key={notif.id}
                              onClick={() => {
                                setSelectedJobId(notif.jobId);
                                setActiveView("Detail");
                                setShowNotifPanel(false);
                              }}
                              className={`flex w-full flex-col gap-1 border-b border-white/40 px-4 py-3 text-left hover:bg-white/60 ${notif.read ? "opacity-55" : "bg-teal-50/60"}`}
                            >
                              <p className="text-sm font-semibold leading-snug">{notif.message}</p>
                              <p className="text-xs text-k2-muted">{notif.at}</p>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {can("create_job") ? (
                  <button
                    onClick={() => setActiveView("Create Job")}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-k2-ink px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/15"
                  >
                    <Plus className="h-4 w-4" />
                    สร้างงาน
                  </button>
                ) : null}
                {/* โปรไฟล์ของฉัน — ไอคอนมุมขวาบน (เห็นทุกอุปกรณ์ รวมมือถือ) */}
                <button
                  onClick={() => setShowMyProfile(true)}
                  className="inline-flex items-center gap-2 rounded-2xl bg-white/70 px-2.5 py-1.5 text-sm font-semibold text-k2-ink shadow-sm"
                  title="โปรไฟล์ของฉัน"
                  aria-label="โปรไฟล์ของฉัน"
                >
                  <MemberAvatar member={currentUserPrefs} className="h-8 w-8 rounded-xl text-xs" />
                  <span className="hidden max-w-[8rem] truncate sm:inline">{currentUserPrefs.nickname || currentUser.name}</span>
                </button>
                <button
                  onClick={signOut}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/70 px-4 py-2.5 text-sm font-semibold text-k2-muted shadow-sm"
                >
                  <LogOut className="h-4 w-4" />
                  ออกจากระบบ
                </button>
              </div>
            </div>
            <div className="mt-3 lg:hidden">
              <button
                type="button"
                onClick={() => setMobileMenuOpen((open) => !open)}
                className="flex w-full items-center justify-between rounded-2xl bg-k2-ink px-4 py-3 text-sm font-bold text-white shadow-sm transition active:scale-[0.98]"
              >
                <span className="flex items-center gap-2">
                  <Menu className="h-4 w-4" />
                  เมนู · {viewLabel[activeView] ?? activeView}
                </span>
                <ChevronDown className={`h-5 w-5 transition-transform duration-300 ${mobileMenuOpen ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence initial={false}>
                {mobileMenuOpen ? (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22 }}
                    className="overflow-hidden"
                  >
                    <div className="soft-scrollbar mt-2 grid max-h-[70dvh] grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-5">
                      {menuItems.map(({ label: item, icon: Icon }) => (
                        <button
                          key={item}
                          onClick={() => { setActiveView(item); setMobileMenuOpen(false); }}
                          className={`flex flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-center text-[11px] font-semibold leading-tight transition active:scale-95 ${
                            activeView === item
                              ? "bg-k2-ink text-white shadow-md"
                              : "bg-white/70 text-k2-muted hover:bg-k2-mint hover:text-k2-ink hover:shadow hover:ring-2 hover:ring-k2-ink/40"
                          }`}
                        >
                          <Icon className="h-5 w-5 shrink-0" />
                          <span>{viewLabel[item] ?? item}</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </header>

          {dataLoading && jobs.length > 0 ? (
            <div className="mb-4 rounded-3xl border border-white/80 bg-white/70 px-5 py-3 text-sm font-extrabold text-k2-muted shadow-sm">
              กำลังอัปเดตข้อมูลจาก Supabase...
            </div>
          ) : null}
          {dataError ? (
            <div className="mb-4 rounded-3xl border border-rose-100 bg-rose-50 px-5 py-3 text-sm font-extrabold text-rose-700 shadow-sm">
              {dataError}
            </div>
          ) : null}

          {/* ปุ่มเช็คอินใหญ่ — โชว์เด่นบนหน้าแรก */}
          {activeView === homeView ? (
            <div className="mb-4">
              <CheckInControl
                variant="hero"
                branch={currentUser.branch}
                myAttendance={myAttendance}
                onCheckIn={checkIn}
                onCheckOut={checkOut}
              />
            </div>
          ) : null}

          {dataLoading && jobs.length === 0 ? <LoadingSkeleton /> : (
          <AnimatePresence>
            {activeView === "Executive" && <ExecutiveDashboard jobs={jobs} />} {activeView === "Dashboard" && (
              <motion.div key="dashboard" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <Dashboard metrics={metrics} jobs={filteredJobs} canSeeMoney={canSeeMoney} onSelect={openJobDetail} />
              </motion.div>
            )}
            {activeView === "My Jobs" && (
              <motion.div key="my-jobs" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <MyJobsView
                  jobs={filteredJobs}
                  currentUser={currentUser}
                  canSeeMoney={canSeeMoney}
                  onSelect={(id) => {
                    setSelectedJobId(id);
                    setActiveView("Detail");
                  }}
                />
              </motion.div>
            )}
            {activeView === "Board" && (
              <motion.div key="board" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <Board
                  jobs={filteredJobs}
                  draggedJobId={draggedJobId}
                  setDraggedJobId={setDraggedJobId}
                  moveJob={requestMove}
                  onAccept={acceptJob}
                  onReject={rejectJob}
                  canAccept={canAcceptJob}
                  onSelect={(id) => {
                    setSelectedJobId(id);
                    setActiveView("Detail");
                  }}
                />
              </motion.div>
            )}
            {activeView === "Completed" && (
              <motion.div key="completed" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <CompletedJobsView jobs={branchScopedJobs} canSeeMoney={canSeeMoney} onSelect={openJobDetail} />
              </motion.div>
            )}
            {activeView === "Calendar" && (
              <motion.div key="calendar" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <CalendarView jobs={filteredJobs} customers={customerRecords} onSelect={openJobDetail} />
              </motion.div>
            )}
            {activeView === "Create Job" && (
              <motion.div key="create" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <CreateJobView key={createJobNonce} prefill={createJobPrefill} customers={customerRecords} teamMembers={teamMembers} companyProfile={companyProfile} expressEnabled={canCreateExpress} canAssign={can("assign_staff")} onCreate={createJob} />
              </motion.div>
            )}
            {activeView === "Leads" && (
              <motion.div key="leads-inbox" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <LeadsView
                  leads={leads}
                  onCreate={createLead}
                  onSetStatus={updateLeadStatus}
                  onConvert={convertLeadToQuotation}
                />
              </motion.div>
            )}
            {activeView === "Quotations" && (
              <motion.div key="quotations" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <QuotationsView
                  quotations={quotations}
                  customers={customerRecords}
                  canSeeMoney={canSeeMoney}
                  onCreate={createQuotation}
                  onSetStatus={updateQuotationStatus}
                  onConvert={convertQuotationToJob}
                />
              </motion.div>
            )}
            {activeView === "Customers" && (
              <motion.div key="customers" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <CustomersView
                  customers={customerRecords}
                  jobs={jobs}
                  canDelete={can("delete_customer")}
                  onAddCustomer={addCustomer}
                  onUpdateCustomer={updateCustomer}
                  onRemoveCustomer={removeCustomer}
                  onAssignCode={assignCustomerCode}
                />
              </motion.div>
            )}
            {activeView === "Payments" && (
              <motion.div key="payments" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <PaymentsView jobs={filteredJobs} canSeeMoney={canSeeMoney} onSelect={openJobDetail} />
              </motion.div>
            )}
            {activeView === "Reports" && (
              <motion.div key="reports" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <ReportsView jobs={jobs} canSeeMoney={canSeeMoney} />
              </motion.div>
            )}
            {activeView === "Finance" && (
              <motion.div key="finance" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <FinanceView jobs={jobs} />
              </motion.div>
            )}
            {activeView === "Settings" && currentUser.role === "Owner" && (
              <motion.div key="settings" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <SettingsView
                  currentUserId={currentUser.id}
                  currentRole={currentUser.role}
                  teamMembers={teamMembers}
                  companyProfile={companyProfile}
                  onUpdateCompany={saveCompanyProfile}
                  onAddMember={addTeamMember}
                  onUpdateMember={updateTeamMember}
                  onUpdateMemberAvatar={updateTeamMemberAvatar}
                  onRemoveMember={removeTeamMember}
                  onResetMemberPassword={resetMemberPassword}
                  permissionMatrix={permissionMatrix}
                  onUpdateRolePermission={updateRolePermission}
                  onResetRolePermissions={resetRolePermissions}
                />
              </motion.div>
            )}
            {activeView === "Detail" && (
              <motion.div key="detail" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                {selectedJob ? (
                  <>
                  <LineInvitePanel job={selectedJob} customer={customerRecords.find((item) => item.id === selectedJob.customerId)} onMarkFriend={markCustomerLineFriend} />
                  <HandoffPanel job={selectedJob} currentUser={currentUser} onSubmit={submitHandoff} onAccept={acceptHandoff} onReject={rejectHandoff} />
                  <JobDetail job={selectedJob} companyProfile={companyProfile} canSeeMoney={canSeeMoney} canEditPayment={can("edit_payment")} canDeleteJob={can("delete_job")} canConfirmDeposit={can("manage_finance") || ["Owner", "Manager", "Admin"].includes(currentUser.role)} canApproveWaiver={currentUser.role === "Owner"} onPayment={updatePayment} onConfirmDeposit={confirmDeposit} onReceiveBalance={receiveBalance} onComment={addComment} onMove={requestMove} onDelete={removeJob} teamMembers={teamMembers} canAssign={can("assign_staff") && canAcceptJob(selectedJob)} onAssign={assignStaff} canEditJob={can("edit_job") && (currentUser.role === "Owner" || !["Ready for Production", "In Production", "QC", "Packing", "Delivered / Picked Up", "Completed", "Cancelled"].includes(selectedJob.status))} onUpdateJob={updateJob} canAttach={can("edit_job")} onUploadFile={uploadJobFile} onDeleteFile={removeJobFile} />
                  </>
                ) : (
                  <EmptyState title="ยังไม่มีงานในระบบ" text="เริ่มจากสร้างลูกค้าและสร้างงานแรกได้เลย" action={() => setActiveView("Create Job")} />
                )}
              </motion.div>
            )}
            {activeView === "HR" && can("manage_hr") && (
              <motion.div key="hr" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <HRView teamMembers={teamMembers} records={hrRecords} canEdit={can("manage_hr")} onSave={saveHrRecord} branches={BRANCH_LIST} branchSettings={branchSettings} onSaveBranch={saveBranchSetting} holidays={holidays} onAddHoliday={addHoliday} onRemoveHoliday={removeHoliday} />
              </motion.div>
            )}
            {activeView === "Attendance" && (
              <motion.div key="attendance" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <AttendanceView
                  currentUser={currentUser}
                  branchSetting={currentUser.branch ? branchSettings[currentUser.branch] : undefined}
                  myAttendance={myAttendance}
                  allAttendance={allAttendance}
                  teamMembers={teamMembers}
                  isHr={can("manage_hr")}
                  onCheckIn={checkIn}
                  onCheckOut={checkOut}
                  overtime={overtimeRecords}
                  canGrantOt={userHasRole(currentUser, "Manager") || can("manage_hr") || currentUser.role === "Owner"}
                  onAddOvertime={addOvertime}
                />
              </motion.div>
            )}
            {activeView === "Leave" && (
              <motion.div key="leave" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <LeaveView
                  currentUser={currentUser}
                  teamMembers={teamMembers}
                  leaveRequests={leaveRequests}
                  holidays={holidays}
                  isHr={can("manage_hr")}
                  onSubmit={submitLeave}
                  onReview={reviewLeave}
                />
              </motion.div>
            )}
            {activeView === "Payroll" && (
              <motion.div key="payroll" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <PayrollView
                  teamMembers={teamMembers}
                  records={hrRecords}
                  summary={payrollSummary}
                  month={payrollMonth}
                  onMonthChange={setPayrollMonth}
                  companyName={companyProfile.legalName || companyProfile.name}
                />
              </motion.div>
            )}
            {activeView === "Audit" && (
              <motion.div key="audit" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <AuditLog auditLog={auditLog} />
              </motion.div>
            )}
          </AnimatePresence>
          )}
        </section>
      </div>

      {pendingMove ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
          onClick={() => setPendingMove(null)}
        >
          <div className="glass-solid w-full max-w-sm rounded-[1.6rem] p-6" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-xl font-extrabold text-k2-ink">ยืนยันการย้ายสถานะ</h3>
            <p className="mt-3 leading-7 text-k2-muted">
              ย้ายงานนี้จาก{" "}
              <span className="font-extrabold text-k2-ink">{statusLabel[pendingMove.from]}</span>
              {" "}ไป{" "}
              <span className="font-extrabold text-k2-ink">{statusLabel[pendingMove.to]}</span>
              {" "}ใช่ไหม?
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setPendingMove(null)}
                className="flex-1 rounded-2xl bg-white/70 px-4 py-3 font-bold text-k2-muted"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => {
                  const move = pendingMove;
                  setPendingMove(null);
                  void moveJob(move.jobId, move.to);
                }}
                className="flex-1 rounded-2xl bg-k2-ink px-4 py-3 font-bold text-white"
              >
                ตกลง ย้ายเลย
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showPersonalization ? (
        <PersonalizationModal
          currentUser={currentUserPrefs}
          onUpdate={updatePersonalization}
          onClose={() => setShowPersonalization(false)}
        />
      ) : null}

      {showMyProfile ? (
        <MyProfileModal
          currentUser={currentUserPrefs}
          onSaveProfile={(name, phone) => updateTeamMember(currentUser.id, { name, role: currentUser.role, branch: currentUser.branch, phone })}
          onUploadAvatar={(avatarUrl) => updateTeamMemberAvatar(currentUser.id, avatarUrl)}
          onChangePassword={changeOwnPassword}
          onOpenPersonalization={() => { setShowMyProfile(false); setShowPersonalization(true); }}
          onSignOut={signOut}
          onClose={() => setShowMyProfile(false)}
        />
      ) : null}

      {activeView !== homeView ? (
        <CheckInControl
          variant="fab"
          branch={currentUser.branch}
          myAttendance={myAttendance}
          onCheckIn={checkIn}
          onCheckOut={checkOut}
        />
      ) : null}

    </main>
  );
}

function PersonalizationModal({
  currentUser,
  onUpdate,
  onClose
}: {
  currentUser: TeamMember;
  onUpdate: (updates: PersonalizationPrefs) => void;
  onClose: () => void;
}) {
  const [nickname, setNickname] = useState(currentUser.nickname ?? "");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-solid max-h-[88vh] w-full max-w-md overflow-y-auto rounded-[1.6rem] p-6" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center gap-3">
          <MemberAvatar member={currentUser} className="h-14 w-14 rounded-2xl text-base" />
          <div className="min-w-0">
            <h3 className="text-xl font-extrabold text-k2-ink">ปรับแต่งโปรไฟล์ของฉัน</h3>
            <p className="text-sm font-semibold text-k2-muted">ชื่อเล่น · กรอบสี · สถานะ (เห็นบนเครื่องนี้)</p>
          </div>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-k2-muted">ชื่อเล่น</span>
          <div className="flex gap-2">
            <input
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              placeholder={currentUser.name}
              className="min-w-0 flex-1 rounded-2xl border border-white/80 bg-white/85 px-4 py-3 text-sm font-semibold outline-none"
            />
            <button
              type="button"
              onClick={() => onUpdate({ nickname: nickname.trim() || undefined })}
              className="rounded-2xl bg-k2-ink px-4 text-sm font-extrabold text-white"
            >
              บันทึก
            </button>
          </div>
        </label>

        <div className="mt-5">
          <p className="mb-2 text-sm font-bold text-k2-muted">สีกรอบรูป</p>
          <div className="flex flex-wrap gap-2">
            {AVATAR_BORDER_PRESETS.map((preset) => {
              const isSelected = (currentUser.avatarBorderColor ?? "") === preset.value;
              return (
                <button
                  key={preset.label}
                  type="button"
                  title={preset.label}
                  onClick={() => onUpdate({ avatarBorderColor: preset.value || undefined })}
                  className={`h-9 w-9 rounded-full ring-2 transition ${isSelected ? "scale-110 ring-k2-ink" : "ring-white/70"}`}
                  style={{ background: preset.value || "rgba(167,139,250,0.7)" }}
                />
              );
            })}
          </div>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-sm font-bold text-k2-muted">สถานะ</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onUpdate({ statusEmoji: undefined, statusText: undefined })}
              className={`rounded-2xl px-3 py-2.5 text-left text-sm font-bold ${!currentUser.statusEmoji ? "bg-k2-ink text-white" : "bg-white/70 text-k2-muted"}`}
            >
              ไม่แสดงสถานะ
            </button>
            {STATUS_PRESETS.map((preset) => {
              const isActive = currentUser.statusEmoji === preset.emoji && currentUser.statusText === preset.text;
              return (
                <button
                  key={preset.text}
                  type="button"
                  onClick={() => onUpdate({ statusEmoji: preset.emoji, statusText: preset.text })}
                  className={`rounded-2xl px-3 py-2.5 text-left text-sm font-bold ${isActive ? "bg-k2-ink text-white" : "bg-white/70 text-k2-muted"}`}
                >
                  {preset.emoji} {preset.text}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-2xl bg-k2-ink px-4 py-3 font-extrabold text-white"
        >
          เสร็จสิ้น
        </button>
      </div>
    </div>
  );
}

function MyProfileModal({
  currentUser,
  onSaveProfile,
  onUploadAvatar,
  onChangePassword,
  onOpenPersonalization,
  onSignOut,
  onClose
}: {
  currentUser: TeamMember;
  onSaveProfile: (name: string, phone: string) => void;
  onUploadAvatar: (avatarUrl: string) => void;
  onChangePassword: (newPassword: string) => Promise<boolean>;
  onOpenPersonalization: () => void;
  onSignOut: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(currentUser.name);
  const [phone, setPhone] = useState(currentUser.phone ?? "");
  const [savedMsg, setSavedMsg] = useState("");
  const [avatarError, setAvatarError] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  async function handleAvatar(file: File | null) {
    if (!file) return;
    setAvatarError("");
    if (!file.type.startsWith("image/")) {
      setAvatarError("กรุณาเลือกไฟล์รูปภาพเท่านั้น");
      return;
    }
    if (file.size > 1_200_000) {
      setAvatarError("รูปโปรไฟล์ต้องมีขนาดไม่เกิน 1.2 MB");
      return;
    }
    const dataUrl = await readImageAsDataUrl(file);
    onUploadAvatar(dataUrl);
  }

  function handleSaveProfile() {
    if (!name.trim()) return;
    onSaveProfile(name.trim(), phone.trim());
    setSavedMsg("บันทึกแล้ว ✓");
    setTimeout(() => setSavedMsg(""), 2500);
  }

  async function handleChangePassword() {
    setPwMsg("");
    if (password.length < 6) {
      setPwMsg("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }
    if (password !== passwordConfirm) {
      setPwMsg("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
      return;
    }
    setPwBusy(true);
    const ok = await onChangePassword(password);
    setPwBusy(false);
    if (ok) {
      setPassword("");
      setPasswordConfirm("");
      setPwMsg("เปลี่ยนรหัสผ่านสำเร็จ ✓");
      setTimeout(() => setPwMsg(""), 3000);
    } else {
      setPwMsg("เปลี่ยนรหัสผ่านไม่สำเร็จ (ดูข้อความแจ้งเตือนด้านบน)");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-solid max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[1.6rem] p-6" onClick={(event) => event.stopPropagation()}>
        <div className="mb-5 flex items-center gap-3">
          <MemberAvatar member={currentUser} className="h-16 w-16 rounded-2xl text-lg" />
          <div className="min-w-0">
            <h3 className="text-xl font-extrabold text-k2-ink">โปรไฟล์ของฉัน</h3>
            <p className="text-sm font-semibold text-k2-muted">{roleLabel[currentUser.role]}</p>
          </div>
        </div>

        {/* รูปโปรไฟล์ */}
        <div className="mb-5">
          <p className="mb-1.5 text-sm font-bold text-k2-muted">รูปโปรไฟล์</p>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-white/70 px-4 py-2.5 text-sm font-bold text-k2-ink shadow-sm">
            <FileImage className="h-4 w-4" />
            เปลี่ยนรูป
            <input type="file" accept="image/*" className="hidden" onChange={(event) => handleAvatar(event.target.files?.[0] ?? null)} />
          </label>
          {avatarError ? <p className="mt-1.5 text-xs font-semibold text-rose-600">{avatarError}</p> : null}
        </div>

        {/* ชื่อ + เบอร์ */}
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-k2-muted">ชื่อ</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="ชื่อ-สกุล"
            className="w-full rounded-2xl border border-white/80 bg-white/85 px-4 py-3 text-sm font-semibold outline-none"
          />
        </label>
        <label className="mt-3 block">
          <span className="mb-1.5 block text-sm font-bold text-k2-muted">เบอร์โทร</span>
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="เช่น 081-234-5678"
            inputMode="tel"
            className="w-full rounded-2xl border border-white/80 bg-white/85 px-4 py-3 text-sm font-semibold outline-none"
          />
        </label>
        <button
          type="button"
          onClick={handleSaveProfile}
          className="mt-3 w-full rounded-2xl bg-k2-ink px-4 py-3 text-sm font-extrabold text-white"
        >
          บันทึกชื่อ/เบอร์
        </button>
        {savedMsg ? <p className="mt-2 text-center text-sm font-bold text-teal-600">{savedMsg}</p> : null}

        {/* เปลี่ยนรหัสผ่าน */}
        <div className="mt-6 border-t border-white/60 pt-5">
          <p className="mb-2 text-sm font-bold text-k2-muted">เปลี่ยนรหัสผ่าน</p>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="รหัสผ่านใหม่ (อย่างน้อย 6 ตัว)"
            className="w-full rounded-2xl border border-white/80 bg-white/85 px-4 py-3 text-sm font-semibold outline-none"
          />
          <input
            type="password"
            value={passwordConfirm}
            onChange={(event) => setPasswordConfirm(event.target.value)}
            placeholder="ยืนยันรหัสผ่านใหม่"
            className="mt-2 w-full rounded-2xl border border-white/80 bg-white/85 px-4 py-3 text-sm font-semibold outline-none"
          />
          <button
            type="button"
            onClick={handleChangePassword}
            disabled={pwBusy}
            className="mt-3 w-full rounded-2xl bg-white/70 px-4 py-3 text-sm font-extrabold text-k2-ink shadow-sm disabled:opacity-50"
          >
            {pwBusy ? "กำลังเปลี่ยน..." : "เปลี่ยนรหัสผ่าน"}
          </button>
          {pwMsg ? <p className="mt-2 text-center text-sm font-bold text-k2-ink">{pwMsg}</p> : null}
        </div>

        {/* ปรับแต่ง (ชื่อเล่น/สี/สถานะ) + ออกจากระบบ */}
        <div className="mt-6 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onOpenPersonalization}
            className="rounded-2xl bg-white/70 px-4 py-3 text-sm font-bold text-k2-ink shadow-sm"
          >
            ✨ ปรับแต่ง
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="rounded-2xl bg-white/70 px-4 py-3 text-sm font-bold text-rose-600 shadow-sm"
          >
            ออกจากระบบ
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full rounded-2xl bg-k2-ink px-4 py-3 font-extrabold text-white"
        >
          เสร็จสิ้น
        </button>
      </div>
    </div>
  );
}

function BrandBlock({ currentUser, onEditProfile }: { currentUser: TeamMember; onEditProfile?: () => void }) {
  return (
    <div className="mb-6">
      <div className="mb-5 flex items-center gap-3">
        <KLogoMark className="h-[6.5rem] w-[6.5rem]" />
        <KLogoLockup size="sidebar" />
      </div>
      <button
        type="button"
        onClick={onEditProfile}
        title="ปรับแต่งโปรไฟล์ของฉัน"
        className="group w-full rounded-3xl bg-white/60 p-4 text-left transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-k2-ink/30"
      >
        <div className="flex items-center gap-3">
          <MemberAvatar member={currentUser} className="h-10 w-10 rounded-2xl text-sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{currentUser.nickname || currentUser.name}</p>
            <p className="truncate text-sm text-k2-muted">{roleLabel[currentUser.role]}</p>
            {currentUser.statusText ? (
              <p className="mt-0.5 truncate text-xs text-k2-muted">{currentUser.statusEmoji} {currentUser.statusText}</p>
            ) : null}
          </div>
          <Sparkles className="h-4 w-4 shrink-0 text-k2-muted transition group-hover:scale-110" />
        </div>
      </button>
    </div>
  );
}

function MemberAvatar({ member: rawMember, className = "h-12 w-12 rounded-2xl text-sm" }: { member: TeamMember; className?: string }) {
  const member = mergePersonalization(rawMember);
  const ringStyle: React.CSSProperties = member.avatarBorderColor
    ? ({ "--tw-ring-color": member.avatarBorderColor } as React.CSSProperties)
    : {};
  const ringClass = `ring-2 ${member.avatarBorderColor ? "" : "ring-white/70"}`;

  const inner = member.avatarUrl ? (
    <Image
      src={member.avatarUrl}
      alt={member.name}
      width={96}
      height={96}
      unoptimized
      className={`${className} object-cover shadow-sm ${ringClass}`}
      style={ringStyle}
    />
  ) : (
    <span
      className={`grid place-items-center bg-k2-lilac font-extrabold text-violet-800 shadow-sm ${ringClass} ${className}`}
      style={ringStyle}
    >
      {member.avatar}
    </span>
  );

  return (
    <div className="relative inline-flex shrink-0">
      {inner}
      {member.statusEmoji ? (
        <span className="pointer-events-none absolute -bottom-1.5 -right-0.5 select-none text-[14px] leading-none">
          {member.statusEmoji}
        </span>
      ) : null}
    </div>
  );
}

function KLogoMark({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/assets/k2smart-logo.png"
      alt="K2Smart app logo"
      width={320}
      height={320}
      className={`k2-logo-mark object-contain ${className}`}
      priority
    />
  );
}

function KLogoLockup({ size }: { size: "hero" | "sidebar" }) {
  if (size === "sidebar") {
    return (
      <div className="leading-none">
        <span className="sr-only">K2Smart</span>
      </div>
    );
  }

  return (
    <div className="w-fit">
      <KLogoMark className="mx-auto h-56 w-56 sm:h-72 sm:w-72" />
      <span className="sr-only">K2Smart</span>
    </div>
  );
}

function Nav({
  activeView,
  items,
  onChange
}: {
  activeView: string;
  items: Array<{ label: string; icon: LucideIcon }>;
  onChange: (view: string) => void;
}) {
  return (
    <nav className="grid grid-cols-2 gap-2">
      {items.map(({ label, icon: Icon }) => (
        <button
          key={label}
          onClick={() => onChange(label)}
          className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl px-2 py-3 text-center text-xs font-semibold leading-tight transition active:scale-95 ${
            activeView === label
              ? "bg-k2-ink text-white shadow-lg shadow-slate-900/15"
              : "text-k2-muted hover:bg-k2-mint hover:text-k2-ink hover:shadow-md hover:ring-2 hover:ring-k2-ink/30"
          }`}
        >
          <Icon className="h-5 w-5 shrink-0" />
          <span>{viewLabel[label] ?? label}</span>
        </button>
      ))}
    </nav>
  );
}

function jobIsAssignedTo(job: Job, user: TeamMember) {
  return job.assignedDesigner === user.name || job.assignedProduction === user.name;
}

function MyJobsView({
  jobs,
  currentUser,
  canSeeMoney,
  onSelect
}: {
  jobs: Job[];
  currentUser: TeamMember;
  canSeeMoney: boolean;
  onSelect: (id: string) => void;
}) {
  const mine = useMemo(() => jobs.filter((job) => jobIsAssignedTo(job, currentUser)), [jobs, currentUser]);
  const openJobs = mine.filter((job) => !["Completed", "Cancelled"].includes(job.status));
  const doneJobs = mine.filter((job) => ["Completed", "Cancelled"].includes(job.status));
  const overdue = openJobs.filter((job) => daysFromToday(job.dueDate) < 0).length;
  const dueToday = openJobs.filter((job) => daysFromToday(job.dueDate) === 0).length;
  const ordered = openJobs.slice().sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return (
    <div className="space-y-4">
      <div className="glass flex flex-wrap items-center gap-3 rounded-[1.5rem] p-5">
        <div>
          <p className="text-sm font-semibold text-k2-muted">งานที่มอบหมายให้</p>
          <h3 className="text-2xl font-semibold">{currentUser.name}</h3>
        </div>
        <div className="ml-auto flex flex-wrap gap-2 text-xs font-bold">
          <span className="rounded-full bg-k2-sky px-3 py-1.5">กำลังทำ {openJobs.length}</span>
          <span className="rounded-full bg-k2-peach px-3 py-1.5">ครบกำหนดวันนี้ {dueToday}</span>
          <span className={`rounded-full px-3 py-1.5 ${overdue ? "bg-k2-rose text-rose-700" : "bg-white/70 text-k2-muted"}`}>เลยกำหนด {overdue}</span>
        </div>
      </div>

      <div className="glass rounded-[1.5rem] p-5">
        <h3 className="mb-4 text-xl font-semibold">งานที่ต้องทำ</h3>
        {ordered.length ? (
          <div className="space-y-3">
            {ordered.map((job) => (
              <JobRow key={job.id} job={job} canSeeMoney={canSeeMoney} onSelect={onSelect} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/90 bg-white/40 px-4 py-10 text-center text-sm font-semibold text-k2-muted">
            ยังไม่มีงานที่มอบหมายให้คุณ
          </div>
        )}
      </div>

      {doneJobs.length ? (
        <div className="glass rounded-[1.5rem] p-5">
          <h3 className="mb-4 text-xl font-semibold">เสร็จแล้ว / ปิดงาน ({doneJobs.length})</h3>
          <div className="space-y-3">
            {doneJobs.map((job) => (
              <JobRow key={job.id} job={job} canSeeMoney={canSeeMoney} onSelect={onSelect} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// แปลงวันที่จาก statusHistory (รูปแบบ en-GB "dd/mm/yyyy, hh:mm:ss") → ISO "yyyy-mm-dd"
function parseEnGbDate(value: string): string | null {
  const datePart = value.split(",")[0]?.trim();
  const match = datePart?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

// วันที่ปิดงานจริง = ครั้งล่าสุดที่เปลี่ยนสถานะเป็น "เสร็จสิ้น/ยกเลิก" (ถ้าหาไม่เจอใช้กำหนดส่งแทน)
function jobClosedDate(job: Job): string {
  const closed = [...job.statusHistory].reverse().find((event) => event.to === "Completed" || event.to === "Cancelled");
  return (closed ? parseEnGbDate(closed.at) : null) ?? job.dueDate;
}

// หน้ารวมงานที่เสร็จ/ปิดแล้วทั้งหมด (สำหรับหัวหน้า/แอดมิน) — มีตัวค้นหาข้อความ ช่วงวันที่ และสถานะ
function CompletedJobsView({ jobs, canSeeMoney, onSelect }: { jobs: Job[]; canSeeMoney: boolean; onSelect: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "Completed" | "Cancelled">("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const closedJobs = useMemo(
    () => jobs.filter((job) => job.status === "Completed" || job.status === "Cancelled"),
    [jobs]
  );

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return closedJobs
      .map((job) => ({ job, closedDate: jobClosedDate(job) }))
      .filter(({ job, closedDate }) => {
        if (statusFilter !== "all" && job.status !== statusFilter) return false;
        if (fromDate && closedDate < fromDate) return false;
        if (toDate && closedDate > toDate) return false;
        if (normalized) {
          const haystack = [job.id, job.customerName, job.title, job.type, job.assignedDesigner, job.assignedProduction]
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(normalized)) return false;
        }
        return true;
      })
      .sort((a, b) => b.closedDate.localeCompare(a.closedDate));
  }, [closedJobs, query, statusFilter, fromDate, toDate]);

  const hasFilters = Boolean(query.trim() || statusFilter !== "all" || fromDate || toDate);
  const completedCount = results.filter(({ job }) => job.status === "Completed").length;
  const cancelledCount = results.filter(({ job }) => job.status === "Cancelled").length;

  function clearFilters() {
    setQuery("");
    setStatusFilter("all");
    setFromDate("");
    setToDate("");
  }

  const filterButtons: Array<{ key: "all" | "Completed" | "Cancelled"; label: string }> = [
    { key: "all", label: "ทั้งหมด" },
    { key: "Completed", label: "เสร็จสิ้น" },
    { key: "Cancelled", label: "ยกเลิก" }
  ];

  return (
    <div className="space-y-4">
      <div className="glass flex flex-wrap items-center gap-3 rounded-[1.5rem] p-5">
        <div>
          <p className="text-sm font-semibold text-k2-muted">รวมงานที่ปิดแล้วทั้งหมด</p>
          <h3 className="text-2xl font-semibold">งานที่เสร็จแล้ว</h3>
        </div>
        <div className="ml-auto flex flex-wrap gap-2 text-xs font-bold">
          <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-emerald-700">เสร็จสิ้น {completedCount}</span>
          <span className="rounded-full bg-k2-rose px-3 py-1.5 text-rose-700">ยกเลิก {cancelledCount}</span>
          <span className="rounded-full bg-white/70 px-3 py-1.5 text-k2-muted">แสดง {results.length}</span>
        </div>
      </div>

      <div className="glass space-y-3 rounded-[1.5rem] p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-white/70 bg-white/70 px-3 py-2 shadow-sm">
            <Search className="h-4 w-4 shrink-0 text-k2-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ค้นหาเลขงาน ลูกค้า ชื่องาน หรือทีมงาน"
              className="w-full min-w-0 bg-transparent text-sm outline-none"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {filterButtons.map((button) => (
              <button
                key={button.key}
                type="button"
                onClick={() => setStatusFilter(button.key)}
                className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                  statusFilter === button.key
                    ? "bg-k2-ink text-white shadow"
                    : "bg-white/70 text-k2-muted hover:bg-k2-mint hover:text-k2-ink"
                }`}
              >
                {button.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex items-center gap-2 rounded-2xl border border-white/70 bg-white/70 px-3 py-2 text-sm shadow-sm">
            <span className="shrink-0 font-semibold text-k2-muted">ตั้งแต่</span>
            <input
              type="date"
              value={fromDate}
              max={toDate || undefined}
              onChange={(event) => setFromDate(event.target.value)}
              className="bg-transparent text-sm outline-none"
            />
          </label>
          <label className="flex items-center gap-2 rounded-2xl border border-white/70 bg-white/70 px-3 py-2 text-sm shadow-sm">
            <span className="shrink-0 font-semibold text-k2-muted">ถึง</span>
            <input
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(event) => setToDate(event.target.value)}
              className="bg-transparent text-sm outline-none"
            />
          </label>
          {hasFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-full bg-white/70 px-4 py-2 text-xs font-bold text-k2-muted shadow-sm transition hover:bg-k2-rose hover:text-rose-700"
            >
              ล้างตัวกรอง
            </button>
          ) : null}
        </div>
      </div>

      <div className="glass rounded-[1.5rem] p-5">
        {results.length ? (
          <div className="space-y-3">
            {results.map(({ job }) => (
              <JobRow key={job.id} job={job} canSeeMoney={canSeeMoney} onSelect={onSelect} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/90 bg-white/40 px-4 py-10 text-center text-sm font-semibold text-k2-muted">
            {closedJobs.length ? "ไม่พบงานที่ตรงกับตัวกรอง" : "ยังไม่มีงานที่เสร็จหรือปิดแล้ว"}
          </div>
        )}
      </div>
    </div>
  );
}

// โครงร่าง (skeleton) ระหว่างโหลดข้อมูลครั้งแรก — ให้รู้สึกว่าโหลดเร็วและไม่เห็นหน้าว่าง
function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-hidden="true">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="glass rounded-[1.5rem] p-5">
            <div className="mb-4 h-11 w-11 rounded-2xl bg-white/70" />
            <div className="h-3 w-24 rounded-full bg-white/70" />
            <div className="mt-3 h-7 w-16 rounded-full bg-white/80" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="glass space-y-3 rounded-[1.5rem] p-5">
          <div className="h-5 w-40 rounded-full bg-white/70" />
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-16 rounded-2xl bg-white/60" />
          ))}
        </div>
        <div className="glass space-y-4 rounded-[1.5rem] p-5">
          <div className="h-5 w-32 rounded-full bg-white/70" />
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <div className="h-3 w-full rounded-full bg-white/70" />
              <div className="h-3 w-full rounded-full bg-white/50" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const Dashboard = memo(function Dashboard({
  metrics,
  jobs,
  canSeeMoney,
  onSelect
}: {
  metrics: { label: string; value: string | number; icon: LucideIcon; tone: string }[];
  jobs: Job[];
  canSeeMoney: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="glass rounded-[1.5rem] p-5">
            <div className={`mb-4 grid h-11 w-11 place-items-center rounded-2xl ${tone}`}>
              <Icon className="h-5 w-5 text-k2-ink" />
            </div>
            <p className="text-sm font-semibold text-k2-muted">{label}</p>
            <p className="mt-1 text-3xl font-semibold">{label === "ยอดค้างชำระ" && !canSeeMoney ? "ซ่อนข้อมูล" : value}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="glass rounded-[1.5rem] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-semibold">รายการงานล่าสุด</h3>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-k2-muted">{jobs.length} งาน</span>
          </div>
          <div className="space-y-3">
            {jobs.slice(0, 6).map((job) => (
              <JobRow key={job.id} job={job} canSeeMoney={canSeeMoney} onSelect={onSelect} />
            ))}
          </div>
        </div>
        <div className="glass rounded-[1.5rem] p-5">
          <h3 className="text-xl font-semibold">ภาพรวมกำลังผลิต</h3>
          <div className="mt-5 space-y-4">
            {["Designing", "In Production", "QC", "Packing"].map((status) => {
              const count = jobs.filter((job) => job.status === status).length;
              return (
                <div key={status}>
                  <div className="mb-2 flex justify-between text-sm font-semibold">
                    <span>{statusLabel[status as JobStatus] ?? status}</span>
                    <span>{count}</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-white">
                    <div className="h-full rounded-full bg-k2-ink" style={{ width: `${Math.min(100, count * 28)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
});

function JobRow({ job, canSeeMoney, onSelect }: { job: Job; canSeeMoney: boolean; onSelect: (id: string) => void }) {
  const urgency = dueUrgency(job.dueDate, job.status);
  return (
    <button onClick={() => onSelect(job.id)} className="grid w-full gap-3 rounded-2xl bg-white/60 p-4 text-left transition hover:bg-white lg:grid-cols-[1.2fr_0.8fr_0.6fr_auto] lg:items-center">
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 font-bold">
            {job.isExpress ? <Zap className="h-3.5 w-3.5 text-rose-500" /> : null}
            {job.id}
          </span>
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${priorityClass[job.priority]}`}>{priorityLabel[job.priority]}</span>
        </div>
        <p className="font-semibold">{job.title}</p>
        <p className="text-sm text-k2-muted">{job.customerName}</p>
      </div>
      <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${statusTint[job.status]}`}>{statusLabel[job.status]}</span>
      <div className="flex flex-col gap-1 text-sm text-k2-muted">
        <span>กำหนดส่ง {job.dueDate}</span>
        {urgency ? (
          <span className={`flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${urgency.tone}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${urgency.dot}`} />
            {urgency.label}
          </span>
        ) : null}
      </div>
      <div className="font-semibold">{canSeeMoney ? money.format(job.remainingBalance) : "ซ่อนข้อมูล"}</div>
    </button>
  );
}

function Board({
  jobs,
  draggedJobId,
  setDraggedJobId,
  moveJob,
  onAccept,
  onReject,
  canAccept,
  onSelect
}: {
  jobs: Job[];
  draggedJobId: string | null;
  setDraggedJobId: (id: string | null) => void;
  moveJob: (jobId: string, status: JobStatus) => void;
  onAccept: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  canAccept: (job: Job) => boolean;
  onSelect: (id: string) => void;
}) {
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectText, setRejectText] = useState("");
  // แถบเลื่อนแนวนอนด้านบน (sticky) ซิงก์กับบอร์ด — กันบอร์ดสูงแล้วเลื่อนข้างไม่ถึง scrollbar ล่าง
  const topScrollRef = useRef<HTMLDivElement>(null);
  const boardScrollRef = useRef<HTMLDivElement>(null);
  const [boardWidth, setBoardWidth] = useState(0);
  useEffect(() => {
    const el = boardScrollRef.current;
    if (!el) return;
    const update = () => setBoardWidth(el.scrollWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [jobs]);
  return (
    <>
      <div
        ref={topScrollRef}
        onScroll={() => { if (boardScrollRef.current && topScrollRef.current) boardScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft; }}
        className="soft-scrollbar sticky top-2 z-20 mb-2 overflow-x-auto rounded-full bg-white/40"
      >
        <div style={{ width: boardWidth, height: 8 }} />
      </div>
      <div
        ref={boardScrollRef}
        onScroll={() => { if (boardScrollRef.current && topScrollRef.current) topScrollRef.current.scrollLeft = boardScrollRef.current.scrollLeft; }}
        className="soft-scrollbar flex gap-4 overflow-x-auto pb-4"
      >
      {statuses.map((status) => {
        const columnJobs = jobs.filter((job) => job.status === status);
        return (
          <section
            key={status}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (draggedJobId) moveJob(draggedJobId, status);
              setDraggedJobId(null);
            }}
            className="glass min-h-[68vh] w-80 shrink-0 rounded-[1.5rem] p-3"
          >
            <div className="mb-3 rounded-[1.25rem] border border-white/75 bg-white/50 px-4 py-3 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${statusDot[status]} shadow-[0_0_0_4px_rgba(255,255,255,0.7)]`} />
                  <h3 className="truncate text-sm font-extrabold text-k2-ink">{statusLabel[status]}</h3>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${statusTint[status]}`}>
                  {columnJobs.length} งาน
                </span>
              </div>
              <p className="mt-1.5 text-xs font-semibold text-k2-muted">
                <span className="hidden sm:inline">ลากการ์ดมาวางเพื่อเปลี่ยนสถานะ · </span>
                <span>แตะ ▼ ใต้การ์ดเพื่อย้ายขั้นตอน</span>
              </p>
            </div>
            <div className="space-y-3">
              {columnJobs.map((job) => {
                const urgency = dueUrgency(job.dueDate, job.status);
                return (
                <motion.div
                  layout
                  key={job.id}
                  className={`overflow-hidden rounded-[1.25rem] border bg-white/75 shadow-sm transition hover:bg-white ${
                    urgency && urgency.days <= 1 ? "border-l-4 border-l-rose-400 border-white/80" : "border-white/80"
                  }`}
                >
                  {/* แตะเพื่อดูรายละเอียด / ลากเพื่อย้ายขั้นตอน (desktop) */}
                  <button
                    draggable
                    onDragStart={() => setDraggedJobId(job.id)}
                    onClick={() => onSelect(job.id)}
                    className="w-full p-4 text-left"
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-sm font-bold">
                        {job.isExpress ? <Zap className="h-3.5 w-3.5 text-rose-500" /> : null}
                        {job.id}
                      </span>
                      <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${priorityClass[job.priority]}`}>{priorityLabel[job.priority]}</span>
                    </div>
                    <p className="font-semibold leading-5">{job.title}</p>
                    <p className="mt-1 text-sm text-k2-muted">{job.customerName}</p>
                    {!job.depositConfirmed && (job.depositSlip || job.depositWaived) ? (
                      <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">{job.depositWaived ? "รอเจ้าของอนุมัติ" : "รอยืนยันมัดจำ"}</span>
                    ) : null}
                    <div className="mt-4 flex items-center justify-between gap-2 text-xs font-semibold text-k2-muted">
                      <span>{jobTypeLabel[job.type]}</span>
                      {urgency ? (
                        <span className={`flex items-center gap-1 rounded-full px-2 py-1 ${urgency.tone}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${urgency.dot}`} />
                          {urgency.label}
                        </span>
                      ) : (
                        <span>{job.dueDate}</span>
                      )}
                    </div>
                  </button>
                  {/* รอยอมรับ -> ปุ่มยอมรับ/ปฏิเสธ · ปกติ -> เลือกสถานะ (ลาก/แตะได้) */}
                  <div className="border-t border-white/60 px-3 py-2">
                    {job.acceptance === "pending" ? (
                      <div className="space-y-2">
                        <p className="rounded-lg bg-amber-100/80 px-2 py-1 text-[11px] font-bold text-amber-800">
                          รอผู้จัดการสาขายอมรับ{job.productionBranch ? ` · 🏭 ${job.productionBranch}` : ""}
                        </p>
                        {job.salesPage ? (
                          <p className="rounded-lg bg-teal-50 px-2 py-1 text-[11px] font-bold text-teal-700">📣 เพจ {job.salesPage}{job.incomeBranch ? ` · รายได้→${job.incomeBranch}` : ""}</p>
                        ) : null}
                        {canAccept(job) ? (
                          rejectingId === job.id ? (
                            <div className="space-y-2">
                              <textarea
                                value={rejectText}
                                onChange={(event) => setRejectText(event.target.value)}
                                placeholder="เหตุผลที่ตีกลับ (ให้เซลแก้)"
                                className="w-full rounded-xl border border-white/80 bg-white/80 px-3 py-2 text-xs outline-none"
                              />
                              <div className="flex gap-2">
                                <button type="button" onClick={() => { setRejectingId(null); setRejectText(""); }} className="flex-1 rounded-xl bg-white/70 px-2 py-2 text-xs font-bold text-k2-muted">ยกเลิก</button>
                                <button type="button" onClick={() => { onReject(job.id, rejectText); setRejectingId(null); setRejectText(""); }} className="flex-1 rounded-xl bg-rose-500 px-2 py-2 text-xs font-bold text-white">ยืนยันตีกลับ</button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <button type="button" onClick={() => onAccept(job.id)} className="flex-1 rounded-xl bg-emerald-500 px-2 py-2 text-xs font-bold text-white">ยอมรับ</button>
                              <button type="button" onClick={() => { setRejectingId(job.id); setRejectText(""); }} className="flex-1 rounded-xl bg-white/70 px-2 py-2 text-xs font-bold text-rose-600">ปฏิเสธ</button>
                            </div>
                          )
                        ) : null}
                      </div>
                    ) : job.acceptance === "rejected" ? (
                      <div className="space-y-2">
                        <p className="rounded-lg bg-rose-100/80 px-2 py-1 text-[11px] font-bold text-rose-700">
                          ตีกลับ: {job.rejectReason || "ไม่ระบุเหตุผล"}
                        </p>
                        {canAccept(job) ? (
                          <button type="button" onClick={() => onAccept(job.id)} className="w-full rounded-xl bg-emerald-500 px-2 py-2 text-xs font-bold text-white">ยอมรับเข้าคิว</button>
                        ) : null}
                      </div>
                    ) : (
                      <select
                        value={status}
                        onChange={(event) => moveJob(job.id, event.target.value as JobStatus)}
                        className="w-full cursor-pointer rounded-xl bg-white/60 px-3 py-2 text-xs font-bold text-k2-muted outline-none"
                      >
                        {statuses.map((s) => (
                          <option key={s} value={s}>{statusLabel[s]}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </motion.div>
                );
              })}
              {columnJobs.length === 0 ? (
                <div className="rounded-[1.25rem] border border-dashed border-white/90 bg-white/35 px-4 py-6 text-center text-sm font-semibold text-k2-muted">
                  ยังไม่มีงานในขั้นตอนนี้
                </div>
              ) : null}
            </div>
          </section>
        );
      })}
      </div>
    </>
  );
}

function LineInvitePanel({ job, customer, onMarkFriend }: {
  job: Job;
  customer?: Customer;
  onMarkFriend: (customerId: string) => void;
}) {
  if (job.paymentStatus !== "paid" || !customer || customer.lineFriend) return null;
  return (
    <section className="glass mb-4 rounded-[1.5rem] border-2 border-green-200 p-5">
      <p className="text-lg font-extrabold text-green-700">💚 ลูกค้าจ่ายครบแล้ว — ชวนแอด LINE OA</p>
      <p className="mt-1 text-sm font-semibold text-k2-muted">โอกาสทอง! ชวน {customer.name} แอด LINE OA + ให้แต้มสะสม เพื่อขายซ้ำ / แจ้งสถานะงานในอนาคต</p>
      <button type="button" onClick={() => onMarkFriend(customer.id)} className="mt-3 rounded-2xl bg-green-600 px-5 py-3 text-sm font-bold text-white">✅ ชวนแล้ว / เป็นเพื่อน LINE แล้ว</button>
    </section>
  );
}

function HandoffPanel({ job, currentUser, onSubmit, onAccept, onReject }: {
  job: Job;
  currentUser: TeamMember;
  onSubmit: (jobId: string) => void;
  onAccept: (jobId: string) => void;
  onReject: (jobId: string, reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const isOwner = currentUser.role === "Owner";
  const pending = job.handoffStatus === "pending";
  const pendingGate = pending ? gateById(job.handoffGate) : undefined;
  const sendGate = !pending ? gateFromStatus(job.status) : undefined;
  const canSend = Boolean(sendGate) && (isOwner || (sendGate ? userHasAnyRole(currentUser, sendGate.senderRoles) : false));
  const isReviewer = Boolean(pendingGate) && (isOwner || (pendingGate
    ? (pendingGate.branchManager ? userHasRole(currentUser, "Manager") && currentUser.branch === job.productionBranch : userHasAnyRole(currentUser, pendingGate.reviewerRoles))
    : false));
  const isSubmitter = Boolean(job.handoffFromUser) && job.handoffFromUser === currentUser.id;
  const canReview = pending && isReviewer && (isOwner || !isSubmitter);
  if (!pending && !canSend && !job.handoffNote) return null;
  return (
    <section className="glass mb-4 rounded-[1.5rem] p-5">
      <p className="text-sm font-semibold text-k2-muted">ส่ง–รับงาน</p>
      {pending && pendingGate ? (
        <div className="mt-2">
          <p className="text-lg font-extrabold text-amber-700">⏳ รอตรวจรับ · {pendingGate.label}</p>
          <p className="text-sm font-semibold text-k2-muted">ผู้ตรวจ: {pendingGate.reviewerRoles.map((role) => roleLabel[role]).join(" / ")}</p>
          {canReview ? (
            rejecting ? (
              <div className="mt-3 space-y-2">
                <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="เหตุผลที่ตีกลับ (ให้ผู้ส่งแก้)" className="w-full rounded-xl border border-white/80 bg-white/85 px-3 py-2 text-sm outline-none" />
                <div className="flex gap-2">
                  <button type="button" onClick={() => { onReject(job.id, reason); setRejecting(false); setReason(""); }} className="flex-1 rounded-xl bg-rose-500 px-3 py-2 text-sm font-bold text-white">ยืนยันตีกลับ</button>
                  <button type="button" onClick={() => setRejecting(false)} className="flex-1 rounded-xl bg-white/80 px-3 py-2 text-sm font-bold text-k2-muted">ยกเลิก</button>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => onAccept(job.id)} className="flex-1 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-bold text-white">รับงาน (ผ่าน)</button>
                <button type="button" onClick={() => setRejecting(true)} className="flex-1 rounded-xl bg-rose-100 px-3 py-2 text-sm font-bold text-rose-700">ตีกลับ</button>
              </div>
            )
          ) : isReviewer && isSubmitter ? (
            <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">คุณเป็นผู้ส่งงานนี้ — ให้คนอื่นเป็นผู้ตรวจรับ (กฎกันพลาด)</p>
          ) : (
            <p className="mt-3 text-sm font-semibold text-k2-muted">รอผู้มีสิทธิ์ตรวจรับ</p>
          )}
        </div>
      ) : canSend && sendGate ? (
        <div className="mt-2">
          {job.handoffNote ? <p className="mb-2 rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">↩︎ ถูกตีกลับล่าสุด: {job.handoffNote}</p> : null}
          <button type="button" onClick={() => onSubmit(job.id)} className="rounded-2xl bg-k2-ink px-5 py-3 text-sm font-bold text-white">{sendGate.label}</button>
        </div>
      ) : job.handoffNote ? (
        <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">↩︎ ถูกตีกลับล่าสุด: {job.handoffNote}</p>
      ) : null}
    </section>
  );
}

type PrintDocType = "quote" | "workorder" | "receipt";

const printDocTitle: Record<PrintDocType, { th: string; en: string }> = {
  quote: { th: "ใบเสนอราคา", en: "QUOTATION" },
  workorder: { th: "ใบสั่งงาน", en: "WORK ORDER" },
  receipt: { th: "ใบเสร็จรับเงิน / บิลเงินสด", en: "RECEIPT" }
};

function PrintableDoc({ job, company, docType, docNumber, onClose }: { job: Job; company: CompanyProfile; docType: PrintDocType; docNumber: string; onClose: () => void }) {
  const title = printDocTitle[docType];
  const isReceipt = docType === "receipt";
  const today = new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
  const vatMode = normalizeVatMode(job.vatMode);
  const hasVat = vatMode !== "none";
  const { base: priceBase, vat: priceVat, total: priceTotal } = computeVat(job.price, vatMode);
  // คงเหลือคิดจากยอดรวม (รวม VAT) ลบมัดจำ — งานจ่ายครบแล้วถือว่าชำระเต็มยอดรวม
  const fullyPaid = isReceipt && job.remainingBalance <= 0;
  const outstanding = fullyPaid ? priceTotal : Math.max(priceTotal - job.deposit, 0);
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="my-4 w-full max-w-3xl">
        <div className="no-print mb-3 flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
          <p className="text-sm font-bold text-white">ตัวอย่างเอกสาร — {title.th}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => window.print()} className="rounded-2xl bg-white px-5 py-2.5 text-sm font-extrabold text-k2-ink shadow">🖨️ พิมพ์ / บันทึก PDF</button>
            <button type="button" onClick={onClose} className="rounded-2xl bg-white/20 px-4 py-2.5 text-sm font-bold text-white">ปิด</button>
          </div>
        </div>

        <div id="print-doc" className="mx-auto bg-white p-8 text-slate-900 shadow-2xl" onClick={(e) => e.stopPropagation()} style={{ fontSize: "13px", lineHeight: 1.5 }}>
          <div className="flex items-start justify-between gap-4 border-b-2 border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/k2smart-logo.png" alt="logo" style={{ width: 64, height: 64, objectFit: "contain" }} />
              <div>
                <p style={{ fontSize: "18px", fontWeight: 800 }}>{company.name || "K2Smart"}</p>
                <p>{company.legalName}</p>
                <p>{company.address}</p>
                <p>โทร {company.phone}{company.email ? ` · ${company.email}` : ""}</p>
                {company.taxId ? <p>เลขประจำตัวผู้เสียภาษี: {company.taxId}</p> : null}
              </div>
            </div>
            <div className="text-right">
              <p style={{ fontSize: "20px", fontWeight: 800 }}>{title.th}</p>
              <p style={{ letterSpacing: "1px" }}>{title.en}</p>
              <p className="mt-2">เลขที่: <b>{docNumber}</b></p>
              <p>วันที่: {today}</p>
            </div>
          </div>

          <div className="mt-4 rounded border border-slate-300 p-3">
            <p style={{ fontWeight: 700 }}>ลูกค้า / ผู้ว่าจ้าง</p>
            <p>{job.customerName}{job.companyName ? ` · ${job.companyName}` : ""}</p>
            {job.billingAddress ? <p>{job.billingAddress}</p> : null}
            <p>{job.phone ? `โทร ${job.phone}` : ""}{job.taxId ? ` · เลขภาษี ${job.taxId}` : ""}</p>
          </div>

          <table className="mt-4 w-full border-collapse" style={{ fontSize: "13px" }}>
            <thead>
              <tr style={{ background: "#14383d", color: "#fff" }}>
                <th className="border border-slate-400 px-2 py-2 text-left">รายการ</th>
                <th className="border border-slate-400 px-2 py-2 text-center" style={{ width: 70 }}>จำนวน</th>
                <th className="border border-slate-400 px-2 py-2 text-right" style={{ width: 120 }}>ราคา (บาท)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-slate-300 px-2 py-2 align-top">
                  <p style={{ fontWeight: 700 }}>{job.title}</p>
                  <p style={{ whiteSpace: "pre-wrap", color: "#475569", fontSize: "12px" }}>{job.description}</p>
                </td>
                <td className="border border-slate-300 px-2 py-2 text-center align-top">{job.quantity}</td>
                <td className="border border-slate-300 px-2 py-2 text-right align-top">{money.format(job.price)}</td>
              </tr>
            </tbody>
          </table>

          <div className="mt-3 flex justify-end">
            <table style={{ fontSize: "13px", minWidth: 260 }}>
              <tbody>
                {hasVat ? (
                  <>
                    <tr><td className="px-2 py-1">ราคาก่อนภาษี</td><td className="px-2 py-1 text-right">{money.format(priceBase)}</td></tr>
                    <tr><td className="px-2 py-1">ภาษีมูลค่าเพิ่ม 7%</td><td className="px-2 py-1 text-right">{money.format(priceVat)}</td></tr>
                  </>
                ) : null}
                <tr><td className="px-2 py-1">{hasVat ? "ราคารวมภาษี" : "ราคารวม"}</td><td className="px-2 py-1 text-right" style={{ fontWeight: 700 }}>{money.format(priceTotal)}</td></tr>
                {job.deposit > 0 ? <tr><td className="px-2 py-1">มัดจำ{job.depositReceivedDate ? ` (${job.depositReceivedDate})` : ""}</td><td className="px-2 py-1 text-right">{money.format(job.deposit)}</td></tr> : null}
                <tr style={{ borderTop: "2px solid #334155" }}>
                  <td className="px-2 py-1" style={{ fontWeight: 800 }}>{fullyPaid ? "ชำระแล้วทั้งหมด" : "คงเหลือ"}</td>
                  <td className="px-2 py-1 text-right" style={{ fontWeight: 800 }}>{money.format(outstanding)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {!isReceipt && (company.bankName || company.bankAccount) ? (
            <div className="mt-4 rounded border border-slate-300 p-3">
              <p style={{ fontWeight: 700 }}>ชำระเงินผ่าน</p>
              <p>{company.bankName} · เลขที่บัญชี {company.bankAccount} · ชื่อบัญชี {company.bankAccountName}</p>
            </div>
          ) : null}
          {company.quoteTerms ? <p className="mt-3" style={{ fontSize: "12px", color: "#475569" }}>หมายเหตุ: {company.quoteTerms}</p> : null}

          <div className="mt-10 flex justify-between" style={{ fontSize: "12px" }}>
            <div className="text-center" style={{ width: "45%" }}>
              <div style={{ borderTop: "1px dotted #475569" }} className="pt-1">ผู้ว่าจ้าง / ลูกค้า</div>
            </div>
            <div className="text-center" style={{ width: "45%" }}>
              <div style={{ borderTop: "1px dotted #475569" }} className="pt-1">ผู้มีอำนาจลงนาม ({company.name || "K2Smart"})</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function JobDetail({
  job,
  companyProfile,
  canSeeMoney,
  canEditPayment,
  canDeleteJob,
  canConfirmDeposit,
  canApproveWaiver,
  onPayment,
  onConfirmDeposit,
  onReceiveBalance,
  onComment,
  onMove,
  onDelete,
  teamMembers,
  canAssign,
  onAssign,
  canEditJob,
  onUpdateJob,
  canAttach,
  onUploadFile,
  onDeleteFile
}: {
  job: Job;
  companyProfile: CompanyProfile;
  canSeeMoney: boolean;
  canEditPayment: boolean;
  canDeleteJob: boolean;
  canConfirmDeposit: boolean;
  canApproveWaiver: boolean;
  onPayment: (jobId: string, deposit: number) => void;
  onConfirmDeposit: (jobId: string) => void;
  onReceiveBalance: (jobId: string, slip: string, receivedDate: string) => void;
  onComment: (jobId: string, text: string) => void;
  onMove: (jobId: string, status: JobStatus) => void;
  onDelete: (jobId: string) => void;
  teamMembers: TeamMember[];
  canAssign: boolean;
  onAssign: (jobId: string, designer: string, production: string) => void;
  canEditJob: boolean;
  onUpdateJob: (jobId: string, fields: { title: string; type: JobType; description: string; quantity: number; dueDate: string; priority: Priority; internalNotes: string }) => void;
  canAttach: boolean;
  onUploadFile: (job: Job, file: File) => void;
  onDeleteFile: (job: Job, fileId: string) => void;
}) {
  const [comment, setComment] = useState("");
  const [editingJob, setEditingJob] = useState(false);
  const jobLocked = ["Ready for Production", "In Production", "QC", "Packing", "Delivered / Picked Up", "Completed", "Cancelled"].includes(job.status);
  const [jobEdit, setJobEdit] = useState({ title: job.title, type: job.type, description: job.description, quantity: job.quantity, dueDate: job.dueDate, priority: job.priority, internalNotes: job.internalNotes });
  useEffect(() => {
    setJobEdit({ title: job.title, type: job.type, description: job.description, quantity: job.quantity, dueDate: job.dueDate, priority: job.priority, internalNotes: job.internalNotes });
    setEditingJob(false);
  }, [job.id, job.title, job.type, job.description, job.quantity, job.dueDate, job.priority, job.internalNotes]);
  const [assignDesigner, setAssignDesigner] = useState(job.assignedDesigner);
  const [assignProduction, setAssignProduction] = useState(job.assignedProduction);
  useEffect(() => {
    setAssignDesigner(job.assignedDesigner);
    setAssignProduction(job.assignedProduction);
  }, [job.id, job.assignedDesigner, job.assignedProduction]);
  const designerChoices = teamMembers.filter((member) => member.role === "Designer" || (member.roles ?? []).includes("Designer"));
  const productionChoices = teamMembers.filter((member) => member.role === "Production Staff" || (member.roles ?? []).includes("Production Staff"));
  const [balanceSlipDraft, setBalanceSlipDraft] = useState("");
  const [balanceDateDraft, setBalanceDateDraft] = useState(todayISO());
  const [balanceError, setBalanceError] = useState("");
  async function handleBalanceSlip(file: File | null) {
    if (!file) return;
    setBalanceError("");
    if (!file.type.startsWith("image/")) { setBalanceError("กรุณาเลือกไฟล์รูปภาพ"); return; }
    if (file.size > 1_500_000) { setBalanceError("รูปต้องไม่เกิน 1.5 MB"); return; }
    setBalanceSlipDraft(await readImageAsDataUrl(file));
  }
  const [printType, setPrintType] = useState<PrintDocType | null>(null);
  const workOrderNumber = job.quoteNumber ?? quoteNumberFor(Number(job.id.replace(/\D/g, "").slice(-4)) || 1, companyProfile.quotePrefix);
  const dueInfo = dueUrgency(job.dueDate, job.status);
  return (
    <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
      <section className="glass rounded-[1.5rem] p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="mb-3 flex flex-wrap gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusTint[job.status]}`}>{statusLabel[job.status]}</span>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${priorityClass[job.priority]}`}>{priorityLabel[job.priority]}</span>
              {job.isExpress ? (
                <span className="flex items-center gap-1 rounded-full bg-rose-500 px-3 py-1 text-xs font-bold text-white">
                  <Zap className="h-3 w-3" /> งานด่วน
                </span>
              ) : null}
              {dueInfo ? (
                <span className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${dueInfo.tone}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${dueInfo.dot}`} />
                  {dueInfo.label}
                </span>
              ) : null}
            </div>
            <h3 className="text-3xl font-semibold">{job.title}</h3>
            <p className="mt-2 text-k2-muted">{job.id} - {jobTypeLabel[job.type]} - {job.quantity} ชิ้น</p>
            {/* พิมพ์เอกสาร PDF */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-k2-muted">🖨️ พิมพ์:</span>
              <button type="button" onClick={() => setPrintType("quote")} className="rounded-xl bg-white/80 px-3 py-1.5 text-xs font-bold text-k2-ink shadow-sm">ใบเสนอราคา</button>
              <button type="button" onClick={() => setPrintType("workorder")} className="rounded-xl bg-white/80 px-3 py-1.5 text-xs font-bold text-k2-ink shadow-sm">ใบสั่งงาน</button>
              {canSeeMoney ? <button type="button" onClick={() => setPrintType("receipt")} className="rounded-xl bg-white/80 px-3 py-1.5 text-xs font-bold text-k2-ink shadow-sm">ใบเสร็จ</button> : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={job.status}
              onChange={(event) => onMove(job.id, event.target.value as JobStatus)}
              className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-semibold outline-none"
            >
              {statuses.map((status) => (
                <option key={status} value={status}>{statusLabel[status]}</option>
              ))}
            </select>
            {canDeleteJob ? (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`ลบงาน ${job.id} – "${job.title}" ออกจากระบบ?\nการลบนี้ย้อนกลับไม่ได้`)) onDelete(job.id);
                }}
                className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-rose-50 text-rose-600"
                title="ลบงานนี้"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
        <p className="mt-5 rounded-3xl bg-white/60 p-5 leading-8 text-k2-muted">{job.description}</p>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <Info label="ลูกค้า" value={job.customerName} icon={UserRound} />
          <Info label="เบอร์โทร" value={job.phone} icon={Phone} />
          <Info label="LINE ID" value={job.lineId} icon={MessageSquare} />
          <Info label="บริษัท / ผู้เสียภาษี" value={job.companyName || "ยังไม่ระบุ"} icon={Building2} />
          <Info label="เลขผู้เสียภาษี" value={job.taxId || "ยังไม่ระบุ"} icon={ReceiptText} />
          <Info label="อีเมลบัญชี" value={job.accountingEmail || "ยังไม่ระบุ"} icon={WalletCards} />
          <Info label="วันที่รับงาน" value={job.orderDate} icon={CalendarDays} />
          <Info label={job.isExpress ? "วันที่นัดส่งงาน (ด่วน)" : "กำหนดส่ง"} value={dueInfo ? `${job.dueDate} · ${dueInfo.label}` : job.dueDate} icon={Clock3} />
          <Info label="ผู้รับผิดชอบออกแบบ" value={staffLabel(job.assignedDesigner)} icon={Sparkles} />
          <Info label="ผู้รับผิดชอบผลิต" value={staffLabel(job.assignedProduction)} icon={Factory} />
          <Info label="โน้ตภายใน" value={job.internalNotes} icon={ClipboardList} />
        </div>

        {canEditJob ? (
          <div className="mt-5 rounded-3xl bg-white/60 p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h4 className="font-semibold">แก้ไขข้อมูลงาน</h4>
              {editingJob ? null : (
                <button type="button" onClick={() => setEditingJob(true)} className="rounded-2xl bg-white/80 px-4 py-2 text-sm font-bold text-k2-ink shadow-sm">✏️ แก้ไข</button>
              )}
            </div>
            {editingJob ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <input value={jobEdit.title} onChange={(event) => setJobEdit((current) => ({ ...current, title: event.target.value }))} placeholder="ชื่องาน" className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3 text-sm font-semibold outline-none sm:col-span-2" />
                <select value={jobEdit.type} onChange={(event) => setJobEdit((current) => ({ ...current, type: event.target.value as JobType }))} className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3 text-sm font-semibold outline-none">
                  {jobTypes.map((type) => (<option key={type} value={type}>{jobTypeLabel[type]}</option>))}
                </select>
                <input type="number" min="1" value={jobEdit.quantity} onChange={(event) => setJobEdit((current) => ({ ...current, quantity: Number(event.target.value) }))} placeholder="จำนวน" className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3 text-sm font-semibold outline-none" />
                <input type="date" value={jobEdit.dueDate} onChange={(event) => setJobEdit((current) => ({ ...current, dueDate: event.target.value }))} className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3 text-sm font-semibold outline-none" />
                <select value={jobEdit.priority} onChange={(event) => setJobEdit((current) => ({ ...current, priority: event.target.value as Priority }))} className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3 text-sm font-semibold outline-none">
                  {(["Normal", "Urgent", "Very Urgent", "Today"] as Priority[]).map((priority) => (<option key={priority} value={priority}>{priorityLabel[priority]}</option>))}
                </select>
                <textarea value={jobEdit.description} onChange={(event) => setJobEdit((current) => ({ ...current, description: event.target.value }))} placeholder="รายละเอียดงาน" className="min-h-20 rounded-2xl border border-white/80 bg-white/85 px-4 py-3 text-sm font-semibold outline-none sm:col-span-2" />
                <textarea value={jobEdit.internalNotes} onChange={(event) => setJobEdit((current) => ({ ...current, internalNotes: event.target.value }))} placeholder="โน้ตภายใน" className="min-h-16 rounded-2xl border border-white/80 bg-white/85 px-4 py-3 text-sm font-semibold outline-none sm:col-span-2" />
                <div className="flex gap-2 sm:col-span-2">
                  <button type="button" onClick={() => { onUpdateJob(job.id, jobEdit); setEditingJob(false); }} className="rounded-2xl bg-k2-ink px-5 py-3 text-sm font-extrabold text-white">บันทึก</button>
                  <button type="button" onClick={() => { setJobEdit({ title: job.title, type: job.type, description: job.description, quantity: job.quantity, dueDate: job.dueDate, priority: job.priority, internalNotes: job.internalNotes }); setEditingJob(false); }} className="rounded-2xl bg-white/70 px-5 py-3 text-sm font-bold text-k2-muted">ยกเลิก</button>
                </div>
              </div>
            ) : (
              <p className="text-sm font-semibold text-k2-muted">แก้ชื่อ/ประเภท/จำนวน/รายละเอียด/กำหนดส่ง/ความเร่งด่วน/โน้ต ได้ก่อนอนุมัติเข้าผลิต · ราคา/มัดจำแก้ที่ส่วนการเงิน</p>
            )}
          </div>
        ) : jobLocked ? (
          <p className="mt-5 rounded-3xl bg-white/50 px-4 py-3 text-sm font-semibold text-k2-muted">🔒 งานนี้อนุมัติเข้าผลิตแล้ว — แก้ไขข้อมูลไม่ได้</p>
        ) : null}

        {canAssign ? (
          <div className="mt-5 rounded-3xl bg-white/60 p-5">
            <h4 className="mb-1 font-semibold">มอบหมายผู้รับผิดชอบ</h4>
            <p className="mb-3 text-sm font-semibold text-k2-muted">เลือกผู้รับผิดชอบแล้วบันทึก — ระบบจะเด้งแจ้งเตือนในแอปของคนที่ถูกมอบหมาย</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-sm font-semibold text-k2-muted">กราฟิก (ออกแบบ)</span>
                <select
                  value={assignDesigner}
                  onChange={(event) => setAssignDesigner(event.target.value)}
                  className="w-full rounded-2xl border border-white/80 bg-white/85 px-4 py-3 text-sm font-semibold outline-none"
                >
                  <option value="Unassigned">ยังไม่มอบหมาย</option>
                  {assignDesigner !== "Unassigned" && !designerChoices.some((member) => member.name === assignDesigner) ? (
                    <option value={assignDesigner}>{assignDesigner}</option>
                  ) : null}
                  {designerChoices.map((member) => (
                    <option key={member.id} value={member.name}>{member.name}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-sm font-semibold text-k2-muted">ฝ่ายผลิต</span>
                <select
                  value={assignProduction}
                  onChange={(event) => setAssignProduction(event.target.value)}
                  className="w-full rounded-2xl border border-white/80 bg-white/85 px-4 py-3 text-sm font-semibold outline-none"
                >
                  <option value="Unassigned">ยังไม่มอบหมาย</option>
                  {assignProduction !== "Unassigned" && !productionChoices.some((member) => member.name === assignProduction) ? (
                    <option value={assignProduction}>{assignProduction}</option>
                  ) : null}
                  {productionChoices.map((member) => (
                    <option key={member.id} value={member.name}>{member.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <button
              type="button"
              onClick={() => onAssign(job.id, assignDesigner, assignProduction)}
              disabled={assignDesigner === job.assignedDesigner && assignProduction === job.assignedProduction}
              className="mt-3 rounded-2xl bg-k2-ink px-5 py-3 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              บันทึกการมอบหมาย
            </button>
          </div>
        ) : null}

        <div className="mt-5 rounded-3xl bg-white/60 p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h4 className="font-semibold">ข้อมูลบัญชีและใบกำกับ</h4>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${job.requiresInvoice ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
              {job.requiresInvoice ? "ต้องออกเอกสาร" : "ยังไม่ต้องออกเอกสาร"}
            </span>
          </div>
          <p className="leading-7 text-k2-muted">
            {job.billingAddress || "ยังไม่มีที่อยู่สำหรับออกใบกำกับ / ใบเสร็จ"}
            {job.branch ? ` | สาขา ${job.branch}` : ""}
          </p>
        </div>

        <div className="mt-5 rounded-3xl bg-white/60 p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h4 className="font-semibold">ไฟล์แนบ</h4>
            {canAttach ? (
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-k2-ink px-4 py-2 text-sm font-bold text-white">
                <Upload className="h-4 w-4" /> แนบไฟล์
                <input type="file" className="sr-only" onChange={(event) => { const f = event.target.files?.[0]; if (f) void onUploadFile(job, f); event.target.value = ""; }} />
              </label>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {job.files.map((file) => (
              <div key={file.id} className="flex items-center gap-3 rounded-2xl bg-white p-3">
                {file.url && file.type === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={file.url} alt={file.name} className="h-11 w-11 shrink-0 rounded-2xl object-cover" />
                ) : (
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-k2-sky">
                    <FileImage className="h-5 w-5" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  {file.url ? (
                    <a href={file.url} target="_blank" rel="noreferrer" className="block truncate font-semibold text-k2-ink underline">{file.name}</a>
                  ) : (
                    <p className="truncate font-semibold">{file.name}</p>
                  )}
                  <p className="text-sm text-k2-muted">{file.type.toUpperCase()} · {file.size}</p>
                </div>
                {canAttach ? (
                  <button type="button" onClick={() => onDeleteFile(job, file.id)} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-600" title="ลบไฟล์">
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            ))}
            {job.files.length === 0 ? (
              <p className="text-sm font-semibold text-k2-muted sm:col-span-2">ยังไม่มีไฟล์แนบ</p>
            ) : null}
          </div>
        </div>
      </section>

      <aside className="space-y-4">
        <section className="glass rounded-[1.5rem] p-5">
          <h4 className="mb-4 text-xl font-semibold">การชำระเงิน</h4>
          <div className="grid gap-3">
            <MoneyLine label="ราคารวม" value={job.price} visible={canSeeMoney} />
            {normalizeVatMode(job.vatMode) !== "none" ? (
              <div className="flex items-center justify-between text-xs font-semibold text-k2-muted">
                <span>{vatModeLabel[normalizeVatMode(job.vatMode)]}</span>
                <span>{canSeeMoney ? `VAT ${money.format(computeVat(job.price, normalizeVatMode(job.vatMode)).vat)} · รวม ${money.format(computeVat(job.price, normalizeVatMode(job.vatMode)).total)}` : "ซ่อนข้อมูล"}</span>
              </div>
            ) : null}
            <MoneyLine label="มัดจำ" value={job.deposit} visible={canSeeMoney} />
            <MoneyLine label="ยอดคงเหลือ" value={job.remainingBalance} visible={canSeeMoney} />
          </div>
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-white/70 p-3">
            <span className="font-semibold">สถานะชำระเงิน</span>
            <span className="rounded-full bg-k2-mint px-3 py-1 text-xs font-bold text-emerald-800">{paymentLabel[job.paymentStatus]}</span>
          </div>

          {/* มัดจำ: วันที่รับเงิน + สลิป + ยืนยันยอด (หรือเคสยกเว้นมัดจำ — เจ้าของอนุมัติ) */}
          <div className="mt-4 rounded-2xl border border-white/70 bg-white/55 p-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{job.depositWaived ? "ยกเว้นมัดจำ" : "มัดจำ"}</span>
              {job.depositConfirmed ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-3 py-1 text-xs font-bold text-teal-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {job.depositWaived ? "เจ้าของอนุมัติแล้ว" : "ยืนยันยอดแล้ว"}{job.depositConfirmedBy ? ` · ${job.depositConfirmedBy}` : ""}
                </span>
              ) : (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">{job.depositWaived ? "รอเจ้าของอนุมัติ" : "รอยืนยันยอด"}</span>
              )}
            </div>
            {job.depositWaived ? (
              <p className="mt-2 text-sm font-semibold text-amber-700">ลูกค้าไม่ต้องมัดจำ — ต้องให้เจ้าของอนุมัติก่อนเข้าคิวผลิต</p>
            ) : (
              <>
                {job.depositReceivedDate ? (
                  <p className="mt-2 text-sm font-semibold text-k2-muted">วันที่รับเงิน: {job.depositReceivedDate}</p>
                ) : null}
                {job.depositSlip ? (
                  <a href={job.depositSlip} target="_blank" rel="noreferrer" className="mt-2 inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={job.depositSlip} alt="สลิปมัดจำ" className="h-28 w-auto rounded-xl object-cover ring-1 ring-white/80" />
                  </a>
                ) : (
                  <p className="mt-2 text-sm font-semibold text-k2-muted">— ไม่มีรูปสลิป —</p>
                )}
              </>
            )}
            {!job.depositConfirmed && (job.depositWaived ? canApproveWaiver : canConfirmDeposit) ? (
              <button
                type="button"
                onClick={() => onConfirmDeposit(job.id)}
                className="mt-3 w-full rounded-2xl bg-teal-500 px-4 py-3 text-sm font-extrabold text-white"
              >
                {job.depositWaived ? "✓ อนุมัติยกเว้นมัดจำ (เจ้าของ)" : "✓ ยืนยันยอดมัดจำ"} (ปลดล็อกเข้าคิวผลิต)
              </button>
            ) : !job.depositConfirmed && job.depositWaived ? (
              <p className="mt-3 text-center text-xs font-semibold text-k2-muted">รอเจ้าของกดอนุมัติ</p>
            ) : null}
          </div>
          {canSeeMoney && (
            <label className="mt-4 block">
              <span className="mb-2 block text-sm font-semibold text-k2-muted">อัปเดตยอดมัดจำ</span>
              <input
                type="number"
                min={0}
                max={job.price}
                value={job.deposit}
                onChange={(event) => onPayment(job.id, Number(event.target.value))}
                className="w-full rounded-2xl border border-white/80 bg-white/80 px-4 py-3 outline-none"
              />
            </label>
          )}

          {/* รับเงินส่วนที่เหลือ (ตอนปิดงาน) */}
          {canSeeMoney && (
            <div className="mt-4 rounded-2xl border border-white/70 bg-white/55 p-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold">รับเงินส่วนที่เหลือ</span>
                {job.remainingBalance <= 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-3 py-1 text-xs font-bold text-teal-700"><CheckCircle2 className="h-3.5 w-3.5" /> ชำระครบแล้ว</span>
                ) : (
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">ค้าง {money.format(job.remainingBalance)}</span>
                )}
              </div>
              {job.balanceReceivedDate ? <p className="mt-2 text-sm font-semibold text-k2-muted">วันที่รับเงิน: {job.balanceReceivedDate}</p> : null}
              {job.balanceSlip ? (
                <a href={job.balanceSlip} target="_blank" rel="noreferrer" className="mt-2 inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={job.balanceSlip} alt="สลิปยอดคงเหลือ" className="h-24 w-auto rounded-xl object-cover ring-1 ring-white/80" />
                </a>
              ) : null}
              {job.remainingBalance > 0 && canEditPayment ? (
                <div className="mt-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-bold text-k2-ink shadow-sm">
                      <FileImage className="h-4 w-4" />
                      {balanceSlipDraft ? "เปลี่ยนรูปสลิป" : "แนบสลิปยอดคงเหลือ"}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => void handleBalanceSlip(e.target.files?.[0] ?? null)} />
                    </label>
                    {balanceSlipDraft ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={balanceSlipDraft} alt="สลิป" className="h-12 w-12 rounded-lg object-cover ring-1 ring-white/80" />
                    ) : null}
                  </div>
                  <input type="date" value={balanceDateDraft} onChange={(e) => setBalanceDateDraft(e.target.value)} className="w-full rounded-2xl border border-white/80 bg-white/80 px-4 py-2.5 text-sm outline-none" />
                  {balanceError ? <p className="text-xs font-semibold text-rose-600">{balanceError}</p> : null}
                  <button
                    type="button"
                    onClick={() => { onReceiveBalance(job.id, balanceSlipDraft, balanceDateDraft); setBalanceSlipDraft(""); }}
                    className="w-full rounded-2xl bg-teal-500 px-4 py-3 text-sm font-extrabold text-white"
                  >
                    ✓ บันทึกรับเงินครบ ({money.format(job.remainingBalance)})
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </section>

        <section className="glass rounded-[1.5rem] p-5">
          <h4 className="mb-4 text-xl font-semibold">คอมเมนต์</h4>
          <div className="flex gap-2">
            <input
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="เพิ่มคอมเมนต์ภายใน"
              className="min-w-0 flex-1 rounded-2xl border border-white/80 bg-white/80 px-4 py-3 outline-none"
            />
            <button
              onClick={() => {
                onComment(job.id, comment);
                setComment("");
              }}
              className="rounded-2xl bg-k2-ink px-4 font-semibold text-white"
            >
              เพิ่ม
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {job.comments.map((item) => (
              <div key={item.id} className="rounded-2xl bg-white/65 p-3">
                <p className="text-sm text-k2-muted">{item.by} - {item.at}</p>
                <p className="mt-1">{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="glass rounded-[1.5rem] p-5">
          <h4 className="mb-4 text-xl font-semibold">ประวัติสถานะ</h4>
          <div className="space-y-3">
            {job.statusHistory.slice().reverse().map((item) => (
              <div key={item.id} className="rounded-2xl bg-white/65 p-3 text-sm">
                <p className="font-semibold">{item.from === "Created" ? "สร้างงาน" : statusLabel[item.from]} -&gt; {statusLabel[item.to]}</p>
                <p className="text-k2-muted">{item.by} - {item.at}</p>
              </div>
            ))}
          </div>
        </section>
      </aside>

      <section className="glass rounded-[1.5rem] p-4 xl:col-span-2 md:p-6">
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-k2-muted">Work Order Preview</p>
            <h4 className="text-2xl font-black">ตัวอย่างใบสั่งงานแบบเอกสารจริง</h4>
          </div>
          <span className="w-fit rounded-full bg-k2-peach px-3 py-1 text-xs font-bold text-amber-800">
            {quoteLabel[job.quoteStatus ?? "draft"]}
          </span>
        </div>
        <QuoteDocumentPreview job={job} companyProfile={companyProfile} quoteNumber={workOrderNumber} canSeeMoney={canSeeMoney} />
      </section>
      {printType ? <PrintableDoc job={job} company={companyProfile} docType={printType} docNumber={workOrderNumber} onClose={() => setPrintType(null)} /> : null}
    </div>
  );
}

function QuoteDocumentPreview({
  job,
  companyProfile,
  quoteNumber,
  canSeeMoney
}: {
  job: Job;
  companyProfile: CompanyProfile;
  quoteNumber: string;
  canSeeMoney: boolean;
}) {
  const vatMode = normalizeVatMode(job.vatMode);
  const hasVat = vatMode !== "none";
  const { base: subtotal, vat, total } = computeVat(job.price, vatMode);
  const unitPrice = job.quantity > 0 ? subtotal / job.quantity : subtotal;
  const moneyText = (value: number) => (canSeeMoney ? `${quoteMoney.format(value)} บาท` : "ซ่อนข้อมูล");
  const plainMoneyText = (value: number) => (canSeeMoney ? quoteMoney.format(value) : "ซ่อนข้อมูล");

  return (
    <div className="overflow-x-auto rounded-[1.25rem] bg-white p-3 shadow-inner md:p-5">
      <div className="quote-paper relative mx-auto min-w-[920px] max-w-5xl overflow-hidden border border-slate-200 bg-white p-8 text-[15px] text-slate-950">
        <div className="absolute right-0 top-0 h-0 w-0 border-l-[82px] border-t-[82px] border-l-transparent border-t-[#f99a2e]" />
        <header className="grid grid-cols-[1fr_380px] gap-8">
          <div>
            <Image src="/assets/k2sign-media-logo.jpg" alt="K2sign media" width={220} height={114} className="h-auto w-44 object-contain" priority />
            <div className="mt-4 leading-7">
              <p className="font-semibold">{companyProfile.legalName} ({companyProfile.branch.replace("สาขาที่ ", "")})</p>
              <p>{companyProfile.address}</p>
              <p>เลขประจำตัวผู้เสียภาษี {companyProfile.taxId}</p>
              <p>โทร. {companyProfile.phone}</p>
              <p>www.k2sign.com</p>
            </div>
          </div>
          <div className="pt-8">
            <h3 className="mb-7 text-center text-3xl font-semibold">ใบสั่งงาน</h3>
            <div className="grid grid-cols-[110px_1fr] gap-y-2 leading-7">
              <span>เลขที่</span>
              <span>{quoteNumber}</span>
              <span>วันที่</span>
              <span>{job.orderDate}</span>
              <span>ผู้รับงาน</span>
              <span>{staffLabel(job.assignedDesigner)}</span>
            </div>
          </div>
        </header>

        <section className="mt-8 border border-slate-300">
          <div className="bg-[#f99a2e] px-4 py-2 font-semibold text-white">ลูกค้า</div>
          <div className="px-4 py-3 leading-7">
            <p>{job.companyName || job.customerName} {job.branch ? `(${job.branch})` : ""}</p>
            <p>{job.billingAddress || "ยังไม่ระบุที่อยู่สำหรับออกเอกสาร"}</p>
            <p>เลขประจำตัวผู้เสียภาษี {job.taxId || "-"}</p>
          </div>
          <div className="bg-[#f99a2e] px-4 py-2 font-semibold text-white">เบอร์โทร</div>
          <div className="px-4 py-2">{job.phone || "-"}</div>
        </section>

        <table className="mt-6 w-full border-collapse text-right">
          <thead>
            <tr className="bg-[#f99a2e] text-white">
              {["#", "รูปสินค้า", "รายละเอียด", "จำนวน", "ราคาต่อหน่วย", "ส่วนลด", "ภาษี", "หัก ณ ที่จ่าย", "มูลค่า"].map((heading) => (
                <th key={heading} className="border border-slate-300 px-3 py-2 font-semibold">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="align-top">
              <td className="border border-slate-300 px-3 py-3 text-center">1</td>
              <td className="border border-slate-300 px-3 py-3 text-center text-slate-400">-</td>
              <td className="min-w-64 border border-slate-300 px-3 py-3 text-left">
                <p className="font-bold">รายละเอียดออเดอร์ :</p>
                <p>{job.title}</p>
                <p className="mt-1 text-sm text-slate-600">{job.description}</p>
              </td>
              <td className="border border-slate-300 px-3 py-3">{job.quantity}</td>
              <td className="border border-slate-300 px-3 py-3">{plainMoneyText(unitPrice)}</td>
              <td className="border border-slate-300 px-3 py-3">-</td>
              <td className="border border-slate-300 px-3 py-3">{hasVat ? "7%" : "-"}</td>
              <td className="border border-slate-300 px-3 py-3">ไม่หัก</td>
              <td className="border border-slate-300 px-3 py-3">{plainMoneyText(subtotal)}</td>
            </tr>
            <tr>
              <td className="h-72 border border-slate-300" />
              <td className="border border-slate-300" />
              <td className="border border-slate-300" />
              <td className="border border-slate-300" />
              <td className="border border-slate-300" />
              <td className="border border-slate-300" />
              <td className="border border-slate-300" />
              <td className="border border-slate-300" />
              <td className="border border-slate-300" />
            </tr>
          </tbody>
        </table>

        <section className="grid grid-cols-[1fr_420px] border-x border-b border-slate-300">
          <div className="flex items-end border-r border-slate-300 p-4">
            <p className="font-semibold">{canSeeMoney ? `(${money.format(total)} ถ้วน)` : "(ซ่อนข้อมูล)"}</p>
          </div>
          <div className="divide-y divide-slate-300">
            {[
              ["รวมเป็นเงิน", subtotal],
              ["มูลค่าที่ไม่มี/ยกเว้นภาษี", hasVat ? 0 : subtotal],
              ["มูลค่าที่คำนวณภาษี", hasVat ? subtotal : 0],
              ["ภาษีมูลค่าเพิ่ม", vat],
              ["จำนวนเงินรวมทั้งสิ้น", total],
              ["หักภาษี ณ ที่จ่ายทั้งสิ้น", 0],
              ["ยอดชำระ", total]
            ].map(([label, value]) => (
              <div key={label as string} className="grid grid-cols-[1fr_150px] px-4 py-2">
                <span>{label as string}</span>
                <span className="text-right">{moneyText(value as number)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-[1fr_260px_1fr] border-x border-b border-slate-300">
          <SignatureBox title={`ในนาม ${job.companyName || job.customerName}`} label="ผู้สั่งงาน" />
          <div className="grid place-items-center border-x border-slate-300 p-6">
            <Image src="/assets/k2sign-media-stamp.png" alt="K2sign media company stamp" width={150} height={150} className="h-32 w-32 object-contain" />
          </div>
          <SignatureBox title={`ในนาม ${companyProfile.legalName}`} label="ผู้อนุมัติ" />
        </section>
      </div>
    </div>
  );
}

function SignatureBox({ title, label }: { title: string; label: string }) {
  return (
    <div>
      <div className="bg-[#f99a2e] px-4 py-2 text-center font-semibold text-white">{title}</div>
      <div className="px-6 py-12 text-center">
        <div className="mx-auto h-px w-full bg-slate-300" />
        <p className="mt-4">{label}</p>
        <div className="mx-auto mt-10 h-px w-full bg-slate-300" />
        <p className="mt-4">วันที่</p>
      </div>
    </div>
  );
}

function Info({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return (
    <div className="flex gap-3 rounded-3xl bg-white/60 p-4">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-k2-mint">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-k2-muted">{label}</p>
        <p className="break-words font-semibold">{value}</p>
      </div>
    </div>
  );
}

function EmptyState({ title, text, action }: { title: string; text: string; action: () => void }) {
  return (
    <section className="glass rounded-[1.5rem] p-8 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-3xl bg-k2-mint">
        <ClipboardPlus className="h-7 w-7" />
      </div>
      <h3 className="mt-4 text-2xl font-black">{title}</h3>
      <p className="mx-auto mt-2 max-w-lg font-semibold text-k2-muted">{text}</p>
      <button onClick={action} className="mt-5 rounded-2xl bg-k2-ink px-5 py-3 font-extrabold text-white">
        สร้างงานแรก
      </button>
    </section>
  );
}

function MoneyLine({ label, value, visible }: { label: string; value: number; visible: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-white/65 p-3">
      <span className="text-sm font-semibold text-k2-muted">{label}</span>
      <span className="font-bold">{visible ? money.format(value) : "ซ่อนข้อมูล"}</span>
    </div>
  );
}

// ตัวเลือกลูกค้าแบบค้นหาได้ — พิมพ์ชื่อ เบอร์โทร หรือรหัสเพื่อกรอง เริ่มต้นเป็น "ลูกค้าใหม่" (ว่าง)
function CustomerPicker({
  customers,
  selectedId,
  selectedName,
  onPickNew,
  onPickCustomer
}: {
  customers: Customer[];
  selectedId: string;
  selectedName: string;
  onPickNew: () => void;
  onPickCustomer: (customer: Customer) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const normalized = query.trim().toLowerCase();
  const matches = useMemo(() => {
    const list = normalized
      ? customers.filter((customer) =>
          [customer.name, customer.phone, customer.id, customer.companyName, customer.lineId, customer.taxId]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(normalized)
        )
      : customers;
    return list.slice(0, 40);
  }, [customers, normalized]);

  const isNew = selectedId === "new";

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-2 rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-left outline-none"
      >
        <span className={isNew ? "text-k2-muted" : "font-semibold"}>
          {isNew ? "+ ลูกค้าใหม่ (ยังไม่เลือก)" : selectedName || "เลือกลูกค้า"}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-k2-muted" />
      </button>
      {open ? (
        <div className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-white/80 bg-white/97 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-2 border-b border-white/60 px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-k2-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ค้นหาด้วยชื่อ เบอร์โทร หรือรหัส"
              autoFocus
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            <button
              type="button"
              onClick={() => {
                onPickNew();
                setQuery("");
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 border-b border-white/40 px-4 py-3 text-left text-sm font-bold text-teal-700 hover:bg-white/60"
            >
              <Plus className="h-4 w-4" /> สร้างลูกค้าใหม่
            </button>
            {matches.map((customer) => (
              <button
                key={customer.id}
                type="button"
                onClick={() => {
                  onPickCustomer(customer);
                  setQuery("");
                  setOpen(false);
                }}
                className={`flex w-full flex-col gap-0.5 border-b border-white/40 px-4 py-2.5 text-left hover:bg-white/60 ${
                  customer.id === selectedId ? "bg-teal-50/70" : ""
                }`}
              >
                <span className="text-sm font-semibold">{customer.name}</span>
                <span className="text-xs text-k2-muted">
                  {[customer.phone, customer.lineId].filter(Boolean).join(" · ") || "ไม่มีเบอร์/LINE"}
                </span>
              </button>
            ))}
            {matches.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm font-semibold text-k2-muted">ไม่พบลูกค้าที่ค้นหา</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const leadStatusInfo: Record<Lead["status"], { label: string; cls: string }> = {
  new: { label: "ใหม่", cls: "bg-rose-100 text-rose-700" },
  contacting: { label: "กำลังคุย", cls: "bg-amber-100 text-amber-700" },
  quoted: { label: "เสนอราคาแล้ว", cls: "bg-sky-100 text-sky-700" },
  won: { label: "ปิดการขาย", cls: "bg-teal-100 text-teal-700" },
  lost: { label: "ไม่ปิด", cls: "bg-slate-100 text-slate-500" }
};

function LeadsView({
  leads,
  onCreate,
  onSetStatus,
  onConvert
}: {
  leads: Lead[];
  onCreate: (input: { name: string; phone: string; channel: string; page: string; message: string }) => void;
  onSetStatus: (id: string, status: Lead["status"]) => void;
  onConvert: (lead: Lead) => void;
}) {
  const [form, setForm] = useState({ name: "", phone: "", channel: "Facebook", page: "", message: "" });
  const channelOptions = ["Facebook", "LINE", "หน้าร้าน", "TikTok", "Website", "Shopee", "โทรศัพท์", "อื่น ๆ"];
  const openCount = leads.filter((l) => l.status === "new" || l.status === "contacting").length;

  function submit() {
    if (!form.name.trim()) return;
    onCreate(form);
    setForm({ name: "", phone: "", channel: "Facebook", page: "", message: "" });
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
      <section className="glass rounded-[1.5rem] p-5">
        <div className="mb-4">
          <p className="text-sm font-semibold text-k2-muted">กล่องลูกค้า (Lead)</p>
          <h3 className="text-2xl font-semibold">บันทึกลูกค้าที่ทักเข้ามา</h3>
          <p className="mt-1 text-sm font-semibold text-k2-muted">ลูกค้าทัก → บันทึก → ตามสถานะ → แปลงเป็นใบเสนอราคา</p>
        </div>
        <div className="space-y-3">
          <TextField label="ชื่อลูกค้า" value={form.name} onChange={(v) => setForm((c) => ({ ...c, name: v }))} />
          <TextField label="เบอร์โทร" value={form.phone} onChange={(v) => setForm((c) => ({ ...c, phone: v }))} />
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-k2-muted">ช่องทาง</span>
            <select value={form.channel} onChange={(e) => setForm((c) => ({ ...c, channel: e.target.value }))} className="w-full rounded-2xl border border-white/80 bg-white/80 px-4 py-3 outline-none">
              {channelOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <TextField label="ชื่อเพจ/ไลน์" value={form.page} onChange={(v) => setForm((c) => ({ ...c, page: v }))} />
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-k2-muted">ข้อความ/ความต้องการ</span>
            <textarea value={form.message} onChange={(e) => setForm((c) => ({ ...c, message: e.target.value }))} className="min-h-24 w-full rounded-2xl border border-white/80 bg-white/80 px-4 py-3 outline-none" />
          </label>
          <button type="button" onClick={submit} className="w-full rounded-2xl bg-k2-ink px-5 py-3.5 font-semibold text-white shadow-lg shadow-slate-900/15">บันทึก Lead</button>
        </div>
      </section>

      <section className="glass rounded-[1.5rem] p-5">
        <h4 className="mb-4 text-xl font-semibold">รายการ ({leads.length}) · ค้าง {openCount}</h4>
        {leads.length === 0 ? (
          <p className="rounded-2xl bg-white/60 px-4 py-8 text-center text-sm font-semibold text-k2-muted">ยังไม่มี Lead</p>
        ) : (
          <div className="space-y-3">
            {leads.map((lead) => (
              <div key={lead.id} className="rounded-2xl border border-white/70 bg-white/55 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold leading-5">{lead.name}{lead.phone ? ` · ${lead.phone}` : ""}</p>
                    <p className="text-sm text-k2-muted">📍 {lead.channel || "-"}{lead.page ? ` · ${lead.page}` : ""}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold ${leadStatusInfo[lead.status].cls}`}>{leadStatusInfo[lead.status].label}</span>
                </div>
                {lead.message ? <p className="mt-2 whitespace-pre-wrap text-sm text-k2-muted">{lead.message}</p> : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {lead.status === "new" ? (
                    <button type="button" onClick={() => onSetStatus(lead.id, "contacting")} className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-extrabold text-white">เริ่มคุย</button>
                  ) : null}
                  {lead.status !== "quoted" && lead.status !== "won" && lead.status !== "lost" ? (
                    <button type="button" onClick={() => onConvert(lead)} className="rounded-xl bg-k2-ink px-3 py-2 text-xs font-extrabold text-white">→ แปลงเป็นใบเสนอราคา</button>
                  ) : null}
                  {lead.status !== "won" ? (
                    <button type="button" onClick={() => onSetStatus(lead.id, "won")} className="rounded-xl bg-teal-500 px-3 py-2 text-xs font-extrabold text-white">ปิดการขาย</button>
                  ) : null}
                  {lead.status !== "lost" ? (
                    <button type="button" onClick={() => onSetStatus(lead.id, "lost")} className="rounded-xl bg-white/70 px-3 py-2 text-xs font-extrabold text-k2-muted shadow-sm">ไม่ปิด</button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

const quotationStatusInfo: Record<Quotation["status"], { label: string; cls: string }> = {
  draft: { label: "ฉบับร่าง", cls: "bg-slate-100 text-slate-600" },
  sent: { label: "ส่งให้ลูกค้าแล้ว", cls: "bg-sky-100 text-sky-700" },
  approved: { label: "ลูกค้าอนุมัติ", cls: "bg-teal-100 text-teal-700" },
  rejected: { label: "ปฏิเสธ", cls: "bg-rose-100 text-rose-700" },
  converted: { label: "แปลงเป็นใบงานแล้ว", cls: "bg-violet-100 text-violet-700" }
};

function QuotationsView({
  quotations,
  customers,
  canSeeMoney,
  onCreate,
  onSetStatus,
  onConvert
}: {
  quotations: Quotation[];
  customers: Customer[];
  canSeeMoney: boolean;
  onCreate: (input: { customerId?: string; customerName: string; customerPhone: string; title: string; description: string; amount: number }) => void;
  onSetStatus: (id: string, status: Quotation["status"]) => void;
  onConvert: (q: Quotation) => void;
}) {
  const [form, setForm] = useState({ customerId: "new", customerName: "", customerPhone: "", title: "", description: "", amount: 0 });

  function pickCustomer(customer: Customer) {
    setForm((c) => ({ ...c, customerId: customer.id, customerName: customer.name, customerPhone: customer.phone }));
  }
  function pickNew() {
    setForm((c) => ({ ...c, customerId: "new", customerName: "", customerPhone: "" }));
  }
  function submit() {
    if (!form.customerName.trim() || !form.title.trim()) return;
    onCreate({ customerId: form.customerId, customerName: form.customerName, customerPhone: form.customerPhone, title: form.title, description: form.description, amount: form.amount });
    setForm({ customerId: "new", customerName: "", customerPhone: "", title: "", description: "", amount: 0 });
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
      {/* ฟอร์มสร้างใบเสนอราคา */}
      <section className="glass rounded-[1.5rem] p-5">
        <div className="mb-4">
          <p className="text-sm font-semibold text-k2-muted">ใบเสนอราคา</p>
          <h3 className="text-2xl font-semibold">สร้างใบเสนอราคาใหม่</h3>
          <p className="mt-1 text-sm font-semibold text-k2-muted">เสนอราคา → ส่งให้ลูกค้า → ลูกค้าอนุมัติ → แปลงเป็นใบงาน</p>
        </div>
        <div className="space-y-3">
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-k2-muted">ลูกค้า</span>
            <CustomerPicker customers={customers} selectedId={form.customerId} selectedName={form.customerName} onPickNew={pickNew} onPickCustomer={pickCustomer} />
          </label>
          <TextField label={form.customerId === "new" ? "ชื่อลูกค้าใหม่" : "ชื่อลูกค้า"} value={form.customerName} onChange={(v) => setForm((c) => ({ ...c, customerName: v }))} />
          <TextField label="เบอร์โทร" value={form.customerPhone} onChange={(v) => setForm((c) => ({ ...c, customerPhone: v }))} />
          <TextField label="ชื่องาน / หัวข้อ" value={form.title} onChange={(v) => setForm((c) => ({ ...c, title: v }))} />
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-k2-muted">รายละเอียด</span>
            <textarea value={form.description} onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))} className="min-h-24 w-full rounded-2xl border border-white/80 bg-white/80 px-4 py-3 outline-none" />
          </label>
          <NumberField label="ราคาเสนอ (บาท)" value={form.amount} onChange={(v) => setForm((c) => ({ ...c, amount: v }))} />
          <button type="button" onClick={submit} className="w-full rounded-2xl bg-k2-ink px-5 py-3.5 font-semibold text-white shadow-lg shadow-slate-900/15">
            สร้างใบเสนอราคา
          </button>
        </div>
      </section>

      {/* รายการใบเสนอราคา */}
      <section className="glass rounded-[1.5rem] p-5">
        <h4 className="mb-4 text-xl font-semibold">รายการใบเสนอราคา ({quotations.length})</h4>
        {quotations.length === 0 ? (
          <p className="rounded-2xl bg-white/60 px-4 py-8 text-center text-sm font-semibold text-k2-muted">ยังไม่มีใบเสนอราคา</p>
        ) : (
          <div className="space-y-3">
            {quotations.map((q) => (
              <div key={q.id} className="rounded-2xl border border-white/70 bg-white/55 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold leading-5">{q.title}</p>
                    <p className="text-sm text-k2-muted">{q.customerName}{q.customerPhone ? ` · ${q.customerPhone}` : ""}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold ${quotationStatusInfo[q.status].cls}`}>{quotationStatusInfo[q.status].label}</span>
                </div>
                {q.description ? <p className="mt-2 whitespace-pre-wrap text-sm text-k2-muted">{q.description}</p> : null}
                {canSeeMoney ? <p className="mt-2 text-sm font-extrabold text-k2-ink">{money.format(q.amount)}</p> : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {q.status === "draft" ? (
                    <button type="button" onClick={() => onSetStatus(q.id, "sent")} className="rounded-xl bg-sky-500 px-3 py-2 text-xs font-extrabold text-white">ส่งให้ลูกค้า</button>
                  ) : null}
                  {q.status === "sent" ? (
                    <>
                      <button type="button" onClick={() => onSetStatus(q.id, "approved")} className="rounded-xl bg-teal-500 px-3 py-2 text-xs font-extrabold text-white">ลูกค้าอนุมัติ</button>
                      <button type="button" onClick={() => onSetStatus(q.id, "rejected")} className="rounded-xl bg-white/70 px-3 py-2 text-xs font-extrabold text-rose-600 shadow-sm">ปฏิเสธ</button>
                    </>
                  ) : null}
                  {q.status === "approved" ? (
                    <button type="button" onClick={() => onConvert(q)} className="rounded-xl bg-k2-ink px-3 py-2 text-xs font-extrabold text-white">→ แปลงเป็นใบงาน (รับมัดจำ)</button>
                  ) : null}
                  {q.status === "rejected" ? (
                    <button type="button" onClick={() => onSetStatus(q.id, "draft")} className="rounded-xl bg-white/70 px-3 py-2 text-xs font-extrabold text-k2-muted shadow-sm">กลับเป็นร่าง</button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function CreateJobView({
  customers,
  teamMembers,
  companyProfile,
  expressEnabled,
  canAssign,
  prefill,
  onCreate
}: {
  customers: Customer[];
  teamMembers: TeamMember[];
  companyProfile: CompanyProfile;
  expressEnabled: boolean;
  canAssign: boolean;
  prefill?: Partial<Job> | null;
  onCreate: (job: Partial<Job>, attachments?: File[]) => void;
}) {
  const designerOptions = useMemo(() => teamMembers.filter((member) => member.role === "Designer" || (member.roles ?? []).includes("Designer")), [teamMembers]);
  const productionOptions = useMemo(() => teamMembers.filter((member) => member.role === "Production Staff" || (member.roles ?? []).includes("Production Staff")), [teamMembers]);
  const defaultDesigner = "Unassigned";
  // ค่าเริ่มต้น "ยังไม่มอบหมาย" เสมอ — ให้ผู้จัดการสาขาเป็นคนมอบหมายภายหลัง (เซลแค่ลงข้อมูล)
  const defaultProduction = "Unassigned";
  // ฟอร์มสร้างงานเริ่มจากค่าว่างเสมอ เพื่อไม่ให้ข้อมูลจากงานก่อนหน้าค้างมาทำให้สร้างออเดอร์ผิด/ซ้ำ
  const [form, setForm] = useState({
    customerId: prefill?.customerId ?? "new",
    customerName: prefill?.customerName ?? "",
    phone: prefill?.phone ?? "",
    lineId: "",
    companyName: "",
    taxId: "",
    branch: "สำนักงานใหญ่",
    billingAddress: "",
    accountingEmail: "",
    requiresInvoice: false,
    title: prefill?.title ?? "",
    type: "DTG Shirt" as JobType,
    description: prefill?.description ?? "",
    quantity: 1,
    orderDate: todayISO(),
    dueDate: addDaysISO(todayISO(), DEFAULT_LEAD_TIME_DAYS),
    isExpress: false,
    priority: "Normal" as Priority,
    assignedDesigner: defaultDesigner,
    assignedProduction: defaultProduction,
    price: prefill?.price ?? 0,
    vatMode: (prefill?.vatMode ?? "none") as VatMode,
    deposit: 0,
    depositReceivedDate: todayISO(),
    depositSlip: "",
    depositWaived: false,
    internalNotes: "",
    fileName: "",
    sourceChannel: "LINE",
    salesPage: "",
    incomeBranch: "",
    facebookPage: companyProfile.facebookPages[0] ?? "",
    fileStatus: "รอเช็กไฟล์",
    materials: [""] as string[],
    colorSpec: "",
    productionBranch: "พะเยา",
    deliveryMethod: "รับหน้าร้าน",
    deliveryOther: "",
    deliveryAddress: ""
  });

  const [formError, setFormError] = useState("");
  const [lookupMsg, setLookupMsg] = useState("");
  const [slipError, setSlipError] = useState("");
  // รูปแบบงานลูกค้า — เก็บไฟล์ไว้ในฟอร์ม แล้วอัปขึ้น storage หลังสร้างงานสำเร็จ
  const [designFiles, setDesignFiles] = useState<Array<{ id: string; file: File; preview: string }>>([]);
  const [designError, setDesignError] = useState("");

  async function addDesignFiles(list: FileList | null) {
    if (!list?.length) return;
    setDesignError("");
    const incoming: Array<{ id: string; file: File; preview: string }> = [];
    for (const file of Array.from(list)) {
      if (!file.type.startsWith("image/")) {
        setDesignError("แนบได้เฉพาะไฟล์รูปภาพ");
        continue;
      }
      if (file.size > 10_000_000) {
        setDesignError(`"${file.name}" ใหญ่เกิน 10 MB`);
        continue;
      }
      incoming.push({ id: crypto.randomUUID(), file, preview: await readImageAsDataUrl(file) });
    }
    if (incoming.length) setDesignFiles((current) => [...current, ...incoming]);
  }

  function removeDesignFile(id: string) {
    setDesignFiles((current) => current.filter((d) => d.id !== id));
  }

  async function handleSlipUpload(file: File | null) {
    if (!file) return;
    setSlipError("");
    if (!file.type.startsWith("image/")) {
      setSlipError("กรุณาเลือกไฟล์รูปภาพเท่านั้น");
      return;
    }
    if (file.size > 1_500_000) {
      setSlipError("รูปสลิปต้องมีขนาดไม่เกิน 1.5 MB");
      return;
    }
    const dataUrl = await readImageAsDataUrl(file);
    setField("depositSlip", dataUrl);
  }

  function setField<Key extends keyof typeof form>(key: Key, value: (typeof form)[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const materialOptions = ["อะคริลิค", "พลาสวูด", "ไวนิล", "สติ๊กเกอร์", "เสื้อ Cotton", "อื่น ๆ"];
  const branchOptions = BRANCH_LIST;
  function setMaterialAt(index: number, value: string) {
    setForm((current) => ({ ...current, materials: current.materials.map((m, i) => (i === index ? value : m)) }));
  }
  function addMaterial() {
    setForm((current) => ({ ...current, materials: [...current.materials, ""] }));
  }
  function removeMaterial(index: number) {
    setForm((current) => ({ ...current, materials: current.materials.filter((_, i) => i !== index) }));
  }

  // ค้นลูกค้าจากเบอร์โทรที่กรอก แล้วดึงข้อมูลทั้งหมดมาเติมในฟอร์ม
  function lookupByPhone() {
    const digits = form.phone.replace(/\D/g, "");
    if (digits.length < 3) {
      setLookupMsg("กรอกเบอร์อย่างน้อย 3 ตัวก่อนค้นหา");
      return;
    }
    const found = customers.filter((customer) => customer.phone.replace(/\D/g, "").includes(digits));
    if (found.length === 0) {
      setLookupMsg("ไม่พบลูกค้าจากเบอร์นี้ — กรอกชื่อเพื่อสร้างใหม่ได้เลย");
      return;
    }
    pickCustomer(found[0]);
    setLookupMsg(
      found.length > 1
        ? `พบ ${found.length} ราย ดึงรายแรกมาให้ (${found[0].name}) ถ้าไม่ตรงใช้ช่องค้นหาด้านบน`
        : `ดึงข้อมูล "${found[0].name}" มาเรียบร้อย`
    );
  }

  function pickNewCustomer() {
    setForm((current) => ({
      ...current,
      customerId: "new",
      customerName: "",
      phone: "",
      lineId: "",
      companyName: "",
      taxId: "",
      branch: "สำนักงานใหญ่",
      billingAddress: "",
      accountingEmail: "",
      requiresInvoice: false
    }));
  }

  function pickCustomer(customer: Customer) {
    setForm((current) => ({
      ...current,
      customerId: customer.id,
      customerName: customer.name,
      phone: customer.phone,
      lineId: customer.lineId,
      companyName: customer.companyName ?? "",
      taxId: customer.taxId ?? "",
      branch: customer.branch ?? "สำนักงานใหญ่",
      billingAddress: customer.billingAddress ?? "",
      accountingEmail: customer.accountingEmail ?? customer.email,
      requiresInvoice: customer.requiresInvoice ?? false
    }));
  }

  useEffect(() => {
    setForm((current) => ({
      ...current,
      assignedDesigner: designerOptions.some((member) => member.name === current.assignedDesigner) || current.assignedDesigner === "Unassigned" ? current.assignedDesigner : defaultDesigner,
      assignedProduction: productionOptions.some((member) => member.name === current.assignedProduction) || current.assignedProduction === "Unassigned"
        ? current.assignedProduction
        : defaultProduction
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamMembers]);

  // เลือกเพจ → กำหนดสาขา "รายได้" อัตโนมัติ (ไม่ยุ่งกับสาขาที่ผลิต ซึ่งอิงประเภทงาน)
  function pickSalesPage(page: string) {
    setForm((current) => ({
      ...current,
      salesPage: page,
      incomeBranch: page && PAGE_TO_BRANCH[page] ? PAGE_TO_BRANCH[page] : ""
    }));
  }

  // สาขาที่ผลิตอิงประเภทงาน (DTG/3D→พระรามเก้า, ที่เหลือ→พะเยา) — ปรับเองทีหลังได้
  useEffect(() => {
    setForm((current) => ({ ...current, productionBranch: branchForJobType(current.type) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.type]);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        // ลูกค้าใหม่ต้องมีชื่อ เพื่อไม่ให้เกิดเรคคอร์ด "ลูกค้าใหม่" ค้างในระบบ
        if (form.customerId === "new" && !form.customerName.trim()) {
          setFormError("กรุณากรอกชื่อลูกค้า หรือเลือกลูกค้าเดิมจากช่องค้นหา");
          return;
        }
        // หมายเหตุ: ไม่บังคับแนบสลิป/มัดจำตอนสร้าง — ตาม flow ใหม่ของทีม (งานเริ่มที่ "Quotation")
        // มัดจำ/สลิปจะเก็บภายหลังในขั้นการเงิน (แนบที่นี่ก่อนได้ ถ้ามีแล้ว)
        setFormError("");
        const workOrderSpec = [
          `ช่องทางรับงาน: ${form.sourceChannel || "-"}`,
          ...(form.salesPage ? [`เพจที่รับงาน: ${form.salesPage} (รายได้→${PAGE_TO_BRANCH[form.salesPage] || "-"})`] : []),
          `สถานะไฟล์: ${form.fileStatus || "-"}`,
          `วัสดุ: ${form.materials.filter(Boolean).join(", ") || "-"}`,
          `สี / สเปกสี: ${form.colorSpec || "-"}`,
          `สาขาที่ผลิต: ${form.productionBranch || "-"}`,
          `วิธีรับ/จัดส่ง: ${form.deliveryMethod === "ขนส่งอื่น ๆ" && form.deliveryOther ? `${form.deliveryMethod} (${form.deliveryOther})` : form.deliveryMethod || "-"}`,
          `ที่อยู่จัดส่ง: ${form.deliveryAddress.trim() || "-"}`
        ].join("\n");
        onCreate({
          ...form,
          description: `${form.description}\n\nสเปกใบสั่งงาน:\n${workOrderSpec}`,
          internalNotes: `${form.internalNotes}\n\nข้อมูลฝ่ายผลิต:\n${workOrderSpec}`,
          assignedDesigner: designerOptions.some((member) => member.name === form.assignedDesigner) || form.assignedDesigner === "Unassigned" ? form.assignedDesigner : defaultDesigner,
          assignedProduction: productionOptions.some((member) => member.name === form.assignedProduction) || form.assignedProduction === "Unassigned"
            ? form.assignedProduction
            : defaultProduction
        }, designFiles.map((d) => d.file));
      }}
      className="grid gap-4 xl:grid-cols-[1fr_0.72fr]"
    >
      <section className="glass rounded-[1.5rem] p-5">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-k2-muted">สร้างงาน</p>
            <h3 className="text-2xl font-semibold">ออเดอร์ผลิตใหม่</h3>
          </div>
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-k2-mint">
            <ClipboardPlus className="h-6 w-6" />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-k2-muted">ลูกค้า</span>
            <CustomerPicker
              customers={customers}
              selectedId={form.customerId}
              selectedName={form.customerName}
              onPickNew={pickNewCustomer}
              onPickCustomer={pickCustomer}
            />
          </label>
          <TextField
            label={form.customerId === "new" ? "ชื่อลูกค้าใหม่" : "ชื่อลูกค้า"}
            value={form.customerName}
            onChange={(value) => setField("customerName", value)}
          />
          <label className="space-y-2">
            <span className="text-sm font-semibold text-k2-muted">ลูกค้าจากช่องทาง</span>
            <select
              value={form.sourceChannel}
              onChange={(event) => {
                const nextChannel = event.target.value;
                setForm((current) => ({
                  ...current,
                  sourceChannel: nextChannel,
                  facebookPage: nextChannel === "Facebook" ? current.facebookPage || companyProfile.facebookPages[0] || "" : current.facebookPage
                }));
              }}
              className="w-full rounded-2xl border border-white/80 bg-white/80 px-4 py-3 outline-none"
            >
              {["Facebook", "LINE", "หน้าร้าน", "โทรศัพท์", "Sales", "ลูกค้าเก่า", "อื่น ๆ"].map((channel) => (
                <option key={channel}>{channel}</option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-k2-muted">เพจที่รับงาน (กำหนดสาขารายได้)</span>
            <select
              value={form.salesPage}
              onChange={(event) => pickSalesPage(event.target.value)}
              className="w-full rounded-2xl border border-white/80 bg-white/80 px-4 py-3 outline-none"
            >
              <option value="">— ไม่ผ่านเพจ —</option>
              <optgroup label="พะเยา">
                {SALES_PAGES.filter((p) => p.branch === "พะเยา").map((p) => (
                  <option key={p.page} value={p.page}>{p.page}</option>
                ))}
              </optgroup>
              <optgroup label="พระรามเก้า">
                {SALES_PAGES.filter((p) => p.branch === "พระรามเก้า").map((p) => (
                  <option key={p.page} value={p.page}>{p.page}</option>
                ))}
              </optgroup>
            </select>
            {form.salesPage ? (
              <p className="text-xs font-bold text-k2-ink">💰 รายได้เข้าสาขา <span className="text-emerald-700">{PAGE_TO_BRANCH[form.salesPage]}</span></p>
            ) : (
              <p className="text-xs font-semibold text-k2-muted">ไม่ได้มาจากเพจ — รายได้จะเข้าสาขาที่ผลิต</p>
            )}
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-k2-muted">เบอร์โทร</span>
            <div className="flex gap-2">
              <input
                value={form.phone}
                onChange={(event) => {
                  setField("phone", event.target.value);
                  if (lookupMsg) setLookupMsg("");
                }}
                inputMode="tel"
                className="w-full rounded-2xl border border-white/80 bg-white/80 px-4 py-3 outline-none"
              />
              <button
                type="button"
                onClick={lookupByPhone}
                className="inline-flex shrink-0 items-center gap-1 rounded-2xl bg-k2-mint px-3 py-3 text-sm font-bold text-k2-ink"
                title="ค้นลูกค้าจากเบอร์นี้แล้วดึงข้อมูลมาเติม"
              >
                <Search className="h-4 w-4" /> ดึงข้อมูล
              </button>
            </div>
            {lookupMsg ? <span className="block text-xs font-semibold text-k2-muted">{lookupMsg}</span> : null}
          </label>
          <TextField label="LINE ID" value={form.lineId} onChange={(value) => setField("lineId", value)} />
          <TextField label="ชื่องาน" value={form.title} onChange={(value) => setField("title", value)} />
          <label className="space-y-2">
            <span className="text-sm font-semibold text-k2-muted">ประเภทงาน</span>
            <select
              value={form.type}
              onChange={(event) => setField("type", event.target.value as JobType)}
              className="w-full rounded-2xl border border-white/80 bg-white/80 px-4 py-3 outline-none"
            >
              {jobTypes.map((type) => (
                <option key={type} value={type}>{jobTypeLabel[type]}</option>
              ))}
            </select>
          </label>
          <NumberField label="จำนวน" value={form.quantity} onChange={(value) => setField("quantity", value)} />
          {/* โหมดงานด่วน — เปิดได้เมื่อผู้จัดการ/เจ้าของเปิดรับงานด่วนเท่านั้น */}
          <label
            className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 md:col-span-2 ${
              form.isExpress ? "border-rose-300 bg-rose-50" : "border-white/80 bg-white/80"
            } ${!expressEnabled ? "opacity-60" : ""}`}
          >
            <span className="flex items-center gap-2 text-sm font-extrabold text-k2-ink">
              <Zap className={`h-4 w-4 ${form.isExpress ? "text-rose-500" : "text-k2-muted"}`} />
              งานด่วน
              {!expressEnabled ? (
                <span className="text-xs font-semibold text-k2-muted">(ต้องขออนุมัติงานด่วนจากผู้จัดการก่อน)</span>
              ) : (
                <span className="text-xs font-semibold text-k2-muted">ระบุวันนัดส่งเองได้</span>
              )}
            </span>
            <input
              type="checkbox"
              checked={form.isExpress}
              disabled={!expressEnabled}
              onChange={(event) =>
                setForm((current) => {
                  const isExpress = event.target.checked;
                  return {
                    ...current,
                    isExpress,
                    // เปิดด่วน: นัดส่งเริ่มที่วันนี้ + ดันความเร่งด่วน / ปิดด่วน: กลับไปใช้ lead time 7 วัน
                    dueDate: isExpress ? current.orderDate : addDaysISO(current.orderDate, DEFAULT_LEAD_TIME_DAYS),
                    priority: isExpress ? "Very Urgent" : current.priority
                  };
                })
              }
              className="h-5 w-5 accent-rose-500 disabled:cursor-not-allowed"
            />
          </label>
          <TextField
            label="วันที่รับงาน"
            type="date"
            value={form.orderDate}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                orderDate: value,
                // งานปกติ: ขยับกำหนดส่งตามวันรับงาน + lead time (เว้นแต่ตั้งเอง) / งานด่วน: ไม่แตะวันนัดส่ง
                dueDate:
                  !current.isExpress && current.dueDate === addDaysISO(current.orderDate, DEFAULT_LEAD_TIME_DAYS)
                    ? addDaysISO(value, DEFAULT_LEAD_TIME_DAYS)
                    : current.dueDate
              }))
            }
          />
          <TextField
            label={form.isExpress ? "วันที่นัดส่งงาน (ด่วน)" : "กำหนดส่ง"}
            type="date"
            value={form.dueDate}
            onChange={(value) => setField("dueDate", value)}
          />
          <label className="space-y-2">
            <span className="text-sm font-semibold text-k2-muted">ความเร่งด่วน</span>
            <select
              value={form.priority}
              onChange={(event) => setField("priority", event.target.value as Priority)}
              className="w-full rounded-2xl border border-white/80 bg-white/80 px-4 py-3 outline-none"
            >
              {priorities.map((priority) => (
                <option key={priority} value={priority}>{priorityLabel[priority]}</option>
              ))}
            </select>
          </label>
          {canAssign ? (
            <>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-k2-muted">ผู้รับผิดชอบออกแบบ</span>
                <select
                  value={form.assignedDesigner}
                  onChange={(event) => setField("assignedDesigner", event.target.value)}
                  className="w-full rounded-2xl border border-white/80 bg-white/80 px-4 py-3 outline-none"
                >
                  {designerOptions.map((member) => (
                    <option key={member.id}>{member.name}</option>
                  ))}
                  <option value="Unassigned">ยังไม่มอบหมาย</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-k2-muted">ผู้รับผิดชอบผลิต</span>
                <select
                  value={form.assignedProduction}
                  onChange={(event) => setField("assignedProduction", event.target.value)}
                  className="w-full rounded-2xl border border-white/80 bg-white/80 px-4 py-3 outline-none"
                >
                  {productionOptions.map((member) => (
                    <option key={member.id}>{member.name}</option>
                  ))}
                  <option value="Unassigned">ยังไม่มอบหมาย</option>
                </select>
              </label>
            </>
          ) : (
            <div className="md:col-span-2 rounded-2xl border border-dashed border-k2-mint bg-k2-mint/20 px-4 py-3 text-sm font-semibold text-k2-ink">
              ผู้รับผิดชอบงาน (ออกแบบ/ผลิต) — <span className="text-k2-muted">ผู้จัดการสาขาจะเป็นผู้มอบหมายหลังรับงาน</span>
            </div>
          )}
          <NumberField label="ราคา" value={form.price} onChange={(value) => setField("price", value)} />
          <label className="space-y-2">
            <span className="text-sm font-semibold text-k2-muted">ภาษีมูลค่าเพิ่ม (VAT 7%)</span>
            <select
              value={form.vatMode}
              onChange={(event) => setField("vatMode", event.target.value as VatMode)}
              className="w-full rounded-2xl border border-white/80 bg-white/80 px-4 py-3 outline-none"
            >
              {VAT_MODES.map((mode) => (
                <option key={mode} value={mode}>{vatModeLabel[mode]}</option>
              ))}
            </select>
            {(() => {
              const v = computeVat(Number(form.price) || 0, form.vatMode);
              return form.vatMode === "none" ? (
                <p className="text-xs font-semibold text-k2-muted">ไม่คิดภาษี — ยอดรวม {money.format(v.total)}</p>
              ) : (
                <p className="text-xs font-semibold text-k2-muted">
                  ก่อนภาษี {money.format(v.base)} · VAT {money.format(v.vat)} · <span className="text-k2-ink">รวม {money.format(v.total)}</span>
                </p>
              );
            })()}
          </label>
          <NumberField label="มัดจำ" value={form.deposit} onChange={(value) => setField("deposit", value)} />
          <TextField
            label="วันที่รับเงินมัดจำ"
            type="date"
            value={form.depositReceivedDate}
            onChange={(value) => setField("depositReceivedDate", value)}
          />
          <div className="space-y-2 md:col-span-2 rounded-2xl border border-white/80 bg-white/55 p-4">
            <span className="flex items-center gap-2 text-sm font-extrabold text-k2-ink">
              <FileImage className="h-4 w-4 text-k2-ink" />
              แบบงานลูกค้า (รูปภาพ) <span className="text-xs font-bold text-k2-muted">แนบได้หลายรูป · ไม่เกิน 10 MB/รูป</span>
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-bold text-k2-ink shadow-sm">
                <FileImage className="h-4 w-4" />
                อัปโหลดรูปแบบงาน
                <input type="file" accept="image/*" multiple className="hidden" onChange={(event) => { void addDesignFiles(event.target.files); event.target.value = ""; }} />
              </label>
              {designFiles.length ? <span className="text-xs font-semibold text-k2-muted">แนบแล้ว {designFiles.length} รูป</span> : <span className="text-xs font-semibold text-k2-muted">ยังไม่ได้แนบรูป</span>}
            </div>
            {designError ? <p className="text-xs font-bold text-rose-600">{designError}</p> : null}
            {designFiles.length ? (
              <div className="flex flex-wrap gap-3">
                {designFiles.map((d) => (
                  <div key={d.id} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={d.preview} alt={d.file.name} className="h-20 w-20 rounded-xl object-cover ring-1 ring-slate-200" />
                    <button type="button" onClick={() => removeDesignFile(d.id)} className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-rose-500 text-xs font-bold text-white shadow">×</button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          {/* สลิปมัดจำ — ไม่บังคับตอนสร้าง (เก็บภายหลังในขั้นการเงินได้) */}
          <div className={`space-y-3 md:col-span-2 rounded-2xl border p-4 ${form.depositWaived ? "border-amber-200 bg-amber-50/60" : "border-white/80 bg-white/55"}`}>
            <label className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-sm font-extrabold text-k2-ink">
                <ShieldCheck className="h-4 w-4 text-amber-600" />
                ไม่ต้องมัดจำ (ขออนุมัติเจ้าของ)
              </span>
              <input
                type="checkbox"
                checked={form.depositWaived}
                onChange={(event) => setField("depositWaived", event.target.checked)}
                className="h-5 w-5 accent-amber-500"
              />
            </label>
            {form.depositWaived ? (
              <p className="text-xs font-semibold text-amber-700">งานนี้จะถูกสร้างโดยไม่ต้องแนบสลิป แต่จะ<strong>ยังไม่เข้าคิวผลิตจนกว่าเจ้าของจะอนุมัติ</strong></p>
            ) : (
              <>
                <span className="flex items-center gap-2 text-sm font-extrabold text-k2-ink">
                  <WalletCards className="h-4 w-4 text-rose-500" />
                  สลิปมัดจำ <span className="text-xs font-bold text-k2-muted">(ไม่บังคับ — เก็บภายหลังในขั้นการเงินได้)</span>
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-bold text-k2-ink shadow-sm">
                    <FileImage className="h-4 w-4" />
                    {form.depositSlip ? "เปลี่ยนรูปสลิป" : "แนบรูปสลิป"}
                    <input type="file" accept="image/*" className="hidden" onChange={(event) => void handleSlipUpload(event.target.files?.[0] ?? null)} />
                  </label>
                  {form.depositSlip ? (
                    <div className="flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={form.depositSlip} alt="สลิปมัดจำ" className="h-16 w-16 rounded-xl object-cover ring-1 ring-rose-200" />
                      <button type="button" onClick={() => setField("depositSlip", "")} className="text-xs font-bold text-rose-600">ลบรูป</button>
                    </div>
                  ) : (
                    <span className="text-xs font-semibold text-k2-muted">ยังไม่ได้แนบสลิป</span>
                  )}
                </div>
                {slipError ? <p className="text-xs font-semibold text-rose-600">{slipError}</p> : null}
              </>
            )}
          </div>
        </div>

        <div className="mt-5 rounded-[1.35rem] border border-white/70 bg-white/45 p-4">
          <div className="mb-4">
            <h4 className="text-lg font-extrabold">สเปกใบสั่งงาน</h4>
            <p className="text-sm font-semibold text-k2-muted">ข้อมูลที่ทีมออกแบบ ผลิต QC และแพ็กของต้องใช้ทำงานจริง</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {/* สถานะไฟล์ + ขนาดงาน: ตัดออกจากฟอร์มเปิดงาน — สถานะให้ฝ่ายผลิตคุมบนบอร์ด, ขนาด/จำนวนหลายชิ้นให้พิมพ์ในช่อง "รายละเอียดงาน" ด้านล่าง */}
            <div className="space-y-2 md:col-span-2">
              <span className="text-sm font-semibold text-k2-muted">วัสดุ (เพิ่มได้หลายรายการ)</span>
              <div className="space-y-2">
                {form.materials.map((mat, index) => (
                  <div key={index} className="flex gap-2">
                    <select
                      value={mat}
                      onChange={(event) => setMaterialAt(index, event.target.value)}
                      className="w-full rounded-2xl border border-white/80 bg-white/80 px-4 py-3 outline-none"
                    >
                      <option value="">เลือกวัสดุ</option>
                      {materialOptions.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                    {form.materials.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeMaterial(index)}
                        className="shrink-0 rounded-2xl bg-white/70 px-3 py-3 text-sm font-bold text-rose-600"
                        title="ลบวัสดุนี้"
                      >
                        ลบ
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addMaterial}
                className="inline-flex items-center gap-1 rounded-2xl bg-k2-mint px-3 py-2 text-sm font-bold text-k2-ink"
              >
                <Plus className="h-4 w-4" /> เพิ่มวัสดุ
              </button>
            </div>
            <TextField label="สี / สเปกสี" value={form.colorSpec} onChange={(value) => setField("colorSpec", value)} />
            <label className="space-y-2">
              <span className="text-sm font-semibold text-k2-muted">สาขาที่ผลิต (ตามประเภทงาน)</span>
              <select
                value={form.productionBranch}
                onChange={(event) => setField("productionBranch", event.target.value)}
                className="w-full rounded-2xl border border-white/80 bg-white/80 px-4 py-3 outline-none"
              >
                {branchOptions.map((branch) => (
                  <option key={branch}>{branch}</option>
                ))}
              </select>
              <p className="text-xs font-semibold text-k2-muted">🏭 ตั้งอัตโนมัติจากประเภทงาน ({jobTypeLabel[form.type]} → {branchForJobType(form.type)}) · แก้เองได้</p>
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-semibold text-k2-muted">วิธีรับ/จัดส่งสินค้า</span>
              <select
                value={form.deliveryMethod}
                onChange={(event) => setField("deliveryMethod", event.target.value)}
                className="w-full rounded-2xl border border-white/80 bg-white/80 px-4 py-3 outline-none"
              >
                {["รับหน้าร้าน", "Messenger", "Grab", "Kerry", "Flash", "ขนส่งอื่น ๆ"].map((method) => (
                  <option key={method}>{method}</option>
                ))}
              </select>
              {form.deliveryMethod === "ขนส่งอื่น ๆ" ? (
                <input
                  value={form.deliveryOther}
                  onChange={(event) => setField("deliveryOther", event.target.value)}
                  placeholder="ระบุขนส่ง เช่น รถทัวร์ / ไปรษณีย์ / รถรับจ้าง"
                  className="mt-2 w-full rounded-2xl border border-white/80 bg-white/80 px-4 py-3 outline-none"
                />
              ) : null}
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-semibold text-k2-muted">ที่อยู่จัดส่ง</span>
              <textarea
                value={form.deliveryAddress}
                onChange={(event) => setField("deliveryAddress", event.target.value)}
                placeholder="ที่อยู่สำหรับจัดส่งสินค้า (ถ้ารับหน้าร้านเว้นว่างได้)"
                className="min-h-20 w-full rounded-2xl border border-white/80 bg-white/80 px-4 py-3 outline-none"
              />
            </label>
          </div>
        </div>

        <div className="mt-5 rounded-[1.35rem] border border-white/70 bg-white/45 p-4">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="text-lg font-extrabold">ข้อมูลบริษัทและบัญชี</h4>
              <p className="text-sm font-semibold text-k2-muted">ใช้เชื่อมกับใบสั่งงาน ใบเสร็จ และใบกำกับภาษี</p>
            </div>
            <label className="inline-flex w-fit items-center gap-2 rounded-full bg-white/70 px-3 py-2 text-sm font-extrabold text-k2-ink">
              <input
                type="checkbox"
                checked={form.requiresInvoice}
                onChange={(event) => setField("requiresInvoice", event.target.checked)}
                className="h-4 w-4 accent-teal-500"
              />
              ต้องออกใบกำกับ / ใบเสร็จ
            </label>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <TextField label="ชื่อบริษัท / ชื่อนิติบุคคล" value={form.companyName} onChange={(value) => setField("companyName", value)} />
            <TextField label="เลขผู้เสียภาษี" value={form.taxId} onChange={(value) => setField("taxId", value)} />
            <TextField label="สาขา" value={form.branch} onChange={(value) => setField("branch", value)} />
            <TextField label="อีเมลฝ่ายบัญชี" value={form.accountingEmail} onChange={(value) => setField("accountingEmail", value)} />
          </div>
          <label className="mt-4 block space-y-2">
            <span className="text-sm font-semibold text-k2-muted">ที่อยู่สำหรับออกเอกสารบัญชี</span>
            <textarea
              value={form.billingAddress}
              onChange={(event) => setField("billingAddress", event.target.value)}
              className="min-h-24 w-full rounded-2xl border border-white/80 bg-white/80 px-4 py-3 outline-none"
            />
          </label>
        </div>

        <label className="mt-4 block space-y-2">
          <span className="text-sm font-semibold text-k2-muted">รายละเอียดออเดอร์</span>
          <textarea
            value={form.description}
            onChange={(event) => setField("description", event.target.value)}
            className="min-h-28 w-full rounded-2xl border border-white/80 bg-white/80 px-4 py-3 outline-none"
          />
        </label>
        <label className="mt-4 block space-y-2">
          <span className="text-sm font-semibold text-k2-muted">โน้ตภายใน</span>
          <textarea
            value={form.internalNotes}
            onChange={(event) => setField("internalNotes", event.target.value)}
            className="min-h-24 w-full rounded-2xl border border-white/80 bg-white/80 px-4 py-3 outline-none"
          />
        </label>
      </section>

      <aside className="space-y-4">
        <section className="glass rounded-[1.5rem] p-5">
          <h4 className="text-xl font-semibold">สรุปออเดอร์</h4>
          <div className="mt-4 space-y-3">
            <MiniStat label="ยอดคงเหลือ" value={money.format(Math.max(form.price - form.deposit, 0))} />
            <MiniStat label="สถานะชำระเงิน" value={paymentLabel[getPaymentStatus(form.price, form.deposit)]} />
            <MiniStat label="สถานะแรก" value={statusLabel["Quotation"]} />
          </div>
          {formError ? (
            <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700">{formError}</p>
          ) : null}
          <button className="mt-5 w-full rounded-2xl bg-k2-ink px-5 py-4 font-semibold text-white shadow-lg shadow-slate-900/15">
            สร้างงาน
          </button>
        </section>
      </aside>
    </form>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-semibold text-k2-muted">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/80 bg-white/80 px-4 py-3 outline-none"
      />
    </label>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-semibold text-k2-muted">{label}</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full rounded-2xl border border-white/80 bg-white/80 px-4 py-3 outline-none"
      />
    </label>
  );
}

const PaymentsView = memo(function PaymentsView({
  jobs,
  canSeeMoney,
  onSelect
}: {
  jobs: Job[];
  canSeeMoney: boolean;
  onSelect: (id: string) => void;
}) {
  const totals = jobs.reduce(
    (sum, job) => ({
      price: sum.price + job.price,
      deposit: sum.deposit + job.deposit,
      remaining: sum.remaining + job.remainingBalance
    }),
    { price: 0, deposit: 0, remaining: 0 }
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="glass rounded-[1.5rem] p-5">
          <p className="text-sm font-semibold text-k2-muted">ราคารวม</p>
          <p className="mt-2 text-3xl font-semibold">{canSeeMoney ? money.format(totals.price) : "ซ่อนข้อมูล"}</p>
        </div>
        <div className="glass rounded-[1.5rem] p-5">
          <p className="text-sm font-semibold text-k2-muted">มัดจำที่รับแล้ว</p>
          <p className="mt-2 text-3xl font-semibold">{canSeeMoney ? money.format(totals.deposit) : "ซ่อนข้อมูล"}</p>
        </div>
        <div className="glass rounded-[1.5rem] p-5">
          <p className="text-sm font-semibold text-k2-muted">ยอดค้างชำระ</p>
          <p className="mt-2 text-3xl font-semibold">{canSeeMoney ? money.format(totals.remaining) : "ซ่อนข้อมูล"}</p>
        </div>
      </div>
      <section className="glass rounded-[1.5rem] p-5">
        <h3 className="mb-4 text-2xl font-semibold">ติดตามการชำระเงิน</h3>
        <div className="space-y-3">
          {jobs.map((job) => (
            <button key={job.id} onClick={() => onSelect(job.id)} className="grid w-full gap-3 rounded-2xl bg-white/65 p-4 text-left hover:bg-white md:grid-cols-[1fr_auto_auto] md:items-center">
              <div>
                <p className="font-semibold">{job.id} - {job.title}</p>
                <p className="text-sm text-k2-muted">{job.customerName}</p>
              </div>
              <span className="rounded-full bg-k2-mint px-3 py-1 text-xs font-bold text-emerald-800">{paymentLabel[job.paymentStatus]}</span>
              <span className="font-bold">{canSeeMoney ? money.format(job.remainingBalance) : "ซ่อนข้อมูล"}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
});

function FinanceView({ jobs }: { jobs: Job[] }) {
  const thisMonth = todayISO().slice(0, 7);
  const active = jobs.filter((job) => job.status !== "Cancelled");

  // สรุปบนสุด
  const totalSales = active.reduce((s, j) => s + j.price, 0);
  const totalReceived = active.reduce((s, j) => s + j.deposit, 0);
  const totalOutstanding = active.reduce((s, j) => s + Math.max(j.remainingBalance, 0), 0);
  const revenueThisMonth = active.filter((j) => j.orderDate.startsWith(thisMonth)).reduce((s, j) => s + j.price, 0);

  // ยอดค้างรับ แยกตามลูกค้า
  const receivables = useMemo(() => {
    const map = new Map<string, { name: string; amount: number; count: number }>();
    active.filter((j) => j.remainingBalance > 0).forEach((j) => {
      const cur = map.get(j.customerName) ?? { name: j.customerName, amount: 0, count: 0 };
      cur.amount += j.remainingBalance; cur.count += 1;
      map.set(j.customerName, cur);
    });
    return [...map.values()].sort((a, b) => b.amount - a.amount);
  }, [active]);

  // รายได้ย้อนหลัง 6 เดือน
  const months = useMemo(() => {
    const arr: { key: string; label: string; value: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("th-TH", { month: "short" });
      const value = active.filter((j) => j.orderDate.startsWith(key)).reduce((s, j) => s + j.price, 0);
      arr.push({ key, label, value });
    }
    return arr;
  }, [active]);
  const maxMonth = Math.max(1, ...months.map((m) => m.value));

  return (
    <div className="space-y-4">
      {/* การ์ดสรุป */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="glass rounded-[1.4rem] p-5"><p className="text-sm font-bold text-k2-muted">ยอดขายรวม</p><p className="mt-1 text-2xl font-extrabold text-k2-ink">{money.format(totalSales)}</p></div>
        <div className="glass rounded-[1.4rem] p-5"><p className="text-sm font-bold text-k2-muted">รับเงินแล้ว</p><p className="mt-1 text-2xl font-extrabold text-teal-600">{money.format(totalReceived)}</p></div>
        <div className="glass rounded-[1.4rem] p-5"><p className="text-sm font-bold text-k2-muted">ยอดค้างรับ</p><p className="mt-1 text-2xl font-extrabold text-rose-600">{money.format(totalOutstanding)}</p></div>
        <div className="glass rounded-[1.4rem] p-5"><p className="text-sm font-bold text-k2-muted">ยอดขายเดือนนี้</p><p className="mt-1 text-2xl font-extrabold text-k2-ink">{money.format(revenueThisMonth)}</p></div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* รายได้ 6 เดือน */}
        <section className="glass rounded-[1.5rem] p-5">
          <h3 className="text-xl font-semibold">รายได้ย้อนหลัง 6 เดือน</h3>
          <div className="mt-5 flex items-end justify-between gap-2" style={{ height: 180 }}>
            {months.map((m) => (
              <div key={m.key} className="flex flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[10px] font-bold text-k2-muted">{m.value > 0 ? Math.round(m.value / 1000) + "k" : ""}</span>
                <div className="w-full rounded-t-lg bg-k2-ink" style={{ height: `${(m.value / maxMonth) * 140}px`, minHeight: m.value > 0 ? 4 : 0 }} />
                <span className="text-xs font-bold text-k2-muted">{m.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ยอดค้างรับ แยกลูกค้า */}
        <section className="glass rounded-[1.5rem] p-5">
          <h3 className="text-xl font-semibold">ยอดค้างรับ แยกตามลูกค้า</h3>
          <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
            {receivables.length === 0 ? (
              <p className="rounded-2xl bg-white/60 px-4 py-6 text-center text-sm font-semibold text-k2-muted">ไม่มียอดค้างรับ 🎉</p>
            ) : receivables.map((r) => (
              <div key={r.name} className="flex items-center justify-between rounded-2xl bg-white/65 px-4 py-3">
                <div className="min-w-0"><p className="truncate font-semibold">{r.name}</p><p className="text-xs text-k2-muted">{r.count} งานค้าง</p></div>
                <span className="shrink-0 font-extrabold text-rose-600">{money.format(r.amount)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ยอดขายรายพนักงาน */}
      <SalesByStaff jobs={active} thisMonth={thisMonth} />
    </div>
  );
}

function SalesByStaff({ jobs, thisMonth }: { jobs: Job[]; thisMonth: string }) {
  const rows = useMemo(() => {
    const map = new Map<string, { name: string; count: number; total: number; monthTotal: number }>();
    jobs.forEach((j) => {
      const name = j.createdBy || "ไม่ระบุ";
      const cur = map.get(name) ?? { name, count: 0, total: 0, monthTotal: 0 };
      cur.count += 1; cur.total += j.price;
      if (j.orderDate.startsWith(thisMonth)) cur.monthTotal += j.price;
      map.set(name, cur);
    });
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [jobs, thisMonth]);
  const maxTotal = Math.max(1, ...rows.map((r) => r.total));

  return (
    <section className="glass rounded-[1.5rem] p-5">
      <h3 className="text-xl font-semibold">ยอดขายรายพนักงาน</h3>
      <p className="text-sm font-semibold text-k2-muted">นับจากคนที่สร้างงาน · เรียงยอดสูง→ต่ำ</p>
      <div className="mt-5 space-y-4">
        {rows.length === 0 ? (
          <p className="rounded-2xl bg-white/60 px-4 py-6 text-center text-sm font-semibold text-k2-muted">ยังไม่มีข้อมูล</p>
        ) : rows.map((r, i) => (
          <div key={r.name}>
            <div className="mb-1.5 flex items-center justify-between text-sm font-semibold">
              <span>{i === 0 ? "🥇 " : i === 1 ? "🥈 " : i === 2 ? "🥉 " : ""}{r.name}</span>
              <span>{money.format(r.total)} <span className="text-xs font-normal text-k2-muted">({r.count} งาน · เดือนนี้ {money.format(r.monthTotal)})</span></span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-white/80">
              <div className="h-full rounded-full bg-k2-ink" style={{ width: `${(r.total / maxTotal) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

const ReportsView = memo(function ReportsView({ jobs, canSeeMoney }: { jobs: Job[]; canSeeMoney: boolean }) {
  const byType = jobTypes.map((type) => ({
    type,
    count: jobs.filter((job) => job.type === type).length,
    value: jobs.filter((job) => job.type === type).reduce((sum, job) => sum + job.price, 0)
  }));
  const maxCount = Math.max(1, ...byType.map((item) => item.count));

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_0.75fr]">
      <section className="glass rounded-[1.5rem] p-5">
        <h3 className="text-2xl font-semibold">งานแยกตามประเภท</h3>
        <div className="mt-5 space-y-4">
          {byType.map((item) => (
            <div key={item.type}>
              <div className="mb-2 flex justify-between text-sm font-semibold">
                <span>{jobTypeLabel[item.type]}</span>
                <span>{item.count} งาน {canSeeMoney ? `- ${money.format(item.value)}` : ""}</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-white/80">
                <div className="h-full rounded-full bg-k2-ink" style={{ width: `${(item.count / maxCount) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="glass rounded-[1.5rem] p-5">
        <h3 className="text-2xl font-semibold">ความเสี่ยงของงาน</h3>
        <div className="mt-5 space-y-3">
          <MiniStat label="งานเปิดที่เลยกำหนด" value={jobs.filter((job) => !["Completed", "Cancelled"].includes(job.status) && daysFromToday(job.dueDate) < 0).length} />
          <MiniStat label="รอลูกค้าอนุมัติ" value={jobs.filter((job) => job.status === "Waiting for Customer Approval").length} />
          <MiniStat label="ยังไม่ชำระ" value={jobs.filter((job) => job.paymentStatus === "unpaid").length} />
          <MiniStat label="งานเสร็จสิ้น" value={jobs.filter((job) => job.status === "Completed").length} />
        </div>
      </section>
    </div>
  );
});

function SettingsView({
  currentUserId,
  currentRole,
  teamMembers,
  companyProfile,
  onUpdateCompany,
  onAddMember,
  onUpdateMember,
  onUpdateMemberAvatar,
  onRemoveMember,
  onResetMemberPassword,
  permissionMatrix,
  onUpdateRolePermission,
  onResetRolePermissions
}: {
  currentUserId: string;
  currentRole: Role;
  teamMembers: TeamMember[];
  companyProfile: CompanyProfile;
  onUpdateCompany: (profile: CompanyProfile) => void;
  onAddMember: (member: NewTeamMemberInput) => void;
  onUpdateMember: (memberId: string, updates: Pick<TeamMember, "name" | "role" | "branch"> & { roles?: Role[] }) => void;
  onUpdateMemberAvatar: (memberId: string, avatarUrl: string) => void;
  onRemoveMember: (memberId: string) => void;
  onResetMemberPassword: (memberId: string) => Promise<{ ok: boolean; password?: string; msg: string }>;
  permissionMatrix: Record<Role, PermissionKey[]>;
  onUpdateRolePermission: (role: Role, permission: PermissionKey, enabled: boolean) => void;
  onResetRolePermissions: () => void;
}) {
  const currentPermissions = permissionMatrix[currentRole] ?? [];
  const canManageTeam = currentPermissions.includes("manage_users");
  const canManagePermissions = currentPermissions.includes("manage_permissions");
  const canManageCompany = currentPermissions.includes("manage_company_settings");
  const isOwner = currentRole === "Owner";
  const [pwBusyId, setPwBusyId] = useState<string | null>(null);
  const [pwResult, setPwResult] = useState<{ memberId: string; ok: boolean; password?: string; msg: string } | null>(null);
  async function handleResetPassword(member: TeamMember) {
    if (!confirm(`รีเซ็ตรหัสผ่านของ ${member.name}? รหัสเดิมจะใช้ไม่ได้ทันที`)) return;
    setPwBusyId(member.id);
    setPwResult(null);
    const result = await onResetMemberPassword(member.id);
    setPwBusyId(null);
    setPwResult({ memberId: member.id, ...result });
  }
  const [newMember, setNewMember] = useState({ name: "", username: "", password: "", role: "Designer" as Role, branch: "" });
  const newMemberBranchOptions = BRANCH_LIST;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingMember, setEditingMember] = useState({ name: "", role: "Designer" as Role, roles: [] as Role[], branch: "" });
  const memberBranchOptions = BRANCH_LIST;
  const [companyDraft, setCompanyDraft] = useState(companyProfile);
  const [facebookPageName, setFacebookPageName] = useState("");
  const [avatarError, setAvatarError] = useState("");

  useEffect(() => {
    setCompanyDraft(companyProfile);
  }, [companyProfile]);

  function startEditing(member: TeamMember) {
    setEditingId(member.id);
    setEditingMember({ name: member.name, role: member.role, roles: member.roles ?? [], branch: member.branch ?? "" });
  }

  function submitNewMember() {
    const username = normalizeUsername(newMember.username);
    if (!newMember.name.trim() || !username || !canManageTeam) return;
    onAddMember({ name: newMember.name.trim(), username, password: newMember.password, role: newMember.role, branch: newMember.role === "Owner" ? "" : newMember.branch });
    setNewMember({ name: "", username: "", password: "", role: "Designer", branch: "" });
  }

  function submitEdit(memberId: string) {
    if (!editingMember.name.trim() || (!canManageTeam && memberId !== currentUserId)) return;
    onUpdateMember(memberId, { name: editingMember.name.trim(), role: editingMember.role, roles: editingMember.roles, branch: editingMember.branch });
    setEditingId(null);
  }

  function addFacebookPage() {
    const nextPages = normalizeFacebookPages([...companyDraft.facebookPages, facebookPageName]);
    setCompanyDraft((current) => ({ ...current, facebookPages: nextPages }));
    setFacebookPageName("");
  }

  function removeFacebookPage(pageName: string) {
    setCompanyDraft((current) => ({ ...current, facebookPages: current.facebookPages.filter((page) => page !== pageName) }));
  }

  async function handleAvatarUpload(member: TeamMember, file: File | null) {
    if (!file || (!canManageTeam && member.id !== currentUserId)) return;
    setAvatarError("");
    if (!file.type.startsWith("image/")) {
      setAvatarError("กรุณาเลือกไฟล์รูปภาพเท่านั้น");
      return;
    }
    if (file.size > 1_200_000) {
      setAvatarError("รูปโปรไฟล์ต้องมีขนาดไม่เกิน 1.2 MB");
      return;
    }
    const avatarUrl = await readImageAsDataUrl(file);
    onUpdateMemberAvatar(member.id, avatarUrl);
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
      <section className="glass rounded-[1.5rem] p-5 xl:col-span-2">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-k2-muted">Accounting profile</p>
            <h3 className="text-2xl font-semibold">ข้อมูลบริษัทเราและเอกสารบัญชี</h3>
            <p className="mt-2 text-sm font-semibold text-k2-muted">ใช้เป็นข้อมูลผู้ออกใบสั่งงาน ใบเสร็จ และใบกำกับภาษี</p>
          </div>
          <button
            type="button"
            onClick={() => onUpdateCompany(companyDraft)}
            disabled={!canManageCompany}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-k2-ink px-4 py-3 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            บันทึกข้อมูลบริษัท
          </button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-k2-muted">ชื่อแบรนด์</span>
            <input value={companyDraft.name} onChange={(event) => setCompanyDraft((current) => ({ ...current, name: event.target.value }))} placeholder="ชื่อแบรนด์" className="w-full rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-semibold outline-none" />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-k2-muted">ชื่อบริษัทตามกฎหมาย</span>
            <input value={companyDraft.legalName} onChange={(event) => setCompanyDraft((current) => ({ ...current, legalName: event.target.value }))} placeholder="ชื่อบริษัทตามกฎหมาย" className="w-full rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-semibold outline-none" />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-k2-muted">เลขผู้เสียภาษี (บริษัทเรา)</span>
            <input value={companyDraft.taxId} onChange={(event) => setCompanyDraft((current) => ({ ...current, taxId: event.target.value }))} placeholder="เลขผู้เสียภาษีบริษัทเรา" className="w-full rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-semibold outline-none" />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-k2-muted">สาขา</span>
            <input value={companyDraft.branch} onChange={(event) => setCompanyDraft((current) => ({ ...current, branch: event.target.value }))} placeholder="สาขา" className="w-full rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-semibold outline-none" />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-k2-muted">เบอร์บริษัท</span>
            <input value={companyDraft.phone} onChange={(event) => setCompanyDraft((current) => ({ ...current, phone: event.target.value }))} placeholder="เบอร์บริษัท" className="w-full rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-semibold outline-none" />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-k2-muted">อีเมลบริษัท</span>
            <input value={companyDraft.email} onChange={(event) => setCompanyDraft((current) => ({ ...current, email: event.target.value }))} placeholder="อีเมลบริษัท" className="w-full rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-semibold outline-none" />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-k2-muted">Prefix ใบสั่งงาน</span>
            <input value={companyDraft.quotePrefix} onChange={(event) => setCompanyDraft((current) => ({ ...current, quotePrefix: event.target.value }))} placeholder="Prefix ใบสั่งงาน เช่น WO" className="w-full rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-semibold outline-none" />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-k2-muted">ธนาคาร</span>
            <input value={companyDraft.bankName} onChange={(event) => setCompanyDraft((current) => ({ ...current, bankName: event.target.value }))} placeholder="ธนาคาร" className="w-full rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-semibold outline-none" />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-k2-muted">เลขบัญชี</span>
            <input value={companyDraft.bankAccount} onChange={(event) => setCompanyDraft((current) => ({ ...current, bankAccount: event.target.value }))} placeholder="เลขบัญชี" className="w-full rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-semibold outline-none" />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-k2-muted">ชื่อบัญชี</span>
            <input value={companyDraft.bankAccountName} onChange={(event) => setCompanyDraft((current) => ({ ...current, bankAccountName: event.target.value }))} placeholder="ชื่อบัญชี" className="w-full rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-semibold outline-none" />
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-semibold text-k2-muted">ที่อยู่บริษัท</span>
            <textarea value={companyDraft.address} onChange={(event) => setCompanyDraft((current) => ({ ...current, address: event.target.value }))} placeholder="ที่อยู่บริษัท" className="min-h-24 w-full rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-semibold outline-none" />
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-semibold text-k2-muted">เงื่อนไขใบสั่งงาน</span>
            <textarea value={companyDraft.quoteTerms} onChange={(event) => setCompanyDraft((current) => ({ ...current, quoteTerms: event.target.value }))} placeholder="เงื่อนไขใบสั่งงาน" className="min-h-24 w-full rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-semibold outline-none" />
          </label>
        </div>
      </section>
      <section className="glass rounded-[1.5rem] p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-2xl font-semibold">ทีมงานและบทบาท</h3>
            <p className="mt-2 text-sm font-semibold text-k2-muted">เพิ่มสมาชิก แก้บทบาท และจัดสิทธิ์สำหรับแต่ละแผนก</p>
          </div>
          <span className={`w-fit rounded-full px-3 py-1 text-xs font-extrabold ${canManageTeam ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-700"}`}>
            {canManageTeam ? "แก้ไขทีมได้" : "แก้โปรไฟล์ตัวเองได้"}
          </span>
        </div>

        <div className="mt-5 grid gap-3 rounded-[1.35rem] border border-white/70 bg-white/45 p-3 md:grid-cols-2 xl:grid-cols-[1fr_150px_150px_140px_140px_auto]">
          <input
            value={newMember.name}
            onChange={(event) => setNewMember((current) => ({ ...current, name: event.target.value }))}
            placeholder="ชื่อสมาชิก เช่น New Designer"
            disabled={!canManageTeam}
            className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-semibold outline-none disabled:opacity-60"
          />
          <input
            value={newMember.username}
            onChange={(event) => setNewMember((current) => ({ ...current, username: normalizeUsername(event.target.value) }))}
            placeholder="username เช่น beam"
            disabled={!canManageTeam}
            autoCapitalize="none"
            autoComplete="off"
            className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-semibold outline-none disabled:opacity-60"
          />
          <input
            value={newMember.password}
            onChange={(event) => setNewMember((current) => ({ ...current, password: event.target.value }))}
            placeholder="รหัสผ่านเริ่มต้น"
            disabled={!canManageTeam}
            type="password"
            autoComplete="new-password"
            className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-semibold outline-none disabled:opacity-60"
          />
          <select
            value={newMember.role}
            onChange={(event) => setNewMember((current) => ({ ...current, role: event.target.value as Role }))}
            disabled={!canManageTeam}
            className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-semibold outline-none disabled:opacity-60"
          >
            {roles.map((role) => (
              <option key={role} value={role}>{roleLabel[role]}</option>
            ))}
          </select>
          <select
            value={newMember.branch}
            onChange={(event) => setNewMember((current) => ({ ...current, branch: event.target.value }))}
            disabled={!canManageTeam || newMember.role === "Owner"}
            className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-semibold outline-none disabled:opacity-60"
          >
            <option value="">— สาขา —</option>
            {newMemberBranchOptions.map((branch) => (
              <option key={branch} value={branch}>{branch}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={submitNewMember}
            disabled={!canManageTeam || !newMember.name.trim() || !newMember.username.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-k2-ink px-4 py-3 text-sm font-extrabold text-white shadow-lg shadow-slate-900/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <UserPlus className="h-4 w-4" />
            เพิ่ม
          </button>
        </div>
        <p className="mt-2 text-xs font-bold text-k2-muted">
          พนักงานใช้ Username เข้าระบบได้เลย ระบบจะสร้างอีเมลภายในหลังบ้านเป็น username@k2smart.local
        </p>
        {avatarError ? <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700">{avatarError}</p> : null}

        <div className="mt-4 space-y-3">
          {teamMembers.map((member) => {
            const isEditing = editingId === member.id;
            // เจ้าของแก้ได้เฉพาะตัวเอง; คนอื่น (HR/แอดมิน) แก้ได้ทุกคน ยกเว้นแถวเจ้าของ
            const canEditThisMember = member.id === currentUserId || (canManageTeam && member.role !== "Owner");
            const canEditThisRole = canManageTeam && member.role !== "Owner";
            return (
              <div key={member.id} className="rounded-[1.35rem] border border-white/70 bg-white/60 p-3 shadow-sm">
                <div className="grid gap-3 md:grid-cols-[auto_1fr_auto] md:items-center">
                  <div className="flex items-center gap-3">
                    <MemberAvatar member={member} />
                    <div className="flex flex-col gap-1.5">
                      <label className={`inline-flex cursor-pointer items-center justify-center rounded-full bg-white/80 px-3 py-1.5 text-xs font-extrabold text-k2-muted shadow-sm ${!canEditThisMember ? "pointer-events-none opacity-45" : ""}`}>
                        เปลี่ยนรูป
                        <input
                          type="file"
                          accept="image/*"
                          disabled={!canEditThisMember}
                          onChange={(event) => {
                            void handleAvatarUpload(member, event.target.files?.[0] ?? null);
                            event.target.value = "";
                          }}
                          className="sr-only"
                        />
                      </label>
                      {member.avatarUrl ? (
                        <button
                          type="button"
                          onClick={() => onUpdateMemberAvatar(member.id, "")}
                          disabled={!canEditThisMember}
                          className="rounded-full bg-rose-50 px-3 py-1.5 text-xs font-extrabold text-rose-600 disabled:opacity-45"
                        >
                          ลบรูป
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {isEditing ? (
                    <div className="grid gap-2 md:grid-cols-[1fr_210px]">
                      <input
                        value={editingMember.name}
                        onChange={(event) => setEditingMember((current) => ({ ...current, name: event.target.value }))}
                        className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3 text-sm font-semibold outline-none"
                      />
                      <select
                        value={editingMember.role}
                        onChange={(event) => setEditingMember((current) => ({ ...current, role: event.target.value as Role }))}
                        disabled={!canEditThisRole}
                        className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3 text-sm font-semibold outline-none disabled:opacity-60"
                      >
                        {roles.map((role) => (
                          <option key={role} value={role}>{roleLabel[role]}</option>
                        ))}
                      </select>
                      {canEditThisRole && editingMember.role !== "Owner" ? (
                        <div className="rounded-2xl border border-white/80 bg-white/70 px-4 py-3 md:col-span-2">
                          <p className="mb-2 text-xs font-bold text-k2-muted">บทบาทเสริม (1 คนหลายตำแหน่ง) — สิทธิ์จะรวมกับบทบาทหลัก</p>
                          <div className="flex flex-wrap gap-2">
                            {roles.filter((role) => role !== "Owner" && role !== editingMember.role).map((role) => {
                              const active = editingMember.roles.includes(role);
                              return (
                                <button
                                  key={role}
                                  type="button"
                                  onClick={() => setEditingMember((current) => ({ ...current, roles: active ? current.roles.filter((value) => value !== role) : [...current.roles, role] }))}
                                  className={`rounded-full px-3 py-1.5 text-xs font-bold ${active ? "bg-k2-ink text-white" : "bg-white/80 text-k2-muted"}`}
                                >
                                  {roleLabel[role]}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                      {editingMember.role !== "Owner" ? (
                        <select
                          value={editingMember.branch}
                          onChange={(event) => setEditingMember((current) => ({ ...current, branch: event.target.value }))}
                          disabled={!canManageTeam}
                          className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3 text-sm font-semibold outline-none disabled:opacity-60 md:col-span-2"
                        >
                          <option value="">— เลือกสาขาประจำ —</option>
                          {memberBranchOptions.map((branch) => (
                            <option key={branch} value={branch}>{branch}</option>
                          ))}
                        </select>
                      ) : null}
                    </div>
                  ) : (
                    <div>
                      <p className="font-extrabold">{member.name}</p>
                      {member.username ? <p className="mt-1 text-xs font-extrabold text-teal-600">@{member.username}</p> : null}
                      <p className="mt-1 text-sm font-semibold text-k2-muted">
                        {roleLabel[member.role]}
                        {member.roles?.length ? ` + ${member.roles.map((role) => roleLabel[role]).join(", ")}` : ""}
                        {member.role !== "Owner" && member.branch ? ` · สาขา${member.branch}` : ""}
                      </p>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <button
                        type="button"
                        onClick={() => submitEdit(member.id)}
                        className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-100 text-emerald-700"
                        title="บันทึก"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEditing(member)}
                        disabled={!canEditThisMember}
                        className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-k2-muted disabled:opacity-45"
                        title="แก้ไข"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    {isOwner ? (
                      <button
                        type="button"
                        onClick={() => handleResetPassword(member)}
                        disabled={pwBusyId === member.id}
                        className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-50 text-amber-600 disabled:opacity-45"
                        title="รีเซ็ตรหัสผ่าน"
                      >
                        <KeyRound className="h-4 w-4" />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onRemoveMember(member.id)}
                      disabled={!canManageTeam || member.role === "Owner"}
                      className="grid h-10 w-10 place-items-center rounded-2xl bg-rose-50 text-rose-600 disabled:opacity-35"
                      title="ลบสมาชิก"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {pwResult && pwResult.memberId === member.id ? (
                  pwResult.ok ? (
                    <div className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
                      ✅ รหัสผ่านใหม่ของ {member.name}: <span className="text-lg font-black tracking-wider">{pwResult.password}</span>
                      <span className="ml-2 font-semibold text-amber-700">(ก็อปแจก แล้วให้เปลี่ยนตอนเข้าครั้งแรก)</span>
                    </div>
                  ) : (
                    <div className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">❌ {pwResult.msg}</div>
                  )
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <section className="glass rounded-[1.5rem] p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-2xl font-semibold">บทบาทและสิทธิ์</h3>
            <p className="mt-2 text-sm font-semibold text-k2-muted">ติ๊กสิทธิ์ให้แต่ละตำแหน่งทำงานได้ต่างกัน เจ้าของถูกล็อกให้มีสิทธิ์ครบเสมอ</p>
          </div>
          <button
            type="button"
            onClick={onResetRolePermissions}
            disabled={!canManagePermissions}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/75 px-4 py-3 text-sm font-extrabold text-k2-muted shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ShieldCheck className="h-4 w-4" />
            รีเซ็ตค่าเริ่มต้น
          </button>
        </div>
        <div className="mt-5 space-y-4">
          {roles.map((role) => {
            const isLockedOwner = role === "Owner";
            const selectedPermissions = permissionMatrix[role] ?? [];
            return (
              <div key={role} className={`rounded-[1.35rem] border border-white/70 p-4 ${role === currentRole ? "bg-k2-lilac/70" : "bg-white/60"}`}>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-extrabold">{roleLabel[role]}</p>
                    <p className="text-xs font-bold text-k2-muted">{selectedPermissions.length} / {allPermissionKeys.length} permissions</p>
                  </div>
                  {isLockedOwner ? (
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-extrabold text-k2-muted">ล็อก</span>
                  ) : null}
                </div>
                <div className="grid gap-4">
                  {permissionGroups.map((group) => (
                    <div key={`${role}-${group.title}`}>
                      <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.14em] text-k2-muted">{group.title}</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {group.permissions.map((permission) => {
                          const checked = isLockedOwner || selectedPermissions.includes(permission);
                          return (
                            <label key={`${role}-${permission}`} className="flex items-center gap-3 rounded-2xl bg-white/70 px-3 py-2.5 text-sm font-extrabold text-k2-ink">
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={!canManagePermissions || isLockedOwner}
                                onChange={(event) => onUpdateRolePermission(role, permission, event.target.checked)}
                                className="h-4 w-4 accent-[#EC5CA8] disabled:opacity-40"
                              />
                              <span>{permissionLabel[permission]}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <section className="glass rounded-[1.5rem] p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold text-k2-muted">Customer channels</p>
            <h3 className="text-2xl font-semibold">ตั้งค่าเพจ Facebook</h3>
            <p className="mt-2 text-sm font-semibold text-k2-muted">เพิ่มชื่อเพจที่ใช้รับงาน ก่อนเลือกเพจตอนสร้างใบสั่งงาน</p>
          </div>
          <span className="w-fit rounded-full bg-white/70 px-3 py-1 text-xs font-extrabold text-k2-muted">
            {companyDraft.facebookPages.length} เพจ
          </span>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
          <input
            value={facebookPageName}
            onChange={(event) => setFacebookPageName(event.target.value)}
            placeholder="ชื่อเพจ เช่น K2sign media"
            disabled={!canManageCompany}
            className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-semibold outline-none disabled:opacity-60"
          />
          <button
            type="button"
            onClick={addFacebookPage}
            disabled={!canManageCompany || !facebookPageName.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-k2-ink px-4 py-3 text-sm font-extrabold text-white shadow-lg shadow-slate-900/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            เพิ่มเพจ
          </button>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {companyDraft.facebookPages.length ? (
            companyDraft.facebookPages.map((pageName) => (
              <div key={pageName} className="flex items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/65 px-4 py-3">
                <span className="truncate font-extrabold">{pageName}</span>
                <button
                  type="button"
                  onClick={() => removeFacebookPage(pageName)}
                  disabled={!canManageCompany}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-600 disabled:opacity-40"
                  title="ลบเพจ"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          ) : (
            <p className="rounded-2xl bg-white/60 px-4 py-3 text-sm font-bold text-k2-muted sm:col-span-2">
              ยังไม่มีรายชื่อเพจ Facebook
            </p>
          )}
        </div>
        <p className="mt-3 text-xs font-bold text-k2-muted">
          หลังเพิ่มหรือแก้ไขเพจ ให้กด “บันทึกข้อมูลบริษัท” ด้านบนเพื่อบันทึกการตั้งค่า
        </p>
      </section>
      <section className="glass rounded-[1.5rem] p-5">
        <h3 className="text-2xl font-semibold">ตั้งค่าลำดับคิว</h3>
        <div className="mt-5 grid gap-2">
          {statuses.map((status, index) => (
            <div key={status} className="flex items-center gap-3 rounded-2xl bg-white/65 p-3">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-k2-ink text-xs font-bold text-white">{index + 1}</span>
              <span className="font-semibold">{statusLabel[status]}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

const CalendarView = memo(function CalendarView({ jobs, customers, onSelect }: { jobs: Job[]; customers: Customer[]; onSelect: (id: string) => void }) {
  const [modalJob, setModalJob] = useState<Job | null>(null);
  const modalCustomer = modalJob ? customers.find((c) => c.id === modalJob.customerId) : undefined;

  const grouped = useMemo(
    () =>
      jobs
        .slice()
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
        .reduce<Record<string, Job[]>>((acc, job) => {
          acc[job.dueDate] = [...(acc[job.dueDate] ?? []), job];
          return acc;
        }, {}),
    [jobs]
  );

  // พื้นหลังคนละสีตามวันในสัปดาห์ (จ.-อา.)
  const dayBg = ["bg-rose-50/70", "bg-amber-50/70", "bg-emerald-50/70", "bg-sky-50/70", "bg-violet-50/70", "bg-teal-50/70", "bg-orange-50/70"];

  function deadlineStyle(dueDate: string) {
    const d = daysFromToday(dueDate);
    if (d <= 0) return { dot: "bg-rose-500", text: "text-rose-600", label: d < 0 ? `เลยกำหนด ${Math.abs(d)} วัน` : "ครบกำหนดวันนี้", blink: true };
    if (d <= 1) return { dot: "bg-rose-500", text: "text-rose-600", label: `เหลือ ${d} วัน`, blink: false };
    if (d <= 5) return { dot: "bg-amber-400", text: "text-amber-600", label: `เหลือ ${d} วัน`, blink: false };
    return { dot: "bg-emerald-500", text: "text-emerald-600", label: `เหลือ ${d} วัน`, blink: false };
  }

  function formatDay(date: string) {
    try {
      return new Date(`${date}T00:00:00`).toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long" });
    } catch {
      return date;
    }
  }

  return (
    <>
      {/* คำอธิบายสี */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-white/60 px-4 py-2 text-xs font-bold text-k2-muted">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> เหลือ &gt;5 วัน</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> เหลือ 2-5 วัน</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> เหลือ &lt;2 วัน</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500 ring-2 ring-rose-300" /> ใกล้ส่ง (กระพริบ)</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {Object.keys(grouped).length === 0 ? (
          <p className="rounded-2xl bg-white/60 px-4 py-8 text-center text-sm font-semibold text-k2-muted">ยังไม่มีงานในปฏิทิน</p>
        ) : null}
        {Object.entries(grouped).map(([date, dateJobs]) => {
          const weekday = (new Date(`${date}T00:00:00`).getDay() + 6) % 7; // จันทร์=0
          return (
            <section key={date} className={`rounded-[1.5rem] border border-white/70 ${dayBg[weekday]} p-5 shadow-sm`}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold leading-tight">{formatDay(date)}</h3>
                <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-bold">{dateJobs.length} งาน</span>
              </div>
              <div className="space-y-3">
                {dateJobs.map((job) => {
                  const dl = deadlineStyle(job.dueDate);
                  const team = [job.assignedDesigner, job.assignedProduction].filter((n) => n && n !== "Unassigned");
                  return (
                    <button
                      key={job.id}
                      onClick={() => setModalJob(job)}
                      className={`w-full rounded-2xl bg-white/85 p-4 text-left shadow-sm transition hover:bg-white ${dl.blink ? "animate-pulse ring-2 ring-rose-400" : ""}`}
                    >
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 font-bold">
                          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dl.dot}`} />
                          {job.isExpress ? <Zap className="h-3.5 w-3.5 text-rose-500" /> : null}
                          {job.id}
                        </span>
                        <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-bold ${priorityClass[job.priority]}`}>{priorityLabel[job.priority]}</span>
                      </div>
                      <p className="font-semibold leading-5">{job.title}</p>
                      <p className="mt-0.5 text-sm text-k2-muted">🧑 {job.customerName}</p>
                      <p className="text-sm text-k2-muted">📦 {jobTypeLabel[job.type]}</p>
                      {team.length ? (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {team.map((n) => (
                            <span key={n} className="rounded-full bg-k2-mint/70 px-2 py-0.5 text-[11px] font-bold text-k2-ink">👤 {n}</span>
                          ))}
                        </div>
                      ) : null}
                      <p className={`mt-2 text-xs font-extrabold ${dl.text}`}>⏰ {dl.label} · {statusLabel[job.status]}</p>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* Modal รายละเอียดงาน */}
      {modalJob ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" onClick={() => setModalJob(null)}>
          <div className="glass-solid max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-[1.6rem] p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-k2-muted">{modalJob.id}{modalJob.isExpress ? " · ⚡ ด่วน" : ""}</p>
                <h3 className="text-xl font-extrabold text-k2-ink">{modalJob.title}</h3>
              </div>
              <button type="button" onClick={() => setModalJob(null)} className="shrink-0 rounded-full bg-white/70 px-3 py-1 text-sm font-bold text-k2-muted">✕</button>
            </div>

            <div className="space-y-2 text-sm">
              <p><span className="font-bold text-k2-muted">สถานะ:</span> {statusLabel[modalJob.status]}</p>
              <p><span className="font-bold text-k2-muted">สินค้า:</span> 📦 {jobTypeLabel[modalJob.type]} · จำนวน {modalJob.quantity}</p>
              <p><span className="font-bold text-k2-muted">ลูกค้า:</span> 🧑 {modalJob.customerName}</p>
              {modalJob.phone ? <p><span className="font-bold text-k2-muted">เบอร์โทร:</span> {modalJob.phone}</p> : null}
              {modalJob.billingAddress ? <p><span className="font-bold text-k2-muted">ที่อยู่:</span> {modalJob.billingAddress}</p> : null}
              <p><span className="font-bold text-k2-muted">ผู้รับผิดชอบ:</span> {[modalJob.assignedDesigner, modalJob.assignedProduction].filter((n) => n && n !== "Unassigned").join(", ") || "ยังไม่มอบหมาย"}</p>
              <p><span className="font-bold text-k2-muted">กำหนดส่ง:</span> {modalJob.dueDate} ({deadlineStyle(modalJob.dueDate).label})</p>
              {modalJob.description ? <p className="whitespace-pre-wrap"><span className="font-bold text-k2-muted">รายละเอียด:</span> {modalJob.description}</p> : null}
              {modalJob.files.length ? (
                <p><span className="font-bold text-k2-muted">ไฟล์แนบ:</span> {modalJob.files.map((f) => f.name).join(", ")}</p>
              ) : null}
            </div>

            {/* ปุ่มติดต่อด่วน */}
            <div className="mt-4 flex flex-wrap gap-2">
              {modalJob.phone ? (
                <a href={`tel:${modalJob.phone}`} className="inline-flex items-center gap-1.5 rounded-2xl bg-teal-500 px-4 py-2.5 text-sm font-extrabold text-white">
                  <Phone className="h-4 w-4" /> โทร
                </a>
              ) : null}
              {modalJob.lineId ? (
                <a href={`https://line.me/ti/p/~${encodeURIComponent(modalJob.lineId)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-2xl bg-green-500 px-4 py-2.5 text-sm font-extrabold text-white">
                  💬 LINE
                </a>
              ) : null}
              {modalCustomer?.sourceChannel === "Facebook" && modalCustomer?.sourcePage ? (
                <a href={`https://www.facebook.com/${encodeURIComponent(modalCustomer.sourcePage)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-extrabold text-white">
                  👍 Facebook
                </a>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => { const id = modalJob.id; setModalJob(null); onSelect(id); }}
              className="mt-4 w-full rounded-2xl bg-k2-ink px-4 py-3 font-extrabold text-white"
            >
              เปิดรายละเอียดเต็ม →
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
});

function loyaltyBadge(orders: number, ltv: number): { label: string; emoji: string; cls: string } {
  if (orders >= 10 || ltv >= 100000) return { label: "VIP", emoji: "🥇", cls: "bg-amber-100 text-amber-700" };
  if (orders >= 3) return { label: "ลูกค้าประจำ", emoji: "🥈", cls: "bg-sky-100 text-sky-700" };
  return { label: "ลูกค้าใหม่", emoji: "🥉", cls: "bg-orange-100 text-orange-700" };
}

function CustomersView({
  customers,
  jobs,
  canDelete,
  onAddCustomer,
  onUpdateCustomer,
  onRemoveCustomer,
  onAssignCode
}: {
  customers: Customer[];
  jobs: Job[];
  canDelete: boolean;
  onAddCustomer: (customer: Omit<Customer, "id" | "totalOrders" | "lifetimeValue" | "lastOrderDate">) => void;
  onUpdateCustomer: (customerId: string, updates: Pick<Customer, "name" | "phone" | "lineId" | "email" | "companyName" | "taxId" | "branch" | "billingAddress" | "accountingEmail" | "requiresInvoice" | "notes" | "sourceChannel" | "sourcePage" | "lineFriend" | "loyaltyPoints">) => void;
  onRemoveCustomer: (customerId: string) => void;
  onAssignCode: (customerId: string, page: string, admin: string) => void;
}) {
  const [customerQuery, setCustomerQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", lineId: "", email: "", companyName: "", taxId: "", branch: "สำนักงานใหญ่", billingAddress: "", accountingEmail: "", requiresInvoice: false, sourceChannel: "", sourcePage: "", codePage: "", codeAdmin: "" });
  const [assignCode, setAssignCode] = useState({ page: "", admin: "" });
  const [editingCustomer, setEditingCustomer] = useState({ name: "", phone: "", lineId: "", email: "", companyName: "", taxId: "", branch: "สำนักงานใหญ่", billingAddress: "", accountingEmail: "", requiresInvoice: false, notes: "", sourceChannel: "", sourcePage: "", lineFriend: false, loyaltyPoints: 0 });
  const sourceChannelOptions = ["", "Facebook", "LINE", "หน้าร้าน", "TikTok", "Website", "Shopee", "อื่น ๆ"];
  const [importRows, setImportRows] = useState<ImportedCustomer[]>([]);
  const [importFileName, setImportFileName] = useState("");
  const [importError, setImportError] = useState("");
  const normalizedQuery = customerQuery.trim().toLowerCase();
  const visibleCustomers = normalizedQuery
    ? customers.filter((customer) =>
        [customer.name, customer.phone, customer.lineId, customer.email]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery)
      )
    : customers;

  function startEditing(customer: Customer) {
    setEditingId(customer.id);
    setEditingCustomer({
      name: customer.name,
      phone: customer.phone,
      lineId: customer.lineId,
      email: customer.email,
      companyName: customer.companyName ?? "",
      taxId: customer.taxId ?? "",
      branch: customer.branch ?? "สำนักงานใหญ่",
      billingAddress: customer.billingAddress ?? "",
      accountingEmail: customer.accountingEmail ?? "",
      requiresInvoice: customer.requiresInvoice ?? false,
      notes: customer.notes ?? "",
      sourceChannel: customer.sourceChannel ?? "",
      sourcePage: customer.sourcePage ?? "",
      lineFriend: customer.lineFriend ?? false,
      loyaltyPoints: customer.loyaltyPoints ?? 0
    });
  }

  function submitNewCustomer() {
    if (!newCustomer.name.trim()) return;
    onAddCustomer({
      name: newCustomer.name.trim(),
      phone: newCustomer.phone.trim(),
      lineId: newCustomer.lineId.trim(),
      email: newCustomer.email.trim(),
      companyName: newCustomer.companyName.trim(),
      taxId: newCustomer.taxId.trim(),
      branch: newCustomer.branch.trim(),
      billingAddress: newCustomer.billingAddress.trim(),
      accountingEmail: newCustomer.accountingEmail.trim(),
      requiresInvoice: newCustomer.requiresInvoice,
      sourceChannel: newCustomer.sourceChannel,
      sourcePage: newCustomer.sourcePage.trim(),
      codePage: newCustomer.codePage,
      codeAdmin: newCustomer.codeAdmin
    });
    setNewCustomer({ name: "", phone: "", lineId: "", email: "", companyName: "", taxId: "", branch: "สำนักงานใหญ่", billingAddress: "", accountingEmail: "", requiresInvoice: false, sourceChannel: "", sourcePage: "", codePage: "", codeAdmin: "" });
  }

  async function handleImportFile(file: File | null) {
    setImportError("");
    setImportRows([]);
    setImportFileName(file?.name ?? "");
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        setImportError("ไม่พบ sheet ในไฟล์นี้");
        return;
      }
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: "" });
      const parsedRows = parseCustomerRows(rows, customers);
      if (!parsedRows.length) {
        setImportError("ไม่พบคอลัมน์ชื่อลูกค้าในไฟล์ กรุณาใช้ name หรือ ชื่อลูกค้า");
        return;
      }
      setImportRows(parsedRows);
    } catch {
      setImportError("อ่านไฟล์ไม่สำเร็จ กรุณาใช้ไฟล์ .xlsx, .xls หรือ .csv");
    }
  }

  function importCustomers() {
    const validRows = importRows.filter((row) => !row.duplicateReason);
    validRows.forEach((row) => {
      onAddCustomer({
        name: row.name,
        phone: row.phone,
        lineId: row.lineId,
        email: row.email,
        notes: row.notes,
        companyName: row.companyName,
        taxId: row.taxId,
        branch: row.branch,
        billingAddress: row.billingAddress,
        accountingEmail: row.accountingEmail,
        requiresInvoice: row.requiresInvoice
      });
    });
    setImportRows([]);
    setImportFileName("");
  }

  function submitCustomerEdit(customerId: string) {
    if (!editingCustomer.name.trim()) return;
    onUpdateCustomer(customerId, {
      name: editingCustomer.name.trim(),
      phone: editingCustomer.phone.trim(),
      lineId: editingCustomer.lineId.trim(),
      email: editingCustomer.email.trim(),
      companyName: editingCustomer.companyName.trim(),
      taxId: editingCustomer.taxId.trim(),
      branch: editingCustomer.branch.trim(),
      billingAddress: editingCustomer.billingAddress.trim(),
      accountingEmail: editingCustomer.accountingEmail.trim(),
      requiresInvoice: editingCustomer.requiresInvoice,
      notes: editingCustomer.notes.trim(),
      sourceChannel: editingCustomer.sourceChannel,
      sourcePage: editingCustomer.sourcePage.trim(),
      lineFriend: editingCustomer.lineFriend,
      loyaltyPoints: Number(editingCustomer.loyaltyPoints) || 0
    });
    setEditingId(null);
  }

  return (
    <div className="space-y-4">
      <section className="glass rounded-[1.5rem] p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-sm font-semibold text-k2-muted">Customer CMS</p>
            <h3 className="text-2xl font-semibold">ฐานข้อมูลลูกค้า</h3>
            <p className="mt-2 text-sm font-semibold text-k2-muted">
              จัดการโปรไฟล์ลูกค้า ข้อมูลติดต่อ และเชื่อมประวัติงานทั้งหมดในระบบ
            </p>
          </div>
          <label className="flex min-w-0 items-center gap-2 rounded-2xl border border-white/70 bg-white/70 px-3 py-2 shadow-sm xl:w-80">
            <Search className="h-4 w-4 shrink-0 text-k2-muted" />
            <input
              value={customerQuery}
              onChange={(event) => setCustomerQuery(event.target.value)}
              placeholder="ค้นหาชื่อ เบอร์ LINE หรืออีเมล"
              className="w-full min-w-0 bg-transparent text-sm font-semibold outline-none"
            />
          </label>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_180px_180px_1fr_auto]">
          <input
            value={newCustomer.name}
            onChange={(event) => setNewCustomer((current) => ({ ...current, name: event.target.value }))}
            placeholder="ชื่อลูกค้า / บริษัท"
            className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-semibold outline-none"
          />
          <input
            value={newCustomer.phone}
            onChange={(event) => setNewCustomer((current) => ({ ...current, phone: event.target.value }))}
            placeholder="เบอร์โทร"
            className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-semibold outline-none"
          />
          <input
            value={newCustomer.lineId}
            onChange={(event) => setNewCustomer((current) => ({ ...current, lineId: event.target.value }))}
            placeholder="LINE ID"
            className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-semibold outline-none"
          />
          <input
            value={newCustomer.email}
            onChange={(event) => setNewCustomer((current) => ({ ...current, email: event.target.value }))}
            placeholder="อีเมล"
            className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-semibold outline-none"
          />
          <button
            type="button"
            onClick={submitNewCustomer}
            disabled={!newCustomer.name.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-k2-ink px-4 py-3 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <UserPlus className="h-4 w-4" />
            เพิ่มลูกค้า
          </button>
        </div>
        <div className="mt-3 grid gap-3 rounded-[1.25rem] border border-white/70 bg-white/35 p-3 md:grid-cols-2 xl:grid-cols-5">
          <input
            value={newCustomer.companyName}
            onChange={(event) => setNewCustomer((current) => ({ ...current, companyName: event.target.value }))}
            placeholder="ชื่อบริษัท"
            className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-semibold outline-none"
          />
          <input
            value={newCustomer.taxId}
            onChange={(event) => setNewCustomer((current) => ({ ...current, taxId: event.target.value }))}
            placeholder="เลขผู้เสียภาษี"
            className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-semibold outline-none"
          />
          <input
            value={newCustomer.branch}
            onChange={(event) => setNewCustomer((current) => ({ ...current, branch: event.target.value }))}
            placeholder="สาขา"
            className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-semibold outline-none"
          />
          <input
            value={newCustomer.accountingEmail}
            onChange={(event) => setNewCustomer((current) => ({ ...current, accountingEmail: event.target.value }))}
            placeholder="อีเมลบัญชี"
            className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-semibold outline-none"
          />
          <label className="inline-flex items-center gap-2 rounded-2xl bg-white/70 px-4 py-3 text-sm font-extrabold text-k2-muted">
            <input
              type="checkbox"
              checked={newCustomer.requiresInvoice}
              onChange={(event) => setNewCustomer((current) => ({ ...current, requiresInvoice: event.target.checked }))}
              className="h-4 w-4 accent-teal-500"
            />
            ออกใบกำกับ
          </label>
          <select
            value={newCustomer.sourceChannel}
            onChange={(event) => setNewCustomer((current) => ({ ...current, sourceChannel: event.target.value }))}
            className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-semibold outline-none"
          >
            {sourceChannelOptions.map((c) => (
              <option key={c} value={c}>{c || "แหล่งที่มา (ไม่ระบุ)"}</option>
            ))}
          </select>
          <input
            value={newCustomer.sourcePage}
            onChange={(event) => setNewCustomer((current) => ({ ...current, sourcePage: event.target.value }))}
            placeholder="ชื่อเพจ/ไลน์ เช่น K2Sign, @k2sign"
            className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-semibold outline-none"
          />
          <textarea
            value={newCustomer.billingAddress}
            onChange={(event) => setNewCustomer((current) => ({ ...current, billingAddress: event.target.value }))}
            placeholder="ที่อยู่ใบกำกับ / ใบเสร็จ"
            className="min-h-20 rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-semibold outline-none md:col-span-2 xl:col-span-5"
          />
        </div>

        {/* ระบบรหัสลูกค้า K2 — [เพจ]-[แอดมิน]-[ลำดับ]-[ปี] */}
        <div className="mt-3 grid gap-3 rounded-[1.25rem] border border-k2-ink/15 bg-white/45 p-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="flex flex-wrap items-center justify-between gap-2 md:col-span-2 xl:col-span-4">
            <p className="text-sm font-extrabold text-k2-ink">รหัสลูกค้า (ผูกค่าคอมถาวร)</p>
            <details className="text-xs">
              <summary className="cursor-pointer font-bold text-k2-muted">ดูทะเบียนตัวย่อ</summary>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div>
                  <p className="mb-1 font-bold text-k2-muted">เพจ</p>
                  {CUSTOMER_CODE_PAGES.map((p) => (
                    <span key={p.code} className="mb-1 mr-1 inline-block rounded bg-white/80 px-1.5 py-0.5">{p.code} = {p.name}</span>
                  ))}
                </div>
                <div>
                  <p className="mb-1 font-bold text-k2-muted">แอดมิน (เจ้าของค่าคอม)</p>
                  {CUSTOMER_CODE_ADMINS.map((a) => (
                    <span key={a.code} className="mb-1 mr-1 inline-block rounded bg-white/80 px-1.5 py-0.5">{a.code} = {a.name}</span>
                  ))}
                </div>
              </div>
            </details>
          </div>
          <select
            value={newCustomer.codePage}
            onChange={(event) => setNewCustomer((current) => ({ ...current, codePage: event.target.value }))}
            className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-semibold outline-none"
          >
            <option value="">เลือกเพจ</option>
            {CUSTOMER_CODE_PAGES.map((p) => (
              <option key={p.code} value={p.code}>{p.name} ({p.code})</option>
            ))}
          </select>
          <select
            value={newCustomer.codeAdmin}
            onChange={(event) => setNewCustomer((current) => ({ ...current, codeAdmin: event.target.value }))}
            className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-semibold outline-none"
          >
            <option value="">เลือกแอดมิน (เจ้าของค่าคอม)</option>
            {CUSTOMER_CODE_ADMINS.map((a) => (
              <option key={a.code} value={a.code}>{a.name} ({a.code})</option>
            ))}
          </select>
          <div className="flex items-center rounded-2xl bg-white/70 px-4 py-3 text-sm font-bold md:col-span-2">
            {newCustomer.codePage && newCustomer.codeAdmin ? (
              <span>
                รหัสที่จะออก: <span className="font-extrabold text-k2-ink">{formatCustomerCode(newCustomer.codePage, newCustomer.codeAdmin, nextCustomerSeq(customers), customerCodeYear())}</span>
                <span className="ml-1 font-semibold text-k2-muted">(เลขลำดับจริงออกโดยระบบตอนบันทึก)</span>
              </span>
            ) : (
              <span className="text-k2-muted">เลือกเพจ + แอดมิน เพื่อออกรหัสอัตโนมัติ (ไม่บังคับ)</span>
            )}
          </div>
        </div>

        <div className="mt-5 rounded-[1.35rem] border border-white/70 bg-white/45 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h4 className="text-lg font-extrabold">นำเข้า Excel / CSV</h4>
              <p className="mt-1 text-sm font-semibold text-k2-muted">
                รองรับคอลัมน์ `name, phone, line_id, email, notes` หรือ `ชื่อลูกค้า, เบอร์โทร, LINE ID, อีเมล, หมายเหตุ`
              </p>
            </div>
            <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-white/75 px-4 py-3 text-sm font-extrabold text-k2-ink shadow-sm">
              <Upload className="h-4 w-4" />
              เลือกไฟล์
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(event) => void handleImportFile(event.target.files?.[0] ?? null)}
                className="sr-only"
              />
            </label>
          </div>

          {importFileName ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm font-bold text-k2-muted">
              <span className="rounded-full bg-white/75 px-3 py-1">{importFileName}</span>
              <span>{importRows.filter((row) => !row.duplicateReason).length} รายการพร้อมนำเข้า</span>
              <span>{importRows.filter((row) => row.duplicateReason).length} รายการซ้ำ</span>
            </div>
          ) : null}
          {importError ? <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700">{importError}</p> : null}
          {importRows.length ? (
            <div className="mt-4 space-y-3">
              <div className="soft-scrollbar max-h-72 overflow-auto rounded-2xl border border-white/70 bg-white/45">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="sticky top-0 bg-white/90 text-xs uppercase tracking-[0.12em] text-k2-muted">
                    <tr>
                      <th className="px-4 py-3">ลูกค้า</th>
                      <th className="px-4 py-3">เบอร์โทร</th>
                      <th className="px-4 py-3">LINE</th>
                      <th className="px-4 py-3">อีเมล</th>
                      <th className="px-4 py-3">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.slice(0, 20).map((row, index) => (
                      <tr key={`${row.name}-${index}`} className="border-t border-white/70">
                        <td className="px-4 py-3 font-extrabold">{row.name}</td>
                        <td className="px-4 py-3">{row.phone || "-"}</td>
                        <td className="px-4 py-3">{row.lineId || "-"}</td>
                        <td className="px-4 py-3">{row.email || "-"}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${row.duplicateReason ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                            {row.duplicateReason ?? "พร้อมนำเข้า"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setImportRows([]);
                    setImportFileName("");
                    setImportError("");
                  }}
                  className="rounded-2xl bg-white/70 px-4 py-3 text-sm font-extrabold text-k2-muted"
                >
                  ล้างไฟล์
                </button>
                <button
                  type="button"
                  onClick={importCustomers}
                  disabled={!importRows.some((row) => !row.duplicateReason)}
                  className="rounded-2xl bg-k2-ink px-4 py-3 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  นำเข้า {importRows.filter((row) => !row.duplicateReason).length} รายการ
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
      {visibleCustomers.map((customer) => {
        const customerJobs = jobs.filter((job) => job.customerId === customer.id);
        const isEditing = editingId === customer.id;
        return (
          <section key={customer.id} className="glass rounded-[1.5rem] p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                {isEditing ? (
                  <div className="grid gap-2 md:grid-cols-2">
                    <input
                      value={editingCustomer.name}
                      onChange={(event) => setEditingCustomer((current) => ({ ...current, name: event.target.value }))}
                      className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3 text-sm font-semibold outline-none md:col-span-2"
                    />
                    <input
                      value={editingCustomer.phone}
                      onChange={(event) => setEditingCustomer((current) => ({ ...current, phone: event.target.value }))}
                      className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3 text-sm font-semibold outline-none"
                    />
                    <input
                      value={editingCustomer.lineId}
                      onChange={(event) => setEditingCustomer((current) => ({ ...current, lineId: event.target.value }))}
                      className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3 text-sm font-semibold outline-none"
                    />
                    <input
                      value={editingCustomer.email}
                      onChange={(event) => setEditingCustomer((current) => ({ ...current, email: event.target.value }))}
                      className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3 text-sm font-semibold outline-none md:col-span-2"
                    />
                    <input
                      value={editingCustomer.companyName}
                      onChange={(event) => setEditingCustomer((current) => ({ ...current, companyName: event.target.value }))}
                      placeholder="ชื่อบริษัท"
                      className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3 text-sm font-semibold outline-none"
                    />
                    <input
                      value={editingCustomer.taxId}
                      onChange={(event) => setEditingCustomer((current) => ({ ...current, taxId: event.target.value }))}
                      placeholder="เลขผู้เสียภาษี"
                      className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3 text-sm font-semibold outline-none"
                    />
                    <input
                      value={editingCustomer.branch}
                      onChange={(event) => setEditingCustomer((current) => ({ ...current, branch: event.target.value }))}
                      placeholder="สาขา"
                      className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3 text-sm font-semibold outline-none"
                    />
                    <input
                      value={editingCustomer.accountingEmail}
                      onChange={(event) => setEditingCustomer((current) => ({ ...current, accountingEmail: event.target.value }))}
                      placeholder="อีเมลบัญชี"
                      className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3 text-sm font-semibold outline-none"
                    />
                    <textarea
                      value={editingCustomer.billingAddress}
                      onChange={(event) => setEditingCustomer((current) => ({ ...current, billingAddress: event.target.value }))}
                      placeholder="ที่อยู่ใบกำกับ / ใบเสร็จ"
                      className="min-h-20 rounded-2xl border border-white/80 bg-white/85 px-4 py-3 text-sm font-semibold outline-none md:col-span-2"
                    />
                    <label className="inline-flex items-center gap-2 rounded-2xl bg-white/70 px-4 py-3 text-sm font-extrabold text-k2-muted md:col-span-2">
                      <input
                        type="checkbox"
                        checked={editingCustomer.requiresInvoice}
                        onChange={(event) => setEditingCustomer((current) => ({ ...current, requiresInvoice: event.target.checked }))}
                        className="h-4 w-4 accent-teal-500"
                      />
                      ลูกค้าต้องออกใบกำกับ / ใบเสร็จ
                    </label>
                    <select
                      value={editingCustomer.sourceChannel}
                      onChange={(event) => setEditingCustomer((current) => ({ ...current, sourceChannel: event.target.value }))}
                      className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3 text-sm font-semibold outline-none"
                    >
                      {sourceChannelOptions.map((c) => (
                        <option key={c} value={c}>{c || "แหล่งที่มา (ไม่ระบุ)"}</option>
                      ))}
                    </select>
                    <input
                      value={editingCustomer.sourcePage}
                      onChange={(event) => setEditingCustomer((current) => ({ ...current, sourcePage: event.target.value }))}
                      placeholder="ชื่อเพจ/ไลน์ เช่น K2Sign, @k2sign"
                      className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3 text-sm font-semibold outline-none"
                    />
                    <textarea
                      value={editingCustomer.notes}
                      onChange={(event) => setEditingCustomer((current) => ({ ...current, notes: event.target.value }))}
                      placeholder="โน้ตลูกค้า เช่น ชอบงานด่วน · จ่ายเงินเร็ว · ชอบแก้หลายรอบ · ลูกค้าประจำ"
                      className="min-h-20 rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm font-semibold outline-none md:col-span-2"
                    />
                    <label className="inline-flex items-center gap-2 rounded-2xl bg-green-50 px-4 py-3 text-sm font-extrabold text-green-700">
                      <input
                        type="checkbox"
                        checked={editingCustomer.lineFriend}
                        onChange={(event) => setEditingCustomer((current) => ({ ...current, lineFriend: event.target.checked }))}
                        className="h-4 w-4 accent-green-500"
                      />
                      เป็นเพื่อน LINE OA แล้ว
                    </label>
                    <input
                      type="number"
                      value={editingCustomer.loyaltyPoints}
                      onChange={(event) => setEditingCustomer((current) => ({ ...current, loyaltyPoints: Number(event.target.value) }))}
                      placeholder="แต้มสะสม"
                      className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3 text-sm font-semibold outline-none"
                    />
                    {customer.customerCode ? (
                      <div className="rounded-2xl bg-white/70 px-4 py-3 text-sm font-bold md:col-span-2">
                        รหัสลูกค้า: <span className="font-extrabold text-k2-ink">{customer.customerCode}</span>
                        <span className="ml-2 font-semibold text-k2-muted">(รหัสถาวร แก้ไม่ได้)</span>
                      </div>
                    ) : (
                      <div className="grid gap-2 rounded-2xl border border-k2-ink/15 bg-white/55 p-3 sm:grid-cols-3 md:col-span-2">
                        <select
                          value={assignCode.page}
                          onChange={(event) => setAssignCode((current) => ({ ...current, page: event.target.value }))}
                          className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3 text-sm font-semibold outline-none"
                        >
                          <option value="">เลือกเพจ</option>
                          {CUSTOMER_CODE_PAGES.map((p) => (
                            <option key={p.code} value={p.code}>{p.name} ({p.code})</option>
                          ))}
                        </select>
                        <select
                          value={assignCode.admin}
                          onChange={(event) => setAssignCode((current) => ({ ...current, admin: event.target.value }))}
                          className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3 text-sm font-semibold outline-none"
                        >
                          <option value="">เลือกแอดมิน</option>
                          {CUSTOMER_CODE_ADMINS.map((a) => (
                            <option key={a.code} value={a.code}>{a.name} ({a.code})</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={!assignCode.page || !assignCode.admin}
                          onClick={() => { onAssignCode(customer.id, assignCode.page, assignCode.admin); setAssignCode({ page: "", admin: "" }); }}
                          className="rounded-2xl bg-k2-ink px-4 py-3 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          ออกรหัสลูกค้า
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="break-words text-2xl font-semibold">{customer.name}</h3>
                      {customer.customerCode ? (
                        <span className="rounded-full bg-k2-ink px-2.5 py-1 text-xs font-extrabold tracking-wide text-white">{customer.customerCode}</span>
                      ) : null}
                      {(() => {
                        const badge = loyaltyBadge(customer.totalOrders, customer.lifetimeValue);
                        return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${badge.cls}`}>{badge.emoji} {badge.label}</span>;
                      })()}
                      {customer.lineFriend ? <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-700">🟢 เพื่อน LINE</span> : null}
                      {customer.loyaltyPoints ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">⭐ {customer.loyaltyPoints} แต้ม</span> : null}
                    </div>
                    <p className="mt-1 text-k2-muted">{customer.phone || "ไม่มีเบอร์โทร"} - LINE {customer.lineId || "-"}</p>
                    <p className="text-k2-muted">{customer.email || "ยังไม่มีอีเมล"}</p>
                    <p className="mt-2 rounded-2xl bg-white/55 px-3 py-2 text-sm font-semibold text-k2-muted">
                      {customer.companyName || "ยังไม่มีข้อมูลบริษัท"} {customer.taxId ? `| Tax ID ${customer.taxId}` : ""} {customer.requiresInvoice ? "| ต้องออกเอกสาร" : ""}
                    </p>
                    {customer.sourceChannel || customer.sourcePage ? (
                      <p className="mt-2 text-sm font-semibold text-k2-muted">📍 มาจาก: {customer.sourceChannel || "-"}{customer.sourcePage ? ` · ${customer.sourcePage}` : ""}</p>
                    ) : null}
                    {customer.notes ? (
                      <p className="mt-2 rounded-2xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">📝 {customer.notes}</p>
                    ) : null}
                  </>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {isEditing ? (
                  <button
                    type="button"
                    onClick={() => submitCustomerEdit(customer.id)}
                    className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-100 text-emerald-700"
                    title="บันทึกลูกค้า"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => startEditing(customer)}
                    className="grid h-11 w-11 place-items-center rounded-2xl bg-white/75 text-k2-muted"
                    title="แก้ไขลูกค้า"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
                {canDelete ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`ลบลูกค้า "${customer.name}" ออกจากระบบ?`)) onRemoveCustomer(customer.id);
                    }}
                    disabled={customerJobs.length > 0}
                    className="grid h-11 w-11 place-items-center rounded-2xl bg-rose-50 text-rose-600 disabled:opacity-35"
                    title={customerJobs.length > 0 ? "ลบไม่ได้เพราะมีประวัติงาน" : "ลบลูกค้า"}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MiniStat label="ออเดอร์" value={customer.totalOrders} />
              <MiniStat label="มูลค่าสะสม" value={money.format(customer.lifetimeValue)} />
              <MiniStat label="งานเปิด" value={customerJobs.filter((job) => !["Completed", "Cancelled"].includes(job.status)).length} />
              <MiniStat label="ไฟล์งาน" value={customerJobs.reduce((sum, job) => sum + job.files.length, 0)} />
            </div>

            {/* ประวัติออเดอร์ย้อนหลัง */}
            <div className="mt-5">
              <p className="mb-2 text-sm font-bold text-k2-muted">ประวัติออเดอร์ ({customerJobs.length})</p>
              <div className="space-y-2">
                {customerJobs.map((job) => (
                  <div key={job.id} className="flex items-start justify-between gap-3 rounded-2xl bg-white/65 p-3">
                    <div className="min-w-0">
                      <p className="font-semibold leading-5">{job.id} · {job.title}</p>
                      <p className="text-sm text-k2-muted">{statusLabel[job.status]} · สั่ง {job.orderDate} · ส่ง {job.dueDate}</p>
                    </div>
                    <span className="shrink-0 text-sm font-extrabold text-k2-ink">{money.format(job.price)}</span>
                  </div>
                ))}
                {customerJobs.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/90 bg-white/45 p-3 text-sm font-semibold text-k2-muted">
                    ยังไม่มีประวัติงานของลูกค้าคนนี้
                  </div>
                ) : null}
              </div>
            </div>

            {/* สลิปมัดจำย้อนหลัง */}
            {customerJobs.some((job) => job.depositSlip) ? (
              <div className="mt-5">
                <p className="mb-2 text-sm font-bold text-k2-muted">สลิปมัดจำย้อนหลัง</p>
                <div className="flex flex-wrap gap-2">
                  {customerJobs.filter((job) => job.depositSlip).map((job) => (
                    <a key={job.id} href={job.depositSlip} target="_blank" rel="noreferrer" title={`${job.id} · ${money.format(job.deposit)}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={job.depositSlip} alt={`สลิป ${job.id}`} className="h-20 w-20 rounded-xl object-cover ring-1 ring-white/80" />
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        );
      })}
      {visibleCustomers.length === 0 ? (
        <section className="glass rounded-[1.5rem] p-8 text-center text-sm font-semibold text-k2-muted xl:col-span-2">
          ไม่พบลูกค้าที่ตรงกับคำค้นหา
        </section>
      ) : null}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-white/65 p-3">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-k2-muted">{label}</p>
      <p className="mt-1 font-bold">{value}</p>
    </div>
  );
}

const leaveTypeLabel: Record<LeaveRequest["leaveType"], string> = { sick: "ลาป่วย", personal: "ลากิจ", vacation: "ลาพักร้อน" };
const leaveStatusLabel: Record<LeaveRequest["status"], string> = { pending: "รออนุมัติ", approved: "อนุมัติแล้ว", rejected: "ไม่อนุมัติ" };
const leaveStatusTone: Record<LeaveRequest["status"], string> = { pending: "bg-amber-100 text-amber-800", approved: "bg-emerald-100 text-emerald-700", rejected: "bg-rose-100 text-rose-700" };

function PayrollView({
  teamMembers,
  records,
  summary,
  month,
  onMonthChange,
  companyName
}: {
  teamMembers: TeamMember[];
  records: Record<string, { salary: number; position: string; startDate: string }>;
  summary: Record<string, { present: number; late: number; lateMin: number; leaveDays: number; otHours: number }>;
  month: string;
  onMonthChange: (month: string) => void;
  companyName: string;
}) {
  const [deductions, setDeductions] = useState<Record<string, string>>({});
  const [bonuses, setBonuses] = useState<Record<string, string>>({});
  const staff = teamMembers.filter((member) => member.role !== "Owner");
  // ค่า OT = ชั่วโมง × (เงินเดือน/30/8 × 1.5) = เงินเดือน/160 ต่อชั่วโมง (มาตรฐานวันธรรมดา 1.5 เท่า)
  const otPay = (id: string, base: number) => Math.round((summary[id]?.otHours ?? 0) * (base / 160));
  const netPay = (id: string, base: number) => Math.max(0, base - (Number(deductions[id]) || 0) + (Number(bonuses[id]) || 0) + otPay(id, base));

  function printSlip(member: TeamMember, base: number) {
    const s = summary[member.id] ?? { present: 0, late: 0, lateMin: 0, leaveDays: 0, otHours: 0 };
    const ded = Number(deductions[member.id]) || 0;
    const bon = Number(bonuses[member.id]) || 0;
    const net = netPay(member.id, base);
    const baht = (value: number) => value.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const win = window.open("", "_blank", "width=520,height=720");
    if (!win) return;
    win.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>สลิปเงินเดือน ${member.name}</title>` +
        `<style>body{font-family:'Sarabun','Noto Sans Thai',sans-serif;padding:28px;color:#1f2a3d}h1{font-size:18px;margin:0}h2{font-size:15px;margin:18px 0 6px}table{width:100%;border-collapse:collapse;font-size:14px}td{padding:6px 0}td:last-child{text-align:right}.tot{border-top:2px solid #333;font-weight:700;font-size:16px}.muted{color:#637f82;font-size:13px}</style></head><body>` +
        `<h1>${companyName}</h1><p class="muted">สลิปเงินเดือน · ประจำเดือน ${month}</p>` +
        `<h2>${member.name} · ${records[member.id]?.position || roleLabel[member.role]}</h2>` +
        `<table>` +
        `<tr><td>วันมาทำงาน</td><td>${s.present} วัน</td></tr>` +
        `<tr><td>มาสาย</td><td>${s.late} วัน (${s.lateMin} นาที)</td></tr>` +
        `<tr><td>ลา (อนุมัติ)</td><td>${s.leaveDays} วัน</td></tr>` +
        `<tr><td>OT</td><td>${s.otHours} ชม. (+ ${baht(otPay(member.id, base))} บาท)</td></tr>` +
        `<tr><td>เงินเดือนฐาน</td><td>${baht(base)} บาท</td></tr>` +
        `<tr><td>หักเงิน</td><td>- ${baht(ded)} บาท</td></tr>` +
        `<tr><td>โบนัส/เพิ่ม</td><td>+ ${baht(bon)} บาท</td></tr>` +
        `<tr class="tot"><td>เงินสุทธิ</td><td>${baht(net)} บาท</td></tr>` +
        `</table><p class="muted" style="margin-top:24px">ออกโดยระบบ K2Smart</p></body></html>`
    );
    win.document.close();
    win.focus();
    win.print();
  }

  return (
    <div className="space-y-4">
      <section className="glass rounded-[1.5rem] p-5">
        <p className="text-sm font-semibold text-k2-muted">เงินเดือน / สลิป</p>
        <h3 className="text-2xl font-semibold">คำนวณเงินเดือนรายเดือน</h3>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input type="month" value={month} onChange={(event) => onMonthChange(event.target.value)} className="rounded-2xl border border-white/80 bg-white/85 px-3 py-2 text-sm outline-none" />
          <span className="text-sm font-semibold text-k2-muted">ระบบดึงวันมาทำงาน/สาย/ลา อัตโนมัติ — กรอก &quot;หักเงิน/โบนัส&quot; ตามนโยบาย แล้วพิมพ์สลิป</span>
        </div>
      </section>

      <section className="glass soft-scrollbar overflow-x-auto rounded-[1.5rem] p-5">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="text-xs uppercase tracking-wide text-k2-muted">
            <tr className="text-left">
              <th className="pb-3">พนักงาน</th>
              <th className="pb-3">มาทำงาน</th>
              <th className="pb-3">สาย</th>
              <th className="pb-3">ลา</th>
              <th className="pb-3">OT</th>
              <th className="pb-3">เงินเดือนฐาน</th>
              <th className="pb-3">หักเงิน</th>
              <th className="pb-3">โบนัส</th>
              <th className="pb-3">เงินสุทธิ</th>
              <th className="pb-3">สลิป</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((member) => {
              const base = records[member.id]?.salary ?? 0;
              const s = summary[member.id] ?? { present: 0, late: 0, lateMin: 0, leaveDays: 0, otHours: 0 };
              return (
                <tr key={member.id} className="border-t border-white/60">
                  <td className="py-3">
                    <p className="font-bold">{member.name}</p>
                    <p className="text-xs text-k2-muted">{member.branch ? `สาขา${member.branch}` : "-"}</p>
                  </td>
                  <td className="py-3">{s.present} วัน</td>
                  <td className="py-3">{s.late} วัน{s.lateMin ? ` (${s.lateMin} น.)` : ""}</td>
                  <td className="py-3">{s.leaveDays} วัน</td>
                  <td className="py-3">{s.otHours} ชม.{s.otHours ? ` (+${money.format(otPay(member.id, base))})` : ""}</td>
                  <td className="py-3">{money.format(base)}</td>
                  <td className="py-3">
                    <input type="number" value={deductions[member.id] ?? ""} onChange={(event) => setDeductions((current) => ({ ...current, [member.id]: event.target.value }))} className="w-24 rounded-xl border border-white/80 bg-white/85 px-2 py-1 outline-none" placeholder="0" />
                  </td>
                  <td className="py-3">
                    <input type="number" value={bonuses[member.id] ?? ""} onChange={(event) => setBonuses((current) => ({ ...current, [member.id]: event.target.value }))} className="w-24 rounded-xl border border-white/80 bg-white/85 px-2 py-1 outline-none" placeholder="0" />
                  </td>
                  <td className="py-3 font-extrabold">{money.format(netPay(member.id, base))}</td>
                  <td className="py-3">
                    <button type="button" onClick={() => printSlip(member, base)} className="rounded-xl bg-k2-ink px-3 py-2 text-xs font-bold text-white">พิมพ์</button>
                  </td>
                </tr>
              );
            })}
            {staff.length === 0 ? (
              <tr><td colSpan={10} className="py-4 text-center text-sm font-semibold text-k2-muted">ยังไม่มีพนักงาน</td></tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function LeaveView({
  currentUser,
  teamMembers,
  leaveRequests,
  holidays,
  isHr,
  onSubmit,
  onReview
}: {
  currentUser: TeamMember;
  teamMembers: TeamMember[];
  leaveRequests: LeaveRequest[];
  holidays: Holiday[];
  isHr: boolean;
  onSubmit: (input: { leaveType: LeaveRequest["leaveType"]; startDate: string; endDate: string; reason: string }) => void;
  onReview: (id: string, status: "approved" | "rejected") => void;
}) {
  const [leaveType, setLeaveType] = useState<LeaveRequest["leaveType"]>("sick");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const nameById = (id: string) => teamMembers.find((member) => member.id === id)?.name ?? "พนักงาน";
  const myLeaves = leaveRequests.filter((leave) => leave.profileId === currentUser.id);
  const pending = leaveRequests.filter((leave) => leave.status === "pending");

  function submit() {
    onSubmit({ leaveType, startDate, endDate, reason });
    setStartDate("");
    setEndDate("");
    setReason("");
  }

  return (
    <div className="space-y-4">
      <section className="glass rounded-[1.5rem] p-5">
        <p className="text-sm font-semibold text-k2-muted">ขอลา</p>
        <h3 className="mb-4 text-2xl font-semibold">ยื่นใบลา</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-semibold text-k2-muted">ประเภทการลา</span>
            <select value={leaveType} onChange={(event) => setLeaveType(event.target.value as LeaveRequest["leaveType"])} className="w-full rounded-2xl border border-white/80 bg-white/85 px-3 py-2 text-sm outline-none">
              {(["sick", "personal", "vacation"] as LeaveRequest["leaveType"][]).map((type) => (
                <option key={type} value={type}>{leaveTypeLabel[type]}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-k2-muted">เหตุผล</span>
            <input value={reason} onChange={(event) => setReason(event.target.value)} className="w-full rounded-2xl border border-white/80 bg-white/85 px-3 py-2 text-sm outline-none" />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-k2-muted">วันที่เริ่มลา</span>
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="w-full rounded-2xl border border-white/80 bg-white/85 px-3 py-2 text-sm outline-none" />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-k2-muted">ถึงวันที่</span>
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="w-full rounded-2xl border border-white/80 bg-white/85 px-3 py-2 text-sm outline-none" />
          </label>
        </div>
        <button type="button" onClick={submit} className="mt-4 rounded-2xl bg-k2-ink px-5 py-3 font-bold text-white">ส่งใบลา</button>
      </section>

      {isHr ? (
        <section className="glass rounded-[1.5rem] p-5">
          <h4 className="mb-3 text-lg font-extrabold">ใบลารออนุมัติ ({pending.length})</h4>
          {pending.length === 0 ? (
            <p className="text-sm font-semibold text-k2-muted">ไม่มีใบลารออนุมัติ</p>
          ) : (
            <div className="space-y-2">
              {pending.map((leave) => (
                <div key={leave.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/60 px-4 py-3">
                  <div>
                    <p className="font-bold">{nameById(leave.profileId)} · {leaveTypeLabel[leave.leaveType]}</p>
                    <p className="text-sm text-k2-muted">{leave.startDate} ถึง {leave.endDate}{leave.reason ? ` · ${leave.reason}` : ""}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => onReview(leave.id, "approved")} className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-bold text-white">อนุมัติ</button>
                    <button type="button" onClick={() => onReview(leave.id, "rejected")} className="rounded-xl bg-white/70 px-3 py-2 text-xs font-bold text-rose-600">ไม่อนุมัติ</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      <section className="glass rounded-[1.5rem] p-5">
        <h4 className="mb-3 text-lg font-extrabold">ใบลาของฉัน</h4>
        {myLeaves.length === 0 ? (
          <p className="text-sm font-semibold text-k2-muted">ยังไม่มีใบลา</p>
        ) : (
          <div className="space-y-2">
            {myLeaves.map((leave) => (
              <div key={leave.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/60 px-4 py-3">
                <span className="font-semibold">{leaveTypeLabel[leave.leaveType]} · {leave.startDate} ถึง {leave.endDate}</span>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${leaveStatusTone[leave.status]}`}>{leaveStatusLabel[leave.status]}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="glass rounded-[1.5rem] p-5">
        <h4 className="mb-3 text-lg font-extrabold">วันหยุดบริษัท</h4>
        {holidays.length === 0 ? (
          <p className="text-sm font-semibold text-k2-muted">ยังไม่มีวันหยุดในระบบ</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {holidays.map((holiday) => (
              <span key={holiday.id} className="rounded-full bg-k2-mint px-3 py-1 text-sm font-semibold text-emerald-800">{holiday.date} · {holiday.name}</span>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ปุ่มเช็คอิน/เช็คเอาท์ — variant "hero" = การ์ดใหญ่บนหน้าแรก, "fab" = ปุ่มลอยมุมล่างขวา
function CheckInControl({
  variant,
  branch,
  myAttendance,
  onCheckIn,
  onCheckOut
}: {
  variant: "hero" | "fab";
  branch?: string;
  myAttendance: Attendance | null;
  onCheckIn: () => Promise<CheckInResult>;
  onCheckOut: () => Promise<{ ok: boolean; msg: string }>;
}) {
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [errMsg, setErrMsg] = useState("");
  const [checkInPopup, setCheckInPopup] = useState<CheckInResult | null>(null);
  const [checkOutPopup, setCheckOutPopup] = useState<{ hours: number; minutes: number } | null>(null);
  const [confirmOut, setConfirmOut] = useState(false);

  // กันกดพลาด: ถ้าเพิ่งเช็คอินไม่ถึงเท่านี้ (นาที) จะเตือนเป็นพิเศษตอนยืนยันออกงาน
  const RECENT_CHECKIN_MINUTES = 5;

  const working = !!(myAttendance && myAttendance.checkInAt && !myAttendance.checkOutAt);
  const done = !!(myAttendance && myAttendance.checkInAt && myAttendance.checkOutAt);

  // เดินนาฬิกาทุกวินาที (ทั้งตอนยังไม่เข้างาน=โชว์เวลาปัจจุบัน และตอนทำงาน=นับเวลา)
  useEffect(() => {
    if (done) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [done]);

  const pad = (n: number) => String(n).padStart(2, "0");
  // เวลาที่ผ่านไปตั้งแต่เช็คอิน -> HH:MM:SS
  const elapsedMs = working && myAttendance?.checkInAt ? Math.max(0, now - new Date(myAttendance.checkInAt).getTime()) : 0;
  const elapsedLabel = `${pad(Math.floor(elapsedMs / 3600000))}:${pad(Math.floor((elapsedMs % 3600000) / 60000))}:${pad(Math.floor((elapsedMs % 60000) / 1000))}`;
  // เวลาปัจจุบัน (เดินสด) -> HH:MM:SS
  const clockLabel = new Date(now).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  async function handleClick() {
    if (busy || done) return;
    setErrMsg("");
    if (working) {
      // ไม่เช็คเอาท์ทันที — เปิดหน้าต่างยืนยันก่อน (กันกดซ้ำ/กดพลาดตอนเช้าแล้วออกงานเอง)
      setConfirmOut(true);
      return;
    }
    setBusy(true);
    const result = await onCheckIn();
    setBusy(false);
    if (!result.ok) {
      setErrMsg(result.msg);
      return;
    }
    setCheckInPopup(result);
  }

  // ออกงานจริง — เรียกเมื่อกดยืนยันในหน้าต่างยืนยันเท่านั้น
  async function confirmCheckOut() {
    if (busy) return;
    setBusy(true);
    const result = await onCheckOut();
    setBusy(false);
    setConfirmOut(false);
    if (!result.ok) {
      setErrMsg(result.msg);
      return;
    }
    const start = myAttendance?.checkInAt ? new Date(myAttendance.checkInAt).getTime() : Date.now();
    const totalMin = Math.max(0, Math.round((Date.now() - start) / 60000));
    setCheckOutPopup({ hours: Math.floor(totalMin / 60), minutes: totalMin % 60 });
  }

  if (!branch) return null;

  const trigger = variant === "hero" ? (
    <section className={`glass rounded-[1.75rem] p-6 shadow-xl ${working ? "ring-2 ring-k2-ink/20" : done ? "" : "ring-2 ring-emerald-300"}`}>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <div className="flex items-center gap-4">
          <motion.span
            animate={done ? {} : working ? { rotate: [0, 12, -12, 0] } : { scale: [1, 1.1, 1] }}
            transition={{ repeat: done ? 0 : Infinity, duration: working ? 2 : 1.6 }}
            className={`grid h-16 w-16 shrink-0 place-items-center rounded-2xl ${done ? "bg-emerald-100 text-emerald-700" : working ? "bg-k2-ink text-white" : "bg-emerald-500 text-white"}`}
          >
            <Clock3 className="h-9 w-9" />
          </motion.span>
          <div className="text-center sm:text-left">
            <p className="text-sm font-bold text-k2-muted">{done ? "ลงเวลาวันนี้" : working ? "กำลังทำงาน — เวลาเดินอยู่" : `เวลาตอนนี้ · ${clockLabel}`}</p>
            {working ? (
              <p className="text-4xl font-black tabular-nums tracking-tight text-k2-ink">{elapsedLabel}</p>
            ) : done ? (
              <p className="text-2xl font-extrabold text-emerald-700">ทำงานครบแล้ว ✓</p>
            ) : (
              <p className="text-4xl font-black tabular-nums tracking-tight text-k2-ink">{clockLabel}</p>
            )}
          </div>
        </div>
        {done ? (
          <span className="rounded-2xl bg-emerald-100 px-5 py-3 font-extrabold text-emerald-700">เจอกันใหม่พรุ่งนี้ 🌙</span>
        ) : (
          <motion.button
            type="button"
            onClick={handleClick}
            disabled={busy}
            whileTap={{ scale: 0.96 }}
            className={`w-full rounded-2xl px-8 py-4 text-xl font-extrabold text-white shadow-lg disabled:opacity-70 sm:w-auto ${working ? "bg-rose-500" : "bg-emerald-500"}`}
          >
            {busy ? "กำลังบันทึก..." : working ? "เช็คเอาท์ออกงาน" : "เช็คอินเข้างาน"}
          </motion.button>
        )}
      </div>
      {errMsg ? <p className="mt-3 text-center text-sm font-bold text-rose-600 sm:text-left">{errMsg}</p> : null}
    </section>
  ) : (
    <div className="fixed bottom-5 right-4 z-40 flex flex-col items-end gap-2">
      {errMsg ? (
        <span className="max-w-[15rem] rounded-2xl bg-rose-600 px-3 py-2 text-right text-xs font-bold text-white shadow-lg">{errMsg}</span>
      ) : null}
      {done ? (
        <div className="flex items-center gap-2 rounded-full bg-white/90 px-5 py-3 font-extrabold text-emerald-700 shadow-xl ring-1 ring-emerald-200">
          <Clock3 className="h-5 w-5" />
          ลงเวลาครบแล้ววันนี้ ✓
        </div>
      ) : (
        <motion.button
          type="button"
          onClick={handleClick}
          disabled={busy}
          whileTap={{ scale: 0.94 }}
          className={`flex items-center gap-3 rounded-full px-6 py-4 text-left font-extrabold text-white shadow-2xl disabled:opacity-70 ${
            working ? "bg-k2-ink" : "bg-emerald-500"
          }`}
        >
          <motion.span
            animate={working ? { rotate: [0, 12, -12, 0] } : { scale: [1, 1.12, 1] }}
            transition={{ repeat: Infinity, duration: working ? 2 : 1.6 }}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/20"
          >
            <Clock3 className="h-7 w-7" />
          </motion.span>
          <span className="flex flex-col leading-tight">
            {working ? (
              <>
                <span className="text-xs font-bold opacity-80">กำลังทำงาน · แตะเพื่อเช็คเอาท์</span>
                <span className="text-2xl tabular-nums tracking-tight">{elapsedLabel}</span>
              </>
            ) : (
              <>
                <span className="text-xs font-bold opacity-80">{busy ? "กำลังบันทึก..." : `เช็คอิน · ${clockLabel}`}</span>
                <span className="text-xl">เช็คอิน</span>
              </>
            )}
          </span>
        </motion.button>
      )}
    </div>
  );

  const elapsedMin = Math.floor(elapsedMs / 60000);
  const recentCheckIn = working && elapsedMin < RECENT_CHECKIN_MINUTES;

  return (
    <>
      {trigger}

      {confirmOut ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[55] flex items-center justify-center bg-k2-ink/40 p-6 backdrop-blur-sm"
          onClick={() => setConfirmOut(false)}
        >
          <motion.div
            initial={{ scale: 0.8, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
            className="glass w-full max-w-xs rounded-[1.75rem] p-7 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-5xl">🕔</div>
            <h3 className="mt-3 text-2xl font-extrabold text-k2-ink">ยืนยันออกงาน?</h3>
            <p className="mt-2 text-sm font-semibold text-k2-muted">เวลาทำงานตอนนี้</p>
            <p className="mt-1 text-4xl font-black tabular-nums tracking-tight text-k2-ink">{elapsedLabel}</p>
            {recentCheckIn ? (
              <p className="mt-4 rounded-2xl bg-amber-100 px-3 py-2 text-sm font-bold text-amber-700">
                เพิ่งเช็คอินไปเมื่อ {elapsedMin} นาทีที่แล้ว — ถ้ากดพลาดให้กด “ยกเลิก”
              </p>
            ) : null}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmOut(false)}
                className="flex-1 rounded-2xl bg-white px-5 py-3 font-extrabold text-k2-ink shadow-sm ring-1 ring-slate-200"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={confirmCheckOut}
                disabled={busy}
                className="flex-1 rounded-2xl bg-rose-500 px-5 py-3 font-extrabold text-white shadow-lg disabled:opacity-70"
              >
                {busy ? "กำลังบันทึก..." : "ยืนยันออกงาน"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}

      {checkInPopup ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-k2-ink/40 p-6 backdrop-blur-sm"
          onClick={() => setCheckInPopup(null)}
        >
          <motion.div
            initial={{ scale: 0.8, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
            className="glass w-full max-w-xs rounded-[1.75rem] p-7 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-6xl">{checkInPopup.status === "late" ? "🦥" : "🎉"}</div>
            <h3 className="mt-3 text-2xl font-extrabold text-k2-ink">{checkInPopup.status === "late" ? "เช็คอินแล้วน้า~" : "เยี่ยมมาก!"}</h3>
            <p className="mt-1 text-4xl font-black tabular-nums tracking-tight text-k2-ink">
              {checkInPopup.checkInAt ? new Date(checkInPopup.checkInAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) : "-"}
            </p>
            <span className={`mt-4 inline-block rounded-full px-4 py-1.5 text-sm font-bold ${checkInPopup.status === "late" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
              {checkInPopup.status === "late" ? `สาย ${checkInPopup.lateMinutes} นาที 🐢` : "เข้างานตรงเวลา ✓"}
            </span>
            <p className="mt-3 text-sm font-semibold text-k2-muted">{checkInPopup.status === "late" ? "พรุ่งนี้มาเช้าอีกนิดนะ 💪" : "เริ่มต้นวันดีๆ ไปด้วยกัน 🌈"}</p>
            {checkInPopup.geofenced === false ? (
              <p className="mt-3 rounded-2xl bg-amber-100 px-3 py-2 text-xs font-bold text-amber-700">⚠️ สาขานี้ยังไม่ได้ตั้งพิกัด GPS — เช็คอินได้จากทุกที่ (ให้ HR ไปตั้งพิกัดที่เมนู HR)</p>
            ) : null}
            <button type="button" onClick={() => setCheckInPopup(null)} className="mt-5 w-full rounded-2xl bg-k2-ink px-5 py-3 font-bold text-white">เริ่มทำงาน!</button>
          </motion.div>
        </motion.div>
      ) : null}

      {checkOutPopup ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-k2-ink/40 p-6 backdrop-blur-sm"
          onClick={() => setCheckOutPopup(null)}
        >
          <motion.div
            initial={{ scale: 0.8, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
            className="glass w-full max-w-xs rounded-[1.75rem] p-7 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-6xl">🌟</div>
            <h3 className="mt-3 text-2xl font-extrabold text-k2-ink">เลิกงานแล้ว ขอบคุณนะ! 💖</h3>
            <p className="mt-3 text-sm font-semibold text-k2-muted">วันนี้ทำงานไป</p>
            <p className="mt-1 text-4xl font-black tabular-nums tracking-tight text-k2-ink">
              {checkOutPopup.hours} ชม. {checkOutPopup.minutes} นาที
            </p>
            <p className="mt-3 text-sm font-semibold text-k2-muted">พักผ่อนเยอะๆ แล้วเจอกันใหม่พรุ่งนี้ 🌙</p>
            <button type="button" onClick={() => setCheckOutPopup(null)} className="mt-5 w-full rounded-2xl bg-k2-ink px-5 py-3 font-bold text-white">รับทราบ</button>
          </motion.div>
        </motion.div>
      ) : null}
    </>
  );
}

function AttendanceView({
  currentUser,
  branchSetting,
  myAttendance,
  allAttendance,
  teamMembers,
  isHr,
  onCheckIn,
  onCheckOut,
  overtime,
  canGrantOt,
  onAddOvertime
}: {
  currentUser: TeamMember;
  branchSetting?: BranchSetting;
  myAttendance: Attendance | null;
  allAttendance: Attendance[];
  teamMembers: TeamMember[];
  isHr: boolean;
  onCheckIn: () => Promise<CheckInResult>;
  onCheckOut: () => Promise<{ ok: boolean; msg: string }>;
  overtime: Overtime[];
  canGrantOt: boolean;
  onAddOvertime: (profileId: string, workDate: string, hours: number, note: string) => void;
}) {
  const isOwnerOrHr = currentUser.role === "Owner" || isHr;
  // ผู้จัดการเปิด OT ให้เฉพาะพนักงานสาขาตัวเอง · เจ้าของ/HR เห็นทุกสาขา
  const otStaff = teamMembers.filter((member) => member.role !== "Owner" && (isOwnerOrHr || (currentUser.branch && member.branch === currentUser.branch)));
  const [otForm, setOtForm] = useState({ profileId: "", workDate: todayISO(), hours: "", note: "" });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [popup, setPopup] = useState<CheckInResult | null>(null);

  async function doCheckIn() {
    setBusy(true);
    const result = await onCheckIn();
    setBusy(false);
    if (result.ok) {
      setMsg("");
      setPopup(result);
    } else {
      setMsg(result.msg);
    }
  }
  async function doCheckOut() {
    setBusy(true);
    const result = await onCheckOut();
    setBusy(false);
    setMsg(result.msg);
  }

  const fmtTime = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) : "-");
  const nameById = (id: string) => teamMembers.find((member) => member.id === id)?.name ?? "พนักงาน";
  const branchById = (id: string) => teamMembers.find((member) => member.id === id)?.branch ?? "ไม่ระบุสาขา";
  const statusLabel = (row: Attendance) => (row.status === "late" ? `สาย ${row.lateMinutes} นาที` : "ตรงเวลา");

  // ส่งออก Excel การลงเวลา — แยกเป็น 1 ชีตต่อ 1 สาขา
  function exportAttendanceExcel() {
    const workbook = XLSX.utils.book_new();
    const byBranch = new Map<string, Attendance[]>();
    allAttendance.forEach((row) => {
      const branch = branchById(row.profileId);
      const list = byBranch.get(branch) ?? [];
      list.push(row);
      byBranch.set(branch, list);
    });
    const branches = [...byBranch.keys()].sort((a, b) => a.localeCompare(b, "th"));
    branches.forEach((branch) => {
      const rows = (byBranch.get(branch) ?? [])
        .slice()
        .sort((a, b) => nameById(a.profileId).localeCompare(nameById(b.profileId), "th"))
        .map((row) => ({
          พนักงาน: nameById(row.profileId),
          สาขา: branch,
          วันที่: row.workDate,
          เวลาเข้า: fmtTime(row.checkInAt),
          เวลาออก: fmtTime(row.checkOutAt),
          สถานะ: statusLabel(row),
          สายนาที: row.status === "late" ? row.lateMinutes : 0
        }));
      const sheet = XLSX.utils.json_to_sheet(rows);
      // ชื่อชีต Excel จำกัด 31 ตัวอักษรและห้ามใช้อักขระบางตัว
      const safeName = branch.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "สาขา";
      XLSX.utils.book_append_sheet(workbook, sheet, safeName);
    });
    XLSX.writeFile(workbook, `ลงเวลา_${todayISO()}.xlsx`);
  }

  return (
    <div className="space-y-4">
      <section className="glass rounded-[1.5rem] p-5">
        <p className="text-sm font-semibold text-k2-muted">ลงเวลาเข้า-ออกงาน</p>
        <h3 className="text-2xl font-semibold">เช็คอินวันนี้</h3>
        {currentUser.branch ? (
          <p className="mt-1 text-sm font-semibold text-k2-muted">
            สาขา{currentUser.branch}
            {branchSetting ? ` · เข้างาน ${branchSetting.workStart} (สายได้ ${branchSetting.lateGraceMinutes} นาที)` : " · HR ยังไม่ได้ตั้งค่าเวลา/พิกัดสาขานี้"}
          </p>
        ) : (
          <p className="mt-1 text-sm font-semibold text-rose-600">ยังไม่ได้กำหนดสาขาประจำ — ให้ HR ตั้งค่าก่อนจึงจะเช็คอินได้</p>
        )}
      </section>

      {currentUser.branch ? (
        <section className="glass rounded-[1.5rem] p-5">
          {myAttendance && myAttendance.checkInAt ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className={`rounded-full px-3 py-1 text-sm font-bold ${myAttendance.status === "late" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                  {myAttendance.status === "late" ? `เข้างานสาย ${myAttendance.lateMinutes} นาที` : "เข้างานตรงเวลา"}
                </span>
                <span className="text-sm font-semibold text-k2-muted">เข้า {fmtTime(myAttendance.checkInAt)} · ออก {fmtTime(myAttendance.checkOutAt)}</span>
              </div>
              {!myAttendance.checkOutAt ? (
                <button type="button" disabled={busy} onClick={doCheckOut} className="rounded-2xl bg-k2-ink px-5 py-3 font-bold text-white disabled:opacity-60">เช็คเอาท์</button>
              ) : (
                <p className="text-sm font-semibold text-k2-muted">ลงเวลาครบแล้ววันนี้ ✓</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-k2-muted">กดปุ่มเดียวจบ — ระบบจะเช็ค GPS แล้วบันทึกเวลาเข้างานให้อัตโนมัติ</p>
              <button type="button" disabled={busy} onClick={doCheckIn} className="rounded-2xl bg-emerald-500 px-6 py-3 font-bold text-white disabled:opacity-60">{busy ? "กำลังเช็คอิน..." : "เช็คอินเข้างาน"}</button>
            </div>
          )}
          {msg ? <p className="mt-3 text-sm font-semibold text-rose-600">{msg}</p> : null}
        </section>
      ) : null}

      {popup ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-k2-ink/40 p-6 backdrop-blur-sm"
          onClick={() => setPopup(null)}
        >
          <motion.div
            initial={{ scale: 0.8, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
            className="glass w-full max-w-xs rounded-[1.75rem] p-7 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-6xl">{popup.status === "late" ? "🦥" : "🎉"}</div>
            <h3 className="mt-3 text-2xl font-extrabold text-k2-ink">
              {popup.status === "late" ? "เช็คอินแล้วน้า~" : "เยี่ยมมาก!"}
            </h3>
            <p className="mt-1 text-4xl font-black tabular-nums tracking-tight text-k2-ink">
              {fmtTime(popup.checkInAt ?? null)}
            </p>
            <span className={`mt-4 inline-block rounded-full px-4 py-1.5 text-sm font-bold ${popup.status === "late" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
              {popup.status === "late" ? `สาย ${popup.lateMinutes} นาที 🐢` : "เข้างานตรงเวลา ✓"}
            </span>
            <p className="mt-3 text-sm font-semibold text-k2-muted">
              {popup.status === "late" ? "พรุ่งนี้มาเช้าอีกนิดนะ 💪" : "เริ่มต้นวันดีๆ ไปด้วยกัน 🌈"}
            </p>
            {popup.geofenced === false ? (
              <p className="mt-3 rounded-2xl bg-amber-100 px-3 py-2 text-xs font-bold text-amber-700">⚠️ สาขานี้ยังไม่ได้ตั้งพิกัด GPS — เช็คอินได้จากทุกที่ (ตั้งพิกัดที่เมนู HR)</p>
            ) : null}
            <button type="button" onClick={() => setPopup(null)} className="mt-5 w-full rounded-2xl bg-k2-ink px-5 py-3 font-bold text-white">รับทราบ</button>
          </motion.div>
        </motion.div>
      ) : null}

      {canGrantOt ? (
        <section className="glass rounded-[1.5rem] p-5">
          <h4 className="text-lg font-extrabold">เปิด OT ให้พนักงาน{isOwnerOrHr ? "" : ` · สาขา${currentUser.branch || "-"}`}</h4>
          <p className="mb-3 text-sm font-semibold text-k2-muted">เลือกพนักงาน + วันที่ + จำนวนชั่วโมง — OT จะไปคำนวณในเงินเดือนอัตโนมัติ</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <select
              value={otForm.profileId}
              onChange={(event) => setOtForm((current) => ({ ...current, profileId: event.target.value }))}
              className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3 text-sm font-semibold outline-none"
            >
              <option value="">เลือกพนักงาน</option>
              {otStaff.map((member) => (
                <option key={member.id} value={member.id}>{member.name}{member.branch ? ` · ${member.branch}` : ""}</option>
              ))}
            </select>
            <input type="date" value={otForm.workDate} onChange={(event) => setOtForm((current) => ({ ...current, workDate: event.target.value }))} className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3 text-sm font-semibold outline-none" />
            <input type="number" min="0" step="0.5" placeholder="ชั่วโมง OT" value={otForm.hours} onChange={(event) => setOtForm((current) => ({ ...current, hours: event.target.value }))} className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3 text-sm font-semibold outline-none" />
            <input placeholder="หมายเหตุ (ถ้ามี)" value={otForm.note} onChange={(event) => setOtForm((current) => ({ ...current, note: event.target.value }))} className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3 text-sm font-semibold outline-none" />
          </div>
          <button
            type="button"
            onClick={() => { onAddOvertime(otForm.profileId, otForm.workDate, Number(otForm.hours), otForm.note); setOtForm((current) => ({ ...current, profileId: "", hours: "", note: "" })); }}
            disabled={!otForm.profileId || !Number(otForm.hours)}
            className="mt-3 rounded-2xl bg-k2-ink px-5 py-3 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            บันทึก OT
          </button>
          <div className="mt-4 space-y-2">
            <p className="text-sm font-bold text-k2-muted">OT เดือนนี้</p>
            {overtime.filter((row) => isOwnerOrHr || row.branch === currentUser.branch).length === 0 ? (
              <p className="text-sm font-semibold text-k2-muted">ยังไม่มีรายการ OT</p>
            ) : (
              overtime.filter((row) => isOwnerOrHr || row.branch === currentUser.branch).map((row) => (
                <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/60 px-4 py-2 text-sm">
                  <span className="font-bold">{nameById(row.profileId)}</span>
                  <span className="font-semibold text-k2-muted">{row.workDate} · {row.hours} ชม.{row.note ? ` · ${row.note}` : ""}</span>
                </div>
              ))
            )}
          </div>
        </section>
      ) : null}

      {isHr ? (
        <section className="glass rounded-[1.5rem] p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-lg font-extrabold">สรุปการลงเวลาวันนี้</h4>
            <button
              type="button"
              onClick={exportAttendanceExcel}
              disabled={allAttendance.length === 0}
              className="rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              ส่งออก Excel (แยกสาขา)
            </button>
          </div>
          {allAttendance.length === 0 ? (
            <p className="text-sm font-semibold text-k2-muted">ยังไม่มีพนักงานเช็คอินวันนี้</p>
          ) : (
            <div className="space-y-2">
              {allAttendance.map((row) => (
                <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/60 px-4 py-3">
                  <span className="font-bold">{nameById(row.profileId)} <span className="text-xs font-semibold text-k2-muted">· {branchById(row.profileId)}</span></span>
                  <span className="text-sm font-semibold text-k2-muted">เข้า {fmtTime(row.checkInAt)} · ออก {fmtTime(row.checkOutAt)}</span>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${row.status === "late" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                    {row.status === "late" ? `สาย ${row.lateMinutes} นาที` : "ตรงเวลา"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}

function BranchSettingsCard({
  setting,
  canEdit,
  onSave
}: {
  setting: BranchSetting;
  canEdit: boolean;
  onSave: (setting: BranchSetting) => void;
}) {
  const [draft, setDraft] = useState<BranchSetting>(setting);
  const [gpsMsg, setGpsMsg] = useState("");
  useEffect(() => {
    setDraft(setting);
  }, [setting]);
  function pickGps() {
    if (!navigator.geolocation) {
      setGpsMsg("เบราว์เซอร์ไม่รองรับ GPS");
      return;
    }
    setGpsMsg("กำลังดึงพิกัด...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDraft((current) => ({ ...current, gpsLat: Number(pos.coords.latitude.toFixed(6)), gpsLng: Number(pos.coords.longitude.toFixed(6)) }));
        setGpsMsg("ดึงพิกัดแล้ว");
      },
      () => setGpsMsg("ดึงพิกัดไม่สำเร็จ — อนุญาตตำแหน่งก่อน")
    );
  }
  return (
    <div className="rounded-2xl bg-white/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h5 className="font-extrabold">สาขา{setting.branch}</h5>
        {draft.gpsLat != null ? <span className="text-xs font-semibold text-emerald-700">มีพิกัดแล้ว</span> : <span className="text-xs font-semibold text-rose-600">ยังไม่ตั้งพิกัด</span>}
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="space-y-1">
          <span className="text-xs font-semibold text-k2-muted">เวลาเข้างาน</span>
          <input type="time" value={draft.workStart} disabled={!canEdit} onChange={(e) => setDraft((c) => ({ ...c, workStart: e.target.value }))} className="w-full rounded-2xl border border-white/80 bg-white/85 px-3 py-2 text-sm outline-none disabled:opacity-60" />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-k2-muted">เวลาออกงาน</span>
          <input type="time" value={draft.workEnd} disabled={!canEdit} onChange={(e) => setDraft((c) => ({ ...c, workEnd: e.target.value }))} className="w-full rounded-2xl border border-white/80 bg-white/85 px-3 py-2 text-sm outline-none disabled:opacity-60" />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-k2-muted">สายได้ไม่เกิน (นาที)</span>
          <input type="number" value={draft.lateGraceMinutes} disabled={!canEdit} onChange={(e) => setDraft((c) => ({ ...c, lateGraceMinutes: Number(e.target.value) || 0 }))} className="w-full rounded-2xl border border-white/80 bg-white/85 px-3 py-2 text-sm outline-none disabled:opacity-60" />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-k2-muted">พิกัด Lat</span>
          <input value={draft.gpsLat ?? ""} disabled={!canEdit} onChange={(e) => setDraft((c) => ({ ...c, gpsLat: e.target.value === "" ? null : Number(e.target.value) }))} className="w-full rounded-2xl border border-white/80 bg-white/85 px-3 py-2 text-sm outline-none disabled:opacity-60" />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-k2-muted">พิกัด Lng</span>
          <input value={draft.gpsLng ?? ""} disabled={!canEdit} onChange={(e) => setDraft((c) => ({ ...c, gpsLng: e.target.value === "" ? null : Number(e.target.value) }))} className="w-full rounded-2xl border border-white/80 bg-white/85 px-3 py-2 text-sm outline-none disabled:opacity-60" />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-k2-muted">รัศมีอนุญาต (เมตร)</span>
          <input type="number" value={draft.radiusM} disabled={!canEdit} onChange={(e) => setDraft((c) => ({ ...c, radiusM: Number(e.target.value) || 0 }))} className="w-full rounded-2xl border border-white/80 bg-white/85 px-3 py-2 text-sm outline-none disabled:opacity-60" />
        </label>
      </div>
      {canEdit ? (
        <div className="mt-3 flex items-center gap-3">
          <button type="button" onClick={pickGps} className="rounded-2xl bg-k2-mint px-3 py-2 text-sm font-bold text-k2-ink">ดึงพิกัดปัจจุบัน</button>
          <button type="button" onClick={() => onSave(draft)} className="rounded-2xl bg-k2-ink px-4 py-2 text-sm font-bold text-white">บันทึกสาขานี้</button>
          {gpsMsg ? <span className="text-xs font-semibold text-k2-muted">{gpsMsg}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

function HRView({
  teamMembers,
  records,
  canEdit,
  onSave,
  branches,
  branchSettings,
  onSaveBranch,
  holidays,
  onAddHoliday,
  onRemoveHoliday
}: {
  teamMembers: TeamMember[];
  records: Record<string, { salary: number; position: string; startDate: string }>;
  canEdit: boolean;
  onSave: (memberId: string, record: { salary: number; position: string; startDate: string }) => void;
  branches: string[];
  branchSettings: Record<string, BranchSetting>;
  onSaveBranch: (setting: BranchSetting) => void;
  holidays: Holiday[];
  onAddHoliday: (date: string, name: string) => void;
  onRemoveHoliday: (id: string) => void;
}) {
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayName, setHolidayName] = useState("");
  const [drafts, setDrafts] = useState<Record<string, { salary: string; position: string; startDate: string }>>({});
  const staff = teamMembers.filter((member) => member.role !== "Owner");
  const staffBranches = Array.from(new Set(staff.map((member) => member.branch || "ยังไม่กำหนดสาขา")));
  const totalPayroll = staff.reduce((sum, member) => sum + (records[member.id]?.salary ?? 0), 0);

  function draftFor(member: TeamMember) {
    const existing = drafts[member.id];
    if (existing) return existing;
    const record = records[member.id] ?? { salary: 0, position: "", startDate: "" };
    return { salary: record.salary ? String(record.salary) : "", position: record.position, startDate: record.startDate };
  }
  function setDraft(member: TeamMember, patch: Partial<{ salary: string; position: string; startDate: string }>) {
    const base = draftFor(member);
    setDrafts((current) => ({ ...current, [member.id]: { ...base, ...patch } }));
  }

  return (
    <div className="space-y-4">
      <section className="glass rounded-[1.5rem] p-5">
        <p className="text-sm font-semibold text-k2-muted">Human Resources</p>
        <h3 className="text-2xl font-semibold">เงินเดือนพนักงาน</h3>
        <p className="mt-2 text-sm font-semibold text-k2-muted">
          เห็นและแก้ได้เฉพาะเจ้าของและ HR · รวมเงินเดือนทั้งหมด {money.format(totalPayroll)} / เดือน
        </p>
      </section>

      <section className="glass rounded-[1.5rem] p-5">
        <h4 className="text-lg font-extrabold">ตั้งค่าลงเวลาแต่ละสาขา</h4>
        <p className="mb-4 mt-1 text-sm font-semibold text-k2-muted">เวลาเข้า-ออกงาน · สายได้ไม่เกินกี่นาที · จุดพิกัด GPS และรัศมีที่อนุญาตให้เช็คอิน</p>
        <div className="space-y-3">
          {branches.map((branch) => (
            <BranchSettingsCard
              key={branch}
              setting={branchSettings[branch] ?? defaultBranchSetting(branch)}
              canEdit={canEdit}
              onSave={onSaveBranch}
            />
          ))}
        </div>
      </section>

      <section className="glass rounded-[1.5rem] p-5">
        <h4 className="text-lg font-extrabold">วันหยุดบริษัท</h4>
        <p className="mb-3 mt-1 text-sm font-semibold text-k2-muted">ใช้อ้างอิงการลา/คำนวณเงินเดือน</p>
        {canEdit ? (
          <div className="mb-3 flex flex-wrap items-end gap-2">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-k2-muted">วันที่</span>
              <input type="date" value={holidayDate} onChange={(event) => setHolidayDate(event.target.value)} className="rounded-2xl border border-white/80 bg-white/85 px-3 py-2 text-sm outline-none" />
            </label>
            <label className="flex-1 space-y-1">
              <span className="text-xs font-semibold text-k2-muted">ชื่อวันหยุด</span>
              <input value={holidayName} onChange={(event) => setHolidayName(event.target.value)} placeholder="เช่น วันสงกรานต์" className="w-full rounded-2xl border border-white/80 bg-white/85 px-3 py-2 text-sm outline-none" />
            </label>
            <button type="button" onClick={() => { onAddHoliday(holidayDate, holidayName); setHolidayDate(""); setHolidayName(""); }} className="rounded-2xl bg-k2-ink px-4 py-2 text-sm font-bold text-white">เพิ่ม</button>
          </div>
        ) : null}
        {holidays.length === 0 ? (
          <p className="text-sm font-semibold text-k2-muted">ยังไม่มีวันหยุด</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {holidays.map((holiday) => (
              <span key={holiday.id} className="inline-flex items-center gap-2 rounded-full bg-k2-mint px-3 py-1 text-sm font-semibold text-emerald-800">
                {holiday.date} · {holiday.name}
                {canEdit ? <button type="button" onClick={() => onRemoveHoliday(holiday.id)} className="font-bold text-rose-600">✕</button> : null}
              </span>
            ))}
          </div>
        )}
      </section>

      {staffBranches.map((branch) => (
        <section key={branch} className="glass rounded-[1.5rem] p-5">
          <h4 className="mb-4 text-lg font-extrabold">เงินเดือน · สาขา{branch}</h4>
          <div className="space-y-3">
            {staff
              .filter((member) => (member.branch || "ยังไม่กำหนดสาขา") === branch)
              .map((member) => {
                const draft = draftFor(member);
                return (
                  <div key={member.id} className="grid gap-3 rounded-2xl bg-white/60 p-4 md:grid-cols-[1.1fr_1fr_1fr_1fr_auto] md:items-end">
                    <div>
                      <p className="font-bold">{member.name}</p>
                      <p className="text-sm text-k2-muted">{roleLabel[member.role]}</p>
                    </div>
                    <label className="space-y-1">
                      <span className="text-xs font-semibold text-k2-muted">ตำแหน่ง</span>
                      <input
                        value={draft.position}
                        disabled={!canEdit}
                        onChange={(event) => setDraft(member, { position: event.target.value })}
                        className="w-full rounded-2xl border border-white/80 bg-white/85 px-3 py-2 text-sm outline-none disabled:opacity-60"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-semibold text-k2-muted">เงินเดือน (บาท/เดือน)</span>
                      <input
                        type="number"
                        value={draft.salary}
                        disabled={!canEdit}
                        onChange={(event) => setDraft(member, { salary: event.target.value })}
                        className="w-full rounded-2xl border border-white/80 bg-white/85 px-3 py-2 text-sm outline-none disabled:opacity-60"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-semibold text-k2-muted">วันเริ่มงาน</span>
                      <input
                        type="date"
                        value={draft.startDate}
                        disabled={!canEdit}
                        onChange={(event) => setDraft(member, { startDate: event.target.value })}
                        className="w-full rounded-2xl border border-white/80 bg-white/85 px-3 py-2 text-sm outline-none disabled:opacity-60"
                      />
                    </label>
                    {canEdit ? (
                      <button
                        type="button"
                        onClick={() => onSave(member.id, { salary: Number(draft.salary) || 0, position: draft.position, startDate: draft.startDate })}
                        className="rounded-2xl bg-k2-ink px-4 py-2 text-sm font-bold text-white"
                      >
                        บันทึก
                      </button>
                    ) : null}
                  </div>
                );
              })}
            {staff.filter((member) => (member.branch || "ยังไม่กำหนดสาขา") === branch).length === 0 ? (
              <p className="text-sm font-semibold text-k2-muted">ยังไม่มีพนักงานในสาขานี้</p>
            ) : null}
          </div>
        </section>
      ))}
    </div>
  );
}

const AuditLog = memo(function AuditLog({ auditLog }: { auditLog: AuditEvent[] }) {
  return (
    <section className="glass rounded-[1.5rem] p-5">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-2xl font-semibold">ประวัติการแก้ไข</h3>
        <span className="rounded-full bg-k2-lilac px-3 py-1 text-xs font-bold text-violet-800">{auditLog.length} รายการ</span>
      </div>
      <div className="space-y-3">
        {auditLog.map((event) => (
          <div key={event.id} className="grid gap-3 rounded-2xl bg-white/65 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <p className="font-semibold">{event.actor} {auditActionLabel(event.action)}</p>
              <p className="text-sm text-k2-muted">{event.target}</p>
            </div>
            <p className="text-sm font-semibold text-k2-muted">{event.at}</p>
          </div>
        ))}
      </div>
    </section>
  );
});
