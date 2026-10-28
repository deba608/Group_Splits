import { useMemo, useState } from 'react'
import { formatMoney } from '../lib/format'
import { computeTripBalances, simplifyDebts, splitAmount, tripTotal, type Expense } from '../lib/splits'
import type { Trip } from '../lib/storage'
import AddExpenseForm from './AddExpenseForm'

interface TripViewProps {
  trip: Trip
  onBack: () => void
  onAddExpense: (data: Omit<Expense, 'id'>) => void
  onDeleteExpense: (expenseId: string) => void
  onAddMember: (name: string) => void
  onRemoveMember: (name: string) => void
  onDeleteTrip: () => void
}

type Tab = 'expenses' | 'balances' | 'settle'

export default function TripView({
  trip,
  onBack,
  onAddExpense,
  onDeleteExpense,
  onAddMember,
  onRemoveMember,
  onDeleteTrip,
}: TripViewProps) {
  const balances = useMemo(
    () => computeTripBalances(trip.members, trip.expenses),
    [trip.members, trip.expenses]
  )
  const settlements = useMemo(() => simplifyDebts(balances), [balances])
  const total = useMemo(() => tripTotal(trip.expenses), [trip.expenses])

  const [showForm, setShowForm] = useState(false)
  const [newMember, setNewMember] = useState('')
  const [memberError, setMemberError] = useState('')
  const [quickAdd, setQuickAdd] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('expenses')
  const [copied, setCopied] = useState(false)

  function handleAddMember(e: React.FormEvent) {
    e.preventDefault()
    const name = newMember.trim()
    if (!name) return
    if (trip.members.some((m) => m.toLowerCase() === name.toLowerCase())) {
      setMemberError('That member already exists.')
      return
    }
    onAddMember(name)
    setNewMember('')
    setMemberError('')
  }

  function isMemberLocked(member: string): boolean {
    return trip.expenses.some(
      (e) => e.paidBy === member || e.participants.includes(member)
    )
  }

  async function copySettlePlan() {
    if (settlements.length === 0) return
    const text = settlements
      .map((s) => `${s.from} pays ${s.to} ${formatMoney(s.amount)}`)
      .join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  return (
    <div className="min-h-svh bg-zinc-950 text-zinc-100">
      <div className="mx-auto w-full max-w-3xl p-4 sm:p-6">
        <button
          type="button"
          className="text-sm text-zinc-400 hover:text-zinc-200"
          onClick={onBack}
        >
          ← All trips
        </button>

        <header className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{trip.name}</h1>
            <p className="mt-1 text-sm text-zinc-400">
              {formatMoney(total)} spent · {trip.expenses.length}{' '}
              {trip.expenses.length === 1 ? 'expense' : 'expenses'} · {trip.members.length}{' '}
              {trip.members.length === 1 ? 'member' : 'members'}
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-400 hover:border-red-900 hover:text-red-400"
            onClick={() => {
              if (window.confirm(`Delete "${trip.name}" and all its expenses?`)) onDeleteTrip()
            }}
          >
            Delete trip
          </button>
        </header>

        <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Members</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {trip.members.map((m) => {
              const locked = isMemberLocked(m)
              return (
                <span
                  key={m}
                  className="inline-flex items-center gap-1 rounded-full bg-violet-600/15 py-1 pl-3 pr-1 text-sm text-violet-200"
                >
                  {m}
                  <button
                    type="button"
                    disabled={locked}
                    title={locked ? 'Member is used by an expense' : `Remove ${m}`}
                    aria-label={`Remove ${m}`}
                    onClick={() => onRemoveMember(m)}
                    className="rounded-full px-1.5 text-violet-300/70 enabled:hover:bg-violet-500/20 enabled:hover:text-violet-100 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    ×
                  </button>
                </span>
              )
            })}
          </div>
          <form onSubmit={handleAddMember} className="mt-3 flex flex-wrap gap-2">
            <label htmlFor="new-member" className="sr-only">
              New member name
            </label>
            <input
              id="new-member"
              value={newMember}
              onChange={(e) => {
                setNewMember(e.target.value)
                setMemberError('')
              }}
              placeholder="Add a member"
              className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            />
            <button
              type="submit"
              className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-200 hover:bg-zinc-700"
            >
              Add
            </button>
          </form>
          {memberError && <p className="mt-2 text-sm text-red-400">{memberError}</p>}
          <p className="mt-2 text-xs text-zinc-500">
            Members who appear in an expense can’t be removed.
          </p>
        </section>

        <div className="sticky top-0 z-10 mt-6 -mx-4 bg-zinc-950/95 px-4 py-2 backdrop-blur sm:mx-0 sm:px-0">
          <div className="flex gap-2 rounded-xl border border-zinc-800 bg-zinc-900 p-1">
            {[
              { id: 'expenses' as Tab, label: 'Expenses' },
              { id: 'balances' as Tab, label: 'Balances' },
              { id: 'settle' as Tab, label: 'Settle up' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  activeTab === tab.id
                    ? 'bg-violet-600 text-white'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'expenses' && (
          <section className="mt-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Expenses</h2>
              <button
                type="button"
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
                onClick={() => setShowForm((s) => !s)}
              >
                {showForm ? 'Close' : '+ Add expense'}
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {(['Cab', 'Cold drinks', 'Lunch', 'Homestay'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  className="rounded-full border border-zinc-700 px-3 py-1 text-sm text-zinc-300 hover:border-violet-500 hover:text-violet-200"
                  onClick={() => {
                    setQuickAdd(p)
                    setShowForm(true)
                    setActiveTab('expenses')
                  }}
                >
                  {p}
                </button>
              ))}
            </div>

            {showForm && (
              <AddExpenseForm
                key={quickAdd ?? 'default'}
                members={trip.members}
                quickAdd={quickAdd}
                onSave={(data) => {
                  onAddExpense(data)
                  setShowForm(false)
                  setQuickAdd(null)
                  setActiveTab('expenses')
                }}
                onCancel={() => {
                  setShowForm(false)
                  setQuickAdd(null)
                }}
              />
            )}

            <div className="mt-4 flex flex-col gap-3">
              {trip.expenses.length === 0 && (
                <p className="rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-500">
                  No expenses yet. Add the first one to start splitting.
                </p>
              )}
              {trip.expenses.map((expense) => {
                const shares = splitAmount(
                  expense.amount,
                  expense.participants,
                  expense.splitMode,
                  expense.customShares
                )
                return (
                  <article key={expense.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{expense.title}</p>
                        <p className="mt-0.5 text-sm text-zinc-500">
                          Paid by <span className="text-zinc-300">{expense.paidBy}</span> ·{' '}
                          {expense.splitMode} split · {expense.participants.length}{' '}
                          {expense.participants.length === 1 ? 'person' : 'people'}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <p className="tabular-nums">{formatMoney(expense.amount)}</p>
                        <button
                          type="button"
                          aria-label={`Delete ${expense.title}`}
                          onClick={() => {
                            if (window.confirm(`Delete "${expense.title}"?`)) {
                              onDeleteExpense(expense.id)
                            }
                          }}
                          className="rounded-md px-1.5 py-0.5 text-zinc-500 hover:bg-zinc-800 hover:text-red-400"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                    {Object.keys(shares).length > 0 && (
                      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-400">
                        {Object.entries(shares).map(([member, share]) => (
                          <li key={member}>
                            {member}: {formatMoney(share)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>
                )
              })}
            </div>
          </section>
        )}

        {activeTab === 'balances' && (
          <section className="mt-6">
            <h2 className="text-xl font-semibold">Balances</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Net position per person across all expenses.
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {balances.map((b) => {
                const isOwed = b.balance > 0.005
                const owes = b.balance < -0.005
                return (
                  <div
                    key={b.member}
                    className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-sm text-zinc-300">
                        {b.member.charAt(0).toUpperCase()}
                      </div>
                      <span className="truncate font-medium">{b.member}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isOwed && (
                        <svg className="h-4 w-4 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                      {owes && (
                        <svg className="h-4 w-4 text-rose-400" viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                      <span
                        className={`shrink-0 text-sm tabular-nums ${
                          isOwed ? 'text-emerald-400' : owes ? 'text-rose-400' : 'text-zinc-500'
                        }`}
                      >
                        {isOwed
                          ? `gets back ${formatMoney(b.balance)}`
                          : owes
                            ? `owes ${formatMoney(-b.balance)}`
                            : 'settled'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {activeTab === 'settle' && (
          <section className="mt-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Settle up</h2>
                <p className="mt-1 text-sm text-zinc-500">Debt simplified for easy transfers.</p>
              </div>
              {settlements.length > 0 && (
                <button
                  type="button"
                  onClick={copySettlePlan}
                  className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-200 hover:bg-zinc-700"
                >
                  {copied ? 'Copied!' : 'Copy plan'}
                </button>
              )}
            </div>
            {settlements.length === 0 ? (
              <p className="mt-3 rounded-xl border border-emerald-900/50 bg-emerald-950/30 p-4 text-sm text-emerald-300">
                All settled up. 🎉
              </p>
            ) : (
              <div className="mt-3 flex flex-col gap-2">
                {settlements.map((s) => (
                  <div
                    key={`${s.from}-${s.to}-${s.amount}`}
                    className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-rose-400">{s.from}</span>
                      <svg className="h-4 w-4 text-zinc-600" viewBox="0 0 20 20" fill="currentColor">
                        <path
                          fillRule="evenodd"
                          d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="text-emerald-400">{s.to}</span>
                    </div>
                    <span className="font-medium tabular-nums">{formatMoney(s.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <button
          type="button"
          onClick={() => {
            setShowForm(true)
            setActiveTab('expenses')
            setQuickAdd(null)
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
          className="fixed bottom-6 right-6 rounded-full bg-violet-600 p-4 text-white shadow-lg shadow-violet-900/50 hover:bg-violet-500 sm:hidden"
          aria-label="Add expense"
        >
          <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
          </svg>
        </button>
      </div>
    </div>
  )
}

