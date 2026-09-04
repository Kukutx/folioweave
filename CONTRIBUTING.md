# Contributing to FolioWeave

Thanks for helping improve FolioWeave.

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

For the complete browser suite:

```bash
npm run qa:all
```

Maintainers can run the optional visual comparison suite when a baseline deployment is available:

```bash
npm run qa:visual-compare
```

Set `BASELINE_URL` when the baseline is not running at the default local address.

## Design constraints

- Preserve the single vertical document scroller.
- Keep user-editable identity and content in `src/config/` and `src/content/`.
- Prefer focused feature modules over universal abstractions.
- Keep interaction tests separate from deterministic visual checks.
- Preserve accessibility, reduced-motion behavior, and keyboard interactions.
- Update `qa/assets-manifest.json` deliberately when protected demo assets change.

## Browser QA

QA auto-detects Chrome, Chromium, or Edge on Windows, macOS, and Linux. Set `CHROME_PATH` only when the browser is installed in a non-standard location.

## Pull requests

Keep changes focused and explain:

1. what problem is being solved;
2. whether behavior or visuals change;
3. which validation commands were run;
4. any intentional asset-manifest or visual-baseline changes.
