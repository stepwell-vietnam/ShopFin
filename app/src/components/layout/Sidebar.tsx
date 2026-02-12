'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    FileBarChart,
    ShoppingCart,
    BarChart3,
    TrendingUp,
} from 'lucide-react';
import styles from './Sidebar.module.css';

const NAV_SECTIONS = [
    {
        label: 'Shopee',
        items: [
            { href: '/income', label: 'Doanh Thu Shopee', icon: FileBarChart },
            { href: '/orders', label: 'Đơn hàng Shopee', icon: ShoppingCart },
        ],
    },
    {
        label: 'TikTok',
        items: [
            { href: '/tiktok-income', label: 'Doanh Thu TikTok', icon: TrendingUp },
            { href: '/tiktok-orders', label: 'Đơn hàng TikTok', icon: ShoppingCart },
        ],
    },
];

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className={styles.sidebar}>
            {/* Logo */}
            <div className={styles.logo}>
                <BarChart3 className={styles.logoIcon} size={28} />
                <span className={styles.logoText}>ShopFin</span>
            </div>

            {/* Navigation */}
            <nav className={styles.nav}>
                {NAV_SECTIONS.map((section) => (
                    <div key={section.label} style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', padding: '8px 12px 4px', fontWeight: 600 }}>
                            {section.label}
                        </div>
                        {section.items.map((item) => {
                            const isActive = pathname === item.href;
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

            {/* Footer */}
            <div className={styles.footer}>
                <span className={styles.version}>ShopFin v2.2</span>
            </div>
        </aside>
    );
}

