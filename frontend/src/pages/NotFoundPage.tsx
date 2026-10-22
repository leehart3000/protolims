import { Link } from 'react-router'

export default function NotFoundPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold sm:text-3xl">Page not found</h1>
      <p className="mt-3 text-muted">There is nothing at this address.</p>
      <p className="mt-6">
        <Link to="/" className="text-link underline hover:no-underline">
          Go to the home page
        </Link>
      </p>
    </>
  )
}
