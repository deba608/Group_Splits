# GroupSplits

Split shared expenses with friends — trips, dinners, shared flats. No spreadsheet math.

## Features (v1)

- Create trips with a member list
- Add expenses: title, amount, who paid, participants
- Quick expense types (cab, cold drinks, lunch, dinner, homestay, groceries, tickets) with optional details
- Split equally (rounding handled) or with custom amounts (must match the total)
- Live balances per member
- Settle-up plan with debt simplification
- Add/remove members; members used by an expense are locked
- Delete expenses and trips (with confirmation)
- Data persisted per browser via `localStorage`

## Currency

Indian rupees (₹), formatted with `en-IN` digit grouping. No currency conversion in v1.

## Stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · Vitest · Oxlint

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build |
| `npm test` | Run the split-math tests (Vitest) |
| `npm test -- --run` | Run tests once, non-watch |
| `npm run lint` | Lint with Oxlint |

## Structure

```
src/
  App.tsx                  trips list, storage wiring
  components/
    TripView.tsx           trip detail: members, expenses, balances, settle up
    AddExpenseForm.tsx     expense form with live split validation
  lib/
    splits.ts              split math: equal/custom, balances, debt simplification
    splits.test.ts         unit tests for the split engine
    storage.ts             localStorage load/save with shape validation
    format.ts              currency formatting
    id.ts                  id generation
```

## Split rules

- Equal split rounds each share to cents; the last participant absorbs the remainder, so shares always sum to the expense total.
- Custom split: every participant's amount is entered. Saving is blocked until the amounts sum exactly to the expense total (tolerance $0.005).
- Balances: `+` means the member is owed money, `-` means they owe.
- Settle up pairs the largest debtors with the largest creditors to minimize transactions.

## Roadmap

1. ✅ Split engine + single-trip UI + local persistence
2. Supabase auth + cloud sync, shared trips
3. History, charts, reminders
