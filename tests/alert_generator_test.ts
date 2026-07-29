/**
 * Alert Generator - Unit Tests
 * Tests for validation and business logic
 */

// Validation functions
function validateOutletId(outletId: any): string | null {
  if (typeof outletId !== "number" || outletId <= 0) {
    return "outlet_id is required and must be a positive number";
  }
  return null;
}

function validateTriggerType(triggerType: any): string | null {
  const validTypes = ["ANOMALY", "STOCKOUT", "MANUAL"];
  if (!validTypes.includes(triggerType)) {
    return "trigger_type must be one of: ANOMALY, STOCKOUT, MANUAL";
  }
  return null;
}

function validateThreshold(threshold: any): string | null {
  if (threshold !== undefined) {
    if (typeof threshold !== "number" || threshold < 0 || threshold > 1) {
      return "threshold_override must be a number between 0 and 1";
    }
  }
  return null;
}

function validateSalesAmount(amount: any): string | null {
  if (amount !== undefined && amount < 0) {
    return "current_sales cannot be negative";
  }
  return null;
}

function validateSeverity(severity: any): string | null {
  const validSeverities = ["P1_CRITICAL", "P2_HIGH", "P3_MEDIUM", "P4_LOW"];
  if (severity !== undefined && !validSeverities.includes(severity)) {
    return "severity must be one of: P1_CRITICAL, P2_HIGH, P3_MEDIUM, P4_LOW";
  }
  return null;
}

Deno.test("validateOutletId - valid", () => {
  const error = validateOutletId(37);
  
  assertEquals(error, null);
});

Deno.test("validateOutletId - invalid type", () => {
  const error = validateOutletId("37");
  
  assertEquals(error, "outlet_id is required and must be a positive number");
});

Deno.test("validateOutletId - zero", () => {
  const error = validateOutletId(0);
  
  assertEquals(error, "outlet_id is required and must be a positive number");
});

Deno.test("validateOutletId - negative", () => {
  const error = validateOutletId(-1);
  
  assertEquals(error, "outlet_id is required and must be a positive number");
});

Deno.test("validateOutletId - null", () => {
  const error = validateOutletId(null);
  
  assertEquals(error, "outlet_id is required and must be a positive number");
});

Deno.test("validateTriggerType - ANOMALY", () => {
  const error = validateTriggerType("ANOMALY");
  
  assertEquals(error, null);
});

Deno.test("validateTriggerType - STOCKOUT", () => {
  const error = validateTriggerType("STOCKOUT");
  
  assertEquals(error, null);
});

Deno.test("validateTriggerType - MANUAL", () => {
  const error = validateTriggerType("MANUAL");
  
  assertEquals(error, null);
});

Deno.test("validateTriggerType - invalid", () => {
  const error = validateTriggerType("INVALID");
  
  assertEquals(error, "trigger_type must be one of: ANOMALY, STOCKOUT, MANUAL");
});

Deno.test("validateTriggerType - empty", () => {
  const error = validateTriggerType("");
  
  assertEquals(error, "trigger_type must be one of: ANOMALY, STOCKOUT, MANUAL");
});

Deno.test("validateThreshold - valid 0", () => {
  const error = validateThreshold(0);
  
  assertEquals(error, null);
});

Deno.test("validateThreshold - valid 0.5", () => {
  const error = validateThreshold(0.5);
  
  assertEquals(error, null);
});

Deno.test("validateThreshold - valid 1", () => {
  const error = validateThreshold(1);
  
  assertEquals(error, null);
});

Deno.test("validateThreshold - negative", () => {
  const error = validateThreshold(-0.1);
  
  assertEquals(error, "threshold_override must be a number between 0 and 1");
});

Deno.test("validateThreshold - over 1", () => {
  const error = validateThreshold(1.5);
  
  assertEquals(error, "threshold_override must be a number between 0 and 1");
});

Deno.test("validateThreshold - undefined is valid", () => {
  const error = validateThreshold(undefined);
  
  assertEquals(error, null);
});

Deno.test("validateSalesAmount - valid", () => {
  const error = validateSalesAmount(5000000);
  
  assertEquals(error, null);
});

Deno.test("validateSalesAmount - zero is valid", () => {
  const error = validateSalesAmount(0);
  
  assertEquals(error, null);
});

Deno.test("validateSalesAmount - negative fails", () => {
  const error = validateSalesAmount(-1000);
  
  assertEquals(error, "current_sales cannot be negative");
});

Deno.test("validateSeverity - valid P1", () => {
  const error = validateSeverity("P1_CRITICAL");
  
  assertEquals(error, null);
});

Deno.test("validateSeverity - valid P4", () => {
  const error = validateSeverity("P4_LOW");
  
  assertEquals(error, null);
});

Deno.test("validateSeverity - invalid", () => {
  const error = validateSeverity("P5");
  
  assertEquals(error, "severity must be one of: P1_CRITICAL, P2_HIGH, P3_MEDIUM, P4_LOW");
});

Deno.test("validateSeverity - undefined is valid", () => {
  const error = validateSeverity(undefined);
  
  assertEquals(error, null);
});

function assertEquals(actual: any, expected: any) {
  if (actual !== expected) {
    throw new Error(`Expected ${expected}, got ${actual}`);
  }
}
