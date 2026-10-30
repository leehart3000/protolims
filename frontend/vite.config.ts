import { execSync } from 'node:child_process'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

function git(args: string): string | null {
  try {
    return execSync(`git ${args}`, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return null
  }
}

// Which release and commit this build is, shown in the footer.
function buildInfo() {
  const commit = (process.env.GITHUB_SHA ?? git('rev-parse HEAD') ?? 'unknown').slice(0, 7)

  // Production builds run because a release tag (e.g. v0.3.0) was pushed.
  if (process.env.GITHUB_REF_TYPE === 'tag' && process.env.GITHUB_REF_NAME) {
    return { version: process.env.GITHUB_REF_NAME.replace(/^v/, ''), commit }
  }

  // Otherwise use the nearest release tag: "v0.3.0-2-g1a2b3c4" means two commits after v0.3.0.
  const match = git('describe --tags --long --match "v*"')?.match(/^v(.+)-(\d+)-g[0-9a-f]+$/)
  const tag = match?.[1]
  const ahead = match?.[2]
  if (!tag || !ahead) {
    return { version: 'unreleased', commit }
  }
  return { version: ahead === '0' ? tag : `${tag}+${ahead}`, commit }
}

// Vite (when building) and Vitest (when testing) both expose VITE_* variables to the app
// as import.meta.env.VITE_*.
const build = buildInfo()
process.env.VITE_APP_VERSION = build.version
process.env.VITE_APP_COMMIT = build.commit
// Which site this build is for, shown as a badge in the header so it's never mistaken for the
// real one: "Staging" (set by the staging deploy), "Local" on the development server, and
// nothing for production (or in CI checks and tests, unless a test sets it).
process.env.VITE_APP_ENVIRONMENT ??= process.env.CI || process.env.VITEST ? '' : 'Local'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}', 'worker/**/*.ts'],
      exclude: ['src/main.tsx', 'src/**/*.test.{ts,tsx}', 'src/test/**', 'src/**/*.d.ts'],
      thresholds: { lines: 80, branches: 80, functions: 80, statements: 80 },
    },
  },
  server: {
    host: '127.0.0.1',
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
})
