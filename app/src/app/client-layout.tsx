'use client';

import { ShopDataProvider } from '@/store/useShopData';
import AuthProvider from '@/components/AuthProvider';
import Sidebar from '@/components/layout/Sidebar';

export default function ClientLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <AuthProvider>
            <ShopDataProvider>
                <div className="app-layout">
                    <Sidebar />
                    <main className="main-content">
                        {children}
                    </main>
                </div>
            </ShopDataProvider>
        </AuthProvider>
    );
}

