# Contributing

Corrections to the curriculum are as welcome as code. A dead link, a wrong explanation or a quiz
answer that is subtly off is worth a pull request.

## How the content pipeline works

There is no CMS. All content is JSON under `src/data/`, imported and asserted into the domain types
in `src/data/index.ts` — the one place in the codebase where a cast happens.

| File | Holds |
| --- | --- |
| `weeks.json` | Weeks → days → items (lessons, builds, debug missions), and each week's quiz |
| `resources.json` | Every external link, with its verification status |
| `skills.json` | The 40 tracked skills, their lessons and their evidence requirements |
| `projects.json` | Portfolio projects and their checklists |
| `tickets.json`, `cases.json`, `interview.json`, `flashdeck.json`, `assessment.json` | Practice material |
| `phases.json`, `paceProfiles.json`, `knowledgeMap.json` | Structure and metadata |

The shapes are defined in `src/types.ts`. If a JSON edit does not match the type, `npm run
typecheck` fails — that is the intended safety net, so read the type before inventing a field.

Content is cross-referenced by id: a skill lists `items` by lesson id, a project lists `itemIds`, a
lesson's `learn` entries point at `resId`s in `resources.json`, and `prereqs` point at other lesson
ids. Ids are permanent. Renaming one silently orphans every reference to it, so add a new id rather
than repurposing an old one.

## Adding or fixing a lesson

1. Find the right day in `weeks.json` and add or edit an item in its `items` array.
2. Give it a unique id following the existing scheme: `w<week>d<day><letter>`, e.g. `w4d3b`.
3. Fill in every field the `Item` type requires — including `why` (one sentence on why this matters
   professionally), `keyConcepts`, `done` (the observable "you are finished when…" criteria) and a
   realistic `time` in minutes.
4. Tag `pace` honestly. `core` is the spine, and a `minimum`-pace learner sees only core items; put
   anything optional in `recommended` or `intensive`.
5. Set `prereqs` to the ids the lesson genuinely depends on. The planner uses them to decide what is
   unblocked, so an over-tight prerequisite chain makes the app suggest nothing.
6. If the lesson teaches something a quiz asks about, make sure a `keyConcepts` term matches the
   wording used in the quiz explanation — that overlap is how missed questions are routed back to
   the right lesson for revision.

Prose style: British-neutral English, direct second person, dry. Match the surrounding copy.

## Every external link needs a verification date

Any entry added to `resources.json` must carry:

- `verified` — whether you actually opened the link,
- `lastVerified` — the ISO date (`YYYY-MM-DD`) you opened it, and
- `status` — `ok`, `moved` (with a `note` saying where it went), `broken`, or `unchecked` for pages
  that refuse automated checking.

`"verified": true` with no `lastVerified` is not acceptable. An unverifiable link is `unchecked` and
honest, not `ok` and hopeful. If you are fixing a link that has rotted, update `lastVerified` to the
date you checked the replacement, not the date the entry was first written.

## Before opening a pull request

Run all four. CI runs the same ones and will fail the PR otherwise.

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Two rules the linter cannot catch, both of which will be flagged in review:

- **No `dangerouslySetInnerHTML`.** Render authored text with `<Markdown>` or `<Inline>` from
  `src/lib/markdown`. The XSS regression test in `markdown.test.tsx` exists to keep this true.
- **Rules go in `src/lib/selectors.ts`, not in a component.** If you are adding logic that decides
  what a learner sees or has earned, it belongs in a pure function with a test beside it.
