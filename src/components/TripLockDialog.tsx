import { useState } from 'react'

export type LockDialogMode = 'set' | 'unlock' | 'manage'

interface TripLockDialogProps {
  mode: LockDialogMode
  tripName: string
  error?: string
  busy?: boolean
  onClose: () => void
  onSubmit: (passcode: string) => void
  onManage?: (action: 'lock' | 'remove') => void
}

const inputClass =
  'w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/30'

export default function TripLockDialog({
  mode,
  tripName,
  error,
  busy,
  onClose,
  onSubmit,
  onManage,
}: TripLockDialogProps) {
  const [passcode, setPasscode] = useState('')
  const [confirm, setConfirm] = useState('')
  const [localError, setLocalError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (mode === 'set') {
      if (passcode.trim().length < 4) {
        setLocalError('Use at least 4 characters.')
        return
      }
      if (passcode !== confirm) {
        setLocalError('Passcodes do not match.')
        return
      }
    } else if (passcode.trim().length === 0) {
      setLocalError('Enter the trip passcode.')
      return
    }
    setLocalError('')
    onSubmit(passcode)
  }

  const message = localError || error || ''

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lock-title"
        className="w-full max-w-sm rounded-lg border border-border bg-surface p-5 shadow-2xl"
      >
        <h2 id="lock-title" className="text-base font-semibold">
          {mode === 'unlock' ? 'Unlock trip' : mode === 'set' ? 'Lock trip' : 'Trip lock'}
        </h2>
        <p className="mt-1 text-xs text-text-subtle">
          {mode === 'unlock'
            ? `"${tripName}" is encrypted. Enter its passcode to open it.`
            : mode === 'set'
              ? `"${tripName}" will be encrypted with this passcode. There is no recovery if you forget it.`
              : `"${tripName}" is unlocked for this session.`}
        </p>

        {mode === 'manage' ? (
          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => onManage?.('lock')}
              className="rounded-md bg-accent-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-700 disabled:opacity-60"
            >
              Lock now
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onManage?.('remove')}
              className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text transition hover:bg-surface-2 disabled:opacity-60"
            >
              Remove lock
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm text-text-muted transition hover:bg-surface-2"
            >
              Cancel
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className="mt-4 space-y-3">
              <div>
                <label
                  htmlFor="trip-passcode"
                  className="mb-1 block text-xs font-medium uppercase tracking-wide text-text-subtle"
                >
                  Passcode
                </label>
                <input
                  id="trip-passcode"
                  type="password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  autoFocus
                  autoComplete="off"
                  className={inputClass}
                />
              </div>
              {mode === 'set' && (
                <div>
                  <label
                    htmlFor="trip-passcode-confirm"
                    className="mb-1 block text-xs font-medium uppercase tracking-wide text-text-subtle"
                  >
                    Confirm passcode
                  </label>
                  <input
                    id="trip-passcode-confirm"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="off"
                    className={inputClass}
                  />
                </div>
              )}
            </div>
            {message && <p className="mt-3 text-sm text-danger-500">{message}</p>}
            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="rounded-md bg-accent-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-700 disabled:opacity-60"
              >
                {busy ? 'Working…' : mode === 'unlock' ? 'Unlock' : 'Lock trip'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text transition hover:bg-surface-2"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
