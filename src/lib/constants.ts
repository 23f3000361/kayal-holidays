// Plain constants shared by the database schema, server code and client components.
export const ROLES = ["admin", "editor", "consultant", "traveller"] as const;
export type Role = (typeof ROLES)[number];

export const CHANNELS = ["web", "chat", "whatsapp", "email", "phone"] as const;
export type Channel = (typeof CHANNELS)[number];

export const STATUSES = ["new", "replied", "quoted", "booked", "lost", "spam"] as const;
export type EnquiryStatus = (typeof STATUSES)[number];
