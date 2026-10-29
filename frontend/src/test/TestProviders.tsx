import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { MemoryRouter } from 'react-router'

import type { components } from '../api/schema'
import { siteAdmin } from './people'

type Me = components['schemas']['Me']

// `me` is who is signed in: a site administrator unless a test says otherwise. With 'fetch',
// it's fetched from the (stubbed) API instead, for tests of signing in and out.
export function TestProviders({
  children,
  route = '/',
  me = siteAdmin,
}: {
  children: ReactNode
  route?: string
  me?: Me | 'fetch'
}) {
  const [queryClient] = useState(() => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    if (me !== 'fetch') {
      client.setQueryDefaults(['me'], { staleTime: Infinity })
      client.setQueryData(['me'], me)
    }
    return client
  })

  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}
