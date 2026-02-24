import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import * as fs from 'fs';
import * as path from 'path';

// POST /api/shops/[shopId]/upload — Upload monthly data
export async function POST(req: Request, { params }: { params: Promise<{ shopId: string }> }) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { shopId } = await params;

    // Verify shop ownership
    const shop = await prisma.shop.findFirst({
        where: { id: shopId, userId: session.user.id },
    });
    if (!shop) {
        return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
    }

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const dataType = formData.get('dataType') as string;
    const month = formData.get('month') as string;
    const rawData = formData.get('rawData') as string;
    const summaryStr = formData.get('summary') as string;

    if (!file || !dataType || !month) {
        return NextResponse.json({ error: 'file, dataType, and month are required' }, { status: 400 });
    }

    // Save original file
    const uploadDir = path.join(process.cwd(), 'uploads', session.user.id, shopId);
    fs.mkdirSync(uploadDir, { recursive: true });
    const fileName = `${month}_${dataType}_${file.name}`;
    const filePath = path.join(uploadDir, fileName);
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    // Parse summary metrics
    let summary = { totalOrders: 0, totalRevenue: 0, totalCompleted: 0, totalCancelled: 0, totalSettlement: 0, totalFees: 0 };
    try { summary = JSON.parse(summaryStr); } catch { /* use defaults */ }

    // Upsert monthly data (update if same shop+type+month exists)
    const data = await prisma.monthlyData.upsert({
        where: {
            shopId_dataType_month: { shopId, dataType, month },
        },
        create: {
            shopId,
            dataType,
            month,
            fileName: file.name,
            fileSize: file.size,
            filePath: filePath,
            rawData: rawData || null,
            ...summary,
        },
        update: {
            fileName: file.name,
            fileSize: file.size,
            filePath: filePath,
            rawData: rawData || null,
            ...summary,
            uploadedAt: new Date(),
        },
    });

    return NextResponse.json({ success: true, id: data.id }, { status: 201 });
}
