import { NextResponse } from 'next/server';
import { isAdminRequest } from '../../../lib/getAdminAuth';

/**
 * Identity endpoint — returns which project + domain this Next.js process
 * is bound to, plus the configured admin key. Useful for the cross-shop
 * admin panel to discover which key to send to which shop.
 *
 * GET /api/admin/project-info
 *   headers: X-Admin-Key: <ADMIN_API_KEY>
 *   200: { success: true, project, domain, admin_key }
 *   401: { success: false, message: 'Unauthorized' }
 *
 * Auth: still gated by isAdminRequest(). Echoing the key back is a no-op
 * security-wise (caller must already know it to call this), but it lets the
 * panel confirm at runtime that the key it sent matches what the server
 * has — handy when keys get rotated.
 */
const PROJECT = 'Eccomerce-Parid';
const DOMAIN = 'shop.pss.al';

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json(
      { success: false, message: 'Unauthorized' },
      { status: 401 }
    );
  }

  return NextResponse.json({
    success: true,
    project: PROJECT,
    domain: DOMAIN,
    admin_key: process.env.ADMIN_API_KEY ?? null,
  });
}
