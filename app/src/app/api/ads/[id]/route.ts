import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// DELETE /api/ads/[id] — Delete ads data record
export async function DELETE(
    _req: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Verify ownership
    const record = await prisma.adsData.findFirst({
        where: { id, userId: session.user.id },
    });
    if (!record) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await prisma.adsData.delete({ where: { id } });

    return NextResponse.json({ success: true });
}
