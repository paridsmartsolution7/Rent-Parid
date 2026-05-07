import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ALLOWED_HEADERS = 'Content-Type, Authorization, X-Admin-Key';
const ALLOWED_METHODS = 'GET, POST, PUT, DELETE, OPTIONS';

/**
 * Comma-separated origin list from env, e.g.
 *   ADMIN_ORIGIN_ALLOWLIST=http://localhost:3000,https://admin.pss.al
 *
 * Special values:
 *   - empty / unset  -> defaults to '*' (any origin allowed). Convenient for
 *                       getting started; tighten before opening the API to the
 *                       internet without the X-Admin-Key as the only barrier.
 *   - '*'            -> echo any incoming Origin.
 */
function getAllowedOrigins(): string[] {
  const raw = (process.env.ADMIN_ORIGIN_ALLOWLIST ?? '').trim();
  if (!raw) return ['*'];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function pickAllowedOrigin(origin: string | null): string | null {
  const allowed = getAllowedOrigins();
  if (allowed.includes('*')) return origin || '*';
  if (!origin) return null;
  return allowed.includes(origin) ? origin : null;
}

function applyCors(res: NextResponse, allowOrigin: string | null) {
  // Always advertise the preflight metadata so the browser can cache it,
  // even when we end up rejecting the origin (so the failure mode is a
  // visible 4xx on the actual request rather than a confusing CORS block).
  res.headers.set('Access-Control-Allow-Methods', ALLOWED_METHODS);
  res.headers.set('Access-Control-Allow-Headers', ALLOWED_HEADERS);
  res.headers.set('Access-Control-Max-Age', '86400');
  res.headers.append('Vary', 'Origin');
  if (allowOrigin) {
    res.headers.set('Access-Control-Allow-Origin', allowOrigin);
  }
  return res;
}

export function proxy(request: NextRequest) {
  const origin = request.headers.get('origin');
  const allowOrigin = pickAllowedOrigin(origin);

  if (request.method === 'OPTIONS') {
    return applyCors(new NextResponse(null, { status: 204 }), allowOrigin);
  }

  return applyCors(NextResponse.next(), allowOrigin);
}

export const config = {
  matcher: '/api/:path*',
};
