<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## FolioWeave profile safety

- `portfolio.json` is author-owned on `personal`. Never copy `governance/demo-portfolio.json` over it, even temporarily.
- Never use `git checkout`, `git restore`, file copy, or scripted replacement on author-owned profile/assets merely to run Demo or QA checks.
- Use the existing sandboxed profile QA (`npm run qa:profiles`, `npm run qa:visual-fixtures`) for alternate-profile verification.
- Reusable app/schema/scripts/QA/docs changes must flow through `develop` -> `main` before `personal` is updated. `npm run qa:boundary` verifies that the personal tree differs from `main` only in profile-owned paths.
- Keep FolioWeave inside exactly one top-level project directory. Never create sibling `FolioWeave-*`, `.folioweave-*`, CI-artifact, verification, cleanup, or Git-worktree directories outside the repository.
- Temporary QA state must stay under ignored project-local paths such as `.generated/` or `qa/screens/` and must be removed by the task that creates it after successful verification.
- `public/portfolio/` is generated, ignored publication output, not an authoring/source boundary.
- `npm run content:build` enforces the branch/profile publication boundary. Do not bypass that guard to make a check pass.
