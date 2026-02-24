'use client';

import { useState, useMemo } from 'react';
import { ShoppingCart, Loader2 } from 'lucide-react';

interface ShopData {
    id: string;
    name: string;
    platform: string;
    monthlyData: {
        id: string;
        dataType: string;
        month: string;
        rawData?: string;
        totalOrders: number;
        totalRevenue: number;
    }[];
}

interface OrderRow {
    orderId: string;
    date: string;
    product: string;
    revenue: number;
    status: string;
    buyer?: string;
}

function fmtCur(v: number): string { return Math.round(v).toLocaleString('vi-VN') + 'đ'; }

export default function OrdersTab({ shop }: { shop: ShopData }) {
    const [selectedMonth, setSelectedMonth] = useState<string>('all');

    // Extract orders from rawData of type 'orders'
    const orderData = useMemo(() => {
        const rows: OrderRow[] = [];
        const orderMonthlyData = shop.monthlyData.filter(m => m.dataType === 'orders');

        for (const md of orderMonthlyData) {
            if (selectedMonth !== 'all' && md.month !== selectedMonth) continue;
            // rawData is not included in the shop detail fetch by default
            // Show summary from monthly data instead
        }

        return { months: orderMonthlyData, rows };
    }, [shop, selectedMonth]);

    const orderMonths = shop.monthlyData.filter(m => m.dataType === 'orders');
    const incomeMonths = shop.monthlyData.filter(m => m.dataType === 'income');
    const availableMonths = [...new Set([...orderMonths, ...incomeMonths].map(m => m.month))].sort();

    if (shop.monthlyData.length === 0) {
        return (
            <div style={{
                textAlign: 'center', padding: 60,
                background: 'var(--bg-secondary)', borderRadius: 12,
                border: '1px solid var(--border-default)',
            }}>
                <ShoppingCart size={48} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                    Chưa có dữ liệu đơn hàng. Hãy upload file Order trước.
                </p>
            </div>
        );
    }

    // Show order summary by month from the uploaded monthly data
    const orderSummary = shop.monthlyData
        .filter(m => m.dataType === 'orders')
        .sort((a, b) => a.month.localeCompare(b.month));

    const incomeSummary = shop.monthlyData
        .filter(m => m.dataType === 'income')
        .sort((a, b) => a.month.localeCompare(b.month));

    // Merge by month
    const allMonths = [...new Set([
        ...orderSummary.map(m => m.month),
        ...incomeSummary.map(m => m.month),
    ])].sort();

    return (
        <div style={{
            background: 'var(--bg-secondary)', borderRadius: 12,
            border: '1px solid var(--border-default)', padding: 20,
        }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShoppingCart size={18} style={{ color: '#818cf8' }} />
                Tổng hợp đơn hàng theo tháng
            </h3>

            <div style={{ overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                            <th style={thStyle}>Tháng</th>
                            <th style={{ ...thStyle, textAlign: 'right' }}>Số đơn (Orders)</th>
                            <th style={{ ...thStyle, textAlign: 'right' }}>Doanh thu (Orders)</th>
                            <th style={{ ...thStyle, textAlign: 'right' }}>Số đơn (Income)</th>
                            <th style={{ ...thStyle, textAlign: 'right' }}>Doanh thu (Income)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {allMonths.map(month => {
                            const ord = orderSummary.find(m => m.month === month);
                            const inc = incomeSummary.find(m => m.month === month);
                            return (
                                <tr key={month} style={{ borderBottom: '1px solid var(--border-default)' }}>
                                    <td style={tdStyle}>{month}</td>
                                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                                        {ord ? ord.totalOrders.toLocaleString('vi-VN') : '—'}
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: 'right', color: '#22c55e', fontWeight: 600 }}>
                                        {ord ? fmtCur(ord.totalRevenue) : '—'}
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                                        {inc ? inc.totalOrders.toLocaleString('vi-VN') : '—'}
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: 'right', color: '#2dd4bf', fontWeight: 600 }}>
                                        {inc ? fmtCur(inc.totalRevenue) : '—'}
                                    </td>
                                </tr>
                            );
                        })}
                        {/* Totals */}
                        <tr style={{ borderTop: '2px solid var(--border-default)', fontWeight: 700 }}>
                            <td style={tdStyle}>TỔNG</td>
                            <td style={{ ...tdStyle, textAlign: 'right' }}>
                                {orderSummary.reduce((s, m) => s + m.totalOrders, 0).toLocaleString('vi-VN')}
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'right', color: '#22c55e' }}>
                                {fmtCur(orderSummary.reduce((s, m) => s + m.totalRevenue, 0))}
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'right' }}>
                                {incomeSummary.reduce((s, m) => s + m.totalOrders, 0).toLocaleString('vi-VN')}
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'right', color: '#2dd4bf' }}>
                                {fmtCur(incomeSummary.reduce((s, m) => s + m.totalRevenue, 0))}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div style={{ marginTop: 12, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                * Dữ liệu từ file Income và Orders có thể khác nhau do phạm vi và cách tính.
            </div>
        </div>
    );
}

const thStyle: React.CSSProperties = {
    padding: '10px 8px', textAlign: 'left', fontWeight: 600,
    color: 'var(--text-secondary)', fontSize: '0.78rem', whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
    padding: '8px', color: 'var(--text-primary)', whiteSpace: 'nowrap',
};
