# GroupSplits — Perfect Plan

**Version:** 1.0  
**Date:** 2026-10-28  
**Status:** Implementation Ready  
**Goal:** Make GroupSplits production-ready with polish, robustness, and clear path to v2

---

## Current State Assessment

### What's Working Well
- ✅ **Core split math** - Equal/custom splits, rounding handled correctly, balances computed properly, debt simplification working
- ✅ **All tests passing** (16 tests across 3 test files)
- ✅ **Clean TypeScript** - Proper types throughout, strict mode enabled
- ✅ **Good UX foundation** - Tabs, semantic colors, mobile-responsive, validation
- ✅ **Local persistence** - localStorage with shape validation
- ✅ **Build passing** - No type errors, lint clean

### Gaps Identified
- ⚠️ **Supabase integration incomplete** - Client and DB helpers exist but not wired into App.tsx (v2 feature, not blocking v1)
- ⚠️ **Missing error boundaries** - App could crash on unexpected errors
- ⚠️ **No PWA support** - Could benefit from offline capability
- ⚠️ **Limited accessibility** - Some ARIA improvements needed
- ⚠️ **No loading states** - Not critical for localStorage but good practice
- ⚠️ **Date formatting** - Trip createdAt exists but not displayed nicely
- ⚠️ **No expense editing** - Can only add/delete, not edit (mentioned in TripView as future)
- ⚠️ **Mobile UX polish** - FAB exists but could be improved
- ⚠️ **Empty states could be richer** - Good but could add more guidance

---

## Perfect Plan

### Phase 1: Code Quality & Robustness (Priority: HIGH) 
*Goal: Make the app bulletproof*

| Task | Description | Files | Status |
|---|---|---|---|
| **1.1 Error Boundary** | Add React error boundary to catch and display errors gracefully | `src/components/ErrorBoundary.tsx`, `src/main.tsx` | TODO |
| **1.2 Storage robustness** | Improve localStorage error handling (quota exceeded, private mode) | `src/lib/storage.ts` | TODO |
| **1.3 Input validation hardening** | Add max lengths, sanitize inputs, prevent XSS in display | `src/App.tsx`, `src/components/*` | TODO |
| **1.4 Type safety** | Ensure all edge cases handled, add stricter types where helpful | Multiple | TODO |

### Phase 2: UX Polish & Accessibility (Priority: HIGH)
*Goal: Delightful, accessible experience*

| Task | Description | Files | Status |
|---|---|---|---|
| **2.1 Accessibility audit** | Add proper ARIA labels, keyboard navigation, focus management, screen reader support | All components | TODO |
| **2.2 Date display** | Show when trip was created/expense added in human-readable format | `src/lib/format.ts`, `TripView.tsx`, `App.tsx` | TODO |
| **2.3 Empty states enhancement** | Better empty states with illustrations and CTAs | `App.tsx`, `TripView.tsx` | TODO |
| **2.4 Loading/transition states** | Smooth transitions, better feedback | All components | TODO |
| **2.5 Mobile improvements** | Better bottom sheet for forms, improved FAB, touch targets | `AddExpenseForm.tsx`, `TripView.tsx` | TODO |

### Phase 3: Feature Completeness (Priority: MEDIUM)
*Goal: Fill small gaps without over-engineering*

| Task | Description | Files | Status |
|---|---|---|---|
| **3.1 Expense editing** | Allow editing existing expenses (amount, split, participants) | `TripView.tsx`, `AddExpenseForm.tsx`, `App.tsx` | DONE |
| **3.2 Trip metadata** | Add optional date/location to trips, display in UI | `src/lib/storage.ts`, `App.tsx`, `TripView.tsx` | TODO |
| **3.3 Sort trips** | Sort by most recent first (already done via prepend, but ensure) | `App.tsx` | TODO |
| **3.4 Export/Share** | Export trip summary as text/JSON, share settle plan better | `TripView.tsx` | TODO |
| **3.5 Undo actions** | Add undo for delete expense/trip (toast notification) | New component, integrate | TODO |
| **3.6 Trip rename** | Rename a trip and edit its member list | `TripView.tsx`, `App.tsx` | TODO |
| **3.7 Date filter** | Filter expenses by date range in expenses tab | `TripView.tsx` | TODO |
| **3.8 Recurring expenses** | Mark expenses as recurring (weekly/monthly) for templates | `src/lib/splits.ts`, `storage.ts` | TODO |

### Phase 4: Performance & Best Practices (Priority: MEDIUM)
*Goal: Optimize and follow best practices*

| Task | Description | Files | Status |
|---|---|---|---|
| **4.1 Performance** | Memoize expensive computations, optimize re-renders | All components | TODO |
| **4.2 Code splitting** | Lazy load components if app grows | `src/App.tsx` | TODO |
| **4.3 PWA support** | Add manifest, service worker for offline use | `public/`, `vite.config.ts`, `index.html` | TODO |
| **4.4 SEO/Meta tags** | Add proper meta tags, OG tags | `index.html` | TODO |
| **4.5 Analytics ready** | Add structure for analytics (optional, commented) | N/A | TODO |

### Phase 5: Testing & Documentation (Priority: HIGH)
*Goal: Ensure quality and maintainability*

| Task | Description | Files | Status |
|---|---|---|---|
| **5.1 More unit tests** | Test edge cases, custom splits, debt simplification | `src/lib/*.test.ts` | TODO |
| **5.2 Component tests** | Add React component tests with testing-library | `src/**/*.test.tsx` | TODO |
| **5.3 E2E tests** | Basic Playwright tests for critical flows | `e2e/`, `playwright.config.ts` | TODO |
| **5.4 Documentation** | Update README with new features, add CONTRIBUTING.md | `README.md`, `CONTRIBUTING.md` | TODO |
| **5.5 Storybook (optional)** | Component documentation | Optional | SKIP |

---

## Implementation Details

### 1.1 Error Boundary
```typescript
// src/components/ErrorBoundary.tsx
import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Error caught by boundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-svh bg-zinc-950 text-zinc-100 flex items-center justify-center p-4">
          <div className="max-w-md text-center">
            <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
            <p className="text-zinc-400 mb-4">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg bg-violet-600 px-4 py-2 text-white hover:bg-violet-500"
            >
              Reload page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
```

### 1.2 Date Formatting
Add to `src/lib/format.ts`:
```typescript
export function formatDate(iso?: string): string {
  if (!iso) return ''
  try {
    const date = new Date(iso)
    return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return ''
  }
}

export function formatRelativeTime(iso?: string): string {
  if (!iso) return ''
  try {
    const date = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    return formatDate(iso)
  } catch {
    return ''
  }
}
```

### 3.1 Expense Editing
Add edit functionality to TripView - track `editingExpenseId`, pass to form or inline edit.

### 4.3 PWA Setup
Create `public/manifest.json`, update `index.html` with meta tags and manifest link.

---

## Quick Wins (Do First - < 1 hour)
1. **Add ErrorBoundary** - Prevents white screen crashes
2. **Date formatting** - Show trip creation dates
3. **Better empty states** - More inviting
4. **Accessibility labels** - Improve ARIA
5. **Export settle plan** - Already have copy, enhance

---

## Success Criteria
- [ ] All tests pass (16/16 minimum, aim for 25+)
- [ ] Build succeeds with no warnings
- [ ] Lint passes cleanly
- [ ] Lighthouse score > 90 (Performance, Accessibility, Best Practices)
- [ ] Works offline (PWA)
- [ ] No console errors in normal use
- [ ] Mobile experience is smooth
- [ ] Accessible via keyboard and screen reader

---

## Notes
- **Don't break existing functionality** - All current features must remain working
- **Keep it simple** - This is a personal/group tool, avoid over-engineering
- **Maintain local-first** - localStorage is fine for v1, Supabase is v2
- **Test before committing** - Run tests and build after changes

**Current Status:** v1 MVP is complete and functional. This plan takes it from "good" to "perfect".
