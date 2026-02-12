'use client';

import { useState, useRef, useCallback } from 'react';
import { UploadCloud, Loader2, AlertTriangle, FileSpreadsheet, BarChart3, ShoppingCart, MapPin, Clock, Tag, RefreshCw, TrendingUp, TrendingDown, DollarSign, Percent, Package, Users } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { parseOrderExcel, type ShopeeOrder, type OrderParseResult } from '@/lib/parsers/order-parser';
import { formatCurrency, formatShortCurrency, formatNumber, formatPercent, formatFileSize, formatDate } from '@/lib/formatters';
import styles from '../income/income.module.css';

const TABS = [
    { id: 'funnel', label: 'Phễu Đơn hàng', icon: BarChart3 },
    { id: 'products', label: 'Sản phẩm', icon: Package },
    { id: 'regional', label: 'Địa lý', icon: MapPin },
    { id: 'behavior', label: 'Hành vi', icon: Clock },
    { id: 'pricing', label: 'Giá & KM', icon: Tag },
    { id: 'returns', label: 'Trả hàng', icon: RefreshCw },
] as const;
type TabId = typeof TABS[number]['id'];

const STATUS_COLORS: Record<string, string> = {
    'Hoàn thành': '#22c55e', 'Đã nhận hàng': '#2dd4bf', 'Đã hủy': '#ef4444',
    'Đang giao': '#f59e0b', 'Trả hàng/Hoàn tiền': '#8b5cf6',
};
const PIE_COLORS = ['#2dd4bf', '#818cf8', '#f472b6', '#fb923c', '#a3e635', '#ef4444', '#64748b', '#06b6d4', '#eab308', '#8b5cf6'];

export default function OrdersPage() {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<TabId>('funnel');
    const [data, setData] = useState<OrderParseResult | null>(null);
    const [fileName, setFileName] = useState('');
    const [fileSize, setFileSize] = useState(0);

    const handleFile = useCallback(async (file: File) => {
        setError(null); setIsProcessing(true); setFileName(file.name); setFileSize(file.size);
        try { const r = await parseOrderExcel(file); setData(r); setActiveTab('funnel'); }
        catch (e) { setError(e instanceof Error ? e.message : 'Lỗi'); setData(null); }
        finally { setIsProcessing(false); }
    }, []);

    const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
    const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
    const onDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); };
    const onInput = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); };

    if (!data) return (
        <div>
            <div className="page-header"><div><h1 className="page-header__title">Phân tích Đơn hàng</h1><p className="page-header__subtitle">Upload file Order Excel từ Shopee</p></div></div>
            <div className={styles.uploadSection}>
                <div className={`${styles.uploadZone} ${isDragging ? styles.uploadZoneDragging : ''}`} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop} onClick={() => fileInputRef.current?.click()}>
                    <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={onInput} className={styles.fileInput} />
                    {isProcessing ? (<><Loader2 size={48} className={styles.uploadIcon} style={{ animation: 'spin 1s linear infinite' }} /><h2 className={styles.uploadTitle}>Đang phân tích...</h2><p className={styles.uploadSub}>{fileName}</p></>) : (<><UploadCloud size={48} className={styles.uploadIcon} /><h2 className={styles.uploadTitle}>Kéo thả file Order Excel vào đây</h2><p className={styles.uploadSub}>hoặc click để chọn file (.xlsx)</p></>)}
                </div>
            </div>
            {error && <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}><AlertTriangle size={16} />{error}</div>}
        </div>
    );

    const all = data.orders;
    const completed = all.filter(o => o.status === 'Hoàn thành' || o.status === 'Đã nhận hàng');
    const cancelled = all.filter(o => o.status === 'Đã hủy');

    return (
        <div>
            <div className="page-header">
                <div><h1 className="page-header__title">Phân tích Đơn hàng</h1><p className="page-header__subtitle">{formatNumber(all.length)} đơn · Tháng 1/2026</p></div>
                <button className="btn btn-primary" onClick={() => { setData(null); setFileName(''); }}><UploadCloud size={16} /> Upload file mới</button>
            </div>
            <div className={styles.fileInfoBar}><FileSpreadsheet size={20} className={styles.fileInfoIcon} /><div><div className={styles.fileInfoName}>{fileName}</div><div className={styles.fileInfoMeta}>{formatFileSize(fileSize)} · {formatNumber(all.length)} đơn · {formatNumber(completed.length)} hoàn thành · {formatNumber(cancelled.length)} hủy</div></div></div>
            <div className={styles.tabNav}>{TABS.map(t => { const I = t.icon; return <button key={t.id} className={`${styles.tabBtn} ${activeTab === t.id ? styles.tabBtnActive : ''}`} onClick={() => setActiveTab(t.id)}><I size={16} />{t.label}</button>; })}</div>
            {activeTab === 'funnel' && <TabFunnel all={all} completed={completed} cancelled={cancelled} />}
            {activeTab === 'products' && <TabProducts completed={completed} />}
            {activeTab === 'regional' && <TabRegional completed={completed} />}
            {activeTab === 'behavior' && <TabBehavior all={all} completed={completed} />}
            {activeTab === 'pricing' && <TabPricing all={all} completed={completed} cancelled={cancelled} />}
            {activeTab === 'returns' && <TabReturns all={all} />}
        </div>
    );
}

// ===== TAB 1: Order Funnel =====
function TabFunnel({ all, completed, cancelled }: { all: ShopeeOrder[]; completed: ShopeeOrder[]; cancelled: ShopeeOrder[] }) {
    const returned = all.filter(o => o.returnStatus !== '');
    const completionRate = all.length > 0 ? (completed.length / all.length) * 100 : 0;
    const cancelRate = all.length > 0 ? (cancelled.length / all.length) * 100 : 0;
    const totalRevenue = completed.reduce((s, o) => s + o.totalProductPrice, 0);
    const aov = completed.length > 0 ? totalRevenue / completed.length : 0;

    // Status pie
    const statusMap: Record<string, number> = {};
    all.forEach(o => { statusMap[o.status] = (statusMap[o.status] || 0) + 1; });
    const statusPie = Object.entries(statusMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    // Cancel reasons
    const reasons: Record<string, number> = {};
    cancelled.forEach(o => { const r = o.cancelReason.replace(/^(Hủy bởi người mua\s+lí do là:\s*|Tự động hủy bởi hệ thống Shopee\s+lí do là:\s*)/i, '').substring(0, 50) || 'Không rõ'; reasons[r] = (reasons[r] || 0) + 1; });
    const cancelData = Object.entries(reasons).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);

    // Daily orders
    const dailyMap: Record<string, { total: number; done: number; cancel: number }> = {};
    all.forEach(o => { const d = o.orderDate.substring(0, 10); if (!dailyMap[d]) dailyMap[d] = { total: 0, done: 0, cancel: 0 }; dailyMap[d].total++; if (o.status === 'Hoàn thành' || o.status === 'Đã nhận hàng') dailyMap[d].done++; if (o.status === 'Đã hủy') dailyMap[d].cancel++; });
    const dailyData = Object.entries(dailyMap).sort().map(([d, v]) => ({ date: d.substring(5), ...v }));

    return (<>
        <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}><div className={styles.summaryCardHeader}><span className={styles.summaryCardLabel}>Tổng đơn</span><div className={styles.summaryCardIconWrap} style={{ background: '#2dd4bf15', color: '#2dd4bf' }}><ShoppingCart size={18} /></div></div><div className={styles.summaryCardValue}>{formatNumber(all.length)}</div><div className={styles.summaryCardSub}>Hoàn thành {formatPercent(completionRate)}</div></div>
            <div className={styles.summaryCard}><div className={styles.summaryCardHeader}><span className={styles.summaryCardLabel}>Hoàn thành</span><div className={styles.summaryCardIconWrap} style={{ background: '#22c55e15', color: '#22c55e' }}><TrendingUp size={18} /></div></div><div className={styles.summaryCardValue} style={{ color: '#22c55e' }}>{formatNumber(completed.length)}</div><div className={styles.summaryCardSub}>{formatShortCurrency(totalRevenue)}</div></div>
            <div className={styles.summaryCard}><div className={styles.summaryCardHeader}><span className={styles.summaryCardLabel}>Đã hủy</span><div className={styles.summaryCardIconWrap} style={{ background: '#ef444415', color: '#ef4444' }}><TrendingDown size={18} /></div></div><div className={styles.summaryCardValue} style={{ color: '#ef4444' }}>{formatNumber(cancelled.length)}</div><div className={styles.summaryCardSub}>Tỷ lệ {formatPercent(cancelRate)}</div></div>
            <div className={styles.summaryCard}><div className={styles.summaryCardHeader}><span className={styles.summaryCardLabel}>AOV</span><div className={styles.summaryCardIconWrap} style={{ background: '#818cf815', color: '#818cf8' }}><DollarSign size={18} /></div></div><div className={styles.summaryCardValue}>{formatShortCurrency(aov)}</div><div className={styles.summaryCardSub}>Trả hàng: {returned.length}</div></div>
        </div>
        <div className={styles.chartsRow}>
            <div className={`card ${styles.chartCard}`}><h3 className={styles.chartTitle}><Percent size={18} style={{ color: '#2dd4bf' }} />Trạng thái Đơn hàng</h3><div className={styles.chartContainer}><ResponsiveContainer width="100%" height={300}><PieChart><Pie data={statusPie} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>{statusPie.map((s, i) => <Cell key={i} fill={STATUS_COLORS[s.name] || PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)' }} formatter={(v: number | undefined) => [`${v ?? 0} đơn`, '']} /></PieChart></ResponsiveContainer></div></div>
            <div className={`card ${styles.chartCard}`}><h3 className={styles.chartTitle}><TrendingDown size={18} style={{ color: '#ef4444' }} />Lý do Hủy đơn</h3><div className={styles.chartContainer}><ResponsiveContainer width="100%" height={300}><BarChart data={cancelData} layout="vertical" margin={{ left: 100 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" /><XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} /><YAxis type="category" dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} width={100} /><Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)' }} /><Bar dataKey="value" name="Số đơn" fill="#ef4444" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div></div>
        </div>
        <div className={`card ${styles.chartCard}`}><h3 className={styles.chartTitle}><BarChart3 size={18} style={{ color: '#2dd4bf' }} />Đơn hàng theo ngày</h3><div className={styles.chartContainer}><ResponsiveContainer width="100%" height={300}><BarChart data={dailyData} barCategoryGap="10%"><CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" /><XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} /><YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} /><Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)' }} /><Legend /><Bar dataKey="done" name="Hoàn thành" stackId="a" fill="#22c55e" /><Bar dataKey="cancel" name="Hủy" stackId="a" fill="#ef4444" /></BarChart></ResponsiveContainer></div></div>
    </>);
}

// ===== TAB 2: Product Performance =====
function TabProducts({ completed }: { completed: ShopeeOrder[] }) {
    const skuMap: Record<string, { name: string; qty: number; revenue: number; orders: number }> = {};
    completed.forEach(o => { if (!skuMap[o.sku]) skuMap[o.sku] = { name: o.productName.substring(0, 60), qty: 0, revenue: 0, orders: 0 }; skuMap[o.sku].qty += o.quantity; skuMap[o.sku].revenue += o.totalProductPrice; skuMap[o.sku].orders++; });
    const products = Object.entries(skuMap).map(([sku, d]) => ({ sku, ...d, aov: d.orders > 0 ? d.revenue / d.orders : 0 })).sort((a, b) => b.revenue - a.revenue);
    const totalQty = products.reduce((s, p) => s + p.qty, 0);
    const totalRev = products.reduce((s, p) => s + p.revenue, 0);

    // Variant analysis
    const varMap: Record<string, number> = {};
    completed.forEach(o => { const v = o.variantName || 'N/A'; varMap[v] = (varMap[v] || 0) + o.quantity; });
    const variants = Object.entries(varMap).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([name, value]) => ({ name: name.length > 20 ? name.substring(0, 20) : name, value }));

    const chartData = products.slice(0, 10).map(p => ({ name: p.sku, qty: p.qty, revenue: p.revenue / 1e6 }));

    return (<>
        <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}><div className={styles.summaryCardLabel}>Tổng SKU</div><div className={styles.summaryCardValue}>{products.length}</div><div className={styles.summaryCardSub}>Sản phẩm bán được</div></div>
            <div className={styles.summaryCard}><div className={styles.summaryCardLabel}>Tổng SL bán</div><div className={styles.summaryCardValue}>{formatNumber(totalQty)}</div><div className={styles.summaryCardSub}>{(totalQty / 31).toFixed(1)} sp/ngày</div></div>
            <div className={styles.summaryCard}><div className={styles.summaryCardLabel}>Doanh thu SP</div><div className={styles.summaryCardValue}>{formatShortCurrency(totalRev)}</div><div className={styles.summaryCardSub}>Từ đơn hoàn thành</div></div>
            <div className={styles.summaryCard}><div className={styles.summaryCardLabel}>Top 1 SKU</div><div className={styles.summaryCardValue} style={{ color: '#2dd4bf', fontSize: '1.1rem' }}>{products[0]?.sku || '-'}</div><div className={styles.summaryCardSub}>{products[0] ? `${products[0].qty} sp · ${formatShortCurrency(products[0].revenue)}` : ''}</div></div>
        </div>
        <div className={styles.chartsRow}>
            <div className={`card ${styles.chartCard}`}><h3 className={styles.chartTitle}><BarChart3 size={18} style={{ color: '#2dd4bf' }} />Top 10 SKU theo Doanh thu</h3><div className={styles.chartContainer}><ResponsiveContainer width="100%" height={350}><BarChart data={chartData} layout="vertical" margin={{ left: 60 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" /><XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={v => `${v}M`} /><YAxis type="category" dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} width={60} /><Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)' }} formatter={(v: number | undefined) => [`${(v ?? 0).toFixed(1)}M`, '']} /><Bar dataKey="revenue" name="Doanh thu (M)" fill="#2dd4bf" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div></div>
            <div className={`card ${styles.chartCard}`}><h3 className={styles.chartTitle}><Package size={18} style={{ color: '#818cf8' }} />Top Phân loại bán chạy</h3><div className={styles.chartContainer}><ResponsiveContainer width="100%" height={350}><BarChart data={variants} layout="vertical" margin={{ left: 100 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" /><XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} /><YAxis type="category" dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} width={100} /><Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)' }} /><Bar dataKey="value" name="Số lượng" fill="#818cf8" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div></div>
        </div>
        <div className={`card ${styles.tableSection}`}><h3 className={styles.sectionTitle}>Chi tiết theo SKU</h3><div className={styles.tableWrap}><table className="table"><thead><tr><th>#</th><th>SKU</th><th>Tên SP</th><th style={{ textAlign: 'right' }}>SL</th><th style={{ textAlign: 'right' }}>Đơn</th><th style={{ textAlign: 'right' }}>Doanh thu</th><th style={{ textAlign: 'right' }}>AOV</th><th style={{ textAlign: 'right' }}>% DT</th></tr></thead><tbody>{products.slice(0, 20).map((p, i) => <tr key={i}><td style={{ fontWeight: 700, color: '#2dd4bf' }}>{i + 1}</td><td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{p.sku}</td><td style={{ fontSize: '0.78rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</td><td style={{ textAlign: 'right' }}>{p.qty}</td><td style={{ textAlign: 'right' }}>{p.orders}</td><td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(p.revenue)}</td><td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(p.aov)}</td><td style={{ textAlign: 'right' }}>{totalRev > 0 ? (p.revenue / totalRev * 100).toFixed(1) : 0}%</td></tr>)}</tbody></table></div></div>
    </>);
}

// ===== TAB 3: Regional =====
function TabRegional({ completed }: { completed: ShopeeOrder[] }) {
    const provMap: Record<string, { count: number; revenue: number }> = {};
    completed.forEach(o => { const p = o.province || 'N/A'; if (!provMap[p]) provMap[p] = { count: 0, revenue: 0 }; provMap[p].count++; provMap[p].revenue += o.totalProductPrice; });
    const provinces = Object.entries(provMap).map(([name, d]) => ({ name, ...d, aov: d.count > 0 ? d.revenue / d.count : 0 })).sort((a, b) => b.count - a.count);
    const totalOrders = completed.length;
    const top5 = provinces.slice(0, 5);
    const top5Pct = totalOrders > 0 ? (top5.reduce((s, p) => s + p.count, 0) / totalOrders * 100) : 0;

    const chartData = provinces.slice(0, 15).map(p => ({ name: p.name.replace('TP. ', '').substring(0, 12), orders: p.count, revenue: p.revenue / 1e6 }));

    return (<>
        <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}><div className={styles.summaryCardLabel}>Số tỉnh/TP</div><div className={styles.summaryCardValue}>{provinces.length}</div><div className={styles.summaryCardSub}>Có đơn hoàn thành</div></div>
            <div className={styles.summaryCard}><div className={styles.summaryCardLabel}>Top 1</div><div className={styles.summaryCardValue} style={{ color: '#2dd4bf', fontSize: '1rem' }}>{provinces[0]?.name || '-'}</div><div className={styles.summaryCardSub}>{provinces[0] ? `${provinces[0].count} đơn (${(provinces[0].count / totalOrders * 100).toFixed(0)}%)` : ''}</div></div>
            <div className={styles.summaryCard}><div className={styles.summaryCardLabel}>Top 5 chiếm</div><div className={styles.summaryCardValue}>{formatPercent(top5Pct)}</div><div className={styles.summaryCardSub}>tổng đơn hoàn thành</div></div>
            <div className={styles.summaryCard}><div className={styles.summaryCardLabel}>AOV cao nhất</div><div className={styles.summaryCardValue}>{formatShortCurrency([...provinces].sort((a, b) => b.aov - a.aov)[0]?.aov || 0)}</div><div className={styles.summaryCardSub}>{[...provinces].sort((a, b) => b.aov - a.aov)[0]?.name || ''}</div></div>
        </div>
        <div className={`card ${styles.chartCard}`}><h3 className={styles.chartTitle}><MapPin size={18} style={{ color: '#2dd4bf' }} />Top 15 Tỉnh/Thành phố</h3><div className={styles.chartContainer}><ResponsiveContainer width="100%" height={400}><BarChart data={chartData} layout="vertical" margin={{ left: 80 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" /><XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} /><YAxis type="category" dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} width={80} /><Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)' }} /><Legend /><Bar dataKey="orders" name="Số đơn" fill="#2dd4bf" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div></div>
        <div className={`card ${styles.tableSection}`}><h3 className={styles.sectionTitle}>Chi tiết theo Tỉnh/TP</h3><div className={styles.tableWrap}><table className="table"><thead><tr><th>#</th><th>Tỉnh/TP</th><th style={{ textAlign: 'right' }}>Đơn</th><th style={{ textAlign: 'right' }}>% Tổng</th><th style={{ textAlign: 'right' }}>Doanh thu</th><th style={{ textAlign: 'right' }}>AOV</th></tr></thead><tbody>{provinces.slice(0, 25).map((p, i) => <tr key={i}><td style={{ fontWeight: 700, color: '#2dd4bf' }}>{i + 1}</td><td>{p.name}</td><td style={{ textAlign: 'right' }}>{p.count}</td><td style={{ textAlign: 'right' }}>{(p.count / totalOrders * 100).toFixed(1)}%</td><td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(p.revenue)}</td><td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(p.aov)}</td></tr>)}</tbody></table></div></div>
    </>);
}

// ===== TAB 4: Customer Behavior =====
function TabBehavior({ all, completed }: { all: ShopeeOrder[]; completed: ShopeeOrder[] }) {
    // Hourly
    const hourMap: Record<string, number> = {};
    completed.forEach(o => { const h = o.orderDate.split(' ')[1]?.split(':')[0]; if (h) hourMap[h] = (hourMap[h] || 0) + 1; });
    const hourData = Array.from({ length: 24 }, (_, i) => { const h = String(i).padStart(2, '0'); return { hour: `${h}h`, orders: hourMap[h] || 0 }; });
    const peakHour = hourData.reduce((a, b) => b.orders > a.orders ? b : a, hourData[0]);

    // Payment methods
    const pmMap: Record<string, number> = {};
    all.forEach(o => { const m = o.paymentMethod || 'N/A'; pmMap[m] = (pmMap[m] || 0) + 1; });
    const pmData = Object.entries(pmMap).map(([name, value]) => ({ name: name.substring(0, 25), value })).sort((a, b) => b.value - a.value);

    // Carrier
    const carrierMap: Record<string, number> = {};
    all.forEach(o => { const c = o.carrier || 'N/A'; carrierMap[c] = (carrierMap[c] || 0) + 1; });
    const carrierData = Object.entries(carrierMap).map(([name, value]) => ({ name: name.substring(0, 20), value })).sort((a, b) => b.value - a.value);

    return (<>
        <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}><div className={styles.summaryCardLabel}>Giờ cao điểm</div><div className={styles.summaryCardValue} style={{ color: '#f59e0b' }}>{peakHour.hour}</div><div className={styles.summaryCardSub}>{peakHour.orders} đơn</div></div>
            <div className={styles.summaryCard}><div className={styles.summaryCardLabel}>PTTT phổ biến</div><div className={styles.summaryCardValue} style={{ fontSize: '0.95rem' }}>{pmData[0]?.name || '-'}</div><div className={styles.summaryCardSub}>{pmData[0] ? `${pmData[0].value} đơn (${(pmData[0].value / all.length * 100).toFixed(0)}%)` : ''}</div></div>
            <div className={styles.summaryCard}><div className={styles.summaryCardLabel}>ĐV vận chuyển chính</div><div className={styles.summaryCardValue} style={{ fontSize: '0.9rem' }}>{carrierData[0]?.name || '-'}</div><div className={styles.summaryCardSub}>{carrierData[0] ? `${carrierData[0].value} đơn` : ''}</div></div>
            <div className={styles.summaryCard}><div className={styles.summaryCardLabel}>Số PTTT</div><div className={styles.summaryCardValue}>{pmData.length}</div><div className={styles.summaryCardSub}>phương thức</div></div>
        </div>
        <div className={`card ${styles.chartCard}`}><h3 className={styles.chartTitle}><Clock size={18} style={{ color: '#f59e0b' }} />Phân bố Giờ đặt hàng</h3><div className={styles.chartContainer}><ResponsiveContainer width="100%" height={300}><BarChart data={hourData} barCategoryGap="8%"><CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" /><XAxis dataKey="hour" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} /><YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} /><Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)' }} /><Bar dataKey="orders" name="Đơn" fill="#f59e0b" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
        <div className={styles.chartsRow}>
            <div className={`card ${styles.chartCard}`}><h3 className={styles.chartTitle}><DollarSign size={18} style={{ color: '#818cf8' }} />Phương thức Thanh toán</h3><div className={styles.chartContainer}><ResponsiveContainer width="100%" height={300}><PieChart><Pie data={pmData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>{pmData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)' }} formatter={(v: number | undefined) => [`${v ?? 0} đơn`, '']} /></PieChart></ResponsiveContainer></div></div>
            <div className={`card ${styles.chartCard}`}><h3 className={styles.chartTitle}><Package size={18} style={{ color: '#2dd4bf' }} />Đơn vị Vận chuyển</h3><div className={styles.chartContainer}><ResponsiveContainer width="100%" height={300}><PieChart><Pie data={carrierData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>{carrierData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)' }} formatter={(v: number | undefined) => [`${v ?? 0} đơn`, '']} /></PieChart></ResponsiveContainer></div></div>
        </div>
    </>);
}

// ===== TAB 5: Pricing Strategy =====
function TabPricing({ all, completed, cancelled }: { all: ShopeeOrder[]; completed: ShopeeOrder[]; cancelled: ShopeeOrder[] }) {
    const totalOriginal = completed.reduce((s, o) => s + o.originalPrice * o.quantity, 0);
    const totalSeller = completed.reduce((s, o) => s + o.sellerDiscount * o.quantity, 0);
    const totalSale = completed.reduce((s, o) => s + o.totalProductPrice, 0);
    const discountRate = totalOriginal > 0 ? (totalSeller / totalOriginal * 100) : 0;
    const totalFees = completed.reduce((s, o) => s + Math.abs(o.fixedFee) + Math.abs(o.serviceFee) + Math.abs(o.paymentFee), 0);
    const feeRate = totalSale > 0 ? (totalFees / totalSale * 100) : 0;

    // Discount vs no-discount cancel rate
    const withDisc = all.filter(o => o.sellerDiscount > 0);
    const noDisc = all.filter(o => o.sellerDiscount === 0);
    const discCancelRate = withDisc.length > 0 ? (withDisc.filter(o => o.status === 'Đã hủy').length / withDisc.length * 100) : 0;
    const noDiscCancelRate = noDisc.length > 0 ? (noDisc.filter(o => o.status === 'Đã hủy').length / noDisc.length * 100) : 0;

    // Price range distribution
    const ranges = [{ range: '<100K', min: 0, max: 100000 }, { range: '100-200K', min: 100000, max: 200000 }, { range: '200-300K', min: 200000, max: 300000 }, { range: '300-500K', min: 300000, max: 500000 }, { range: '>500K', min: 500000, max: Infinity }];
    const priceData = ranges.map(r => ({ range: r.range, completed: completed.filter(o => o.salePrice >= r.min && o.salePrice < r.max).length, cancelled: cancelled.filter(o => o.salePrice >= r.min && o.salePrice < r.max).length }));

    // Fee breakdown per SKU
    const skuFees: Record<string, { sku: string; revenue: number; fixedFee: number; serviceFee: number; paymentFee: number; total: number }> = {};
    completed.forEach(o => { if (!skuFees[o.sku]) skuFees[o.sku] = { sku: o.sku, revenue: 0, fixedFee: 0, serviceFee: 0, paymentFee: 0, total: 0 }; skuFees[o.sku].revenue += o.totalProductPrice; skuFees[o.sku].fixedFee += Math.abs(o.fixedFee); skuFees[o.sku].serviceFee += Math.abs(o.serviceFee); skuFees[o.sku].paymentFee += Math.abs(o.paymentFee); skuFees[o.sku].total += Math.abs(o.fixedFee) + Math.abs(o.serviceFee) + Math.abs(o.paymentFee); });
    const feeList = Object.values(skuFees).sort((a, b) => b.total - a.total).slice(0, 10);

    return (<>
        <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}><div className={styles.summaryCardLabel}>Giá gốc tổng</div><div className={styles.summaryCardValue}>{formatShortCurrency(totalOriginal)}</div><div className={styles.summaryCardSub}>Trước trợ giá</div></div>
            <div className={styles.summaryCard}><div className={styles.summaryCardLabel}>Seller trợ giá</div><div className={styles.summaryCardValue} style={{ color: '#ef4444' }}>{formatShortCurrency(totalSeller)}</div><div className={styles.summaryCardSub}>{formatPercent(discountRate)} giá gốc</div></div>
            <div className={styles.summaryCard}><div className={styles.summaryCardLabel}>Tổng phí sàn</div><div className={styles.summaryCardValue} style={{ color: '#f97316' }}>{formatShortCurrency(totalFees)}</div><div className={styles.summaryCardSub}>{formatPercent(feeRate)} doanh thu</div></div>
            <div className={styles.summaryCard}><div className={styles.summaryCardLabel}>Margin ước tính</div><div className={styles.summaryCardValue} style={{ color: '#22c55e' }}>{formatPercent(100 - discountRate - feeRate)}</div><div className={styles.summaryCardSub}>= 100% - trợ giá - phí</div></div>
        </div>
        <div className={styles.chartsRow}>
            <div className={`card ${styles.chartCard}`}><h3 className={styles.chartTitle}><BarChart3 size={18} style={{ color: '#818cf8' }} />Phân bố Giá bán vs Tỷ lệ hủy</h3><div className={styles.chartContainer}><ResponsiveContainer width="100%" height={300}><BarChart data={priceData} barCategoryGap="15%"><CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" /><XAxis dataKey="range" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} /><YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} /><Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)' }} /><Legend /><Bar dataKey="completed" name="Hoàn thành" fill="#22c55e" radius={[4, 4, 0, 0]} /><Bar dataKey="cancelled" name="Hủy" fill="#ef4444" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
            <div className={`card ${styles.chartCard}`}><h3 className={styles.chartTitle}><Tag size={18} style={{ color: '#f59e0b' }} />Hiệu quả Trợ giá</h3><div className={styles.feeGrid}><div className={styles.feeItem}><span className={styles.feeLabel}>Có trợ giá</span><span className={styles.feeValue}>{withDisc.length} đơn · Hủy {formatPercent(discCancelRate)}</span></div><div className={styles.feeItem}><span className={styles.feeLabel}>Không trợ giá</span><span className={styles.feeValue}>{noDisc.length} đơn · Hủy {formatPercent(noDiscCancelRate)}</span></div><div className={`${styles.feeItem} ${styles.feeTotal}`}><span className={styles.feeLabel}>Kết luận</span><span className={styles.feeValue} style={{ color: discCancelRate < noDiscCancelRate ? '#22c55e' : '#ef4444' }}>{discCancelRate < noDiscCancelRate ? '✅ Trợ giá giúp giảm hủy' : '⚠️ Trợ giá chưa hiệu quả giảm hủy'}</span></div></div></div>
        </div>
        <div className={`card ${styles.tableSection}`}><h3 className={styles.sectionTitle}>Chi phí sàn theo SKU (Top 10)</h3><div className={styles.tableWrap}><table className="table"><thead><tr><th>SKU</th><th style={{ textAlign: 'right' }}>Doanh thu</th><th style={{ textAlign: 'right' }}>Phí CĐ</th><th style={{ textAlign: 'right' }}>Phí DV</th><th style={{ textAlign: 'right' }}>Phí TT</th><th style={{ textAlign: 'right' }}>Tổng phí</th><th style={{ textAlign: 'right' }}>% DT</th></tr></thead><tbody>{feeList.map((f, i) => <tr key={i}><td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{f.sku}</td><td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(f.revenue)}</td><td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#ef4444' }}>{formatCurrency(f.fixedFee)}</td><td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#f97316' }}>{formatCurrency(f.serviceFee)}</td><td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#eab308' }}>{formatCurrency(f.paymentFee)}</td><td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{formatCurrency(f.total)}</td><td style={{ textAlign: 'right' }}>{f.revenue > 0 ? (f.total / f.revenue * 100).toFixed(1) : 0}%</td></tr>)}</tbody></table></div></div>
    </>);
}

// ===== TAB 6: Returns =====
function TabReturns({ all }: { all: ShopeeOrder[] }) {
    const returned = all.filter(o => o.returnStatus !== '');
    const returnedCompleted = all.filter(o => o.returnStatus === 'Đã Chấp Thuận Yêu Cầu');
    const totalReturnValue = returnedCompleted.reduce((s, o) => s + o.totalProductPrice, 0);
    const totalCompleted = all.filter(o => o.status === 'Hoàn thành' || o.status === 'Đã nhận hàng');
    const returnRate = totalCompleted.length > 0 ? (returnedCompleted.length / totalCompleted.length * 100) : 0;

    // Products with most returns
    const retSkuMap: Record<string, { sku: string; name: string; count: number; value: number }> = {};
    returnedCompleted.forEach(o => { if (!retSkuMap[o.sku]) retSkuMap[o.sku] = { sku: o.sku, name: o.productName.substring(0, 50), count: 0, value: 0 }; retSkuMap[o.sku].count++; retSkuMap[o.sku].value += o.totalProductPrice; });
    const retProducts = Object.values(retSkuMap).sort((a, b) => b.count - a.count);

    // Return status breakdown
    const statusMap: Record<string, number> = {};
    returned.forEach(o => { statusMap[o.returnStatus] = (statusMap[o.returnStatus] || 0) + 1; });
    const statusData = Object.entries(statusMap).map(([name, value]) => ({ name, value }));

    return (<>
        <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}><div className={styles.summaryCardLabel}>Yêu cầu trả hàng</div><div className={styles.summaryCardValue} style={{ color: '#ef4444' }}>{returned.length}</div><div className={styles.summaryCardSub}>Tổng yêu cầu</div></div>
            <div className={styles.summaryCard}><div className={styles.summaryCardLabel}>Đã chấp thuận</div><div className={styles.summaryCardValue}>{returnedCompleted.length}</div><div className={styles.summaryCardSub}>{formatShortCurrency(totalReturnValue)}</div></div>
            <div className={styles.summaryCard}><div className={styles.summaryCardLabel}>Tỷ lệ trả hàng</div><div className={styles.summaryCardValue}>{formatPercent(returnRate)} {returnRate < 5 ? '✅' : '⚠️'}</div><div className={styles.summaryCardSub}>Mục tiêu: dưới 5%</div></div>
            <div className={styles.summaryCard}><div className={styles.summaryCardLabel}>TB giá trị trả</div><div className={styles.summaryCardValue}>{formatShortCurrency(returnedCompleted.length > 0 ? totalReturnValue / returnedCompleted.length : 0)}</div><div className={styles.summaryCardSub}>mỗi đơn trả</div></div>
        </div>
        {retProducts.length > 0 && <div className={`card ${styles.chartCard}`}><h3 className={styles.chartTitle}><RefreshCw size={18} style={{ color: '#ef4444' }} />SP bị trả nhiều nhất</h3><div className={styles.chartContainer}><ResponsiveContainer width="100%" height={250}><BarChart data={retProducts.slice(0, 8)} layout="vertical" margin={{ left: 60 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" /><XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} /><YAxis type="category" dataKey="sku" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} width={60} /><Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)' }} /><Bar dataKey="count" name="Số đơn trả" fill="#ef4444" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div></div>}
        <div className={`card ${styles.tableSection}`}><h3 className={styles.sectionTitle}>Chi tiết đơn trả hàng</h3><div className={styles.tableWrap}><table className="table"><thead><tr><th>Mã đơn</th><th>SKU</th><th>Tên SP</th><th>Trạng thái</th><th style={{ textAlign: 'right' }}>Giá trị</th><th>Ngày đặt</th></tr></thead><tbody>{returned.map((o, i) => <tr key={i}><td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{o.orderId}</td><td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{o.sku}</td><td style={{ fontSize: '0.78rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.productName.substring(0, 40)}</td><td><span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', background: o.returnStatus === 'Đã Chấp Thuận Yêu Cầu' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)', color: o.returnStatus === 'Đã Chấp Thuận Yêu Cầu' ? '#ef4444' : '#f59e0b' }}>{o.returnStatus}</span></td><td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(o.totalProductPrice)}</td><td style={{ fontSize: '0.8rem' }}>{o.orderDate.substring(0, 10)}</td></tr>)}</tbody></table></div></div>
    </>);
}
