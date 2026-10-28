import { useEffect, useState } from 'react'
import TripView from './components/TripView'
import { formatMoney } from './lib/format'
import { uid } from './lib/id'
import { tripTotal, type Expense } from './lib/splits'
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
    <div className="min-h-svh bg-gradient-to-br from-zinc-950 via-zinc-950 to-violet-950/10 text-zinc-100">
      <header className="sticky top-0 z-20 border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-purple-600 shadow-lg shadow-violet-600/30">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">GroupSplits</h1>
              <p className="text-xs text-zinc-500">Split bills fairly</p>
            </div>
          </div>
          {!openTripId && (
            <button
              type="button"
              onClick={() => {
                setCreating((c) => !c)
                setFormError('')
              }}
              className="rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-600/25 transition-all hover:scale-105 hover:shadow-violet-600/40"
            >
              {creating ? 'Cancel' : '+ New Trip'}
            </button>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl p-4 sm:p-6">
        <header className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            <span className="bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
              Your Trips
            </span>
          </h1>
          <p className="mt-2 text-lg text-zinc-400">Split bills with friends. No spreadsheet math.</p>
        </header>


        <section className="mt-12">
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
              className="mb-6 rounded-2xl border border-zinc-800/50 bg-gradient-to-br from-zinc-900/50 to-zinc-900/30 p-6 shadow-xl backdrop-blur-sm"
            >
              <div className="mb-4">
                <h3 className="text-lg font-semibold">Create new trip</h3>
                <p className="text-sm text-zinc-500">Add your trip details and members</p>
              </div>
              <label
                htmlFor="trip-name"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400"
              >
                Trip name
              </label>
              <input
                id="trip-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Lisbon 2026"
                className="w-full rounded-xl border border-zinc-700/50 bg-zinc-800/50 px-4 py-2.5 text-sm placeholder:text-zinc-500 focus:border-violet-500 focus:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                autoFocus
              />
              <label
                htmlFor="trip-members"
                className="mt-4 mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400"
              >
                Members
              </label>
              <input
                id="trip-members"
                value={members}
                onChange={(e) => setMembers(e.target.value)}
                placeholder="Ana, Ben, Cara, John"
                className="w-full rounded-xl border border-zinc-700/50 bg-zinc-800/50 px-4 py-2.5 text-sm placeholder:text-zinc-500 focus:border-violet-500 focus:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
              />
              <p className="mt-1.5 text-xs text-zinc-500">Separate names with commas</p>
              {formError && <p className="mt-3 text-sm text-red-400">{formError}</p>}
              <div className="mt-5 flex gap-2">
                <button
                  type="submit"
                  className="rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-600/25 transition-all hover:shadow-violet-600/40"
                >
                  Create Trip
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreating(false)
                    setFormError('')
                    setName('')
                    setMembers('')
                  }}
                  className="rounded-xl bg-zinc-800/50 px-6 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}


          <div className="mt-8 flex flex-col gap-4">
            {trips.length === 0 && !creating && (
              <div className="rounded-2xl border border-dashed border-zinc-700/50 bg-gradient-to-br from-zinc-900/30 to-zinc-900/10 p-12 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600/20 to-purple-600/20">
                  <svg className="h-8 w-8 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold">No trips yet</h3>
                <p className="mt-2 text-zinc-400">Create your first trip to start splitting expenses</p>
                <button
                  type="button"
                  onClick={() => {
                    setCreating(true)
                    setFormError('')
                  }}
                  className="mt-6 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-600/25 transition-all hover:scale-105 hover:shadow-violet-600/40"
                >
                  Create Your First Trip
                </button>
              </div>
            )}
            {trips.map((t) => {
              const total = tripTotal(t.expenses)
              const relativeTime = formatRelativeTime(t.createdAt)

              return (
                <div
                  key={t.id}
                  className="group relative overflow-hidden rounded-2xl border border-zinc-800/50 bg-gradient-to-br from-zinc-900/60 to-zinc-900/40 shadow-lg transition-all hover:scale-[1.01] hover:border-violet-500/40 hover:shadow-xl hover:shadow-violet-900/20"
                >
                  <button
                    type="button"
                    onClick={() => setOpenTripId(t.id)}
                    className="w-full p-6 text-left"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-xl font-semibold">{t.name}</h3>
                        <div className="mt-3 flex items-center gap-3">
                          <div className="flex -space-x-2">
                            {t.members.slice(0, 4).map((m, i) => (
                              <div
                                key={i}
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-600/50 to-purple-600/50 text-xs font-semibold text-violet-200 ring-2 ring-zinc-900"
                              >
                                {m.charAt(0).toUpperCase()}
                              </div>
                            ))}
                            {t.members.length > 4 && (
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-xs font-medium text-zinc-400 ring-2 ring-zinc-900">
                                +{t.members.length - 4}
                              </div>
                            )}
                          </div>
                          <span className="text-sm text-zinc-400">
                            {t.members.length} {t.members.length === 1 ? 'member' : 'members'}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold tabular-nums">{formatMoney(total)}</p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {t.expenses.length} {t.expenses.length === 1 ? 'expense' : 'expenses'}
                          {relativeTime && ` · ${relativeTime}`}
                        </p>
                      </div>
                    </div>
                  </button>
                  <div className="flex gap-2 border-t border-zinc-800/50 bg-zinc-900/30 p-3">
                    <button
                      type="button"
                      className="flex-1 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2 text-sm font-medium text-white transition-all hover:shadow-lg hover:shadow-violet-600/30"
                      onClick={() => setOpenTripId(t.id)}
                    >
                      Open Trip
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${t.name}`}
                      className="rounded-xl bg-zinc-800/50 px-3 py-2 text-zinc-400 transition hover:bg-red-950/40 hover:text-red-400"
                      onClick={() => {
                        if (window.confirm(`Delete "${t.name}" and all its expenses?`)) {
                          deleteTrip(t.id)
                        }
                      }}
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
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


