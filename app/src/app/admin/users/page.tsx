'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Users, Store, DollarSign, ShoppingCart, ArrowRight, Shield } from 'lucide-react';
import { isAdminEmail } from '@/lib/admin';

interface UserData {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    createdAt: string;
    shopCount: number;
    platforms: string[];
    totalRevenue: number;
    totalSettlement: number;
    totalOrders: number;
}

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));
const fmtCurrency = (n: number) => {
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return fmt(n);
};

export default function AdminUsersPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (status === 'loading') return;
        if (!session?.user?.email || !isAdminEmail(session.user.email)) {
            router.push('/dashboard');
            return;
        }

        fetch('/api/admin/users')
            .then(r => r.json())
            .then(data => setUsers(data.users || []))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [session, status, router]);

    if (status === 'loading' || loading) {
        return (
            <div className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>⏳</div>
                    Đang tải...
                </div>
            </div>
        );
    }

    const totalRevenue = users.reduce((s, u) => s + u.totalRevenue, 0);
    const totalShops = users.reduce((s, u) => s + u.shopCount, 0);
    const totalOrders = users.reduce((s, u) => s + u.totalOrders, 0);

    return (
        <main className="main-content">
            {/* Header */}
            <div className="page-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Shield size={28} style={{ color: 'var(--accent-primary)' }} />
                    <div>
                        <h1 className="page-header__title">Quản lý Users</h1>
                        <p className="page-header__subtitle">{users.length} tài khoản đã đăng ký</p>
                    </div>
                </div>
            </div>

            {/* KPI Summary */}
            <div className="grid-4" style={{ marginBottom: 'var(--space-xl)' }}>
                <div className="kpi-card kpi-card--blue">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <Users size={18} style={{ color: 'var(--accent-secondary)' }} />
                        <span className="kpi-card__label" style={{ marginBottom: 0 }}>Tổng Users</span>
                    </div>
                    <div className="kpi-card__value">{users.length}</div>
                </div>
                <div className="kpi-card kpi-card--green">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <Store size={18} style={{ color: 'var(--color-success)' }} />
                        <span className="kpi-card__label" style={{ marginBottom: 0 }}>Tổng Shops</span>
                    </div>
                    <div className="kpi-card__value">{totalShops}</div>
                </div>
                <div className="kpi-card kpi-card--orange">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <DollarSign size={18} style={{ color: 'var(--color-warning)' }} />
                        <span className="kpi-card__label" style={{ marginBottom: 0 }}>Tổng Doanh thu</span>
                    </div>
                    <div className="kpi-card__value" style={{ color: 'var(--color-success)' }}>{fmtCurrency(totalRevenue)}đ</div>
                </div>
                <div className="kpi-card kpi-card--red">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <ShoppingCart size={18} style={{ color: 'var(--color-danger)' }} />
                        <span className="kpi-card__label" style={{ marginBottom: 0 }}>Tổng Đơn hàng</span>
                    </div>
                    <div className="kpi-card__value">{fmt(totalOrders)}</div>
                </div>
            </div>

            {/* Users Table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-default)' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>👥 Danh sách Users</h3>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>User</th>
                                <th>Email</th>
                                <th className="text-right">Shops</th>
                                <th>Nền tảng</th>
                                <th className="text-right">Doanh thu</th>
                                <th className="text-right">Đơn hàng</th>
                                <th className="text-right">Thực nhận</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((user, idx) => (
                                <tr
                                    key={user.id}
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => router.push(`/admin/users/${user.id}/dashboard`)}
                                >
                                    <td style={{ color: 'var(--text-muted)', width: 40 }}>{idx + 1}</td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            {user.image ? (
                                                <img
                                                    src={user.image}
                                                    alt=""
                                                    style={{ width: 32, height: 32, borderRadius: '50%' }}
                                                />
                                            ) : (
                                                <div style={{
                                                    width: 32, height: 32, borderRadius: '50%',
                                                    background: 'var(--bg-tertiary)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: '0.75rem', fontWeight: 600,
                                                }}>
                                                    {(user.name || '?')[0].toUpperCase()}
                                                </div>
                                            )}
                                            <span style={{ fontWeight: 500 }}>{user.name || 'Chưa đặt tên'}</span>
                                        </div>
                                    </td>
                                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{user.email}</td>
                                    <td className="text-right">
                                        <span className="badge badge--info">{user.shopCount}</span>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            {user.platforms.map(p => (
                                                <span
                                                    key={p}
                                                    className={`badge ${p === 'shopee' ? 'badge--warning' : 'badge--danger'}`}
                                                >
                                                    {p === 'shopee' ? '🟠 Shopee' : '🎵 TikTok'}
                                                </span>
                                            ))}
                                            {user.platforms.length === 0 && (
                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="text-right" style={{ fontWeight: 600, color: 'var(--color-success)' }}>
                                        {user.totalRevenue > 0 ? `${fmtCurrency(user.totalRevenue)}đ` : '—'}
                                    </td>
                                    <td className="text-right">
                                        {user.totalOrders > 0 ? fmt(user.totalOrders) : '—'}
                                    </td>
                                    <td className="text-right" style={{ color: 'var(--accent-primary)' }}>
                                        {user.totalSettlement > 0 ? `${fmtCurrency(user.totalSettlement)}đ` : '—'}
                                    </td>
                                    <td style={{ width: 40 }}>
                                        <ArrowRight size={16} style={{ color: 'var(--text-muted)' }} />
                                    </td>
                                </tr>
                            ))}
                            {users.length === 0 && (
                                <tr>
                                    <td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                                        Chưa có user nào đăng ký
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
