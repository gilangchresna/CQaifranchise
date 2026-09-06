/// <reference lib="deno.ns" />
/**
 * Seed regions + outlets for Jan-Aug 2026 sales data
 * Safe to re-run (idempotent)
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function makeUuid(): string {
  return crypto.randomUUID();
}

const REGION_DEFS = [
  { name: "Singapore",    code: "SG",  description: "Singapore" },
  { name: "Jakarta",     code: "JKT", description: "Jakarta, Indonesia" },
  { name: "Bandung",     code: "BDG", description: "Bandung, Indonesia" },
  { name: "Surabaya",    code: "SBY", description: "Surabaya, Indonesia" },
  { name: "Kuala Lumpur", code: "KUL", description: "Kuala Lumpur, Malaysia" },
  { name: "Bangkok",    code: "BKK", description: "Bangkok, Thailand" },
];

const FRANCHISEE_DEFS = [
  { id: "a0000001-0001-0001-0001-000000000001", code: "FR-SG-001",  name: "Alice Tan",    email: "alice.sg@franchise.com" },
  { id: "a0000002-0002-0002-0002-000000000002", code: "FR-SG-002",  name: "Bob Lee",      email: "bob.sg@franchise.com" },
  { id: "b0000001-0001-0001-0001-000000000001", code: "FR-JKT-001", name: "Charlie Wong",  email: "charlie.jkt@franchise.com" },
  { id: "b0000002-0002-0002-0002-000000000002", code: "FR-JKT-002", name: "Diana Chen",   email: "diana.jkt@franchise.com" },
  { id: "c0000001-0001-0001-0001-000000000001", code: "FR-BDG-001", name: "Eko Susilo",   email: "eko.bdg@franchise.com" },
  { id: "d0000001-0001-0001-0001-000000000001", code: "FR-SBY-001", name: "Fajar Hakim",   email: "fajar.sby@franchise.com" },
  { id: "e0000001-0001-0001-0001-000000000001", code: "FR-KUL-001", name: "Gopal Nair",   email: "gopal.kul@franchise.com" },
  { id: "f0000001-0001-0001-0001-000000000001", code: "FR-BKK-001", name: "Hana Yoshida",  email: "hana.bkk@franchise.com" },
];

const OUTLET_DEFS = [
  { code: "SG-001",  name: "SG Marina Bay",      city: "Singapore",    status: "ACTIVE", daily_target: 5000,       region_code: "SG",  fr_id: "a0000001-0001-0001-0001-000000000001" },
  { code: "SG-002",  name: "SG Orchard",         city: "Singapore",    status: "ACTIVE", daily_target: 6500,       region_code: "SG",  fr_id: "a0000001-0001-0001-0001-000000000001" },
  { code: "SG-003",  name: "SG Changi",         city: "Singapore",    status: "ACTIVE", daily_target: 8000,       region_code: "SG",  fr_id: "a0000002-0002-0002-0002-000000000002" },
  { code: "JKT-001", name: "JKT Sudirman",      city: "Jakarta",      status: "ACTIVE", daily_target: 35000000,   region_code: "JKT", fr_id: "b0000001-0001-0001-0001-000000000001" },
  { code: "JKT-002", name: "JKT Thamrin",      city: "Jakarta",      status: "ACTIVE", daily_target: 40000000,   region_code: "JKT", fr_id: "b0000001-0001-0001-0001-000000000001" },
  { code: "JKT-003", name: "JKT Blok M",        city: "Jakarta",      status: "ACTIVE", daily_target: 25000000,   region_code: "JKT", fr_id: "b0000002-0002-0002-0002-000000000002" },
  { code: "BDG-001", name: "BDG Braga",          city: "Bandung",      status: "ACTIVE", daily_target: 15000000,   region_code: "BDG", fr_id: "c0000001-0001-0001-0001-000000000001" },
  { code: "BDG-002", name: "BDG Dago",          city: "Bandung",      status: "ACTIVE", daily_target: 12000000,   region_code: "BDG", fr_id: "c0000001-0001-0001-0001-000000000001" },
  { code: "SBY-001", name: "SBY Tunjungan",     city: "Surabaya",    status: "ACTIVE", daily_target: 20000000,   region_code: "SBY", fr_id: "d0000001-0001-0001-0001-000000000001" },
  { code: "SBY-002", name: "SBY Pakuwon",       city: "Surabaya",    status: "ACTIVE", daily_target: 22000000,   region_code: "SBY", fr_id: "d0000001-0001-0001-0001-000000000001" },
  { code: "KUL-001", name: "KUL Bukit Bintang", city: "Kuala Lumpur", status: "ACTIVE", daily_target: 35000,      region_code: "KUL", fr_id: "e0000001-0001-0001-0001-000000000001" },
  { code: "KUL-002", name: "KUL Pavilion",      city: "Kuala Lumpur", status: "ACTIVE", daily_target: 45000,      region_code: "KUL", fr_id: "e0000001-0001-0001-0001-000000000001" },
  { code: "BKK-001", name: "BKK Siam",           city: "Bangkok",      status: "ACTIVE", daily_target: 55000,      region_code: "BKK", fr_id: "f0000001-0001-0001-0001-000000000001" },
  { code: "BKK-002", name: "BKK Silom",          city: "Bangkok",      status: "ACTIVE", daily_target: 48000,      region_code: "BKK", fr_id: "f0000001-0001-0001-0001-000000000001" },
];

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: HEADERS });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const results: string[] = [];

  try {
    // Step 1: Seed regions
    for (const r of REGION_DEFS) {
      const { error } = await supabase.from("regions").upsert(r, { onConflict: "code" });
      results.push(error ? `Region ${r.code}: ${error.message}` : `Region ${r.code}: OK`);
    }

    // Step 2: Fetch region IDs
    const { data: regionRows } = await supabase.from("regions").select("id, code");
    const regionMap: Record<string, number> = {};
    for (const r of (regionRows || [])) {
      regionMap[r.code as string] = r.id as number;
    }
    results.push(`Region map: ${JSON.stringify(regionMap)}`);

    // Step 3: Upsert franchisee user profiles
    for (const fr of FRANCHISEE_DEFS) {
      const { error } = await supabase.from("user_profiles").upsert({
        id: fr.id,
        email: fr.email,
        full_name: fr.name,
        role: "FRANCHISEE_OWNER",
        region_id: null,
      }, { onConflict: "id" });
      results.push(error ? `Fr ${fr.code}: ${error.message}` : `Fr ${fr.code}: OK`);
    }

    // Step 4: Seed outlets
    let outletCount = 0;
    for (const o of OUTLET_DEFS) {
      const rid = regionMap[o.region_code];
      if (!rid) { results.push(`Outlet ${o.code}: no region`); continue; }
      const { error } = await supabase.from("outlets").upsert({
        code: o.code,
        name: o.name,
        city: o.city,
        status: o.status,
        region_id: rid,
        franchisee_id: o.fr_id,
        daily_target: o.daily_target,
      }, { onConflict: "code" });
      if (error) {
        results.push(`Outlet ${o.code}: ${error.message}`);
      } else {
        outletCount++;
      }
    }
    results.push(`Outlets seeded: ${outletCount}`);

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...HEADERS, "Content-Type": "application/json" }
    });

  } catch (err: any) {
    results.push(`FATAL: ${err.message}`);
    return new Response(JSON.stringify({ ok: false, results }), {
      status: 500,
      headers: { ...HEADERS, "Content-Type": "application/json" }
    });
  }
});
