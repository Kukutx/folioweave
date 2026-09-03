# Contributing to FolioWeave

Thanks for helping improve the theme.

## Development

```bash
npm install
npm run dev
```

Before opening a pull request:

```bash
npm run lint
npm run typecheck
npm run check
npm run qa:assets
```

For browser QA, start the production build on port 4181:

```bash
npm start -- -p 4181
npm run qa:all
```

`qa:all` is self-contained and does not require the private/local reference mirror.

Maintainers who also have the reference mirror on port 4173 can run:

```bash
npm run qa:reference
```

## Design constraints

- Do not add iframe, reverse-proxy, screenshot or legacy-runtime fallbacks.
- Preserve the single vertical document scroller.
- Keep user-editable identity/content in `src/config/` and `src/content/` rather than scattering constants through components.
- Prefer focused feature modules over universal abstractions.
- Keep dynamic behavior tests separate from deterministic visual parity.
- Do not remove protected demo/reference assets without intentionally updating `qa/assets-manifest.json` and documenting why.

## Browser QA

QA auto-detects Chrome, Chromium or Edge on Windows, macOS and Linux. Set `CHROME_PATH` only when the browser is installed in a non-standard location.

## Pull requests

Keep changes focused and explain:

1. what problem is being solved;
2. whether DOM/visual behavior changes;
3. which QA commands were run;
4. any intentional parity or asset-manifest changes.
