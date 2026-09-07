import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react";
import { caseById, itemById, weekOfItem, weeks } from "./data";
import { useProgress } from "./state/ProgressContext";
import { useRoute } from "./state/useRoute";
import { nextBestItem } from "./lib/selectors";
import { Sidebar, TopBar, Toasts } from "./components/Shell";
import { CommandPalette, type PaletteAction } from "./components/CommandPalette";
import { FocusTimer, type TimerSpec } from "./components/FocusTimer";
import { QuizRunner } from "./components/QuizRunner";
import { FlashcardRunner } from "./components/FlashcardRunner";
import { AssessmentRunner } from "./components/AssessmentRunner";
import { Modal } from "./components/Modal";
import { Button } from "./components/primitives";
import { Markdown, truncate } from "./lib/markdown";
import { ItemMeta } from "./components/ItemCard";
import type { SearchHit } from "./lib/search";

import { Dashboard } from "./views/Dashboard";
import { Today } from "./views/Today";
import { Roadmap } from "./views/Roadmap";
import { Revision } from "./views/Revision";
import { Practice } from "./views/Practice";
import { Interview } from "./views/Interview";
import { Cases } from "./views/Cases";
import { Skills } from "./views/Skills";
import { KnowledgeMapView } from "./views/KnowledgeMapView";
import { Projects } from "./views/Projects";
import { Portfolio } from "./views/Portfolio";
import { ProgressView } from "./views/ProgressView";
import { Resources } from "./views/Resources";
import { Settings } from "./views/Settings";

export type Overlay =
  | { kind: "palette" }
  | { kind: "quiz"; quizId: string }
  | { kind: "flash"; all: boolean }
  | { kind: "assessment" }
  | { kind: "whatnow" }
  | { kind: "tiny"; itemId: string }
  | null;

/** Props every view receives. Keeps view components free of routing/overlay plumbing. */
export interface ViewProps {
  param: string | null;
  navigate: (view: string, param?: string | null) => void;
  openItem: string | null;
  setOpenItem: (id: string | null) => void;
  jumpToItem: (id: string) => void;
  openOverlay: (o: Overlay) => void;
  startTimer: (minutes: number, itemId: string | null) => void;
  sessionMode: SessionMode;
  setSessionMode: (m: SessionMode) => void;
  setCrumbs: (c: React.ReactNode) => void;
}

export type SessionMode = "quick" | "hour" | "deep" | "tired";

const VIEWS: Record<string, (p: ViewProps) => ReactElement> = {
  dashboard: Dashboard, today: Today, roadmap: Roadmap, revision: Revision,
  practice: Practice, interview: Interview, cases: Cases, skills: Skills,
  map: KnowledgeMapView, projects: Projects, portfolio: Portfolio,
  progress: ProgressView, resources: Resources, settings: Settings,
};

export default function App() {
  const { route, navigate } = useRoute();
  const { progress, logMinutes, pushToast } = useProgress();
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [timer, setTimer] = useState<TimerSpec | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sessionMode, setSessionMode] = useState<SessionMode>("hour");
  const [crumbs, setCrumbs] = useState<React.ReactNode>("Dashboard");

  const view = VIEWS[route.view] ? route.view : "dashboard";

  useEffect(() => {
    document.getElementById("view")?.scrollTo({ top: 0 });
  }, [view, route.param]);

  const startTimer = useCallback((minutes: number, itemId: string | null) => {
    setTimer({ minutes, itemId });
    pushToast(`Focus sprint started — ${minutes} minutes`);
  }, [pushToast]);

  const jumpToItem = useCallback((id: string) => {
    const week = weekOfItem.get(id);
    if (!week) return;
    setOpenItem(id);
    navigate("roadmap", week.id);
    window.setTimeout(() => document.getElementById(`i-${id}`)?.scrollIntoView({ block: "center" }), 80);
  }, [navigate]);

  const onSearchNavigate = useCallback((t: SearchHit["target"]) => {
    if (t.itemId) { jumpToItem(t.itemId); return; }
    navigate(t.route, t.param ?? null);
  }, [jumpToItem, navigate]);

  const paletteActions = useMemo<PaletteAction[]>(() => [
    { title: "What should I do right now?", key: "N", run: () => setOverlay({ kind: "whatnow" }) },
    { title: "Start a 25-minute focus sprint", key: "F", run: () => startTimer(25, openItem) },
    { title: "Flashcard drill", run: () => setOverlay({ kind: "flash", all: false }) },
    { title: "Final competency assessment", run: () => setOverlay({ kind: "assessment" }) },
    ...Object.keys(VIEWS).map((v) => ({
      title: `Go to ${v.charAt(0).toUpperCase()}${v.slice(1)}`,
      run: () => navigate(v),
    })),
  ], [navigate, startTimer, openItem]);

  /* keyboard shortcuts */
  useEffect(() => {
    let gPending = false;
    let gTimer = 0;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA");
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault(); setOverlay({ kind: "palette" }); return;
      }
      if (e.key === "Escape") { setOverlay(null); setMenuOpen(false); return; }
      if (typing || e.ctrlKey || e.metaKey || e.altKey || overlay) return;
      const k = e.key.toLowerCase();
      if (gPending) {
        gPending = false; window.clearTimeout(gTimer);
        const map: Record<string, string> = {
          d: "dashboard", t: "today", r: "roadmap", s: "skills", p: "practice",
          i: "interview", c: "cases", v: "revision", k: "map", o: "projects",
          f: "portfolio", g: "progress",
        };
        if (map[k]) { e.preventDefault(); navigate(map[k]); }
        return;
      }
      if (k === "g") { gPending = true; gTimer = window.setTimeout(() => { gPending = false; }, 900); return; }
      if (k === "n") { e.preventDefault(); setOverlay({ kind: "whatnow" }); }
      else if (k === "f") { e.preventDefault(); if (timer) setTimer(null); else startTimer(25, openItem); }
      else if (k === "/") { e.preventDefault(); setOverlay({ kind: "palette" }); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, overlay, openItem, startTimer, timer]);

  const ViewComponent = VIEWS[view];
  const viewProps: ViewProps = {
    param: route.param, navigate, openItem, setOpenItem, jumpToItem,
    openOverlay: setOverlay, startTimer, sessionMode, setSessionMode, setCrumbs,
  };

  const quizWeek = overlay?.kind === "quiz" ? weeks.find((w) => w.quiz.id === overlay.quizId) : undefined;
  const nextItem = overlay?.kind === "whatnow" ? nextBestItem(progress) : null;
  const tinyItem = overlay?.kind === "tiny" ? itemById.get(overlay.itemId) : undefined;

  return (
    <div id="app">
      <Sidebar view={view} navigate={navigate} open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div id="main">
        <TopBar crumbs={crumbs} onMenu={() => setMenuOpen((v) => !v)} onSearch={() => setOverlay({ kind: "palette" })} />
        <div id="view">
          <ViewComponent {...viewProps} />
        </div>
      </div>

      <Toasts />
      {timer ? (
        <FocusTimer
          spec={timer}
          onStop={() => setTimer(null)}
          onFinish={(minutes, itemId) => {
            logMinutes(minutes);
            setTimer(null);
            pushToast("Sprint complete — logged. Stand up for two minutes.", "ok");
            if (itemId) setOpenItem(itemId);
          }}
        />
      ) : null}

      {overlay?.kind === "palette" ? (
        <CommandPalette onClose={() => setOverlay(null)} onNavigate={onSearchNavigate} actions={paletteActions} />
      ) : null}

      {quizWeek ? (
        <QuizRunner week={quizWeek} onClose={() => setOverlay(null)} onOpenRevision={() => navigate("revision")} />
      ) : null}

      {overlay?.kind === "flash" ? (
        <FlashcardRunner all={overlay.all} onClose={() => setOverlay(null)} />
      ) : null}

      {overlay?.kind === "assessment" ? <AssessmentRunner onClose={() => setOverlay(null)} /> : null}

      {overlay?.kind === "whatnow" ? (
        <Modal title="Do this next" subtitle="Chosen for prerequisites, week order and momentum."
          onClose={() => setOverlay(null)}
          footer={nextItem ? <>
            <Button variant="p" onClick={() => { setOverlay(null); jumpToItem(nextItem.id); }}>Open it</Button>
            <Button onClick={() => { setOverlay(null); jumpToItem(nextItem.id); startTimer(25, nextItem.id); }}>
              Open + start 25m sprint
            </Button>
            <div className="sp" />
            <Button variant="gh" onClick={() => setOverlay(null)}>Not now</Button>
          </> : <Button variant="p" onClick={() => setOverlay(null)}>Close</Button>}>
          {nextItem ? (
            <>
              <div className="dim mono" style={{ fontSize: 11, marginBottom: 7 }}>
                Week {weekOfItem.get(nextItem.id)!.week} · {nextItem.kind}
              </div>
              <div className="h2" style={{ marginBottom: 8 }}>{nextItem.title}</div>
              <ItemMeta item={nextItem} />
              <div style={{ marginTop: 12 }}>
                <Markdown text={truncate(nextItem.concept.split("\n\n")[0], 320)} />
              </div>
            </>
          ) : <div className="prose">Nothing left at this pace. Try Intensive in Settings.</div>}
        </Modal>
      ) : null}

      {tinyItem ? (
        <Modal title="Start tiny — 5 minutes" subtitle="Not the whole task. Just the first move."
          onClose={() => setOverlay(null)}
          footer={<>
            <Button variant="p" onClick={() => { setOverlay(null); jumpToItem(tinyItem.id); startTimer(5, tinyItem.id); }}>
              Start 5 minutes
            </Button>
            <div className="sp" />
            <Button variant="gh" onClick={() => setOverlay(null)}>Close</Button>
          </>}>
          <div className="callout ok"><div className="prose"><strong>{tinyItem.title}</strong></div></div>
          <div className="blk">
            <div className="lbl">Your only job for 5 minutes</div>
            <div className="prose">
              {tinyItem.build?.steps[0]
                ?? (tinyItem.learn[0] ? `Open the primary resource and read only: ${tinyItem.learn[0].focus}` : "Read the first paragraph of the concept.")}
            </div>
          </div>
          <div className="prose dim" style={{ marginTop: 12, fontSize: 12.6 }}>
            Set the timer, do that one thing, then decide whether to carry on. Usually you will. That is the
            trick — the resistance is to starting, not to the work.
          </div>
        </Modal>
      ) : null}

      {caseById.size === 0 ? null : null}
    </div>
  );
}
