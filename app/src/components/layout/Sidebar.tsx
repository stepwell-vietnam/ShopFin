'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import {
    FileBarChart,
    ShoppingCart,
    BarChart3,
    TrendingUp,
    LogIn,
    LogOut,
    LayoutDashboard,
    Store,
    User,
    Shield,
    Users,
    Zap,
} from 'lucide-react';
import { isAdminEmail } from '@/lib/admin';
import styles from './Sidebar.module.css';

const GUEST_SECTIONS = [
    {
        label: 'Phân tích nhanh',
        items: [
            { href: '/income', label: 'Doanh Thu Shopee', icon: FileBarChart },
            { href: '/orders', label: 'Đơn hàng Shopee', icon: ShoppingCart },
            { href: '/tiktok-income', label: 'Doanh Thu TikTok', icon: TrendingUp },
            { href: '/tiktok-orders', label: 'Đơn hàng TikTok', icon: ShoppingCart },
            { href: '/ads/tiktok', label: 'TikTok Ads', icon: Zap },
        ],
    },
];

const AUTH_SECTIONS = [
    {
        label: 'Quản lý',
        items: [
            { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { href: '/shops', label: 'Gian hàng', icon: Store },
            { href: '/product-pnl', label: 'P&L Sản phẩm', icon: BarChart3 },
            { href: '/reports/revenue', label: 'Báo cáo Doanh thu', icon: TrendingUp },
        ],
    },
];

const ADMIN_SECTIONS = [
    {
        label: 'Quản trị',
        items: [
            { href: '/admin/dashboard', label: 'Dashboard Tổng hợp', icon: BarChart3 },
            { href: '/admin/users', label: 'Quản lý Users', icon: Users },
        ],
    },
];

export default function Sidebar() {
    const pathname = usePathname();
    const { data: session, status } = useSession();
    const isLoggedIn = status === 'authenticated';
    const userIsAdmin = isLoggedIn && isAdminEmail(session?.user?.email);

    // Hide sidebar on login page
    if (pathname === '/login') return null;

    return (
        <aside className={styles.sidebar}>
            {/* Logo */}
            <div className={styles.logo}>
                <BarChart3 className={styles.logoIcon} size={28} />
                <span className={styles.logoText}>ShopFin</span>
            </div>

            {/* Navigation */}
            <nav className={styles.nav}>
                {/* Auth sections (only when logged in) */}
                {isLoggedIn && AUTH_SECTIONS.map((section) => (
                    <div key={section.label} style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', padding: '8px 12px 4px', fontWeight: 600 }}>
                            {section.label}
                        </div>
                        {section.items.map((item) => {
                            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                            const Icon = item.icon;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                                >
                                    <Icon size={20} />
                                    <span className={styles.navLabel}>{item.label}</span>
                                </Link>
                            );
                        })}
                    </div>
                ))}

                {/* Admin sections (only for admin) */}
                {userIsAdmin && ADMIN_SECTIONS.map((section) => (
                    <div key={section.label} style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-primary)', padding: '8px 12px 4px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Shield size={10} />
                            {section.label}
                        </div>
                        {section.items.map((item) => {
                            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                            const Icon = item.icon;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                                >
                                    <Icon size={20} />
                                    <span className={styles.navLabel}>{item.label}</span>
                                </Link>
                            );
                        })}
                    </div>
                ))}

                {/* Guest/Free sections (always visible) */}
                {GUEST_SECTIONS.map((section) => (
                    <div key={section.label} style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', padding: '8px 12px 4px', fontWeight: 600 }}>
                            {section.label}
                        </div>
                        {section.items.map((item) => {
                            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                            const Icon = item.icon;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                                >
                                    <Icon size={20} />
                                    <span className={styles.navLabel}>{item.label}</span>
                                </Link>
                            );
                        })}
                    </div>
                ))}
            </nav>

            {/* User / Auth section at bottom */}
            <div className={styles.footer}>
                {isLoggedIn && session?.user ? (
                    <div style={{ padding: '8px 12px' }}>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            marginBottom: 8,
                        }}>
                            {session.user.image ? (
                                <img
                                    src={session.user.image}
                                    alt=""
                                    style={{ width: 28, height: 28, borderRadius: '50%' }}
                                />
                            ) : (
                                <User size={20} />
                            )}
                            <span style={{
                                fontSize: '0.78rem',
                                color: 'var(--text-primary)',
                                fontWeight: 500,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}>
                                {session.user.name || session.user.email}
                            </span>
                            {userIsAdmin && (
                                <span style={{
                                    fontSize: '0.6rem', fontWeight: 700, padding: '1px 6px',
                                    borderRadius: 'var(--radius-full)', background: 'var(--accent-primary-dim)',
                                    color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.05em',
                                }}>Admin</span>
                            )}
                        </div>
                        <button
                            onClick={() => signOut({ callbackUrl: '/' })}
                            className={styles.navItem}
                            style={{ width: '100%', border: 'none', cursor: 'pointer', background: 'none', textAlign: 'left' }}
                        >
                            <LogOut size={18} />
                            <span className={styles.navLabel} style={{ fontSize: '0.78rem' }}>Đăng xuất</span>
                        </button>
                    </div>
                ) : (
                    <Link href="/login" className={styles.navItem}>
                        <LogIn size={20} />
                        <span className={styles.navLabel}>Đăng nhập</span>
                    </Link>
                )}
                <span className={styles.version}>ShopFin v3.0</span>
            </div>
        </aside>
    );
}
