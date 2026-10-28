import { uid } from './id'

export type SplitMode = 'equal' | 'custom'

export type RecurringFrequency = 'weekly' | 'monthly'

export interface RecurringSchedule {
  frequency: RecurringFrequency
  interval: number
  nextDate: string
}

export interface Expense {
  id: string
  title: string
  amount: number
  paidBy: string
  participants: string[]
  splitMode: SplitMode
  customShares?: Record<string, number>
  roundUp?: boolean
  date?: string
  recurring?: RecurringSchedule
  receipt?: string
}

export interface Balance {
  member: string
  balance: number
}

export interface Settlement {
  from: string
  to: string
  amount: number
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function roundUp2(n: number): number {
  return Math.ceil(n)
}

function advanceDate(dateStr: string, frequency: RecurringFrequency, interval: number): string {
  const d = new Date(dateStr)
  if (frequency === 'weekly') {
    d.setDate(d.getDate() + 7 * interval)
  } else {
    d.setMonth(d.getMonth() + interval)
  }
  return d.toISOString().slice(0, 10)
}

export function processRecurringExpenses(expenses: Expense[], today: string): Expense[] {
  let changed = false
  const result: Expense[] = []
  for (const e of expenses) {
    if (e.recurring && e.recurring.nextDate <= today) {
      const updatedTemplate: Expense = {
        ...e,
        recurring: { ...e.recurring, nextDate: advanceDate(e.recurring.nextDate, e.recurring.frequency, e.recurring.interval) },
      }
      result.push(updatedTemplate)
      const instance: Expense = {
        id: uid(),
        title: e.title,
        amount: e.amount,
        paidBy: e.paidBy,
        participants: [...e.participants],
        splitMode: e.splitMode,
        customShares: e.customShares ? { ...e.customShares } : undefined,
        roundUp: e.roundUp,
        date: e.recurring.nextDate,
      }
      result.push(instance)
      changed = true
    } else {
      result.push(e)
    }
  }
  return changed ? result : expenses
}

export function splitAmount(
  amount: number,
  participants: string[],
  mode: SplitMode,
  customShares: Record<string, number> = {},
  roundUp = false
): Record<string, number> {
  const round = roundUp ? roundUp2 : round2
  const names = participants.length > 0 ? participants : []
  if (names.length === 0) return {}

  if (mode === 'custom') {
    const shares: Record<string, number> = {}
    const others = names.slice(0, -1)
    let assigned = 0
    for (const p of others) {
      const s = round(customShares[p] ?? 0)
      shares[p] = s
      assigned += s
    }
    shares[names[names.length - 1]] = round2(amount - assigned)
    return shares
  }

  const n = names.length
  const base = round(amount / n)
  const shares: Record<string, number> = {}
  let assigned = 0
  names.forEach((p, i) => {
    shares[p] = i === n - 1 ? round2(amount - assigned) : base
    assigned += shares[p]
  })
  return shares
}

export function customShareSummary(
  amount: number,
  participants: string[],
  shares: Record<string, number>
): { assigned: number; remaining: number } {
  const assigned = round2(
    participants.reduce((sum, p) => sum + (Number.isFinite(shares[p]) ? shares[p] : 0), 0)
  )
  return { assigned, remaining: round2(amount - assigned) }
}

export function tripTotal(expenses: Expense[]): number {
  return round2(
    expenses.reduce((sum, e) => {
      if (e.recurring) return sum
      return sum + (Number.isFinite(e.amount) ? e.amount : 0)
    }, 0)
  )
}

export function computeTripBalances(
  members: string[],
  expenses: Expense[]
): Balance[] {
  const map = new Map<string, number>(members.map((m) => [m, 0]))
  for (const e of expenses) {
    if (e.recurring) continue
    map.set(e.paidBy, (map.get(e.paidBy) ?? 0) + e.amount)
    const shares = splitAmount(e.amount, e.participants, e.splitMode, e.customShares, e.roundUp)
    for (const [p, s] of Object.entries(shares)) {
      map.set(p, (map.get(p) ?? 0) - s)
    }
  }
  return members.map((m) => ({ member: m, balance: round2(map.get(m) ?? 0) }))
}

export function simplifyDebts(balances: Balance[]): Settlement[] {
  const debtors = balances
    .filter((b) => b.balance < -0.005)
    .map((b) => ({ name: b.member, amount: -b.balance }))
    .sort((a, b) => b.amount - a.amount)
  const creditors = balances
    .filter((b) => b.balance > 0.005)
    .map((b) => ({ name: b.member, amount: b.balance }))
    .sort((a, b) => b.amount - a.amount)

  const settlements: Settlement[] = []
  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amount, creditors[j].amount)
    if (pay > 0.005) {
      settlements.push({ from: debtors[i].name, to: creditors[j].name, amount: round2(pay) })
    }
    debtors[i].amount = round2(debtors[i].amount - pay)
    creditors[j].amount = round2(creditors[j].amount - pay)
    if (debtors[i].amount <= 0.005) i++
    if (creditors[j].amount <= 0.005) j++
  }
  return settlements
}
