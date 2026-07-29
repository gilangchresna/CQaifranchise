/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  
  // Get low stock inventory
  const { data: inventory } = await supabase
    .from('inventory')
    .select('*, outlets(name, code)')
    .lt('current_stock', 25);
  
  if (!inventory || inventory.length === 0) {
    return Response.json({ message: "No low stock", alerts_created: 0 });
  }
  
  // Get sales for velocity
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const { data: sales } = await supabase
    .from('sales_transactions')
    .select('outlet_id, transaction_count')
    .gte('date', sevenDaysAgo);
  
  const outletSales: Record<number, number> = {};
  (sales || []).forEach(s => {
    outletSales[s.outlet_id] = (outletSales[s.outlet_id] || 0) + Number(s.transaction_count || 1);
  });
  
  let highRisk = 0, mediumRisk = 0, alertsCreated = 0;
  const risks: any[] = [];
  
  for (const inv of inventory) {
    const avgDaily = (outletSales[inv.outlet_id] || 0) / 7;
    const stockRatio = Number(inv.current_stock) / Number(inv.min_stock);
    const deficitRatio = (Number(inv.min_stock) - Number(inv.current_stock)) / Number(inv.min_stock);
    
    let riskLevel = "LOW";
    let riskScore = 0;
    
    if (stockRatio < 0.5) {
      riskLevel = "HIGH";
      riskScore = 80 + Math.round(deficitRatio * 20);
      highRisk++;
    } else if (stockRatio < 0.8) {
      riskLevel = "MEDIUM";
      riskScore = 50 + Math.round(deficitRatio * 30);
      mediumRisk++;
    }
    
    risks.push({ product_name: inv.product_name, outlet: inv.outlets?.name, risk_level: riskLevel, risk_score: riskScore });
    
    if (riskLevel !== "LOW") {
      // NO metadata field!
      const result = await supabase.from('alerts').insert({
        outlet_id: inv.outlet_id,
        type: 'STOCKOUT_RISK',
        severity: riskLevel === 'HIGH' ? 'P0_CRITICAL' : 'P2_MEDIUM',
        title: `Stock Alert: ${inv.product_name}`,
        description: `${inv.outlets?.name} - Stock: ${inv.current_stock}/${inv.min_stock} (-${inv.min_stock - inv.current_stock})`
      });
      
      if (!result.error) alertsCreated++;
    }
  }
  
  return Response.json({
    total_low_stock: inventory.length,
    high_risk: highRisk,
    medium_risk: mediumRisk,
    alerts_created: alertsCreated,
    top_risks: risks.filter(r => r.risk_level !== 'LOW')
  });
});
