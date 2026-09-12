# FolioWeave design system

FolioWeave is intentionally opinionated. It is not a generic page builder: its reusable value comes from preserving a coherent visual and interaction language while letting authors replace the content.

## Visual compatibility contract

**An approved visual is a compatibility contract.**

Refactoring, performance work, dependency upgrades, abstraction, and cleanup must not visibly alter an approved state unless that visual is explicitly identified as incorrect. A green build is not permission to accept a visual change.

When a visual change is intentional:

1. explain the problem with the previous result;
2. verify the new result at the affected breakpoints;
3. run interaction and geometry checks;
4. review the screenshot difference;
5. update only the baseline regions that are intentionally different.

Never regenerate a complete baseline set merely to make a failing comparison green.

## Design language

The current language combines three ideas:

- **Editorial storytelling** — strong hierarchy, generous pacing, readable long-form sections, restrained typography.
- **Tactile software objects** — camera, resume printer, cards, windows, selection outlines, and tool-like controls feel like things that can be handled.
- **Playful system metaphors** — Designer Cursors, status UI, highlights, and small interface jokes make the portfolio itself feel like designed software.

New features should reinforce those ideas rather than introduce an unrelated visual dialect.

## Token ownership

`src/styles/theme.css` is the semantic entry point.

- `--color-*`: portfolio/editorial color semantics.
- `--ui-*`: generic application/system-state surfaces, text, borders, cards, and shadows.
- `--figma-*`: Designer Cursor / selection-decoration semantics.
- `--font-*`: typography families.
- `--layer-*`: z-index roles.
- `--space-*`, `--radius-*`, `--motion-*`: shared layout and motion primitives.

Component-specific illustrations may keep literal colors when the colors are part of the object itself. The Instax camera, for example, is artwork; converting every lens gradient into a global token would make the system less clear, not more reusable.

## Styling boundaries

`src/app/globals.css` is an ordered import manifest. Existing portfolio CSS under `src/styles/portfolio/` is cascade-sensitive and should not be reorganized merely for aesthetics.

For new work:

- use semantic tokens for page/system-level decisions;
- prefer CSS Modules for component-local styling;
- keep demo-route styling under `src/demo/styles/`;
- do not introduce `transition: all`;
- do not move declarations across cascade boundaries without geometry and screenshot verification.

## Motion philosophy

Motion communicates state and texture; it must not own layout correctness.

- one animated property has one interpolation owner;
- continuous effects stop when off-screen or when the document is hidden;
- reduced motion disables unnecessary interpolation and GPU prewarming, not just long durations;
- decorative effects never leave inline styles on content;
- content remains readable in server HTML before hydration;
- modal/scroll interactions restore focus and scroll synchronously.

## Responsive behavior

Breakpoints are visual contracts, not opportunities to redesign content independently. Art-directed mobile media is explicit in `portfolio.json`; otherwise the same content adapts through the shared layout.

When changing responsive behavior, test the established matrix: 360, 390, 767, 768, 820, and 1440 where relevant.

## Extension rule

Prefer a focused feature module over a universal schema/plugin abstraction. Adding projects, photos, About content, resumes, and Markdown posts should remain data-driven. A genuinely new homepage section or interaction can be code, with its own ownership and QA.

See [VISUAL-QA.md](VISUAL-QA.md) for the verification workflow.
