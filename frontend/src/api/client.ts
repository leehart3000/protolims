import createClient from 'openapi-fetch'

import type { paths } from './schema'

export const api = createClient<paths>({
  baseUrl: window.location.origin,
  // Look up fetch on every request (not once at start-up) so tests can replace it.
  fetch: (request) => fetch(request),
})
