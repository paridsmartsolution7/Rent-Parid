/**
 * Validates that an incoming request carries the static admin API key.
 * Used by /api/admin/* routes that must be callable from the Parid-V2 admin
 * panel (cross-origin) but never from the public shop.
 */
export function isAdminRequest(req: Request): boolean {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected) return false;
  const got = req.headers.get('x-admin-key');
  return !!got && got === expected;
}
