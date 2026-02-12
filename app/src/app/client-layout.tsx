'use client';

import { ShopDataProvider } from '@/store/useShopData';
import Sidebar from '@/components/layout/Sidebar';

export default function ClientLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <ShopDataProvider>
            <div className="app-layout">
                <Sidebar />
                <main className="main-content">
                    {children}
                </main>
            </div>
        </ShopDataProvider>
    );
}
