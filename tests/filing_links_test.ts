/// <reference lib="deno.ns" />

/**
 * Unit Tests for Filing Links Validation Logic
 * Tests the filing status determination
 */

// Helper function
function assertEquals(actual: any, expected: any) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

interface FilingLinks {
  sg?: {
    acra_bizfile?: string;
    acra_xbrl?: string;
  };
  id?: {
    ahu_annual?: string;
    oss_lkpm?: string;
    djp_spt?: string;
  };
}

function determineFilingStatus(filingLinks: FilingLinks): { status: string; hasLinks: boolean } {
  const sgLinks = filingLinks.sg;
  const idLinks = filingLinks.id;
  
  const hasSGLink = sgLinks && (sgLinks.acra_bizfile || sgLinks.acra_xbrl);
  const hasIDLink = idLinks && (idLinks.ahu_annual || idLinks.oss_lkpm || idLinks.djp_spt);
  
  const hasLinks = !!(hasSGLink || hasIDLink);
  
  return {
    status: hasLinks ? 'FILED' : 'PENDING',
    hasLinks,
  };
}

function validateFilingLink(url: string, platform: string): boolean {
  if (!url) return false;
  
  try {
    const parsed = new URL(url);
    
    const validDomains: Record<string, string[]> = {
      'acra_bizfile': ['bizfile.gov.sg'],
      'acra_xbrl': ['bizfile.gov.sg'],
      'ahu_annual': ['ahu.go.id'],
      'oss_lkpm': ['oss.go.id'],
      'djp_spt': ['pajak.go.id'],
    };
    
    const domains = validDomains[platform] || [];
    if (domains.length === 0) return true;
    
    return domains.some(d => parsed.hostname.includes(d));
  } catch {
    return false;
  }
}

// Tests for determineFilingStatus
Deno.test("filing-links: Empty links - PENDING", () => {
  const result = determineFilingStatus({});
  assertEquals(result.status, 'PENDING');
  assertEquals(result.hasLinks, false);
});

Deno.test("filing-links: SG ACRA BizFile filled - FILED", () => {
  const result = determineFilingStatus({
    sg: { acra_bizfile: 'https://bizfile.gov.sg/test' }
  });
  assertEquals(result.status, 'FILED');
  assertEquals(result.hasLinks, true);
});

Deno.test("filing-links: SG ACRA XBRL filled - FILED", () => {
  const result = determineFilingStatus({
    sg: { acra_xbrl: 'https://bizfile.gov.sg/test' }
  });
  assertEquals(result.status, 'FILED');
  assertEquals(result.hasLinks, true);
});

Deno.test("filing-links: ID AHU filled - FILED", () => {
  const result = determineFilingStatus({
    id: { ahu_annual: 'https://ahu.go.id/test' }
  });
  assertEquals(result.status, 'FILED');
  assertEquals(result.hasLinks, true);
});

Deno.test("filing-links: ID OSS LKPM filled - FILED", () => {
  const result = determineFilingStatus({
    id: { oss_lkpm: 'https://oss.go.id/test' }
  });
  assertEquals(result.status, 'FILED');
  assertEquals(result.hasLinks, true);
});

Deno.test("filing-links: ID DJP SPT filled - FILED", () => {
  const result = determineFilingStatus({
    id: { djp_spt: 'https://pajak.go.id/test' }
  });
  assertEquals(result.status, 'FILED');
  assertEquals(result.hasLinks, true);
});

Deno.test("filing-links: All ID links filled - FILED", () => {
  const result = determineFilingStatus({
    id: {
      ahu_annual: 'https://ahu.go.id/test',
      oss_lkpm: 'https://oss.go.id/test',
      djp_spt: 'https://pajak.go.id/test'
    }
  });
  assertEquals(result.status, 'FILED');
  assertEquals(result.hasLinks, true);
});

Deno.test("filing-links: SG and ID both filled - FILED", () => {
  const result = determineFilingStatus({
    sg: { acra_bizfile: 'https://bizfile.gov.sg/test' },
    id: { ahu_annual: 'https://ahu.go.id/test' }
  });
  assertEquals(result.status, 'FILED');
  assertEquals(result.hasLinks, true);
});

Deno.test("filing-links: SG null values - PENDING", () => {
  const result = determineFilingStatus({
    sg: { acra_bizfile: null as any, acra_xbrl: null as any }
  });
  assertEquals(result.status, 'PENDING');
  assertEquals(result.hasLinks, false);
});

// Tests for validateFilingLink
Deno.test("validate-link: Valid bizfile.gov.sg URL", () => {
  const result = validateFilingLink('https://bizfile.gov.sg/rapor/123', 'acra_bizfile');
  assertEquals(result, true);
});

Deno.test("validate-link: Valid ahu.go.id URL", () => {
  const result = validateFilingLink('https://ahu.go.id/sertifikat/456', 'ahu_annual');
  assertEquals(result, true);
});

Deno.test("validate-link: Valid oss.go.id URL", () => {
  const result = validateFilingLink('https://oss.go.id/lkpm/789', 'oss_lkpm');
  assertEquals(result, true);
});

Deno.test("validate-link: Valid pajak.go.id URL", () => {
  const result = validateFilingLink('https://pajak.go.id/spt/abc', 'djp_spt');
  assertEquals(result, true);
});

Deno.test("validate-link: Wrong domain - FAIL", () => {
  const result = validateFilingLink('https://google.com/fake', 'acra_bizfile');
  assertEquals(result, false);
});

Deno.test("validate-link: Empty URL", () => {
  const result = validateFilingLink('', 'acra_bizfile');
  assertEquals(result, false);
});

Deno.test("validate-link: Invalid URL", () => {
  const result = validateFilingLink('not-a-url', 'acra_bizfile');
  assertEquals(result, false);
});

Deno.test("validate-link: Subdomain accepted", () => {
  const result = validateFilingLink('https://sub.bizfile.gov.sg/test', 'acra_bizfile');
  assertEquals(result, true);
});
