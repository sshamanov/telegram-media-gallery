# src-reference — Read-Only Reference Material

This directory contains an exact copy of the original MVP source code as it existed before the Kilo migration refactor.

**Do not modify files in this directory.**  
**Do not import from this directory in the active build.**

These files are excluded from Vite's build process via `vite.config.js` (the `exclude` pattern for `src-reference/**`).

## Contents

| File | Description |
|------|-------------|
| `index.html` | Original single-page HTML shell |
| `main.js` | Original monolithic 1868-line application logic |
| `style.css` | Original stylesheet |
| `vite.config.js` | Original Vite configuration |
| `package.json` | Original dependency manifest |
| `.env.example` | Environment variable template |

## Purpose

- Reference implementation during modular rewrite
- Behaviour comparison baseline
- Business logic extraction guide

See `../kilo-dev-process.md` for the full architectural analysis and refactoring plan.
