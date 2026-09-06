/// <reference lib="deno.ns" />

/**
 * POS Connector Stub Edge Function
 * Provides a unified interface for different POS systems (Aloha, SAP, Dynamics)
 *
 * POST /functions/v1/pos-connector
 *
 * Supported POS Systems:
 * - ALOHA (IRISPY)
 * - SAP_S4HANA
 * - DYNAMICS
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type POSSystem = "ALOHA" | "SAP_S4HANA" | "DYNAMICS" | "GENERIC";

interface POSConnectorRequest {
  system: POSSystem;
  action: "fetch_sales" | "fetch_inventory" | "test_connection";
  outlet_id?: number;
  date_from?: string;
  date_to?: string;
  sku?: string;
  credentials?: {
    host?: string;
    port?: number;
    database?: string;
    username?: string;
    password?: string;
    api_key?: string;
    api_secret?: string;
  };
}

interface POSConnectorResponse {
  success: boolean;
  system: POSSystem;
  action: string;
  data?: any;
  count?: number;
  error?: string;
}

/**
 * Transform Aloha POS data to standard format
 */
function transformAlohaData(rawData: any, action: string): any {
  if (action === "fetch_sales") {
    return {
      transactions: (rawData.transactions || []).map((t: any) => ({
        transaction_id: t.check_number || t.ticket_id,
        outlet_id: t.store_id,
        date: t.sale_date || t.transaction_date,
        amount: parseFloat(t.total || t.net_sales || 0),
        items: t.items?.map((item: any) => ({
          sku: item.item_id,
          name: item.name,
          quantity: item.qty,
          price: item.price,
        })),
      })),
    };
  }

  if (action === "fetch_inventory") {
    return {
      items: (rawData.inventory || rawData.items || []).map((item: any) => ({
        sku: item.item_number || item.sku,
        name: item.description || item.name,
        current_stock: parseInt(item.qoh || item.quantity_on_hand || 0),
        min_stock: parseInt(item.par_level || item.minimum || 0),
        max_stock: parseInt(item.maximum || 0),
      })),
    };
  }

  return rawData;
}

/**
 * Transform SAP S/4HANA data to standard format
 */
function transformSAPData(rawData: any, action: string): any {
  if (action === "fetch_sales") {
    return {
      transactions: (rawData.d?.results || rawData.SalesOrders || []).map((order: any) => ({
        transaction_id: order.PurchasingDocument || order.SalesOrder,
        outlet_id: order.Plant || order.Store,
        date: order.CreationDate || order.OrderDate,
        amount: parseFloat(order.NetAmount || order.TotalAmount || 0),
      })),
    };
  }

  if (action === "fetch_inventory") {
    return {
      items: (rawData.d?.results || rawData.Inventory || []).map((item: any) => ({
        sku: item.Material || item.SKU,
        name: item.Description || item.MaterialDescription,
        current_stock: parseInt(item.AvailableStock || item.Quantity || 0),
        min_stock: parseInt(item.MinStock || item.ReorderPoint || 0),
        max_stock: parseInt(item.MaxStock || 0),
      })),
    };
  }

  return rawData;
}

/**
 * Transform Microsoft Dynamics data to standard format
 */
function transformDynamicsData(rawData: any, action: string): any {
  if (action === "fetch_sales") {
    return {
      transactions: (rawData.value || rawData.Transactions || []).map((t: any) => ({
        transaction_id: t.receiptid || t.transactionid,
        outlet_id: t.storeid || t.OutletId,
        date: t.transactiondate || t.createdon,
        amount: parseFloat(t.totalAmount || t.NetAmount || 0),
      })),
    };
  }

  if (action === "fetch_inventory") {
    return {
      items: (rawData.value || rawData.Inventory || []).map((item: any) => ({
        sku: item.itemnumber || item.productid,
        name: item.name || item.productname,
        current_stock: parseInt(item.quantitiesavailable || item.onhand || 0),
        min_stock: parseInt(item.minimumstock || 0),
        max_stock: parseInt(item.maximumstock || 0),
      })),
    };
  }

  return rawData;
}

/**
 * Simulate POS connection for demo/testing
 * In production, this would make actual API calls
 */
async function simulatePOSConnection(
  system: POSSystem,
  action: string,
  outletId?: number
): Promise<any> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Return mock data based on system
  if (action === "test_connection") {
    return {
      status: "connected",
      system,
      version: "1.0",
      timestamp: new Date().toISOString(),
    };
  }

  if (action === "fetch_sales") {
    // Generate mock sales data
    const today = new Date();
    const transactions = [];

    for (let i = 0; i < 5; i++) {
      const date = new Date(today);
      date.setHours(date.getHours() - i * 2);
      transactions.push({
        transaction_id: `TXN-${system}-${Date.now()}-${i}`,
        outlet_id: outletId || 1,
        date: date.toISOString(),
        amount: Math.floor(Math.random() * 500000) + 50000,
        hour: date.getHours(),
        day_of_week: date.getDay(),
      });
    }

    return { transactions };
  }

  if (action === "fetch_inventory") {
    // Generate mock inventory data
    const items = [
      { sku: "SKU-001", name: "Product A", current_stock: 150, min_stock: 50, max_stock: 300 },
      { sku: "SKU-002", name: "Product B", current_stock: 80, min_stock: 30, max_stock: 200 },
      { sku: "SKU-003", name: "Product C", current_stock: 20, min_stock: 40, max_stock: 150 },
      { sku: "SKU-004", name: "Product D", current_stock: 200, min_stock: 60, max_stock: 400 },
      { sku: "SKU-005", name: "Product E", current_stock: 45, min_stock: 25, max_stock: 180 },
    ];

    return { items };
  }

  return {};
}

/**
 * Insert sales transactions into database
 */
async function insertSalesTransactions(
  supabase: any,
  transactions: any[],
  outletId: number
): Promise<{ inserted: number; errors: string[] }> {
  const errors: string[] = [];
  let inserted = 0;

  for (const txn of transactions) {
    try {
      const { error } = await supabase.from("sales_transactions").insert({
        transaction_id: txn.transaction_id,
        outlet_id: txn.outlet_id || outletId,
        date: txn.date?.split("T")[0] || new Date().toISOString().split("T")[0],
        amount: txn.amount,
        transaction_count: txn.items?.length || 1,
        hour: txn.hour !== undefined ? txn.hour : new Date(txn.date).getHours(),
        day_of_week: txn.day_of_week !== undefined ? txn.day_of_week : new Date(txn.date).getDay(),
        metadata: txn.items ? { items: txn.items } : undefined,
      });

      if (error) {
        if (error.code === "23505") {
          // Duplicate key - skip
          console.log(`Skipping duplicate transaction: ${txn.transaction_id}`);
        } else {
          errors.push(`Transaction ${txn.transaction_id}: ${error.message}`);
        }
      } else {
        inserted++;
      }
    } catch (err) {
      errors.push(`Transaction ${txn.transaction_id}: ${err.message}`);
    }
  }

  return { inserted, errors };
}

/**
 * Insert inventory items into database
 */
async function insertInventory(
  supabase: any,
  items: any[],
  outletId: number
): Promise<{ inserted: number; updated: number; errors: string[] }> {
  const errors: string[] = [];
  let inserted = 0;
  let updated = 0;

  for (const item of items) {
    try {
      // Check if item exists
      const { data: existing } = await supabase
        .from("inventory")
        .select("id")
        .eq("outlet_id", outletId)
        .eq("sku", item.sku)
        .single();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from("inventory")
          .update({
            product_name: item.name,
            current_stock: item.current_stock,
            min_stock: item.min_stock,
            max_stock: item.max_stock,
          })
          .eq("id", existing.id);

        if (error) {
          errors.push(`SKU ${item.sku}: ${error.message}`);
        } else {
          updated++;
        }
      } else {
        // Insert new
        const { error } = await supabase.from("inventory").insert({
          outlet_id: outletId,
          sku: item.sku,
          product_name: item.name,
          current_stock: item.current_stock,
          min_stock: item.min_stock || 0,
          max_stock: item.max_stock || 0,
        });

        if (error) {
          errors.push(`SKU ${item.sku}: ${error.message}`);
        } else {
          inserted++;
        }
      }
    } catch (err) {
      errors.push(`SKU ${item.sku}: ${err.message}`);
    }
  }

  return { inserted, updated, errors };
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed. Use POST." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body: POSConnectorRequest = await req.json();

    // Validate required fields
    if (!body.system || !body.action) {
      return new Response(
        JSON.stringify({ success: false, error: "system and action are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validSystems: POSSystem[] = ["ALOHA", "SAP_S4HANA", "DYNAMICS", "GENERIC"];
    const validActions = ["fetch_sales", "fetch_inventory", "test_connection"];

    if (!validSystems.includes(body.system)) {
      return new Response(
        JSON.stringify({ success: false, error: `Invalid system. Valid: ${validSystems.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!validActions.includes(body.action)) {
      return new Response(
        JSON.stringify({ success: false, error: `Invalid action. Valid: ${validActions.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // For actual production use, you would make real API calls here
    // For now, simulate the connection
    let rawData = await simulatePOSConnection(body.system, body.action, body.outlet_id);

    // Transform data based on POS system
    let transformedData: any;
    switch (body.system) {
      case "ALOHA":
        transformedData = transformAlohaData(rawData, body.action);
        break;
      case "SAP_S4HANA":
        transformedData = transformSAPData(rawData, body.action);
        break;
      case "DYNAMICS":
        transformedData = transformDynamicsData(rawData, body.action);
        break;
      default:
        transformedData = rawData;
    }

    // Insert data into database if applicable
    if (body.action === "fetch_sales" && transformedData.transactions) {
      const result = await insertSalesTransactions(
        supabase,
        transformedData.transactions,
        body.outlet_id || 1
      );
      transformedData.sync_result = result;
    }

    if (body.action === "fetch_inventory" && transformedData.items) {
      const result = await insertInventory(
        supabase,
        transformedData.items,
        body.outlet_id || 1
      );
      transformedData.sync_result = result;
    }

    const count = transformedData.transactions?.length || transformedData.items?.length || 0;

    const response: POSConnectorResponse = {
      success: true,
      system: body.system,
      action: body.action,
      data: transformedData,
      count,
    };

    console.log(`POS Connector: ${body.system} ${body.action} - ${count} records`);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("POS Connector error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
