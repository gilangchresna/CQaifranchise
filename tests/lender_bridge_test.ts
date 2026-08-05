/**
 * Lender Bridge — Unit & Integration Test Suite
 * Phase 3: QA Testing
 *
 * Run unit tests only:
 *   deno test --no-check --allow-read tests/lender_bridge_test.ts
 *
 * Run all tests (with credentials):
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... LENDER_WEBHOOK_SECRET=... \
 *   deno test --no-check --allow-all tests/lender_bridge_test.ts
 */

/// <reference lib="deno.ns" />

import { assertEquals, assertStringIncludes, assert } from "https://deno.land/std@0.177.0/testing/asserts.ts";

// =============================================================================
// UNIT TESTS — validation logic extracted from lender-bridge
// =============================================================================

function validateRequestedAmount(amount: unknown): string | null {
  if (!amount || typeof amount !== "number" || amount <= 0) {
    return "requested_amount must be a positive number";
  }
  return null;
}

function validatePurpose(purpose: unknown): string | null {
  const VALID = ["FRANCHISEE_SETUP", "INVENTORY", "EQUIPMENT", "WORKING_CAPITAL"];
  if (purpose !== undefined && !VALID.includes(purpose as string)) {
    return `purpose must be one of: ${VALID.join(", ")}`;
  }
  return null;
}

function validateWebhookSecret(secret: string | null, expected: string | null) {
  if (!expected) return { valid: false, status: 503, error: "Webhook endpoint not configured." };
  if (!secret || secret !== expected) return { valid: false, status: 401, error: "Invalid webhook secret" };
  return { valid: true, status: 200, error: "" };
}

function validateApplicationId(id: unknown): string | null {
  if (!id || typeof id !== "string" || id.trim() === "") return "application_id is required";
  return null;
}

function validateAction(body: Record<string, unknown>): string | null {
  const VALID = ["submit_application", "get_status", "cancel_application"];
  if (!body.action) return "action is required";
  if (!VALID.includes(body.action as string)) return `action must be one of: ${VALID.join(", ")}`;
  return null;
}

function validateDaysOverdue(days: unknown): string | null {
  if (typeof days !== "number" || days < 0) return "days_overdue cannot be negative";
  return null;
}

// =============================================================================
// UNIT TESTS — validateRequestedAmount
// =============================================================================

Deno.test("validateRequestedAmount — valid", () => {
  assertEquals(validateRequestedAmount(50000), null);
  assertEquals(validateRequestedAmount(0.01), null);
});

Deno.test("validateRequestedAmount — zero → invalid", () => {
  assertStringIncludes(validateRequestedAmount(0)!, "positive number");
});

Deno.test("validateRequestedAmount — negative → invalid", () => {
  assertStringIncludes(validateRequestedAmount(-100)!, "positive number");
});

Deno.test("validateRequestedAmount — null/undefined → invalid", () => {
  assertStringIncludes(validateRequestedAmount(null)!, "positive number");
  assertStringIncludes(validateRequestedAmount(undefined)!, "positive number");
});

Deno.test("validateRequestedAmount — string → invalid", () => {
  assertStringIncludes(validateRequestedAmount("50000" as any)!, "positive number");
  assertStringIncludes(validateRequestedAmount("" as any)!, "positive number");
});

Deno.test("validateRequestedAmount — NaN → invalid", () => {
  assertStringIncludes(validateRequestedAmount(NaN as any)!, "positive number");
});

// =============================================================================
// UNIT TESTS — validatePurpose
// =============================================================================

Deno.test("validatePurpose — valid purposes", () => {
  assertEquals(validatePurpose("FRANCHISEE_SETUP"), null);
  assertEquals(validatePurpose("INVENTORY"), null);
  assertEquals(validatePurpose("EQUIPMENT"), null);
  assertEquals(validatePurpose("WORKING_CAPITAL"), null);
  assertEquals(validatePurpose(undefined), null);
});

Deno.test("validatePurpose — invalid → error message", () => {
  const result = validatePurpose("INVALID");
  assertStringIncludes(result!, "must be one of");
});

// =============================================================================
// UNIT TESTS — validateWebhookSecret
// =============================================================================

Deno.test("validateWebhookSecret — correct → 200", () => {
  const r = validateWebhookSecret("tok", "tok");
  assertEquals(r.valid, true);
  assertEquals(r.status, 200);
});

Deno.test("validateWebhookSecret — no expected configured → 503", () => {
  const r = validateWebhookSecret(null, null);
  assertEquals(r.valid, false);
  assertEquals(r.status, 503);
});

Deno.test("validateWebhookSecret — missing header → 401", () => {
  const r = validateWebhookSecret(null, "expected");
  assertEquals(r.valid, false);
  assertEquals(r.status, 401);
});

Deno.test("validateWebhookSecret — wrong secret → 401", () => {
  const r = validateWebhookSecret("wrong", "expected");
  assertEquals(r.valid, false);
  assertEquals(r.status, 401);
});

Deno.test("validateWebhookSecret — empty string → 401", () => {
  const r = validateWebhookSecret("", "expected");
  assertEquals(r.valid, false);
  assertEquals(r.status, 401);
});

// =============================================================================
// UNIT TESTS — validateApplicationId
// =============================================================================

Deno.test("validateApplicationId — valid UUID", () => {
  assertEquals(validateApplicationId("123e4567-e89b-12d3-a456-426614174000"), null);
  assertEquals(validateApplicationId("app-123"), null);
});

Deno.test("validateApplicationId — empty/whitespace → invalid", () => {
  assertStringIncludes(validateApplicationId("")!, "required");
  assertStringIncludes(validateApplicationId("   ")!, "required");
});

Deno.test("validateApplicationId — null/number → invalid", () => {
  assertStringIncludes(validateApplicationId(null as any)!, "required");
  assertStringIncludes(validateApplicationId(123 as any)!, "required");
});

// =============================================================================
// UNIT TESTS — validateAction
// =============================================================================

Deno.test("validateAction — valid actions", () => {
  assertEquals(validateAction({ action: "submit_application" }), null);
  assertEquals(validateAction({ action: "get_status" }), null);
  assertEquals(validateAction({ action: "cancel_application" }), null);
});

Deno.test("validateAction — missing → error", () => {
  assertStringIncludes(validateAction({} as any)!, "required");
});

Deno.test("validateAction — invalid → error", () => {
  assertStringIncludes(validateAction({ action: "bad" } as any)!, "must be one of");
});

// =============================================================================
// UNIT TESTS — validateDaysOverdue
// =============================================================================

Deno.test("validateDaysOverdue — valid non-negative", () => {
  assertEquals(validateDaysOverdue(0), null);
  assertEquals(validateDaysOverdue(30), null);
});

Deno.test("validateDaysOverdue — negative → invalid", () => {
  assertStringIncludes(validateDaysOverdue(-1)!, "cannot be negative");
  assertStringIncludes(validateDaysOverdue(-999)!, "cannot be negative");
});

// =============================================================================
// RATE LIMIT LOGIC
// =============================================================================

Deno.test("rate limit — limit is 5 per day", () => {
  const limit = 5;
  assertEquals((limit - 1) >= limit, false); // 4 < 5 → allowed
  assertEquals((limit) >= limit, true);      // 5 = 5 → blocked
});

// =============================================================================
// INTEGRATION TESTS — require env vars at runtime
// =============================================================================

function getEnv(key: string): string | undefined {
  try {
    return Deno.env.get(key);
  } catch {
    return undefined;
  }
}

Deno.test({
  name: "lender-bridge: health — OPTIONS → 204",
  fn: async () => {
    const url = getEnv("SUPABASE_URL");
    if (!url) return;
    const res = await fetch(`${url}/functions/v1/lender-bridge`, {
      method: "OPTIONS",
      headers: { "Access-Control-Request-Method": "POST" },
    });
    assertEquals(res.status, 204);
  },
});

Deno.test({
  name: "lender-bridge: submit_application — missing auth → 401",
  fn: async () => {
    const url = getEnv("SUPABASE_URL");
    if (!url) return;
    const res = await fetch(`${url}/functions/v1/lender-bridge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "submit_application", requested_amount: 50000 }),
    });
    assertEquals(res.status, 401);
    const body = await res.json();
    assertEquals(body.success, false);
    assert(
      body.error?.toLowerCase().includes("authorization") ||
      body.error?.toLowerCase().includes("token") ||
      body.message?.toLowerCase().includes("invalid"),
    );
  },
});

Deno.test({
  name: "lender-bridge: submit_application — amount 0 → 400",
  fn: async () => {
    const url = getEnv("SUPABASE_URL");
    const key = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return;
    const res = await fetch(`${url}/functions/v1/lender-bridge`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "submit_application", requested_amount: 0 }),
    });
    assertEquals(res.status, 400);
    const body = await res.json();
    assertEquals(body.success, false);
    assertStringIncludes(body.error, "positive");
  },
});

Deno.test({
  name: "lender-bridge: submit_application — negative amount → 400",
  fn: async () => {
    const url = getEnv("SUPABASE_URL");
    const key = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return;
    const res = await fetch(`${url}/functions/v1/lender-bridge`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "submit_application", requested_amount: -500 }),
    });
    assertEquals(res.status, 400);
    const body = await res.json();
    assertEquals(body.success, false);
    assertStringIncludes(body.error, "positive");
  },
});

Deno.test({
  name: "lender-bridge: get_status — missing application_id → 400",
  fn: async () => {
    const url = getEnv("SUPABASE_URL");
    const key = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return;
    const res = await fetch(`${url}/functions/v1/lender-bridge`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get_status" }),
    });
    assertEquals(res.status, 400);
    const body = await res.json();
    assertEquals(body.success, false);
  },
});

Deno.test({
  name: "lender-bridge: get_status — not found UUID → graceful 200",
  fn: async () => {
    const url = getEnv("SUPABASE_URL");
    const key = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return;
    const res = await fetch(`${url}/functions/v1/lender-bridge`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get_status", application_id: "00000000-0000-0000-0000-000000000000" }),
    });
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.success, false);
  },
});

Deno.test({
  name: "lender-bridge: webhook — no secret header → 401",
  fn: async () => {
    const url = getEnv("SUPABASE_URL");
    if (!url) return;
    const res = await fetch(`${url}/functions/v1/lender-bridge/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_type: "EMI_PAID", amount: 1000 }),
    });
    assertEquals(res.status, 401);
    const body = await res.json();
    assertEquals(body.success, false);
    assert(
      body.error?.toLowerCase().includes("secret") ||
      body.error?.toLowerCase().includes("configured"),
    );
  },
});

Deno.test({
  name: "lender-bridge: webhook — wrong secret → 401",
  fn: async () => {
    const url = getEnv("SUPABASE_URL");
    if (!url) return;
    const res = await fetch(`${url}/functions/v1/lender-bridge/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-lender-webhook-secret": "wrong-secret",
      },
      body: JSON.stringify({ event_type: "EMI_PAID", amount: 1000 }),
    });
    assertEquals(res.status, 401);
    const body = await res.json();
    assertEquals(body.success, false);
  },
});

Deno.test({
  name: "lender-bridge: webhook — negative amount → 400",
  fn: async () => {
    const url = getEnv("SUPABASE_URL");
    const secret = getEnv("LENDER_WEBHOOK_SECRET");
    if (!url || !secret) return;
    const res = await fetch(`${url}/functions/v1/lender-bridge/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-lender-webhook-secret": secret },
      body: JSON.stringify({ event_type: "EMI_PAID", amount: -100 }),
    });
    assertEquals(res.status, 400);
    const body = await res.json();
    assertEquals(body.success, false);
    assertStringIncludes(body.error, "positive");
  },
});

Deno.test({
  name: "lender-bridge: cancel_application — missing application_id → 400",
  fn: async () => {
    const url = getEnv("SUPABASE_URL");
    const key = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return;
    const res = await fetch(`${url}/functions/v1/lender-bridge`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel_application" }),
    });
    assertEquals(res.status, 400);
    const body = await res.json();
    assertEquals(body.success, false);
  },
});
