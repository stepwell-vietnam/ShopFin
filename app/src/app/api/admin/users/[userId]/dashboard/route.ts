/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/admin';

// GET /api/admin/users/[userId]/dashboard — Dashboard data for a specific user
export async function GET(
    _request: Request,
    { params }: { params: Promise<{ userId: string }> }
) {
    const session = await auth();
    if (!isAdmin(session)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { userId } = await params;

    // Get user info
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, image: true },
    });
    if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Reuse same logic as /api/dashboard but for the target user
    const shops = await prisma.shop.findMany({
        where: { userId },
        include: {
            monthlyData: {
                orderBy: { month: 'desc' },
                select: {
                    id: true,
                    dataType: true,
                    month: true,
                    totalOrders: true,
                    totalRevenue: true,
                    totalCompleted: true,
                    totalCancelled: true,
                    totalSettlement: true,
                    totalFees: true,
                    rawData: true,
                    uploadedAt: true,
                },
            },
        },
    });

    // Compute real fees from rawData
    function computeRealFees(platform: string, rawDataStr: string | null): number {
        if (!rawDataStr) return 0;
        try {
            const raw = JSON.parse(rawDataStr);
            if (platform === 'shopee') {
                const dailyIncome = raw.dailyIncome || [];
                return dailyIncome.reduce((sum: number, d: { totalFees?: number; totalTax?: number }) =>
                    sum + Math.abs(d.totalFees || 0) + Math.abs(d.totalTax || 0), 0);
            } else if (platform === 'tiktok') {
                const orders = raw.orders || [];
                let rawFees = 0, rawTax = 0;
                for (const o of orders) {
                    if (o.type !== 'Order') continue;
                    rawFees += o.totalFees || 0;
                    rawTax += (o.vatWithheld || 0) + (o.pitWithheld || 0);
                }
                return Math.abs(rawFees) + Math.abs(rawTax);
            }
        } catch { /* ignore */ }
        return 0;
    }

    const shopStats = shops.map(shop => {
        const incomeData = shop.monthlyData.filter((m: any) => m.dataType === 'income');
        const orderData = shop.monthlyData.filter((m: any) => m.dataType === 'orders');
        const fees = incomeData.reduce((s: number, m: any) => s + computeRealFees(shop.platform, m.rawData as string | null), 0);

        return {
            id: shop.id,
            name: shop.name,
            platform: shop.platform,
            revenue: incomeData.reduce((s: number, m: any) => s + m.totalRevenue, 0),
            settlement: incomeData.reduce((s: number, m: any) => s + m.totalSettlement, 0),
            fees,
            orders: orderData.reduce((s: number, m: any) => s + m.totalOrders, 0),
            completed: orderData.reduce((s: number, m: any) => s + m.totalCompleted, 0),
            cancelled: orderData.reduce((s: number, m: any) => s + m.totalCancelled, 0),
            monthlyRevenue: incomeData.map((m: any) => ({ month: m.month, revenue: m.totalRevenue, settlement: m.totalSettlement, fees: computeRealFees(shop.platform, m.rawData as string | null) })),
            monthlyOrders: orderData.map((m: any) => ({ month: m.month, orders: m.totalOrders, completed: m.totalCompleted, cancelled: m.totalCancelled })),
        };
    });

    // Monthly trend
    const allMonths = new Set(shops.flatMap((s: any) => s.monthlyData.map((m: any) => m.month)));
    const monthlyTrend = Array.from(allMonths).sort().map(month => {
        const monthIncData = shops.flatMap((s: any) =>
            s.monthlyData.filter((m: any) => m.month === month && m.dataType === 'income').map((m: any) => ({
                ...m, platform: s.platform,
            }))
        );
        const monthOrdData = shops.flatMap((s: any) =>
            s.monthlyData.filter((m: any) => m.month === month && m.dataType === 'orders')
        );
        return {
            month,
            revenue: monthIncData.reduce((s: number, m: any) => s + m.totalRevenue, 0),
            settlement: monthIncData.reduce((s: number, m: any) => s + m.totalSettlement, 0),
            fees: monthIncData.reduce((s: number, m: any) => {
                const shop = shops.find((sh: any) => sh.monthlyData.some((md: any) => md.id === m.id));
                return s + computeRealFees(shop?.platform || '', m.rawData as string | null);
            }, 0),
            orders: monthOrdData.reduce((s: number, m: any) => s + m.totalOrders, 0),
        };
    });

    // Platform stats
    const platforms = [...new Set(shops.map((s: any) => s.platform))];
    const platformStats = platforms.map(platform => {
        const pShops = shopStats.filter((s: any) => s.platform === platform);
        return {
            platform,
            revenue: pShops.reduce((s: number, sh: any) => s + sh.revenue, 0),
            orders: pShops.reduce((s: number, sh: any) => s + sh.orders, 0),
            shopCount: pShops.length,
        };
    });

    return NextResponse.json({
        user,
        shopStats,
        monthlyTrend,
        platformStats,
        totalShops: shops.length,
    });
}
