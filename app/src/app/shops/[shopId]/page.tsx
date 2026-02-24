'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
    Upload,
    FileSpreadsheet,
    ArrowLeft,
    Calendar,
    Loader2,
    Trash2,
    CheckCircle,
    AlertTriangle,
    TrendingUp,
    ShoppingCart,
    Settings,
    Zap,
    ExternalLink,
    Package,
} from 'lucide-react';

// Parsers
import { parseIncomeExcel, type ProgressCallback } from '@/lib/parsers/income-parser';
import { parseOrderExcel } from '@/lib/parsers/order-parser';
import { parseTikTokIncomeExcel, type TikTokIncomeResult } from '@/lib/parsers/tiktok-income-parser';
import { parseTikTokOrderExcel, type TikTokOrderParseResult } from '@/lib/parsers/tiktok-order-parser';
import { parseTikTokAdsExcel, type TikTokAdsResult } from '@/lib/parsers/tiktok-ads-parser';

// Utils
import { type DailyData, type TimeViewMode, type TimePreset, getDateRange, aggregateByMode } from '@/lib/reports/revenue-utils';

// Store
import { useDataStore } from '@/store/useDataStore';

// Components
import RevenueTab from './_components/RevenueTab';
import OrdersTab from './_components/OrdersTab';
import ProductsTab from './_components/ProductsTab';

interface MonthlyDataItem {
    id: string;
    dataType: string;
    month: string;
    fileName: string | null;
    fileSize: number | null;
    totalOrders: number;
    totalRevenue: number;
    totalCompleted: number;
    totalCancelled: number;
    totalSettlement: number;
    totalFees: number;
    rawData?: string;
    uploadedAt: string;
}

interface ShopDetail {
    id: string;
    name: string;
    platform: string;
    description: string | null;
    monthlyData: MonthlyDataItem[];
}

type ShopTabId = 'manage' | 'revenue' | 'orders' | 'products';
type UploadType = 'income' | 'orders' | 'ads';

// Compute summary metrics from parsed result
function computeSummary(
    dataType: string,
    platform: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parsed: any
): { totalOrders: number; totalRevenue: number; totalCompleted: number; totalCancelled: number; totalSettlement: number; totalFees: number } {
    try {
        if (platform === 'shopee' && dataType === 'income') {
            const r = parsed as any; // IncomeParseResult;
            return {
                totalOrders: r.orders?.length || 0,
                totalRevenue: r.summary?.totalRevenue || 0,
                totalCompleted: r.orders?.length || 0,
                totalCancelled: 0,
                totalSettlement: r.summary?.netRevenue || 0,
                totalFees: Math.abs(r.summary?.totalFees || 0),
            };
        }
        if (platform === 'shopee' && dataType === 'orders') {
            const r = parsed as any; // OrderParseResult;
            const orders = r.orders || [];
            const completed = orders.filter((o: any) => ['Hoàn thành', 'Đã nhận hàng'].includes(o.status)).length;
            const cancelled = orders.filter((o: any) => (o.status || '').includes('hủy') || (o.status || '').includes('Hủy')).length;
            const totalRev = orders.reduce((s: number, o: any) => s + (o.totalOrderValue || 0), 0);
            return {
                totalOrders: r.totalRows || orders.length,
                totalRevenue: totalRev,
                totalCompleted: completed,
                totalCancelled: cancelled,
                totalSettlement: 0,
                totalFees: orders.reduce((s: number, o: any) => s + Math.abs(o.fixedFee || 0) + Math.abs(o.serviceFee || 0) + Math.abs(o.paymentFee || 0), 0),
            };
        }
        if (platform === 'tiktok' && dataType === 'income') {
            const r = parsed as TikTokIncomeResult;
            return {
                totalOrders: r.orders?.length || 0,
                totalRevenue: r.summary?.totalRevenue || 0,
                totalCompleted: r.orders?.length || 0,
                totalCancelled: 0,
                totalSettlement: r.summary?.totalSettlement || 0,
                totalFees: Math.abs(r.summary?.totalFees || 0),
            };
        }
        if (platform === 'tiktok' && dataType === 'orders') {
            const r = parsed as TikTokOrderParseResult;
            const orders = r.orders || [];
            const completed = orders.filter(o => (o.status || '').includes('Hoàn thành') || (o.status || '').includes('vận chuyển') || (o.substatus || '').includes('Đã giao')).length;
            const cancelled = orders.filter(o => o.cancelReturnType === 'Cancel' || (o.status || '').includes('Đã hủy')).length;
            const totalRev = orders.reduce((s, o) => s + (o.subtotalAfterDiscount || 0), 0);
            return {
                totalOrders: r.totalRows || orders.length,
                totalRevenue: totalRev,
                totalCompleted: completed,
                totalCancelled: cancelled,
                totalSettlement: 0,
                totalFees: 0,
            };
        }
        if (dataType === 'ads') {
            const r = parsed as TikTokAdsResult;
            return {
                totalOrders: r.summary?.totalOrders || 0,
                totalRevenue: r.summary?.totalRevenue || 0,
                totalCompleted: 0,
                totalCancelled: 0,
                totalSettlement: r.summary?.totalCost || 0, // re-use settlement for totalCost
                totalFees: 0,
            };
        }
    } catch (e) {
        console.error('computeSummary error:', e);
    }
    return { totalOrders: 0, totalRevenue: 0, totalCompleted: 0, totalCancelled: 0, totalSettlement: 0, totalFees: 0 };
}

export default function ShopDetailPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const params = useParams();
    const shopId = params.shopId as string;
    const fileRef = useRef<HTMLInputElement>(null);

    // Zustand store setters for pre-loading data into analysis pages
    const setShopeeIncome = useDataStore(s => s.setShopeeIncome);
    const setShopeeOrders = useDataStore(s => s.setShopeeOrders);
    const setTiktokIncome = useDataStore(s => s.setTiktokIncome);
    const setTiktokOrders = useDataStore(s => s.setTiktokOrders);

    // Navigate to analysis page with pre-loaded data
    const handleViewDetail = (md: MonthlyDataItem, href: string) => {
        if (md.rawData && md.dataType !== 'ads') {
            try {
                const parsed = JSON.parse(md.rawData);
                const fName = md.fileName || 'shop-data.xlsx';
                const fSize = md.fileSize || 0;

                if (md.dataType === 'income') {
                    if (shop?.platform === 'tiktok') {
                        setTiktokIncome(parsed, fName, fSize);
                    } else {
                        setShopeeIncome(parsed, fName, fSize);
                    }
                } else if (md.dataType === 'orders') {
                    if (shop?.platform === 'tiktok') {
                        setTiktokOrders(parsed, fName, fSize);
                    } else {
                        setShopeeOrders(parsed, fName, fSize);
                    }
                }
            } catch (e) {
                console.error('Failed to parse rawData for detail view:', e);
            }
        }
        router.push(href);
    };

    const [shop, setShop] = useState<ShopDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [uploadMonth, setUploadMonth] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const [uploadType, setUploadType] = useState<UploadType>('income');
    const [uploadMsg, setUploadMsg] = useState('');
    const [progress, setProgress] = useState(0);
    const [progressMsg, setProgressMsg] = useState('');
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [activeTab, setActiveTab] = useState<ShopTabId>('manage');

    // Revenue tab state
    const [revData, setRevData] = useState<DailyData[]>([]);
    const [revLoading, setRevLoading] = useState(false);
    const [viewMode, setViewMode] = useState<TimeViewMode>('day');
    const [timePreset, setTimePreset] = useState<TimePreset>('all');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');

    useEffect(() => {
        if (status === 'unauthenticated') router.push('/login');
    }, [status, router]);

    const fetchShop = useCallback(async () => {
        setLoading(true);
        const r = await fetch(`/api/shops/${shopId}`);
        if (r.ok) {
            setShop(await r.json());
        }
        setLoading(false);
    }, [shopId]);

    useEffect(() => {
        if (status === 'authenticated') fetchShop();
    }, [status, fetchShop]);

    // Fetch revenue data when revenue tab is active
    useEffect(() => {
        if (status !== 'authenticated' || activeTab !== 'revenue') return;
        setRevLoading(true);
        fetch(`/api/reports/revenue?shopId=${shopId}`)
            .then(r => r.json())
            .then(d => {
                setRevData(d.dailyData || []);
                // Auto-detect best view mode
                const len = (d.dailyData || []).length;
                if (len <= 45) setViewMode('day');
                else if (len <= 180) setViewMode('week');
                else setViewMode('month');
                setRevLoading(false);
            })
            .catch(() => setRevLoading(false));
    }, [status, activeTab, shopId]);

    // Filter revenue data by time range
    const filteredRevData = useMemo(() => {
        const range = getDateRange(timePreset, customFrom, customTo);
        if (!range) return revData;
        return revData.filter(d => d.date >= range[0] && d.date <= range[1]);
    }, [revData, timePreset, customFrom, customTo]);

    const aggregated = useMemo(() => aggregateByMode(filteredRevData, viewMode), [filteredRevData, viewMode]);

    const handleUpload = async (file: File) => {
        if (!shop) return;
        setUploading(true);
        setUploadMsg('');
        setProgress(0);
        setProgressMsg('Đang bắt đầu...');

        try {
            // Step 1: Parse client-side using the right parser
            const onProgress: ProgressCallback = (pct, msg) => {
                setProgress(pct);
                setProgressMsg(msg);
            };

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let parsed: any;
            if (shop.platform === 'shopee' && uploadType === 'income') {
                parsed = await parseIncomeExcel(file, onProgress);
            } else if (shop.platform === 'shopee' && uploadType === 'orders') {
                parsed = await parseOrderExcel(file, onProgress);
            } else if (shop.platform === 'tiktok' && uploadType === 'income') {
                parsed = await parseTikTokIncomeExcel(file, onProgress);
            } else if (uploadType === 'ads') {
                parsed = await parseTikTokAdsExcel(file, onProgress);
            } else {
                parsed = await parseTikTokOrderExcel(file, onProgress);
            }

            // Step 2: Compute summary metrics
            setProgressMsg('Đang tính toán...');
            setProgress(95);
            const summary = computeSummary(uploadType, shop.platform, parsed);

            // Step 3: Upload file + summary + rawData to server
            setProgressMsg('Đang lưu...');
            const formData = new FormData();
            formData.append('file', file);
            formData.append('dataType', uploadType);
            formData.append('month', uploadMonth);
            formData.append('summary', JSON.stringify(summary));
            // Save raw parsed data as JSON (for future report loading from DB)
            formData.append('rawData', JSON.stringify(parsed));

            const r = await fetch(`/api/shops/${shopId}/upload`, {
                method: 'POST',
                body: formData,
            });

            if (r.ok) {
                setUploadMsg(`✅ Upload thành công! ${summary.totalOrders.toLocaleString()} đơn, ${summary.totalRevenue.toLocaleString('vi-VN')}đ doanh thu`);
                fetchShop();
            } else {
                const err = await r.json();
                setUploadMsg(`❌ Lỗi: ${err.error}`);
            }
        } catch (err) {
            setUploadMsg(`❌ ${err instanceof Error ? err.message : 'Lỗi upload. Vui lòng thử lại.'}`);
        }
        setUploading(false);
        setProgress(0);
        setProgressMsg('');
    };

    const handleDeleteData = async (dataId: string) => {
        setDeleting(true);
        await fetch(`/api/shops/${shopId}/data/${dataId}`, { method: 'DELETE' });
        setDeleteId(null);
        setDeleting(false);
        fetchShop();
    };

    if (status === 'loading' || loading) {
        return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải...</div>;
    }
    if (!session || !shop) return null;

    const fmt = (n: number) => n.toLocaleString('vi-VN');
    const fmtM = (n: number) => {
        if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + ' tỷ';
        if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'tr';
        if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(0) + 'K';
        return n.toFixed(0);
    };
    const totalRev = shop.monthlyData.filter(m => m.dataType === 'income').reduce((s, m) => s + m.totalRevenue, 0);
    const totalOrders = shop.monthlyData.filter(m => m.dataType === 'orders').reduce((s, m) => s + m.totalOrders, 0);
    const totalFees = shop.monthlyData.filter(m => m.dataType === 'income').reduce((s, m) => s + m.totalFees, 0);

    // Ads KPIs (totalSettlement is re-used for totalCost in ads records)
    const adsRecords = shop.monthlyData.filter(m => m.dataType === 'ads');
    const adsTotalCost = adsRecords.reduce((s, m) => s + m.totalSettlement, 0);
    const adsTotalRevenue = adsRecords.reduce((s, m) => s + m.totalRevenue, 0);
    const adsTotalOrders = adsRecords.reduce((s, m) => s + m.totalOrders, 0);
    const adsROI = adsTotalCost > 0 ? adsTotalRevenue / adsTotalCost : 0;
    const adsCPO = adsTotalOrders > 0 ? adsTotalCost / adsTotalOrders : 0;
    const hasAdsData = adsRecords.length > 0;

    return (
        <div style={{ padding: '24px 32px' }}>
            {/* Back + Header */}
            <button
                onClick={() => router.push('/shops')}
                style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    background: 'none', border: 'none', color: 'var(--text-muted)',
                    fontSize: '0.82rem', cursor: 'pointer', marginBottom: 16, padding: 0,
                }}
            >
                <ArrowLeft size={16} /> Quay lại
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <div style={{
                    width: 48, height: 48, borderRadius: 12,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden',
                }}>
                    <img src={shop.platform === 'shopee' ? '/logo-shopee.png' : '/logo-tiktok.png'} alt={shop.platform} style={{ width: 48, height: 48, objectFit: 'contain' }} />
                </div>
                <div>
                    <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
                        {shop.name}
                    </h1>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {shop.platform.toUpperCase()} · {shop.description || 'Không có mô tả'}
                    </p>
                </div>
            </div>

            {/* Quick Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: hasAdsData ? 12 : 24 }}>
                {[
                    { label: 'Tổng doanh thu', value: `${fmt(totalRev)}đ`, color: '#22c55e' },
                    { label: 'Tổng đơn hàng', value: fmt(totalOrders), color: '#3b82f6' },
                    { label: 'Tổng phí', value: `${fmt(totalFees)}đ`, color: '#ef4444' },
                    { label: 'Tháng dữ liệu', value: String(new Set(shop.monthlyData.map(m => m.month)).size), color: '#a855f7' },
                ].map((stat, i) => (
                    <div key={i} style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-default)',
                        borderRadius: 10, padding: '16px',
                    }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>{stat.label}</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: stat.color }}>{stat.value}</div>
                    </div>
                ))}
            </div>

            {/* Ads KPI Cards - only shown when ads data exists */}
            {hasAdsData && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
                    {[
                        { label: '⚡ Chi phí QC', value: `${fmtM(adsTotalCost)}đ`, color: '#f59e0b' },
                        { label: '⚡ Doanh thu QC', value: `${fmtM(adsTotalRevenue)}đ`, color: '#10b981' },
                        { label: '⚡ ROI', value: `${adsROI.toFixed(2)}x`, color: adsROI >= 3 ? '#22c55e' : adsROI >= 1 ? '#f59e0b' : '#ef4444' },
                        { label: '⚡ Chi phí/đơn', value: `${fmtM(adsCPO)}đ`, color: '#8b5cf6' },
                    ].map((stat, i) => (
                        <div key={`ads-${i}`} style={{
                            background: 'linear-gradient(135deg, rgba(245,158,11,0.05), rgba(16,185,129,0.05))',
                            border: '1px solid rgba(245,158,11,0.2)',
                            borderRadius: 10, padding: '16px',
                        }}>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>{stat.label}</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: stat.color }}>{stat.value}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Tab Bar */}
            <div style={{
                display: 'flex', gap: 4, marginBottom: 20,
                background: 'var(--bg-secondary)', borderRadius: 10, padding: 4,
                border: '1px solid var(--border-default)',
            }}>
                {([{ id: 'manage' as ShopTabId, label: 'Quản lý', icon: Settings },
                { id: 'revenue' as ShopTabId, label: 'Doanh thu', icon: TrendingUp },
                { id: 'orders' as ShopTabId, label: 'Đơn hàng', icon: ShoppingCart },
                { id: 'products' as ShopTabId, label: 'Sản phẩm', icon: Package },
                ]).map(t => (
                    <button
                        key={t.id}
                        onClick={() => setActiveTab(t.id)}
                        style={{
                            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            padding: '10px 16px', borderRadius: 8,
                            border: 'none',
                            background: activeTab === t.id ? 'var(--accent)' : 'transparent',
                            color: activeTab === t.id ? '#fff' : 'var(--text-muted)',
                            cursor: 'pointer', fontSize: '0.85rem',
                            fontWeight: activeTab === t.id ? 600 : 400,
                            transition: 'all 0.15s',
                        }}
                    >
                        <t.icon size={16} />{t.label}
                    </button>
                ))}
            </div>

            {/* ============ TAB: Quản lý ============ */}
            {activeTab === 'manage' && (<>

                {/* Upload Section */}
                <div style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 12, padding: '20px', marginBottom: 24,
                }}>
                    <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Upload size={18} /> Upload dữ liệu
                    </h2>

                    <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        {/* Month picker */}
                        <div>
                            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                                <Calendar size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> Tháng
                            </label>
                            <input
                                type="month"
                                value={uploadMonth}
                                onChange={e => setUploadMonth(e.target.value)}
                                disabled={uploading}
                                style={{
                                    padding: '8px 12px', borderRadius: 8,
                                    border: '1px solid var(--border-default)',
                                    background: 'var(--bg-primary)', color: 'var(--text-primary)',
                                    fontSize: '0.85rem',
                                }}
                            />
                        </div>

                        {/* Data type */}
                        <div>
                            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Loại dữ liệu</label>
                            <div style={{ display: 'flex', gap: 6 }}>
                                {([
                                    { key: 'income' as UploadType, label: '💰 Doanh thu' },
                                    { key: 'orders' as UploadType, label: '📦 Đơn hàng' },
                                    ...(shop.platform === 'tiktok' ? [{ key: 'ads' as UploadType, label: '⚡ TikTok Ads' }] : []),
                                ]).map(t => (
                                    <button
                                        key={t.key}
                                        onClick={() => setUploadType(t.key)}
                                        disabled={uploading}
                                        style={{
                                            padding: '8px 16px', borderRadius: 8,
                                            border: `2px solid ${uploadType === t.key ? 'var(--accent-primary)' : 'var(--border-default)'}`,
                                            background: uploadType === t.key ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
                                            color: 'var(--text-primary)',
                                            fontSize: '0.82rem', fontWeight: 500, cursor: uploading ? 'not-allowed' : 'pointer',
                                            opacity: uploading ? 0.5 : 1,
                                        }}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Upload button / Progress */}
                    <input
                        ref={fileRef}
                        type="file"
                        accept=".xlsx,.xls"
                        style={{ display: 'none' }}
                        onChange={e => {
                            const f = e.target.files?.[0];
                            if (f) handleUpload(f);
                            e.target.value = '';
                        }}
                    />

                    {uploading ? (
                        <div style={{
                            padding: '16px 24px', borderRadius: 10,
                            border: '2px solid var(--accent-primary)',
                            background: 'var(--bg-primary)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                <Loader2 size={18} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-primary)' }} />
                                <span style={{ fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                                    {progressMsg || 'Đang xử lý...'}
                                </span>
                            </div>
                            <div style={{
                                width: '100%', height: 6, borderRadius: 3,
                                background: 'var(--bg-tertiary)', overflow: 'hidden',
                            }}>
                                <div style={{
                                    width: `${progress}%`, height: '100%', borderRadius: 3,
                                    background: 'var(--accent-primary)',
                                    transition: 'width 0.3s ease',
                                }} />
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4, textAlign: 'right' }}>
                                {progress}%
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={() => fileRef.current?.click()}
                            style={{
                                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                padding: '14px', borderRadius: 10,
                                border: '2px dashed var(--border-default)',
                                background: 'var(--bg-primary)', color: 'var(--text-secondary)',
                                fontSize: '0.88rem', cursor: 'pointer',
                            }}
                        >
                            <FileSpreadsheet size={18} />
                            Chọn file Excel (.xlsx) — {uploadType === 'ads' ? 'Creative Data for Product Campaigns' : `${shop.platform === 'shopee' ? 'Shopee' : 'TikTok'} ${uploadType === 'income' ? 'Income' : 'Order'}`}
                        </button>
                    )}

                    {uploadMsg && (
                        <div style={{
                            marginTop: 12, fontSize: '0.85rem', padding: '10px 14px', borderRadius: 8,
                            background: uploadMsg.startsWith('✅') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                            color: uploadMsg.startsWith('✅') ? '#22c55e' : '#ef4444',
                            border: `1px solid ${uploadMsg.startsWith('✅') ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                        }}>
                            {uploadMsg}
                        </div>
                    )}
                </div>

                {/* Delete Confirm Modal */}
                {deleteId && (
                    <div style={{
                        position: 'fixed', inset: 0, zIndex: 50,
                        background: 'rgba(0,0,0,0.5)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }} onClick={() => !deleting && setDeleteId(null)}>
                        <div style={{
                            background: 'var(--bg-secondary)', borderRadius: 14, padding: '28px', maxWidth: 380,
                            border: '1px solid var(--border-default)',
                        }} onClick={e => e.stopPropagation()}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
                                Xác nhận xóa dữ liệu
                            </h3>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
                                Xóa dữ liệu tháng này? Hành động không thể hoàn tác.
                            </p>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={() => setDeleteId(null)} disabled={deleting} style={{
                                    flex: 1, padding: '10px', borderRadius: 8,
                                    border: '1px solid var(--border-default)',
                                    background: 'var(--bg-primary)', color: 'var(--text-primary)',
                                    fontSize: '0.85rem', cursor: 'pointer',
                                }}>Hủy</button>
                                <button onClick={() => handleDeleteData(deleteId)} disabled={deleting} style={{
                                    flex: 1, padding: '10px', borderRadius: 8,
                                    border: 'none', background: '#ef4444', color: '#fff',
                                    fontSize: '0.85rem', fontWeight: 600, cursor: deleting ? 'wait' : 'pointer',
                                    opacity: deleting ? 0.5 : 1,
                                }}>{deleting ? 'Đang xóa...' : 'Xóa'}</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Monthly Data Table */}
                <div style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 12, overflow: 'hidden',
                }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-default)' }}>
                        <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            Dữ liệu đã upload ({shop.monthlyData.length})
                        </h2>
                    </div>

                    {shop.monthlyData.length === 0 ? (
                        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                            Chưa có dữ liệu. Upload file Excel bên trên để bắt đầu.
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-tertiary)' }}>
                                    <th style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500 }}>Tháng</th>
                                    <th style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500 }}>Loại</th>
                                    <th style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500 }}>File</th>
                                    <th style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 500 }}>Doanh thu</th>
                                    <th style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 500 }}>Đơn</th>
                                    <th style={{ padding: '10px 16px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 500 }}>Ngày upload</th>
                                    <th style={{ padding: '10px 16px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 500 }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {shop.monthlyData.map(md => (
                                    <tr key={md.id} style={{ borderTop: '1px solid var(--border-default)' }}>
                                        <td style={{ padding: '12px 16px', color: 'var(--text-primary)', fontWeight: 500 }}>{md.month}</td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <span style={{
                                                padding: '3px 8px', borderRadius: 6,
                                                background: md.dataType === 'ads' ? 'rgba(245,158,11,0.1)' : md.dataType === 'income' ? 'rgba(45,212,191,0.1)' : 'rgba(129,140,248,0.1)',
                                                color: md.dataType === 'ads' ? '#f59e0b' : md.dataType === 'income' ? '#2dd4bf' : '#818cf8',
                                                fontSize: '0.72rem', fontWeight: 600,
                                            }}>
                                                {md.dataType === 'ads' ? '⚡ TikTok Ads' : md.dataType === 'income' ? '💰 Doanh thu' : '📦 Đơn hàng'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>{md.fileName || '—'}</td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#22c55e', fontWeight: 600 }}>
                                            {md.totalRevenue > 0 ? `${fmt(md.totalRevenue)}đ` : '—'}
                                        </td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-primary)' }}>
                                            {md.totalOrders > 0 ? fmt(md.totalOrders) : '—'}
                                        </td>
                                        <td style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                                                <CheckCircle size={12} style={{ color: '#22c55e' }} />
                                                {new Date(md.uploadedAt).toLocaleDateString('vi-VN')}
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                                {(() => {
                                                    const detailHref =
                                                        md.dataType === 'ads' ? '/ads/tiktok'
                                                            : md.dataType === 'income' ? (shop.platform === 'tiktok' ? '/tiktok-income' : '/income')
                                                                : (shop.platform === 'tiktok' ? '/tiktok-orders' : '/orders');
                                                    const btnColor =
                                                        md.dataType === 'ads' ? '#f59e0b'
                                                            : md.dataType === 'income' ? '#2dd4bf'
                                                                : '#818cf8';
                                                    return (
                                                        <button
                                                            onClick={() => handleViewDetail(md, detailHref)}
                                                            title="Xem chi tiết phân tích"
                                                            style={{
                                                                background: `${btnColor}18`, border: `1px solid ${btnColor}50`,
                                                                borderRadius: 6, cursor: 'pointer',
                                                                color: btnColor, padding: '4px 8px',
                                                                fontSize: '0.7rem', fontWeight: 600,
                                                                display: 'flex', alignItems: 'center', gap: 4,
                                                            }}
                                                        >
                                                            <ExternalLink size={12} /> Chi tiết
                                                        </button>
                                                    );
                                                })()}
                                                <button
                                                    onClick={() => setDeleteId(md.id)}
                                                    title="Xóa dữ liệu"
                                                    style={{
                                                        background: 'none', border: 'none', cursor: 'pointer',
                                                        color: 'var(--text-muted)', padding: 4,
                                                    }}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

            </>)}

            {/* ============ TAB: Doanh thu ============ */}
            {activeTab === 'revenue' && (
                <RevenueTab
                    data={filteredRevData}
                    aggregated={aggregated}
                    loading={revLoading}
                    viewMode={viewMode}
                    setViewMode={setViewMode}
                    timePreset={timePreset}
                    setTimePreset={setTimePreset}
                    customFrom={customFrom}
                    setCustomFrom={setCustomFrom}
                    customTo={customTo}
                    setCustomTo={setCustomTo}
                />
            )}

            {/* ============ TAB: Đơn hàng ============ */}
            {activeTab === 'orders' && (
                <OrdersTab shop={shop} />
            )}

            {/* ============ TAB: Sản phẩm ============ */}
            {activeTab === 'products' && (
                <ProductsTab shop={shop} />
            )}

            {/* CSS for spinner animation */}
            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}
            </style>
        </div>
    );
}
