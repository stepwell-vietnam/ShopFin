import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/shops/[shopId] — Get single shop detail
export async function GET(_req: Request, { params }: { params: Promise<{ shopId: string }> }) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { shopId } = await params;
    const shop = await prisma.shop.findFirst({
        where: { id: shopId, userId: session.user.id },
        include: {
            monthlyData: {
                orderBy: { month: 'desc' },
            },
        },
    });

    if (!shop) {
        return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
    }

    return NextResponse.json(shop);
}

// PUT /api/shops/[shopId] — Update shop
export async function PUT(req: Request, { params }: { params: Promise<{ shopId: string }> }) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { shopId } = await params;
    const body = await req.json();
    const { name, description } = body;

    const shop = await prisma.shop.updateMany({
        where: { id: shopId, userId: session.user.id },
        data: { name, description },
    });

    if (shop.count === 0) {
        return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
}

// DELETE /api/shops/[shopId] — Delete shop and all its data
export async function DELETE(_req: Request, { params }: { params: Promise<{ shopId: string }> }) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { shopId } = await params;
    const deleted = await prisma.shop.deleteMany({
        where: { id: shopId, userId: session.user.id },
    });

    if (deleted.count === 0) {
        return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
}
