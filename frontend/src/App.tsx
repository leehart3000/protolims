export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-haze bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4">
          <a href="/" className="flex items-center gap-2.5">
            <img src="/brand/protolims-mark.svg" alt="" className="size-8" />
            <span className="font-brand text-2xl tracking-tight">
              Proto<span className="font-bold text-cobalt">LIMS</span>
            </span>
          </a>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        <h1 className="text-3xl font-semibold">Welcome to ProtoLIMS</h1>
        <p className="mt-3 max-w-2xl text-lg text-ink/75">
          A prototype laboratory information management system for multi-omics research: samples,
          experiments, assays and results, with full provenance.
        </p>
      </main>

      <footer className="border-t border-haze">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-ink/70">
          ProtoLIMS is free software under the{' '}
          <a
            className="text-cobalt underline hover:no-underline"
            href="https://www.gnu.org/licenses/agpl-3.0.html"
          >
            GNU AGPL v3
          </a>
          .{' '}
          <a
            className="text-cobalt underline hover:no-underline"
            href="https://github.com/leehart3000/protolims"
          >
            Source code
          </a>
        </div>
      </footer>
    </div>
  )
}
