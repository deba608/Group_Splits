import { useEffect, useState } from 'react'
import TripView from './components/TripView'
import { formatMoney, formatRelativeTime } from './lib/format'
import { uid } from './lib/id'
import { tripTotal, type Expense } from './lib/splits'
import { loadTrips, saveTrips, type Trip } from './lib/storage'


import { fetchTrips, saveAllTrips } from './lib/db'
import { supabase } from './lib/supabase'

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

  useEffect(() => {
    if (!user) return
    saveAllTrips(user.id, trips).catch(() => {})
  }, [trips, user])

  useEffect(() => {
    if (!user) return
    fetchTrips(user.id).then((t) => setTrips(t)).catch(() => {})
  }, [user])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(
        data.session?.user
          ? { id: data.session.user.id, email: data.session.user.email ?? '' }
          : null
      )
    })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(
        session?.user
          ? { id: session.user.id, email: session.user.email ?? '' }
          : null
      )
    })
    return () => {
      data.subscription.unsubscribe()
    }
  }, [])

  const trip = trips.find((t) => t.id === openTripId) ?? null

  async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const email = String(fd.get('email') ?? '')
    const password = String(fd.get('password') ?? '')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setAuthError(error.message)
  }

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

          {user ? (
            <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-sm text-zinc-400">Signed in</p>
              <p className="mt-1 text-sm text-zinc-200">{user.email}</p>
              <button
                type="button"
                className="mt-3 rounded-lg bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-200 hover:bg-zinc-700"
                onClick={() => supabase.auth.signOut()}
              >
                Sign out
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleSignIn}
              className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-4"
            >
              <label
                htmlFor="auth-email"
                className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500"
              >
                Email
              </label>
              <input
                id="auth-email"
                type="email"
                required
                className="mb-2 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
              />
              <label
                htmlFor="auth-password"
                className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500"
              >
                Password
              </label>
              <input
                id="auth-password"
                type="password"
                required
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
              />
              {authError && <p className="mt-2 text-sm text-red-400">{authError}</p>}
              <button
                type="submit"
                className="mt-3 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
              >
                Sign in
              </button>
            </form>
          )}
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
                <div className="rounded-xl border border-dashed border-zinc-800 p-10 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-600/20 to-purple-600/20">
                    <svg
                      className="h-8 w-8 text-violet-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                  </div>
                  <p className="text-xl font-semibold text-zinc-200">Start splitting expenses</p>
                  <p className="mt-2 text-sm text-zinc-500">
                    Create your first trip and add expenses to split bills fairly with friends.
                  </p>
                  <button
                    type="button"
                    onClick={() => setCreating(true)}
                    className="mt-6 rounded-lg bg-violet-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-violet-500"
                  >
                    Create your first trip
                  </button>
                </div>
              )}

            {trips.map((t) => {
              const total = tripTotal(t.expenses)
              const relativeTime = formatRelativeTime(t.createdAt)

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
                        {t.members.slice(0, 4).map((m, i) => (
                          <div
                            key={i}
                            className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-600/30 text-xs text-violet-200 ring-2 ring-zinc-900"
                          >
                            {m.charAt(0).toUpperCase()}
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
                        {relativeTime && ` · ${relativeTime}`}
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
