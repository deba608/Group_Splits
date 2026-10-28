import { useMemo, useState } from 'react'
import { formatMoney } from '../lib/format'
import {
  customShareSummary,
  round2,
  splitAmount,
  type Expense,
  type SplitMode,
} from '../lib/splits'

interface AddExpenseFormProps {
  members: string[]
  quickAdd?: string | null
  editingExpense?: Expense | null
  onSave: (data: Omit<Expense, 'id'>) => void
  onCancel: () => void
  onDelete?: () => void
}

const inputClass =
  'w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/30'
const labelClass = 'mb-1 block text-xs font-medium uppercase tracking-wide text-text-subtle'

const expensePresets = [
  { label: 'Cab', emoji: '🚕', hint: 'Airport → hotel' },
  { label: 'Cold drinks', emoji: '🥤', hint: 'Round of drinks' },
  { label: 'Lunch', emoji: '🍽️', hint: 'Place or what you ate' },
  { label: 'Dinner', emoji: '🍛', hint: 'Place or what you ate' },
  { label: 'Homestay', emoji: '🏠', hint: 'Nights, place' },
  { label: 'Groceries', emoji: '🛒', hint: 'Snacks, water, ice' },
  { label: 'Tickets', emoji: '🎟️', hint: 'Train, museum, entry' },
] as const

export default function AddExpenseForm({
  members,
  quickAdd,
  editingExpense,
  onSave,
  onCancel,
  onDelete,
}: AddExpenseFormProps) {
  const [preset, setPreset] = useState<string>(quickAdd ?? '')
  const [title, setTitle] = useState(() => editingExpense?.title ?? '')
  const [amount, setAmount] = useState(() => (editingExpense ? String(editingExpense.amount) : ''))
  const [paidBy, setPaidBy] = useState(() => editingExpense?.paidBy ?? members[0] ?? '')
  const [splitMode, setSplitMode] = useState<SplitMode>(() => editingExpense?.splitMode ?? 'equal')
  const [selected, setSelected] = useState<string[]>(() =>
    editingExpense ? [...editingExpense.participants] : [...members]
  )
  const [customShares, setCustomShares] = useState<Record<string, number>>(() =>
    editingExpense?.customShares ? { ...editingExpense.customShares } : {}
  )
  const [attempted, setAttempted] = useState(false)
  const [roundUp, setRoundUp] = useState(() => !!editingExpense?.roundUp)

  const activePreset = expensePresets.find((p) => p.label === preset)
  const details = title.trim()
  const expenseTitle = preset
    ? `${activePreset?.emoji ?? ''} ${preset}${details ? `: ${details}` : ''}`.trim()
    : details

  const amountValue = Number.parseFloat(amount)
  const participants = useMemo(
    () => members.filter((m) => selected.includes(m)),
    [members, selected]
  )
  const summary = useMemo(
    () => customShareSummary(amountValue || 0, participants, customShares),
    [amountValue, participants, customShares]
  )
  const equalShare = participants.length > 0 && Number.isFinite(amountValue) && amountValue > 0
    ? amountValue / participants.length
    : 0

  const errors: string[] = []
  if (!expenseTitle) errors.push('Pick an expense type or add a title.')
  if (!Number.isFinite(amountValue) || amountValue <= 0) {
    errors.push('Amount must be greater than 0.')
  }
  if (participants.length === 0) errors.push('Pick at least one participant.')
  if (
    splitMode === 'custom' &&
    participants.length > 0 &&
    Math.abs(summary.remaining) > 0.005
  ) {
    errors.push(
      summary.remaining > 0
        ? `Custom amounts are ${formatMoney(summary.remaining)} short of the total.`
        : `Custom amounts exceed the total by ${formatMoney(-summary.remaining)}.`
    )
  }

  function toggleMember(member: string) {
    setSelected((prev) =>
      prev.includes(member) ? prev.filter((m) => m !== member) : [...prev, member]
    )
  }

  function switchMode(mode: SplitMode) {
    setSplitMode(mode)
    if (mode === 'custom' && participants.length > 0) {
      const seed = splitAmount(amountValue || 0, participants, 'equal')
      setCustomShares((prev) => ({ ...seed, ...prev }))
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setAttempted(true)
    if (errors.length > 0) return
    onSave({
      title: expenseTitle,
      amount: round2(amountValue),
      paidBy,
      splitMode,
      participants,
      customShares:
        splitMode === 'custom'
          ? Object.fromEntries(
              participants.map((m) => [m, round2(customShares[m] ?? 0)])
            )
          : {},
      roundUp,
    })
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-4 rounded-lg border border-border bg-surface p-4">
      <fieldset>
        <legend className={labelClass}>Expense type</legend>
        <div className="flex flex-wrap gap-2">
          {expensePresets.map((p) => {
            const active = preset === p.label
            return (
              <button
                key={p.label}
                type="button"
                aria-pressed={active}
                onClick={() => setPreset(active ? '' : p.label)}
                className={`rounded-full border px-3 py-1 text-sm ${
                  active
                    ? 'border-accent-500 bg-accent-600/10 text-accent-600'
                    : 'border-border text-text-muted hover:border-border-strong hover:text-text'
                }`}
              >
                <span aria-hidden="true">{p.emoji}</span> {p.label}
              </button>
            )
          })}
        </div>
      </fieldset>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="expense-title" className={labelClass}>
            {preset ? 'Details (optional)' : 'What was it?'}
          </label>
          <input
            id="expense-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={activePreset?.hint ?? 'Cab: airport → hotel'}
            className={inputClass}
            autoFocus
          />
          {preset && expenseTitle && (
            <p className="mt-1 text-xs text-text-subtle">
              Saved as “{expenseTitle}”
            </p>
          )}
        </div>

        <div>
          <label htmlFor="expense-amount" className={labelClass}>
            Amount
          </label>
          <input
            id="expense-amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            className={inputClass}
            autoFocus={!preset}
          />
        </div>

        <div>
          <label htmlFor="expense-payer" className={labelClass}>
            Paid by
          </label>
          <select
            id="expense-payer"
            value={paidBy}
            onChange={(e) => setPaidBy(e.target.value)}
            className={inputClass}
          >
            {members.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset className="mt-4">
        <legend className={labelClass}>Split</legend>
        <div className="inline-flex rounded-md border border-border p-1">
          {(['equal', 'custom'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={splitMode === mode}
              onClick={() => switchMode(mode)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize ${
                splitMode === mode
                  ? 'bg-accent-600 text-white'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer mt-2 block">
          <input
            type="checkbox"
            checked={roundUp}
            onChange={(e) => setRoundUp(e.target.checked)}
            className="rounded border-border text-accent-600 focus:ring-accent-500"
          />
          Round up each share
        </label>

        {splitMode === 'equal' && participants.length > 0 && amountValue > 0 && (
          <p className="mt-2 text-sm text-success-500">
            Each pays {formatMoney(equalShare)} ({participants.length}{' '}
            {participants.length === 1 ? 'person' : 'people'})
          </p>
        )}

        {splitMode === 'custom' && (
          <div className="mt-3 flex flex-col gap-2">
            {participants.map((m) => (
              <div key={m} className="flex items-center gap-3">
                <label htmlFor={`share-${m}`} className="w-24 truncate text-sm text-text-muted">
                  {m}
                </label>
                <input
                  id={`share-${m}`}
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={customShares[m] ?? 0}
                  onChange={(e) =>
                    setCustomShares((prev) => ({
                      ...prev,
                      [m]: Number.parseFloat(e.target.value) || 0,
                    }))
                  }
                  className={inputClass}
                />
              </div>
            ))}
            <p
              className={`text-sm ${
                Math.abs(summary.remaining) <= 0.005 ? 'text-success-500' : 'text-warning-500'
              }`}
            >
              {Math.abs(summary.remaining) <= 0.005
                ? 'Amounts match the total.'
                : summary.remaining > 0
                  ? `${formatMoney(summary.remaining)} left to assign.`
                  : `${formatMoney(-summary.remaining)} over the total.`}
            </p>
          </div>
        )}
      </fieldset>

      <fieldset className="mt-4">
        <legend className={labelClass}>Participants</legend>
        <div className="flex flex-wrap gap-2">
          {members.map((m) => {
            const active = selected.includes(m)
            return (
              <button
                key={m}
                type="button"
                aria-pressed={active}
                onClick={() => toggleMember(m)}
                className={`rounded-full border px-3 py-1 text-sm ${
                  active
                    ? 'border-accent-500 bg-accent-600/10 text-accent-600'
                    : 'border-border text-text-muted hover:border-border-strong'
                }`}
              >
                {m}
              </button>
            )
          })}
        </div>
      </fieldset>

      {attempted && errors.length > 0 && (
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-danger-500">
          {errors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      )}

      <div className="mt-5 flex gap-2">
        {editingExpense && onDelete ? (
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Delete "${editingExpense.title}"?`)) {
                onDelete()
                onCancel()
              }
            }}
            className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text transition hover:bg-danger-500/10 hover:text-danger-500"
          >
            Delete expense
          </button>
        ) : null}
        <button
          type="submit"
          className="rounded-md bg-accent-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-700"
        >
          {editingExpense ? 'Save changes' : 'Save expense'}
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