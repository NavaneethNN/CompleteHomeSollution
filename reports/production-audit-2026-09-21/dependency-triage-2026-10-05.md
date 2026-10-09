# Dependency triage — 5 October 2026

`npm audit --omit=dev --json` reports **0 production advisories** with the current lockfile. CI now fails when a high-severity production advisory appears. The four audit entries originally reported for Prisma, `@prisma/config`, `deepmerge-ts`, and `mysql2` no longer appear in the production audit. The lockfile uses the existing overrides for `deepmerge-ts@8.0.2` and `mysql2@3.24.5`.

The full development audit reports five high package entries in one dependency chain (`eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces`) and one low entry for `tsx` → `esbuild`. The five high entries represent the same `braces` advisory propagated through its parents, not five separate exploits. [`braces` has no patched release yet](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). Here it receives ESLint's project file patterns, not customer request data, and is not installed in a production-only dependency set. Retain the advisory with this scope justification; review it when a patched `braces` release or upstream ESLint dependency becomes available.

The [`esbuild` advisory](https://github.com/evanw/esbuild/security/advisories/GHSA-g7r4-m6w7-qqqr) applies to its development server on Windows. This project uses Next.js/Turbopack for development and does not invoke `esbuild.serve`; `tsx` uses esbuild to run local scripts and tests. The current development environment is macOS. Review when `tsx` accepts the patched `esbuild` version; do not force an incompatible override without validating the script runner.

This is a dependency reachability assessment, not proof that every deployed bundle is free of vulnerable code. Recheck both audit modes and the production build before release.
