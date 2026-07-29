/**
 * CyberQuote MCP Server
 * Exposes CyberQuote data as MCP tools for Hermes
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || "https://ploqeifazcgzwjzmukgp.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

// Create MCP server
const server = new McpServer({
  name: "CyberQuote",
  version: "1.0.0",
});

// Tool: Get Dashboard Summary
server.tool(
  "get_dashboard_summary",
  "Get CyberQuote dashboard summary with revenue, transactions, and metrics",
  {
    period: schema.string("Period: today, 7d, 30d, month, ytd")
  },
  async ({ period = "7d" }) => {
    // Calculate date range
    const today = new Date("2026-07-25");
    let startDate: string;
    
    switch (period) {
      case "today":
        startDate = today.toISOString().split("T")[0];
        break;
      case "7d":
        startDate = new Date(today.getTime() - 6 * 86400000).toISOString().split("T")[0];
        break;
      case "30d":
        startDate = new Date(today.getTime() - 29 * 86400000).toISOString().split("T")[0];
        break;
      case "month":
        startDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
        break;
      case "ytd":
        startDate = `${today.getFullYear()}-01-01`;
        break;
      default:
        startDate = new Date(today.getTime() - 6 * 86400000).toISOString().split("T")[0];
    }

    // Fetch data with pagination
    let allSales: any[] = [];
    let offset = 0;
    while (true) {
      const { data } = await supabase
        .from("sales_transactions")
        .select("amount, settlement_amount, date")
        .gte("date", startDate)
        .lte("date", today.toISOString().split("T")[0])
        .range(offset, offset + 999);
      
      if (!data || data.length === 0) break;
      allSales.push(...data);
      if (data.length < 1000) break;
      offset += 1000;
    }

    const totalRevenue = allSales.reduce((sum, s) => sum + (s.settlement_amount || s.amount), 0);
    
    return {
      content: [{
        type: "text",
        text: `📊 CyberQuote Dashboard (${period.toUpperCase()})
        
💰 Revenue: S$ ${totalRevenue.toFixed(2)}
📈 Transactions: ${allSales.length}
📅 Period: ${startDate} to ${today.toISOString().split("T")[0]}`
      }]
    };
  }
);

// Tool: Get Outlets Performance
server.tool(
  "get_outlets_performance",
  "Get performance of all outlets with revenue and alerts",
  {},
  async () => {
    // Get outlets
    const { data: outlets } = await supabase
      .from("outlets")
      .select("*, region:regions(name)")
      .order("code");

    // Get alerts
    const { data: alerts } = await supabase
      .from("alerts")
      .select("*")
      .eq("status", "NEW");

    return {
      content: [{
        type: "text",
        text: `🏪 CyberQuote Outlets (${outlets?.length || 0} outlets)

${(outlets || []).map(o => `• ${o.code}: ${o.region?.name || "N/A"}`).join("\n")}

⚠️ Active Alerts: ${alerts?.length || 0}`
      }]
    };
  }
);

// Tool: Get Recent Alerts
server.tool(
  "get_recent_alerts",
  "Get recent alerts with severity and status",
  {
    limit: schema.string("Number of alerts to return")
  },
  async ({ limit = "10" }) => {
    const { data: alerts } = await supabase
      .from("alerts")
      .select("*, outlets(name, code)")
      .order("created_at", { ascending: false })
      .limit(parseInt(limit));

    return {
      content: [{
        type: "text",
        text: `🚨 Recent Alerts (${alerts?.length || 0})

${(alerts || []).slice(0, 5).map(a => 
          `[${a.severity}] ${a.title}
   Outlet: ${a.outlets?.name || "N/A"}
   Status: ${a.status}`
        ).join("\n\n")}`
      }]
    };
  }
);

// Tool: Analyze Sales Trend
server.tool(
  "analyze_sales_trend",
  "Analyze sales trend for specific outlet",
  {
    outlet_id: schema.string("Outlet ID to analyze")
  },
  async ({ outlet_id }) => {
    // Get 7 days sales
    const today = new Date("2026-07-25");
    const weekAgo = new Date(today.getTime() - 6 * 86400000);
    
    const { data: sales } = await supabase
      .from("sales_transactions")
      .select("date, amount")
      .eq("outlet_id", parseInt(outlet_id))
      .gte("date", weekAgo.toISOString().split("T")[0])
      .lte("date", today.toISOString().split("T")[0])
      .order("date");

    const totalRevenue = (sales || []).reduce((sum, s) => sum + parseFloat(s.amount), 0);
    const avgDaily = sales?.length ? totalRevenue / sales.length : 0;

    return {
      content: [{
        type: "text",
        text: `📈 Sales Analysis for Outlet ${outlet_id}

💰 Total Revenue (7 days): S$ ${totalRevenue.toFixed(2)}
📊 Avg Daily: S$ ${avgDaily.toFixed(2)}
📅 Days with Sales: ${sales?.length || 0}`
      }]
    };
  }
);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("CyberQuote MCP Server running...");
}

main().catch(console.error);
