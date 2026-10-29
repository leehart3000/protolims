// Where to go to sign in with ORCID, coming back afterwards to the page at `pathname` and
// `search` (the query string, if any).
export function signInHref(pathname: string, search: string) {
  const query = new URLSearchParams({ return_to: pathname + search })
  return `/api/v1/auth/orcid/login?${query.toString()}`
}
