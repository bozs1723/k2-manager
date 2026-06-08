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
  | "Designer"
  | "Production Staff"
  | "Packing Staff"
  | "Sales Staff";

export type JobType = "DTG Shirt" | "UV Print" | "Laser Cut" | "Signage" | "3D Print" | "Other";
export type Priority = "Normal" | "Urgent" | "Very Urgent" | "Today";
export type PaymentStatus = "unpaid" | "partial" | "paid";
export type QuoteStatus = "draft" | "sent" | "approved" | "expired";

export type JobStatus =
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

export type Attendance = {
  id: string;
  profileId: string;
  workDate: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  checkInSelfie: string | null;
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
  acceptance?: "pending" | "accepted" | "rejected";
  rejectReason?: string;
  status: JobStatus;
  assignedDesigner: string;
  assignedProduction: string;
  price: number;
  deposit: number;
  depositSlip?: string;
  depositReceivedDate?: string;
  depositConfirmed?: boolean;
  depositConfirmedBy?: string;
  depositWaived?: boolean;
  remainingBalance: number;
  paymentStatus: PaymentStatus;
  internalNotes: string;
  comments: Comment[];
  statusHistory: StatusEvent[];
};
