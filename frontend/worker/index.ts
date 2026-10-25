/**
 * Cloudflare Worker for the ProtoLIMS website.
 *
 * Static files (the React app) are served directly by Cloudflare. Requests to
 * /api/... are passed through to the ProtoLIMS API on Cloud Run, so the website
 * and the API share one address and no CORS set-up is needed.
 */

export const PROXY_KEY_HEADER = 'X-ProtoLIMS-Proxy-Key'

// PROXY_KEY is a Worker secret, so it isn't in the Env type generated from wrangler.jsonc.
interface WorkerEnv extends Env {
  PROXY_KEY?: string
}

export function isApiPath(pathname: string): boolean {
  return pathname === '/api' || pathname.startsWith('/api/')
}

export function proxyToApi(
  request: Request,
  apiOrigin: string,
  proxyKey?: string,
): Promise<Response> {
  const incoming = new URL(request.url)
  const target = new URL(incoming.pathname + incoming.search, apiOrigin)
  const proxied = new Request(target, request)
  proxied.headers.set('X-Forwarded-Host', incoming.host)
  proxied.headers.set('X-Forwarded-Proto', incoming.protocol.replace(':', ''))
  if (proxyKey) {
    proxied.headers.set(PROXY_KEY_HEADER, proxyKey)
  }
  return fetch(proxied)
}

export default {
  fetch(request, env) {
    const { pathname } = new URL(request.url)
    if (isApiPath(pathname)) {
      return proxyToApi(request, env.API_ORIGIN, env.PROXY_KEY)
    }
    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<WorkerEnv>
