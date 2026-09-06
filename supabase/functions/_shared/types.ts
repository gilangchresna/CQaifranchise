/**
 * Shared TypeScript types for CyberQuote Supabase Edge Functions
 */

// =============================================================================
// ENUMS
// =============================================================================

export enum UserRole {
  HQ_ADMIN = "HQ_ADMIN",
  REGIONAL_MANAGER = "REGIONAL_MANAGER",
  FRANCHISEE_OWNER = "FRANCHISEE_OWNER",
}

export enum AlertStatus {
  NEW = "NEW",
  ACKNOWLEDGED = "ACKNOWLEDGED",
  IN_PROGRESS = "IN_PROGRESS",
  RESOLVED = "RESOLVED",
  CLOSED = "CLOSED",
}

export enum AlertSeverity {
  P0_CRITICAL = "P0_CRITICAL",
  P1_HIGH = "P1_HIGH",
  P2_MEDIUM = "P2_MEDIUM",
  P3_LOW = "P3_LOW",
}

export enum AlertType {
  SALES_ANOMALY = "SALES_ANOMALY",
  STOCKOUT_RISK = "STOCKOUT_RISK",
  ATTENDANCE_ISSUE = "ATTENDANCE_ISSUE",
  COMPLAINT = "COMPLAINT",
}

export enum OutletStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  SUSPENDED = "SUSPENDED",
}

// =============================================================================
// WEBHOOK PAYLOAD TYPES
// =============================================================================

export interface WebhookItem {
  sku: string;
  name?: string;
  quantity: number;
  unit_price: number;
  subtotal?: number;
}

export interface WebhookPayload {
  outlet_id: number;
  transaction_id: string;
  amount: number;
  items: WebhookItem[];
  timestamp: string;
  currency?: string;
}

export interface WebhookResponse {
  status: "ok" | "created" | "error";
  message: string;
  transaction_id?: number;
  is_duplicate: boolean;
}

// =============================================================================
// CSV UPLOAD TYPES
// =============================================================================

export interface CSVTransactionRow {
  outlet_id: number;
  transaction_id: string;
  amount: number;
  items?: string; // JSON string
  timestamp: string;
  currency?: string;
}

export interface CSVUploadPayload {
  transactions: CSVTransactionRow[];
}

export interface CSVUploadResponse {
  status: "ok" | "error";
  message: string;
  total_rows: number;
  inserted_count: number;
  duplicate_count: number;
  error_count: number;
  errors?: string[];
}

// =============================================================================
// DATABASE TYPES (matching PostgreSQL schema)
// =============================================================================

export interface Region {
  id: number;
  name: string;
  code: string;
  created_at: string;
}

export interface Outlet {
  id: number;
  region_id: number;
  franchisee_id: number;
  name: string;
  code: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  status: OutletStatus;
  created_at: string;
  updated_at: string;
}

export interface SalesTransaction {
  id: number;
  transaction_id: string;
  outlet_id: number;
  date: string;
  amount: number;
  transaction_count: number;
  items?: string; // JSON string
  anomaly_score?: number;
  is_anomaly: boolean;
  created_at: string;
}

// =============================================================================
// API ERROR TYPES
// =============================================================================

export interface APIError {
  error: string;
  message: string;
  status: number;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

export function validateWebhookPayload(data: unknown): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];
  
  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["Invalid payload format"] };
  }
  
  const payload = data as Record<string, unknown>;
  
  // Required fields
  if (typeof payload.outlet_id !== "number" || !Number.isInteger(payload.outlet_id)) {
    errors.push("outlet_id must be an integer");
  }
  
  if (typeof payload.transaction_id !== "string" || payload.transaction_id.trim().length === 0) {
    errors.push("transaction_id must be a non-empty string");
  }
  
  if (typeof payload.amount !== "number" || payload.amount < 0) {
    errors.push("amount must be a non-negative number");
  }
  
  if (!payload.timestamp || typeof payload.timestamp !== "string") {
    errors.push("timestamp must be a valid ISO 8601 string");
  }
  
  // Validate items array
  if (payload.items !== undefined) {
    if (!Array.isArray(payload.items)) {
      errors.push("items must be an array");
    } else {
      payload.items.forEach((item, index) => {
        if (!item.sku || typeof item.sku !== "string") {
          errors.push(`items[${index}].sku must be a string`);
        }
        if (typeof item.quantity !== "number" || item.quantity < 1) {
          errors.push(`items[${index}].quantity must be a positive integer`);
        }
        if (typeof item.unit_price !== "number" || item.unit_price < 0) {
          errors.push(`items[${index}].unit_price must be a non-negative number`);
        }
      });
    }
  }
  
  return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
}

export function parseItemsToJSON(items: WebhookItem[]): string | null {
  if (!items || items.length === 0) {
    return null;
  }
  
  const itemsData = items.map((item) => ({
    sku: item.sku,
    name: item.name || null,
    quantity: item.quantity,
    unit_price: item.unit_price,
    subtotal: item.subtotal ?? item.quantity * item.unit_price,
  }));
  
  return JSON.stringify(itemsData);
}

export function isValidTimestamp(timestamp: string): boolean {
  const date = new Date(timestamp);
  return !isNaN(date.getTime());
}

// =============================================================================
// NOTIFICATION TYPES
// =============================================================================

export enum NotificationChannel {
  WHATSAPP = "WHATSAPP",
  EMAIL = "EMAIL",
  PUSH = "PUSH",
}

export enum NotificationStatus {
  PENDING = "PENDING",
  SENT = "SENT",
  DELIVERED = "DELIVERED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
}

export interface Notification {
  id: number;
  alert_id: number;
  recipient_id: number;
  channel: NotificationChannel;
  priority: AlertSeverity;
  status: NotificationStatus;
  external_id?: string;
  message?: string;
  error_details?: string;
  sent_at?: string;
  delivered_at?: string;
  created_at: string;
  updated_at: string;
}

export interface NotificationRequest {
  alert_id: number;
  channel: NotificationChannel;
  priority_override?: AlertSeverity;
}

export interface NotificationResponse {
  notification_id: number;
  status: NotificationStatus;
  sent_at: string;
  recipient: { id: number; name: string };
  channel: NotificationChannel;
}

// =============================================================================
// CASE TYPES
// =============================================================================

export interface Case {
  id: number;
  alert_id: number;
  assigned_to_id?: number;
  title: string;
  description?: string;
  priority: AlertSeverity;
  status: AlertStatus;
  sla_deadline?: string;
  resolution_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CaseCreateRequest {
  alert_id: number;
  title: string;
  description?: string;
  assigned_to_id?: number;
  priority?: AlertSeverity;
}

export interface CaseCreateResponse {
  case_id: number;
  alert_id: number;
  status: AlertStatus;
  priority: AlertSeverity;
  sla_deadline: string;
  created_at: string;
}

// =============================================================================
// ALERT TYPES
// =============================================================================

export interface Alert {
  id: number;
  outlet_id: number;
  type: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  description?: string;
  score?: number;
  triggered_at: string;
  acknowledged_at?: string;
  resolved_at?: string;
  created_at: string;
  notification_count?: number;
}

export interface AlertWithRelations extends Alert {
  outlet?: Outlet & { regions?: Region };
  cases?: Case[];
}

export interface AlertUpdateRequest {
  alert_id: number;
  new_status: AlertStatus;
  resolution_notes?: string;
}

export interface AlertUpdateResponse {
  alert_id: number;
  previous_status: AlertStatus;
  new_status: AlertStatus;
  resolved_at?: string;
  updated_at: string;
  related_case?: { case_id: number; status: AlertStatus };
}

export interface AlertsListQuery {
  status?: string;
  severity?: string;
  type?: string;
  region_id?: string;
  outlet_id?: string;
  assigned_to?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  page?: string;
  limit?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total_count: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface AlertsListResponse {
  data: AlertWithRelations[];
  pagination: PaginationMeta;
  filters: Partial<AlertsListQuery>;
  user_context: {
    user_id?: number;
    role?: string;
    region_id?: number;
  };
}
