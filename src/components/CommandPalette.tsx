import { useEffect, useMemo, useRef, useState } from "react";
import { useProgress } from "../state/ProgressContext";
import { search, type SearchHit } from "../lib/search";
import { truncate } from "../lib/markdown";

export interface PaletteAction { title: string; key?: string; run: () => void }

export function CommandPalette({ onClose, onNavigate, actions }: {
  onClose: () => void;
  onNavigate: (target: SearchHit["target"]) => void;
  actions: PaletteAction[];
}) {
  const { progress } = useProgress();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const results = useMemo(() => {
    if (!q.trim()) {
      return actions.map((a) => ({ group: "Actions" as const, title: a.title, key: a.key, run: a.run }));
    }
    return search(q, progress).map((h) => ({ group: h.group, title: h.title, subtitle: h.subtitle, run: () => onNavigate(h.target) }));
  }, [q, progress, actions, onNavigate]);

  useEffect(() => { setIdx(0); }, [q]);
  useEffect(() => {
    listRef.current?.querySelector(".pitem.on")?.scrollIntoView({ block: "nearest" });
  }, [idx]);

  const choose = (i: number) => {
    const r = results[i];
    if (!r) return;
    onClose();
    r.run();
  };

  let lastGroup = "";
  return (
    <div className="ovl" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette">
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search lessons, projects, tickets, questions, resources, notes…"
          aria-label="Search"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, results.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
            else if (e.key === "Enter") { e.preventDefault(); choose(idx); }
            else if (e.key === "Escape") onClose();
          }}
        />
        <div className="plist" ref={listRef}>
          {results.length === 0 ? <div className="pgroup">No matches</div> : null}
          {results.map((r, i) => {
            const header = r.group !== lastGroup ? r.group : null;
            lastGroup = r.group;
            return (
              <div key={`${r.group}-${i}`}>
                {header ? <div className="pgroup">{header}</div> : null}
                <div className={`pitem${i === idx ? " on" : ""}`} onMouseEnter={() => setIdx(i)} onClick={() => choose(i)}
                  role="option" aria-selected={i === idx}>
                  <span className="pt">
                    {truncate(r.title, 78)}
                    {"subtitle" in r && r.subtitle ? <span className="dim"> — {truncate(String(r.subtitle), 46)}</span> : null}
                  </span>
                  {"key" in r && r.key ? <span className="pk kbd">{r.key}</span> : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
