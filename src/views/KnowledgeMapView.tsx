import { useEffect } from "react";
import type { ViewProps } from "../App";
import { itemById, knowledgeMap, skills, weekOfItem, weeks } from "../data";
import type { KnowledgeEdge, KnowledgeNode } from "../types";
import { useProgress } from "../state/ProgressContext";
import { isDone, weekProgress } from "../lib/selectors";
import { Card, Pill } from "../components/primitives";

export function KnowledgeMapView({ setCrumbs }: ViewProps) {
  const { progress } = useProgress();
  useEffect(() => setCrumbs(<b>Knowledge Map</b>), [setCrumbs]);

  const byWeek = new Map<number, KnowledgeNode[]>();
  for (const n of knowledgeMap.nodes) {
    const list = byWeek.get(n.week);
    if (list) list.push(n);
    else byWeek.set(n.week, [n]);
  }
  const weekNumbers = [...byWeek.keys()].sort((a, b) => a - b);

  const outEdges = new Map<string, KnowledgeEdge[]>();
  for (const e of knowledgeMap.edges) {
    const list = outEdges.get(e.from);
    if (list) list.push(e);
    else outEdges.set(e.from, [e]);
  }

  const label = new Map(knowledgeMap.nodes.map((n) => [n.id, n.label] as const));

  /** A concept counts as covered when every lesson in its category, up to its week, is done. */
  const nodeDone = new Map<string, boolean>(
    knowledgeMap.nodes.map((n) => {
      const ids = skills.filter((s) => s.category === n.group).flatMap((s) => s.items);
      const upToWeek = ids.filter((id) => {
        const w = weekOfItem.get(id);
        return itemById.has(id) && w !== undefined && w.week <= n.week;
      });
      return [n.id, upToWeek.length > 0 && upToWeek.every((id) => isDone(progress, id))] as const;
    }),
  );

  return (
    <div className="page">
      <div>
        <div className="h1">Knowledge map</div>
        <div className="sub">
          How the pieces connect. Each row is a week; each arrow is a dependency that exists for a
          reason. Green means you have finished the lessons behind it.
        </div>
      </div>

      <div className="row wrap" style={{ gap: 6, margin: "14px 0" }}>
        <Pill tone="ok">■ covered</Pill>
        <Pill tone="out">■ ahead of you</Pill>
        <span className="dim" style={{ fontSize: 12 }}>
          {knowledgeMap.nodes.length} concepts · {knowledgeMap.edges.length} dependencies
        </span>
      </div>

      {weekNumbers.map((wn) => {
        const nodes = byWeek.get(wn) ?? [];
        const edges = nodes.flatMap((n) => outEdges.get(n.id) ?? []);
        const wk = weeks.find((w) => w.week === wn);
        return (
          <Card key={wn} style={{ marginBottom: 10 }}>
            <div className="row" style={{ marginBottom: 10 }}>
              <Pill tone={wk && weekProgress(progress, wk).pct === 100 ? "ok" : "out"}>
                Week {wn}
              </Pill>
              {wk ? <span className="h3">{wk.title}</span> : null}
            </div>
            <div className="row wrap" style={{ gap: 8 }}>
              {nodes.map((n) => (
                <div key={n.id} className={`kmnode${nodeDone.get(n.id) ? " dn" : ""}`}
                  style={{ margin: 0, minWidth: 135 }}>
                  {n.label}
                  <div className="kw">{n.group}</div>
                </div>
              ))}
            </div>
            {edges.length ? (
              <div className="edgelist"
                style={{ marginTop: 11, borderTop: "1px solid var(--line)", paddingTop: 9 }}>
                {edges.map((e, i) => (
                  <div key={`${e.from}-${e.to}-${i}`}>
                    {label.get(e.from) ?? e.from} <span style={{ color: "var(--ac)" }}>→</span>{" "}
                    {label.get(e.to) ?? e.to} <span className="dim">— {e.label}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}
