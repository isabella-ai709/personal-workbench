import { describe, expect, it } from "vitest";

import { reminderSeverity } from "../../src/server/modules/notifications/notification-scanner";

describe("reminderSeverity", () => {
  const now = new Date("2026-08-20T01:00:00.000Z");

  it("uses source-specific natural-day windows", () => {
    expect(reminderSeverity("2026-08-23T12:00:00+08:00", now, 3)).toBe("important");
    expect(reminderSeverity("2026-08-24T12:00:00+08:00", now, 3)).toBeNull();
    expect(reminderSeverity("2026-08-27T12:00:00+08:00", now, 7)).toBe("important");
    expect(reminderSeverity("2026-08-28T12:00:00+08:00", now, 7)).toBeNull();
  });

  it("upgrades reminders due today or overdue", () => {
    expect(reminderSeverity("2026-08-20T23:00:00+08:00", now, 7)).toBe("urgent");
    expect(reminderSeverity("2026-08-19T23:00:00+08:00", now, 7)).toBe("urgent");
  });
});
