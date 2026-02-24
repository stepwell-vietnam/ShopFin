import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/shops — List all shops for current user
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const shops = await prisma.shop.findMany({
        where: { userId: session.user.id },
        include: {
            monthlyData: {
                select: { month: true, dataType: true, totalRevenue: true, totalOrders: true, uploadedAt: true },
                orderBy: { month: 'desc' },
            },
        },
        orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(shops);
}

// POST /api/shops — Create a new shop
export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, platform, description } = body;

    if (!name || !platform) {
        return NextResponse.json({ error: 'name and platform are required' }, { status: 400 });
    }

    if (!['shopee', 'tiktok'].includes(platform)) {
        return NextResponse.json({ error: 'platform must be shopee or tiktok' }, { status: 400 });
    }

    // Check shop limit (10 per user)
    const shopCount = await prisma.shop.count({ where: { userId: session.user.id } });
    if (shopCount >= 10) {
        return NextResponse.json({ error: 'Đã đạt giới hạn 10 gian hàng' }, { status: 403 });
    }

    const shop = await prisma.shop.create({
        data: {
            userId: session.user.id,
            name,
            platform,
            description: description || null,
        },
    });

    return NextResponse.json(shop, { status: 201 });
}
