// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

import headersFile from '../public/_headers?raw'
import worker, { isApiPath, PROXY_KEY_HEADER, SECURITY_HEADERS } from './index'

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

  it("adds the security headers to the API's responses, redirects included", async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(null, { status: 302, headers: { Location: 'https://orcid.org/x' } }),
        ),
      ),
    )
    const { env } = makeEnv()

    const response = await worker.fetch(new Request('https://protolims.org/api/v1/auth/x'), env)

    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe('https://orcid.org/x')
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      expect(response.headers.get(name)).toBe(value)
    }
  })
})

describe('public/_headers', () => {
  it("gives the website's own files the same security headers as the API's", () => {
    const lines = headersFile.split('\n').map((line) => line.trim())
    expect(lines).toContain('/*')
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      expect(lines).toContain(`${name}: ${value}`)
    }
  })

  it("lets pages run only the site's own scripts", () => {
    const policy = SECURITY_HEADERS['Content-Security-Policy']
    expect(policy).toContain("script-src 'self';")
    expect(policy).not.toMatch(/script-src[^;]*'unsafe-inline'/)
    expect(policy).toContain("frame-ancestors 'none'")
  })
})
