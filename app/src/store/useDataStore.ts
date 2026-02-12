import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { IncomeParseResult } from '@/lib/parsers/income-parser';
import type { OrderParseResult } from '@/lib/parsers/order-parser';
import type { TikTokIncomeResult } from '@/lib/parsers/tiktok-income-parser';
import type { TikTokOrderParseResult } from '@/lib/parsers/tiktok-order-parser';

// ==========================================
// Each data slice stores parsed result + file metadata
// ==========================================

interface FileSlice<T> {
    data: T | null;
    fileName: string;
    fileSize: number;
    uploadedAt: string; // ISO string
}

function emptySlice<T>(): FileSlice<T> {
    return { data: null, fileName: '', fileSize: 0, uploadedAt: '' };
}

// ==========================================
// Store shape
// ==========================================

interface DataStoreState {
    shopeeIncome: FileSlice<IncomeParseResult>;
    shopeeOrders: FileSlice<OrderParseResult>;
    tiktokIncome: FileSlice<TikTokIncomeResult>;
    tiktokOrders: FileSlice<TikTokOrderParseResult>;

    setShopeeIncome: (data: IncomeParseResult, fileName: string, fileSize: number) => void;
    setShopeeOrders: (data: OrderParseResult, fileName: string, fileSize: number) => void;
    setTiktokIncome: (data: TikTokIncomeResult, fileName: string, fileSize: number) => void;
    setTiktokOrders: (data: TikTokOrderParseResult, fileName: string, fileSize: number) => void;

    clearShopeeIncome: () => void;
    clearShopeeOrders: () => void;
    clearTiktokIncome: () => void;
    clearTiktokOrders: () => void;
    clearAll: () => void;
}

// ==========================================
// Zustand store with sessionStorage persistence
// ==========================================

export const useDataStore = create<DataStoreState>()(
    persist(
        (set) => ({
            shopeeIncome: emptySlice(),
            shopeeOrders: emptySlice(),
            tiktokIncome: emptySlice(),
            tiktokOrders: emptySlice(),

            setShopeeIncome: (data, fileName, fileSize) =>
                set({ shopeeIncome: { data, fileName, fileSize, uploadedAt: new Date().toISOString() } }),
            setShopeeOrders: (data, fileName, fileSize) =>
                set({ shopeeOrders: { data, fileName, fileSize, uploadedAt: new Date().toISOString() } }),
            setTiktokIncome: (data, fileName, fileSize) =>
                set({ tiktokIncome: { data, fileName, fileSize, uploadedAt: new Date().toISOString() } }),
            setTiktokOrders: (data, fileName, fileSize) =>
                set({ tiktokOrders: { data, fileName, fileSize, uploadedAt: new Date().toISOString() } }),

            clearShopeeIncome: () => set({ shopeeIncome: emptySlice() }),
            clearShopeeOrders: () => set({ shopeeOrders: emptySlice() }),
            clearTiktokIncome: () => set({ tiktokIncome: emptySlice() }),
            clearTiktokOrders: () => set({ tiktokOrders: emptySlice() }),
            clearAll: () => set({
                shopeeIncome: emptySlice(),
                shopeeOrders: emptySlice(),
                tiktokIncome: emptySlice(),
                tiktokOrders: emptySlice(),
            }),
        }),
        {
            name: 'shopfin-data',
            storage: createJSONStorage(() =>
                typeof window !== 'undefined' ? sessionStorage : {
                    getItem: () => null,
                    setItem: () => { },
                    removeItem: () => { },
                }
            ),
        }
    )
);
