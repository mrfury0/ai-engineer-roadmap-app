# View authoring contract (read fully before writing a view)

You are porting a vanilla-JS learning app to TypeScript + React 18. The reference implementation
lives at /home/claude/roadmap/build/app_views1.js and app_views2.js (plain JS, string-templated).
Your job is to reproduce each view's behaviour and copy faithfully — same content, same copy text,
same information — as idiomatic typed React.

## Non-negotiables
- TypeScript strict. `npx tsc --noEmit -p tsconfig.app.json` must pass with zero errors.
- ESLint clean: `npx eslint src --max-warnings 0`.
- NO `dangerouslySetInnerHTML`. Use `<Markdown text={...} />` / `<Inline text={...} />` from `../lib/markdown`.
- NO `any`. NO non-null assertions except where a Map lookup is provably safe (add a short comment).
- All list children need stable `key`s.
- Reuse the existing CSS classes verbatim (src/styles.css is already ported and complete) — do not invent new class names, and do not add styled-components or CSS modules.
- Prose is British-neutral English, direct second person, dry. Keep the reference app's wording where it exists; it was written deliberately.

## Every view is a named export with this exact signature

```tsx
import { useEffect } from "react";
import type { ViewProps } from "../App";

export function Roadmap({ param, navigate, openItem, setOpenItem, jumpToItem, openOverlay, startTimer, sessionMode, setSessionMode, setCrumbs }: ViewProps) {
  useEffect(() => setCrumbs(<b>Roadmap</b>), [setCrumbs]);   // ALWAYS set crumbs in an effect
  return <div className="page">…</div>;
}
```

`ViewProps` (from ../App):
- `param: string | null` — the hash route's second segment (e.g. `#roadmap/w4` → `"w4"`).
- `navigate(view, param?)` — change route.
- `openItem` / `setOpenItem` — the currently expanded lesson id (app-level, so cross-view jumps work).
- `jumpToItem(id)` — navigate to a lesson's week and scroll it into view.
- `openOverlay(o)` — `{kind:"quiz",quizId}` | `{kind:"flash",all:boolean}` | `{kind:"assessment"}` | `{kind:"whatnow"}` | `{kind:"tiny",itemId}` | `{kind:"palette"}` | `null`.
- `startTimer(minutes, itemId | null)`.
- `sessionMode` / `setSessionMode` — `"quick" | "hour" | "deep" | "tired"`.
- `setCrumbs(node)` — the topbar breadcrumb.

## What you may import

- Data: `import { weeks, phases, skills, projects, resources, tickets, cases, interview, flashdeck, assessment, knowledgeMap, paceProfiles, allItems, itemById, weekOfItem, dayOfItem, resourceById, skillById, projectById, ticketById, caseById, totalXp } from "../data";`
- State: `import { useProgress } from "../state/ProgressContext";` → gives `{ progress, update, reset, importProgress, storageAvailable, pushToast, toggleItemDone, setStatus, setConfidence, setNote, setPace, toggleTicket, togglePortfolio, setProjectStatus, setCaseAttempt, revealCase, setInterviewResult, markInterviewSeen, gradeFlash, recordQuiz, logMinutes, markRevised }`
- Selectors (all pure, in `../lib/selectors`): `isInPace, activeItems, isDone, overallProgress, earnedXp, levelFromXp, weekProgress, weekUnlocked, currentWeek, prereqsMet, remainingItems, nextBestItem, planSession, revisionQueue, skillState, projectChecklistScore, portfolioReadiness, projectItemProgress, weakAreas, paceIncludes`
- `import { daysAway } from "../state/progress";`
- Dates: `import { humanMinutes, formatDate, todayIso, addDays, daysBetween } from "../lib/dates";`
- Markdown: `import { Markdown, Inline, truncate } from "../lib/markdown";`
- Primitives (`../components/primitives`): `Card, Pill, Bar, Stat, Section, Button, Empty, Callout, Difficulty`
  - `<Pill tone="ac|ok|warn|bad|pur|cy|out">`, `<Bar pct={n} tone="ok|warn|grad" tall />`,
    `<Stat label value note />`, `<Section title="…">{optional right-hand children}</Section>`,
    `<Button variant="p|g|gh" size="sm|lg" onClick>`, `<Callout tone="ok|bad|ac">`.
- Lesson rendering: `import { ItemCard, ItemMeta } from "../components/ItemCard";`
  `<ItemCard item={item} open={openItem === item.id} onToggleOpen={() => setOpenItem(openItem === item.id ? null : item.id)} onJump={jumpToItem} onOpenQuiz={(id) => openOverlay({kind:"quiz",quizId:id})} onOpenCase={(id) => navigate("cases", id)} onStartTimer={startTimer} />`
- `import { dueCards } from "../components/FlashcardRunner";` (returns flashcards due today)

Look at `src/views/Dashboard.tsx` — it is the finished reference. Match its structure and density.

## Verify before you finish
```
cd /home/claude/tsapp
npx tsc --noEmit -p tsconfig.app.json
npx eslint src --max-warnings 0
npx vite build
```
All three must be clean. Fix every error yourself; do not leave a view stubbed.
