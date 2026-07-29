# CyberQuote MVP - Unit Tests

## Overview

This directory contains unit tests for the CyberQuote MVP edge functions.

## Test Structure

```
tests/
├── README.md              # This file
├── ml_anomaly_score_test.ts   # Anomaly detection tests
├── ml_stockout_risk_test.ts   # Stockout prediction tests
├── alert_generator_test.ts     # Alert validation tests
├── case_create_test.ts         # Case creation tests
└── run_tests.sh               # Test runner script
```

## Running Tests

### Run All Tests

```bash
cd ~/CyberquoteWeb/unified-ai-CQ
deno test --allow-all tests/
```

### Run Specific Test File

```bash
deno test --allow-all tests/ml_anomaly_score_test.ts
```

### Run with Coverage

```bash
deno test --allow-all --coverage=coverage tests/
```

## Test Categories

### ML Tests

- **ml_anomaly_score_test.ts** - Tests for Z-score anomaly detection
  - Statistics calculation
  - Z-score calculation
  - Percentile calculation
  - Edge cases (empty data, zero std_dev)

- **ml_stockout_risk_test.ts** - Tests for stockout prediction
  - Velocity calculation
  - Risk score calculation
  - Risk level classification
  - Recommended order calculation

### Business Logic Tests

- **alert_generator_test.ts** - Tests for alert validation
  - Outlet ID validation
  - Trigger type validation
  - Threshold validation
  - Sales amount validation
  - Severity validation

- **case_create_test.ts** - Tests for case creation
  - SLA deadline calculation
  - Input validation
  - Priority determination
  - SLA overdue detection
  - SLA progress calculation

## Test Coverage

| Function         | Coverage              | Status |
| ---------------- | --------------------- | ------ |
| ml-anomaly-score | Statistical functions | ✅     |
| ml-stockout-risk | Velocity & risk logic | ✅     |
| alert-generator  | Validation logic      | ✅     |
| case-create      | Business logic        | ✅     |

## Adding New Tests

1. Create a new test file: `tests/<function_name>_test.ts`
2. Use Deno's built-in test framework:

```typescript
Deno.test("test name", () => {
  // Test code
  assertEquals(actual, expected);
});
```

3. Run the tests to verify

## CI Integration

Tests can be run in CI using:

```yaml
# GitHub Actions example
- name: Run Tests
  run: |
    cd ~/CyberquoteWeb/unified-ai-CQ
    deno test --allow-all tests/
```

## Notes

- Tests use Deno's built-in test runner
- Tests are standalone and don't require Supabase connection
- Mock Supabase client not needed for unit tests
- Integration tests are marked with `ignore: true` and can be enabled manually
