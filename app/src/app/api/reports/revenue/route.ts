import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/reports/revenue — Aggregate daily income data across all shops.
 * Query params:
 *   platform: 'all' | 'shopee' | 'tiktok' (default: 'all')
 *   shopId:   filter to specific shop (optional)
 *
 * Returns unified DailyIncome[] merged from:
 *   - Shopee income rawData.dailyIncome (already aggregated by date)
 *   - TikTok income rawData.orders (aggregated by orderSettledTime)
 */
export async function GET(req: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const platform = url.searchParams.get('platform') || 'all';
    const shopId = url.searchParams.get('shopId');

    // Fetch shops + their income rawData
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { userId: session.user.id };
    if (platform !== 'all') where.platform = platform;
    if (shopId) where.id = shopId;

    const shops = await prisma.shop.findMany({
        where,
        include: {
            monthlyData: {
                where: {
                    dataType: 'income',
                    rawData: { not: null },
                    ...(shopId ? { shopId } : {}),
                },
                select: { id: true, month: true, rawData: true, shopId: true, totalRevenue: true, totalFees: true, totalSettlement: true, totalOrders: true },
            },
        },
    });

    // Unified daily bucket: date → aggregated values
    type DailyBucket = {
        date: string;
        orderCount: number;
        productPrice: number;
        totalPayment: number;
        totalFees: number;
        totalTax: number;
        fixedFee: number;
        serviceFee: number;
        paymentFee: number;
        affiliateFee: number;
        refund: number;
    };
    const buckets: Record<string, DailyBucket> = {};

    function addToBucket(date: string, data: Partial<DailyBucket>) {
        if (!date) return;
        // Normalize date to YYYY-MM-DD (TikTok uses slashes: 2026/01/31)
        const dateKey = date.substring(0, 10).replace(/\//g, '-');
        if (!buckets[dateKey]) {
            buckets[dateKey] = {
                date: dateKey,
                orderCount: 0,
                productPrice: 0,
                totalPayment: 0,
                totalFees: 0,
                totalTax: 0,
                fixedFee: 0,
                serviceFee: 0,
                paymentFee: 0,
                affiliateFee: 0,
                refund: 0,
            };
        }
        const b = buckets[dateKey];
        b.orderCount += data.orderCount || 0;
        b.productPrice += data.productPrice || 0;
        b.totalPayment += data.totalPayment || 0;
        b.totalFees += data.totalFees || 0;
        b.totalTax += data.totalTax || 0;
        b.fixedFee += data.fixedFee || 0;
        b.serviceFee += data.serviceFee || 0;
        b.paymentFee += data.paymentFee || 0;
        b.affiliateFee += data.affiliateFee || 0;
        b.refund += data.refund || 0;
    }

    // Shop metadata for response
    const shopMeta = shops.map((s: { id: string; name: string; platform: string }) => ({ id: s.id, name: s.name, platform: s.platform }));

    for (const shop of shops) {
        for (const md of shop.monthlyData) {
            if (!md.rawData) continue;
            try {
                const raw = JSON.parse(md.rawData as string);

                if (shop.platform === 'shopee') {
                    // Shopee: use dailyIncome[] array (already has all fields)
                    const dailyIncome = raw.dailyIncome || [];
                    for (const d of dailyIncome) {
                        addToBucket(d.date, {
                            orderCount: d.orderCount || 0,
                            // Use netProductRevenue (after refunds) to match Dashboard's "Tổng doanh thu"
                            productPrice: d.netProductRevenue ?? d.productPrice ?? 0,
                            totalPayment: d.totalPayment || 0,
                            totalFees: d.totalFees || 0,
                            totalTax: d.totalTax || 0,
                            fixedFee: d.fixedFee || 0,
                            serviceFee: d.serviceFee || 0,
                            paymentFee: d.paymentFee || 0,
                            affiliateFee: d.affiliateFee || 0,
                            refund: d.refund || 0,
                        });
                    }
                } else if (shop.platform === 'tiktok') {
                    // TikTok: aggregate orders[] by orderSettledTime
                    const orders = raw.orders || [];
                    for (const o of orders) {
                        if (o.type !== 'Order') continue;
                        const dateStr = o.orderSettledTime || o.orderCreatedTime || '';
                        if (!dateStr) continue;
                        addToBucket(dateStr, {
                            orderCount: 1,
                            productPrice: o.totalRevenue || 0,
                            totalPayment: o.totalSettlement || 0,
                            totalFees: o.totalFees || 0,
                            totalTax: Math.abs(o.vatWithheld || 0) + Math.abs(o.pitWithheld || 0),
                            fixedFee: o.commissionFee || 0,
                            serviceFee: o.transactionFee || 0,
                            paymentFee: 0,
                            affiliateFee: (o.affiliateCommission || 0) + (o.affiliateShopAds || 0),
                            refund: o.refundAfterDiscount || 0,
                        });
                    }
                }
            } catch (e) {
                console.error(`Failed to parse rawData for md.id=${md.id}:`, e);
            }
        }
    }

    const dailyData = Object.values(buckets).sort((a, b) => a.date.localeCompare(b.date));

    // Aggregate monthly summary from DB records (matches Dashboard exactly)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allMd = shops.flatMap((s: any) => s.monthlyData) as Array<{ totalRevenue: number; totalFees: number; totalSettlement: number; totalOrders: number }>;
    const monthlySummary = {
        totalRevenue: allMd.reduce((sum: number, md) => sum + md.totalRevenue, 0),
        // Tổng phí = phí sàn + thuế (computed from rawData daily buckets)
        totalFeesAndTax: dailyData.reduce((sum: number, d) => sum + Math.abs(d.totalFees) + Math.abs(d.totalTax), 0),
        totalSettlement: allMd.reduce((sum: number, md) => sum + md.totalSettlement, 0),
        totalOrders: allMd.reduce((sum: number, md) => sum + md.totalOrders, 0),
    };

    return NextResponse.json({
        dailyData,
        shops: shopMeta,
        totalDays: dailyData.length,
        monthlySummary,
    });
}
