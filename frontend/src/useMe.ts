import { useQuery } from '@tanstack/react-query'

import { fetchMe } from './api/queries'

// Who is signed in on this browser (user is null if nobody), and what this server allows.
// Pages that show or hide things by who's signed in share this one request.
export function useMe() {
  return useQuery({ queryKey: ['me'], queryFn: fetchMe })
}
