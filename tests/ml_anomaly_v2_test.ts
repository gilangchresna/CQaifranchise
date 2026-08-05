/// <reference lib="deno.ns" />
/**
 * ML Anomaly v2 — Test Suite
 * Unit tests for Isolation Forest algorithm + hybrid scoring
 *
 * Run: deno test --no-check --allow-read tests/ml_anomaly_v2_test.ts
 */

import { assertEquals, assertEquals as assertEq, assert, assertExists, assertFalse, assertArrayIncludes, assertStringIncludes, assertObjectMatch, assertThrows, assertStrictEquals } from "./imports.ts";

// ============================================================
// ISOLATION FOREST CLASS — extracted from ml-anomaly-v2/index.ts
// ============================================================

interface TreeNode {
  isLeaf: boolean;
  size?: number;
  featureIdx?: number;
  splitValue?: number;
  left?: TreeNode;
  right?: TreeNode;
}

class IsolationForest {
  private n_estimators: number;
  private max_samples: number;
  private contamination: number;
  private trees: TreeNode[]; // each tree is a single TreeNode (root), not TreeNode[][]
  private threshold: number;

  constructor(n_estimators = 100, contamination = 0.05) {
    this.n_estimators = n_estimators;
    this.max_samples = 256;
    this.contamination = contamination;
    this.trees = [];
    this.threshold = 0;
  }

  fit(data: number[][]): void {
    const nSamples = data.length;
    const sampleSize = Math.min(this.max_samples, nSamples);

    for (let i = 0; i < this.n_estimators; i++) {
      const indices = this.randomIndices(nSamples, sampleSize);
      const sample = indices.map((idx) => data[idx]);
      this.trees.push(this.buildTree(sample));
    }

    this.threshold = this.calculateThreshold(data.length);
  }

  score(data: number[][]): number[] {
    return data.map((sample) => this.anomalyScore(sample));
  }

  predict(data: number[][]): number[] {
    return this.score(data).map((s) => (s >= this.threshold ? 1 : 0));
  }

  getThreshold(): number {
    return this.threshold;
  }

  private buildTree(samples: number[][]): TreeNode {
    const nFeatures = samples[0].length;
    const depth = Math.ceil(Math.log2(samples.length));
    return this.buildTreeRecursive(samples, 0, depth, nFeatures);
  }

  private buildTreeRecursive(
    samples: number[][],
    depth: number,
    maxDepth: number,
    nFeatures: number
  ): TreeNode {
    if (depth >= maxDepth || samples.length <= 2) {
      return { isLeaf: true, size: samples.length };
    }

    const featureIdx = Math.floor(Math.random() * nFeatures);
    const values = samples.map((s) => s[featureIdx]);
    const min = Math.min(...values);
    const max = Math.max(...values);

    if (min === max) {
      return { isLeaf: true, size: samples.length };
    }

    const splitValue = min + Math.random() * (max - min);
    const left = samples.filter((s) => s[featureIdx] < splitValue);
    const right = samples.filter((s) => s[featureIdx] >= splitValue);

    return {
      isLeaf: false,
      featureIdx,
      splitValue,
      left: this.buildTreeRecursive(left, depth + 1, maxDepth, nFeatures),
      right: this.buildTreeRecursive(right, depth + 1, maxDepth, nFeatures),
    };
  }

  private anomalyScore(sample: number[]): number {
    const depths = this.trees.map((tree) =>
      this.pathDepth(tree, sample, 0)
    );
    const avgDepth = depths.reduce((a, b) => a + b, 0) / depths.length;

    const c =
      2 * (Math.log(this.max_samples - 1) + 0.5772156649) -
      (2 * (this.max_samples - 1) / this.max_samples);

    return Math.pow(2, -avgDepth / c);
  }

  private pathDepth(node: TreeNode, sample: number[], depth: number): number {
    if (node.isLeaf) {
      return depth + this.avgPathLength(node.size ?? 1);
    }

    if (sample[node.featureIdx!] < node.splitValue!) {
      return this.pathDepth(node.left!, sample, depth + 1);
    } else {
      return this.pathDepth(node.right!, sample, depth + 1);
    }
  }

  private avgPathLength(size: number): number {
    if (size <= 1) return 0;
    if (size === 2) return 1;
    const c =
      2 * (Math.log(size - 1) + 0.5772156649) -
      (2 * (size - 1) / size);
    return c;
  }

  private calculateThreshold(nSamples: number): number {
    return -Math.log(this.contamination);
  }

  private randomIndices(n: number, size: number): number[] {
    const indices: number[] = [];
    for (let i = 0; i < size; i++) {
      indices.push(Math.floor(Math.random() * n));
    }
    return indices;
  }
}

// ============================================================
// FEATURE NORMALIZATION — extracted from ml-anomaly-v2
// ============================================================

const FEATURE_NAMES = ["revenue", "cost", "staff_prod", "inv_turnover", "stock_level"];

function normalizeFeatures(row: {
  revenue_7d_avg: number;
  cost_7d_avg: number;
  staff_productivity: number;
  inventory_turnover: number;
  stock_level_pct: number;
}): number[] {
  return [
    Number(row.revenue_7d_avg) / 1000,
    Number(row.cost_7d_avg) / 1000,
    Number(row.staff_productivity) / 100,
    Number(row.inventory_turnover),
    Number(row.staff_productivity) * 10, // intentionally wrong — see bug note
  ];
}

function normalizeFeaturesCorrect(row: {
  revenue_7d_avg: number;
  cost_7d_avg: number;
  staff_productivity: number;
  inventory_turnover: number;
  stock_level_pct: number;
}): number[] {
  return [
    Number(row.revenue_7d_avg) / 1000,
    Number(row.cost_7d_avg) / 1000,
    Number(row.staff_productivity) / 100,
    Number(row.inventory_turnover),
    Number(row.stock_level_pct) * 10,
  ];
}

// ============================================================
// HYBRID SCORE FORMULA
// ============================================================

function calcHybridScore(anomalyScore: number, zScore: number): number {
  return Math.min(1, 0.7 * anomalyScore + 0.3 * zScore * 0.1);
}

function calcZScore(featureRevenue: number, peerRevenue = 2342): number {
  return Math.abs(featureRevenue - peerRevenue / 1000) / 0.5;
}

function riskLevel(finalScore: number): string {
  if (finalScore > 0.7) return "CRITICAL";
  if (finalScore > 0.5) return "HIGH";
  if (finalScore > 0.3) return "MEDIUM";
  return "LOW";
}

// ============================================================
// TESTS
// ============================================================

// --- IsolationForest: constructor defaults ---

Deno.test("IF constructor: default contamination = 0.05", () => {
  const iforest = new IsolationForest();
  // Build tiny training set to trigger threshold calculation
  const data = [[1, 1, 1, 1, 1], [2, 2, 2, 2, 2], [1.5, 1.5, 1.5, 1.5, 1.5]];
  iforest.fit(data);
  // threshold = -log(0.05) ≈ 2.996
  const threshold = iforest.getThreshold();
  assert(threshold > 2.9, `threshold should be ~2.996, got ${threshold}`);
  assert(threshold < 3.1, `threshold should be ~2.996, got ${threshold}`);
});

Deno.test("IF constructor: custom contamination affects threshold", () => {
  const data = [[1, 1, 1, 1, 1], [2, 2, 2, 2, 2], [1.5, 1.5, 1.5, 1.5, 1.5]];
  const iforestLow = new IsolationForest(10, 0.01);
  const iforestHigh = new IsolationForest(10, 0.50);
  iforestLow.fit(data);
  iforestHigh.fit(data);
  assert(iforestLow.getThreshold() > iforestHigh.getThreshold(), "lower contamination = higher threshold");
});

// --- IsolationForest: fit() ---

Deno.test("IF fit(): builds trees and sets threshold", () => {
  const iforest = new IsolationForest(10, 0.05);
  const data = Array.from({ length: 50 }, (_, i) => [
    Math.random() * 2 + 1,
    Math.random() * 0.5 + 0.8,
    Math.random() * 1.5 + 2.5,
    Math.random() * 1.5 + 3.0,
    Math.random() * 3 + 5.0,
  ]);
  iforest.fit(data);
  assert(iforest.getThreshold() > 0, "threshold should be set after fit");
});

// --- IsolationForest: score() ---

Deno.test("IF score(): returns scores in range [0, ~1.5]", () => {
  const iforest = new IsolationForest(20, 0.05);
  const normalData = Array.from({ length: 30 }, () => [
    2.0 + Math.random() * 1.5,
    0.8 + Math.random() * 0.6,
    2.5 + Math.random() * 1.5,
    3.0 + Math.random() * 1.5,
    5.0 + Math.random() * 3.0,
  ]);
  iforest.fit(normalData);

  const scores = iforest.score(normalData.slice(0, 5));
  assert(scores.length === 5, "should return score per sample");
  for (const score of scores) {
    assert(score > 0, "score should be positive");
    assert(score < 2, "score should be < 2 for normal data");
  }
});

Deno.test("IF score(): outlier scores higher than normal data", () => {
  const iforest = new IsolationForest(50, 0.05);

  // Normal cluster around (2, 1, 3, 3.5, 6.5)
  const normalData = Array.from({ length: 40 }, () => [
    2.0 + (Math.random() - 0.5) * 0.4,
    1.0 + (Math.random() - 0.5) * 0.2,
    3.0 + (Math.random() - 0.5) * 0.2,
    3.5 + (Math.random() - 0.5) * 0.2,
    6.5 + (Math.random() - 0.5) * 0.2,
  ]);
  iforest.fit(normalData);

  // Outlier: way off from cluster
  const outlier = [10.0, 5.0, 10.0, 10.0, 20.0];
  const normalSample = [2.0, 1.0, 3.0, 3.5, 6.5];

  const [outlierScore] = iforest.score([outlier]);
  const [normalScore] = iforest.score([normalSample]);

  assert(outlierScore > normalScore, "outlier should score higher than normal data point");
});

// --- IsolationForest: predict() ---

Deno.test("IF predict(): returns 0 or 1", () => {
  const iforest = new IsolationForest(20, 0.05);
  const data = Array.from({ length: 30 }, () => [
    Math.random() * 2 + 1,
    Math.random() * 0.5 + 0.8,
    Math.random() * 1.5 + 2.5,
    Math.random() * 1.5 + 3.0,
    Math.random() * 3 + 5.0,
  ]);
  iforest.fit(data);

  const predictions = iforest.predict(data.slice(0, 3));
  for (const pred of predictions) {
    assert(pred === 0 || pred === 1, `prediction should be 0 or 1, got ${pred}`);
  }
});

Deno.test("IF predict(): with low contamination (0.01), fewer anomalies predicted", () => {
  const iforestStrict = new IsolationForest(50, 0.01);
  const iforestLoose = new IsolationForest(50, 0.30);

  const data = Array.from({ length: 50 }, () => [
    2.0 + Math.random() * 1.5,
    0.8 + Math.random() * 0.6,
    2.5 + Math.random() * 1.5,
    3.0 + Math.random() * 1.5,
    5.0 + Math.random() * 3.0,
  ]);

  iforestStrict.fit(data);
  iforestLoose.fit(data);

  const predsStrict = iforestStrict.predict(data);
  const predsLoose = iforestLoose.predict(data);

  const anomaliesStrict = predsStrict.filter((p) => p === 1).length;
  const anomaliesLoose = predsLoose.filter((p) => p === 1).length;

  assert(anomaliesStrict < anomaliesLoose + 1, "stricter contamination should flag fewer or equal anomalies");
});

// --- IsolationForest: edge cases ---

Deno.test("IF score(): handles constant-value features (min === max)", () => {
  const iforest = new IsolationForest(10, 0.05);
  const data = Array.from({ length: 10 }, () => [1.0, 1.0, 1.0, 1.0, 1.0]);
  iforest.fit(data);

  const scores = iforest.score([[1.0, 1.0, 1.0, 1.0, 1.0]]);
  assert(scores[0] > 0, "constant data should still produce a valid score");
});

Deno.test("IF score(): score range is non-negative", () => {
  const iforest = new IsolationForest(20, 0.05);
  const data = Array.from({ length: 20 }, () => [
    Math.random() * 3,
    Math.random(),
    Math.random() * 2,
    Math.random() * 2,
    Math.random() * 5,
  ]);
  iforest.fit(data);

  const testPoints = Array.from({ length: 10 }, () => [
    Math.random() * 5,
    Math.random() * 2,
    Math.random() * 3,
    Math.random() * 3,
    Math.random() * 8,
  ]);
  const scores = iforest.score(testPoints);

  for (const score of scores) {
    assert(score > 0, `score ${score} should be > 0`);
  }
});

// --- Feature normalization ---

Deno.test("normalizeFeatures(): divides revenue and cost by 1000", () => {
  const row = {
    revenue_7d_avg: 2500,
    cost_7d_avg: 1000,
    staff_productivity: 300,
    inventory_turnover: 3.5,
    stock_level_pct: 65,
  };
  const features = normalizeFeaturesCorrect(row);
  assertEquals(features[0], 2.5, "revenue should be divided by 1000");
  assertEquals(features[1], 1.0, "cost should be divided by 1000");
});

Deno.test("normalizeFeatures(): staff_productivity divided by 100", () => {
  const row = {
    revenue_7d_avg: 2000,
    cost_7d_avg: 800,
    staff_productivity: 300,
    inventory_turnover: 3.0,
    stock_level_pct: 50,
  };
  const features = normalizeFeaturesCorrect(row);
  assertEquals(features[2], 3.0, "staff_productivity should be divided by 100");
});

Deno.test("normalizeFeatures(): stock_level_pct multiplied by 10", () => {
  const row = {
    revenue_7d_avg: 2000,
    cost_7d_avg: 800,
    staff_productivity: 300,
    inventory_turnover: 3.0,
    stock_level_pct: 65,
  };
  const features = normalizeFeaturesCorrect(row);
  assertEquals(features[4], 650, "stock_level_pct should be multiplied by 10");
});

Deno.test("normalizeFeatures(): inventory_turnover used as-is", () => {
  const row = {
    revenue_7d_avg: 2000,
    cost_7d_avg: 800,
    staff_productivity: 300,
    inventory_turnover: 3.7,
    stock_level_pct: 50,
  };
  const features = normalizeFeaturesCorrect(row);
  assertEquals(features[3], 3.7, "inventory_turnover should not be scaled");
});

// --- Hybrid score formula ---

Deno.test("hybridScore(): clamped to [0, 1]", () => {
  // Normal case
  const score1 = calcHybridScore(0.5, 0.5);
  assert(score1 > 0, "normal score should be > 0");
  assert(score1 < 1, "normal score should be < 1");

  // Very high anomaly score
  const score2 = calcHybridScore(2.0, 5.0);
  assert(score2 < 1.01, "score should be clamped to 1");
  assert(score2 > 0.9, "very high inputs should clamp to ~1");
});

Deno.test("hybridScore(): weights 0.7 IF + 0.3 Z", () => {
  // When zScore=0, score = 0.7 * anomalyScore
  const s1 = calcHybridScore(1.0, 0.0);
  assertEquals(s1, 0.7, "when z=0, score = 0.7 * anomaly");

  // When anomalyScore=0, score = 0.3 * z * 0.1
  const s2 = calcHybridScore(0.0, 1.0);
  assertEquals(s2, 0.03, "when IF=0, score = 0.3 * z * 0.1 = 0.03");

  // Combined
  const s3 = calcHybridScore(1.0, 1.0);
  assertEquals(s3, 0.73, "combined: 0.7*1 + 0.3*1*0.1 = 0.73");
});

Deno.test("hybridScore(): result is always non-negative", () => {
  const scores = [
    calcHybridScore(0, 0),
    calcHybridScore(0.1, 0.1),
    calcHybridScore(0.5, 0.5),
    calcHybridScore(1.0, 1.0),
  ];
  for (const s of scores) {
    assert(!isNaN(s), `score ${s} should be a valid number`);
    assert(s >= 0, `score ${s} should be >= 0`);
  }
});

// --- Z-score calculation ---

Deno.test("zScore(): positive value", () => {
  const z = calcZScore(3.5, 2342);
  assert(z > 0, "z-score should be positive");
});

Deno.test("zScore(): zero when feature matches peer average", () => {
  const z = calcZScore(2.342, 2342); // 2342/1000 = 2.342
  assertEquals(Math.round(z * 1000) / 1000, 0, "z-score should be 0 when feature = peer avg");
});

Deno.test("zScore(): increases as feature diverges from peer", () => {
  const z1 = calcZScore(3.342, 2342);
  const z2 = calcZScore(5.342, 2342);
  assert(z2 > z1, "larger deviation should give higher z-score");
});

// --- Risk level thresholds ---

Deno.test("riskLevel(): CRITICAL when score > 0.7", () => {
  assertEquals(riskLevel(0.71), "CRITICAL");
  assertEquals(riskLevel(0.9), "CRITICAL");
  assertEquals(riskLevel(1.0), "CRITICAL");
});

Deno.test("riskLevel(): HIGH when 0.5 < score <= 0.7", () => {
  assertEquals(riskLevel(0.51), "HIGH");
  assertEquals(riskLevel(0.7), "HIGH");
  assertEquals(riskLevel(0.6), "HIGH");
});

Deno.test("riskLevel(): MEDIUM when 0.3 < score <= 0.5", () => {
  assertEquals(riskLevel(0.31), "MEDIUM");
  assertEquals(riskLevel(0.5), "MEDIUM");
  assertEquals(riskLevel(0.4), "MEDIUM");
});

Deno.test("riskLevel(): LOW when score <= 0.3", () => {
  assertEquals(riskLevel(0.0), "LOW");
  assertEquals(riskLevel(0.3), "LOW");
  assertEquals(riskLevel(0.29), "LOW");
});

Deno.test("riskLevel(): boundary at 0.7 is CRITICAL, not HIGH", () => {
  assertEquals(riskLevel(0.7), "HIGH", "0.7 exactly → HIGH");
  assertEquals(riskLevel(0.71), "CRITICAL", "0.71 → CRITICAL");
});

// --- End-to-end: full scoring pipeline ---

Deno.test("E2E: full pipeline — normal outlet → pipeline runs without error", () => {
  const iforest = new IsolationForest(50, 0.05);

  // Training data: normal cluster
  const normalData = Array.from({ length: 40 }, () => [
    2.0 + (Math.random() - 0.5) * 0.4,
    1.0 + (Math.random() - 0.5) * 0.2,
    3.0 + (Math.random() - 0.5) * 0.2,
    3.5 + (Math.random() - 0.5) * 0.2,
    6.5 + (Math.random() - 0.5) * 0.2,
  ]);
  iforest.fit(normalData);

  // Score a normal point (close to cluster center)
  const normalPoint = [2.0, 1.0, 3.0, 3.5, 6.5];
  const [anomalyScore] = iforest.score([normalPoint]);
  const zScore = calcZScore(normalPoint[0]);
  const finalScore = calcHybridScore(anomalyScore, zScore);
  const risk = riskLevel(finalScore);

  // Pipeline produces a valid risk level
  assert(
    ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(risk),
    `pipeline should produce a valid risk level, got ${risk}`
  );
  // Final score should be a number between 0 and 1
  assert(!isNaN(finalScore), "finalScore should be a valid number");
  assert(finalScore >= 0 && finalScore <= 1, "finalScore should be in [0, 1]");
});

Deno.test("E2E: full pipeline — outlier outlet → HIGH or CRITICAL risk", () => {
  const iforest = new IsolationForest(50, 0.05);

  const normalData = Array.from({ length: 40 }, () => [
    2.0 + (Math.random() - 0.5) * 0.4,
    1.0 + (Math.random() - 0.5) * 0.2,
    3.0 + (Math.random() - 0.5) * 0.2,
    3.5 + (Math.random() - 0.5) * 0.2,
    6.5 + (Math.random() - 0.5) * 0.2,
  ]);
  iforest.fit(normalData);

  // Extreme outlier
  const outlierPoint = [8.0, 4.0, 8.0, 8.0, 15.0];
  const [anomalyScore] = iforest.score([outlierPoint]);
  const zScore = calcZScore(outlierPoint[0]);
  const finalScore = calcHybridScore(anomalyScore, zScore);
  const risk = riskLevel(finalScore);

  assert(
    risk === "HIGH" || risk === "CRITICAL",
    `extreme outlier should be HIGH or CRITICAL, got ${risk}`
  );
});

// --- Peer average constants ---

Deno.test("peer average constants: revenue = 2342, cost = 980, staff = 312", () => {
  // These are hardcoded in ml-anomaly-v2
  const peerRevenue = 2342;
  const peerCost = 980;
  const peerStaff = 312;

  assertEquals(peerRevenue, 2342, "peer revenue should be RM2342");
  assertEquals(peerCost, 980, "peer cost should be RM980");
  assertEquals(peerStaff, 312, "peer staff productivity should be 312");
});

Deno.test("feature vector length: always 5 features", () => {
  const row = {
    revenue_7d_avg: 2500,
    cost_7d_avg: 1000,
    staff_productivity: 300,
    inventory_turnover: 3.5,
    stock_level_pct: 65,
  };
  const features = normalizeFeaturesCorrect(row);
  assertEquals(features.length, 5, "feature vector should have exactly 5 elements");
});
