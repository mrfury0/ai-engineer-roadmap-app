import { describe, expect, it } from "vitest";
import { addDays, daysBetween, formatDate, humanMinutes, todayIso } from "./dates";

describe("todayIso", () => {
  it("formats a Date as zero-padded YYYY-MM-DD in local terms", () => {
    expect(todayIso(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(todayIso(new Date(2026, 11, 31))).toBe("2026-12-31");
  });

  it("uses local calendar fields, not UTC, so a late-evening date is not pushed forward", () => {
    expect(todayIso(new Date(2026, 8, 6, 23, 30))).toBe("2026-09-06");
  });

  it("defaults to now", () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("daysBetween", () => {
  it("counts forwards and backwards", () => {
    expect(daysBetween("2026-01-01", "2026-01-08")).toBe(7);
    expect(daysBetween("2026-01-08", "2026-01-01")).toBe(-7);
    expect(daysBetween("2026-01-01", "2026-01-01")).toBe(0);
  });

  it("crosses month boundaries", () => {
    expect(daysBetween("2026-01-31", "2026-02-01")).toBe(1);
    expect(daysBetween("2026-04-30", "2026-05-01")).toBe(1);
    // 2026 is not a leap year, so February has 28 days.
    expect(daysBetween("2026-02-28", "2026-03-01")).toBe(1);
    // 2024 is, so the same span is a day longer.
    expect(daysBetween("2024-02-28", "2024-03-01")).toBe(2);
  });

  it("crosses a year boundary", () => {
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
    expect(daysBetween("2026-01-01", "2027-01-01")).toBe(365);
  });

  it("survives a DST transition without drifting to 0 or 2", () => {
    // Rounding, rather than flooring, is what keeps a 23- or 25-hour day at exactly 1.
    expect(daysBetween("2026-03-28", "2026-03-29")).toBe(1);
    expect(daysBetween("2026-10-24", "2026-10-25")).toBe(1);
  });
});

describe("addDays", () => {
  it("adds and subtracts", () => {
    expect(addDays("2026-01-01", 3)).toBe("2026-01-04");
    expect(addDays("2026-01-04", -3)).toBe("2026-01-01");
    expect(addDays("2026-01-01", 0)).toBe("2026-01-01");
  });

  it("rolls over a month boundary", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
  });

  it("handles the leap day", () => {
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2024-02-29", 1)).toBe("2024-03-01");
    expect(addDays("2024-01-31", 29)).toBe("2024-02-29");
  });

  it("rolls over a year boundary", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
    // The longest SRS step, applied at the end of a year.
    expect(addDays("2026-12-20", 35)).toBe("2027-01-24");
  });

  it("round-trips with daysBetween", () => {
    expect(daysBetween("2026-06-10", addDays("2026-06-10", 16))).toBe(16);
  });
});

describe("humanMinutes", () => {
  it("keeps sub-hour values in minutes", () => {
    expect(humanMinutes(45)).toBe("45m");
    expect(humanMinutes(0)).toBe("0m");
    expect(humanMinutes(59)).toBe("59m");
  });

  it("drops the minutes component when it is zero", () => {
    expect(humanMinutes(60)).toBe("1h");
    expect(humanMinutes(120)).toBe("2h");
  });

  it("shows hours and minutes together otherwise", () => {
    expect(humanMinutes(90)).toBe("1h 30m");
    expect(humanMinutes(155)).toBe("2h 35m");
  });
});

describe("formatDate", () => {
  it("renders a readable day-month-year with no leading zero on the day", () => {
    // The month abbreviation is ICU-dependent ("Sep" or "Sept"), so match the shape.
    expect(formatDate("2026-09-06")).toMatch(/^6 Sept? 2026$/);
    expect(formatDate("2026-12-25")).toMatch(/^25 Dec 2026$/);
  });

  it("reads the date in local terms, not UTC — 1 January stays 1 January", () => {
    expect(formatDate("2026-01-01")).toMatch(/^1 Jan 2026$/);
  });

  it("returns an em dash for every empty input rather than 'Invalid Date'", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
    expect(formatDate("")).toBe("—");
  });
});
