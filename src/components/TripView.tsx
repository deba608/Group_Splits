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
    <div className="min-h-svh bg-gradient-to-br from-zinc-950 via-zinc-950 to-violet-950/10 text-zinc-100">
      <div className="mx-auto w-full max-w-4xl">
        <header className="sticky top-0 z-20 border-b border-zinc-800/50 bg-zinc-950/90 backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 p-4 sm:p-6">
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-zinc-400 transition hover:bg-zinc-800/50 hover:text-zinc-200"
              onClick={onBack}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              All trips
            </button>
            <button
              type="button"
              className="rounded-lg px-2 py-1 text-sm text-zinc-500 transition hover:bg-red-950/30 hover:text-red-400"
              onClick={() => {
                if (window.confirm(`Delete "${trip.name}" and all its expenses?`)) onDeleteTrip()
              }}
            >
              Delete trip
            </button>
          </div>
        </header>

        <div className="p-4 sm:p-6">
          <div className="mb-6">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              <span className="bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                {trip.name}
              </span>
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600/30 to-purple-600/30">
                  <svg className="h-4 w-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="font-semibold">{formatMoney(total)}</span>
                <span className="text-zinc-500">spent</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-400">
                <span>{trip.expenses.length} {trip.expenses.length === 1 ? 'expense' : 'expenses'}</span>
                <span>·</span>
                <span>{trip.members.length} {trip.members.length === 1 ? 'member' : 'members'}</span>
              </div>
            </div>
          </div>


        <section className="mb-6 rounded-2xl border border-zinc-800/50 bg-gradient-to-br from-zinc-900/60 to-zinc-900/40 p-5 shadow-lg">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Members</h2>
          </div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {trip.members.map((m) => {
              const locked = isMemberLocked(m)
              return (
                <span
                  key={m}
                  className="group inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-600/20 to-purple-600/20 py-1.5 pl-3 pr-1.5 text-sm font-medium text-violet-200 ring-1 ring-violet-500/30"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-600/40 text-xs">
                    {m.charAt(0).toUpperCase()}
                  </div>
                  {m}
                  <button
                    type="button"
                    disabled={locked}
                    title={locked ? 'Member is used by an expense' : `Remove ${m}`}
                    aria-label={`Remove ${m}`}
                    onClick={() => onRemoveMember(m)}
                    className="rounded-full p-1 transition enabled:hover:bg-violet-500/30 enabled:hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )
            })}
          </div>
          <form onSubmit={handleAddMember} className="flex gap-2">
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
              placeholder="Add a member..."
              className="min-w-0 flex-1 rounded-xl border border-zinc-700/50 bg-zinc-800/50 px-4 py-2 text-sm placeholder:text-zinc-500 focus:border-violet-500 focus:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
            />
            <button
              type="submit"
              className="rounded-xl bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-700"
            >
              Add
            </button>
          </form>
          {memberError && <p className="mt-2 text-sm text-red-400">{memberError}</p>}
          <p className="mt-2 text-xs text-zinc-500">
            Members who appear in an expense can’t be removed
          </p>
        </section>


        <div className="mb-6">
          <div className="flex gap-1 rounded-2xl border border-zinc-800/50 bg-zinc-900/50 p-1">
            {[
              { id: 'expenses' as Tab, label: 'Expenses', icon: '📝' },
              { id: 'balances' as Tab, label: 'Balances', icon: '⚖️' },
              { id: 'settle' as Tab, label: 'Settle Up', icon: '💸' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-600/25'
                    : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>


        {activeTab === 'expenses' && (
          <section>
            <div className="mb-6 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold">Expenses</h2>
                <p className="mt-1 text-sm text-zinc-500">Track who paid what</p>
              </div>
              <button
                type="button"
                className="rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-600/25 transition-all hover:scale-105 hover:shadow-violet-600/40"
                onClick={() => setShowForm((s) => !s)}
              >
                {showForm ? 'Close' : '+ Add Expense'}
              </button>
            </div>


            <div className="mb-4 flex flex-wrap gap-2">
              {(['Cab', 'Cold drinks', 'Lunch', 'Dinner', 'Homestay', 'Groceries'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  className="rounded-full border border-zinc-700/50 bg-zinc-800/50 px-3 py-1.5 text-sm text-zinc-300 transition hover:border-violet-500/50 hover:bg-violet-600/10 hover:text-violet-200"
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

            <div className="flex flex-col gap-3">
              {trip.expenses.length === 0 && (
                <div className="rounded-2xl border border-dashed border-zinc-700/50 bg-zinc-900/30 p-8 text-center">
                  <p className="text-zinc-400">No expenses yet</p>
                  <p className="mt-1 text-sm text-zinc-500">Add your first expense to start splitting</p>
                </div>
              )}
              {trip.expenses.map((expense) => {
                const shares = splitAmount(
                  expense.amount,
                  expense.participants,
                  expense.splitMode,
                  expense.customShares
                )
                return (
                  <article key={expense.id} className="group rounded-2xl border border-zinc-800/50 bg-gradient-to-br from-zinc-900/60 to-zinc-900/40 p-5 shadow-lg transition hover:border-zinc-700">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-lg font-semibold">{expense.title}</p>
                        <p className="mt-1 text-sm text-zinc-400">
                          Paid by <span className="font-medium text-zinc-300">{expense.paidBy}</span> ·{' '}
                          {expense.splitMode === 'equal' ? 'Split equally' : 'Custom split'} ·{' '}
                          {expense.participants.length} {expense.participants.length === 1 ? 'person' : 'people'}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <p className="text-lg font-bold tabular-nums">{formatMoney(expense.amount)}</p>
                        <button
                          type="button"
                          aria-label={`Delete ${expense.title}`}
                          onClick={() => {
                            if (window.confirm(`Delete "${expense.title}"?`)) {
                              onDeleteExpense(expense.id)
                            }
                          }}
                          className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-red-950/40 hover:text-red-400"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    {Object.keys(shares).length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {Object.entries(shares).map(([member, share]) => (
                          <div
                            key={member}
                            className="rounded-lg bg-zinc-800/50 px-3 py-1.5 text-sm"
                          >
                            <span className="text-zinc-400">{member}:</span>{' '}
                            <span className="font-medium tabular-nums text-zinc-200">{formatMoney(share)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                )
              })}
            </div>

          </section>
        )}

        {activeTab === 'balances' && (
          <section>
            <div className="mb-6">
              <h2 className="text-2xl font-bold">Balances</h2>
              <p className="mt-1 text-sm text-zinc-500">Net position per person</p>
            </div>
            <div className="flex flex-col gap-3">
              {balances.map((b) => {
                const isOwed = b.balance > 0.005
                const owes = b.balance < -0.005
                return (
                  <div
                    key={b.member}
                    className="flex items-center justify-between rounded-2xl border border-zinc-800/50 bg-gradient-to-br from-zinc-900/60 to-zinc-900/40 p-5 shadow-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-zinc-700 to-zinc-800 text-sm font-semibold">
                        {b.member.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-lg font-medium">{b.member}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isOwed && (
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-950/50">
                          <svg className="h-4 w-4 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
                            <path
                              fillRule="evenodd"
                              d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      )}
                      {owes && (
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-950/50">
                          <svg className="h-4 w-4 text-rose-400" viewBox="0 0 20 20" fill="currentColor">
                            <path
                              fillRule="evenodd"
                              d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      )}
                      <span
                        className={`text-lg font-semibold tabular-nums ${
                          isOwed ? 'text-emerald-400' : owes ? 'text-rose-400' : 'text-zinc-500'
                        }`}
                      >
                        {isOwed
                          ? `+${formatMoney(b.balance)}`
                          : owes
                            ? `-${formatMoney(-b.balance)}`
                            : 'Settled'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

        )}

        {activeTab === 'settle' && (
          <section>
            <div className="mb-6 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold">Settle Up</h2>
                <p className="mt-1 text-sm text-zinc-500">Simplified payments</p>
              </div>
              {settlements.length > 0 && (
                <button
                  type="button"
                  onClick={copySettlePlan}
                  className="rounded-xl bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-700"
                >
                  {copied ? '✓ Copied!' : 'Copy Plan'}
                </button>
              )}
            </div>
            {settlements.length === 0 ? (
              <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/30 to-emerald-950/10 p-8 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20">
                  <svg className="h-6 w-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-lg font-semibold text-emerald-300">All settled up!</p>
                <p className="mt-1 text-sm text-emerald-400/70">Everyone is even</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {settlements.map((s) => (
                  <div
                    key={`${s.from}-${s.to}-${s.amount}`}
                    className="flex items-center justify-between rounded-2xl border border-zinc-800/50 bg-gradient-to-br from-zinc-900/60 to-zinc-900/40 p-5 shadow-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-950/50 text-sm font-semibold text-rose-300">
                        {s.from.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-rose-300">{s.from}</span>
                      <svg className="h-5 w-5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-950/50 text-sm font-semibold text-emerald-300">
                        {s.to.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-emerald-300">{s.to}</span>
                    </div>
                    <span className="text-xl font-bold tabular-nums">{formatMoney(s.amount)}</span>
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
          className="fixed bottom-6 right-6 rounded-full bg-gradient-to-r from-violet-600 to-purple-600 p-4 text-white shadow-2xl shadow-violet-600/40 transition-all hover:scale-110 hover:shadow-violet-600/60 sm:hidden"
          aria-label="Add expense"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>

      </div>
    </div>
  )
}

