import type { AuditEvent, Customer, Job, JobStatus, TeamMember } from "./types";

// สถานะที่แสดงบน UI (บอร์ด/dropdown) — ระบบผลิตอย่างเดียว: สร้างงานได้เฉพาะงานที่มัดจำแล้ว
// สถานะการเงินเก่า (Quotation / Waiting Deposit / Verifying Payment / Deposit Confirmed)
// ยังอยู่ใน enum JobStatus สำหรับงานเก่าใน DB แต่ไม่แสดงเป็นคอลัมน์/ตัวเลือกอีก
export const statuses: JobStatus[] = [
  "New Order",
  "Waiting for File",
  "Designing",
  "Waiting for Customer Approval",
  "Ready for Production",
  "In Production",
  "QC",
  "Packing",
  "Delivered / Picked Up",
  "Completed",
  "Cancelled"
];

export const team: TeamMember[] = [
  { id: "u1", name: "Kanda R.", role: "Owner", avatar: "KR" },
  { id: "u7", name: "Nop Manager", role: "Manager", avatar: "NM" },
  { id: "u2", name: "Mina P.", role: "Admin", avatar: "MP" },
  { id: "u3", name: "Beam S.", role: "Designer", avatar: "BS" },
  { id: "u4", name: "Art T.", role: "Production Staff", avatar: "AT" },
  { id: "u5", name: "June L.", role: "Packing Staff", avatar: "JL" },
  { id: "u6", name: "May C.", role: "Sales Staff", avatar: "MC" }
];

export const customers: Customer[] = [
  {
    id: "c1",
    name: "Baan Bloom Cafe",
    phone: "089-442-1188",
    lineId: "@baanbloom",
    email: "orders@baanbloom.example",
    totalOrders: 14,
    lifetimeValue: 188400,
    lastOrderDate: "2026-05-27"
  },
  {
    id: "c2",
    name: "Peak Studio",
    phone: "082-113-9981",
    lineId: "peakstudio",
    email: "team@peakstudio.example",
    totalOrders: 7,
    lifetimeValue: 79200,
    lastOrderDate: "2026-05-24"
  },
  {
    id: "c3",
    name: "KMITL Robotics Club",
    phone: "091-245-6630",
    lineId: "kmitlbot",
    email: "robotics@example.edu",
    totalOrders: 5,
    lifetimeValue: 43600,
    lastOrderDate: "2026-05-30"
  },
  {
    id: "c4",
    name: "Nara Wedding",
    phone: "086-774-2110",
    lineId: "nara.n",
    email: "nara@example.com",
    totalOrders: 3,
    lifetimeValue: 58100,
    lastOrderDate: "2026-05-22"
  }
];

export const initialJobs: Job[] = [
  {
    id: "K2-1028",
    customerId: "c1",
    customerName: "Baan Bloom Cafe",
    phone: "089-442-1188",
    lineId: "@baanbloom",
    title: "เสื้อพนักงานคาเฟ่ DTG รอบเติมสต็อก",
    type: "DTG Shirt",
    description: "เสื้อ cotton สีครีม พิมพ์โลโก้ด้านหน้าและสโลแกนเล็กด้านหลัง ต้องส่ง proof สีให้ลูกค้าก่อนผลิต",
    quantity: 60,
    files: [
      { id: "f1", name: "logo-final.png", type: "image", size: "2.4 MB" },
      { id: "f2", name: "shirt-layout.pdf", type: "pdf", size: "1.1 MB" }
    ],
    orderDate: "2026-05-28",
    dueDate: "2026-05-30",
    priority: "Today",
    status: "Designing",
    assignedDesigner: "Beam S.",
    assignedProduction: "Art T.",
    price: 27000,
    deposit: 12000,
    remainingBalance: 15000,
    paymentStatus: "partial",
    internalNotes: "ลูกค้าชอบหมึกเขียวโทนอ่อน ไม่สดเกินไป",
    comments: [
      { id: "cm1", by: "May C.", at: "2026-05-29 10:15", text: "ลูกค้ายืนยันไซซ์เสื้อทาง LINE แล้ว" }
    ],
    statusHistory: [
      { id: "sh1", from: "Created", to: "New Order", by: "May C.", at: "2026-05-28 11:04" },
      { id: "sh2", from: "New Order", to: "Designing", by: "Mina P.", at: "2026-05-28 14:20" }
    ]
  },
  {
    id: "K2-1029",
    customerId: "c2",
    customerName: "Peak Studio",
    phone: "082-113-9981",
    lineId: "peakstudio",
    title: "ป้าย QR อะคริลิกตั้งโต๊ะ",
    type: "UV Print",
    description: "ป้ายอะคริลิกใสตั้งโต๊ะ พิมพ์ UV เป็น QR และ branding ของสตูดิโอ",
    quantity: 35,
    files: [{ id: "f3", name: "qr-signs.ai", type: "ai", size: "6.8 MB" }],
    orderDate: "2026-05-26",
    dueDate: "2026-06-02",
    priority: "Normal",
    status: "Waiting for Customer Approval",
    assignedDesigner: "Beam S.",
    assignedProduction: "Art T.",
    price: 17500,
    deposit: 8000,
    remainingBalance: 9500,
    paymentStatus: "partial",
    internalNotes: "ส่ง proof แล้ว รอลูกค้ายืนยัน URL ปลายทางของ QR",
    comments: [
      { id: "cm2", by: "Beam S.", at: "2026-05-29 16:41", text: "ส่ง proof V2 แล้ว เพิ่มพื้นที่ว่างรอบ QR ให้สแกนง่ายขึ้น" }
    ],
    statusHistory: [
      { id: "sh3", from: "Created", to: "New Order", by: "May C.", at: "2026-05-26 09:30" },
      { id: "sh4", from: "Designing", to: "Waiting for Customer Approval", by: "Beam S.", at: "2026-05-29 16:45" }
    ]
  },
  {
    id: "K2-1030",
    customerId: "c3",
    customerName: "KMITL Robotics Club",
    phone: "091-245-6630",
    lineId: "kmitlbot",
    title: "ขายึดหุ่นยนต์แข่ง",
    type: "3D Print",
    description: "ขายึด PETG infill สูง ต้องพิมพ์ข้ามคืนและตรวจคุณภาพตอนเช้า",
    quantity: 24,
    files: [{ id: "f4", name: "bracket-stl-pack.zip", type: "zip", size: "18 MB" }],
    orderDate: "2026-05-30",
    dueDate: "2026-05-31",
    priority: "Very Urgent",
    status: "In Production",
    assignedDesigner: "Mina P.",
    assignedProduction: "Art T.",
    price: 9600,
    deposit: 9600,
    remainingBalance: 0,
    paymentStatus: "paid",
    internalNotes: "ใช้ PETG สีดำ เก็บชิ้นที่พิมพ์เสียไว้ทำรายงานวัสดุ",
    comments: [
      { id: "cm3", by: "Art T.", at: "2026-05-30 12:10", text: "เริ่มพิมพ์เครื่อง 2 แล้ว คาดว่าเสร็จ 20:30" }
    ],
    statusHistory: [
      { id: "sh5", from: "Created", to: "New Order", by: "Kanda R.", at: "2026-05-30 08:40" },
      { id: "sh6", from: "Ready for Production", to: "In Production", by: "Art T.", at: "2026-05-30 12:05" }
    ]
  },
  {
    id: "K2-1031",
    customerId: "c4",
    customerName: "Nara Wedding",
    phone: "086-774-2110",
    lineId: "nara.n",
    title: "เลขโต๊ะเลเซอร์คัต",
    type: "Laser Cut",
    description: "เลขโต๊ะอะคริลิกทอง 1-28 พร้อมฐานตั้ง",
    quantity: 28,
    files: [{ id: "f5", name: "numbers-layout.pdf", type: "pdf", size: "940 KB" }],
    orderDate: "2026-05-22",
    dueDate: "2026-05-29",
    priority: "Urgent",
    status: "QC",
    assignedDesigner: "Beam S.",
    assignedProduction: "Art T.",
    price: 12600,
    deposit: 6000,
    remainingBalance: 6600,
    paymentStatus: "partial",
    internalNotes: "ตรวจรอยขีดข่วนบนอะคริลิกเงาก่อนแพ็ก",
    comments: [
      { id: "cm4", by: "June L.", at: "2026-05-30 09:25", text: "ฐาน 2 ชิ้นต้องตัดใหม่ก่อนลงกล่อง" }
    ],
    statusHistory: [
      { id: "sh7", from: "Created", to: "New Order", by: "May C.", at: "2026-05-22 13:00" },
      { id: "sh8", from: "In Production", to: "QC", by: "Art T.", at: "2026-05-30 09:10" }
    ]
  },
  {
    id: "K2-1032",
    customerId: "c1",
    customerName: "Baan Bloom Cafe",
    phone: "089-442-1188",
    lineId: "@baanbloom",
    title: "บอร์ดเมนู Outdoor",
    type: "Signage",
    description: "บอร์ดเมนูกันแดดกันฝน พร้อมรายการ brunch ที่อัปเดตใหม่",
    quantity: 2,
    files: [{ id: "f6", name: "menu-copy.docx", type: "pdf", size: "320 KB" }],
    orderDate: "2026-05-29",
    dueDate: "2026-06-05",
    priority: "Normal",
    status: "Waiting for File",
    assignedDesigner: "Beam S.",
    assignedProduction: "Unassigned",
    price: 22000,
    deposit: 0,
    remainingBalance: 22000,
    paymentStatus: "unpaid",
    internalNotes: "รอรูปอาหาร final จากลูกค้า",
    comments: [],
    statusHistory: [{ id: "sh9", from: "Created", to: "Waiting for File", by: "May C.", at: "2026-05-29 15:24" }]
  },
  {
    id: "K2-1033",
    customerId: "c2",
    customerName: "Peak Studio",
    phone: "082-113-9981",
    lineId: "peakstudio",
    title: "ฉากหลังงานอีเวนต์โฟมบอร์ด",
    type: "Signage",
    description: "แผ่นฉากหลังอีเวนต์ขนาดใหญ่ ผิวด้าน",
    quantity: 4,
    files: [{ id: "f7", name: "backdrop-print-ready.pdf", type: "pdf", size: "24 MB" }],
    orderDate: "2026-05-20",
    dueDate: "2026-05-27",
    priority: "Urgent",
    status: "Completed",
    assignedDesigner: "Mina P.",
    assignedProduction: "Art T.",
    price: 34000,
    deposit: 34000,
    remainingBalance: 0,
    paymentStatus: "paid",
    internalNotes: "จัดส่งที่จุดโหลดของ BITEC แล้ว",
    comments: [],
    statusHistory: [{ id: "sh10", from: "Delivered / Picked Up", to: "Completed", by: "Kanda R.", at: "2026-05-27 18:20" }]
  }
];

export const initialAuditLog: AuditEvent[] = [
  { id: "a1", actor: "Mina P.", action: "assigned designer", target: "K2-1028", at: "2026-05-28 14:20" },
  { id: "a2", actor: "Beam S.", action: "moved status to approval", target: "K2-1029", at: "2026-05-29 16:45" },
  { id: "a3", actor: "Art T.", action: "updated production start", target: "K2-1030", at: "2026-05-30 12:05" },
  { id: "a4", actor: "June L.", action: "added QC note", target: "K2-1031", at: "2026-05-30 09:25" }
];
