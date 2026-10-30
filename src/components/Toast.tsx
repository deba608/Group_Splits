import { useEffect, useState } from 'react'

interface ToastProps {
  message: string
  onUndo?: () => void
  onDismiss: () => void
}

export default function Toast({ message, onUndo, onDismiss }: ToastProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      onDismiss()
    }, 4000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  if (!visible) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-lg border border-border bg-surface p-3 shadow-lg z-50 animate-in slide-in-from-bottom-4">
      <span className="text-sm text-text">{message}</span>
      {onUndo && (
        <button
          type="button"
          onClick={() => {
            setVisible(false)
            onUndo()
          }}
          className="rounded-md bg-accent-600 px-2 py-1 text-xs font-medium text-white transition hover:bg-accent-700"
        >
          Undo
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          setVisible(false)
          onDismiss()
        }}
        className="rounded-md p-1 text-text-subtle transition hover:bg-surface-2"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
