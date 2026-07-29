/// <reference lib="deno.ns" />

/**
 * ML Stockout Risk - Unit Tests
 * Tests for inventory velocity based stockout prediction
 */

// Test helper functions (simplified versions)
function calculateVelocity(currentStock: number, dailyUsage: number): number {
  if (dailyUsage === 0) return Infinity;
  return currentStock / dailyUsage;
}

function calculateRiskScore(daysUntilStockout: number, minStock: number): number {
  if (daysUntilStockout >= minStock * 2) return 0;
  if (daysUntilStockout >= minStock) return 0.3;
  if (daysUntilStockout >= minStock * 0.5) return 0.6;
  if (daysUntilStockout >= 3) return 0.8;
  return 1.0;
}

function calculateRiskLevel(riskScore: number): string {
  if (riskScore >= 0.8) return "HIGH";
  if (riskScore >= 0.5) return "MEDIUM";
  if (riskScore >= 0.3) return "LOW";
  return "MINIMAL";
}

function calculateRecommendedOrder(
  currentStock: number,
  avgDailyUsage: number,
  targetDays: number = 30
): number {
  const targetStock = avgDailyUsage * targetDays;
  const order = Math.max(0, targetStock - currentStock);
  return Math.round(order);
}

function assertEquals(actual: any, expected: any) {
  if (actual !== expected) {
    throw new Error(`Expected ${expected}, got ${actual}`);
  }
}

Deno.test("calculateVelocity - normal calculation", () => {
  const velocity = calculateVelocity(100, 10);
  assertEquals(velocity, 10);
});

Deno.test("calculateVelocity - zero usage returns Infinity", () => {
  const velocity = calculateVelocity(100, 0);
  assertEquals(velocity, Infinity);
});

Deno.test("calculateRiskScore - minimal risk", () => {
  const score = calculateRiskScore(60, 20);
  assertEquals(score, 0);
});

Deno.test("calculateRiskScore - low risk", () => {
  const score = calculateRiskScore(30, 20);
  assertEquals(score, 0.3);
});

Deno.test("calculateRiskScore - medium risk", () => {
  const score = calculateRiskScore(15, 20);
  assertEquals(score, 0.6);
});

Deno.test("calculateRiskScore - high risk", () => {
  const score = calculateRiskScore(5, 20);
  assertEquals(score, 0.8);
});

Deno.test("calculateRiskScore - critical risk", () => {
  const score = calculateRiskScore(1, 20);
  assertEquals(score, 1.0);
});

Deno.test("calculateRiskLevel - HIGH", () => {
  const level = calculateRiskLevel(0.9);
  assertEquals(level, "HIGH");
});

Deno.test("calculateRiskLevel - MEDIUM", () => {
  const level = calculateRiskLevel(0.5);
  assertEquals(level, "MEDIUM");
});

Deno.test("calculateRiskLevel - LOW", () => {
  const level = calculateRiskLevel(0.3);
  assertEquals(level, "LOW");
});

Deno.test("calculateRiskLevel - MINIMAL", () => {
  const level = calculateRiskLevel(0.1);
  assertEquals(level, "MINIMAL");
});

Deno.test("calculateRecommendedOrder - need to order", () => {
  const order = calculateRecommendedOrder(20, 5, 30);
  assertEquals(order, 130);
});

Deno.test("calculateRecommendedOrder - no order needed", () => {
  const order = calculateRecommendedOrder(200, 5, 30);
  assertEquals(order, 0);
});

Deno.test("calculateRecommendedOrder - zero usage", () => {
  const order = calculateRecommendedOrder(100, 0, 30);
  assertEquals(order, 0);
});
