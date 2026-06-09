import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { TokenBundle } from '@/models';
import { requireAO } from '@/lib/server/aoGuard';

// GET /api/token-bundles — active bundles for the AO dashboard (AO-only).
export async function GET() {
  const session = await requireAO();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
  }
  try {
    await connectDB();
    const bundles = await TokenBundle.find({ isActive: true })
      .sort({ displayOrder: 1, createdAt: 1 })
      .lean();
    return NextResponse.json({
      ok: true,
      bundles: bundles.map((b) => ({
        id: b._id.toString(),
        name: b.name,
        tokenQuantity: b.tokenQuantity,
        priceInPaise: b.priceInPaise,
        description: b.description || '',
      })),
    });
  } catch (err) {
    console.error('[token-bundles] error:', err);
    return NextResponse.json({ ok: false, error: 'Could not load token bundles.' }, { status: 500 });
  }
}
