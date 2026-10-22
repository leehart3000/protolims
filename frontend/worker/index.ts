/**
 * Cloudflare Worker for the ProtoLIMS website.
 *
 * Static files (the React app) are served directly by Cloudflare. Requests to
 * /api/... are passed through to the ProtoLIMS API on Cloud Run, so the website
 * and the API share one address and no CORS set-up is needed.
 */

export function isApiPath(pathname: string): boolean {
  return pathname === '/api' || pathname.startsWith('/api/')
}

export function proxyToApi(request: Request, apiOrigin: string): Promise<Response> {
  const incoming = new URL(request.url)
  const target = new URL(incoming.pathname + incoming.search, apiOrigin)
  const proxied = new Request(target, request)
  proxied.headers.set('X-Forwarded-Host', incoming.host)
  proxied.headers.set('X-Forwarded-Proto', incoming.protocol.replace(':', ''))
  return fetch(proxied)
}

export default {
  fetch(request, env) {
    const { pathname } = new URL(request.url)
    if (isApiPath(pathname)) {
      return proxyToApi(request, env.API_ORIGIN)
    }
    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
