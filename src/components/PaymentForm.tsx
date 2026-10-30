import { useState } from 'react'
import type { Payment } from '../lib/splits'

interface PaymentFormProps {
  members: string[]
  initial?: Payment
  editing?: boolean
  onSubmit: (data: Omit<Payment, 'id'>) => void
  onCancel: () => void
}

const fieldClass =
  'w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/30'
const labelClass = 'mb-1 block text-xs font-medium uppercase tracking-wide text-text-subtle'

export default function PaymentForm({
  members,
  initial,
  editing,
  onSubmit,
  onCancel,
}: PaymentFormProps) {
  const [from, setFrom] = useState(initial?.from ?? members[0] ?? '')
  const [to, setTo] = useState(
    initial?.to ?? members.find((member) => member !== (initial?.from ?? members[0])) ?? ''
  )
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [date, setDate] = useState(
    () => initial?.date ?? new Date().toISOString().slice(0, 10)
  )
  const [note, setNote] = useState(initial?.note ?? '')
  const [error, setError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const value = Number(amount)
    if (!from || !to) {
      setError('Pick who paid and who received.')
      return
    }
    if (from === to) {
      setError('Payer and receiver must be different people.')
      return
    }
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter an amount greater than zero.')
      return
    }
    setError('')
    onSubmit({
      from,
      to,
      amount: Math.round(value * 100) / 100,
      date: date || undefined,
      note: note.trim() || undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="rounded-lg border border-border bg-surface p-4">
      <h3 className="text-sm font-semibold">{editing ? 'Edit payment' : 'Record payment'}</h3>
      <p className="mt-1 text-xs text-text-subtle">
        Money already handed over. It reduces what is still pending.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="payment-from" className={labelClass}>
            Who paid
          </label>
          <select
            id="payment-from"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={fieldClass}
          >
            {members.map((member) => (
              <option key={member} value={member}>
                {member}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="payment-to" className={labelClass}>
            Who received
          </label>
          <select
            id="payment-to"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className={fieldClass}
          >
            {members.map((member) => (
              <option key={member} value={member}>
                {member}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="payment-amount" className={labelClass}>
            Amount
          </label>
          <input
            id="payment-amount"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className={fieldClass}
            autoFocus
          />
        </div>
        <div>
          <label htmlFor="payment-date" className={labelClass}>
            Date
          </label>
          <input
            id="payment-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={fieldClass}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="payment-note" className={labelClass}>
            Note <span className="normal-case tracking-normal">(optional)</span>
          </label>
          <input
            id="payment-note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="UPI, cash, partial settlement…"
            className={fieldClass}
          />
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-danger-500">{error}</p>}

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          className="rounded-md bg-accent-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-700"
        >
          {editing ? 'Save changes' : 'Record payment'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text transition hover:bg-surface-2"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
