// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

import worker, { isApiPath, PROXY_KEY_HEADER } from './index'

const API_ORIGIN = 'https://api.example.run.app'

function makeEnv(secrets: Record<string, string> = {}) {
  const assetsFetch = vi.fn(() => Promise.resolve(new Response('app')))
  const env = { API_ORIGIN, ASSETS: { fetch: assetsFetch }, ...secrets } as unknown as Env
  return { env, assetsFetch }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('isApiPath', () => {
  it.each([
    ['/api', true],
    ['/api/v1/projects', true],
    ['/apis', false],
    ['/projects', false],
    ['/', false],
  ])('%s is an API path: %s', (path, expected) => {
    expect(isApiPath(path)).toBe(expected)
  })
})

describe('worker', () => {
  it('serves other requests from the static assets', async () => {
    const { env, assetsFetch } = makeEnv()

    const response = await worker.fetch(new Request('https://protolims.org/projects'), env)

    expect(await response.text()).toBe('app')
    expect(assetsFetch).toHaveBeenCalledOnce()
  })

  it('passes API requests to the API, with forwarding headers', async () => {
    const fetchMock = vi.fn<(request: Request, init?: RequestInit) => Promise<Response>>(() =>
      Promise.resolve(new Response('api')),
    )
    vi.stubGlobal('fetch', fetchMock)
    const { env, assetsFetch } = makeEnv()

    const response = await worker.fetch(
      new Request('https://protolims.org/api/v1/projects?limit=5', { method: 'DELETE' }),
      env,
    )

    expect(await response.text()).toBe('api')
    expect(assetsFetch).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledOnce()
    const sent = fetchMock.mock.calls[0][0]
    expect(sent.url).toBe(`${API_ORIGIN}/api/v1/projects?limit=5`)
    expect(sent.method).toBe('DELETE')
    expect(sent.headers.get('X-Forwarded-Host')).toBe('protolims.org')
    expect(sent.headers.get('X-Forwarded-Proto')).toBe('https')
    expect(sent.headers.get(PROXY_KEY_HEADER)).toBeNull()
    expect(fetchMock.mock.calls[0][1]?.redirect).toBe('manual')
  })

  it('adds the proxy key to API requests when one is set', async () => {
    const fetchMock = vi.fn<(request: Request) => Promise<Response>>(() =>
      Promise.resolve(new Response('api')),
    )
    vi.stubGlobal('fetch', fetchMock)
    const { env } = makeEnv({ PROXY_KEY: 'secret' })

    await worker.fetch(new Request('https://protolims.org/api/v1/projects'), env)

    expect(fetchMock.mock.calls[0][0].headers.get(PROXY_KEY_HEADER)).toBe('secret')
  })
})
