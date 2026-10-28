# GroupSplits — Group Split Web App

## Vision
Web app. Friends. Trips. Bills. Split fairly. No more spreadsheet math.

## MVP Scope (v1)

### Core features
- Create trip / group (name, optional date/city)
- Add expense: title, amount, paid by, split among members
- Split modes: equal / custom
- Balances view: net balance per person
- Settle up: debt simplification, settle debts
- Persist data per device/browser

### Out of scope for v1
- Real auth / multi-device sync
- Receipt photos
- Expense categories/charts
- Currency conversion

## Tech approach
- Static frontend (HTML/CSS/JS) or React + Vite
- Split math in plain TS/JS — testable, no deps
- Persistence: localStorage (v1) → Supabase (v2)

## Milestones
1. ✅ Split math engine (equal + custom, net balances, settle up)
2. ✅ Screens: trips list, trip detail, add expense, balances
3. ✅ Polish + mobile-friendly (validation, member/expense management, empty states)

## Later (v2+)
- Supabase auth + shared backend
- Multiple trips per user
- Charts, history, reminders
