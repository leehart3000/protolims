import { Link } from 'react-router'

import { PageTitle } from '../components/PageTitle'

export default function NotFoundPage() {
  return (
    <>
      <PageTitle>Page not found</PageTitle>
      <p className="mt-3 text-muted">There is nothing at this address.</p>
      <p className="mt-6">
        <Link to="/" className="text-link underline hover:no-underline">
          Go to the home page
        </Link>
      </p>
    </>
  )
}
