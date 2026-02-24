import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import * as fs from 'fs';
import * as path from 'path';

// POST /api/ads/upload — Upload TikTok Ads data
export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const platform = (formData.get('platform') as string) || 'tiktok';
    const month = formData.get('month') as string;
    const rawData = formData.get('rawData') as string;
    const summaryStr = formData.get('summary') as string;

    if (!file || !month) {
        return NextResponse.json({ error: 'file and month are required' }, { status: 400 });
    }

    // Save original file
    const uploadDir = path.join(process.cwd(), 'uploads', session.user.id, 'ads');
    fs.mkdirSync(uploadDir, { recursive: true });
    const fileName = `${month}_${platform}_ads_${file.name}`;
    const filePath = path.join(uploadDir, fileName);
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    // Parse summary
    let summary = { totalCost: 0, totalOrders: 0, totalRevenue: 0, totalCreatives: 0, totalCampaigns: 0 };
    try { summary = JSON.parse(summaryStr); } catch { /* use defaults */ }

    // Upsert ads data
    const data = await prisma.adsData.upsert({
        where: {
            userId_platform_month: {
                userId: session.user.id,
                platform,
                month,
            },
        },
        create: {
            userId: session.user.id,
            platform,
            month,
            fileName: file.name,
            fileSize: file.size,
            rawData: rawData || null,
            ...summary,
        },
        update: {
            fileName: file.name,
            fileSize: file.size,
            rawData: rawData || null,
            ...summary,
            uploadedAt: new Date(),
        },
    });

    return NextResponse.json({ success: true, id: data.id }, { status: 201 });
}
