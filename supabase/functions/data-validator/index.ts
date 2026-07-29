/// <reference lib="deno.ns" />

/**
 * Data Validator Edge Function
 * Validates incoming POS/sales data before ingestion
 *
 * POST /functions/v1/data-validator
 *
 * Validates:
 * - Sales transactions
 * - Inventory data
 * - Outlet existence
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ValidationType = "sales" | "inventory" | "outlet";

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  data?: any;
}

interface ValidationError {
  field: string;
  message: string;
  value?: any;
  row?: number;
}

interface ValidationWarning {
  field: string;
  message: string;
  value?: any;
  row?: number;
}

interface SalesTransaction {
  transaction_id?: string;
  outlet_id: number;
  date: string;
  amount: number;
  hour?: number;
  day_of_week?: number;
}

interface InventoryItem {
  sku: string;
  name?: string;
  current_stock?: number;
  min_stock?: number;
  max_stock?: number;
}

interface DataValidatorRequest {
  type: ValidationType;
  data: SalesTransaction | InventoryItem | number;
  single?: boolean; // If true, data is a single item not array
}

interface OutletValidation {
  id: number;
  name: string;
  code: string;
  status: string;
  exists: boolean;
}

/**
 * Validate a single sales transaction
 */
function validateSalesTransaction(txn: any, rowIndex?: number): ValidationError[] {
  const errors: ValidationError[] = [];

  // Required fields
  if (!txn.outlet_id || typeof txn.outlet_id !== "number") {
    errors.push({
      field: "outlet_id",
      message: "outlet_id is required and must be a number",
      value: txn.outlet_id,
      row: rowIndex,
    });
  }

  if (!txn.date) {
    errors.push({
      field: "date",
      message: "date is required",
      value: txn.date,
      row: rowIndex,
    });
  } else {
    const date = new Date(txn.date);
    if (isNaN(date.getTime())) {
      errors.push({
        field: "date",
        message: "date must be a valid date format (YYYY-MM-DD or ISO 8601)",
        value: txn.date,
        row: rowIndex,
      });
    }
  }

  if (txn.amount === undefined || txn.amount === null) {
    errors.push({
      field: "amount",
      message: "amount is required",
      value: txn.amount,
      row: rowIndex,
    });
  } else if (typeof txn.amount !== "number" || txn.amount < 0) {
    errors.push({
      field: "amount",
      message: "amount must be a non-negative number",
      value: txn.amount,
      row: rowIndex,
    });
  }

  // Optional field validations
  if (txn.hour !== undefined && (txn.hour < 0 || txn.hour > 23)) {
    errors.push({
      field: "hour",
      message: "hour must be between 0 and 23",
      value: txn.hour,
      row: rowIndex,
    });
  }

  if (txn.day_of_week !== undefined && (txn.day_of_week < 0 || txn.day_of_week > 6)) {
    errors.push({
      field: "day_of_week",
      message: "day_of_week must be between 0 (Sunday) and 6 (Saturday)",
      value: txn.day_of_week,
      row: rowIndex,
    });
  }

  return errors;
}

/**
 * Validate a single inventory item
 */
function validateInventoryItem(item: any, rowIndex?: number): ValidationError[] {
  const errors: ValidationError[] = [];

  // Required fields
  if (!item.sku || typeof item.sku !== "string") {
    errors.push({
      field: "sku",
      message: "sku is required and must be a string",
      value: item.sku,
      row: rowIndex,
    });
  }

  // Optional field validations
  if (item.current_stock !== undefined && typeof item.current_stock !== "number") {
    errors.push({
      field: "current_stock",
      message: "current_stock must be a number",
      value: item.current_stock,
      row: rowIndex,
    });
  }

  if (item.min_stock !== undefined && typeof item.min_stock !== "number") {
    errors.push({
      field: "min_stock",
      message: "min_stock must be a number",
      value: item.min_stock,
      row: rowIndex,
    });
  }

  if (item.max_stock !== undefined && typeof item.max_stock !== "number") {
    errors.push({
      field: "max_stock",
      message: "max_stock must be a number",
      value: item.max_stock,
      row: rowIndex,
    });
  }

  // Cross-field validation
  if (
    item.min_stock !== undefined &&
    item.max_stock !== undefined &&
    item.min_stock > item.max_stock
  ) {
    errors.push({
      field: "max_stock",
      message: "max_stock must be greater than or equal to min_stock",
      value: item.max_stock,
      row: rowIndex,
    });
  }

  if (
    item.current_stock !== undefined &&
    item.min_stock !== undefined &&
    item.current_stock < 0
  ) {
    errors.push({
      field: "current_stock",
      message: "current_stock cannot be negative",
      value: item.current_stock,
      row: rowIndex,
    });
  }

  return errors;
}

/**
 * Generate warnings for suspicious data
 */
function generateSalesWarnings(txn: any, rowIndex?: number): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const date = new Date(txn.date);

  // Check if date is too old
  if (date < thirtyDaysAgo) {
    warnings.push({
      field: "date",
      message: "Transaction date is more than 30 days old",
      value: txn.date,
      row: rowIndex,
    });
  }

  // Check if date is in the future
  if (date > today) {
    warnings.push({
      field: "date",
      message: "Transaction date is in the future",
      value: txn.date,
      row: rowIndex,
    });
  }

  // Check for zero amount
  if (txn.amount === 0) {
    warnings.push({
      field: "amount",
      message: "Transaction amount is zero",
      value: txn.amount,
      row: rowIndex,
    });
  }

  // Check for very large amount (potential data entry error)
  if (txn.amount > 100000000) { // 100 million
    warnings.push({
      field: "amount",
      message: "Transaction amount is unusually large - please verify",
      value: txn.amount,
      row: rowIndex,
    });
  }

  return warnings;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ valid: false, errors: [{ field: "method", message: "Method not allowed. Use POST." }], warnings: [] }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body: DataValidatorRequest = await req.json();

    // Validate required fields
    if (!body.type || !body.data) {
      return new Response(
        JSON.stringify({
          valid: false,
          errors: [{ field: "type", message: "type and data are required" }],
          warnings: [],
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validTypes: ValidationType[] = ["sales", "inventory", "outlet"];
    if (!validTypes.includes(body.type)) {
      return new Response(
        JSON.stringify({
          valid: false,
          errors: [{ field: "type", message: `Invalid type. Valid: ${validTypes.join(", ")}` }],
          warnings: [],
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Handle different validation types
    if (body.type === "outlet") {
      // Validate outlet exists
      const outletId = typeof body.data === "number" ? body.data : (body.data as any).id;

      if (!outletId || typeof outletId !== "number") {
        return new Response(
          JSON.stringify({
            valid: false,
            errors: [{ field: "id", message: "outlet id is required and must be a number" }],
            warnings: [],
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: outlet } = await supabase
        .from("outlets")
        .select("id, name, code, status")
        .eq("id", outletId)
        .single();

      const outletValidation: OutletValidation = {
        id: outletId,
        name: outlet?.name || "Unknown",
        code: outlet?.code || "Unknown",
        status: outlet?.status || "Unknown",
        exists: !!outlet,
      };

      if (!outlet) {
        errors.push({
          field: "outlet_id",
          message: `Outlet with id ${outletId} does not exist`,
          value: outletId,
        });
      }

      return new Response(
        JSON.stringify({
          valid: errors.length === 0,
          errors,
          warnings,
          data: outletValidation,
        }),
        { status: errors.length > 0 ? 400 : 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle array or single item
    let items: any[];
    if (body.single || !Array.isArray(body.data)) {
      items = [body.data];
    } else {
      items = body.data;
    }

    // Validate each item
    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (body.type === "sales") {
        const itemErrors = validateSalesTransaction(item, items.length > 1 ? i : undefined);
        errors.push(...itemErrors);

        if (itemErrors.length === 0) {
          const itemWarnings = generateSalesWarnings(item, items.length > 1 ? i : undefined);
          warnings.push(...itemWarnings);
        }
      } else if (body.type === "inventory") {
        const itemErrors = validateInventoryItem(item, items.length > 1 ? i : undefined);
        errors.push(...itemErrors);
      }
    }

    // Check for duplicate transaction_ids if validating sales
    if (body.type === "sales") {
      const transactionIds = items.map((t: any) => t.transaction_id).filter(Boolean);
      const uniqueIds = new Set(transactionIds);

      if (transactionIds.length !== uniqueIds.size) {
        // Find duplicates
        const seen = new Set<string>();
        for (let i = 0; i < items.length; i++) {
          const id = items[i].transaction_id;
          if (id && seen.has(id)) {
            errors.push({
              field: "transaction_id",
              message: `Duplicate transaction_id: ${id}`,
              value: id,
              row: i,
            });
          }
          seen.add(id);
        }
      }
    }

    const response: ValidationResult = {
      valid: errors.length === 0,
      errors,
      warnings,
      data: errors.length === 0 ? items : undefined,
    };

    console.log(`Data Validator: ${body.type} - ${errors.length} errors, ${warnings.length} warnings`);

    return new Response(JSON.stringify(response), {
      status: errors.length > 0 ? 400 : 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Data Validator error:", error);
    return new Response(
      JSON.stringify({
        valid: false,
        errors: [{ field: "unknown", message: error.message || "Internal server error" }],
        warnings: [],
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
