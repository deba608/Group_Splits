# GroupSplits — Product Requirements Document (PRD)

**Version:** 0.1 (Draft)
**Date:** 2026-10-28
**Status:** Draft

---

## 1. Overview

Web application for group expense splitting.
Used by friends on trips, nights out, shared housing.

One place. All expenses. Fair math. Quick settle-up.

## 2. Problem

- Friends split bills via chat / spreadsheets / mental math.
- Math gets messy. Who owes whom, how much, when.
- No single source of truth.

## 3. Goals

- Add expense, split it, track who paid / owes what.
- Balances view: net position per member.
- One-click settle-up plan.

## 4. Non-Goals (v1)

- Receipt scanning / OCR.
- Currency conversion.
- Complex split types (hotels, per-item).
- Groups > 12 people.

## 5. User Stories

- **US-1:** Trip host adds expense. Splits equally among members.
- **US-2:** Add custom split amounts.
- **US-3:** View balances after expenses added.
- **US-4:** Generate settle-up transactions.

## 6. Functional Requirements

- FR-1: Create trip. Add member names.
- FR-2: Add expense: title, amount, paid by, participants, split mode.
- FR-3: Equal split with rounding handled.
- FR-4: Custom split support.
- FR-5: Balances per member (net).
- FR-6: Debt simplification / settle up.

## 7. Tech Stack — Modern

- **Frontend:** React 19 + Vite + TypeScript + Tailwind CSS
- **Backend:** Supabase (Postgres, Auth, Realtime)
- **State/Data:** TanStack Query + Zustand
- **Hosting:** Vercel
- **Testing:** Vitest + Playwright

## 8. Milestones

1. MVP: split engine + single-trip UI + local persistence.
2. Supabase auth + cloud sync.
3. Multi-trip, history, charts.

## 9. Success Metrics

- Time to add expense: < 30s.
- Correct split math: 100% tests pass.
- Friend adoption: 3+ friends using it.

---

*Next: start Milestone 1 build.*
