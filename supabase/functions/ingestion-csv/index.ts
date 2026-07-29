/**
 * CyberQuote CSV Upload Edge Function
 * Handles bulk upload of sales transactions via CSV data
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  CSVTransactionRow,
  CSVUploadPayload,
  CSVUploadResponse,
} from "../_shared/types.ts";

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_BATCH_SIZE = 1000;
const BATCH_CHUNK_SIZE = 100;

// =============================================================================
// VALIDATION
// =============================================================================

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function validateTransactionRow(row: CSVTransactionRow, index: number): ValidationResult {
  const errors: string[] = [];

  if (!row.outlet_id || !Number.isInteger(row.outlet_id) || row.outlet_id <= 0) {
    errors.push(`Row ${index + 1}: Invalid outlet_id`);
  }

  if (!row.transaction_id || typeof row.transaction_id !== "string" || row.transaction_id.trim().length === 0) {
    errors.push(`Row ${index + 1}: Invalid transaction_id`);
  }

  if (typeof row.amount !== "number" || row.amount < 0) {
    errors.push(`Row ${index + 1}: Invalid amount`);
  }

  if (!row.timestamp || typeof row.timestamp !== "string") {
    errors.push(`Row ${index + 1}: Invalid timestamp`);
  } else {
    const date = new Date(row.timestamp);
    if (isNaN(date.getTime())) {
      errors.push(`Row ${index + 1}: Invalid timestamp format`);
    }
  }

  return { valid: errors.length === 0, errors };
}

function validateBatchPayload(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["Invalid payload format"] };
  }

  const payload = data as Record<string, unknown>;

  if (!Array.isArray(payload.transactions)) {
    return { valid: false, errors: ["Missing or invalid transactions array"] };
  }

  if (payload.transactions.length === 0) {
    return { valid: false, errors: ["Empty transactions array"] };
  }

  if (payload.transactions.length > MAX_BATCH_SIZE) {
    return {
      valid: false,
      errors: [`Batch size exceeds maximum of ${MAX_BATCH_SIZE}`],
    };
  }

  payload.transactions.forEach((row: CSVTransactionRow, index: number) => {
    const result = validateTransactionRow(row, index);
    errors.push(...result.errors);
  });

  return { valid: errors.length === 0, errors };
}

// =============================================================================
// DATABASE OPERATIONS
// =============================================================================

async function checkExistingTransactions(
  supabase: any,
  transactionIds: string[]
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("sales_transactions")
    .select("transaction_id")
    .in("transaction_id", transactionIds);

  if (error) {
    throw error;
  }

  return new Set((data || []).map((row: any) => row.transaction_id));
}

async function validateOutletsExist(
  supabase: any,
  outletIds: number[]
): Promise<Map<number, boolean>> {
  const { data, error } = await supabase
    .from("outlets")
    .select("id")
    .in("id", outletIds);

  if (error) {
    throw error;
  }

  const existingOutlets = new Set((data || []).map((row: any) => row.id));
  const result = new Map<number, boolean>();

  for (const id of outletIds) {
    result.set(id, existingOutlets.has(id));
  }

  return result;
}

async function insertTransactionsBatch(
  supabase: any,
  transactions: any[]
): Promise<{ inserted: number; errors: string[] }> {
  const errors: string[] = [];

  for (let i = 0; i < transactions.length; i += BATCH_CHUNK_SIZE) {
    const chunk = transactions.slice(i, i + BATCH_CHUNK_SIZE);

    const { error } = await supabase
      .from("sales_transactions")
      .insert(chunk)
      .select();

    if (error) {
      if (error.code === "23505") {
        errors.push(`Duplicate transaction_id at batch position ${i}`);
      } else {
        errors.push(`Batch ${i}: ${error.message}`);
      }
    }
  }

  return { inserted: transactions.length - errors.length, errors };
}

// =============================================================================
// MAIN REQUEST HANDLER
// =============================================================================

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    );
  }

  let payload: CSVUploadPayload;
  try {
    const body = await req.json();
    payload = body as CSVUploadPayload;
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON payload" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const validation = validateBatchPayload(payload);
  if (!validation.valid) {
    const response: CSVUploadResponse = {
      status: "error",
      message: "Validation failed",
      total_rows: payload.transactions?.length || 0,
      inserted_count: 0,
      duplicate_count: 0,
      error_count: validation.errors.length,
      errors: validation.errors,
    };
    return new Response(JSON.stringify(response), {
      status: 422,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const transactions = payload.transactions;
    const totalRows = transactions.length;

    const transactionIds = transactions.map((t) => t.transaction_id.trim());
    const existingTransactions = await checkExistingTransactions(supabase, transactionIds);
    const duplicateCount = existingTransactions.size;

    const outletIds = [...new Set(transactions.map((t) => t.outlet_id))];
    const outletValidation = await validateOutletsExist(supabase, outletIds);

    const invalidOutlets = outletIds.filter((id) => !outletValidation.get(id));
    if (invalidOutlets.length > 0) {
      const response: CSVUploadResponse = {
        status: "error",
        message: `Invalid outlet IDs: ${invalidOutlets.join(", ")}`,
        total_rows: totalRows,
        inserted_count: 0,
        duplicate_count: duplicateCount,
        error_count: invalidOutlets.length,
        errors: invalidOutlets.map((id) => `Outlet ${id} does not exist`),
      };
      return new Response(JSON.stringify(response), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Prepare transactions for insert (using metadata for items)
    const transactionsToInsert = transactions
      .filter((t) => !existingTransactions.has(t.transaction_id.trim()))
      .map((t) => {
        const metadata = t.items ? { items: JSON.parse(t.items) } : undefined;
        const date = new Date(t.timestamp);
        
        return {
          transaction_id: t.transaction_id.trim(),
          outlet_id: t.outlet_id,
          date: date.toISOString().split("T")[0],
          amount: t.amount,
          transaction_count: metadata?.items?.length || 1,
          metadata: metadata,
          is_anomaly: false,
        };
      });

    const { inserted, errors: insertErrors } = await insertTransactionsBatch(
      supabase,
      transactionsToInsert
    );

    const response: CSVUploadResponse = {
      status: "ok",
      message: `Processed ${totalRows} transactions`,
      total_rows: totalRows,
      inserted_count: inserted,
      duplicate_count: duplicateCount,
      error_count: insertErrors.length,
      errors: insertErrors.length > 0 ? insertErrors : undefined,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("CSV upload error:", error);

    return new Response(
      JSON.stringify({
        status: "error",
        message: "Internal server error",
        total_rows: payload.transactions?.length || 0,
        inserted_count: 0,
        duplicate_count: 0,
        error_count: 1,
        errors: [error.message || "An unexpected error occurred"],
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
