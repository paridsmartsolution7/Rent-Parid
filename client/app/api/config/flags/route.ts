import { NextResponse } from 'next/server';
import { getArticleBlocks, getConfigFlags } from '../../../lib/getConfigFlags';

/**
 * Public read-only endpoint used by the shop frontend to:
 *   - apply primary/secondary color in real time
 *   - hide the comment / review form when the global flag or the per-article
 *     override is set
 *   - show the "Komentet/Vleresimet per kete artikull jane te bllokuara"
 *     message in the right place
 *
 *   GET /api/config/flags                 -> global flags
 *   GET /api/config/flags?productId=123   -> global flags + per-article blocks
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const productIdRaw = searchParams.get('productId');
    const productId = productIdRaw ? parseInt(productIdRaw, 10) : NaN;

    const flags = await getConfigFlags();
    let article: { comments_blocked: boolean; reviews_blocked: boolean } | null = null;
    if (Number.isFinite(productId) && productId > 0) {
      article = await getArticleBlocks(productId);
    }

    return NextResponse.json({
      success: true,
      flags,
      article,
      messages: {
        comments_blocked: 'Komentet per kete artikull jane te bllokuara',
        reviews_blocked: 'Vleresimet per kete artikull jane te bllokuara',
      },
    });
  } catch (error: any) {
    console.error('Error reading flags:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed' },
      { status: 500 }
    );
  }
}
