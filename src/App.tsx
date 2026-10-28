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
      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              GroupSplits
            </h1>
            <p className="mt-1 text-sm text-text-muted">
              Split bills with friends. No spreadsheet math.
            </p>
          </div>
        </header>

        <section className="mt-8">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Your trips</h2>
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
          </div>

          {creating && (
            <form
              onSubmit={createTrip}
              noValidate
              className="mt-4 rounded-lg border border-border bg-surface p-4"
            >
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
              <label
                htmlFor="trip-members"
                className="mt-3 mb-1 block text-xs font-medium uppercase tracking-wide text-text-subtle"
              >
                Members
              </label>
              <input
                id="trip-members"
                value={members}
                onChange={(e) => setMembers(e.target.value)}
                placeholder="Debashish, Sairaj, Ananya"
                className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/30"
              />
              <p className="mt-1 text-xs text-text-subtle">Separate names with commas.</p>
              {formError && <p className="mt-2 text-sm text-danger-500">{formError}</p>}
              <button
                type="submit"
                className="mt-4 rounded-md bg-accent-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-700"
              >
                Create trip
              </button>
            </form>
          )}

          <div className="mt-4 flex flex-col gap-2">
            {trips.length === 0 && !creating && (
              <div className="rounded-lg border border-dashed border-border p-8 text-center">
                <p className="text-sm text-text-muted">No trips yet.</p>
                <p className="mt-1 text-xs text-text-subtle">
                  Create one to start tracking shared expenses.
                </p>
              </div>
            )}
            {trips.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4"
              >
                <button
                  type="button"
                  onClick={() => setOpenTripId(t.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="truncate font-medium">{t.name}</p>
                  <p className="mt-0.5 truncate text-sm text-text-subtle">
                    {t.members.join(', ')} · {formatMoney(tripTotal(t.expenses))}
                  </p>
                </button>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    className="rounded-md bg-accent-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-accent-700"
                    onClick={() => setOpenTripId(t.id)}
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${t.name}`}
                    className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-muted transition hover:border-danger-500 hover:text-danger-500"
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
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}