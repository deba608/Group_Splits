import { useEffect, useRef, useState } from 'react'
import TripView from './components/TripView'
import Toast from './components/Toast'
import { formatMoney } from './lib/format'
import { uid } from './lib/id'
import {
  tripTotal,
  processRecurringExpenses,
  type Expense,
} from './lib/splits'
import { loadTrips, saveTrips, type Trip } from './lib/storage'
import { supabase } from './lib/supabase'
import { fetchTrips, saveAllTrips } from './lib/db'

export default function App() {
  const [trips, setTrips] = useState<Trip[]>(loadTrips)
  const [openTripId, setOpenTripId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [members, setMembers] = useState('')
  const [currency, setCurrency] = useState('INR')
  const [formError, setFormError] = useState('')
  const [toast, setToast] = useState<{ message: string; onUndo: () => void } | null>(null)

  const [user, setUser] = useState<any>(null)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [showAuth, setShowAuth] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const processedRef = useRef(false)

  useEffect(() => {
    saveTrips(trips)
    if (user) {
      saveAllTrips(user.id, trips).catch(() => {
        // Supabase unreachable: localStorage remains the source of truth.
      })
    }
  }, [trips, user])

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return
      setUser(session?.user ?? null)
      if (session?.user) {
        try {
          const remote = await fetchTrips(session.user.id)
          setTrips(remote.length ? remote : loadTrips())
        } catch {
          setTrips(loadTrips())
        }
      } else {
        setTrips(loadTrips())
      }
      setLoaded(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setAuthError('')
      if (session?.user) {
        fetchTrips(session.user.id)
          .then((remote) => setTrips(remote.length ? remote : loadTrips()))
          .catch(() => setTrips(loadTrips()))
      }
    })
    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (processedRef.current) return
    processedRef.current = true
    const today = new Date().toISOString().slice(0, 10)
    const next = trips.map((t) => ({
      ...t,
      expenses: processRecurringExpenses(t.expenses, today),
    }))
    const changed = next.some((t, i) => JSON.stringify(t.expenses) !== JSON.stringify(trips[i]?.expenses))
    if (changed) setTrips(next)
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
      currency,
      members: [...new Set(memberNames)],
      expenses: [],
      createdAt: new Date().toISOString(),
    }
    setTrips((prev) => [t, ...prev])
    setOpenTripId(t.id)
    setCreating(false)
    setName('')
    setMembers('')
    setCurrency('INR')
    setFormError('')
    setShowAuth(false)
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
    const trip = trips.find((t) => t.id === tripId)
    const expense = trip?.expenses.find((e) => e.id === expenseId)
    if (!expense) return
    setTrips((prev) =>
      prev.map((t) =>
        t.id === tripId
          ? { ...t, expenses: t.expenses.filter((e) => e.id !== expenseId) }
          : t
      )
    )
    setToast({
      message: `"${expense.title}" deleted`,
      onUndo: () =>
        setTrips((prev) =>
          prev.map((t) =>
            t.id === tripId ? { ...t, expenses: [...t.expenses, expense] } : t
          )
        ),
    })
  }

  function editExpense(tripId: string, expenseId: string, data: Omit<Expense, 'id'>) {
    setTrips((prev) =>
      prev.map((t) =>
        t.id === tripId
          ? {
              ...t,
              expenses: t.expenses.map((e) => (e.id === expenseId ? { id: e.id, ...data } : e)),
            }
          : t
      )
    )
  }

  function deleteTrip(tripId: string) {
    const trip = trips.find((t) => t.id === tripId)
    if (!trip) return
    setTrips((prev) => prev.filter((t) => t.id !== tripId))
    setOpenTripId(null)
    setToast({
      message: `"${trip.name}" deleted`,
      onUndo: () => setTrips((prev) => [...prev, trip]),
    })
  }

  function renameTrip(tripId: string, name: string) {
    const trimmed = name.trim()
    if (!trimmed) return
    setTrips((prev) =>
      prev.map((t) =>
        t.id === tripId ? { ...t, name: trimmed } : t
      )
    )
  }

  function renameMember(tripId: string, oldName: string, newName: string) {
    const trimmed = newName.trim()
    if (!trimmed || trimmed === oldName) return
    setTrips((prev) =>
      prev.map((t) => {
        if (t.id !== tripId) return t
        if (t.members.includes(trimmed)) return t
        return {
          ...t,
          members: t.members.map((m) => (m === oldName ? trimmed : m)),
          expenses: t.expenses.map((e) => ({
            ...e,
            paidBy: e.paidBy === oldName ? trimmed : e.paidBy,
            participants: e.participants.map((p) => (p === oldName ? trimmed : p)),
          })),
        }
      })
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

  async function signIn() {
    setAuthLoading(true)
    setAuthError('')
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword,
      })
      if (error) throw error
      setShowAuth(false)
    } catch (err: any) {
      setAuthError(err.message || 'Sign in failed.')
    } finally {
      setAuthLoading(false)
    }
  }

  async function signUp() {
    setAuthLoading(true)
    setAuthError('')
    try {
      const { error } = await supabase.auth.signUp({
        email: authEmail,
        password: authPassword,
      })
      if (error) throw error
      setAuthError('Account created. Check your email to confirm, then sign in.')
    } catch (err: any) {
      setAuthError(err.message || 'Sign up failed.')
    } finally {
      setAuthLoading(false)
    }
  }

  async function magicLink() {
    setAuthLoading(true)
    setAuthError('')
    try {
      const { error } = await supabase.auth.signInWithOtp({ email: authEmail })
      if (error) throw error
      setAuthError('Magic link sent. Check your email.')
    } catch (err: any) {
      setAuthError(err.message || 'Magic link failed.')
    } finally {
      setAuthLoading(false)
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setTrips(loadTrips())
    setOpenTripId(null)
    setShowAuth(false)
  }

  const inputClass =
    'w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/30'

  if (!loaded) {
    return (
      <div className="min-h-svh bg-bg text-text flex items-center justify-center">
        <div className="text-sm text-text-muted">Loading…</div>
      </div>
    )
  }

  if (trip) {
    return (
      <TripView
        key={trip.id}
        trip={trip}
        onBack={() => setOpenTripId(null)}
        onAddExpense={(data) => addExpense(trip.id, data)}
        onEditExpense={(expenseId, data) => editExpense(trip.id, expenseId, data)}
        onDeleteExpense={(expenseId) => deleteExpense(trip.id, expenseId)}
        onAddMember={(member) => addMember(trip.id, member)}
        onRemoveMember={(member) => removeMember(trip.id, member)}
        onRenameTrip={(name) => renameTrip(trip.id, name)}
        onRenameMember={(oldName, newName) => renameMember(trip.id, oldName, newName)}
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
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-2 text-sm text-text-muted">
                <span>{user.email}</span>
                <button
                  type="button"
                  onClick={signOut}
                  className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs text-text transition hover:bg-surface-2"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAuth((s) => !s)}
                className="rounded-md bg-accent-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-accent-700"
              >
                {showAuth ? 'Close' : 'Sign in'}
              </button>
            )}
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
        </header>

        {showAuth && !user && (
          <form
            onSubmit={(e) => { e.preventDefault(); signIn() }}
            noValidate
            className="mt-6 rounded-lg border border-border bg-surface p-5"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label
                  htmlFor="auth-email"
                  className="mb-1 block text-xs font-medium uppercase tracking-wide text-text-subtle"
                >
                  Email
                </label>
                <input
                  id="auth-email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  type="email"
                  placeholder="you@example.com"
                  className={inputClass}
                  autoFocus
                />
              </div>
              <div className="sm:col-span-2">
                <label
                  htmlFor="auth-password"
                  className="mb-1 block text-xs font-medium uppercase tracking-wide text-text-subtle"
                >
                  Password
                </label>
                <input
                  id="auth-password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  type="password"
                  placeholder="••••••••"
                  className={inputClass}
                />
              </div>
            </div>
            {authError && <p className="mt-3 text-sm text-danger-500">{authError}</p>}
            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                disabled={authLoading}
                className="rounded-md bg-accent-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-700 disabled:opacity-60"
              >
                {authLoading ? 'Signing in…' : 'Sign in'}
              </button>
              <button
                type="button"
                onClick={signUp}
                disabled={authLoading}
                className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text transition hover:bg-surface-2 disabled:opacity-60"
              >
                Create account
              </button>
              <button
                type="button"
                onClick={magicLink}
                disabled={authLoading}
                className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text transition hover:bg-surface-2 disabled:opacity-60"
              >
                Magic link
              </button>
            </div>
            <p className="mt-3 text-xs text-text-subtle">
              Syncs your trips to Supabase so you can access them from any device.
            </p>
          </form>
        )}

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
                  className={inputClass}
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
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-text-subtle">Separate names with commas.</p>
              </div>
              <div className="sm:col-span-2">
                <label
                  htmlFor="trip-currency"
                  className="mb-1 block text-xs font-medium uppercase tracking-wide text-text-subtle"
                >
                  Currency
                </label>
                <select
                  id="trip-currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className={inputClass}
                >
                  <option value="INR">INR (Indian Rupee)</option>
                  <option value="USD">USD (US Dollar)</option>
                  <option value="EUR">EUR (Euro)</option>
                  <option value="GBP">GBP (British Pound)</option>
                  <option value="JPY">JPY (Japanese Yen)</option>
                </select>
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
                        {t.members.length} {t.members.length === 1 ? 'member' : 'members'} · {formatMoney(tripTotal(t.expenses), t.currency ?? 'INR')}
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
