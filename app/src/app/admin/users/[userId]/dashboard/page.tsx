'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import {
    ArrowLeft, Store, DollarSign, ShoppingCart, TrendingUp, CreditCard,
    CheckCircle, XCircle,
} from 'lucide-react';
import { isAdminEmail } from '@/lib/admin';

interface ShopStat {
    id: string;
    name: string;
    platform: string;
    revenue: number;
    settlement: number;
    fees: number;
    orders: number;
    completed: number;
    cancelled: number;
    monthlyRevenue: { month: string; revenue: number; settlement: number; fees: number }[];
}

interface PlatformStat {
    platform: string;
    revenue: number;
    orders: number;
    shopCount: number;
}

interface UserInfo {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
}

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));
const fmtCurrency = (n: number) => `${fmt(n)}đ`;

export default function AdminUserDashboard() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const params = useParams();
    const userId = params.userId as string;

    const [user, setUser] = useState<UserInfo | null>(null);
    const [shopStats, setShopStats] = useState<ShopStat[]>([]);
    const [platformStats, setPlatformStats] = useState<PlatformStat[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (status === 'loading') return;
        if (!session?.user?.email || !isAdminEmail(session.user.email)) {
            router.push('/dashboard');
            return;
        }

        fetch(`/api/admin/users/${userId}/dashboard`)
            .then(r => r.json())
            .then(data => {
                setUser(data.user);
                setShopStats(data.shopStats || []);
                setPlatformStats(data.platformStats || []);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [session, status, userId, router]);

    if (status === 'loading' || loading) {
        return (
            <div className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>⏳</div>
                    Đang tải dữ liệu...
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="main-content">
                <div className="empty-state">
                    <div className="empty-state__icon">❌</div>
                    <div className="empty-state__title">Không tìm thấy user</div>
                    <button className="btn btn-secondary" onClick={() => router.push('/admin/users')}>
                        <ArrowLeft size={16} /> Quay lại
                    </button>
                </div>
            </div>
        );
    }

    const totalRevenue = shopStats.reduce((s, sh) => s + sh.revenue, 0);
    const totalSettlement = shopStats.reduce((s, sh) => s + sh.settlement, 0);
    const totalFees = shopStats.reduce((s, sh) => s + sh.fees, 0);
    const totalOrders = shopStats.reduce((s, sh) => s + sh.orders, 0);
    const totalCompleted = shopStats.reduce((s, sh) => s + sh.completed, 0);
    const totalCancelled = shopStats.reduce((s, sh) => s + sh.cancelled, 0);

    return (
        <main className="main-content">
            {/* Header */}
            <div style={{ marginBottom: 'var(--space-xl)' }}>
                <button
                    onClick={() => router.push('/admin/users')}
                    className="btn btn-secondary"
                    style={{ marginBottom: 16, padding: '6px 14px', fontSize: '0.8rem' }}
                >
                    <ArrowLeft size={14} /> Quay lại danh sách
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    {user.image ? (
                        <img src={user.image} alt="" style={{ width: 48, height: 48, borderRadius: '50%' }} />
                    ) : (
                        <div style={{
                            width: 48, height: 48, borderRadius: '50%',
                            background: 'var(--bg-tertiary)', display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                            fontSize: '1.2rem', fontWeight: 700,
                        }}>
                            {(user.name || '?')[0].toUpperCase()}
                        </div>
                    )}
                    <div>
                        <h1 className="page-header__title">{user.name || 'Chưa đặt tên'}</h1>
                        <p className="page-header__subtitle">{user.email} · {shopStats.length} gian hàng</p>
                    </div>
                    <span className="badge badge--info" style={{ marginLeft: 8 }}>Xem dữ liệu</span>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid-4" style={{ marginBottom: 'var(--space-xl)' }}>
                <div className="kpi-card kpi-card--green">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <DollarSign size={18} style={{ color: 'var(--color-success)' }} />
                        <span className="kpi-card__label" style={{ marginBottom: 0 }}>Tổng doanh thu</span>
                    </div>
                    <div className="kpi-card__value" style={{ color: 'var(--color-success)', fontSize: '1.5rem' }}>{fmtCurrency(totalRevenue)}</div>
                </div>
                <div className="kpi-card kpi-card--blue">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <ShoppingCart size={18} style={{ color: 'var(--accent-secondary)' }} />
                        <span className="kpi-card__label" style={{ marginBottom: 0 }}>Tổng đơn</span>
                    </div>
                    <div className="kpi-card__value" style={{ fontSize: '1.5rem' }}>{fmt(totalOrders)}</div>
                </div>
                <div className="kpi-card kpi-card--red">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <TrendingUp size={18} style={{ color: 'var(--color-danger)' }} />
                        <span className="kpi-card__label" style={{ marginBottom: 0 }}>Tổng phí</span>
                    </div>
                    <div className="kpi-card__value" style={{ color: 'var(--color-danger)', fontSize: '1.5rem' }}>{fmtCurrency(totalFees)}</div>
                </div>
                <div className="kpi-card kpi-card--orange">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <CreditCard size={18} style={{ color: 'var(--accent-primary)' }} />
                        <span className="kpi-card__label" style={{ marginBottom: 0 }}>Thu ròng</span>
                    </div>
                    <div className="kpi-card__value" style={{ color: 'var(--accent-primary)', fontSize: '1.5rem' }}>{fmtCurrency(totalSettlement)}</div>
                </div>
            </div>

            {/* Platform Comparison */}
            {platformStats.length > 0 && (
                <div className="grid-2" style={{ marginBottom: 'var(--space-xl)' }}>
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
                                    {ps.shopCount} gian hàng · {fmt(ps.orders)} đơn
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontWeight: 700, color: 'var(--color-success)', fontSize: '1.1rem' }}>{fmtCurrency(ps.revenue)}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Shops Table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-default)' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>🏪 Chi tiết gian hàng</h3>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Gian hàng</th>
                                <th>Nền tảng</th>
                                <th className="text-right">Doanh thu</th>
                                <th className="text-right">Phí</th>
                                <th className="text-right">Thu ròng</th>
                                <th className="text-right">Đơn hàng</th>
                                <th className="text-right"><CheckCircle size={14} style={{ color: 'var(--color-success)' }} /></th>
                                <th className="text-right"><XCircle size={14} style={{ color: 'var(--color-danger)' }} /></th>
                            </tr>
                        </thead>
                        <tbody>
                            {shopStats.map(shop => (
                                <tr key={shop.id}>
                                    <td style={{ fontWeight: 500 }}>{shop.name}</td>
                                    <td>
                                        <span className={`badge ${shop.platform === 'shopee' ? 'badge--warning' : 'badge--danger'}`}>
                                            {shop.platform === 'shopee' ? '🟠 Shopee' : '🎵 TikTok'}
                                        </span>
                                    </td>
                                    <td className="text-right" style={{ fontWeight: 600, color: 'var(--color-success)' }}>{fmtCurrency(shop.revenue)}</td>
                                    <td className="text-right" style={{ color: 'var(--color-danger)' }}>{fmtCurrency(shop.fees)}</td>
                                    <td className="text-right" style={{ color: 'var(--accent-primary)' }}>{fmtCurrency(shop.settlement)}</td>
                                    <td className="text-right">{fmt(shop.orders)}</td>
                                    <td className="text-right" style={{ color: 'var(--color-success)' }}>{fmt(shop.completed)}</td>
                                    <td className="text-right" style={{ color: 'var(--color-danger)' }}>{fmt(shop.cancelled)}</td>
                                </tr>
                            ))}
                            {shopStats.length > 1 && (
                                <tr className="row-total">
                                    <td style={{ fontWeight: 700 }}>Tổng cộng</td>
                                    <td></td>
                                    <td className="text-right" style={{ fontWeight: 700, color: 'var(--color-success)' }}>{fmtCurrency(totalRevenue)}</td>
                                    <td className="text-right" style={{ fontWeight: 700, color: 'var(--color-danger)' }}>{fmtCurrency(totalFees)}</td>
                                    <td className="text-right" style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{fmtCurrency(totalSettlement)}</td>
                                    <td className="text-right" style={{ fontWeight: 700 }}>{fmt(totalOrders)}</td>
                                    <td className="text-right" style={{ fontWeight: 700, color: 'var(--color-success)' }}>{fmt(totalCompleted)}</td>
                                    <td className="text-right" style={{ fontWeight: 700, color: 'var(--color-danger)' }}>{fmt(totalCancelled)}</td>
                                </tr>
                            )}
                            {shopStats.length === 0 && (
                                <tr>
                                    <td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                                        User chưa có dữ liệu
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </main>
    );
}
