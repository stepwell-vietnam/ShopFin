/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/admin';

// GET /api/admin/users — List all users with summary stats
export async function GET() {
    const session = await auth();
    if (!isAdmin(session)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const users = await prisma.user.findMany({
        select: {
            id: true,
            name: true,
            email: true,
            image: true,
            createdAt: true,
            shops: {
                select: {
                    id: true,
                    name: true,
                    platform: true,
                    monthlyData: {
                        select: {
                            dataType: true,
                            totalRevenue: true,
                            totalSettlement: true,
                            totalOrders: true,
                            totalFees: true,
                        },
                    },
                },
            },
        },
        orderBy: { createdAt: 'desc' },
    });

    const result = users.map((user: any) => {
        const allIncomeData = user.shops.flatMap((shop: any) =>
            shop.monthlyData.filter((md: any) => md.dataType === 'income'));
        const allOrdersData = user.shops.flatMap((shop: any) =>
            shop.monthlyData.filter((md: any) => md.dataType === 'orders'));

        return {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
            createdAt: user.createdAt,
            shopCount: user.shops.length,
            platforms: [...new Set(user.shops.map((s: any) => s.platform))],
            totalRevenue: allIncomeData.reduce((s: number, md: any) => s + md.totalRevenue, 0),
            totalSettlement: allIncomeData.reduce((s: number, md: any) => s + md.totalSettlement, 0),
            totalFees: allIncomeData.reduce((s: number, md: any) => s + md.totalFees, 0),
            totalOrders: allOrdersData.reduce((s: number, md: any) => s + md.totalOrders, 0),
        };
    });

    return NextResponse.json({ users: result });
}
