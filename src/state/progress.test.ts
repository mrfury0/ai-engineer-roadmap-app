import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  SRS_STEPS, STORAGE_KEY, daysAway, emptyProgress, gradeFlashcard, loadProgress,
  safeStorage, saveProgress, scheduleSrs, touchDay, type Progress,
} from "./progress";

/** A minimal in-memory Storage; `impl` overrides just the methods a test cares about. */
function fakeStorage(impl: Partial<Storage> = {}): Storage {
  const map = new Map<string, string>();
  const base: Storage = {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => { map.delete(k); },
    setItem: (k, v) => { map.set(k, v); },
  };
  return { ...base, ...impl } as Storage;
}

const explodes = (): never => { throw new Error("SecurityError: storage is disabled"); };

describe("emptyProgress", () => {
  it("returns a fully-populated v1 record with no undefined containers", () => {
    const p = emptyProgress();
    expect(p.v).toBe(1);
    expect(p.pace).toBe("recommended");
    expect(p.startedAt).toBeNull();
    expect(p.lastActive).toBeNull();
    expect(p.lastItem).toBeNull();
    expect(p.minutes).toBe(0);
    expect(p.streak).toBe(0);
    expect(p.best).toBe(0);
    expect(p.xpBonus).toBe(0);
    expect(p.sessions).toEqual([]);
    for (const key of [
      "done", "status", "confidence", "notes", "quiz", "tickets", "cases",
      "interview", "flash", "srs", "portfolio", "projStatus", "assessment",
    ] as const) {
      expect(p[key], key).toEqual({});
    }
  });

  it("hands out a fresh object each call, so one learner's state cannot leak into another", () => {
    const a = emptyProgress();
    a.done["w1d1a"] = "2026-01-01";
    expect(emptyProgress().done).toEqual({});
  });
});

describe("loadProgress", () => {
  it("returns defaults when nothing has been stored yet", () => {
    expect(loadProgress(fakeStorage())).toEqual(emptyProgress());
  });

  it("returns defaults when the stored JSON is corrupt", () => {
    const s = fakeStorage();
    s.setItem(STORAGE_KEY, "{not json at all");
    expect(loadProgress(s)).toEqual(emptyProgress());
  });

  it("returns defaults when storage itself throws", () => {
    expect(loadProgress(fakeStorage({ getItem: explodes }))).toEqual(emptyProgress());
  });

  it("merges a partial saved record over the defaults, so a new field is never undefined", () => {
    const s = fakeStorage();
    s.setItem(STORAGE_KEY, JSON.stringify({ done: { w1d1a: "2026-01-02" }, streak: 4 }));
    const p = loadProgress(s);
    expect(p.done).toEqual({ w1d1a: "2026-01-02" });
    expect(p.streak).toBe(4);
    expect(p.sessions).toEqual([]);
    expect(p.pace).toBe("recommended");
  });

  it("forces the schema version to 1 whatever the file claims", () => {
    const s = fakeStorage();
    s.setItem(STORAGE_KEY, JSON.stringify({ v: 99, minutes: 10 }));
    expect(loadProgress(s).v).toBe(1);
  });
});

describe("saveProgress", () => {
  it("writes JSON under the storage key and reports success", () => {
    const s = fakeStorage();
    const p = { ...emptyProgress(), minutes: 42 };
    expect(saveProgress(p, s)).toBe(true);
    expect(JSON.parse(s.getItem(STORAGE_KEY) ?? "null")).toEqual(p);
  });

  it("returns false rather than throwing when storage throws (private mode, quota)", () => {
    expect(saveProgress(emptyProgress(), fakeStorage({ setItem: explodes }))).toBe(false);
  });

  it("round-trips through loadProgress", () => {
    const s = fakeStorage();
    const p: Progress = { ...emptyProgress(), streak: 3, notes: { w1d1a: "uv lockfiles" } };
    saveProgress(p, s);
    expect(loadProgress(s)).toEqual(p);
  });
});

describe("safeStorage", () => {
  /** Replaces window.localStorage for the duration of `fn`. */
  function withLocalStorage(get: () => Storage, fn: () => void) {
    const original = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", { configurable: true, get });
    try { fn(); } finally {
      if (original) Object.defineProperty(window, "localStorage", original);
    }
  }

  it("returns undefined when touching localStorage throws, and the loaders degrade quietly", () => {
    withLocalStorage(explodes, () => {
      expect(safeStorage()).toBeUndefined();
      // No arguments: the defaults resolve through safeStorage(), so the app still boots.
      expect(loadProgress()).toEqual(emptyProgress());
      expect(saveProgress(emptyProgress())).toBe(false);
    });
  });

  it("returns the real storage when it works", () => {
    expect(safeStorage()).toBe(window.localStorage);
  });
});

describe("touchDay", () => {
  let base: Progress;
  beforeEach(() => { base = emptyProgress(); });

  it("starts the streak and stamps startedAt on the very first day", () => {
    const p = touchDay(base, 30, "2026-01-01");
    expect(p.streak).toBe(1);
    expect(p.best).toBe(1);
    expect(p.startedAt).toBe("2026-01-01");
    expect(p.lastActive).toBe("2026-01-01");
    expect(p.minutes).toBe(30);
  });

  it("advances the streak on consecutive days", () => {
    let p = touchDay(base, 20, "2026-01-01");
    p = touchDay(p, 20, "2026-01-02");
    p = touchDay(p, 20, "2026-01-03");
    expect(p.streak).toBe(3);
    expect(p.best).toBe(3);
  });

  it("survives a single missed day — a rest day must not reset the streak", () => {
    let p = touchDay(base, 20, "2026-01-01");
    p = touchDay(p, 20, "2026-01-02");
    // 3 January skipped entirely.
    p = touchDay(p, 20, "2026-01-04");
    expect(p.streak).toBe(3);
  });

  it("resets to 1 after a longer gap", () => {
    let p = touchDay(base, 20, "2026-01-01");
    p = touchDay(p, 20, "2026-01-02");
    // Three days away is a broken streak.
    p = touchDay(p, 20, "2026-01-05");
    expect(p.streak).toBe(1);
    expect(p.best).toBe(2);
  });

  it("keeps the best streak once the current one resets", () => {
    let p = touchDay(base, 10, "2026-01-01");
    for (const d of ["2026-01-02", "2026-01-03", "2026-01-04"]) p = touchDay(p, 10, d);
    expect(p.best).toBe(4);
    p = touchDay(p, 10, "2026-02-01");
    expect(p.streak).toBe(1);
    expect(p.best).toBe(4);
  });

  it("does not bump the streak twice in one day", () => {
    let p = touchDay(base, 10, "2026-01-01");
    p = touchDay(p, 10, "2026-01-01");
    p = touchDay(p, 10, "2026-01-01");
    expect(p.streak).toBe(1);
  });

  it("accumulates minutes into a single session entry per day", () => {
    let p = touchDay(base, 25, "2026-01-01");
    p = touchDay(p, 15, "2026-01-01");
    p = touchDay(p, 40, "2026-01-02");
    expect(p.sessions).toEqual([{ d: "2026-01-01", m: 40 }, { d: "2026-01-02", m: 40 }]);
    expect(p.minutes).toBe(80);
  });

  it("records no session when zero minutes are logged, but still keeps the streak alive", () => {
    const p = touchDay(base, 0, "2026-01-01");
    expect(p.sessions).toEqual([]);
    expect(p.minutes).toBe(0);
    expect(p.streak).toBe(1);
  });

  it("caps the session history at 250 days, dropping the oldest", () => {
    const sessions = Array.from({ length: 250 }, (_, i) => ({ d: `d${i}`, m: 5 }));
    const p = touchDay({ ...base, sessions }, 5, "2026-01-01");
    expect(p.sessions).toHaveLength(250);
    expect(p.sessions[0].d).toBe("d1");
    expect(p.sessions[249]).toEqual({ d: "2026-01-01", m: 5 });
  });

  it("does not mutate the record it is given", () => {
    const p = touchDay(base, 30, "2026-01-01");
    expect(base.minutes).toBe(0);
    expect(base.sessions).toEqual([]);
    expect(p).not.toBe(base);
  });
});

describe("daysAway", () => {
  it("is 0 for a learner who has never been active", () => {
    expect(daysAway(emptyProgress(), "2026-01-10")).toBe(0);
  });

  it("counts days since the last active day", () => {
    const p = { ...emptyProgress(), lastActive: "2026-01-01" };
    expect(daysAway(p, "2026-01-01")).toBe(0);
    expect(daysAway(p, "2026-01-09")).toBe(8);
  });
});

describe("scheduleSrs", () => {
  const today = "2026-01-01";
  const due = (p: Progress, id: string) => p.srs[id].due;

  it("uses the documented 1/3/7/16/35 ladder", () => {
    expect(SRS_STEPS).toEqual([1, 3, 7, 16, 35]);
  });

  it("climbs one rung per 'understood' and stops at the top", () => {
    let p = emptyProgress();
    // A first pass starts at reps 0 and is promoted to reps 1 immediately.
    p = scheduleSrs(p, "w1d1a", 2, today);
    expect(p.srs["w1d1a"].reps).toBe(1);
    expect(due(p, "w1d1a")).toBe("2026-01-04"); // +3

    p = scheduleSrs(p, "w1d1a", 2, today);
    expect(p.srs["w1d1a"].reps).toBe(2);
    expect(due(p, "w1d1a")).toBe("2026-01-08"); // +7

    p = scheduleSrs(p, "w1d1a", 2, today);
    expect(due(p, "w1d1a")).toBe("2026-01-17"); // +16

    p = scheduleSrs(p, "w1d1a", 2, today);
    expect(p.srs["w1d1a"].reps).toBe(4);
    expect(due(p, "w1d1a")).toBe("2026-02-05"); // +35

    p = scheduleSrs(p, "w1d1a", 2, today);
    expect(p.srs["w1d1a"].reps).toBe(4);
    expect(due(p, "w1d1a")).toBe("2026-02-05"); // capped
  });

  it("steps back down one rung on 'needs revision'", () => {
    let p: Progress = { ...emptyProgress(), srs: { w1d1a: { reps: 3, due: "2026-02-01" } } };
    p = scheduleSrs(p, "w1d1a", 1, today);
    expect(p.srs["w1d1a"].reps).toBe(2);
    expect(due(p, "w1d1a")).toBe("2026-01-08"); // +7
  });

  it("makes a freshly flagged topic due today, not tomorrow", () => {
    // Flagging something you did not understand should surface it immediately — a queue
    // that says "nothing due" the moment you ask for help is a queue nobody trusts.
    const p = scheduleSrs(emptyProgress(), "w1d1a", 1, today);
    expect(p.srs["w1d1a"].reps).toBe(0);
    expect(due(p, "w1d1a")).toBe(today);
  });

  it("drops straight back to the start on 'confused', however many reps came before, and is due today", () => {
    const p = scheduleSrs(
      { ...emptyProgress(), srs: { w1d1a: { reps: 4, due: "2026-06-01" } } },
      "w1d1a", 0, today,
    );
    expect(p.srs["w1d1a"].reps).toBe(0);
    expect(due(p, "w1d1a")).toBe(today);
  });

  it("resumes the ladder once a flagged topic is marked solid", () => {
    let p = scheduleSrs(emptyProgress(), "w1d1a", 1, today);
    expect(due(p, "w1d1a")).toBe(today);
    p = scheduleSrs(p, "w1d1a", 2, today);
    expect(due(p, "w1d1a")).toBe("2026-01-04"); // reps 1 -> +3 days
  });

  it("stamps the review date and leaves other cards alone", () => {
    const p = scheduleSrs(
      { ...emptyProgress(), srs: { other: { reps: 2, due: "2026-03-03" } } },
      "w1d1a", 2, today,
    );
    expect(p.srs["w1d1a"].last).toBe(today);
    expect(p.srs["other"]).toEqual({ reps: 2, due: "2026-03-03" });
  });
});

describe("gradeFlashcard", () => {
  const today = "2026-01-01";

  it("climbs the same ladder when recalled", () => {
    let p = gradeFlashcard(emptyProgress(), "f1", true, today);
    expect(p.flash["f1"]).toEqual({ reps: 1, due: "2026-01-04" });
    p = gradeFlashcard(p, "f1", true, today);
    expect(p.flash["f1"]).toEqual({ reps: 2, due: "2026-01-08" });
  });

  it("caps at the longest interval", () => {
    let p: Progress = { ...emptyProgress(), flash: { f1: { reps: 4, due: "2026-01-01" } } };
    p = gradeFlashcard(p, "f1", true, today);
    expect(p.flash["f1"]).toEqual({ reps: 4, due: "2026-02-05" });
  });

  it("resets all the way to tomorrow when forgotten — no partial credit", () => {
    const p = gradeFlashcard(
      { ...emptyProgress(), flash: { f1: { reps: 4, due: "2026-06-01" } } },
      "f1", false, today,
    );
    expect(p.flash["f1"]).toEqual({ reps: 0, due: "2026-01-02" });
  });
});

describe("default today argument", () => {
  it("falls back to the real today when no date is passed", () => {
    vi.setSystemTime(new Date(2026, 4, 20, 9, 0));
    try {
      expect(touchDay(emptyProgress(), 5).lastActive).toBe("2026-05-20");
      expect(scheduleSrs(emptyProgress(), "w1d1a", 0).srs["w1d1a"].due).toBe("2026-05-20");
    } finally {
      vi.useRealTimers();
    }
  });
});
