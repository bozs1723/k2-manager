"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
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
  ClipboardList,
  ClipboardPlus,
  Clock3,
  Factory,
  FileImage,
  LayoutDashboard,
  Lock,
  LogOut,
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
import { customers as initialCustomers, initialAuditLog, initialJobs, statuses, team as initialTeam } from "@/lib/mock-data";
import { createSupabaseAuthWorker, isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { AppNotification, AuditEvent, Customer, Job, JobStatus, JobType, PaymentStatus, Priority, QuoteStatus, Role, TeamMember } from "@/lib/types";

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
  | "view_audit_log";

type SupabaseProfileRow = {
  id: string;
  email: string | null;
  username?: string | null;
  full_name: string | null;
  role: Role | null;
  avatar_url?: string | null;
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
  acceptance?: "pending" | "accepted" | "rejected" | null;
  reject_reason?: string | null;
  assigned_designer: string | null;
  assigned_production: string | null;
  price: number | string;
  deposit: number | string;
  remaining_balance: number | string;
  payment_status: PaymentStatus;
  internal_notes: string | null;
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
  { title: "ลูกค้าและบัญชี", permissions: ["create_customer", "edit_customer", "delete_customer", "view_finance", "edit_payment", "export_quote"] },
  { title: "ผู้ใช้และระบบ", permissions: ["manage_users", "manage_permissions", "manage_company_settings", "view_audit_log"] }
];

const allPermissionKeys = permissionGroups.flatMap((group) => group.permissions);

const defaultRolePermissions: Record<Role, PermissionKey[]> = {
  Owner: ["view_dashboard", "create_job", "edit_job", "delete_job", "move_status", "assign_staff", "view_finance", "edit_payment", "create_customer", "edit_customer", "delete_customer", "export_quote", "manage_users", "manage_permissions", "manage_company_settings", "view_audit_log"],
  Manager: ["view_dashboard", "create_job", "edit_job", "move_status", "assign_staff", "view_finance", "edit_payment", "create_customer", "edit_customer", "export_quote", "view_audit_log"],
  Admin: ["view_dashboard", "create_job", "edit_job", "move_status", "assign_staff", "view_finance", "edit_payment", "create_customer", "edit_customer", "export_quote", "manage_users", "view_audit_log"],
  Designer: ["view_dashboard", "edit_job", "move_status"],
  "Production Staff": ["view_dashboard", "edit_job", "move_status"],
  "Packing Staff": ["view_dashboard", "edit_job", "move_status"],
  "Sales Staff": ["view_dashboard", "create_job", "edit_job", "create_customer", "edit_customer", "view_finance", "edit_payment", "export_quote"]
};

const roleSummaryPermissions: Record<Role, string[]> = {
  Owner: ["Full access", "Financials", "Audit log", "Team assignments"],
  Manager: ["Jobs", "Financials", "Assignments", "Reports"],
  Admin: ["Jobs", "Payments", "Assignments", "Audit log"],
  Designer: ["Design queue", "Files", "Comments", "Approval status"],
  "Production Staff": ["Production queue", "QC", "Internal notes"],
  "Packing Staff": ["Packing", "Delivery status", "QC notes"],
  "Sales Staff": ["Orders", "Customers", "Payment intake"]
};

const roles: Role[] = ["Owner", "Manager", "Admin", "Designer", "Production Staff", "Packing Staff", "Sales Staff"];
const jobTypes: JobType[] = ["DTG Shirt", "UV Print", "Laser Cut", "Signage", "3D Print", "Other"];
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
  Dashboard: "แดชบอร์ด",
  Board: "บอร์ดคิวงาน",
  "Create Job": "สร้างงาน",
  Calendar: "ปฏิทิน",
  Customers: "ลูกค้า",
  Payments: "การชำระเงิน",
  Reports: "รายงาน",
  Settings: "ตั้งค่า",
  Detail: "รายละเอียดงาน",
  Audit: "ประวัติการแก้ไข"
};

const statusLabel: Record<JobStatus, string> = {
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
  "3D Print": "พิมพ์ 3D",
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

function profileToMember(profile: { id: string; email?: string | null; username?: string | null; full_name: string | null; role: Role | null; avatar_url?: string | null }): TeamMember {
  const name = profile.full_name || "K2 User";
  return {
    id: profile.id,
    name,
    role: profile.role ?? "Sales Staff",
    avatar: initialsFromName(name),
    avatarUrl: profile.avatar_url ?? undefined,
    username: profile.username || usernameFromEmail(profile.email)
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
  files: Array<{ id: string; job_id: string; file_name: string; file_type: string; file_size: number | null }>
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
      size: file.file_size ? `${Math.max(file.file_size / 1000000, 0.01).toFixed(2)} MB` : "ไฟล์แนบ"
    })),
    orderDate: row.order_date,
    dueDate: row.due_date,
    priority: row.priority,
    isExpress: row.is_express ?? false,
    productionBranch: row.production_branch ?? "",
    acceptance: row.acceptance ?? "accepted",
    rejectReason: row.reject_reason ?? "",
    status: row.status,
    assignedDesigner: row.assigned_designer ? profileNames.get(row.assigned_designer) ?? "Unassigned" : "Unassigned",
    assignedProduction: row.assigned_production ? profileNames.get(row.assigned_production) ?? "Unassigned" : "Unassigned",
    price,
    deposit,
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
    requires_invoice: customer.requiresInvoice ?? false
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
  const [pendingMove, setPendingMove] = useState<{ jobId: string; from: JobStatus; to: JobStatus } | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const notifPanelRef = useRef<HTMLDivElement>(null);
  const [expressOrdersEnabled, setExpressOrdersEnabled] = useState(false);

  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? jobs[0] ?? null;
  const currentRolePermissions = useMemo(
    () => permissionMatrix[currentUser.role] ?? [],
    [permissionMatrix, currentUser.role]
  );
  const can = (permission: PermissionKey) => currentRolePermissions.includes(permission);
  const canSeeMoney = can("view_finance");
  const activeJobs = jobs.filter((job) => !["Completed", "Cancelled"].includes(job.status));
  const navigationItems = useMemo(
    () =>
      [
        { label: "Dashboard", icon: LayoutDashboard, visible: currentRolePermissions.includes("view_dashboard") },
        { label: "Board", icon: ClipboardList, visible: currentRolePermissions.includes("view_dashboard") },
        { label: "Create Job", icon: ClipboardPlus, visible: currentRolePermissions.includes("create_job") },
        { label: "Calendar", icon: CalendarDays, visible: currentRolePermissions.includes("view_dashboard") },
        { label: "Customers", icon: UsersRound, visible: currentRolePermissions.includes("create_customer") || currentRolePermissions.includes("edit_customer") || currentRolePermissions.includes("delete_customer") },
        { label: "Payments", icon: WalletCards, visible: currentRolePermissions.includes("view_finance") || currentRolePermissions.includes("edit_payment") },
        { label: "Reports", icon: BarChart3, visible: currentRolePermissions.includes("view_dashboard") },
        { label: "Settings", icon: Settings, visible: true },
        { label: "Detail", icon: FileImage, visible: currentRolePermissions.includes("view_dashboard") },
        { label: "Audit", icon: ShieldCheck, visible: currentRolePermissions.includes("view_audit_log") }
      ].filter((item) => item.visible),
    [currentRolePermissions]
  );

  useEffect(() => {
    if (!supabase) return;
    let isMounted = true;

    async function loadProfile(userId: string) {
      const { data, error } = await supabase!
        .from("profiles")
        .select("id, email, full_name, role, avatar_url")
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

  const canManageExpress = currentUser.role === "Owner" || currentUser.role === "Manager";

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
        supabase.from("profiles").select("id, email, full_name, role, avatar_url, is_active").eq("is_active", true).order("created_at", { ascending: true }),
        supabase.from("company_settings").select("*").order("created_at", { ascending: true }).limit(1),
        supabase.from("customers").select("*").order("created_at", { ascending: false }),
        supabase.from("jobs").select("*").order("created_at", { ascending: false }),
        supabase.from("job_comments").select("id, job_id, comment, created_at, author_id").order("created_at", { ascending: false }),
        supabase.from("job_status_history").select("id, job_id, from_status, to_status, created_at, changed_by").order("created_at", { ascending: true }),
        supabase.from("job_files").select("id, job_id, file_name, file_type, file_size").order("created_at", { ascending: true }),
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
      if (members.length) setTeamMembers(members);

      const companyRows = companyResult.error ? [] : (companyResult.data ?? []) as SupabaseCompanyRow[];
      if (companyRows[0]) {
        const savedFacebookPages = (() => {
          try {
            return normalizeFacebookPages(JSON.parse(window.localStorage.getItem(facebookPagesStorageKey) ?? "[]"));
          } catch {
            return [];
          }
        })();
        setCompanyProfile({ ...companyFromRow(companyRows[0]), ...(savedFacebookPages.length ? { facebookPages: savedFacebookPages } : {}) });
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
          (filesResult.data ?? []) as Array<{ id: string; job_id: string; file_name: string; file_type: string; file_size: number | null }>
        )
      );
      setJobs(nextJobs);
      setCustomerRecords(customerRows.map((row) => customerFromRow(row, jobRows)));
      setAuditLog(auditResult.error ? [] : ((auditResult.data ?? []) as Parameters<typeof auditFromRow>[0][]).map((row) => auditFromRow(row, profileNames)));

      if (!shopStateResult.error && shopStateResult.data?.[0]) {
        setExpressOrdersEnabled(Boolean((shopStateResult.data[0] as { express_orders_enabled?: boolean }).express_orders_enabled));
      }
      if (!notificationsResult.error) {
        setNotifications(((notificationsResult.data ?? []) as SupabaseNotificationRow[]).map(notifFromRow));
      }
      // คงงานที่กำลังเปิดดูไว้ ไม่ดีดออกเวลามีข้อมูลซิงก์เข้ามา
      setSelectedJobId((current) => (current && nextJobs.some((job) => job.id === current) ? current : nextJobs[0]?.id ?? ""));
    } catch (error) {
      setDataError(errorMessage(error, "โหลดข้อมูลจาก Supabase ไม่สำเร็จ"));
    } finally {
      if (!silent) setDataLoading(false);
    }
  }

  const filteredJobs = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return jobs;
    return jobs.filter((job) =>
      [job.id, job.customerName, job.title, job.type, job.status, job.assignedDesigner, job.assignedProduction]
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    );
  }, [jobs, query]);

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
          .select("id, email, full_name, role, avatar_url")
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
    setPendingMove({ jobId, from: job.status, to: nextStatus });
  }

  // ผู้จัดการ/เจ้าของ ยอมรับงานเข้าสาขา (เซลที่สร้างต้องรอยอมรับก่อน)
  const canAcceptJobs = ["Owner", "Manager", "Admin"].includes(currentUser.role);

  async function acceptJob(jobId: string) {
    if (!canAcceptJobs) {
      setDataError("เฉพาะผู้จัดการหรือเจ้าของเท่านั้นที่ยอมรับงานได้");
      return;
    }
    const job = jobs.find((item) => item.id === jobId);
    if (!job) return;
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
  }

  async function rejectJob(jobId: string, reason: string) {
    if (!canAcceptJobs) {
      setDataError("เฉพาะผู้จัดการหรือเจ้าของเท่านั้นที่ปฏิเสธงานได้");
      return;
    }
    const job = jobs.find((item) => item.id === jobId);
    if (!job) return;
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

  async function createJob(input?: Partial<Job>) {
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
    // เซลสร้างงาน -> ต้องให้ผู้จัดการสาขายอมรับก่อน; บทบาทอื่น (ผจก./เจ้าของ/แอดมิน) ยอมรับอัตโนมัติ
    const jobAcceptance: "pending" | "accepted" = currentUser.role === "Sales Staff" ? "pending" : "accepted";
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
              production_branch: input?.productionBranch ?? null,
              acceptance: jobAcceptance,
              reject_reason: null,
              status: "New Order",
              assigned_designer: teamIdByName(teamMembers, input?.assignedDesigner),
              assigned_production: teamIdByName(teamMembers, input?.assignedProduction),
              price,
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
            to_status: "New Order",
            changed_by: currentUser.id
          });
        }
        await appendAudit("created job", insertedJobNumber, "jobs", insertedJob.id);
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
      files: input?.files?.length ? input.files : [{ id: crypto.randomUUID(), name: "sponsor-plaque-artwork.pdf", type: "pdf", size: "4.2 MB" }],
      orderDate: input?.orderDate ?? todayISO(),
      dueDate: input?.dueDate ?? todayISO(),
      priority: input?.priority ?? "Urgent",
      isExpress: input?.isExpress ?? false,
      productionBranch: input?.productionBranch ?? "",
      acceptance: jobAcceptance,
      rejectReason: "",
      status: "New Order",
      assignedDesigner: input?.assignedDesigner ?? "Beam S.",
      assignedProduction: input?.assignedProduction ?? "Unassigned",
      price,
      deposit,
      remainingBalance: Math.max(price - deposit, 0),
      paymentStatus: getPaymentStatus(price, deposit),
      internalNotes: input?.internalNotes ?? "สร้างจากฟอร์มสร้างงาน",
      comments: [],
      statusHistory: [{ id: crypto.randomUUID(), from: "Created", to: "New Order", by: currentUser.name, at: new Date().toLocaleString("en-GB") }]
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
        .upsert({ id: profileId, email: authEmail, full_name: member.name, role: member.role, avatar_url: member.avatarUrl ?? null, is_active: true }, { onConflict: "id" })
        .select("id, email, full_name, role, avatar_url")
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

  async function updateTeamMember(memberId: string, updates: Pick<TeamMember, "name" | "role">) {
    const isOwnProfile = currentUser.id === memberId;
    if (!can("manage_users") && !isOwnProfile) {
      setDataError("บทบาทนี้ยังไม่มีสิทธิ์จัดการผู้ใช้");
      return;
    }
    const existingMember = teamMembers.find((member) => member.id === memberId);
    if (!existingMember) return;
    const safeUpdates = {
      name: updates.name,
      role: can("manage_users") ? updates.role : existingMember.role
    };
    if (supabase && uuidPattern.test(memberId)) {
      const { error } = await supabase.from("profiles").update({ full_name: safeUpdates.name, role: safeUpdates.role }).eq("id", memberId);
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

  async function addCustomer(customer: Omit<Customer, "id" | "totalOrders" | "lifetimeValue" | "lastOrderDate">) {
    if (!can("create_customer")) {
      setDataError("บทบาทนี้ยังไม่มีสิทธิ์เพิ่มลูกค้า");
      return;
    }
    if (supabase && isSupabaseConfigured) {
      const { data, error } = await supabase.from("customers").insert(customerInsertPayload(customer)).select("*").single();
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
      id: `c-${crypto.randomUUID()}`,
      totalOrders: 0,
      lifetimeValue: 0,
      lastOrderDate: "-"
    };
    setCustomerRecords((current) => [nextCustomer, ...current]);
    void appendAudit("created customer", nextCustomer.name, "customers");
  }

  async function updateCustomer(customerId: string, updates: Pick<Customer, "name" | "phone" | "lineId" | "email" | "companyName" | "taxId" | "branch" | "billingAddress" | "accountingEmail" | "requiresInvoice">) {
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
        <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
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

            <p className="mb-3 text-sm font-extrabold text-k2-muted">Demo roles</p>
            <div className="grid gap-3">
              {teamMembers.map((member) => (
                <button
                  key={member.id}
                  onClick={() => setCurrentUser(member)}
                  className={`flex items-center justify-between rounded-2xl border p-4 text-left transition ${
                    currentUser.id === member.id ? "border-violet-300 bg-violet-50/80" : "border-white/80 bg-white/55 hover:bg-white"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <MemberAvatar member={member} className="h-11 w-11 rounded-2xl text-sm" />
                    <span>
                      <span className="block font-semibold">{member.name}</span>
                      <span className="text-sm text-k2-muted">{roleLabel[member.role]}</span>
                    </span>
                  </span>
                  <ChevronRight className="h-5 w-5 text-k2-muted" />
                </button>
              ))}
            </div>
            <div className="mt-5 rounded-2xl bg-white/60 p-4">
              <p className="mb-2 text-sm font-semibold text-k2-muted">สิทธิ์การใช้งาน</p>
              <div className="flex flex-wrap gap-2">
                {roleSummaryPermissions[currentUser.role].map((permission) => (
                  <span key={permission} className="rounded-full bg-k2-mint px-3 py-1 text-xs font-semibold text-emerald-800">
                    {permissionLabel[permission] ?? permission}
                  </span>
                ))}
              </div>
            </div>
            <button
              onClick={() => setIsAuthed(true)}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-k2-ink px-5 py-4 font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5"
            >
              <ShieldCheck className="h-5 w-5" />
              เข้าสู่ระบบคิวงานแบบทดลอง
            </button>
          </motion.div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-3 py-3 text-k2-ink sm:px-5 sm:py-5">
      <div className="mx-auto flex max-w-[1800px] gap-4">
        <aside className="glass sticky top-5 hidden h-[calc(100vh-2.5rem)] w-72 shrink-0 rounded-[1.7rem] p-4 lg:block">
          <BrandBlock currentUser={currentUser} />
          <Nav activeView={activeView} items={navigationItems} onChange={setActiveView} />
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

                {/* สวิตช์เปิดรับงานด่วน — เฉพาะผู้จัดการ/เจ้าของ */}
                {canManageExpress ? (
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
                ) : expressOrdersEnabled ? (
                  <span className="inline-flex items-center gap-1.5 rounded-2xl bg-rose-100 px-3 py-2.5 text-sm font-bold text-rose-700">
                    <Zap className="h-4 w-4" />
                    รับงานด่วน
                  </span>
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

                <button
                  onClick={() => setActiveView("Create Job")}
                  disabled={!can("create_job")}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-k2-ink px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/15"
                >
                  <Plus className="h-4 w-4" />
                  สร้างงาน
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
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:hidden">
              {navigationItems.map(({ label: item }) => (
                <button
                  key={item}
                  onClick={() => setActiveView(item)}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${
                    activeView === item ? "bg-k2-ink text-white" : "bg-white/70 text-k2-muted"
                  }`}
                >
                  {viewLabel[item] ?? item}
                </button>
              ))}
            </div>
          </header>

          {dataLoading ? (
            <div className="mb-4 rounded-3xl border border-white/80 bg-white/70 px-5 py-3 text-sm font-extrabold text-k2-muted shadow-sm">
              กำลังโหลดข้อมูลจริงจาก Supabase...
            </div>
          ) : null}
          {dataError ? (
            <div className="mb-4 rounded-3xl border border-rose-100 bg-rose-50 px-5 py-3 text-sm font-extrabold text-rose-700 shadow-sm">
              {dataError}
            </div>
          ) : null}

          <AnimatePresence mode="wait">
            {activeView === "Dashboard" && (
              <motion.div key="dashboard" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <Dashboard metrics={metrics} jobs={filteredJobs} canSeeMoney={canSeeMoney} onSelect={(id) => {
                  setSelectedJobId(id);
                  setActiveView("Detail");
                }} />
              </motion.div>
            )}
            {activeView === "Board" && (
              <motion.div key="board" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <Board
                  jobs={filteredJobs}
                  draggedJobId={draggedJobId}
                  setDraggedJobId={setDraggedJobId}
                  moveJob={requestMove}
                  onAccept={acceptJob}
                  onReject={rejectJob}
                  canAccept={canAcceptJobs}
                  onSelect={(id) => {
                    setSelectedJobId(id);
                    setActiveView("Detail");
                  }}
                />
              </motion.div>
            )}
            {activeView === "Calendar" && (
              <motion.div key="calendar" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <CalendarView jobs={filteredJobs} onSelect={(id) => {
                  setSelectedJobId(id);
                  setActiveView("Detail");
                }} />
              </motion.div>
            )}
            {activeView === "Create Job" && (
              <motion.div key="create" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <CreateJobView customers={customerRecords} teamMembers={teamMembers} companyProfile={companyProfile} expressEnabled={expressOrdersEnabled} onCreate={createJob} />
              </motion.div>
            )}
            {activeView === "Customers" && (
              <motion.div key="customers" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <CustomersView
                  customers={customerRecords}
                  jobs={jobs}
                  canDelete={can("delete_customer")}
                  onAddCustomer={addCustomer}
                  onUpdateCustomer={updateCustomer}
                  onRemoveCustomer={removeCustomer}
                />
              </motion.div>
            )}
            {activeView === "Payments" && (
              <motion.div key="payments" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <PaymentsView jobs={filteredJobs} canSeeMoney={canSeeMoney} onSelect={(id) => {
                  setSelectedJobId(id);
                  setActiveView("Detail");
                }} />
              </motion.div>
            )}
            {activeView === "Reports" && (
              <motion.div key="reports" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <ReportsView jobs={jobs} canSeeMoney={canSeeMoney} />
              </motion.div>
            )}
            {activeView === "Settings" && (
              <motion.div key="settings" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
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
                  permissionMatrix={permissionMatrix}
                  onUpdateRolePermission={updateRolePermission}
                  onResetRolePermissions={resetRolePermissions}
                />
              </motion.div>
            )}
            {activeView === "Detail" && (
              <motion.div key="detail" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                {selectedJob ? (
                  <JobDetail job={selectedJob} companyProfile={companyProfile} canSeeMoney={canSeeMoney} canDeleteJob={can("delete_job")} onPayment={updatePayment} onComment={addComment} onMove={requestMove} onDelete={removeJob} />
                ) : (
                  <EmptyState title="ยังไม่มีงานในระบบ" text="เริ่มจากสร้างลูกค้าและสร้างงานแรกได้เลย" action={() => setActiveView("Create Job")} />
                )}
              </motion.div>
            )}
            {activeView === "Audit" && (
              <motion.div key="audit" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <AuditLog auditLog={auditLog} />
              </motion.div>
            )}
          </AnimatePresence>
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

    </main>
  );
}

function BrandBlock({ currentUser }: { currentUser: TeamMember }) {
  return (
    <div className="mb-6">
      <div className="mb-5 flex items-center gap-3">
        <KLogoMark className="h-[6.5rem] w-[6.5rem]" />
        <KLogoLockup size="sidebar" />
      </div>
      <div className="rounded-3xl bg-white/60 p-4">
        <div className="flex items-center gap-3">
          <MemberAvatar member={currentUser} className="h-10 w-10 rounded-2xl text-sm" />
          <div>
            <p className="font-semibold">{currentUser.name}</p>
            <p className="text-sm text-k2-muted">{roleLabel[currentUser.role]}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MemberAvatar({ member, className = "h-12 w-12 rounded-2xl text-sm" }: { member: TeamMember; className?: string }) {
  if (member.avatarUrl) {
    return (
      <Image
        src={member.avatarUrl}
        alt={member.name}
        width={96}
        height={96}
        unoptimized
        className={`${className} object-cover shadow-sm ring-2 ring-white/75`}
      />
    );
  }

  return (
    <span className={`grid place-items-center bg-k2-lilac font-extrabold text-violet-800 shadow-sm ring-2 ring-white/70 ${className}`}>
      {member.avatar}
    </span>
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
    <nav className="grid gap-2">
      {items.map(({ label, icon: Icon }) => (
        <button
          key={label}
          onClick={() => onChange(label)}
          className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
            activeView === label ? "bg-k2-ink text-white shadow-lg shadow-slate-900/15" : "text-k2-muted hover:bg-white/70"
          }`}
        >
          <Icon className="h-5 w-5" />
          {viewLabel[label] ?? label}
        </button>
      ))}
    </nav>
  );
}

function Dashboard({
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
}

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
  canAccept: boolean;
  onSelect: (id: string) => void;
}) {
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectText, setRejectText] = useState("");
  return (
    <div className="soft-scrollbar flex gap-4 overflow-x-auto pb-4">
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
                          รอผู้จัดการสาขายอมรับ{job.productionBranch ? ` · ${job.productionBranch}` : ""}
                        </p>
                        {canAccept ? (
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
                        {canAccept ? (
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
  );
}

function JobDetail({
  job,
  companyProfile,
  canSeeMoney,
  canDeleteJob,
  onPayment,
  onComment,
  onMove,
  onDelete
}: {
  job: Job;
  companyProfile: CompanyProfile;
  canSeeMoney: boolean;
  canDeleteJob: boolean;
  onPayment: (jobId: string, deposit: number) => void;
  onComment: (jobId: string, text: string) => void;
  onMove: (jobId: string, status: JobStatus) => void;
  onDelete: (jobId: string) => void;
}) {
  const [comment, setComment] = useState("");
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
          <h4 className="mb-4 font-semibold">ไฟล์แนบ</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            {job.files.map((file) => (
              <div key={file.id} className="flex items-center gap-3 rounded-2xl bg-white p-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-k2-sky">
                  <FileImage className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">{file.name}</p>
                  <p className="text-sm text-k2-muted">{file.type.toUpperCase()} - {file.size}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <aside className="space-y-4">
        <section className="glass rounded-[1.5rem] p-5">
          <h4 className="mb-4 text-xl font-semibold">การชำระเงิน</h4>
          <div className="grid gap-3">
            <MoneyLine label="ราคารวม" value={job.price} visible={canSeeMoney} />
            <MoneyLine label="มัดจำ" value={job.deposit} visible={canSeeMoney} />
            <MoneyLine label="ยอดคงเหลือ" value={job.remainingBalance} visible={canSeeMoney} />
          </div>
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-white/70 p-3">
            <span className="font-semibold">สถานะชำระเงิน</span>
            <span className="rounded-full bg-k2-mint px-3 py-1 text-xs font-bold text-emerald-800">{paymentLabel[job.paymentStatus]}</span>
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
  const subtotal = job.price;
  const vat = subtotal * 0.07;
  const total = subtotal + vat;
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
                <p className="font-bold">รายละเอียดงาน :</p>
                <p>{job.title}</p>
                <p className="mt-1 text-sm text-slate-600">{job.description}</p>
              </td>
              <td className="border border-slate-300 px-3 py-3">{job.quantity}</td>
              <td className="border border-slate-300 px-3 py-3">{plainMoneyText(unitPrice)}</td>
              <td className="border border-slate-300 px-3 py-3">-</td>
              <td className="border border-slate-300 px-3 py-3">7%</td>
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
              ["มูลค่าที่ไม่มี/ยกเว้นภาษี", 0],
              ["มูลค่าที่คำนวณภาษี", subtotal],
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

function CreateJobView({
  customers,
  teamMembers,
  companyProfile,
  expressEnabled,
  onCreate
}: {
  customers: Customer[];
  teamMembers: TeamMember[];
  companyProfile: CompanyProfile;
  expressEnabled: boolean;
  onCreate: (job: Partial<Job>) => void;
}) {
  const designerOptions = useMemo(() => teamMembers.filter((member) => ["Designer", "Admin", "Owner"].includes(member.role)), [teamMembers]);
  const productionOptions = useMemo(() => teamMembers.filter((member) => ["Production Staff", "Admin", "Owner"].includes(member.role)), [teamMembers]);
  const defaultDesigner = designerOptions[0]?.name ?? "Unassigned";
  const defaultProduction = productionOptions[0]?.name ?? "Unassigned";
  // ฟอร์มสร้างงานเริ่มจากค่าว่างเสมอ เพื่อไม่ให้ข้อมูลจากงานก่อนหน้าค้างมาทำให้สร้างออเดอร์ผิด/ซ้ำ
  const [form, setForm] = useState({
    customerId: "new",
    customerName: "",
    phone: "",
    lineId: "",
    companyName: "",
    taxId: "",
    branch: "สำนักงานใหญ่",
    billingAddress: "",
    accountingEmail: "",
    requiresInvoice: false,
    title: "",
    type: "DTG Shirt" as JobType,
    description: "",
    quantity: 1,
    orderDate: todayISO(),
    dueDate: addDaysISO(todayISO(), DEFAULT_LEAD_TIME_DAYS),
    isExpress: false,
    priority: "Normal" as Priority,
    assignedDesigner: defaultDesigner,
    assignedProduction: defaultProduction,
    price: 0,
    deposit: 0,
    internalNotes: "",
    fileName: "",
    sourceChannel: "LINE",
    facebookPage: companyProfile.facebookPages[0] ?? "",
    fileStatus: "รอเช็กไฟล์",
    materials: [""] as string[],
    colorSpec: "",
    productionBranch: "พะเยา",
    deliveryMethod: "รับหน้าร้าน",
    deliveryOther: ""
  });

  const [formError, setFormError] = useState("");
  const [lookupMsg, setLookupMsg] = useState("");

  function setField<Key extends keyof typeof form>(key: Key, value: (typeof form)[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const materialOptions = ["อะคริลิค", "พลาสวูด", "ไวนิล", "สติ๊กเกอร์", "เสื้อ Cotton", "อื่น ๆ"];
  const branchOptions = ["พะเยา", "กรุงเทพ"];
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
      assignedDesigner: designerOptions.some((member) => member.name === current.assignedDesigner) ? current.assignedDesigner : defaultDesigner,
      assignedProduction: productionOptions.some((member) => member.name === current.assignedProduction) || current.assignedProduction === "Unassigned"
        ? current.assignedProduction
        : defaultProduction
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamMembers]);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        // ลูกค้าใหม่ต้องมีชื่อ เพื่อไม่ให้เกิดเรคคอร์ด "ลูกค้าใหม่" ค้างในระบบ
        if (form.customerId === "new" && !form.customerName.trim()) {
          setFormError("กรุณากรอกชื่อลูกค้า หรือเลือกลูกค้าเดิมจากช่องค้นหา");
          return;
        }
        setFormError("");
        const workOrderSpec = [
          `ช่องทางรับงาน: ${form.sourceChannel || "-"}`,
          ...(form.sourceChannel === "Facebook" ? [`เพจ Facebook: ${form.facebookPage || "-"}`] : []),
          `สถานะไฟล์: ${form.fileStatus || "-"}`,
          `วัสดุ: ${form.materials.filter(Boolean).join(", ") || "-"}`,
          `สี / สเปกสี: ${form.colorSpec || "-"}`,
          `สาขาที่ผลิต: ${form.productionBranch || "-"}`,
          `วิธีรับ/จัดส่ง: ${form.deliveryMethod === "ขนส่งอื่น ๆ" && form.deliveryOther ? `${form.deliveryMethod} (${form.deliveryOther})` : form.deliveryMethod || "-"}`
        ].join("\n");
        onCreate({
          ...form,
          description: `${form.description}\n\nสเปกใบสั่งงาน:\n${workOrderSpec}`,
          internalNotes: `${form.internalNotes}\n\nข้อมูลฝ่ายผลิต:\n${workOrderSpec}`,
          assignedDesigner: designerOptions.some((member) => member.name === form.assignedDesigner) ? form.assignedDesigner : defaultDesigner,
          assignedProduction: productionOptions.some((member) => member.name === form.assignedProduction) || form.assignedProduction === "Unassigned"
            ? form.assignedProduction
            : defaultProduction,
          files: form.fileName
            ? [{ id: crypto.randomUUID(), name: form.fileName, type: "pdf", size: "ไฟล์ตัวอย่าง" }]
            : []
        });
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
          {form.sourceChannel === "Facebook" ? (
            <label className="space-y-2">
              <span className="text-sm font-semibold text-k2-muted">ชื่อเพจ Facebook</span>
              <select
                value={form.facebookPage}
                onChange={(event) => setField("facebookPage", event.target.value)}
                className="w-full rounded-2xl border border-white/80 bg-white/80 px-4 py-3 outline-none"
              >
                {companyProfile.facebookPages.length ? (
                  companyProfile.facebookPages.map((pageName) => (
                    <option key={pageName} value={pageName}>{pageName}</option>
                  ))
                ) : (
                  <option value="">ยังไม่มีเพจในระบบ</option>
                )}
              </select>
              {!companyProfile.facebookPages.length ? (
                <p className="text-xs font-bold text-amber-700">ไปที่ตั้งค่า แล้วเพิ่มเพจ Facebook ก่อนใช้งานช่องนี้</p>
              ) : null}
            </label>
          ) : null}
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
                <span className="text-xs font-semibold text-k2-muted">(ผู้จัดการ/เจ้าของยังไม่เปิดรับงานด่วน)</span>
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
          <NumberField label="ราคา" value={form.price} onChange={(value) => setField("price", value)} />
          <NumberField label="มัดจำ" value={form.deposit} onChange={(value) => setField("deposit", value)} />
          <TextField label="ไฟล์ / รูปแนบ" value={form.fileName} onChange={(value) => setField("fileName", value)} />
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
              <span className="text-sm font-semibold text-k2-muted">สาขาที่ผลิต</span>
              <select
                value={form.productionBranch}
                onChange={(event) => setField("productionBranch", event.target.value)}
                className="w-full rounded-2xl border border-white/80 bg-white/80 px-4 py-3 outline-none"
              >
                {branchOptions.map((branch) => (
                  <option key={branch}>{branch}</option>
                ))}
              </select>
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
          <span className="text-sm font-semibold text-k2-muted">รายละเอียดงาน</span>
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
            <MiniStat label="สถานะแรก" value={statusLabel["New Order"]} />
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

function PaymentsView({
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
}

function ReportsView({ jobs, canSeeMoney }: { jobs: Job[]; canSeeMoney: boolean }) {
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
}

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
  onUpdateMember: (memberId: string, updates: Pick<TeamMember, "name" | "role">) => void;
  onUpdateMemberAvatar: (memberId: string, avatarUrl: string) => void;
  onRemoveMember: (memberId: string) => void;
  permissionMatrix: Record<Role, PermissionKey[]>;
  onUpdateRolePermission: (role: Role, permission: PermissionKey, enabled: boolean) => void;
  onResetRolePermissions: () => void;
}) {
  const currentPermissions = permissionMatrix[currentRole] ?? [];
  const canManageTeam = currentPermissions.includes("manage_users");
  const canManagePermissions = currentPermissions.includes("manage_permissions");
  const canManageCompany = currentPermissions.includes("manage_company_settings");
  const [newMember, setNewMember] = useState({ name: "", username: "", password: "", role: "Designer" as Role });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingMember, setEditingMember] = useState({ name: "", role: "Designer" as Role });
  const [companyDraft, setCompanyDraft] = useState(companyProfile);
  const [facebookPageName, setFacebookPageName] = useState("");
  const [avatarError, setAvatarError] = useState("");

  useEffect(() => {
    setCompanyDraft(companyProfile);
  }, [companyProfile]);

  function startEditing(member: TeamMember) {
    setEditingId(member.id);
    setEditingMember({ name: member.name, role: member.role });
  }

  function submitNewMember() {
    const username = normalizeUsername(newMember.username);
    if (!newMember.name.trim() || !username || !canManageTeam) return;
    onAddMember({ name: newMember.name.trim(), username, password: newMember.password, role: newMember.role });
    setNewMember({ name: "", username: "", password: "", role: "Designer" });
  }

  function submitEdit(memberId: string) {
    if (!editingMember.name.trim() || (!canManageTeam && memberId !== currentUserId)) return;
    onUpdateMember(memberId, { name: editingMember.name.trim(), role: editingMember.role });
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

        <div className="mt-5 grid gap-3 rounded-[1.35rem] border border-white/70 bg-white/45 p-3 md:grid-cols-2 xl:grid-cols-[1fr_180px_180px_180px_auto]">
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
            const canEditThisMember = canManageTeam || member.id === currentUserId;
            const canEditThisRole = canManageTeam;
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
                    </div>
                  ) : (
                    <div>
                      <p className="font-extrabold">{member.name}</p>
                      {member.username ? <p className="mt-1 text-xs font-extrabold text-teal-600">@{member.username}</p> : null}
                      <p className="mt-1 text-sm font-semibold text-k2-muted">{roleLabel[member.role]}</p>
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

function CalendarView({ jobs, onSelect }: { jobs: Job[]; onSelect: (id: string) => void }) {
  const grouped = statuses
    .flatMap(() => jobs)
    .filter((job, index, all) => all.findIndex((item) => item.id === job.id) === index)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .reduce<Record<string, Job[]>>((acc, job) => {
      acc[job.dueDate] = [...(acc[job.dueDate] ?? []), job];
      return acc;
    }, {});

  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
      {Object.entries(grouped).map(([date, dateJobs]) => (
        <section key={date} className="glass rounded-[1.5rem] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-semibold">{date}</h3>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold">{dateJobs.length} งาน</span>
          </div>
          <div className="space-y-3">
            {dateJobs.map((job) => (
              <button key={job.id} onClick={() => onSelect(job.id)} className="w-full rounded-2xl bg-white/65 p-4 text-left hover:bg-white">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-bold">{job.id}</span>
                  <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${priorityClass[job.priority]}`}>{priorityLabel[job.priority]}</span>
                </div>
                <p className="font-semibold">{job.title}</p>
                <p className="text-sm text-k2-muted">{job.customerName} - {statusLabel[job.status]}</p>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function CustomersView({
  customers,
  jobs,
  canDelete,
  onAddCustomer,
  onUpdateCustomer,
  onRemoveCustomer
}: {
  customers: Customer[];
  jobs: Job[];
  canDelete: boolean;
  onAddCustomer: (customer: Omit<Customer, "id" | "totalOrders" | "lifetimeValue" | "lastOrderDate">) => void;
  onUpdateCustomer: (customerId: string, updates: Pick<Customer, "name" | "phone" | "lineId" | "email" | "companyName" | "taxId" | "branch" | "billingAddress" | "accountingEmail" | "requiresInvoice">) => void;
  onRemoveCustomer: (customerId: string) => void;
}) {
  const [customerQuery, setCustomerQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", lineId: "", email: "", companyName: "", taxId: "", branch: "สำนักงานใหญ่", billingAddress: "", accountingEmail: "", requiresInvoice: false });
  const [editingCustomer, setEditingCustomer] = useState({ name: "", phone: "", lineId: "", email: "", companyName: "", taxId: "", branch: "สำนักงานใหญ่", billingAddress: "", accountingEmail: "", requiresInvoice: false });
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
      requiresInvoice: customer.requiresInvoice ?? false
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
      requiresInvoice: newCustomer.requiresInvoice
    });
    setNewCustomer({ name: "", phone: "", lineId: "", email: "", companyName: "", taxId: "", branch: "สำนักงานใหญ่", billingAddress: "", accountingEmail: "", requiresInvoice: false });
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
      requiresInvoice: editingCustomer.requiresInvoice
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
          <textarea
            value={newCustomer.billingAddress}
            onChange={(event) => setNewCustomer((current) => ({ ...current, billingAddress: event.target.value }))}
            placeholder="ที่อยู่ใบกำกับ / ใบเสร็จ"
            className="min-h-20 rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-semibold outline-none md:col-span-2 xl:col-span-5"
          />
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
                  </div>
                ) : (
                  <>
                    <h3 className="break-words text-2xl font-semibold">{customer.name}</h3>
                    <p className="mt-1 text-k2-muted">{customer.phone || "ไม่มีเบอร์โทร"} - LINE {customer.lineId || "-"}</p>
                    <p className="text-k2-muted">{customer.email || "ยังไม่มีอีเมล"}</p>
                    <p className="mt-2 rounded-2xl bg-white/55 px-3 py-2 text-sm font-semibold text-k2-muted">
                      {customer.companyName || "ยังไม่มีข้อมูลบริษัท"} {customer.taxId ? `| Tax ID ${customer.taxId}` : ""} {customer.requiresInvoice ? "| ต้องออกเอกสาร" : ""}
                    </p>
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
            <div className="mt-5 grid grid-cols-3 gap-3">
              <MiniStat label="ออเดอร์" value={customer.totalOrders} />
              <MiniStat label="มูลค่า" value={money.format(customer.lifetimeValue)} />
              <MiniStat label="งานเปิด" value={customerJobs.filter((job) => !["Completed", "Cancelled"].includes(job.status)).length} />
            </div>
            <div className="mt-5 space-y-3">
              {customerJobs.map((job) => (
                <div key={job.id} className="rounded-2xl bg-white/65 p-3">
                  <p className="font-semibold">{job.id} - {job.title}</p>
                  <p className="text-sm text-k2-muted">{statusLabel[job.status]} - กำหนดส่ง {job.dueDate}</p>
                </div>
              ))}
              {customerJobs.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/90 bg-white/45 p-3 text-sm font-semibold text-k2-muted">
                  ยังไม่มีประวัติงานของลูกค้าคนนี้
                </div>
              ) : null}
            </div>
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

function AuditLog({ auditLog }: { auditLog: AuditEvent[] }) {
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
}
