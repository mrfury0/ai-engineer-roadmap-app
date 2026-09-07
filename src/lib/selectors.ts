import {
  allItems, dayOfItem, itemById, paceProfiles, projects, skills, tickets, weekOfItem, weeks,
} from "../data";
import type { Energy, Item, Pace, Project, Skill, Week } from "../types";
import type { Progress } from "../state/progress";
import { todayIso } from "./dates";

/* ---------------- pace ---------------- */

export function paceIncludes(pace: Progress["pace"]): Pace[] {
  const p = paceProfiles.find((x) => x.id === pace) ?? paceProfiles[1];
  return p.includes;
}

export function isInPace(item: Item, pace: Progress["pace"]): boolean {
  return paceIncludes(pace).includes(item.pace);
}

export function activeItems(pace: Progress["pace"]): Item[] {
  return allItems.filter((i) => isInPace(i, pace));
}

/* ---------------- completion ---------------- */

export const isDone = (p: Progress, id: string): boolean => Boolean(p.done[id]);

export function overallProgress(p: Progress): { done: number; total: number; pct: number } {
  const items = activeItems(p.pace);
  const done = items.filter((i) => isDone(p, i.id)).length;
  return { done, total: items.length, pct: items.length ? Math.round((done / items.length) * 100) : 0 };
}

export function earnedXp(p: Progress): number {
  let xp = p.xpBonus || 0;
  for (const i of allItems) if (isDone(p, i.id)) xp += i.xp;
  for (const t of tickets) if (p.tickets[t.id]?.done) xp += t.xp;
  return xp;
}

export interface Level { level: number; into: number; need: number; pct: number }

export function levelFromXp(xp: number): Level {
  let level = 1, need = 400, acc = 0;
  while (xp >= acc + need && level < 40) {
    acc += need;
    level += 1;
    need = Math.round(need * 1.16);
  }
  return { level, into: xp - acc, need, pct: Math.round(((xp - acc) / need) * 100) };
}

export function weekProgress(p: Progress, w: Week) {
  const items = w.days.flatMap((d) => d.items).filter((i) => isInPace(i, p.pace));
  const done = items.filter((i) => isDone(p, i.id)).length;
  return { items, done, total: items.length, pct: items.length ? Math.round((done / items.length) * 100) : 0 };
}

export function weekUnlocked(p: Progress, w: Week): boolean {
  if (w.week === 1) return true;
  const prev = weeks[w.week - 2];
  return weekProgress(p, prev).pct >= 55 || weekProgress(p, w).done > 0;
}

export function currentWeek(p: Progress): Week {
  return weeks.find((w) => weekProgress(p, w).pct < 100) ?? weeks[weeks.length - 1];
}

export function prereqsMet(p: Progress, item: Item): boolean {
  return item.prereqs.every((id) => {
    const dep = itemById.get(id);
    return !dep || isDone(p, id) || !isInPace(dep, p.pace);
  });
}

/* ---------------- next-best-task engine ---------------- */

export interface SessionOpts { maxTime?: number; energy?: Energy }

const ENERGY_RANK: Record<Energy, number> = { low: 1, normal: 2, deep: 3 };

export function scoreItem(p: Progress, item: Item, opts: SessionOpts = {}): number {
  let score = 0;
  const week = weekOfItem.get(item.id)!;
  score += (13 - week.week) * 8;
  score += prereqsMet(p, item) ? 60 : -160;
  if (opts.maxTime !== undefined) {
    if (item.time > opts.maxTime) score -= 90;
    score -= Math.abs(item.time - opts.maxTime) * 0.35;
  }
  if (opts.energy) {
    if (ENERGY_RANK[item.energy] > ENERGY_RANK[opts.energy]) score -= 55;
    if (ENERGY_RANK[item.energy] === ENERGY_RANK[opts.energy]) score += 18;
  }
  if (item.pace === "core") score += 14;
  const day = dayOfItem.get(item.id)!;
  if (day.items.some((i) => isDone(p, i.id))) score += 22;
  return score;
}

export function remainingItems(p: Progress): Item[] {
  return activeItems(p.pace).filter((i) => !isDone(p, i.id));
}

export function nextBestItem(p: Progress, opts: SessionOpts = {}): Item | null {
  const pool = remainingItems(p);
  if (!pool.length) return null;
  return pool
    .map((i) => ({ i, s: scoreItem(p, i, opts) }))
    .sort((a, b) => b.s - a.s)[0].i;
}

/** Greedily fills a time budget with the best-scoring unblocked items. */
export function planSession(p: Progress, minutes: number, energy: Energy): Item[] {
  const chosen: Item[] = [];
  const used = new Set<string>();
  let budget = minutes;
  for (let guard = 0; guard < 8 && budget > 8; guard++) {
    const pool = remainingItems(p).filter((i) => !used.has(i.id) && i.time <= budget + 8);
    if (!pool.length) break;
    const pick = pool
      .map((i) => ({ i, s: scoreItem(p, i, { maxTime: budget, energy }) }))
      .sort((a, b) => b.s - a.s)[0].i;
    chosen.push(pick);
    used.add(pick.id);
    budget -= pick.time;
  }
  return chosen;
}

/* ---------------- revision ---------------- */

export interface RevisionEntry {
  id: string;
  item: Item;
  status: "revision" | "confused" | "low-confidence";
  due: string;
  overdue: boolean;
}

export function revisionQueue(p: Progress, today = todayIso()): RevisionEntry[] {
  const out = new Map<string, RevisionEntry>();
  for (const [id, status] of Object.entries(p.status)) {
    if (status !== "revision" && status !== "confused") continue;
    const item = itemById.get(id);
    if (!item) continue;
    const due = p.srs[id]?.due ?? today;
    out.set(id, { id, item, status, due, overdue: due <= today });
  }
  for (const [id, conf] of Object.entries(p.confidence)) {
    if (!conf || conf > 2 || out.has(id)) continue;
    const item = itemById.get(id);
    if (!item) continue;
    const due = p.srs[id]?.due ?? today;
    out.set(id, { id, item, status: "low-confidence", due, overdue: due <= today });
  }
  return [...out.values()].sort((a, b) => a.due.localeCompare(b.due));
}

/* ---------------- skills ---------------- */

export type SkillLevel = 0 | 1 | 2 | 3; // not started / learning / competent / strong

export interface SkillState {
  level: SkillLevel;
  locked: boolean;
  done: number;
  total: number;
  ratio: number;
  evidence: number;
  evidenceTotal: number;
  avgConfidence: number;
}

/**
 * A skill reaches Competent only with evidence — a passed quiz, a shipped project or a
 * resolved ticket. Finishing the reading is Learning, not competence.
 */
export function skillState(p: Progress, skill: Skill, seen = new Set<string>()): SkillState {
  const items = skill.items.filter((id) => itemById.has(id));
  const done = items.filter((id) => isDone(p, id)).length;
  const ratio = items.length ? done / items.length : 0;

  let evidence = 0, evidenceTotal = 0;
  if (skill.evidence.quiz) {
    evidenceTotal++;
    if ((p.quiz[skill.evidence.quiz]?.best ?? 0) >= 70) evidence++;
  }
  if (skill.evidence.project) {
    evidenceTotal++;
    if (p.projStatus[skill.evidence.project] === "shipped") evidence++;
  }
  for (const t of skill.evidence.tickets) {
    evidenceTotal++;
    if (p.tickets[t]?.done) evidence++;
  }

  const confs = items.map((id) => p.confidence[id]).filter((c): c is NonNullable<typeof c> => Boolean(c));
  const avgConfidence = confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : 0;

  // Prerequisite check, guarded against cycles in hand-authored data.
  seen.add(skill.id);
  const locked = skill.requires.some((rid) => {
    if (seen.has(rid)) return false;
    const req = skills.find((s) => s.id === rid);
    return req ? skillState(p, req, seen).level < 2 : false;
  });

  const base = { locked, done, total: items.length, ratio, evidence, evidenceTotal, avgConfidence };
  if (locked && done === 0) return { level: 0, ...base };
  if (done === 0) return { level: 0, ...base };
  if (ratio < 0.999) return { level: 1, ...base };

  const evidenceOk = evidenceTotal === 0 ? true : evidence / evidenceTotal >= 0.5;
  const strong = evidenceTotal === 0 ? avgConfidence >= 4 : evidence === evidenceTotal && avgConfidence >= 3.5;
  return { level: strong ? 3 : evidenceOk ? 2 : 1, ...base };
}

/* ---------------- projects & portfolio ---------------- */

export function projectChecklistScore(p: Progress, project: Project) {
  const got = p.portfolio[project.id] ?? {};
  const n = project.checklist.filter((c) => got[c.id]).length;
  return { n, total: project.checklist.length, pct: Math.round((n / project.checklist.length) * 100) };
}

export function portfolioReadiness(p: Progress): number {
  let weight = 0, got = 0;
  for (const project of projects) {
    const s = projectChecklistScore(p, project);
    weight += project.portfolioWeight;
    got += project.portfolioWeight * (s.n / s.total);
  }
  return weight ? Math.round((got / weight) * 100) : 0;
}

export function projectItemProgress(p: Progress, project: Project) {
  const items = project.itemIds.filter((id) => itemById.has(id));
  const done = items.filter((id) => isDone(p, id)).length;
  return { done, total: items.length, pct: items.length ? Math.round((done / items.length) * 100) : 0 };
}

/* ---------------- weak areas ---------------- */

export interface WeakArea { label: string; why: string }

export function weakAreas(p: Progress): WeakArea[] {
  const out: WeakArea[] = [];
  for (const skill of skills) {
    const s = skillState(p, skill);
    if (s.done > 0 && s.avgConfidence > 0 && s.avgConfidence < 3) {
      out.push({ label: skill.name, why: `confidence ${s.avgConfidence.toFixed(1)}/5` });
    }
  }
  for (const [quizId, result] of Object.entries(p.quiz)) {
    if (result.best < 70) {
      const w = weeks.find((x) => x.quiz.id === quizId);
      if (w) out.push({ label: `Week ${w.week} quiz`, why: `${result.best}%` });
    }
  }
  const confused = Object.values(p.status).filter((s) => s === "confused").length;
  if (confused) out.push({ label: "Confusion flags", why: `${confused} marked confused` });
  return out.slice(0, 6);
}
