/// <reference lib="deno.ns" />

/**
 * ML Anomaly Score - Unit Tests
 * Tests for Z-score based anomaly detection
 */

// Copy functions from the source for testing
function calculateStatistics(values: number[]): { avg: number; std_dev: number } {
  if (values.length === 0) {
    return { avg: 0, std_dev: 0 };
  }
  const n = values.length;
  const avg = values.reduce((sum, val) => sum + val, 0) / n;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / n;
  const std_dev = Math.sqrt(variance);
  return { avg, std_dev };
}

function calculateZScore(current: number, avg: number, std_dev: number): number {
  if (std_dev === 0) return 0;
  return (current - avg) / std_dev;
}

function calculatePercentile(values: number[], current: number): number {
  if (values.length === 0) return 50;
  const sorted = [...values].sort((a, b) => a - b);
  let count = 0;
  for (const val of sorted) {
    if (val < current) count++;
    else break;
  }
  return Math.round((count / sorted.length) * 100);
}

function assertEquals(actual: any, expected: any) {
  if (actual !== expected) {
    throw new Error(`Expected ${expected}, got ${actual}`);
  }
}

Deno.test("calculateStatistics - normal distribution", () => {
  const values = [10, 20, 30, 40, 50];
  const result = calculateStatistics(values);
  assertEquals(result.avg, 30);
});

Deno.test("calculateStatistics - empty array", () => {
  const result = calculateStatistics([]);
  assertEquals(result.avg, 0);
  assertEquals(result.std_dev, 0);
});

Deno.test("calculateStatistics - single value", () => {
  const result = calculateStatistics([100]);
  assertEquals(result.avg, 100);
  assertEquals(result.std_dev, 0);
});

Deno.test("calculateZScore - above average", () => {
  const zScore = calculateZScore(100, 50, 25);
  assertEquals(zScore, 2);
});

Deno.test("calculateZScore - below average", () => {
  const zScore = calculateZScore(25, 50, 25);
  assertEquals(zScore, -1);
});

Deno.test("calculateZScore - at average", () => {
  const zScore = calculateZScore(50, 50, 25);
  assertEquals(zScore, 0);
});

Deno.test("calculateZScore - zero std_dev returns 0", () => {
  const zScore = calculateZScore(100, 50, 0);
  assertEquals(zScore, 0);
});

Deno.test("calculatePercentile - above median", () => {
  const values = [10, 20, 30, 40, 50];
  const percentile = calculatePercentile(values, 40);
  // 40 is 4th, 3 values below = 60%
  assertEquals(percentile, 60);
});

Deno.test("calculatePercentile - below median", () => {
  const values = [10, 20, 30, 40, 50];
  const percentile = calculatePercentile(values, 20);
  assertEquals(percentile, 20);
});

Deno.test("calculatePercentile - empty array returns 50", () => {
  const percentile = calculatePercentile([], 50);
  assertEquals(percentile, 50);
});
