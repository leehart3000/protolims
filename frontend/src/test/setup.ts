import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// jsdom doesn't scroll (and says so on every call), so pages starting at the top (ScrollToTop)
// do nothing in tests. The Worker's tests run without a browser (no window), so they're left be.
if (typeof window !== 'undefined') {
  window.scrollTo = vi.fn()
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})
