/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/admin';

// GET /api/admin/dashboard — Aggregate dashboard across all users
export async function GET() {
    const session = await auth();
    if (!isAdmin(session)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get all users with their shops and data
    const users = await prisma.user.findMany({
        select: {
            id: true,
            name: true,
            email: true,
            image: true,
            shops: {
                select: {
                    id: true,
                    name: true,
                    platform: true,
                    monthlyData: {
                        where: { dataType: 'income' },
                        select: {
                            month: true,
                            totalRevenue: true,
                            totalSettlement: true,
                            totalOrders: true,
                            totalFees: true,
                            rawData: true,
                        },
                    },
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

    // Aggregate stats per user
    const userStats = users.map(user => {
        const allMd = user.shops.flatMap(s => s.monthlyData);
        const totalRevenue = allMd.reduce((sum, md) => sum + md.totalRevenue, 0);
        const totalSettlement = allMd.reduce((sum, md) => sum + md.totalSettlement, 0);
        const totalOrders = allMd.reduce((sum, md) => sum + md.totalOrders, 0);
        const totalFees = user.shops.reduce((sum, shop) =>
            sum + shop.monthlyData.reduce((s, md) => s + computeRealFees(shop.platform, md.rawData as string | null), 0), 0);

        return {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
            shopCount: user.shops.length,
            platforms: [...new Set(user.shops.map(s => s.platform))],
            totalRevenue,
            totalSettlement,
            totalOrders,
            totalFees,
        };
    });

    // System-wide totals
    const totalUsers = users.length;
    const totalShops = users.reduce((sum, u) => sum + u.shops.length, 0);
    const totalRevenue = userStats.reduce((sum, u) => sum + u.totalRevenue, 0);
    const totalSettlement = userStats.reduce((sum, u) => sum + u.totalSettlement, 0);
    const totalFees = userStats.reduce((sum, u) => sum + u.totalFees, 0);
    const totalOrders = userStats.reduce((sum, u) => sum + u.totalOrders, 0);

    // Platform breakdown
    const allShops = users.flatMap(u => u.shops);
    const platforms = [...new Set(allShops.map(s => s.platform))];
    const platformStats = platforms.map(platform => {
        const pShops = allShops.filter(s => s.platform === platform);
        const pMd = pShops.flatMap(s => s.monthlyData);
        return {
            platform,
            shopCount: pShops.length,
            revenue: pMd.reduce((s, md) => s + md.totalRevenue, 0),
            orders: pMd.reduce((s, md) => s + md.totalOrders, 0),
        };
    });

    // Monthly trend (system-wide)
    const allMonths = new Set(allShops.flatMap(s => s.monthlyData.map(md => md.month)));
    const monthlyTrend = Array.from(allMonths).sort().map(month => {
        const monthData = allShops.flatMap(s =>
            s.monthlyData.filter(md => md.month === month).map(md => ({ ...md, platform: s.platform }))
        );
        return {
            month,
            revenue: monthData.reduce((s, md) => s + md.totalRevenue, 0),
            settlement: monthData.reduce((s, md) => s + md.totalSettlement, 0),
            fees: monthData.reduce((s, md) => s + computeRealFees(md.platform, md.rawData as string | null), 0),
            orders: monthData.reduce((s, md) => s + md.totalOrders, 0),
        };
    });

    return NextResponse.json({
        totals: { totalUsers, totalShops, totalRevenue, totalSettlement, totalFees, totalOrders },
        userStats: userStats.sort((a, b) => b.totalRevenue - a.totalRevenue),
        platformStats,
        monthlyTrend,
    });
}
