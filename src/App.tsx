import { useEffect, useRef, useState } from 'react'
import TripView from './components/TripView'
import TripLockDialog, { type LockDialogMode } from './components/TripLockDialog'
import Toast from './components/Toast'
import { formatMoney } from './lib/format'
import { uid } from './lib/id'
import {
  tripTotal,
  processRecurringExpenses,
  type Expense,
  type Payment,
} from './lib/splits'
import { loadTrips, saveTrips, type Trip } from './lib/storage'
import { lockTrip, openTrip, removeLock, sealTrip } from './lib/crypto'
import { supabase } from './lib/supabase'
import { fetchTrips, fetchLockStates, syncTrips, deleteTripRecord } from './lib/db'
import { applyRemoteLocks, mergeRemoteWithLocal } from './lib/locks'

function withRecurringExpenses(trips: Trip[]): Trip[] {
  const today = new Date().toISOString().slice(0, 10)
  let changed = false
  const next = trips.map((trip) => {
    const expenses = processRecurringExpenses(trip.expenses, today)
    if (JSON.stringify(expenses) === JSON.stringify(trip.expenses)) return trip
    changed = true
    return { ...trip, expenses }
  })
  return changed ? next : trips
}

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
  const [syncedUser, setSyncedUser] = useState<string | null>(null)

  const [lockDialog, setLockDialog] = useState<{ mode: LockDialogMode; tripId: string } | null>(null)
  const [lockError, setLockError] = useState('')
  const [lockBusy, setLockBusy] = useState(false)
  const [syncError, setSyncError] = useState('')
  const [cloudBusy, setCloudBusy] = useState<string | null>(null)
  const [unlockedIds, setUnlockedIds] = useState<string[]>([])
  const keysRef = useRef(new Map<string, CryptoKey>())
  const tripsRef = useRef(trips)
  const openTripIdRef = useRef(openTripId)
  const unlockedIdsRef = useRef(unlockedIds)

  useEffect(() => {
    tripsRef.current = trips
    openTripIdRef.current = openTripId
    unlockedIdsRef.current = unlockedIds
  }, [trips, openTripId, unlockedIds])

  // A lock set on another device must reach this one without a full reload.
  // Runs on mount, window focus and tab visibility; only plaintext trips whose
  // cloud row is now locked are replaced, so unlocked work is left alone.
  useEffect(() => {
    const userId = user?.id
    if (!userId || syncedUser !== userId) return
    let cancelled = false
    let inFlight = false

    async function relockFromCloud() {
      if (inFlight) return
      inFlight = true
      try {
        const states = await fetchLockStates(userId as string)
        if (cancelled || states.length === 0) return
        const { lockedIds } = applyRemoteLocks(tripsRef.current, states, unlockedIdsRef.current)
        if (lockedIds.length === 0) return
        for (const id of lockedIds) {
          keysRef.current.delete(id)
        }
        setUnlockedIds((prev) => prev.filter((id) => !lockedIds.includes(id)))
        if (openTripIdRef.current && lockedIds.includes(openTripIdRef.current)) {
          setOpenTripId(null)
        }
        setTrips((prev) => applyRemoteLocks(prev, states, unlockedIdsRef.current).trips)
      } catch {
        // Offline: keep what this device has until the next focus.
      } finally {
        inFlight = false
      }
    }

    const onFocus = () => {
      void relockFromCloud()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    void relockFromCloud()
    return () => {
      cancelled = true
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [user, syncedUser])

  useEffect(() => {
    let cancelled = false
    async function persist() {
      // Trips unlocked in this session are held in state as plaintext, so seal
      // them again before they touch localStorage or Supabase.
      const stored = await Promise.all(
        trips.map(async (t) => {
          const key = keysRef.current.get(t.id)
          if (!key || !t.lock) return t
          try {
            return await sealTrip(t, key, t.lock.salt)
          } catch {
            return t
          }
        })
      )
      if (cancelled) return
      saveTrips(stored)
      const userId = user?.id as string | undefined
      // Never sync before remote data has been loaded for this user: locally stale
      // data must not delete cloud rows.
      if (!userId || syncedUser !== userId) return
      syncTrips(userId, stored)
        .then(() => {
          if (!cancelled) setSyncError('')
        })
        .catch((err: unknown) => {
          if (cancelled) return
          const message = err instanceof Error ? err.message : ''
          if (message.includes('lock_data')) setSyncError(message)
        })
    }
    void persist()
    return () => {
      cancelled = true
    }
  }, [trips, user, syncedUser])

  useEffect(() => {
    let mounted = true
    let requestId = 0

    async function hydrate(userId: string | null) {
      const current = ++requestId
      setSyncedUser(null)
      let next: Trip[]
      if (userId) {
        try {
          const remote = await fetchTrips(userId)
          if (!mounted || current !== requestId) return
          const local = loadTrips()
          next = withRecurringExpenses(
            remote.length ? mergeRemoteWithLocal(remote, local) : local
          )
        } catch {
          if (!mounted || current !== requestId) return
          next = loadTrips()
        }
      } else {
        next = withRecurringExpenses(loadTrips())
      }
      const { ensureSeedTrip } = await import('./lib/seed')
      if (!mounted || current !== requestId) return
      keysRef.current.clear()
      setUnlockedIds([])
      setTrips(ensureSeedTrip(next))
      setSyncedUser(userId)
      setLoaded(true)
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      setUser(session?.user ?? null)
      void hydrate(session?.user?.id ?? null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      setUser(session?.user ?? null)
      setAuthError('')
      void hydrate(session?.user?.id ?? null)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const trip = trips.find((t) => t.id === openTripId) ?? null

  function isLocked(target: Trip): boolean {
    return Boolean(target.lock) && !unlockedIds.includes(target.id)
  }

  function requestOpen(target: Trip) {
    if (isLocked(target)) {
      setLockError('')
      setLockDialog({ mode: 'unlock', tripId: target.id })
      return
    }
    setOpenTripId(target.id)
  }

  function requestLock(target: Trip) {
    setLockError('')
    setLockDialog({ mode: target.lock ? 'manage' : 'set', tripId: target.id })
  }

  async function submitPasscode(passcode: string) {
    if (!lockDialog) return
    const target = trips.find((t) => t.id === lockDialog.tripId)
    if (!target) return
    setLockBusy(true)
    setLockError('')
    try {
      if (lockDialog.mode === 'set') {
        const locked = await lockTrip(target, passcode)
        keysRef.current.delete(target.id)
        setUnlockedIds((prev) => prev.filter((id) => id !== target.id))
        setTrips((prev) => prev.map((t) => (t.id === target.id ? locked.trip : t)))
        setOpenTripId(null)
      } else {
        const opened = await openTrip(target, passcode)
        const { withSeedPayers } = await import('./lib/seed')
        const openedTrip = withSeedPayers(opened.trip)
        keysRef.current.set(target.id, opened.key)
        setUnlockedIds((prev) => (prev.includes(target.id) ? prev : [...prev, target.id]))
        setTrips((prev) => prev.map((t) => (t.id === target.id ? openedTrip : t)))
        setOpenTripId(target.id)
      }
      setLockDialog(null)
    } catch (err) {
      setLockError(err instanceof Error ? err.message : 'Could not unlock this trip.')
    } finally {
      setLockBusy(false)
    }
  }

  async function manageLock(action: 'lock' | 'remove') {
    if (!lockDialog) return
    const target = trips.find((t) => t.id === lockDialog.tripId)
    if (!target) return
    setLockBusy(true)
    setLockError('')
    try {
      if (action === 'remove') {
        keysRef.current.delete(target.id)
        setUnlockedIds((prev) => prev.filter((id) => id !== target.id))
        setTrips((prev) => prev.map((t) => (t.id === target.id ? removeLock(t) : t)))
      } else {
        const key = keysRef.current.get(target.id)
        if (key && target.lock) {
          const sealed = await sealTrip(target, key, target.lock.salt)
          keysRef.current.delete(target.id)
          setUnlockedIds((prev) => prev.filter((id) => id !== target.id))
          setTrips((prev) => prev.map((t) => (t.id === target.id ? sealed : t)))
          setOpenTripId(null)
        }
      }
      setLockDialog(null)
    } catch (err) {
      setLockError(err instanceof Error ? err.message : 'Could not update the lock.')
    } finally {
      setLockBusy(false)
    }
  }

  async function closeTrip() {
    const target = openTripId ? trips.find((t) => t.id === openTripId) : null
    const key = target ? keysRef.current.get(target.id) : undefined
    if (target && key && target.lock) {
      const sealed = await sealTrip(target, key, target.lock.salt)
      keysRef.current.delete(target.id)
      setUnlockedIds((prev) => prev.filter((id) => id !== target.id))
      setTrips((prev) => prev.map((t) => (t.id === target.id ? sealed : t)))
    }
    setOpenTripId(null)
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

  function addPayment(tripId: string, data: Omit<Payment, 'id'>) {
    setTrips((prev) =>
      prev.map((t) =>
        t.id === tripId
          ? { ...t, payments: [...(t.payments ?? []), { id: uid(), ...data }] }
          : t
      )
    )
  }

  function editPayment(tripId: string, paymentId: string, data: Omit<Payment, 'id'>) {
    setTrips((prev) =>
      prev.map((t) =>
        t.id === tripId
          ? {
              ...t,
              payments: (t.payments ?? []).map((p) =>
                p.id === paymentId ? { id: p.id, ...data } : p
              ),
            }
          : t
      )
    )
  }

  function deletePayment(tripId: string, paymentId: string) {
    const trip = trips.find((t) => t.id === tripId)
    const payment = trip?.payments?.find((p) => p.id === paymentId)
    if (!payment) return
    setTrips((prev) =>
      prev.map((t) =>
        t.id === tripId
          ? { ...t, payments: (t.payments ?? []).filter((p) => p.id !== paymentId) }
          : t
      )
    )
    setToast({
      message: `Payment of ${formatMoney(payment.amount, trip?.currency ?? 'INR')} deleted`,
      onUndo: () =>
        setTrips((prev) =>
          prev.map((t) =>
            t.id === tripId ? { ...t, payments: [...(t.payments ?? []), payment] } : t
          )
        ),
    })
  }

  async function hideFromCloud(tripId: string) {
    const userId = user?.id
    if (!userId) return
    setCloudBusy(tripId)
    try {
      await deleteTripRecord(userId, tripId)
      setTrips((prev) =>
        prev.map((t) => (t.id === tripId ? { ...t, cloudHidden: true } : t))
      )
      setToast({ message: 'Removed from the cloud. Local copy kept.' })
    } catch (err) {
      setToast({
        message:
          err instanceof Error ? err.message : 'Could not remove this trip from the cloud.',
      })
    } finally {
      setCloudBusy(null)
    }
  }

  function restoreToCloud(tripId: string) {
    setTrips((prev) =>
      prev.map((t) => (t.id === tripId ? { ...t, cloudHidden: false } : t))
    )
    setToast({ message: 'Trip will sync to the cloud again.' })
  }

  function deleteTrip(tripId: string) {
    const trip = trips.find((t) => t.id === tripId)
    if (!trip) return
    const key = keysRef.current.get(tripId)
    keysRef.current.delete(tripId)
    setUnlockedIds((prev) => prev.filter((id) => id !== tripId))
    setTrips((prev) => prev.filter((t) => t.id !== tripId))
    setOpenTripId(null)
    const offerUndo = (snapshot: Trip) =>
      setToast({
        message: `"${snapshot.name}" deleted`,
        onUndo: () => setTrips((prev) => [...prev, snapshot]),
      })
    if (key && trip.lock) {
      // Undo must restore the sealed trip, never the plaintext held in memory.
      sealTrip(trip, key, trip.lock.salt).then(offerUndo, () => offerUndo(removeLock(trip)))
    } else {
      offerUndo(trip)
    }
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
    setSyncedUser(null)
    keysRef.current.clear()
    setUnlockedIds([])
    setTrips(loadTrips())
    setOpenTripId(null)
    setShowAuth(false)
  }

  const inputClass =
    'w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/30'

  const lockTarget = lockDialog ? trips.find((t) => t.id === lockDialog.tripId) : undefined
  const lockDialogNode =
    lockDialog && lockTarget ? (
      <TripLockDialog
        mode={lockDialog.mode}
        tripName={lockTarget.name}
        error={lockError}
        busy={lockBusy}
        cloudSync={Boolean(user)}
        onClose={() => {
          setLockDialog(null)
          setLockError('')
        }}
        onSubmit={submitPasscode}
        onManage={manageLock}
      />
    ) : null

  if (!loaded) {
    return (
      <div className="min-h-svh bg-bg text-text flex items-center justify-center">
        <div className="text-sm text-text-muted">Loading…</div>
      </div>
    )
  }

  if (trip) {
    return (
      <>
        <TripView
          key={trip.id}
          trip={trip}
          onBack={closeTrip}
          onLock={() => requestLock(trip)}
          onAddExpense={(data) => addExpense(trip.id, data)}
          onEditExpense={(expenseId, data) => editExpense(trip.id, expenseId, data)}
          onDeleteExpense={(expenseId) => deleteExpense(trip.id, expenseId)}
          onAddPayment={(data) => addPayment(trip.id, data)}
          onEditPayment={(paymentId, data) => editPayment(trip.id, paymentId, data)}
          onDeletePayment={(paymentId) => deletePayment(trip.id, paymentId)}
          onAddMember={(member) => addMember(trip.id, member)}
          onRemoveMember={(member) => removeMember(trip.id, member)}
          onRenameTrip={(name) => renameTrip(trip.id, name)}
          onRenameMember={(oldName, newName) => renameMember(trip.id, oldName, newName)}
          onDeleteTrip={() => deleteTrip(trip.id)}
        />
        {toast && (
          <Toast
            message={toast.message}
            onUndo={toast.onUndo}
            onDismiss={() => setToast(null)}
          />
        )}
        {lockDialogNode}
      </>
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

        {syncError && (
          <p className="mt-4 rounded-md border border-warning-500/40 bg-warning-500/10 px-3 py-2 text-xs text-warning-500">
            {syncError} Local trips are safe; cloud sync resumes after the column exists.
          </p>
        )}

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
              {trips.map((t) => {
                const locked = isLocked(t)
                const displayName = locked ? 'Locked trip' : t.name
                return (
                <div
                  key={t.id}
                  className="group rounded-lg border border-border bg-surface p-4 transition hover:border-border-strong"
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => requestOpen(t)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="flex items-center gap-1.5 truncate font-medium">
                        {locked && (
                          <svg className="h-3.5 w-3.5 shrink-0 text-text-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        )}
                        <span className="truncate">{displayName}</span>
                      </p>
                      <p className="mt-1 text-sm text-text-subtle">
                        {locked
                          ? 'Encrypted · passcode required'
                          : `${t.members.length} ${t.members.length === 1 ? 'member' : 'members'} · ${formatMoney(tripTotal(t.expenses), t.currency ?? 'INR')}`}
                      </p>
                      <p className="mt-1 truncate text-xs text-text-subtle">
                        {locked
                          ? user
                            ? 'Locked here and in the cloud · other devices need the passcode'
                            : 'Locked on this device only · sign in to sync'
                          : t.members.join(', ')}
                      </p>
                      {t.cloudHidden && (
                        <p className="mt-1 text-xs text-warning-500">
                          Local only · removed from the cloud
                        </p>
                      )}
                    </button>
                    <div className="flex shrink-0 items-center gap-1">
                      {!locked && (
                        <button
                          type="button"
                          aria-label={`Lock ${t.name}`}
                          title="Lock this trip with a passcode"
                          className="rounded-md p-1.5 text-text-subtle transition hover:bg-surface-2 hover:text-text"
                          onClick={() => requestLock(t)}
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        </button>
                      )}
                      {user && (
                        <button
                          type="button"
                          aria-label={
                            t.cloudHidden
                              ? `Restore ${displayName} to cloud`
                              : `Remove ${displayName} from cloud`
                          }
                          title={
                            t.cloudHidden
                              ? 'Restore to cloud'
                              : 'Hide from cloud (delete the cloud copy)'
                          }
                          disabled={cloudBusy === t.id}
                          className={`rounded-md p-1.5 transition disabled:opacity-50 ${
                            t.cloudHidden
                              ? 'text-warning-500 hover:bg-warning-500/10'
                              : 'text-text-subtle hover:bg-surface-2 hover:text-text'
                          }`}
                          onClick={() => {
                            if (t.cloudHidden) {
                              restoreToCloud(t.id)
                              return
                            }
                            if (
                              window.confirm(
                                `Remove "${displayName}" from the cloud? The copy on this device stays.`
                              )
                            ) {
                              void hideFromCloud(t.id)
                            }
                          }}
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            {t.cloudHidden ? (
                              <>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 001-9.9A6 6 0 006.4 7 4 4 0 003 15z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
                              </>
                            ) : (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 001-9.9A6 6 0 006.4 7 4 4 0 003 15z" />
                            )}
                          </svg>
                        </button>
                      )}
                      <button
                        type="button"
                        aria-label={`Delete ${displayName}`}
                        className="rounded-md p-1.5 text-text-subtle transition hover:bg-danger-500/10 hover:text-danger-500"
                        onClick={() => {
                          if (window.confirm(`Delete "${displayName}" and all its expenses?`)) {
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
                  <button
                    type="button"
                    className="mt-3 w-full rounded-md bg-surface-2 px-3 py-1.5 text-sm font-medium text-text transition hover:bg-accent-600 hover:text-white"
                    onClick={() => requestOpen(t)}
                  >
                    {locked ? 'Unlock' : 'Open'}
                  </button>
                </div>
                )
              })}
            </div>
          </section>
        )}
      </main>
      {toast && (
        <Toast
          message={toast.message}
          onUndo={toast.onUndo}
          onDismiss={() => setToast(null)}
        />
      )}
      {lockDialogNode}
    </div>
  )
}
