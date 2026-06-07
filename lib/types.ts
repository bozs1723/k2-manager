export type AppNotification = {
  id: string;
  type: "assigned" | "status_moved" | "comment" | "due_soon";
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
  totalOrders: number;
  lifetimeValue: number;
  lastOrderDate: string;
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
  remainingBalance: number;
  paymentStatus: PaymentStatus;
  internalNotes: string;
  comments: Comment[];
  statusHistory: StatusEvent[];
};
