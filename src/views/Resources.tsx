import { useEffect, useMemo, useState } from "react";
import type { ViewProps } from "../App";
import { allItems, resources, weekOfItem } from "../data";
import type { Item, ResourceType } from "../types";
import { formatDate } from "../lib/dates";
import { truncate } from "../lib/markdown";
import { Pill, Stat } from "../components/primitives";

const ICONS: Record<ResourceType, string> = {
  docs: "📘", tutorial: "🧭", video: "▶", article: "📝", repo: "◈",
  course: "🎓", book: "📗", paper: "📄", tool: "🔧",
};

function CostLabel({ cost }: { cost: "free" | "paid" | "freemium" }) {
  if (cost === "free") return <span style={{ color: "var(--ok)" }}>Free</span>;
  if (cost === "paid") return <span style={{ color: "var(--warn)" }}>Paid</span>;
  return <span style={{ color: "var(--cy)" }}>Free tier</span>;
}

export function Resources({ jumpToItem, setCrumbs }: ViewProps) {
  const [query, setQuery] = useState("");
  useEffect(() => setCrumbs(<b>Resources</b>), [setCrumbs]);

  /** resource id → the lessons that use it, built once from the flat item list. */
  const usedIn = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const item of allItems) {
      for (const ref of item.learn) {
        const list = map.get(ref.resId);
        if (list) list.push(item);
        else map.set(ref.resId, [item]);
      }
    }
    return map;
  }, []);

  const q = query.trim().toLowerCase();
  const list = resources.filter((r) =>
    !q || `${r.title} ${r.provider} ${r.note} ${r.type}`.toLowerCase().includes(q));

  const verified = resources.filter((r) => r.verified).length;
  const free = resources.filter((r) => r.cost === "free").length;

  return (
    <div className="page">
      <div className="h1">Resources</div>
      <div className="sub">
        Every link was fetched and checked on 6 September 2026. Where a page had moved, the URL here is the one
        that works.
      </div>

      <div className="grid g3" style={{ margin: "16px 0" }}>
        <Stat label="Resources" value={resources.length} note="across the curriculum" />
        <Stat label="Verified" value={`${verified}/${resources.length}`} note="checked and on-topic" />
        <Stat label="Free" value={free} note="no paywall" />
      </div>

      <input
        className="txt"
        placeholder="Filter resources…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ marginBottom: 14 }}
      />

      {list.map((r) => {
        const used = usedIn.get(r.id) ?? [];
        return (
          <div className="res" key={r.id}>
            <div className="ricon">{ICONS[r.type] ?? "🔗"}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="row wrap" style={{ gap: 7 }}>
                <a className="rt" href={r.url} target="_blank" rel="noopener noreferrer">{r.title} ↗</a>
                {r.verified
                  ? <span className="vbadge">✓ Verified{r.status === "moved" ? " (URL updated)" : ""}</span>
                  : <span className="vbadge q" title={r.note}>⚠ Not auto-checked</span>}
              </div>
              <div className="rp">
                {r.provider} · {r.type} · ~{r.minutes}m · <CostLabel cost={r.cost} /> · checked {formatDate(r.lastVerified)}
              </div>
              <div className="rf">{r.note}</div>
              {used.length ? (
                <div className="row wrap" style={{ gap: 5, marginTop: 8 }}>
                  {used.slice(0, 5).map((i) => (
                    // Every item id comes from allItems, so weekOfItem always has it.
                    <Pill key={i.id} tone="out" onClick={() => jumpToItem(i.id)}>
                      W{weekOfItem.get(i.id)!.week} · {truncate(i.title, 26)}
                    </Pill>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
