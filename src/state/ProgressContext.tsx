import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  emptyProgress, gradeFlashcard, loadProgress, saveProgress, scheduleSrs, touchDay,
  type Progress,
} from "./progress";
import type { Confidence, LessonStatus, PaceProfile, ProjectStatus } from "../types";
import { itemById, ticketById, weekOfItem } from "../data";
import { isDone, weekProgress } from "../lib/selectors";
import { todayIso } from "../lib/dates";

export interface Toast { id: number; message: string; tone?: "ok" | "plain" }

interface ProgressApi {
  progress: Progress;
  update: (fn: (p: Progress) => Progress) => void;
  reset: () => void;
  importProgress: (raw: unknown) => boolean;
  storageAvailable: boolean;
  toasts: Toast[];
  pushToast: (message: string, tone?: Toast["tone"]) => void;
  /* domain actions */
  toggleItemDone: (id: string) => void;
  setStatus: (id: string, status: LessonStatus) => void;
  setConfidence: (id: string, value: Confidence) => void;
  setNote: (id: string, note: string) => void;
  setPace: (pace: PaceProfile["id"]) => void;
  toggleTicket: (id: string) => void;
  togglePortfolio: (projectId: string, checkId: string) => void;
  setProjectStatus: (projectId: string, status: ProjectStatus) => void;
  setCaseAttempt: (caseId: string, taskId: string, text: string) => void;
  revealCase: (caseId: string, taskId: string) => void;
  setInterviewResult: (id: string, got: "yes" | "partial" | "no") => void;
  markInterviewSeen: (id: string) => void;
  gradeFlash: (id: string, good: boolean) => void;
  recordQuiz: (quizId: string, pct: number, passPct: number) => void;
  logMinutes: (minutes: number) => void;
  markRevised: (id: string) => void;
}

const Ctx = createContext<ProgressApi | null>(null);

export function ProgressProvider({ children, initial }: { children: ReactNode; initial?: Progress }) {
  const [progress, setProgress] = useState<Progress>(() => initial ?? loadProgress());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const toastId = useRef(0);
  const saveTimer = useRef<number | undefined>(undefined);

  const latest = useRef(progress);
  latest.current = progress;

  // Writes are debounced so a burst of edits is one write, but any pending write is
  // flushed when the tab is hidden or closed — otherwise a click made 100ms before
  // someone closes the tab is silently lost.
  useEffect(() => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      setStorageAvailable(saveProgress(progress));
    }, 120);
    return () => window.clearTimeout(saveTimer.current);
  }, [progress]);

  useEffect(() => {
    const flush = () => {
      window.clearTimeout(saveTimer.current);
      saveProgress(latest.current);
    };
    const onVisibility = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
      flush();
    };
  }, []);

  const pushToast = useCallback((message: string, tone: Toast["tone"] = "plain") => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, message, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  }, []);

  const update = useCallback((fn: (p: Progress) => Progress) => setProgress((p) => fn(p)), []);

  const api = useMemo<ProgressApi>(() => {
    const first = (p: Progress): Progress =>
      p.startedAt ? p : { ...p, startedAt: todayIso(), lastActive: todayIso(), streak: 1 };

    return {
      progress,
      update,
      storageAvailable,
      toasts,
      pushToast,
      reset: () => {
        try { window.localStorage.removeItem("aieng-roadmap-v1"); } catch { /* ignore */ }
        setProgress(emptyProgress());
      },
      importProgress: (raw) => {
        if (!raw || typeof raw !== "object") return false;
        setProgress({ ...emptyProgress(), ...(raw as Partial<Progress>), v: 1 });
        return true;
      },
      toggleItemDone: (id) => {
        const item = itemById.get(id);
        if (!item) return;
        update((p0) => {
          const p = first(p0);
          if (p.done[id]) {
            const done = { ...p.done };
            delete done[id];
            return { ...p, done };
          }
          let next: Progress = { ...p, done: { ...p.done, [id]: todayIso() }, lastItem: id };
          next = touchDay(next, item.time);
          if (!next.status[id]) {
            next = { ...next, status: { ...next.status, [id]: "understood" } };
            next = scheduleSrs(next, id, 2);
          }
          const week = weekOfItem.get(id);
          if (week && weekProgress(next, week).pct === 100) {
            next = { ...next, xpBonus: (next.xpBonus || 0) + 150 };
            pushToast(`Week ${week.week} complete — +150 XP`, "ok");
          }
          pushToast(`+${item.xp} XP · ${item.title}`, "ok");
          return next;
        });
      },
      setStatus: (id, status) =>
        update((p) => {
          const cleared = p.status[id] === status;
          const next: Progress = { ...p, status: { ...p.status, [id]: cleared ? null : status } };
          if (cleared) return next;
          return scheduleSrs(next, id, status === "understood" ? 2 : status === "revision" ? 1 : 0);
        }),
      setConfidence: (id, value) =>
        update((p) => {
          const cleared = p.confidence[id] === value;
          let next: Progress = { ...p, confidence: { ...p.confidence, [id]: cleared ? null : value } };
          if (!cleared && value <= 2 && !next.status[id]) {
            next = { ...next, status: { ...next.status, [id]: "revision" } };
            next = scheduleSrs(next, id, 1);
          }
          return next;
        }),
      markRevised: (id) =>
        update((p) => {
          const next: Progress = {
            ...p,
            status: { ...p.status, [id]: "understood" },
            confidence: { ...p.confidence, [id]: Math.max(3, p.confidence[id] ?? 3) as Confidence },
          };
          return scheduleSrs(next, id, 2);
        }),
      setNote: (id, note) => update((p) => ({ ...p, notes: { ...p.notes, [id]: note } })),
      setPace: (pace) => update((p) => ({ ...p, pace })),
      toggleTicket: (id) => {
        const ticket = ticketById.get(id);
        update((p0) => {
          const p = first(p0);
          const wasDone = Boolean(p.tickets[id]?.done);
          let next: Progress = { ...p, tickets: { ...p.tickets, [id]: { done: !wasDone, at: todayIso() } } };
          if (!wasDone && ticket) {
            next = touchDay(next, ticket.time);
            pushToast(`+${ticket.xp} XP · ticket resolved`, "ok");
          }
          return next;
        });
      },
      togglePortfolio: (projectId, checkId) =>
        update((p) => {
          const cur = p.portfolio[projectId] ?? {};
          return { ...p, portfolio: { ...p.portfolio, [projectId]: { ...cur, [checkId]: !cur[checkId] } } };
        }),
      setProjectStatus: (projectId, status) =>
        update((p) => ({ ...p, projStatus: { ...p.projStatus, [projectId]: status } })),
      setCaseAttempt: (caseId, taskId, text) =>
        update((p) => {
          const c = p.cases[caseId] ?? {};
          return { ...p, cases: { ...p.cases, [caseId]: { ...c, [taskId]: { ...c[taskId], attempt: text } } } };
        }),
      revealCase: (caseId, taskId) =>
        update((p) => {
          const c = p.cases[caseId] ?? {};
          return { ...p, cases: { ...p.cases, [caseId]: { ...c, [taskId]: { ...c[taskId], revealed: true } } } };
        }),
      markInterviewSeen: (id) =>
        update((p) => (p.interview[id] ? p : { ...p, interview: { ...p.interview, [id]: { seen: true } } })),
      setInterviewResult: (id, got) =>
        update((p) => ({ ...p, interview: { ...p.interview, [id]: { seen: true, got, at: todayIso() } } })),
      gradeFlash: (id, good) => update((p) => gradeFlashcard(p, id, good)),
      recordQuiz: (quizId, pct, passPct) =>
        update((p0) => {
          const p = first(p0);
          const prev = p.quiz[quizId];
          const best = Math.max(prev?.best ?? 0, pct);
          let next: Progress = {
            ...p,
            quiz: { ...p.quiz, [quizId]: { best, last: pct, attempts: (prev?.attempts ?? 0) + 1, lastAt: todayIso() } },
          };
          if (pct >= passPct && (prev?.best ?? 0) < passPct) {
            next = { ...next, xpBonus: (next.xpBonus || 0) + 60 };
            pushToast("+60 XP · quiz passed", "ok");
          }
          return touchDay(next, 0);
        }),
      logMinutes: (minutes) => update((p) => touchDay(first(p), minutes)),
    };
  }, [progress, update, storageAvailable, toasts, pushToast]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useProgress(): ProgressApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useProgress must be used inside <ProgressProvider>");
  return ctx;
}

export { isDone };
