/**
 * Case Create - Unit Tests
 * Tests for case creation business logic
 */

// Constants
const SLA_HOURS = {
  P1_CRITICAL: 4,
  P2_HIGH: 24,
  P3_MEDIUM: 72,
  P4_LOW: 168, // 1 week
};

const CASE_STATUS = {
  OPEN: "OPEN",
  IN_PROGRESS: "IN_PROGRESS",
  RESOLVED: "RESOLVED",
  CLOSED: "CLOSED",
};

const PRIORITY = {
  P1_CRITICAL: 1,
  P2_HIGH: 2,
  P3_MEDIUM: 3,
  P4_LOW: 4,
};

// Helper functions
function calculateSLADeadline(priority: string, createdAt: Date): Date {
  const hours = SLA_HOURS[priority as keyof typeof SLA_HOURS] || SLA_HOURS.P3_MEDIUM;
  return new Date(createdAt.getTime() + hours * 60 * 60 * 1000);
}

function validateCaseCreateInput(input: any): string[] {
  const errors: string[] = [];
  
  if (!input.alert_id && !input.title) {
    errors.push("Either alert_id or title is required");
  }
  
  if (input.alert_id !== undefined && (typeof input.alert_id !== "number" || input.alert_id <= 0)) {
    errors.push("alert_id must be a positive number");
  }
  
  if (input.title !== undefined && (typeof input.title !== "string" || input.title.length < 3)) {
    errors.push("title must be at least 3 characters");
  }
  
  if (input.title !== undefined && input.title.length > 200) {
    errors.push("title must be less than 200 characters");
  }
  
  if (input.priority !== undefined) {
    const validPriorities = Object.keys(PRIORITY);
    if (!validPriorities.includes(input.priority)) {
      errors.push(`priority must be one of: ${validPriorities.join(", ")}`);
    }
  }
  
  if (input.assigned_to_id !== undefined && typeof input.assigned_to_id !== "string") {
    errors.push("assigned_to_id must be a UUID string");
  }
  
  return errors;
}

function determinePriority(alertSeverity: string): string {
  const mapping: Record<string, string> = {
    P1_CRITICAL: "P1_CRITICAL",
    P2_HIGH: "P2_HIGH",
    P3_MEDIUM: "P3_MEDIUM",
    P4_LOW: "P4_LOW",
  };
  return mapping[alertSeverity] || "P3_MEDIUM";
}

function isSLAOverdue(deadline: Date, currentTime: Date): boolean {
  return currentTime > deadline;
}

function calculateRemainingSLAMinutes(deadline: Date, currentTime: Date): number {
  const remaining = deadline.getTime() - currentTime.getTime();
  return Math.max(0, Math.floor(remaining / (60 * 1000)));
}

function calculateSLAProgress(createdAt: Date, deadline: Date, currentTime: Date): number {
  const total = deadline.getTime() - createdAt.getTime();
  const elapsed = currentTime.getTime() - createdAt.getTime();
  return Math.min(100, Math.max(0, (elapsed / total) * 100));
}

Deno.test("calculateSLADeadline - P1 critical", () => {
  const created = new Date("2026-07-16T10:00:00Z");
  const deadline = calculateSLADeadline("P1_CRITICAL", created);
  
  assertEquals(deadline.toISOString(), "2026-07-16T14:00:00.000Z"); // +4 hours
});

Deno.test("calculateSLADeadline - P2 high", () => {
  const created = new Date("2026-07-16T10:00:00Z");
  const deadline = calculateSLADeadline("P2_HIGH", created);
  
  assertEquals(deadline.toISOString(), "2026-07-17T10:00:00.000Z"); // +24 hours
});

Deno.test("calculateSLADeadline - P3 medium", () => {
  const created = new Date("2026-07-16T10:00:00Z");
  const deadline = calculateSLADeadline("P3_MEDIUM", created);
  
  assertEquals(deadline.toISOString(), "2026-07-19T10:00:00.000Z"); // +72 hours
});

Deno.test("calculateSLADeadline - P4 low", () => {
  const created = new Date("2026-07-16T10:00:00Z");
  const deadline = calculateSLADeadline("P4_LOW", created);
  
  assertEquals(deadline.toISOString(), "2026-07-23T10:00:00.000Z"); // +168 hours
});

Deno.test("calculateSLADeadline - unknown priority uses P3", () => {
  const created = new Date("2026-07-16T10:00:00Z");
  const deadline = calculateSLADeadline("UNKNOWN", created);
  
  assertEquals(deadline.toISOString(), "2026-07-19T10:00:00.000Z"); // P3 = 72 hours
});

Deno.test("validateCaseCreateInput - valid with alert_id", () => {
  const errors = validateCaseCreateInput({ alert_id: 1 });
  
  assertEquals(errors.length, 0);
});

Deno.test("validateCaseCreateInput - valid with title", () => {
  const errors = validateCaseCreateInput({ title: "Fix this issue" });
  
  assertEquals(errors.length, 0);
});

Deno.test("validateCaseCreateInput - missing both", () => {
  const errors = validateCaseCreateInput({});
  
  assertEquals(errors.includes("Either alert_id or title is required"), true);
});

Deno.test("validateCaseCreateInput - invalid alert_id type", () => {
  const errors = validateCaseCreateInput({ alert_id: "not-a-number" });
  
  assertEquals(errors.includes("alert_id must be a positive number"), true);
});

Deno.test("validateCaseCreateInput - invalid alert_id zero", () => {
  const errors = validateCaseCreateInput({ alert_id: 0 });
  
  assertEquals(errors.includes("alert_id must be a positive number"), true);
});

Deno.test("validateCaseCreateInput - title too short", () => {
  const errors = validateCaseCreateInput({ title: "Hi" });
  
  assertEquals(errors.includes("title must be at least 3 characters"), true);
});

Deno.test("validateCaseCreateInput - title too long", () => {
  const errors = validateCaseCreateInput({ title: "x".repeat(201) });
  
  assertEquals(errors.includes("title must be less than 200 characters"), true);
});

Deno.test("validateCaseCreateInput - invalid priority", () => {
  const errors = validateCaseCreateInput({ alert_id: 1, priority: "P5" });
  
  assertEquals(errors.includes("priority must be one of: P1_CRITICAL, P2_HIGH, P3_MEDIUM, P4_LOW"), true);
});

Deno.test("validateCaseCreateInput - invalid assigned_to_id type", () => {
  const errors = validateCaseCreateInput({ alert_id: 1, assigned_to_id: 123 });
  
  assertEquals(errors.includes("assigned_to_id must be a UUID string"), true);
});

Deno.test("determinePriority - P1_CRITICAL", () => {
  const priority = determinePriority("P1_CRITICAL");
  
  assertEquals(priority, "P1_CRITICAL");
});

Deno.test("determinePriority - unknown uses P3_MEDIUM", () => {
  const priority = determinePriority("UNKNOWN");
  
  assertEquals(priority, "P3_MEDIUM");
});

Deno.test("isSLAOverdue - not overdue", () => {
  const deadline = new Date("2026-07-17T00:00:00Z");
  const current = new Date("2026-07-16T12:00:00Z");
  
  const overdue = isSLAOverdue(deadline, current);
  
  assertEquals(overdue, false);
});

Deno.test("isSLAOverdue - is overdue", () => {
  const deadline = new Date("2026-07-16T00:00:00Z");
  const current = new Date("2026-07-16T12:00:00Z");
  
  const overdue = isSLAOverdue(deadline, current);
  
  assertEquals(overdue, true);
});

Deno.test("calculateRemainingSLAMinutes - 60 minutes remaining", () => {
  const deadline = new Date("2026-07-16T11:00:00Z");
  const current = new Date("2026-07-16T10:00:00Z");
  
  const remaining = calculateRemainingSLAMinutes(deadline, current);
  
  assertEquals(remaining, 60);
});

Deno.test("calculateRemainingSLAMinutes - negative returns 0", () => {
  const deadline = new Date("2026-07-16T10:00:00Z");
  const current = new Date("2026-07-16T12:00:00Z");
  
  const remaining = calculateRemainingSLAMinutes(deadline, current);
  
  assertEquals(remaining, 0);
});

Deno.test("calculateSLAProgress - 50%", () => {
  const created = new Date("2026-07-16T10:00:00Z");
  const deadline = new Date("2026-07-16T14:00:00Z"); // 4 hours
  const current = new Date("2026-07-16T12:00:00Z"); // 2 hours in
  
  const progress = calculateSLAProgress(created, deadline, current);
  
  assertEquals(progress, 50);
});

Deno.test("calculateSLAProgress - 0% at start", () => {
  const created = new Date("2026-07-16T10:00:00Z");
  const deadline = new Date("2026-07-16T14:00:00Z");
  const current = new Date("2026-07-16T10:00:00Z");
  
  const progress = calculateSLAProgress(created, deadline, current);
  
  assertEquals(progress, 0);
});

Deno.test("calculateSLAProgress - 100% at end", () => {
  const created = new Date("2026-07-16T10:00:00Z");
  const deadline = new Date("2026-07-16T14:00:00Z");
  const current = new Date("2026-07-16T14:00:00Z");
  
  const progress = calculateSLAProgress(created, deadline, current);
  
  assertEquals(progress, 100);
});

function assertEquals(actual: any, expected: any) {
  if (actual !== expected) {
    throw new Error(`Expected ${expected}, got ${actual}`);
  }
}
