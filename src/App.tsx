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
    <div className="min-h-svh bg-bg text-text">
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            GroupSplits
          </h1>
          <button
            type="button"
            className="rounded-md bg-accent-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-accent-700"
            onClick={() => {
              setCreating((c) => !c)
              setFormError('')
            }}
          >
            {creating ? 'Close' : 'New trip'}
          </button>
        </header>

        {creating && (
          <form
            onSubmit={createTrip}
            noValidate
            className="mt-6 rounded-lg border border-border bg-surface p-5"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label
                  htmlFor="trip-name"
                  className="mb-1 block text-xs font-medium uppercase tracking-wide text-text-subtle"
                >
                  Trip name
                </label>
                <input
                  id="trip-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Puri Trip 2026"
                  className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/30"
                  autoFocus
                />
              </div>
              <div className="sm:col-span-2">
                <label
                  htmlFor="trip-members"
                  className="mb-1 block text-xs font-medium uppercase tracking-wide text-text-subtle"
                >
                  Members
                </label>
                <input
                  id="trip-members"
                  value={members}
                  onChange={(e) => setMembers(e.target.value)}
                  placeholder="Debashish, Bibhuprasad, Ashish"
                  className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/30"
                />
                <p className="mt-1 text-xs text-text-subtle">Separate names with commas.</p>
              </div>
            </div>
            {formError && <p className="mt-3 text-sm text-danger-500">{formError}</p>}
            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                className="rounded-md bg-accent-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-700"
              >
                Create trip
              </button>
              <button
                type="button"
                className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text transition hover:bg-surface-2"
                onClick={() => {
                  setCreating(false)
                  setFormError('')
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {trips.length === 0 && !creating ? (
          <div className="mt-16 flex flex-col items-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-2">
              <svg className="h-6 w-6 text-text-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7l9 6 9-6M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7M3 7l9-4 9 4" />
              </svg>
            </div>
            <h2 className="mt-4 text-lg font-semibold">No trips yet</h2>
            <p className="mt-1 max-w-sm text-sm text-text-subtle">
              Create a trip to start tracking shared expenses with your group.
            </p>
            <button
              type="button"
              className="mt-5 rounded-md bg-accent-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-700"
              onClick={() => {
                setCreating(true)
                setFormError('')
              }}
            >
              Create your first trip
            </button>
          </div>
        ) : (
          <section className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium text-text-muted">Your trips</h2>
              <span className="text-xs text-text-subtle">{trips.length} total</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {trips.map((t) => (
                <div
                  key={t.id}
                  className="group rounded-lg border border-border bg-surface p-4 transition hover:border-border-strong"
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setOpenTripId(t.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate font-medium">{t.name}</p>
                      <p className="mt-1 text-sm text-text-subtle">
                        {t.members.length} {t.members.length === 1 ? 'member' : 'members'} · {formatMoney(tripTotal(t.expenses))}
                      </p>
                      <p className="mt-1 truncate text-xs text-text-subtle">
                        {t.members.join(', ')}
                      </p>
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${t.name}`}
                      className="shrink-0 rounded-md p-1.5 text-text-subtle transition hover:bg-danger-500/10 hover:text-danger-500"
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
                  <button
                    type="button"
                    className="mt-3 w-full rounded-md bg-surface-2 px-3 py-1.5 text-sm font-medium text-text transition hover:bg-accent-600 hover:text-white"
                    onClick={() => setOpenTripId(t.id)}
                  >
                    Open
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}