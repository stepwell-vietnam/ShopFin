'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
    Users, Store, DollarSign, ShoppingCart, TrendingUp, CreditCard, BarChart3, ArrowRight,
} from 'lucide-react';
import { isAdminEmail } from '@/lib/admin';

interface UserStat {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    shopCount: number;
    platforms: string[];
    totalRevenue: number;
    totalSettlement: number;
    totalOrders: number;
    totalFees: number;
}

interface PlatformStat {
    platform: string;
    shopCount: number;
    revenue: number;
    orders: number;
}

interface MonthlyTrend {
    month: string;
    revenue: number;
    settlement: number;
    fees: number;
    orders: number;
}

interface Totals {
    totalUsers: number;
    totalShops: number;
    totalRevenue: number;
    totalSettlement: number;
    totalFees: number;
    totalOrders: number;
}

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));
const fmtCurrency = (n: number) => {
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}Bđ`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}Mđ`;
    return `${fmt(n)}đ`;
};

export default function AdminDashboardPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [totals, setTotals] = useState<Totals | null>(null);
    const [userStats, setUserStats] = useState<UserStat[]>([]);
    const [platformStats, setPlatformStats] = useState<PlatformStat[]>([]);
    const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrend[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (status === 'loading') return;
        if (!session?.user?.email || !isAdminEmail(session.user.email)) {
            router.push('/dashboard');
            return;
        }

        fetch('/api/admin/dashboard')
            .then(r => r.json())
            .then(data => {
                setTotals(data.totals);
                setUserStats(data.userStats || []);
                setPlatformStats(data.platformStats || []);
                setMonthlyTrend(data.monthlyTrend || []);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [session, status, router]);

    if (status === 'loading' || loading) {
        return (
            <div className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>⏳</div>
                    Đang tải Dashboard tổng hợp...
                </div>
            </div>
        );
    }

    const marginPercent = totals && totals.totalRevenue > 0
        ? ((totals.totalRevenue - totals.totalFees) / totals.totalRevenue * 100).toFixed(1)
        : '0';

    return (
        <main className="main-content">
            {/* Header */}
            <div className="page-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <BarChart3 size={28} style={{ color: 'var(--accent-primary)' }} />
                    <div>
                        <h1 className="page-header__title">Dashboard Tổng hợp</h1>
                        <p className="page-header__subtitle">Toàn bộ hệ thống ShopFin</p>
                    </div>
                </div>
            </div>

            {/* System KPIs */}
            {totals && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
                    <div className="kpi-card kpi-card--blue">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                            <Users size={16} style={{ color: 'var(--accent-secondary)' }} />
                            <span className="kpi-card__label" style={{ marginBottom: 0, fontSize: '0.7rem' }}>Users</span>
                        </div>
                        <div className="kpi-card__value" style={{ fontSize: '1.4rem' }}>{totals.totalUsers}</div>
                    </div>
                    <div className="kpi-card kpi-card--green">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                            <Store size={16} style={{ color: 'var(--color-success)' }} />
                            <span className="kpi-card__label" style={{ marginBottom: 0, fontSize: '0.7rem' }}>Shops</span>
                        </div>
                        <div className="kpi-card__value" style={{ fontSize: '1.4rem' }}>{totals.totalShops}</div>
                    </div>
                    <div className="kpi-card kpi-card--green">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                            <DollarSign size={16} style={{ color: 'var(--color-success)' }} />
                            <span className="kpi-card__label" style={{ marginBottom: 0, fontSize: '0.7rem' }}>Doanh thu</span>
                        </div>
                        <div className="kpi-card__value" style={{ fontSize: '1.3rem', color: 'var(--color-success)' }}>{fmtCurrency(totals.totalRevenue)}</div>
                    </div>
                    <div className="kpi-card kpi-card--red">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                            <TrendingUp size={16} style={{ color: 'var(--color-danger)' }} />
                            <span className="kpi-card__label" style={{ marginBottom: 0, fontSize: '0.7rem' }}>Tổng phí</span>
                        </div>
                        <div className="kpi-card__value" style={{ fontSize: '1.3rem', color: 'var(--color-danger)' }}>{fmtCurrency(totals.totalFees)}</div>
                    </div>
                    <div className="kpi-card kpi-card--orange">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                            <CreditCard size={16} style={{ color: 'var(--accent-primary)' }} />
                            <span className="kpi-card__label" style={{ marginBottom: 0, fontSize: '0.7rem' }}>Thu ròng</span>
                        </div>
                        <div className="kpi-card__value" style={{ fontSize: '1.3rem', color: 'var(--accent-primary)' }}>{fmtCurrency(totals.totalSettlement)}</div>
                    </div>
                    <div className="kpi-card kpi-card--orange">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                            <ShoppingCart size={16} style={{ color: 'var(--color-warning)' }} />
                            <span className="kpi-card__label" style={{ marginBottom: 0, fontSize: '0.7rem' }}>Đơn hàng</span>
                        </div>
                        <div className="kpi-card__value" style={{ fontSize: '1.4rem' }}>{fmt(totals.totalOrders)}</div>
                    </div>
                </div>
            )}

            {/* Platform Breakdown + Margin */}
            <div className="grid-3" style={{ marginBottom: 'var(--space-xl)' }}>
                {platformStats.map(ps => (
                    <div key={ps.platform} className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{
                            width: 48, height: 48, borderRadius: 12,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '1.5rem',
                            background: ps.platform === 'shopee' ? 'var(--color-warning-dim)' : 'var(--color-danger-dim)',
                        }}>
                            {ps.platform === 'shopee' ? '🟠' : '🎵'}
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: '1rem', textTransform: 'capitalize' }}>{ps.platform}</div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                                {ps.shopCount} shops · {fmt(ps.orders)} đơn
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 700, color: 'var(--color-success)', fontSize: '1.1rem' }}>{fmtCurrency(ps.revenue)}</div>
                        </div>
                    </div>
                ))}
                <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{
                        width: 48, height: 48, borderRadius: 12,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.5rem',
                        background: 'var(--accent-primary-dim)',
                    }}>
                        📊
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '1rem' }}>Biên lợi nhuận</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                            Sau phí sàn + thuế
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, color: 'var(--accent-primary)', fontSize: '1.4rem' }}>{marginPercent}%</div>
                    </div>
                </div>
            </div>

            {/* Monthly Trend Table */}
            {monthlyTrend.length > 0 && (
                <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 'var(--space-xl)' }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-default)' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>📈 Xu hướng theo tháng</h3>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Tháng</th>
                                    <th className="text-right">Doanh thu</th>
                                    <th className="text-right">Đơn hàng</th>
                                    <th className="text-right">Phí</th>
                                    <th className="text-right">Thu ròng</th>
                                    <th className="text-right">Biên LN</th>
                                </tr>
                            </thead>
                            <tbody>
                                {monthlyTrend.map(m => (
                                    <tr key={m.month}>
                                        <td style={{ fontWeight: 500 }}>{m.month}</td>
                                        <td className="text-right" style={{ color: 'var(--color-success)' }}>{fmtCurrency(m.revenue)}</td>
                                        <td className="text-right">{fmt(m.orders)}</td>
                                        <td className="text-right" style={{ color: 'var(--color-danger)' }}>{fmtCurrency(m.fees)}</td>
                                        <td className="text-right" style={{ color: 'var(--accent-primary)' }}>{fmtCurrency(m.settlement)}</td>
                                        <td className="text-right" style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                                            {m.revenue > 0 ? `${((m.revenue - m.fees) / m.revenue * 100).toFixed(1)}%` : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* User Ranking */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>🏆 Xếp hạng Users theo Doanh thu</h3>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>User</th>
                                <th className="text-right">Shops</th>
                                <th>Nền tảng</th>
                                <th className="text-right">Doanh thu</th>
                                <th className="text-right">Đơn hàng</th>
                                <th className="text-right">Phí</th>
                                <th className="text-right">Thu ròng</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {userStats.map((user, idx) => (
                                <tr
                                    key={user.id}
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => router.push(`/admin/users/${user.id}/dashboard`)}
                                >
                                    <td style={{ fontWeight: 700, color: idx < 3 ? 'var(--color-warning)' : 'var(--text-muted)', width: 40 }}>
                                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            {user.image ? (
                                                <img src={user.image} alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} />
                                            ) : (
                                                <div style={{
                                                    width: 28, height: 28, borderRadius: '50%',
                                                    background: 'var(--bg-tertiary)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: '0.7rem', fontWeight: 600,
                                                }}>
                                                    {(user.name || '?')[0].toUpperCase()}
                                                </div>
                                            )}
                                            <span style={{ fontWeight: 500 }}>{user.name || user.email || '—'}</span>
                                        </div>
                                    </td>
                                    <td className="text-right">
                                        <span className="badge badge--info">{user.shopCount}</span>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            {user.platforms.map(p => (
                                                <span key={p} style={{ fontSize: '0.9rem' }}>
                                                    {p === 'shopee' ? '🟠' : '🎵'}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="text-right" style={{ fontWeight: 600, color: 'var(--color-success)' }}>
                                        {user.totalRevenue > 0 ? fmtCurrency(user.totalRevenue) : '—'}
                                    </td>
                                    <td className="text-right">{user.totalOrders > 0 ? fmt(user.totalOrders) : '—'}</td>
                                    <td className="text-right" style={{ color: 'var(--color-danger)' }}>
                                        {user.totalFees > 0 ? fmtCurrency(user.totalFees) : '—'}
                                    </td>
                                    <td className="text-right" style={{ color: 'var(--accent-primary)' }}>
                                        {user.totalSettlement > 0 ? fmtCurrency(user.totalSettlement) : '—'}
                                    </td>
                                    <td style={{ width: 40 }}>
                                        <ArrowRight size={16} style={{ color: 'var(--text-muted)' }} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </main>
    );
}
