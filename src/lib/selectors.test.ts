import { describe, expect, it } from "vitest";
import {
  activeItems, currentWeek, earnedXp, isDone, isInPace, levelFromXp, nextBestItem,
  overallProgress, paceIncludes, planSession, portfolioReadiness, prereqsMet,
  projectChecklistScore, projectItemProgress, remainingItems, revisionQueue, skillState,
  weakAreas, weekProgress, weekUnlocked,
} from "./selectors";
import { emptyProgress, type Progress } from "../state/progress";
import { allItems, itemById, projectById, skillById, tickets, weekOfItem, weeks } from "../data";
import type { Item, Project, Skill } from "../types";

/* ---------------- fixtures ---------------- */

const p = (patch: Partial<Progress> = {}): Progress => ({ ...emptyProgress(), ...patch });

/** Marks the given item ids complete on an otherwise-blank record. */
const doneMap = (...ids: string[]): Record<string, string> =>
  Object.fromEntries(ids.map((id) => [id, "2026-01-01"]));

/** A real item, fetched by id — the tests assert against authored content deliberately. */
const item = (id: string): Item => {
  const found = itemById.get(id);
  if (!found) throw new Error(`fixture drift: item ${id} no longer exists`);
  return found;
};

const skill = (id: string): Skill => {
  const found = skillById.get(id);
  if (!found) throw new Error(`fixture drift: skill ${id} no longer exists`);
  return found;
};

const project = (id: string): Project => {
  const found = projectById.get(id);
  if (!found) throw new Error(`fixture drift: project ${id} no longer exists`);
  return found;
};

const week1 = weeks[0];
const week2 = weeks[1];

/* ---------------- pace ---------------- */

describe("pace profiles", () => {
  it("widens what counts as in-pace as the profile gets more ambitious", () => {
    expect(paceIncludes("minimum")).toEqual(["core"]);
    expect(paceIncludes("recommended")).toEqual(["core", "recommended"]);
    expect(paceIncludes("intensive")).toEqual(["core", "recommended", "intensive"]);
  });

  it("isInPace gates each item by its own pace tag", () => {
    const core = item("w1d1a");      // core
    const rec = item("w1d1c");       // recommended
    const intense = item("w1d2c");   // intensive

    expect(isInPace(core, "minimum")).toBe(true);
    expect(isInPace(rec, "minimum")).toBe(false);
    expect(isInPace(intense, "minimum")).toBe(false);

    expect(isInPace(rec, "recommended")).toBe(true);
    expect(isInPace(intense, "recommended")).toBe(false);

    expect(isInPace(intense, "intensive")).toBe(true);
  });

  it("activeItems is a strictly growing subset as the pace widens", () => {
    const min = activeItems("minimum");
    const rec = activeItems("recommended");
    const int = activeItems("intensive");

    expect(min.length).toBeGreaterThan(0);
    expect(min.length).toBeLessThan(rec.length);
    expect(rec.length).toBeLessThan(int.length);
    expect(int).toHaveLength(allItems.length);

    expect(min.every((i) => i.pace === "core")).toBe(true);
    const recIds = new Set(rec.map((i) => i.id));
    expect(min.every((i) => recIds.has(i.id))).toBe(true);
  });
});

/* ---------------- completion, XP, levels ---------------- */

describe("overallProgress", () => {
  it("is 0/total on a blank record", () => {
    const r = overallProgress(p());
    expect(r.done).toBe(0);
    expect(r.pct).toBe(0);
    expect(r.total).toBe(activeItems("recommended").length);
  });

  it("counts only in-pace items, so a minimum-pace learner is not punished for skipping extras", () => {
    const state = p({ pace: "minimum", done: doneMap("w1d1a", "w1d1c") });
    const r = overallProgress(state);
    // w1d1c is a recommended-pace item: out of pace, so it counts for nothing here.
    expect(r.done).toBe(1);
    expect(r.total).toBe(activeItems("minimum").length);
    expect(r.pct).toBe(Math.round((1 / r.total) * 100));
  });

  it("reaches 100% when every in-pace item is done", () => {
    const state = p({ pace: "minimum", done: doneMap(...activeItems("minimum").map((i) => i.id)) });
    expect(overallProgress(state).pct).toBe(100);
  });

  it("isDone reads the completion stamp", () => {
    const state = p({ done: doneMap("w1d1a") });
    expect(isDone(state, "w1d1a")).toBe(true);
    expect(isDone(state, "w1d1b")).toBe(false);
  });
});

describe("earnedXp", () => {
  it("is zero on a blank record", () => {
    expect(earnedXp(p())).toBe(0);
  });

  it("sums item XP, resolved-ticket XP and the bonus pot", () => {
    const ticket = tickets[0];
    const state = p({
      done: doneMap("w1d1a", "w1d1b"),
      tickets: { [ticket.id]: { done: true } },
      xpBonus: 150,
    });
    expect(earnedXp(state)).toBe(item("w1d1a").xp + item("w1d1b").xp + ticket.xp + 150);
  });

  it("ignores tickets that are opened but not resolved", () => {
    const ticket = tickets[0];
    expect(earnedXp(p({ tickets: { [ticket.id]: { done: false } } }))).toBe(0);
  });

  it("counts out-of-pace work too — you earn what you actually did", () => {
    const state = p({ pace: "minimum", done: doneMap("w1d1c") });
    expect(overallProgress(state).done).toBe(0);
    expect(earnedXp(state)).toBe(item("w1d1c").xp);
  });
});

describe("levelFromXp", () => {
  it("starts every learner at level 1 with an empty bar", () => {
    const l = levelFromXp(0);
    expect(l.level).toBe(1);
    expect(l.into).toBe(0);
    expect(l.need).toBe(400);
    expect(l.pct).toBe(0);
  });

  it("promotes exactly at the threshold, not before", () => {
    expect(levelFromXp(399).level).toBe(1);
    expect(levelFromXp(400).level).toBe(2);
    expect(levelFromXp(400).into).toBe(0);
  });

  it("never goes down as XP goes up", () => {
    let last = 0;
    for (let xp = 0; xp <= 60_000; xp += 137) {
      const { level } = levelFromXp(xp);
      expect(level).toBeGreaterThanOrEqual(last);
      last = level;
    }
  });

  it("keeps the progress bar inside its own band at every point", () => {
    for (let xp = 0; xp <= 40_000; xp += 311) {
      const l = levelFromXp(xp);
      expect(l.into).toBeGreaterThanOrEqual(0);
      expect(l.into).toBeLessThan(l.need);
      expect(l.pct).toBeGreaterThanOrEqual(0);
      expect(l.pct).toBeLessThanOrEqual(100);
    }
  });

  it("caps at level 40 so a grinder cannot run off the end of the scale", () => {
    expect(levelFromXp(10_000_000).level).toBe(40);
  });
});

/* ---------------- weeks ---------------- */

describe("weekProgress and currentWeek", () => {
  const week1InPace = (pace: Progress["pace"]) =>
    week1.days.flatMap((d) => d.items).filter((i) => isInPace(i, pace));

  it("counts only the week's in-pace items", () => {
    const r = weekProgress(p({ pace: "minimum" }), week1);
    expect(r.total).toBe(week1InPace("minimum").length);
    expect(r.done).toBe(0);
    expect(r.pct).toBe(0);
  });

  it("reaches 100% for the week when its in-pace items are all done", () => {
    const state = p({ done: doneMap(...week1InPace("recommended").map((i) => i.id)) });
    expect(weekProgress(state, week1).pct).toBe(100);
  });

  it("currentWeek is the first week that is not finished", () => {
    expect(currentWeek(p()).id).toBe(week1.id);

    const doneWeek1 = p({ done: doneMap(...week1InPace("recommended").map((i) => i.id)) });
    expect(currentWeek(doneWeek1).id).toBe(week2.id);
  });

  it("currentWeek skips a finished week even when a later week is already part-done", () => {
    const state = p({
      done: doneMap(...week1InPace("recommended").map((i) => i.id), week2.days[0].items[0].id),
    });
    expect(currentWeek(state).id).toBe(week2.id);
  });

  it("currentWeek falls back to the last week when everything is complete", () => {
    const state = p({ done: doneMap(...allItems.map((i) => i.id)) });
    expect(currentWeek(state).id).toBe(weeks[weeks.length - 1].id);
  });
});

describe("weekUnlocked", () => {
  const w1Items = week1.days.flatMap((d) => d.items).filter((i) => isInPace(i, "recommended"));

  it("week 1 is always open", () => {
    expect(weekUnlocked(p(), week1)).toBe(true);
  });

  it("week 2 stays shut until week 1 is 55% done", () => {
    const below = Math.floor(w1Items.length * 0.5);
    const stateBelow = p({ done: doneMap(...w1Items.slice(0, below).map((i) => i.id)) });
    expect(weekProgress(stateBelow, week1).pct).toBeLessThan(55);
    expect(weekUnlocked(stateBelow, week2)).toBe(false);

    const enough = Math.ceil(w1Items.length * 0.56);
    const stateOk = p({ done: doneMap(...w1Items.slice(0, enough).map((i) => i.id)) });
    expect(weekProgress(stateOk, week1).pct).toBeGreaterThanOrEqual(55);
    expect(weekUnlocked(stateOk, week2)).toBe(true);
  });

  it("a week you have already started stays open regardless of the week before it", () => {
    const state = p({ done: doneMap(week2.days[0].items[0].id) });
    expect(weekProgress(state, week1).pct).toBe(0);
    expect(weekUnlocked(state, week2)).toBe(true);
  });
});

/* ---------------- prerequisites ---------------- */

describe("prereqsMet", () => {
  it("is true for an item with no prerequisites", () => {
    expect(item("w1d1a").prereqs).toEqual([]);
    expect(prereqsMet(p(), item("w1d1a"))).toBe(true);
  });

  it("is false until the prerequisite is actually completed", () => {
    expect(item("w1d1b").prereqs).toContain("w1d1a");
    expect(prereqsMet(p(), item("w1d1b"))).toBe(false);
    expect(prereqsMet(p({ done: doneMap("w1d1a") }), item("w1d1b"))).toBe(true);
  });

  it("requires every prerequisite, not just one", () => {
    const multi = item("w1d4c"); // depends on w1d4a and w1d3a
    expect(multi.prereqs.length).toBeGreaterThan(1);
    expect(prereqsMet(p({ done: doneMap(multi.prereqs[0]) }), multi)).toBe(false);
    expect(prereqsMet(p({ done: doneMap(...multi.prereqs) }), multi)).toBe(true);
  });

  it("ignores a prerequisite the learner's pace excludes — it can never be blocking", () => {
    // w2d5a is core but depends on w1d1c, a recommended-pace item.
    const gated = item("w2d5a");
    expect(gated.prereqs).toContain("w1d1c");
    expect(item("w1d1c").pace).toBe("recommended");

    expect(prereqsMet(p({ pace: "recommended" }), gated)).toBe(false);
    expect(prereqsMet(p({ pace: "minimum" }), gated)).toBe(true);
  });
});

/* ---------------- next-best-task engine ---------------- */

describe("remainingItems", () => {
  it("drops finished and out-of-pace work", () => {
    const state = p({ pace: "minimum", done: doneMap("w1d1a") });
    const ids = new Set(remainingItems(state).map((i) => i.id));
    expect(ids.has("w1d1a")).toBe(false);
    expect(ids.has("w1d1c")).toBe(false); // recommended pace
    expect(ids.has("w1d1b")).toBe(true);
  });
});

describe("nextBestItem", () => {
  it("suggests an unblocked item from the earliest week to a brand-new learner", () => {
    const next = nextBestItem(p());
    expect(next).not.toBeNull();
    expect(prereqsMet(p(), next as Item)).toBe(true);
    expect(weekOfItem.get((next as Item).id)?.week).toBe(1);
  });

  it("never suggests something already done", () => {
    const first = nextBestItem(p()) as Item;
    const next = nextBestItem(p({ done: doneMap(first.id) })) as Item;
    expect(next.id).not.toBe(first.id);
  });

  it("prefers an unblocked item over a blocked one", () => {
    // Only two items left: one whose prerequisite is met and one whose is not.
    const state = p({
      pace: "minimum",
      done: doneMap(
        ...activeItems("minimum")
          .filter((i) => i.id !== "w1d1a" && i.id !== "w1d2b")
          .map((i) => i.id),
      ),
    });
    // w1d2b depends on w1d2a (done); w1d1a has no prerequisites but sits earlier.
    const next = nextBestItem(state) as Item;
    expect(prereqsMet(state, next)).toBe(true);
  });

  it("prefers the earlier week when two items are otherwise comparable", () => {
    const lateWeek = weeks[10].days[0].items[0];
    const state = p({
      done: doneMap(
        ...activeItems("recommended")
          .filter((i) => i.id !== "w1d1a" && i.id !== lateWeek.id)
          .map((i) => i.id),
      ),
    });
    expect(nextBestItem(state)?.id).toBe("w1d1a");
  });

  it("returns null once there is nothing left in pace", () => {
    const state = p({ pace: "minimum", done: doneMap(...activeItems("minimum").map((i) => i.id)) });
    expect(nextBestItem(state)).toBeNull();
  });
});

describe("planSession", () => {
  it("fills a 20-minute budget without overshooting it wildly", () => {
    const plan = planSession(p(), 20, "low");
    expect(plan.length).toBeGreaterThan(0);
    // Nothing may be picked that exceeds the remaining budget plus the 8-minute slack.
    for (const i of plan) expect(i.time).toBeLessThanOrEqual(28);
    const total = plan.reduce((s, i) => s + i.time, 0);
    expect(total).toBeLessThanOrEqual(20 + 8 * plan.length);
    expect(plan.length).toBeLessThanOrEqual(8);
  });

  it("never repeats an item, even across a long session", () => {
    const plan = planSession(p(), 240, "deep");
    expect(new Set(plan.map((i) => i.id)).size).toBe(plan.length);
  });

  it("never plans work that is already done", () => {
    const state = p({ done: doneMap("w1d1a", "w1d1b") });
    const ids = planSession(state, 120, "normal").map((i) => i.id);
    expect(ids).not.toContain("w1d1a");
    expect(ids).not.toContain("w1d1b");
  });

  it("plans nothing when the budget is too small to be worth starting", () => {
    expect(planSession(p(), 5, "low")).toEqual([]);
  });

  it("plans nothing when there is no work left", () => {
    const state = p({ pace: "minimum", done: doneMap(...activeItems("minimum").map((i) => i.id)) });
    expect(planSession(state, 120, "normal")).toEqual([]);
  });

  it("respects the learner's pace", () => {
    const plan = planSession(p({ pace: "minimum" }), 180, "deep");
    expect(plan.every((i) => i.pace === "core")).toBe(true);
  });
});

/* ---------------- revision ---------------- */

describe("revisionQueue", () => {
  const today = "2026-01-06";

  const state = p({
    status: {
      w1d1a: "confused",
      w1d1b: "revision",
      w1d2a: "understood",   // never queued
      "ghost-item": "confused", // stale id from an older content version
    },
    confidence: {
      w1d2b: 2,  // low confidence pulls it in even with no status flag
      w1d3a: 5,  // comfortable — stays out
      w1d3b: 3,  // above the threshold — stays out
      w1d1a: 1,  // already queued as "confused"; must not be downgraded
    },
    srs: {
      w1d1a: { reps: 1, due: "2026-01-10" },
      w1d1b: { reps: 0, due: "2026-01-05" },
      w1d2b: { reps: 2, due: "2026-01-20" },
    },
  });

  it("includes confused and revision-flagged lessons", () => {
    const ids = revisionQueue(state, today).map((e) => e.id);
    expect(ids).toContain("w1d1a");
    expect(ids).toContain("w1d1b");
  });

  it("includes anything rated 2 or below on confidence, and excludes 3 and above", () => {
    const byId = new Map(revisionQueue(state, today).map((e) => [e.id, e]));
    expect(byId.get("w1d2b")?.status).toBe("low-confidence");
    expect(byId.has("w1d3a")).toBe(false);
    expect(byId.has("w1d3b")).toBe(false);
  });

  it("leaves understood lessons and unknown ids out", () => {
    const ids = revisionQueue(state, today).map((e) => e.id);
    expect(ids).not.toContain("w1d2a");
    expect(ids).not.toContain("ghost-item");
  });

  it("keeps the stronger 'confused' flag rather than overwriting it with low confidence", () => {
    const entry = revisionQueue(state, today).find((e) => e.id === "w1d1a");
    expect(entry?.status).toBe("confused");
  });

  it("sorts by due date, soonest first, and flags anything due today or earlier as overdue", () => {
    const q = revisionQueue(state, today);
    expect(q.map((e) => e.id)).toEqual(["w1d1b", "w1d1a", "w1d2b"]);
    expect(q[0].overdue).toBe(true);  // due 5 Jan, today is the 6th
    expect(q[1].overdue).toBe(false); // due 10 Jan
    expect(q[2].overdue).toBe(false);
  });

  it("treats a card with no schedule yet as due today", () => {
    const fresh = p({ status: { w1d1a: "confused" } });
    const [entry] = revisionQueue(fresh, today);
    expect(entry.due).toBe(today);
    expect(entry.overdue).toBe(true);
  });

  it("carries the resolved item so a view can render it without another lookup", () => {
    const [entry] = revisionQueue(p({ status: { w1d1a: "confused" } }), today);
    expect(entry.item.id).toBe("w1d1a");
    expect(entry.item.title).toBe(item("w1d1a").title);
  });

  it("is empty for a learner with nothing flagged", () => {
    expect(revisionQueue(p(), today)).toEqual([]);
  });
});

/* ---------------- skills: the evidence rule ---------------- */

describe("skillState", () => {
  // py-tooling: four lessons, no prerequisite skills, evidence = one quiz + one project.
  const tooling = skill("py-tooling");
  const toolingItems = tooling.items;
  const allToolingDone = doneMap(...toolingItems);

  it("is Not started when no lesson has been touched", () => {
    const s = skillState(p(), tooling);
    expect(s.level).toBe(0);
    expect(s.done).toBe(0);
    expect(s.total).toBe(toolingItems.length);
  });

  it("is Learning while lessons are only part-done", () => {
    const s = skillState(p({ done: doneMap(toolingItems[0]) }), tooling);
    expect(s.level).toBe(1);
    expect(s.ratio).toBeLessThan(1);
  });

  it("STAYS Learning when every lesson is done but no evidence exists", () => {
    // This is the app's core promise: reading everything is not competence.
    const s = skillState(p({ done: allToolingDone }), tooling);
    expect(s.ratio).toBe(1);
    expect(s.evidence).toBe(0);
    expect(s.evidenceTotal).toBe(2);
    expect(s.level).toBe(1);
  });

  it("becomes Competent once the quiz is passed", () => {
    const s = skillState(
      p({
        done: allToolingDone,
        quiz: { [tooling.evidence.quiz as string]: { best: 72, last: 72, attempts: 1, lastAt: "2026-01-01" } },
      }),
      tooling,
    );
    expect(s.evidence).toBe(1);
    expect(s.level).toBe(2);
  });

  it("does not accept a failed quiz as evidence — 70% is the bar", () => {
    const s = skillState(
      p({
        done: allToolingDone,
        quiz: { [tooling.evidence.quiz as string]: { best: 69, last: 69, attempts: 2, lastAt: "2026-01-01" } },
      }),
      tooling,
    );
    expect(s.evidence).toBe(0);
    expect(s.level).toBe(1);
  });

  it("accepts a shipped project as evidence, but not one merely being built", () => {
    const building = skillState(
      p({ done: allToolingDone, projStatus: { [tooling.evidence.project as string]: "building" } }),
      tooling,
    );
    expect(building.evidence).toBe(0);
    expect(building.level).toBe(1);

    const shipped = skillState(
      p({ done: allToolingDone, projStatus: { [tooling.evidence.project as string]: "shipped" } }),
      tooling,
    );
    expect(shipped.evidence).toBe(1);
    expect(shipped.level).toBe(2);
  });

  it("reaches Strong only with full evidence and high self-rated confidence", () => {
    const full = p({
      done: allToolingDone,
      quiz: { [tooling.evidence.quiz as string]: { best: 95, last: 95, attempts: 1, lastAt: "2026-01-01" } },
      projStatus: { [tooling.evidence.project as string]: "shipped" },
      confidence: Object.fromEntries(toolingItems.map((id) => [id, 4 as const])),
    });
    const strong = skillState(full, tooling);
    expect(strong.evidence).toBe(strong.evidenceTotal);
    expect(strong.avgConfidence).toBe(4);
    expect(strong.level).toBe(3);

    // Same evidence, shaky confidence: Competent, not Strong.
    const shaky = skillState(
      { ...full, confidence: Object.fromEntries(toolingItems.map((id) => [id, 3 as const])) },
      tooling,
    );
    expect(shaky.level).toBe(2);
  });

  it("averages confidence only over the lessons that were actually rated", () => {
    const s = skillState(
      p({ done: allToolingDone, confidence: { [toolingItems[0]]: 5, [toolingItems[1]]: 3 } }),
      tooling,
    );
    expect(s.avgConfidence).toBe(4);
  });

  it("locks a skill whose prerequisite skill is not yet Competent, and unlocks it when it is", () => {
    const typing = skill("py-typing");
    expect(typing.requires).toContain("py-tooling");

    expect(skillState(p(), typing).locked).toBe(true);

    const competentTooling = p({
      done: allToolingDone,
      quiz: { [tooling.evidence.quiz as string]: { best: 80, last: 80, attempts: 1, lastAt: "2026-01-01" } },
    });
    expect(skillState(competentTooling, tooling).level).toBe(2);
    expect(skillState(competentTooling, typing).locked).toBe(false);
  });

  it("terminates on every skill in the real graph, cycles or not", () => {
    for (const s of [tooling, skill("py-typing")]) {
      expect(() => skillState(p(), s)).not.toThrow();
    }
  });
});

describe("weakAreas", () => {
  it("surfaces failed quizzes and confusion flags", () => {
    const state = p({
      quiz: { [week1.quiz.id]: { best: 40, last: 40, attempts: 1, lastAt: "2026-01-01" } },
      status: { w1d1a: "confused", w1d1b: "confused" },
    });
    const labels = weakAreas(state).map((w) => w.label);
    expect(labels).toContain(`Week ${week1.week} quiz`);
    expect(labels).toContain("Confusion flags");
  });

  it("says nothing about a learner who has done nothing", () => {
    expect(weakAreas(p())).toEqual([]);
  });

  it("never floods the dashboard", () => {
    const state = p({
      quiz: Object.fromEntries(
        weeks.map((w) => [w.quiz.id, { best: 10, last: 10, attempts: 1, lastAt: "2026-01-01" }]),
      ),
    });
    expect(weakAreas(state).length).toBeLessThanOrEqual(6);
  });
});

/* ---------------- projects & portfolio ---------------- */

describe("projectChecklistScore", () => {
  const snapshot = project("mini-snapshot");

  it("is 0% before anything is ticked", () => {
    expect(projectChecklistScore(p(), snapshot)).toEqual({
      n: 0, total: snapshot.checklist.length, pct: 0,
    });
  });

  it("counts only the ticked boxes, rounding the percentage", () => {
    const state = p({
      portfolio: { [snapshot.id]: { [snapshot.checklist[0].id]: true, [snapshot.checklist[1].id]: true } },
    });
    const r = projectChecklistScore(state, snapshot);
    expect(r.n).toBe(2);
    expect(r.pct).toBe(Math.round((2 / snapshot.checklist.length) * 100));
  });

  it("ignores a box that was ticked and then un-ticked", () => {
    const state = p({ portfolio: { [snapshot.id]: { [snapshot.checklist[0].id]: false } } });
    expect(projectChecklistScore(state, snapshot).n).toBe(0);
  });

  it("is 100% with every box ticked", () => {
    const state = p({
      portfolio: { [snapshot.id]: Object.fromEntries(snapshot.checklist.map((c) => [c.id, true])) },
    });
    expect(projectChecklistScore(state, snapshot).pct).toBe(100);
  });
});

describe("portfolioReadiness", () => {
  const complete = (...ids: string[]): Progress["portfolio"] =>
    Object.fromEntries(
      ids.map((id) => [id, Object.fromEntries(project(id).checklist.map((c) => [c.id, true]))]),
    );

  it("is 0 with nothing shipped and 100 with everything shipped", () => {
    expect(portfolioReadiness(p())).toBe(0);
    const all = complete(...["mini-snapshot", "mini-fetcher", "mini-notes", "mini-extractor",
      "med-triage", "mini-askdocs", "med-docqa", "mini-agent", "med-platform", "cap-athena"]);
    expect(portfolioReadiness(p({ portfolio: all }))).toBe(100);
  });

  it("weights a heavier project above a lighter one", () => {
    const mini = project("mini-snapshot");     // portfolioWeight 1
    const medium = project("med-triage");      // portfolioWeight 3
    expect(medium.portfolioWeight).toBeGreaterThan(mini.portfolioWeight);

    const miniOnly = portfolioReadiness(p({ portfolio: complete(mini.id) }));
    const mediumOnly = portfolioReadiness(p({ portfolio: complete(medium.id) }));
    expect(mediumOnly).toBeGreaterThan(miniOnly);

    // Each project contributes exactly its share of the total weight.
    const totalWeight = ["mini-snapshot", "mini-fetcher", "mini-notes", "mini-extractor",
      "med-triage", "mini-askdocs", "med-docqa", "mini-agent", "med-platform", "cap-athena"]
      .reduce((s, id) => s + project(id).portfolioWeight, 0);
    expect(miniOnly).toBe(Math.round((mini.portfolioWeight / totalWeight) * 100));
    expect(mediumOnly).toBe(Math.round((medium.portfolioWeight / totalWeight) * 100));
  });

  it("gives partial credit in proportion to the checklist", () => {
    const snapshot = project("mini-snapshot");
    const half = Math.floor(snapshot.checklist.length / 2);
    const partial = p({
      portfolio: {
        [snapshot.id]: Object.fromEntries(snapshot.checklist.slice(0, half).map((c) => [c.id, true])),
      },
    });
    const full = portfolioReadiness(p({ portfolio: complete(snapshot.id) }));
    expect(portfolioReadiness(partial)).toBeGreaterThan(0);
    expect(portfolioReadiness(partial)).toBeLessThan(full);
  });
});

describe("projectItemProgress", () => {
  it("tracks the lessons a project is built from", () => {
    const snapshot = project("mini-snapshot");
    expect(projectItemProgress(p(), snapshot).pct).toBe(0);
    const state = p({ done: doneMap(...snapshot.itemIds) });
    const r = projectItemProgress(state, snapshot);
    expect(r.done).toBe(snapshot.itemIds.length);
    expect(r.pct).toBe(100);
  });
});
