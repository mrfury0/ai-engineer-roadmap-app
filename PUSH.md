# Getting this onto GitHub

Three commands. The repo is already initialised and committed on `main`, with CI and the
Pages deploy workflow wired up.

## 1. Create the repo

Go to https://github.com/new — name it **ai-engineer-roadmap**, make it **public**,
and do **not** tick "Add a README" (this repo already has one).

## 2. Push

From inside this folder:

```bash
git remote add origin https://github.com/mrfury0/ai-engineer-roadmap-app.git
git branch -M main
git push -u origin main
```

## 3. Turn on Pages

Repo → **Settings** → **Pages** → under "Build and deployment", set **Source** to
**GitHub Actions**. That is the only click; the workflow is already in the repo.

The deploy runs on every push to `main`. Watch it under the **Actions** tab — first run
takes about two minutes. Your site lands at:

**https://mrfury0.github.io/ai-engineer-roadmap-app/**

If the page loads blank, the base path is wrong — the workflow derives it from the repo
name, so a repo named something other than `ai-engineer-roadmap` still works, but a
manual `npm run build` locally does not set it. That is expected; only the deployed build
needs it.

## What runs automatically

- **CI** (`.github/workflows/ci.yml`) on every push and pull request: typecheck → lint →
  159 unit tests → production build, plus a separate job running 26 Playwright end-to-end
  tests on desktop and mobile viewports.
- **Deploy** (`.github/workflows/deploy.yml`) on every push to `main`.

## Local development

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests
npm run e2e      # end-to-end (builds and serves automatically)
```
