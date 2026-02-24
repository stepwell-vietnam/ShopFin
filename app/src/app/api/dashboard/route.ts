/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/dashboard — Aggregated cross-shop data for dashboard
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const shops = await prisma.shop.findMany({
        where: { userId: session.user.id },
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

    // Compute real fees (platform fees + taxes) from rawData
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
                // Sum raw values first, then abs — matches Revenue Report's bucket approach
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

    // ============ Extract SKU data from order rawData ============
    interface SkuShopData {
        shopId: string;
        shopName: string;
        platform: string;
        orders: number;
        completed: number;
        cancelled: number;
        revenue: number;          // subtotalAfterDiscount or totalProductPrice
        settlement: number;
        fees: number;
        qty: number;
    }
    interface SkuAgg {
        sku: string;
        productName: string;
        shops: Record<string, SkuShopData>;
        totalOrders: number;
        totalCompleted: number;
        totalCancelled: number;
        totalRevenue: number;
        totalSettlement: number;
        totalFees: number;
        totalQty: number;
        cancelRate: number;
    }

    const skuMap: Record<string, SkuAgg> = {};

    for (const shop of shops) {
        const orderData = shop.monthlyData.filter(m => m.dataType === 'orders');
        const incomeData = shop.monthlyData.filter(m => m.dataType === 'income');

        // Build income map for this shop
        const incomeMap: Record<string, any> = {};
        for (const md of incomeData) {
            if (!md.rawData) continue;
            try {
                const parsed = JSON.parse(md.rawData as string);
                for (const o of (parsed.orders || [])) {
                    if (o.orderId) incomeMap[o.orderId] = o;
                }
            } catch { /* skip */ }
        }

        // Parse orders
        for (const md of orderData) {
            if (!md.rawData) continue;
            try {
                const parsed = JSON.parse(md.rawData as string);
                const orders = parsed.orders || [];
                for (const o of orders) {
                    // Extract SKU
                    let sku: string;
                    if (shop.platform === 'tiktok') {
                        const m = (o.sellerSku || '').match(/^([A-Za-z]+\d+)/);
                        sku = m ? m[1].toUpperCase() : (o.sellerSku || 'N/A');
                    } else {
                        sku = o.sku || 'N/A';
                    }

                    if (!skuMap[sku]) {
                        skuMap[sku] = {
                            sku,
                            productName: o.productName || '',
                            shops: {},
                            totalOrders: 0, totalCompleted: 0, totalCancelled: 0,
                            totalRevenue: 0, totalSettlement: 0, totalFees: 0, totalQty: 0,
                            cancelRate: 0,
                        };
                    }

                    if (!skuMap[sku].shops[shop.id]) {
                        skuMap[sku].shops[shop.id] = {
                            shopId: shop.id, shopName: shop.name, platform: shop.platform,
                            orders: 0, completed: 0, cancelled: 0, revenue: 0, settlement: 0, fees: 0, qty: 0,
                        };
                    }

                    const entry = skuMap[sku].shops[shop.id];

                    // Determine status
                    let isCompleted = false, isCancelled = false;
                    if (shop.platform === 'tiktok') {
                        isCompleted = ['Đã giao', 'Hoàn tất', 'Đã hoàn tất', 'Đã vận chuyển'].includes(o.substatus || o.status);
                        isCancelled = o.status === 'Đã hủy';
                    } else {
                        let status = o.status || '';
                        if (status.startsWith('Người mua xác nhận')) status = 'Đã nhận hàng';
                        isCompleted = ['Hoàn thành', 'Đã nhận hàng'].includes(status);
                        isCancelled = status === 'Đã hủy';
                    }

                    const qty = o.quantity || 1;
                    entry.orders++;

                    if (isCompleted) {
                        entry.completed++;
                        entry.qty += qty;
                        const rev = shop.platform === 'tiktok'
                            ? (o.subtotalAfterDiscount || 0)
                            : (o.totalProductPrice || 0);
                        entry.revenue += rev;

                        // Income data
                        const inc = incomeMap[o.orderId];
                        if (inc) {
                            entry.settlement += inc.totalSettlement || 0;
                            entry.fees += Math.abs(inc.totalFees || 0);
                        }
                    }
                    if (isCancelled) entry.cancelled++;
                }
            } catch { /* skip */ }
        }
    }

    // Aggregate totals for each SKU
    const skuStats = Object.values(skuMap).map(s => {
        const shopArr = Object.values(s.shops);
        s.totalOrders = shopArr.reduce((sum, sh) => sum + sh.orders, 0);
        s.totalCompleted = shopArr.reduce((sum, sh) => sum + sh.completed, 0);
        s.totalCancelled = shopArr.reduce((sum, sh) => sum + sh.cancelled, 0);
        s.totalRevenue = shopArr.reduce((sum, sh) => sum + sh.revenue, 0);
        s.totalSettlement = shopArr.reduce((sum, sh) => sum + sh.settlement, 0);
        s.totalFees = shopArr.reduce((sum, sh) => sum + sh.fees, 0);
        s.totalQty = shopArr.reduce((sum, sh) => sum + sh.qty, 0);
        s.cancelRate = s.totalOrders > 0 ? (s.totalCancelled / s.totalOrders) * 100 : 0;
        return {
            ...s,
            shops: shopArr,
        };
    }).sort((a, b) => b.totalRevenue - a.totalRevenue);

    // Build monthly aggregation per shop (existing code)
    const shopStats = shops.map(shop => {
        const incomeData = shop.monthlyData.filter(m => m.dataType === 'income');
        const orderData = shop.monthlyData.filter(m => m.dataType === 'orders');

        // Sum real fees from rawData
        const fees = incomeData.reduce((s, m) => s + computeRealFees(shop.platform, m.rawData as string | null), 0);

        return {
            id: shop.id,
            name: shop.name,
            platform: shop.platform,
            revenue: incomeData.reduce((s, m) => s + m.totalRevenue, 0),
            settlement: incomeData.reduce((s, m) => s + m.totalSettlement, 0),
            fees,
            orders: orderData.reduce((s, m) => s + m.totalOrders, 0),
            completed: orderData.reduce((s, m) => s + m.totalCompleted, 0),
            cancelled: orderData.reduce((s, m) => s + m.totalCancelled, 0),
            monthlyRevenue: incomeData.map(m => ({ month: m.month, revenue: m.totalRevenue, settlement: m.totalSettlement, fees: computeRealFees(shop.platform, m.rawData as string | null) })),
            monthlyOrders: orderData.map(m => ({ month: m.month, orders: m.totalOrders, completed: m.totalCompleted, cancelled: m.totalCancelled })),
        };
    });

    // Build monthly trend (all shops combined)
    const allMonths = new Set(shops.flatMap(s => s.monthlyData.map(m => m.month)));
    const monthlyTrend = Array.from(allMonths).sort().map(month => {
        const monthIncData = shops.flatMap(s => {
            const shop = s;
            return s.monthlyData.filter(m => m.month === month && m.dataType === 'income').map(m => ({
                ...m,
                platform: shop.platform,
            }));
        });
        const monthOrdData = shops.flatMap(s => s.monthlyData.filter(m => m.month === month && m.dataType === 'orders'));
        return {
            month,
            revenue: monthIncData.reduce((s, m) => s + m.totalRevenue, 0),
            orders: monthOrdData.reduce((s, m) => s + m.totalOrders, 0),
            fees: monthIncData.reduce((s, m) => s + computeRealFees(m.platform, m.rawData as string | null), 0),
        };
    });

    // Platform breakdown
    const platformStats = {
        shopee: {
            shops: shops.filter(s => s.platform === 'shopee').length,
            revenue: shopStats.filter(s => s.platform === 'shopee').reduce((sum, s) => sum + s.revenue, 0),
            orders: shopStats.filter(s => s.platform === 'shopee').reduce((sum, s) => sum + s.orders, 0),
        },
        tiktok: {
            shops: shops.filter(s => s.platform === 'tiktok').length,
            revenue: shopStats.filter(s => s.platform === 'tiktok').reduce((sum, s) => sum + s.revenue, 0),
            orders: shopStats.filter(s => s.platform === 'tiktok').reduce((sum, s) => sum + s.orders, 0),
        },
    };

    return NextResponse.json({
        shopStats,
        monthlyTrend,
        platformStats,
        totalShops: shops.length,
        totalMonths: allMonths.size,
        skuStats,
    });
}
