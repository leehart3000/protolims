import ThemeToggle from './components/ThemeToggle'

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-panel">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <a href="/" className="flex items-center gap-2.5">
            <img src="/brand/protolims-mark.svg" alt="" className="size-8 dark:hidden" />
            <img src="/brand/protolims-mark-dark.svg" alt="" className="hidden size-8 dark:block" />
            <span className="font-brand text-2xl tracking-tight">
              Proto<span className="font-bold text-link">LIMS</span>
            </span>
          </a>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        <h1 className="text-2xl font-semibold sm:text-3xl">Welcome to ProtoLIMS</h1>
        <p className="mt-3 max-w-2xl text-lg text-muted">
          A prototype laboratory information management system for multi-omics research: samples,
          experiments, assays and results, with full provenance.
        </p>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-muted">
          ProtoLIMS is free software under the{' '}
          <a
            className="text-link underline hover:no-underline"
            href="https://www.gnu.org/licenses/agpl-3.0.html"
          >
            GNU AGPL v3
          </a>
          .{' '}
          <a
            className="text-link underline hover:no-underline"
            href="https://github.com/leehart3000/protolims"
          >
            Source code
          </a>
        </div>
      </footer>
    </div>
  )
}
