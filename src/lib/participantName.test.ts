import { describe, expect, it } from "vitest";
import {
  isDuplicateParticipantName,
  normalizeParticipantName,
  sanitizeParticipantName,
} from "./participantName";

describe("participantName", () => {
  it("normalizes case and repeated whitespace", () => {
    expect(normalizeParticipantName("  Alice   Smith ")).toBe("alice smith");
  });

  it("sanitizes whitespace while keeping case", () => {
    expect(sanitizeParticipantName("  Alice   Smith ")).toBe("Alice Smith");
  });

  it("detects duplicates in a case-insensitive and whitespace-insensitive way", () => {
    expect(
      isDuplicateParticipantName(["Alice Smith", "Bob"], "  alice   smith "),
    ).toBe(true);
  });

  it("does not flag different names as duplicates", () => {
    expect(isDuplicateParticipantName(["Alice", "Bob"], "Charlie")).toBe(false);
  });
});
