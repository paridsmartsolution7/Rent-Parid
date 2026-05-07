import { NextResponse } from 'next/server';

// Build-time value stamped by next.config.ts (env.NEXT_PUBLIC_BUILD_VERSION).
// Falls back to a boot timestamp if the env var is absent (e.g. running this
// route outside a Next build). Stable across server instances of the same
// deploy; changes on every rebuild — which is the trigger VersionGuard uses
// to force-reload all open clients onto the latest build.
const VERSION = process.env.NEXT_PUBLIC_BUILD_VERSION || String(Date.now());

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    { version: VERSION },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        Pragma: 'no-cache',
      },
    },
  );
}
