import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import * as fs from 'fs';

// DELETE /api/shops/[shopId]/data/[dataId] — Delete a specific monthly data record
export async function DELETE(
    _req: Request,
    { params }: { params: Promise<{ shopId: string; dataId: string }> }
) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { shopId, dataId } = await params;

    // Verify shop ownership
    const shop = await prisma.shop.findFirst({
        where: { id: shopId, userId: session.user.id },
    });
    if (!shop) {
        return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
    }

    // Find and delete the data record
    const data = await prisma.monthlyData.findFirst({
        where: { id: dataId, shopId },
    });
    if (!data) {
        return NextResponse.json({ error: 'Data not found' }, { status: 404 });
    }

    // Delete the file from disk if it exists
    if (data.filePath) {
        try { fs.unlinkSync(data.filePath); } catch { /* file may not exist */ }
    }

    await prisma.monthlyData.delete({ where: { id: dataId } });

    return NextResponse.json({ success: true });
}
