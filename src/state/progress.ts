import type { Confidence, LessonStatus, PaceProfile, ProjectStatus } from "../types";
import { addDays, daysBetween, todayIso } from "../lib/dates";

export const STORAGE_KEY = "aieng-roadmap-v1";

export interface QuizResult { best: number; last: number; attempts: number; lastAt: string }
export interface TicketState { done: boolean; at?: string }
export interface CaseTaskState { attempt?: string; revealed?: boolean }
export interface InterviewState { seen: boolean; got?: "yes" | "partial" | "no"; at?: string }
export interface SrsState { reps: number; due: string; last?: string }
export interface FlashState { reps: number; due: string }
export interface AssessmentState { score?: number; checks: Record<number, boolean> }
export interface StudySession { d: string; m: number }

export interface Progress {
  v: 1;
  startedAt: string | null;
  pace: PaceProfile["id"];
  done: Record<string, string>;
  status: Record<string, LessonStatus | null>;
  confidence: Record<string, Confidence | null>;
  notes: Record<string, string>;
  quiz: Record<string, QuizResult>;
  tickets: Record<string, TicketState>;
  cases: Record<string, Record<string, CaseTaskState>>;
  interview: Record<string, InterviewState>;
  flash: Record<string, FlashState>;
  srs: Record<string, SrsState>;
  portfolio: Record<string, Record<string, boolean>>;
  projStatus: Record<string, ProjectStatus>;
  assessment: Record<string, AssessmentState>;
  minutes: number;
  sessions: StudySession[];
  lastActive: string | null;
  streak: number;
  best: number;
  lastItem: string | null;
  xpBonus: number;
}

export function emptyProgress(): Progress {
  return {
    v: 1, startedAt: null, pace: "recommended",
    done: {}, status: {}, confidence: {}, notes: {}, quiz: {}, tickets: {},
    cases: {}, interview: {}, flash: {}, srs: {}, portfolio: {}, projStatus: {},
    assessment: {}, minutes: 0, sessions: [], lastActive: null, streak: 0, best: 0,
    lastItem: null, xpBonus: 0,
  };
}

/** Intervals in days for the spaced-repetition ladder. */
export const SRS_STEPS = [1, 3, 7, 16, 35];

export function loadProgress(storage: Storage | undefined = safeStorage()): Progress {
  const base = emptyProgress();
  if (!storage) return base;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<Progress>;
    return { ...base, ...parsed, v: 1 };
  } catch {
    return base;
  }
}

export function saveProgress(p: Progress, storage: Storage | undefined = safeStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(p));
    return true;
  } catch {
    return false;
  }
}

/** localStorage throws in some embedded contexts; never let that crash the app. */
export function safeStorage(): Storage | undefined {
  try {
    if (typeof window === "undefined") return undefined;
    const s = window.localStorage;
    s.getItem(STORAGE_KEY);
    return s;
  } catch {
    return undefined;
  }
}

/**
 * Records activity for today and advances the streak.
 * The streak deliberately survives a single missed day — punishing a rest day is
 * how streak mechanics turn into guilt mechanics.
 */
export function touchDay(p: Progress, minutes: number, today = todayIso()): Progress {
  const next: Progress = { ...p, sessions: [...p.sessions] };
  if (next.lastActive !== today) {
    const gap = next.lastActive ? daysBetween(next.lastActive, today) : 1;
    next.streak = gap <= 2 ? (next.streak || 0) + 1 : 1;
    next.lastActive = today;
    if (!next.startedAt) next.startedAt = today;
  }
  if (next.streak > (next.best || 0)) next.best = next.streak;
  if (minutes > 0) {
    next.minutes += minutes;
    const i = next.sessions.findIndex((s) => s.d === today);
    if (i >= 0) next.sessions[i] = { ...next.sessions[i], m: next.sessions[i].m + minutes };
    else next.sessions.push({ d: today, m: minutes });
    if (next.sessions.length > 250) next.sessions = next.sessions.slice(-250);
  }
  return next;
}

export function daysAway(p: Progress, today = todayIso()): number {
  return p.lastActive ? daysBetween(p.lastActive, today) : 0;
}

/**
 * quality: 0 confused, 1 needs revision, 2 understood.
 *
 * Flagging something you did not understand makes it due immediately — you flagged it
 * because you want to come back to it, and a queue that answers "nothing due" the moment
 * you ask for help is a queue nobody trusts. The 1/3/7/16/35-day ladder starts once the
 * topic has been marked solid.
 */
export function scheduleSrs(p: Progress, id: string, quality: 0 | 1 | 2, today = todayIso()): Progress {
  const prev = p.srs[id] ?? { reps: 0, due: today };
  let reps: number;
  if (quality === 0) reps = 0;
  else if (quality === 1) reps = Math.max(0, prev.reps - 1);
  else reps = Math.min(SRS_STEPS.length - 1, prev.reps + 1);
  const due = quality === 2 || reps > 0 ? addDays(today, SRS_STEPS[reps]) : today;
  return { ...p, srs: { ...p.srs, [id]: { reps, due, last: today } } };
}

export function gradeFlashcard(p: Progress, id: string, good: boolean, today = todayIso()): Progress {
  const prev = p.flash[id]?.reps ?? 0;
  const reps = good ? Math.min(SRS_STEPS.length - 1, prev + 1) : 0;
  return { ...p, flash: { ...p.flash, [id]: { reps, due: addDays(today, SRS_STEPS[reps]) } } };
}
