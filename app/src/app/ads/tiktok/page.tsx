'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import {
    Upload,
    FileSpreadsheet,
    Calendar,
    Loader2,
    Trash2,
    TrendingUp,
    DollarSign,
    ShoppingCart,
    Eye,
    MousePointerClick,
    Target,
    ArrowUpDown,
    ChevronDown,
    ChevronUp,
    Zap,
    Award,
    Package,
    Video,
    CreditCard,
} from 'lucide-react';

import { parseTikTokAdsExcel, type TikTokAdsResult, type TikTokAdCreative, type TikTokAdCampaignSummary, type TikTokAdProductSummary } from '@/lib/parsers/tiktok-ads-parser';
import type { ProgressCallback } from '@/lib/parsers/income-parser';

// ==========================================
// Helper functions
// ==========================================

const fmt = (n: number) => n.toLocaleString('vi-VN');
const fmtMoney = (n: number) => {
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return fmt(Math.round(n));
};
const fmtPct = (n: number) => `${(n * 100).toFixed(2)}%`;

type SortDir = 'asc' | 'desc';
type CreativeSortKey = 'roi' | 'cost' | 'orders' | 'grossRevenue' | 'ctr' | 'conversionRate';
type ProductSortKey = 'avgROI' | 'totalCost' | 'totalOrders' | 'totalRevenue' | 'avgCostPerOrder';

// ==========================================
// Component
// ==========================================

export default function TikTokAdsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const fileRef = useRef<HTMLInputElement>(null);

    const [records, setRecords] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [uploadMonth, setUploadMonth] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const [uploadMsg, setUploadMsg] = useState('');
    const [progress, setProgress] = useState(0);
    const [progressMsg, setProgressMsg] = useState('');
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    // Current parsed data (merged from all records)
    const [adsData, setAdsData] = useState<TikTokAdsResult | null>(null);

    // Tables sort state
    const [creativeSortKey, setCreativeSortKey] = useState<CreativeSortKey>('roi');
    const [creativeSortDir, setCreativeSortDir] = useState<SortDir>('desc');
    const [creativeMinOrders, setCreativeMinOrders] = useState(1);
    const [showCreativeCount, setShowCreativeCount] = useState(20);

    const [productSortKey, setProductSortKey] = useState<ProductSortKey>('totalRevenue');
    const [productSortDir, setProductSortDir] = useState<SortDir>('desc');
    const [showProductCount, setShowProductCount] = useState(20);

    // Section collapse states
    const [uploadCollapsed, setUploadCollapsed] = useState(false);

    useEffect(() => {
        if (status === 'unauthenticated') router.push('/login');
    }, [status, router]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const r = await fetch('/api/ads/report');
            if (r.ok) {
                const data = await r.json();
                setRecords(data);
                // Merge rawData from all records
                mergeRecords(data);
            }
        } catch (e) {
            console.error('Failed to fetch ads data:', e);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        if (status === 'authenticated') fetchData();
    }, [status, fetchData]);

    // Merge all rawData records into a single TikTokAdsResult
    const mergeRecords = (recs: any[]) => {
        const allCreatives: TikTokAdCreative[] = [];
        for (const rec of recs) {
            if (rec.rawData) {
                try {
                    const parsed: TikTokAdsResult = JSON.parse(rec.rawData);
                    if (parsed.creatives) allCreatives.push(...parsed.creatives);
                } catch { /* skip */ }
            }
        }
        if (allCreatives.length === 0) {
            setAdsData(null);
            return;
        }

        // Re-aggregate
        const campaignMap = new Map<string, TikTokAdCreative[]>();
        for (const c of allCreatives) {
            const key = c.campaignId || c.campaignName;
            if (!campaignMap.has(key)) campaignMap.set(key, []);
            campaignMap.get(key)!.push(c);
        }
        const campaigns: TikTokAdCampaignSummary[] = Array.from(campaignMap.entries()).map(([, items]) => {
            const totalCost = items.reduce((s, c) => s + c.cost, 0);
            const totalOrders = items.reduce((s, c) => s + c.orders, 0);
            const totalRevenue = items.reduce((s, c) => s + c.grossRevenue, 0);
            const totalImpressions = items.reduce((s, c) => s + c.impressions, 0);
            const totalClicks = items.reduce((s, c) => s + c.clicks, 0);
            return {
                name: items[0].campaignName,
                id: items[0].campaignId,
                totalCost, totalOrders, totalRevenue,
                avgROI: totalCost > 0 ? totalRevenue / totalCost : 0,
                avgCTR: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
                avgConversionRate: totalClicks > 0 ? totalOrders / totalClicks : 0,
                totalImpressions, totalClicks,
                creativesCount: items.length,
                activeCount: items.filter(c => c.status === 'Đang phân phối').length,
            };
        });

        const productMap = new Map<string, TikTokAdCreative[]>();
        for (const c of allCreatives) {
            if (!productMap.has(c.productId)) productMap.set(c.productId, []);
            productMap.get(c.productId)!.push(c);
        }
        const products: TikTokAdProductSummary[] = Array.from(productMap.entries()).map(([productId, items]) => {
            const totalCost = items.reduce((s, c) => s + c.cost, 0);
            const totalOrders = items.reduce((s, c) => s + c.orders, 0);
            const totalRevenue = items.reduce((s, c) => s + c.grossRevenue, 0);
            return {
                productId, totalCost, totalOrders, totalRevenue,
                avgROI: totalCost > 0 ? totalRevenue / totalCost : 0,
                avgCostPerOrder: totalOrders > 0 ? totalCost / totalOrders : 0,
                creativesCount: items.length,
            };
        });

        const totalCost = allCreatives.reduce((s, c) => s + c.cost, 0);
        const totalOrders = allCreatives.reduce((s, c) => s + c.orders, 0);
        const totalRevenue = allCreatives.reduce((s, c) => s + c.grossRevenue, 0);
        const totalImpressions = allCreatives.reduce((s, c) => s + c.impressions, 0);
        const totalClicks = allCreatives.reduce((s, c) => s + c.clicks, 0);

        setAdsData({
            creatives: allCreatives,
            campaigns,
            products,
            summary: {
                totalCost, totalOrders, totalRevenue,
                avgROI: totalCost > 0 ? totalRevenue / totalCost : 0,
                avgCTR: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
                avgConversionRate: totalClicks > 0 ? totalOrders / totalClicks : 0,
                totalImpressions, totalClicks,
                totalCreatives: allCreatives.length,
                totalCampaigns: campaigns.length,
                totalProducts: products.length,
                activeCreatives: allCreatives.filter(c => c.status === 'Đang phân phối').length,
                videoCreatives: allCreatives.filter(c => c.creativeType === 'Video').length,
                productCardCreatives: allCreatives.filter(c => c.creativeType !== 'Video').length,
            },
        });
    };

    const handleUpload = async (file: File) => {
        setUploading(true);
        setUploadMsg('');
        setProgress(0);
        setProgressMsg('Đang bắt đầu...');

        try {
            const onProgress: ProgressCallback = (pct, msg) => {
                setProgress(pct);
                setProgressMsg(msg);
            };

            const parsed = await parseTikTokAdsExcel(file, onProgress);

            setProgressMsg('Đang lưu...');
            setProgress(95);

            const formData = new FormData();
            formData.append('file', file);
            formData.append('platform', 'tiktok');
            formData.append('month', uploadMonth);
            formData.append('summary', JSON.stringify({
                totalCost: parsed.summary.totalCost,
                totalOrders: parsed.summary.totalOrders,
                totalRevenue: parsed.summary.totalRevenue,
                totalCreatives: parsed.summary.totalCreatives,
                totalCampaigns: parsed.summary.totalCampaigns,
            }));
            formData.append('rawData', JSON.stringify(parsed));

            const r = await fetch('/api/ads/upload', {
                method: 'POST',
                body: formData,
            });

            if (r.ok) {
                setUploadMsg(`✅ Upload thành công! ${fmt(parsed.summary.totalCreatives)} creatives, ${fmt(parsed.summary.totalOrders)} đơn, ROI ${parsed.summary.avgROI.toFixed(2)}x`);
                fetchData();
            } else {
                const err = await r.json();
                setUploadMsg(`❌ Lỗi: ${err.error}`);
            }
        } catch (err) {
            setUploadMsg(`❌ ${err instanceof Error ? err.message : 'Lỗi upload.'}`);
        }
        setUploading(false);
        setProgress(0);
        setProgressMsg('');
    };

    const handleDelete = async (id: string) => {
        setDeleting(true);
        await fetch(`/api/ads/${id}`, { method: 'DELETE' });
        setDeleteId(null);
        setDeleting(false);
        fetchData();
    };

    // Sorted creatives
    const sortedCreatives = adsData ? [...adsData.creatives]
        .filter(c => c.orders >= creativeMinOrders)
        .sort((a, b) => {
            const av = a[creativeSortKey] as number;
            const bv = b[creativeSortKey] as number;
            return creativeSortDir === 'desc' ? bv - av : av - bv;
        })
        .slice(0, showCreativeCount) : [];

    // Sorted products
    const sortedProducts = adsData ? [...adsData.products]
        .filter(p => p.totalOrders > 0)
        .sort((a, b) => {
            const av = a[productSortKey] as number;
            const bv = b[productSortKey] as number;
            return productSortDir === 'desc' ? bv - av : av - bv;
        })
        .slice(0, showProductCount) : [];

    const toggleCreativeSort = (key: CreativeSortKey) => {
        if (creativeSortKey === key) setCreativeSortDir(d => d === 'desc' ? 'asc' : 'desc');
        else { setCreativeSortKey(key); setCreativeSortDir('desc'); }
    };

    const toggleProductSort = (key: ProductSortKey) => {
        if (productSortKey === key) setProductSortDir(d => d === 'desc' ? 'asc' : 'desc');
        else { setProductSortKey(key); setProductSortDir('desc'); }
    };

    if (status === 'loading' || loading) {
        return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải...</div>;
    }
    if (!session) return null;

    const s = adsData?.summary;

    // Table header sort arrow
    const SortIcon = ({ active, dir }: { active: boolean; dir: SortDir }) => (
        <ArrowUpDown size={12} style={{ opacity: active ? 1 : 0.3, color: active ? 'var(--accent-primary)' : 'var(--text-muted)' }} />
    );

    const cardStyle = {
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-default)',
        borderRadius: 12,
        padding: '16px 20px',
    };

    const sectionStyle = {
        ...cardStyle,
        marginBottom: 24,
        overflow: 'hidden' as const,
    };

    const thStyle = (clickable = false): React.CSSProperties => ({
        padding: '10px 14px',
        textAlign: 'left' as const,
        color: 'var(--text-muted)',
        fontWeight: 500,
        fontSize: '0.72rem',
        whiteSpace: 'nowrap' as const,
        cursor: clickable ? 'pointer' : 'default',
        userSelect: 'none' as const,
    });

    const tdStyle: React.CSSProperties = {
        padding: '10px 14px',
        fontSize: '0.82rem',
        borderTop: '1px solid var(--border-default)',
    };

    return (
        <div style={{ padding: '24px 32px', maxWidth: 1400 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <div style={{
                    width: 44, height: 44, borderRadius: 10,
                    background: 'linear-gradient(135deg, #ff0050, #00f2ea)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <Zap size={22} color="#fff" />
                </div>
                <div>
                    <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
                        TikTok Ads Analytics
                    </h1>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Phân tích hiệu quả quảng cáo TikTok Shop
                    </p>
                </div>
            </div>

            {/* ============================================ */}
            {/* UPLOAD SECTION */}
            {/* ============================================ */}
            <div style={sectionStyle}>
                <button
                    onClick={() => setUploadCollapsed(!uploadCollapsed)}
                    style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                        padding: 0, marginBottom: uploadCollapsed ? 0 : 16,
                    }}
                >
                    <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Upload size={18} /> Upload dữ liệu Ads
                    </h2>
                    {uploadCollapsed ? <ChevronDown size={18} color="var(--text-muted)" /> : <ChevronUp size={18} color="var(--text-muted)" />}
                </button>

                {!uploadCollapsed && (
                    <>
                        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
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
                        </div>

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
                                <div style={{ width: '100%', height: 6, borderRadius: 3, background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                                    <div style={{ width: `${progress}%`, height: '100%', borderRadius: 3, background: 'var(--accent-primary)', transition: 'width 0.3s ease' }} />
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4, textAlign: 'right' }}>{progress}%</div>
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
                                Chọn file Excel (.xlsx) — Creative Data for Product Campaigns
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

                        {/* Uploaded records */}
                        {records.length > 0 && (
                            <div style={{ marginTop: 16 }}>
                                <h3 style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                                    Dữ liệu đã upload ({records.length})
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {records.map((rec: any) => (
                                        <div key={rec.id} style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            padding: '8px 12px', borderRadius: 8,
                                            background: 'var(--bg-primary)', border: '1px solid var(--border-default)',
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>{rec.month}</span>
                                                <span style={{
                                                    padding: '2px 8px', borderRadius: 6,
                                                    background: 'rgba(255,0,80,0.1)', color: '#ff0050',
                                                    fontSize: '0.7rem', fontWeight: 600,
                                                }}>TikTok Ads</span>
                                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{rec.fileName}</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                <span style={{ fontSize: '0.72rem', color: '#22c55e' }}>{fmt(rec.totalCreatives)} creatives</span>
                                                <span style={{ fontSize: '0.72rem', color: '#3b82f6' }}>{fmt(rec.totalOrders)} đơn</span>
                                                <button onClick={() => setDeleteId(rec.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Delete Confirm Modal */}
            {deleteId && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => !deleting && setDeleteId(null)}>
                    <div style={{ background: 'var(--bg-secondary)', borderRadius: 14, padding: '28px', maxWidth: 380, border: '1px solid var(--border-default)' }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>Xác nhận xóa</h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 20 }}>Xóa dữ liệu ads này? Hành động không thể hoàn tác.</p>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => setDeleteId(null)} disabled={deleting} style={{
                                flex: 1, padding: '10px', borderRadius: 8,
                                border: '1px solid var(--border-default)', background: 'var(--bg-primary)',
                                color: 'var(--text-primary)', fontSize: '0.85rem', cursor: 'pointer',
                            }}>Hủy</button>
                            <button onClick={() => handleDelete(deleteId)} disabled={deleting} style={{
                                flex: 1, padding: '10px', borderRadius: 8,
                                border: 'none', background: '#ef4444', color: '#fff',
                                fontSize: '0.85rem', fontWeight: 600, cursor: deleting ? 'wait' : 'pointer',
                                opacity: deleting ? 0.5 : 1,
                            }}>{deleting ? 'Đang xóa...' : 'Xóa'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* If no data, show empty state */}
            {!adsData && (
                <div style={{ ...sectionStyle, textAlign: 'center', padding: '60px 40px' }}>
                    <Zap size={48} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                        Chưa có dữ liệu TikTok Ads
                    </h2>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: 400, margin: '0 auto' }}>
                        Upload file &quot;Creative Data for Product Campaigns&quot; (.xlsx) từ TikTok Ads Manager để bắt đầu phân tích.
                    </p>
                </div>
            )}

            {/* ============================================ */}
            {/* TẦNG 1: KPI DASHBOARD */}
            {/* ============================================ */}
            {s && (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
                        {[
                            { label: 'Chi phí Ads', value: `${fmtMoney(s.totalCost)}đ`, sub: `${fmt(s.totalCreatives)} creatives`, icon: DollarSign, color: '#ef4444', bgColor: 'rgba(239,68,68,0.08)' },
                            { label: 'Đơn hàng', value: fmt(s.totalOrders), sub: `${fmtMoney(s.totalCost / Math.max(s.totalOrders, 1))}đ/đơn`, icon: ShoppingCart, color: '#3b82f6', bgColor: 'rgba(59,130,246,0.08)' },
                            { label: 'Doanh thu gộp', value: `${fmtMoney(s.totalRevenue)}đ`, sub: `Từ quảng cáo`, icon: TrendingUp, color: '#22c55e', bgColor: 'rgba(34,197,94,0.08)' },
                        ].map((card, i) => (
                            <div key={i} style={{ ...cardStyle, borderLeft: `3px solid ${card.color}` }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>{card.label}</span>
                                    <div style={{ width: 32, height: 32, borderRadius: 8, background: card.bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <card.icon size={16} color={card.color} />
                                    </div>
                                </div>
                                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: card.color, marginBottom: 2 }}>{card.value}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{card.sub}</div>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
                        {[
                            { label: 'ROI', value: `${s.avgROI.toFixed(2)}x`, sub: 'Doanh thu / Chi phí', icon: Target, color: '#f59e0b', bgColor: 'rgba(245,158,11,0.08)' },
                            { label: 'CTR', value: fmtPct(s.avgCTR), sub: `${fmt(s.totalClicks)} clicks / ${fmt(s.totalImpressions)} impressions`, icon: MousePointerClick, color: '#8b5cf6', bgColor: 'rgba(139,92,246,0.08)' },
                            { label: 'Conversion Rate', value: fmtPct(s.avgConversionRate), sub: `${fmt(s.totalOrders)} đơn / ${fmt(s.totalClicks)} clicks`, icon: Award, color: '#06b6d4', bgColor: 'rgba(6,182,212,0.08)' },
                        ].map((card, i) => (
                            <div key={i} style={{ ...cardStyle, borderLeft: `3px solid ${card.color}` }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>{card.label}</span>
                                    <div style={{ width: 32, height: 32, borderRadius: 8, background: card.bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <card.icon size={16} color={card.color} />
                                    </div>
                                </div>
                                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: card.color, marginBottom: 2 }}>{card.value}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{card.sub}</div>
                            </div>
                        ))}
                    </div>

                    {/* Quick Stats Bar */}
                    <div style={{
                        display: 'flex', gap: 16, padding: '12px 20px', borderRadius: 10,
                        background: 'var(--bg-secondary)', border: '1px solid var(--border-default)',
                        marginBottom: 24, flexWrap: 'wrap',
                    }}>
                        {[
                            { label: 'Chiến dịch', value: s.totalCampaigns, icon: '🎯' },
                            { label: 'Sản phẩm', value: s.totalProducts, icon: '📦' },
                            { label: 'Video', value: s.videoCreatives, icon: '🎬' },
                            { label: 'Thẻ SP', value: s.productCardCreatives, icon: '🏷️' },
                            { label: 'Đang chạy', value: s.activeCreatives, icon: '✅' },
                            { label: 'Impressions', value: fmtMoney(s.totalImpressions), icon: '👁️' },
                        ].map((item, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span>{item.icon}</span>
                                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>{typeof item.value === 'number' ? fmt(item.value) : item.value}</span>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{item.label}</span>
                            </div>
                        ))}
                    </div>

                    {/* ============================================ */}
                    {/* CAMPAIGN COMPARISON */}
                    {/* ============================================ */}
                    <div style={sectionStyle}>
                        <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                            🎯 So sánh Chiến dịch ({adsData.campaigns.length})
                        </h2>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                <thead>
                                    <tr style={{ background: 'var(--bg-tertiary)' }}>
                                        <th style={thStyle()}>Chiến dịch</th>
                                        <th style={{ ...thStyle(), textAlign: 'right' }}>Chi phí</th>
                                        <th style={{ ...thStyle(), textAlign: 'right' }}>Đơn hàng</th>
                                        <th style={{ ...thStyle(), textAlign: 'right' }}>Doanh thu</th>
                                        <th style={{ ...thStyle(), textAlign: 'right' }}>ROI</th>
                                        <th style={{ ...thStyle(), textAlign: 'right' }}>CTR</th>
                                        <th style={{ ...thStyle(), textAlign: 'right' }}>Conv. Rate</th>
                                        <th style={{ ...thStyle(), textAlign: 'right' }}>Impressions</th>
                                        <th style={{ ...thStyle(), textAlign: 'right' }}>Clicks</th>
                                        <th style={{ ...thStyle(), textAlign: 'center' }}>Creatives</th>
                                        <th style={{ ...thStyle(), textAlign: 'center' }}>Active</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {adsData.campaigns.map((camp, i) => (
                                        <tr key={i} style={{ borderTop: '1px solid var(--border-default)' }}>
                                            <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--text-primary)', maxWidth: 200 }}>
                                                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{camp.name}</div>
                                                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 400 }}>ID: {camp.id}</div>
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>{fmtMoney(camp.totalCost)}đ</td>
                                            <td style={{ ...tdStyle, textAlign: 'right', color: '#3b82f6', fontWeight: 600 }}>{fmt(camp.totalOrders)}</td>
                                            <td style={{ ...tdStyle, textAlign: 'right', color: '#22c55e', fontWeight: 600 }}>{fmtMoney(camp.totalRevenue)}đ</td>
                                            <td style={{ ...tdStyle, textAlign: 'right' }}>
                                                <span style={{
                                                    padding: '2px 8px', borderRadius: 6,
                                                    background: camp.avgROI >= 10 ? 'rgba(34,197,94,0.1)' : camp.avgROI >= 5 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                                                    color: camp.avgROI >= 10 ? '#22c55e' : camp.avgROI >= 5 ? '#f59e0b' : '#ef4444',
                                                    fontSize: '0.78rem', fontWeight: 700,
                                                }}>{camp.avgROI.toFixed(2)}x</span>
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--text-primary)' }}>{fmtPct(camp.avgCTR)}</td>
                                            <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--text-primary)' }}>{fmtPct(camp.avgConversionRate)}</td>
                                            <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--text-muted)' }}>{fmtMoney(camp.totalImpressions)}</td>
                                            <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--text-muted)' }}>{fmt(camp.totalClicks)}</td>
                                            <td style={{ ...tdStyle, textAlign: 'center' }}>{fmt(camp.creativesCount)}</td>
                                            <td style={{ ...tdStyle, textAlign: 'center' }}>
                                                <span style={{
                                                    padding: '2px 8px', borderRadius: 6,
                                                    background: camp.activeCount > 0 ? 'rgba(34,197,94,0.1)' : 'rgba(107,114,128,0.1)',
                                                    color: camp.activeCount > 0 ? '#22c55e' : '#6b7280',
                                                    fontWeight: 600, fontSize: '0.72rem',
                                                }}>{camp.activeCount}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* ============================================ */}
                    {/* TẦNG 2: TOP CREATIVES */}
                    {/* ============================================ */}
                    <div style={sectionStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                            <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                🏆 Top Creatives
                            </h2>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Min đơn:</label>
                                <select
                                    value={creativeMinOrders}
                                    onChange={e => setCreativeMinOrders(Number(e.target.value))}
                                    style={{
                                        padding: '4px 8px', borderRadius: 6, fontSize: '0.78rem',
                                        border: '1px solid var(--border-default)',
                                        background: 'var(--bg-primary)', color: 'var(--text-primary)',
                                    }}
                                >
                                    {[0, 1, 3, 5, 10, 20].map(n => (
                                        <option key={n} value={n}>{n === 0 ? 'Tất cả' : `≥ ${n}`}</option>
                                    ))}
                                </select>
                                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Hiển thị:</label>
                                <select
                                    value={showCreativeCount}
                                    onChange={e => setShowCreativeCount(Number(e.target.value))}
                                    style={{
                                        padding: '4px 8px', borderRadius: 6, fontSize: '0.78rem',
                                        border: '1px solid var(--border-default)',
                                        background: 'var(--bg-primary)', color: 'var(--text-primary)',
                                    }}
                                >
                                    {[10, 20, 50, 100].map(n => (
                                        <option key={n} value={n}>Top {n}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                <thead>
                                    <tr style={{ background: 'var(--bg-tertiary)' }}>
                                        <th style={thStyle()}>#</th>
                                        <th style={thStyle()}>Creative</th>
                                        <th style={thStyle()}>Loại</th>
                                        <th style={thStyle()}>Trạng thái</th>
                                        <th style={{ ...thStyle(true), textAlign: 'right' }} onClick={() => toggleCreativeSort('cost')}>
                                            Chi phí <SortIcon active={creativeSortKey === 'cost'} dir={creativeSortDir} />
                                        </th>
                                        <th style={{ ...thStyle(true), textAlign: 'right' }} onClick={() => toggleCreativeSort('orders')}>
                                            Đơn <SortIcon active={creativeSortKey === 'orders'} dir={creativeSortDir} />
                                        </th>
                                        <th style={{ ...thStyle(true), textAlign: 'right' }} onClick={() => toggleCreativeSort('grossRevenue')}>
                                            Doanh thu <SortIcon active={creativeSortKey === 'grossRevenue'} dir={creativeSortDir} />
                                        </th>
                                        <th style={{ ...thStyle(true), textAlign: 'right' }} onClick={() => toggleCreativeSort('roi')}>
                                            ROI <SortIcon active={creativeSortKey === 'roi'} dir={creativeSortDir} />
                                        </th>
                                        <th style={{ ...thStyle(true), textAlign: 'right' }} onClick={() => toggleCreativeSort('ctr')}>
                                            CTR <SortIcon active={creativeSortKey === 'ctr'} dir={creativeSortDir} />
                                        </th>
                                        <th style={{ ...thStyle(true), textAlign: 'right' }} onClick={() => toggleCreativeSort('conversionRate')}>
                                            Conv <SortIcon active={creativeSortKey === 'conversionRate'} dir={creativeSortDir} />
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedCreatives.map((c, i) => (
                                        <tr key={i} style={{ borderTop: '1px solid var(--border-default)' }}>
                                            <td style={{ ...tdStyle, color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.72rem', width: 30 }}>{i + 1}</td>
                                            <td style={{ ...tdStyle, maxWidth: 260 }}>
                                                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)', fontWeight: 500 }}>
                                                    {c.videoTitle !== '-' ? c.videoTitle : `Product ${c.productId.slice(-6)}`}
                                                </div>
                                                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 1 }}>
                                                    {c.tiktokAccount !== '-' ? `@${c.tiktokAccount}` : c.campaignName}
                                                </div>
                                            </td>
                                            <td style={tdStyle}>
                                                <span style={{
                                                    padding: '2px 6px', borderRadius: 4, fontSize: '0.68rem', fontWeight: 600,
                                                    background: c.creativeType === 'Video' ? 'rgba(139,92,246,0.1)' : 'rgba(245,158,11,0.1)',
                                                    color: c.creativeType === 'Video' ? '#8b5cf6' : '#f59e0b',
                                                }}>
                                                    {c.creativeType === 'Video' ? '🎬 Video' : '🏷️ Thẻ SP'}
                                                </span>
                                            </td>
                                            <td style={tdStyle}>
                                                <span style={{
                                                    padding: '2px 6px', borderRadius: 4, fontSize: '0.68rem', fontWeight: 600,
                                                    background: c.status === 'Đang phân phối' ? 'rgba(34,197,94,0.1)' : c.status === 'Cần ủy quyền' ? 'rgba(245,158,11,0.1)' : 'rgba(107,114,128,0.1)',
                                                    color: c.status === 'Đang phân phối' ? '#22c55e' : c.status === 'Cần ủy quyền' ? '#f59e0b' : '#6b7280',
                                                }}>
                                                    {c.status === 'Đang phân phối' ? '🟢' : c.status === 'Cần ủy quyền' ? '🟡' : '⚫'} {c.status}
                                                </span>
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'right', color: '#ef4444' }}>{fmtMoney(c.cost)}đ</td>
                                            <td style={{ ...tdStyle, textAlign: 'right', color: '#3b82f6', fontWeight: 600 }}>{fmt(c.orders)}</td>
                                            <td style={{ ...tdStyle, textAlign: 'right', color: '#22c55e', fontWeight: 600 }}>{fmtMoney(c.grossRevenue)}đ</td>
                                            <td style={{ ...tdStyle, textAlign: 'right' }}>
                                                <span style={{
                                                    padding: '2px 6px', borderRadius: 4, fontWeight: 700,
                                                    background: c.roi >= 10 ? 'rgba(34,197,94,0.15)' : c.roi >= 5 ? 'rgba(245,158,11,0.1)' : c.roi >= 1 ? 'rgba(59,130,246,0.1)' : 'rgba(239,68,68,0.1)',
                                                    color: c.roi >= 10 ? '#22c55e' : c.roi >= 5 ? '#f59e0b' : c.roi >= 1 ? '#3b82f6' : '#ef4444',
                                                }}>{c.roi.toFixed(1)}x</span>
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--text-primary)' }}>{fmtPct(c.ctr)}</td>
                                            <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--text-primary)' }}>{fmtPct(c.conversionRate)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 8, textAlign: 'right' }}>
                            Hiển thị {sortedCreatives.length} / {adsData.creatives.filter(c => c.orders >= creativeMinOrders).length} creatives (lọc ≥ {creativeMinOrders} đơn)
                        </div>
                    </div>

                    {/* ============================================ */}
                    {/* TẦNG 2: PRODUCT RANKING */}
                    {/* ============================================ */}
                    <div style={sectionStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                            <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                📦 Xếp hạng Sản phẩm ({adsData.products.filter(p => p.totalOrders > 0).length} SP có đơn)
                            </h2>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Hiển thị:</label>
                                <select
                                    value={showProductCount}
                                    onChange={e => setShowProductCount(Number(e.target.value))}
                                    style={{
                                        padding: '4px 8px', borderRadius: 6, fontSize: '0.78rem',
                                        border: '1px solid var(--border-default)',
                                        background: 'var(--bg-primary)', color: 'var(--text-primary)',
                                    }}
                                >
                                    {[10, 20, 50, 100].map(n => (
                                        <option key={n} value={n}>Top {n}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                <thead>
                                    <tr style={{ background: 'var(--bg-tertiary)' }}>
                                        <th style={thStyle()}>#</th>
                                        <th style={thStyle()}>ID Sản phẩm</th>
                                        <th style={{ ...thStyle(true), textAlign: 'right' }} onClick={() => toggleProductSort('totalCost')}>
                                            Chi phí <SortIcon active={productSortKey === 'totalCost'} dir={productSortDir} />
                                        </th>
                                        <th style={{ ...thStyle(true), textAlign: 'right' }} onClick={() => toggleProductSort('totalOrders')}>
                                            Đơn hàng <SortIcon active={productSortKey === 'totalOrders'} dir={productSortDir} />
                                        </th>
                                        <th style={{ ...thStyle(true), textAlign: 'right' }} onClick={() => toggleProductSort('totalRevenue')}>
                                            Doanh thu <SortIcon active={productSortKey === 'totalRevenue'} dir={productSortDir} />
                                        </th>
                                        <th style={{ ...thStyle(true), textAlign: 'right' }} onClick={() => toggleProductSort('avgROI')}>
                                            ROI <SortIcon active={productSortKey === 'avgROI'} dir={productSortDir} />
                                        </th>
                                        <th style={{ ...thStyle(true), textAlign: 'right' }} onClick={() => toggleProductSort('avgCostPerOrder')}>
                                            Chi phí/đơn <SortIcon active={productSortKey === 'avgCostPerOrder'} dir={productSortDir} />
                                        </th>
                                        <th style={{ ...thStyle(), textAlign: 'center' }}>Creatives</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedProducts.map((p, i) => (
                                        <tr key={i} style={{ borderTop: '1px solid var(--border-default)' }}>
                                            <td style={{ ...tdStyle, color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.72rem', width: 30 }}>{i + 1}</td>
                                            <td style={{ ...tdStyle, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: '0.72rem' }}>
                                                {p.productId.length > 12 ? `...${p.productId.slice(-10)}` : p.productId}
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'right', color: '#ef4444' }}>{fmtMoney(p.totalCost)}đ</td>
                                            <td style={{ ...tdStyle, textAlign: 'right', color: '#3b82f6', fontWeight: 600 }}>{fmt(p.totalOrders)}</td>
                                            <td style={{ ...tdStyle, textAlign: 'right', color: '#22c55e', fontWeight: 600 }}>{fmtMoney(p.totalRevenue)}đ</td>
                                            <td style={{ ...tdStyle, textAlign: 'right' }}>
                                                <span style={{
                                                    padding: '2px 6px', borderRadius: 4, fontWeight: 700,
                                                    background: p.avgROI >= 10 ? 'rgba(34,197,94,0.15)' : p.avgROI >= 5 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                                                    color: p.avgROI >= 10 ? '#22c55e' : p.avgROI >= 5 ? '#f59e0b' : '#ef4444',
                                                }}>{p.avgROI.toFixed(2)}x</span>
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--text-primary)' }}>{fmtMoney(p.avgCostPerOrder)}đ</td>
                                            <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>{fmt(p.creativesCount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 8, textAlign: 'right' }}>
                            Hiển thị {sortedProducts.length} / {adsData.products.filter(p => p.totalOrders > 0).length} sản phẩm có đơn hàng
                        </div>
                    </div>
                </>
            )}

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
