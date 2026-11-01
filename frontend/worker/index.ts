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

// Security headers for the API's responses (its documentation page included). The website's
// own files get the same from public/_headers, as Cloudflare serves them without the Worker;
// the tests check the two match. The policy lets pages run only the site's own scripts.
export const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
}

// The response, with the security headers added.
export function withSecurityHeaders(response: Response): Response {
  const secured = new Response(response.body, response)
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    secured.headers.set(name, value)
  }
  return secured
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
  // Pass redirects (such as "sign in at ORCID") back to the browser, rather than following
  // them here.
  return fetch(proxied, { redirect: 'manual' })
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url)
    if (isApiPath(pathname)) {
      return withSecurityHeaders(await proxyToApi(request, env.API_ORIGIN, env.PROXY_KEY))
    }
    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<WorkerEnv>
