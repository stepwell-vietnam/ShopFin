import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/ads/report — Get all ads data for current user (from AdsData + MonthlyData)
export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1) Fetch from AdsData (direct uploads to /ads/tiktok)
        const adsRecords = await prisma.adsData.findMany({
            where: { userId: session.user.id },
            orderBy: { month: 'desc' },
            select: {
                id: true,
                platform: true,
                month: true,
                fileName: true,
                fileSize: true,
                totalCost: true,
                totalOrders: true,
                totalRevenue: true,
                totalCreatives: true,
                totalCampaigns: true,
                rawData: true,
                uploadedAt: true,
            },
        });

        // 2) Fetch from MonthlyData (uploads from shop detail page)
        const shopAdsRecords = await prisma.monthlyData.findMany({
            where: {
                dataType: 'ads',
                shop: { userId: session.user.id },
            },
            orderBy: { month: 'desc' },
            select: {
                id: true,
                month: true,
                fileName: true,
                fileSize: true,
                totalOrders: true,
                totalRevenue: true,
                totalSettlement: true, // re-used for totalCost
                rawData: true,
                uploadedAt: true,
            },
        });

        // 3) Merge — normalize shop records to same format
        const normalizedShopAds = shopAdsRecords.map(r => ({
            id: r.id,
            platform: 'tiktok',
            month: r.month,
            fileName: r.fileName,
            fileSize: r.fileSize,
            totalCost: r.totalSettlement,
            totalOrders: r.totalOrders,
            totalRevenue: r.totalRevenue,
            totalCreatives: 0,
            totalCampaigns: 0,
            rawData: r.rawData,
            uploadedAt: r.uploadedAt,
            source: 'shop',
        }));

        const allRecords = [
            ...adsRecords.map(r => ({ ...r, source: 'direct' })),
            ...normalizedShopAds,
        ];

        return NextResponse.json(allRecords);
    } catch (error: any) {
        console.error('[ads/report] ERROR:', error?.message || error);
        return NextResponse.json({ error: 'Internal server error', details: error?.message }, { status: 500 });
    }
}


