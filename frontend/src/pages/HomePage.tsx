import { Link } from 'react-router'

export default function HomePage() {
  return (
    <>
      <h1 className="text-2xl font-semibold sm:text-3xl">Welcome to ProtoLIMS</h1>
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
