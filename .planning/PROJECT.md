# Validater

## What This Is

An AI-powered testing platform where users provide a URL and describe what to test in natural language, and an AI agent generates test paths, executes them across multiple viewports, and produces detailed results with video recordings. Built for QA engineers, developers, and non-technical stakeholders alike.

## Core Value

Users can describe what to test in plain English, point at any URL, and get comprehensive test execution with visual proof — no test code required.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] AI agent generates test steps from natural language + URL
- [ ] Supports UI/E2E, API, visual regression, and accessibility tests
- [ ] Live browser stream during test execution
- [ ] Step-by-step replay with screenshots after execution
- [ ] Video recording of test runs (quick recording mode)
- [ ] Polished video export for sharing/demos (multiple resolutions)
- [ ] Cross-viewport testing (mobile, tablet, desktop responsive)
- [ ] Desktop browser testing (Chrome, Firefox, Safari, Edge)
- [ ] Mobile browser emulation (iOS Safari, Android Chrome)
- [ ] Temporal orchestrates full pipeline: agent reasoning + test execution + video generation
- [ ] Platform authentication (user sign-up/login)
- [ ] Test suite generation from feature descriptions (multiple test cases)
- [ ] Test report generation with results across viewports
- [ ] 100% test coverage for platform code

### Out of Scope

- Native OS-level app testing — complexity too high for v1, focus on web
- Test target authentication (agent logging into tested sites) — v2 feature
- Self-hosted deployment — start as SaaS, self-hosted later
- Real physical device testing — emulation/responsive viewports for v1

## Context

- **Agent framework:** Pi agent (github.com/badlogic/pi-mono) for AI agent orchestration, plus research into actively maintained DSPy-equivalent systems for TypeScript
- **Workflow engine:** Temporal for durable, retryable, observable workflow orchestration covering the full test pipeline
- **Frontend stack:** TypeScript, React, shadcn/ui, TanStack ecosystem (Router, Query, Table, Form, etc.)
- **Browser automation:** Playwright for cross-browser test execution and video capture
- **AI backbone:** Claude Code or equivalent agentic thinking model for test path generation
- **User base:** Broad — QA engineers, developers, and non-technical product stakeholders
- **Video output:** Two modes — quick debug recordings and polished export-quality videos at user-selected resolutions

## Constraints

- **Tech stack**: TypeScript end-to-end (frontend + backend) — team preference and consistency
- **UI framework**: React + shadcn/ui + full TanStack ecosystem — non-negotiable
- **Workflow engine**: Temporal — required for agent orchestration and test pipeline durability
- **Test coverage**: 100% test coverage on platform code — quality bar
- **AI agent**: Pi agent + DSPy-like system for TypeScript — research needed for best actively maintained option

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| TypeScript full-stack | Consistency, team expertise, single language across frontend/backend | — Pending |
| Temporal for orchestration | Durable workflows, built-in observability, retry semantics for flaky test runs | — Pending |
| Pi agent for AI orchestration | User preference, active development | — Pending |
| SaaS-first deployment | Lower initial complexity, faster to market | — Pending |
| Responsive viewports as primary cross-platform | Achievable in v1, desktop/mobile browsers as stretch | — Pending |

---
*Last updated: 2026-03-06 after initialization*
