# Personal portfolio assets

Put assets you own or are licensed to publish here.

Recommended structure:

```text
portfolio/
├─ profile/
│  ├─ portrait.webp
│  └─ logo.svg
├─ photography/
│  ├─ photo-01.webp
│  └─ photo-02.webp
├─ projects/
│  └─ my-project/
│     ├─ desktop.webp
│     └─ mobile.webp
└─ resume/
   └─ resume.pdf
```

Reference files from `portfolio.json` using root-relative paths such as:

```json
"/portfolio/projects/my-project/desktop.webp"
```

`npm run content:check` verifies configured local files exist before development and production builds.
