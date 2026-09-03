# Security Policy

## Supported version

The current `main` branch is the supported version of FolioWeave.

## Reporting a vulnerability

Please do not open a public issue for a security vulnerability. Use GitHub's private security advisory flow for this repository so the issue can be reviewed before disclosure.

When reporting, include:

- affected route/component;
- reproduction steps;
- expected vs actual behavior;
- browser/runtime details;
- impact and any known workaround.

## Security baseline

The project intentionally keeps a restrictive CSP, disables framing, scopes camera access to self, avoids runtime CDN script dependencies, sanitizes JSON-LD script payloads, and runs dependency audits as part of release checks.
