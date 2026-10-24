import { Link } from 'react-router'

export default function HomePage() {
  return (
    <>
      <h1 className="font-brand text-2xl tracking-tight sm:text-3xl">
        <span className="text-fg">Welcome to Proto</span>
        <span className="font-bold">LIMS</span>
      </h1>
      <p className="mt-3 max-w-2xl text-lg text-muted">
        A prototype laboratory information management system for multi-omics research: samples,
        experiments, assays and results, with full provenance.
      </p>
      <p className="mt-6">
        <Link to="/projects" className="text-link underline hover:no-underline">
          Browse projects
        </Link>
      </p>
    </>
  )
}
