'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    FileBarChart,
    ShoppingCart,
    BarChart3,
} from 'lucide-react';
import styles from './Sidebar.module.css';

const NAV_ITEMS = [
    { href: '/income', label: 'Phân Tích Doanh Thu', icon: FileBarChart },
    { href: '/orders', label: 'Phân tích Đơn hàng', icon: ShoppingCart },
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
                {NAV_ITEMS.map((item) => {
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
            </nav>

            {/* Footer */}
            <div className={styles.footer}>
                <span className={styles.version}>ShopFin v2.0</span>
            </div>
        </aside>
    );
}
