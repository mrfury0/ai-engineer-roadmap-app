import { allItems, cases, flashdeck, interview, projects, resources, skills, tickets, weeks } from "../data";
import type { Progress } from "../state/progress";
import { itemById } from "../data";

export type SearchGroup =
  | "Lessons" | "Weeks" | "Projects" | "Tickets" | "Interview" | "Cases"
  | "Flashcards" | "Resources" | "Skills" | "Your notes";

export interface SearchHit {
  group: SearchGroup;
  title: string;
  subtitle?: string;
  /** Where selecting this hit should navigate. */
  target: { route: string; param?: string; itemId?: string };
}

const has = (haystack: string, needle: string) => haystack.toLowerCase().includes(needle);

/** Global search across every content type plus the learner's own notes. */
export function search(query: string, progress: Progress, limit = 60): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out: SearchHit[] = [];

  for (const item of allItems) {
    const hay = `${item.title} ${item.concept} ${item.why} ${item.keyConcepts.map((k) => `${k.term} ${k.def}`).join(" ")}`;
    if (has(hay, q)) {
      out.push({
        group: "Lessons",
        title: item.title,
        subtitle: `Week ${weeks.find((w) => w.days.some((d) => d.items.some((i) => i.id === item.id)))?.week} · ${item.kind}`,
        target: { route: "roadmap", itemId: item.id },
      });
    }
  }
  for (const w of weeks) {
    if (has(`${w.title} ${w.objective} ${w.narrative}`, q)) {
      out.push({ group: "Weeks", title: `Week ${w.week} — ${w.title}`, subtitle: w.objective, target: { route: "roadmap", param: w.id } });
    }
  }
  for (const p of projects) {
    if (has(`${p.name} ${p.blurb} ${p.stack.join(" ")}`, q)) {
      out.push({ group: "Projects", title: p.name, subtitle: `${p.tier} · week ${p.week}`, target: { route: "projects", param: p.id } });
    }
  }
  for (const t of tickets) {
    if (has(`${t.title} ${t.symptom} ${t.area} ${t.lesson}`, q)) {
      out.push({ group: "Tickets", title: t.title, subtitle: `${t.severity} · ${t.area}`, target: { route: "practice", param: t.id } });
    }
  }
  for (const q2 of interview) {
    if (has(`${q2.q} ${q2.answer}`, q)) {
      out.push({ group: "Interview", title: q2.q, subtitle: `${q2.topic} · ${q2.type}`, target: { route: "interview", param: q2.id } });
    }
  }
  for (const c of cases) {
    if (has(`${c.title} ${c.brief} ${c.industry} ${c.client}`, q)) {
      out.push({ group: "Cases", title: c.title, subtitle: c.client, target: { route: "cases", param: c.id } });
    }
  }
  for (const f of flashdeck) {
    if (has(`${f.front} ${f.back}`, q)) {
      out.push({ group: "Flashcards", title: f.front, subtitle: f.back.slice(0, 70), target: { route: "revision" } });
    }
  }
  for (const r of resources) {
    if (has(`${r.title} ${r.provider} ${r.note}`, q)) {
      out.push({ group: "Resources", title: r.title, subtitle: `${r.provider} · ${r.type}`, target: { route: "resources", param: r.id } });
    }
  }
  for (const s of skills) {
    if (has(`${s.name} ${s.blurb}`, q)) {
      out.push({ group: "Skills", title: s.name, subtitle: s.category, target: { route: "skills" } });
    }
  }
  for (const [id, note] of Object.entries(progress.notes)) {
    const item = itemById.get(id);
    if (item && note && has(note, q)) {
      out.push({ group: "Your notes", title: item.title, subtitle: note.slice(0, 80), target: { route: "roadmap", itemId: id } });
    }
  }
  return out.slice(0, limit);
}
