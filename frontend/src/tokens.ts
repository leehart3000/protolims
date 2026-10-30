import { api } from './api/client'
import type { components } from './api/schema'
import { refusal } from './forms'

export type NewToken = components['schemas']['ApiTokenCreate']

// How long a new token can last, in days (the API allows up to a year).
export const TOKEN_LIFETIMES = [
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '180', label: '180 days' },
  { value: '365', label: 'A year' },
]

// Make an API token. The reply holds the token itself, the only time it's ever shown.
export async function createToken(body: NewToken) {
  const { data, response } = await api.POST('/api/v1/auth/me/tokens', { body })
  if (data) {
    return data
  }
  throw refusal(response.status, 'Could not make the token. Please try again later.')
}

// Revoke an API token, so it can't be used again.
export async function revokeToken(tokenId: string) {
  const { response } = await api.DELETE('/api/v1/auth/me/tokens/{token_id}', {
    params: { path: { token_id: tokenId } },
  })
  if (!response.ok) {
    throw refusal(response.status, 'Could not revoke the token. Please try again later.')
  }
}
