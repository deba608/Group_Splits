  import { useEffect, useMemo, useState } from 'react'
  import TripView from './components/TripView'
  import { formatMoney } from './lib/format'
  import { uid } from './lib/id'
  import { computeTripBalances, tripTotal, type Expense } from './lib/splits'
  import { loadTrips, saveTrips, type Trip } from './lib/storage'
  
  export default function App() {
    const [trips, setTrips] = useState<Trip[]>(loadTrips)
    const [openTripId, setOpenTripId] = useState<string | null>(null)
    const [creating, setCreating] = useState(false)
    const [name, setName] = useState('')
    const [members, setMembers] = useState('')
    const [formError, setFormError] = useState('')
  
    useEffect(() => {
      saveTrips(trips)
    }, [trips])
  
    const trip = trips.find((t) => t.id === openTripId) ?? null
  
    function createTrip(e: React.FormEvent) {
      e.preventDefault()
      const memberNames = members
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      const trimmed = name.trim()
      if (!trimmed) {
        setFormError('Give the trip a name.')
        return
      }
      if (memberNames.length === 0) {
        setFormError('Add at least one member, separated by commas.')
        return
      }
      const t: Trip = {
        id: uid(),
        name: trimmed,
        members: [...new Set(memberNames)],
        expenses: [],
        createdAt: new Date().toISOString(),
      }
      setTrips((prev) => [t, ...prev])
      setOpenTripId(t.id)
      setCreating(false)
      setName('')
      setMembers('')
      setFormError('')
    }
  
    function addExpense(tripId: string, data: Omit<Expense, 'id'>) {
      setTrips((prev) =>
        prev.map((t) =>
          t.id === tripId
            ? { ...t, expenses: [...t.expenses, { id: uid(), ...data }] }
            : t
        )
      )
    }
  
    function deleteExpense(tripId: string, expenseId: string) {
      setTrips((prev) =>
        prev.map((t) =>
          t.id === tripId
            ? { ...t, expenses: t.expenses.filter((e) => e.id !== expenseId) }
            : t
        )
      )
    }
  
    function addMember(tripId: string, member: string) {
      setTrips((prev) =>
        prev.map((t) =>
          t.id === tripId && !t.members.includes(member)
            ? { ...t, members: [...t.members, member] }
            : t
        )
      )
    }
  
    function removeMember(tripId: string, member: string) {
      setTrips((prev) =>
        prev.map((t) => {
          if (t.id !== tripId) return t
          const used = t.expenses.some(
            (e) => e.paidBy === member || e.participants.includes(member)
          )
          if (used || t.members.length <= 1) return t
          return { ...t, members: t.members.filter((m) => m !== member) }
        })
      )
    }
  
    function deleteTrip(tripId: string) {
      setTrips((prev) => prev.filter((t) => t.id !== tripId))
      setOpenTripId(null)
    }
  
    if (trip) {
      return (
        <TripView
          key={trip.id}
          trip={trip}
          onBack={() => setOpenTripId(null)}
          onAddExpense={(data) => addExpense(trip.id, data)}
          onDeleteExpense={(expenseId) => deleteExpense(trip.id, expenseId)}
          onAddMember={(member) => addMember(trip.id, member)}
          onRemoveMember={(member) => removeMember(trip.id, member)}
          onDeleteTrip={() => deleteTrip(trip.id)}
        />
      )
    }
  
    return (
      <div className="min-h-svh bg-zinc-950 text-zinc-100">
        <main className="mx-auto w-full max-w-3xl p-4 sm:p-6">
          <header className="pt-6 sm:pt-10">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">GroupSplits</h1>
            <p className="mt-2 text-zinc-400">Split bills with friends. No spreadsheet math.</p>
          </header>
  
          <section className="mt-8 sm:mt-12">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Your trips</h2>
              <button
                type="button"
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
                onClick={() => {
                  setCreating((c) => !c)
                  setFormError('')
                }}
              >
                {creating ? 'Close' : '+ New trip'}
              </button>
            </div>
  
            {creating && (
              <form
                onSubmit={createTrip}
                noValidate
                className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4"
              >
                <label
                  htmlFor="trip-name"
                  className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500"
                >
                  Trip name
                </label>
                <input
                  id="trip-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Lisbon 2026"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                  autoFocus
                />
                <label
                  htmlFor="trip-members"
                  className="mt-3 mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500"
                >
                  Members
                </label>
                <input
                  id="trip-members"
                  value={members}
                  onChange={(e) => setMembers(e.target.value)}
                  placeholder="Ana, Ben, Cara"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                />
                <p className="mt-1 text-xs text-zinc-500">Separate names with commas.</p>
                {formError && <p className="mt-2 text-sm text-red-400">{formError}</p>}
                <button
                  type="submit"
                  className="mt-4 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
                >
                  Create trip
                </button>
              </form>
            )}
  
            <div className="mt-6 flex flex-col gap-3">
              {trips.length === 0 && !creating && (
                <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900">
                    <svg
                      className="h-6 w-6 text-zinc-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <p className="text-lg font-medium text-zinc-200">No trips yet</p>
                  <p className="mt-1 text-sm text-zinc-500">
                    Create your first trip to start splitting expenses.
                  </p>
                </div>
              )}
              {trips.map((t) => {
                const total = tripTotal(t.expenses)
                const balances = computeTripBalances(t.members, t.expenses)
                const memberInitials = t.members
                  .slice(0, 4)
                  .map((m) => m.charAt(0).toUpperCase())
  
                return (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition hover:border-zinc-700"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenTripId(t.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate font-medium">{t.name}</p>
                      <div className="mt-1 flex items-center gap-3 text-sm">
                        <div className="flex -space-x-2">
                          {memberInitials.map((init, i) => (
                            <div
                              key={i}
                              className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-600/30 text-xs text-violet-200 ring-2 ring-zinc-900"
                            >
                              {init}
                            </div>
                          ))}
                          {t.members.length > 4 && (
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-xs text-zinc-400 ring-2 ring-zinc-900">
                              +{t.members.length - 4}
                            </div>
                          )}
                        </div>
                        <span className="text-zinc-500">
                          {t.expenses.length} {t.expenses.length === 1 ? 'expense' : 'expenses'} ·{' '}
                          {formatMoney(total)}
                        </span>
                      </div>
                    </button>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500"
                        onClick={() => setOpenTripId(t.id)}
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${t.name}`}
                        className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-300 hover:bg-zinc-700 hover:text-red-400"
                        onClick={() => {
                          if (window.confirm(`Delete "${t.name}" and all its expenses?`)) {
                            deleteTrip(t.id)
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        </main>
      </div>
    )
  }

