/// <reference lib="deno.ns" />

/**
 * Unit Tests for check-required-docs Edge Function
 * Tests the regulatory document validation logic
 */

// Helper function
function assertEquals(actual: any, expected: any) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// Required docs by country
const REQUIRED_DOCS: Record<string, string[]> = {
  SGP: ['SGP_ACRA_ANNUAL', 'SGP_ACRA_XBRL'],
  IDN: ['IDN_AHU_ANNUAL', 'IDN_LKPM_Q1', 'IDN_LKPM_Q2', 'IDN_LKPM_Q3', 'IDN_LKPM_Q4', 'IDN_DJP_SPT'],
};

// Mock function to check required documents
function checkRequiredDocs(entityId: string, country: string, uploadedDocs: string[]) {
  const required = REQUIRED_DOCS[country] || [];
  
  if (required.length === 0) {
    return { valid: true, missing_docs: [], message: 'No required docs for this country' };
  }
  
  const missing = required.filter(doc => !uploadedDocs.includes(doc));
  
  return {
    valid: missing.length === 0,
    missing_docs: missing,
    uploaded_docs: uploadedDocs.filter(doc => required.includes(doc)),
    message: missing.length === 0 
      ? 'All required documents uploaded' 
      : `Missing ${missing.length} required document(s)`,
  };
}

Deno.test("check-required-docs: Singapore - All docs uploaded", () => {
  const result = checkRequiredDocs("user-123", "SGP", ["SGP_ACRA_ANNUAL", "SGP_ACRA_XBRL"]);
  assertEquals(result.valid, true);
  assertEquals(result.missing_docs, []);
});

Deno.test("check-required-docs: Singapore - Missing one doc", () => {
  const result = checkRequiredDocs("user-123", "SGP", ["SGP_ACRA_ANNUAL"]);
  assertEquals(result.valid, false);
  assertEquals(result.missing_docs, ["SGP_ACRA_XBRL"]);
});

Deno.test("check-required-docs: Singapore - Missing all docs", () => {
  const result = checkRequiredDocs("user-123", "SGP", []);
  assertEquals(result.valid, false);
  assertEquals(result.missing_docs, ["SGP_ACRA_ANNUAL", "SGP_ACRA_XBRL"]);
});

Deno.test("check-required-docs: Singapore - Wrong docs uploaded", () => {
  const result = checkRequiredDocs("user-123", "SGP", ["IDN_AHU_ANNUAL", "IDN_DJP_SPT"]);
  assertEquals(result.valid, false);
  assertEquals(result.missing_docs, ["SGP_ACRA_ANNUAL", "SGP_ACRA_XBRL"]);
});

Deno.test("check-required-docs: Indonesia - All docs uploaded", () => {
  const result = checkRequiredDocs("user-123", "IDN", [
    "IDN_AHU_ANNUAL", "IDN_LKPM_Q1", "IDN_LKPM_Q2", "IDN_LKPM_Q3", "IDN_LKPM_Q4", "IDN_DJP_SPT"
  ]);
  assertEquals(result.valid, true);
  assertEquals(result.missing_docs, []);
});

Deno.test("check-required-docs: Indonesia - Missing LKPM Q3", () => {
  const result = checkRequiredDocs("user-123", "IDN", [
    "IDN_AHU_ANNUAL", "IDN_LKPM_Q1", "IDN_LKPM_Q2", "IDN_LKPM_Q4", "IDN_DJP_SPT"
  ]);
  assertEquals(result.valid, false);
  assertEquals(result.missing_docs, ["IDN_LKPM_Q3"]);
});

Deno.test("check-required-docs: Indonesia - No docs uploaded", () => {
  const result = checkRequiredDocs("user-123", "IDN", []);
  assertEquals(result.valid, false);
  assertEquals(result.missing_docs.length, 6);
});

Deno.test("check-required-docs: Unknown country", () => {
  const result = checkRequiredDocs("user-123", "XXX", []);
  assertEquals(result.valid, true);
  assertEquals(result.missing_docs, []);
});

Deno.test("check-required-docs: Mixed SG and ID docs", () => {
  const result = checkRequiredDocs("user-123", "SGP", ["SGP_ACRA_ANNUAL", "IDN_AHU_ANNUAL", "IDN_DJP_SPT"]);
  assertEquals(result.valid, false);
  assertEquals(result.missing_docs, ["SGP_ACRA_XBRL"]);
  assertEquals(result.uploaded_docs, ["SGP_ACRA_ANNUAL"]);
});
