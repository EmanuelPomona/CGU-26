# Accepted Debt

Findings the reviewer accepted rather than blocking on, and protocol violations
recorded during integration.

Nothing is deleted from this file during a project. It is an input to
`docs/RETRO.md` at the end.

| Date | Task | Severity | Finding | Why accepted |
|---|---|---|---|---|
| 2026-11-14 | TASK-107 (frontend) | High (process) | No frontend unit tests, no screenshots at 1440/768/390, no console log; frontend cannot be APPROVED under protocol sections 10 and 22 | Owner decision recorded by the manager (ADR-008): time before the presentation |
| 2026-11-14 | TASK-107 (frontend) | Medium | On route view (fatigue, driver chat, problem options) is scripted data, not computed by the backend | Owner decision (ADR-007); labelled as a scripted example in the UI |
| 2026-11-14 | TASK-107 (frontend) | Low | `docs/review/F-01..F-12*.png` and `F-console.txt` were captured on the FIRST frontend UI, which the owner later replaced; they do not show the Dispatch UI | Merged as history; not evidence for TASK-107 (owner waived evidence, ADR-008) |
