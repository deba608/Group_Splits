import { useMemo, useState } from 'react'
import { formatMoney } from '../lib/format'
import { computeTripBalances, simplifyDebts, splitAmount, tripTotal, type Expense } from '../lib/splits'
import type { Trip } from '../lib/storage'
import AddExpenseForm from './AddExpenseForm'

interface TripViewProps {
  trip: Trip
  onBack: () => void
  onAddExpense: (data: Omit<Expense, 'id'>) => void
  onEditExpense: (expenseId: string, data: Omit<Expense, 'id'>) => void
  onDeleteExpense: (expenseId: string) => void
  onAddMember: (name: string) => void
  onRemoveMember: (name: string) => void
  onRenameTrip: (name: string) => void
  onRenameMember: (oldName: string, newName: string) => void
  onDeleteTrip: () => void
}

type Tab = 'expenses' | 'balances' | 'settle'

export default function TripView({
  trip,
  onBack,
  onAddExpense,
  onEditExpense,
  onDeleteExpense,
  onAddMember,
  onRemoveMember,
  onRenameTrip,
  onRenameMember,
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
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null)
  const [editingTripName, setEditingTripName] = useState<string | null>(null)
  const [renamingMember, setRenamingMember] = useState<{ oldName: string; newName: string } | null>(null)

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

  function handleSaveExpense(data: Omit<Expense, 'id'>) {
    if (editingExpenseId) {
      onEditExpense(editingExpenseId, data)
      setEditingExpenseId(null)
    } else {
      onAddExpense(data)
    }
    setShowForm(false)
    setQuickAdd(null)
    setActiveTab('expenses')
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'expenses', label: 'Expenses' },
    { id: 'balances', label: 'Balances' },
    { id: 'settle', label: 'Settle up' },
  ]

  return (
    <div className="min-h-svh bg-bg text-text">
      <header className="sticky top-0 z-20 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <button
            type="button"
            className="flex items-center gap-2 rounded-md px-2 py-1 text-sm text-text-muted transition hover:bg-surface-2 hover:text-text"
            onClick={onBack}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            All trips
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-md px-2 py-1 text-sm text-text-subtle transition hover:bg-danger-500/10 hover:text-danger-500"
              onClick={() => {
                if (window.confirm(`Delete "${trip.name}" and all its expenses?`)) onDeleteTrip()
              }}
            >
              Delete
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
        <div className="mb-6">
          {editingTripName ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={trip.name}
                onChange={(e) => setEditingTripName(e.target.value)}
                onBlur={() => {
                  onRenameTrip(editingTripName ?? trip.name)
                  setEditingTripName(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onRenameTrip(editingTripName ?? trip.name)
                    setEditingTripName(null)
                  } else if (e.key === 'Escape') {
                    setEditingTripName(null)
                  }
                }}
                className="text-2xl font-semibold tracking-tight sm:text-3xl text-text border-b border-border px-1 focus:outline-none focus:border-accent-500"
                autoFocus
              />
              <button
                type="button"
                onClick={() => {
                  onRenameTrip(editingTripName ?? trip.name)
                  setEditingTripName(null)
                }}
                className="rounded-md bg-accent-600 px-2 py-1 text-xs font-medium text-white transition hover:bg-accent-700"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditingTripName(null)}
                className="rounded-md p-1 text-text-subtle transition hover:bg-surface-2"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{trip.name}</h1>
              <button
                type="button"
                aria-label="Rename trip"
                onClick={() => setEditingTripName(trip.name)}
                className="rounded-md p-1 text-text-subtle transition hover:bg-surface-2 hover:text-text"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.414l8.586-8.586z" />
                </svg>
              </button>
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-muted">
            <span className="font-medium text-text">{formatMoney(total)}</span>
            <span className="text-text-subtle">spent</span>
            <span className="text-text-subtle">·</span>
            <span>{trip.expenses.length} {trip.expenses.length === 1 ? 'expense' : 'expenses'}</span>
            <span className="text-text-subtle">·</span>
            <span>{trip.members.length} {trip.members.length === 1 ? 'member' : 'members'}</span>
          </div>
        </div>

        <section className="mb-6 rounded-lg border border-border bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-medium uppercase tracking-wide text-text-subtle">Members</h2>
          </div>
          <div className="mb-3 flex flex-wrap gap-2">
            {trip.members.map((m) => {
              const locked = isMemberLocked(m)
              return (
                <span
                  key={m}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 py-1 pl-2.5 pr-1 text-sm"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-600/15 text-xs font-medium text-accent-600">
                    {m.charAt(0).toUpperCase()}
                  </span>
                  {m}
                  <button
                    type="button"
                    disabled={locked}
                    title={locked ? 'Member is used by an expense' : `Remove ${m}`}
                    aria-label={`Remove ${m}`}
                    onClick={() => onRemoveMember(m)}
                    className="rounded-full p-1 text-text-subtle transition enabled:hover:bg-surface enabled:hover:text-text disabled:cursor-not-allowed disabled:opacity-30"
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
              className="min-w-0 flex-1 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/30"
            />
            <button
              type="submit"
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-text transition hover:bg-surface-2"
            >
              Add
            </button>
          </form>
          {memberError && <p className="mt-2 text-sm text-danger-500">{memberError}</p>}
          <p className="mt-2 text-xs text-text-subtle">
            Members who appear in an expense can't be removed.
          </p>
        </section>

        <div className="mb-6">
          <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                  activeTab === tab.id
                    ? 'bg-accent-600 text-white'
                    : 'text-text-muted hover:bg-surface-2 hover:text-text'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'expenses' && (
          <section>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Expenses</h2>
                <p className="text-sm text-text-subtle">Track who paid what</p>
              </div>
              <button
                type="button"
                className="rounded-md bg-accent-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-accent-700"
                onClick={() => setShowForm((s) => !s)}
              >
                {showForm ? 'Close' : 'Add expense'}
              </button>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              {(['Cab', 'Cold drinks', 'Lunch', 'Homestay'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  className="rounded-full border border-border bg-surface px-3 py-1 text-sm text-text-muted transition hover:border-accent-500 hover:text-text"
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
                key={editingExpenseId ? `edit-${editingExpenseId}` : quickAdd ?? 'add'}
                members={trip.members}
                quickAdd={quickAdd}
                editingExpense={editingExpenseId ? trip.expenses.find((e) => e.id === editingExpenseId) : undefined}
                onSave={handleSaveExpense}
                onCancel={() => {
                  setShowForm(false)
                  setQuickAdd(null)
                  setEditingExpenseId(null)
                  setActiveTab('expenses')
                }}
                onDelete={() => {
                  onDeleteExpense(editingExpenseId ?? '')
                  setShowForm(false)
                  setQuickAdd(null)
                  setEditingExpenseId(null)
                  setActiveTab('expenses')
                }}
              />
            )}

            <div className="flex flex-col gap-2">
              {trip.expenses.length === 0 && (
                <div className="rounded-lg border border-dashed border-border p-8 text-center">
                  <p className="text-sm text-text-muted">No expenses yet</p>
                  <p className="mt-1 text-xs text-text-subtle">Add your first expense to start splitting</p>
                </div>
              )}
              {trip.expenses.map((expense) => {
                const shares = splitAmount(
                  expense.amount,
                  expense.participants,
                  expense.splitMode,
                  expense.customShares,
                  expense.roundUp
                )
                return (
                  <article
                    key={expense.id}
                    className="rounded-lg border border-border bg-surface p-4 transition hover:border-border-strong"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{expense.title}</p>
                        <p className="mt-1 text-sm text-text-subtle">
                          Paid by {expense.paidBy} ·{' '}
                          {expense.splitMode === 'equal' ? 'Split equally' : 'Custom split'} ·{' '}
                          {expense.participants.length} {expense.participants.length === 1 ? 'person' : 'people'}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <p className="font-semibold tabular-nums">{formatMoney(expense.amount)}</p>
                        <button
                          type="button"
                          aria-label={`Edit ${expense.title}`}
                          onClick={() => {
                            setEditingExpenseId(expense.id)
                            setShowForm(true)
                            setActiveTab('expenses')
                          }}
                          className={`rounded-md p-1.5 text-text-subtle transition hover:bg-surface-2 hover:text-text ${
                            editingExpenseId === expense.id ? 'bg-accent-500/10 text-accent-600' : ''
                          }`}
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.453 7.379 4.832 3.5 8.458 3.5c1.14 0 2.123.325 2.99.861a11.996 11.996 0 017.108 0A9.02 9.02 0 0121 12c0 2.241-.866 4.402-2.375 6h.001c-1.509 1.597-3.668 2.718-6.044 2.718-1.14 0-2.123-.325-2.99-.861a11.996 11.996 0 01-7.108 0c-.867-.536-1.84-.861-2.99-.861z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${expense.title}`}
                          onClick={() => {
                            if (window.confirm(`Delete "${expense.title}"?`)) {
                              onDeleteExpense(expense.id)
                            }
                          }}
                          className="rounded-md p-1.5 text-text-subtle transition hover:bg-danger-500/10 hover:text-danger-500"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    {Object.keys(shares).length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {Object.entries(shares).map(([member, share]) => (
                          <div
                            key={member}
                            className="rounded-md bg-surface-2 px-2.5 py-1 text-sm"
                          >
                            <span className="text-text-subtle">{member}:</span>{' '}
                            <span className="font-medium tabular-nums">{formatMoney(share)}</span>
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
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Balances</h2>
              <p className="text-sm text-text-subtle">Net position per person</p>
            </div>
            <div className="flex flex-col gap-2">
              {balances.map((b) => {
                const isOwed = b.balance > 0.005
                const owes = b.balance < -0.005
                return (
                  <div
                    key={b.member}
                    className="flex items-center justify-between rounded-lg border border-border bg-surface p-4"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-surface-2 text-sm font-medium">
                        {b.member.charAt(0).toUpperCase()}
                      </span>
                      <span className="font-medium">{b.member}</span>
                    </div>
                    <span
                      className={`font-semibold tabular-nums ${
                        isOwed ? 'text-success-500' : owes ? 'text-danger-500' : 'text-text-subtle'
                      }`}
                    >
                      {isOwed
                        ? `+${formatMoney(b.balance)}`
                        : owes
                          ? `-${formatMoney(-b.balance)}`
                          : 'Settled'}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {activeTab === 'settle' && (
          <section>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Settle up</h2>
                <p className="text-sm text-text-subtle">Simplified payments</p>
              </div>
              {settlements.length > 0 && (
                <button
                  type="button"
                  onClick={copySettlePlan}
                  className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text transition hover:bg-surface-2"
                >
                  {copied ? 'Copied' : 'Copy plan'}
                </button>
              )}
            </div>
            {settlements.length === 0 ? (
              <div className="rounded-lg border border-success-500/30 bg-success-500/5 p-8 text-center">
                <p className="font-medium text-success-500">All settled up</p>
                <p className="mt-1 text-sm text-text-subtle">Everyone is even</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {settlements.map((s) => (
                  <div
                    key={`${s.from}-${s.to}-${s.amount}`}
                    className="flex items-center justify-between rounded-lg border border-border bg-surface p-4"
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-danger-500/10 font-medium text-danger-500">
                        {s.from.charAt(0).toUpperCase()}
                      </span>
                      <span className="font-medium text-danger-500">{s.from}</span>
                      <svg className="h-4 w-4 text-text-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-success-500/10 font-medium text-success-500">
                        {s.to.charAt(0).toUpperCase()}
                      </span>
                      <span className="font-medium text-success-500">{s.to}</span>
                    </div>
                    <span className="font-semibold tabular-nums">{formatMoney(s.amount)}</span>
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
          className="fixed bottom-6 right-6 flex h-12 w-12 items-center justify-center rounded-full bg-accent-600 text-white shadow-lg transition hover:bg-accent-700 sm:hidden"
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