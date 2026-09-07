import { flashdeck, tickets } from "../data";
import { useProgress } from "../state/ProgressContext";
import { earnedXp, levelFromXp, overallProgress, planSession, revisionQueue } from "../lib/selectors";

export interface NavEntry { id: string; label: string; icon: string }
const NAV: (NavEntry | { group: string })[] = [
  { group: "Learn" },
  { id: "dashboard", label: "Dashboard", icon: "◈" },
  { id: "today", label: "Today", icon: "◉" },
  { id: "roadmap", label: "Roadmap", icon: "▤" },
  { id: "revision", label: "Revision", icon: "↻" },
  { group: "Practice" },
  { id: "practice", label: "Engineering Tickets", icon: "⚑" },
  { id: "interview", label: "Interview Prep", icon: "◍" },
  { id: "cases", label: "Consulting Cases", icon: "◆" },
  { group: "Track" },
  { id: "skills", label: "Skill Tree", icon: "⬡" },
  { id: "map", label: "Knowledge Map", icon: "⌘" },
  { id: "projects", label: "Projects", icon: "▣" },
  { id: "portfolio", label: "Portfolio", icon: "★" },
  { id: "progress", label: "Progress", icon: "▦" },
  { group: "Reference" },
  { id: "resources", label: "Resources", icon: "❐" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

export function Sidebar({ view, navigate, open, onClose }: {
  view: string; navigate: (v: string) => void; open: boolean; onClose: () => void;
}) {
  const { progress } = useProgress();
  const level = levelFromXp(earnedXp(progress));
  const overall = overallProgress(progress);
  const overdue = revisionQueue(progress).filter((r) => r.overdue).length;
  const todayCount = planSession(progress, 120, "normal").length;
  const openTickets = tickets.filter((t) => !progress.tickets[t.id]?.done).length;

  const badge = (id: string) => {
    if (id === "revision" && overdue) return <span className="nb hot">{overdue}</span>;
    if (id === "today" && todayCount) return <span className="nb">{todayCount}</span>;
    if (id === "practice" && openTickets) return <span className="nb">{openTickets}</span>;
    return null;
  };

  return (
    <aside id="sidebar" className={open ? "show" : ""}>
      <div className="brand">
        <div className="logo">Æ</div>
        <div>
          <div className="bt">AI Engineer</div>
          <div className="bs">12-week roadmap</div>
        </div>
      </div>
      <nav className="navwrap">
        {NAV.map((n, i) =>
          "group" in n ? (
            <div className="navsec" key={`g${i}`}>{n.group}</div>
          ) : (
            <div key={n.id} className={`nav${view === n.id ? " on" : ""}`}
              onClick={() => { navigate(n.id); onClose(); }}
              role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter") { navigate(n.id); onClose(); } }}>
              <span className="ni">{n.icon}</span>{n.label}{badge(n.id)}
            </div>
          ),
        )}
      </nav>
      <div className="sidefoot">
        <div className="lvl"><span>Level <b>{level.level}</b></span><span>{earnedXp(progress).toLocaleString()} XP</span></div>
        <div className="xpbar"><i style={{ width: `${level.pct}%` }} /></div>
        <div className="lvl">
          <span className="dim">{level.into} / {level.need}</span>
          <span className="dim">{overall.pct}% course</span>
        </div>
      </div>
    </aside>
  );
}

export function TopBar({ crumbs, onMenu, onSearch }: {
  crumbs: React.ReactNode; onMenu: () => void; onSearch: () => void;
}) {
  const { progress } = useProgress();
  const due = flashdeck.filter((c) => !progress.flash[c.id]).length;
  return (
    <header className="topbar">
      <button className="menubtn" onClick={onMenu} aria-label="Open menu">≡</button>
      <div className="crumbs">{crumbs}</div>
      <div className="topspace" />
      <div className="streakchip" title="Streak survives one missed day">
        🔥 <b>{progress.streak || 0}</b><span className="dim">d</span>
      </div>
      <button className="searchbtn" onClick={onSearch} aria-label="Search everything" title={`${due} flashcards unseen`}>
        <span>⌕</span><span>Search everything</span><span className="sp" /><span className="kbd">Ctrl K</span>
      </button>
    </header>
  );
}

export function Toasts() {
  const { toasts } = useProgress();
  return (
    <div id="toast">
      {toasts.map((t) => (
        <div className={`toast ${t.tone === "ok" ? "ok" : ""}`} key={t.id}>
          {t.tone === "ok" ? <span className="xp">{t.message}</span> : t.message}
        </div>
      ))}
    </div>
  );
}
