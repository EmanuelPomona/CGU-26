# STATUS: agent/reviewer
Task: unassigned (no task in REVIEW; manager instructed stand-by)
Round: 0
Last updated: 2026-11-14T20:33:00Z

Timestamp note: entries before 20:31Z were written from estimates, not a clock.
Corrected below to the commit times (`git log --format=%cI`).

## Skills invoked so far
- none yet. Review-stage skills (ecc:browser-qa, frontend-design:frontend-design,
  ui-ux-pro-max:ui-ux-pro-max, ecc:make-interfaces-feel-better,
  superpowers:verification-before-completion) are deferred to the review stage
  they govern (protocol section 18, mandatory timing).

## Review scope (from main 409dc98, ADR-007 / ADR-008)
- Backend: TASK-001, 002, 003, 004, 006 (Option.roles). Gate unchanged:
  B-1..B-5, contract-test.sh, pytest.
- Frontend: TASK-101, TASK-107 (Dispatch UI wired to backend). TASK-102..106
  superseded (BACKLOG). Gate: F-1..F-6, U-1..U-3, G-*, P-*, I-*.
- ADR-008: owner waived frontend unit tests, screenshots, console log for the
  build. Missing BUILDER evidence is an owner decision (DEBT.md), not a worker
  violation. Protocol 10/22 still bar APPROVED without runtime evidence.
  My default: I still drive the frontend in a browser myself at review (my
  time, not a builder's) so the verdict rests on a real walkthrough. Told
  manager and owner; awaiting redirect if the owner wants otherwise.
- Visual findings vs the owner's mockup: advisory only (brief, "Justified
  exceptions").

## Done
- [x] Read planning docs at 54afc1c: AGENT_PROTOCOL, ACCEPTANCE, API, PRODUCT,
      DESIGN_BRIEF, DESIGN_CONSTRAINTS, SKILL_ROUTING, tasks/INDEX
- [x] Confirmed review tooling present: scripts/audit-skills.sh,
      contract-test.sh, slop-check.sh, bootstrap.sh, tasks.sh
- [x] Pre-review palette contrast check (commit f8416cd, 19:31Z)
- [x] Read main 409dc98 replan: ADR-007, ADR-008, DEBT.md, ACCEPTANCE diff,
      rewritten DESIGN_BRIEF, TASK-107, TASK-006, API/openapi diff (20:31Z)

## In progress
- [ ] Standing by for manager message after integration on main. Then: merge
      main, read every REVIEW task + handoffs, bootstrap, start own backend
      on 8003 / frontend on 3003, review order step 1.

## Verified
- Original brief palette (54afc1c): tight #A8690F failed 4.5:1 (4.14 panel);
  manager fixed to #985F0E in 0ec5ef9, recomputed 4.88/4.51. Now moot: the
  brief rewritten in c457602 adopts the owner mockup's palette.
- Ports (checked ~19:58Z, commit 34e8f45): 8003/3003 free; 8002 (pid 86078)
  and 8012 (pid 32764) held by other Python processes. This session has made
  no HTTP requests and started no processes.
- **Defect on main (reported to manager 20:3xZ):** a50723f deleted
  `docs/reference/sample-prototype.html`, but API.md "Evaluation model
  (normative)" still defines rules 3, 4, 7, 8, 9, 10 and the `fire`/`flood`
  preset geometry only as "as the reference X". Also cited by
  ARCHITECTURE.md:33, TASK-001:49, handoffs/main.md:16. Surviving copy:
  `git show 54afc1c:docs/reference/sample-prototype.html`.
- **Stale criteria on main (reported):** P-2 and P-5 name the "indicator
  strip"; G-6 names "map and board". The Dispatch UI has neither. Unless the
  manager says otherwise I gate: indicator strip -> TASK-107 "Normal vs
  changed" comparison; board -> To dispatch view.

## Pre-review watch list (hypotheses to check at review, not findings)
- Runtime isolation: own backend on 8003, own frontend on 3003. Never touch
  8012 or 8002. Before trusting a response, confirm with lsof that the pid
  serving 8003 is mine.
- Skill audit: SKILL_ROUTING names unregistered skills
  (`redesign-existing-projects`, `image-to-code`, `ecc:nextjs`); a claim of
  one that the audit does not show is a fabricated-skill CRITICAL.
- TASK-006: roles from unrounded values; exactly one holder per role when any
  feasible keep/reroute exists; [] for non-route kinds and infeasible options;
  30-minute community window. Recompute from a live options response.
- TASK-107 / G-7 / U-3: grep frontend/src for "AI", "Ask AI", "optimal",
  "model predicts", personal names; "MOCKUP" badge gone from wired views;
  "Scripted example" on On route.
- TASK-107 F-1: stop my backend; Map / To dispatch / Network must show error +
  Retry, not fallback data. grep for DISPATCH, WH, TERM, ROLE, routes.json
  still imported by wired views.
- TASK-107 Requests: no explicit null in optional request fields (API.md now
  says null is 422); no hardcoded port (I-3).
- F-5: frontend/src/api/schema.d.ts regenerates byte-identical from
  docs/openapi.yaml via `gen:api`.
- 409 swap-lock path (API.md change e207050): UI shows server message and
  reloads options.

## Blocked on
- nothing (waiting is by instruction, not a blocker)
