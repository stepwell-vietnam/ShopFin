'use client';

import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type {
    ShopDataState,
    FileType,
    UploadedFile,
    IncomeReport,
    IncomeOrderRecord,
    DailyIncome,
    AdjustmentRecord,
    OrderRecord,
    DailyProductData,
    WalletTransaction,
    DashboardMetrics,
    DailyPerformance,
    CashflowAudit,
    PendingOrder,
} from '@/types';

// ========================================
// Initial State
// ========================================

const initialState: ShopDataState = {
    uploadedFiles: {
        income: null,
        orders: null,
        products: null,
        wallet: null,
    },
    incomeReport: null,
    incomeOrders: [],
    dailyIncome: [],
    adjustments: [],
    orders: [],
    dailyProducts: [],
    walletTransactions: [],
    dashboardMetrics: null,
    dailyPerformance: [],
    cashflowAudit: null,
    pendingOrders: [],
    isProcessing: false,
    hasData: false,
};

// ========================================
// Context
// ========================================

interface ShopDataContextType extends ShopDataState {
    setFileStatus: (type: FileType, file: UploadedFile | null) => void;
    setIncomeReport: (data: IncomeReport) => void;
    setIncomeOrders: (data: IncomeOrderRecord[]) => void;
    setDailyIncome: (data: DailyIncome[]) => void;
    setAdjustments: (data: AdjustmentRecord[]) => void;
    setOrders: (data: OrderRecord[]) => void;
    setDailyProducts: (data: DailyProductData[]) => void;
    setWalletTransactions: (data: WalletTransaction[]) => void;
    setDashboardMetrics: (data: DashboardMetrics) => void;
    setDailyPerformance: (data: DailyPerformance[]) => void;
    setCashflowAudit: (data: CashflowAudit) => void;
    setPendingOrders: (data: PendingOrder[]) => void;
    setIsProcessing: (val: boolean) => void;
    resetAll: () => void;
}

const ShopDataContext = createContext<ShopDataContextType | undefined>(undefined);

// ========================================
// Provider
// ========================================

export function ShopDataProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<ShopDataState>(initialState);

    const setFileStatus = useCallback((type: FileType, file: UploadedFile | null) => {
        setState(prev => ({
            ...prev,
            uploadedFiles: { ...prev.uploadedFiles, [type]: file },
        }));
    }, []);

    const setIncomeReport = useCallback((data: IncomeReport) => {
        setState(prev => ({ ...prev, incomeReport: data, hasData: true }));
    }, []);

    const setIncomeOrders = useCallback((data: IncomeOrderRecord[]) => {
        setState(prev => ({ ...prev, incomeOrders: data, hasData: true }));
    }, []);

    const setDailyIncome = useCallback((data: DailyIncome[]) => {
        setState(prev => ({ ...prev, dailyIncome: data, hasData: true }));
    }, []);

    const setAdjustments = useCallback((data: AdjustmentRecord[]) => {
        setState(prev => ({ ...prev, adjustments: data }));
    }, []);

    const setOrders = useCallback((data: OrderRecord[]) => {
        setState(prev => ({ ...prev, orders: data, hasData: true }));
    }, []);

    const setDailyProducts = useCallback((data: DailyProductData[]) => {
        setState(prev => ({ ...prev, dailyProducts: data, hasData: true }));
    }, []);

    const setWalletTransactions = useCallback((data: WalletTransaction[]) => {
        setState(prev => ({ ...prev, walletTransactions: data, hasData: true }));
    }, []);

    const setDashboardMetrics = useCallback((data: DashboardMetrics) => {
        setState(prev => ({ ...prev, dashboardMetrics: data }));
    }, []);

    const setDailyPerformance = useCallback((data: DailyPerformance[]) => {
        setState(prev => ({ ...prev, dailyPerformance: data }));
    }, []);

    const setCashflowAudit = useCallback((data: CashflowAudit) => {
        setState(prev => ({ ...prev, cashflowAudit: data }));
    }, []);

    const setPendingOrders = useCallback((data: PendingOrder[]) => {
        setState(prev => ({ ...prev, pendingOrders: data }));
    }, []);

    const setIsProcessing = useCallback((val: boolean) => {
        setState(prev => ({ ...prev, isProcessing: val }));
    }, []);

    const resetAll = useCallback(() => {
        setState(initialState);
    }, []);

    return (
        <ShopDataContext.Provider
            value={{
                ...state,
                setFileStatus,
                setIncomeReport,
                setIncomeOrders,
                setDailyIncome,
                setAdjustments,
                setOrders,
                setDailyProducts,
                setWalletTransactions,
                setDashboardMetrics,
                setDailyPerformance,
                setCashflowAudit,
                setPendingOrders,
                setIsProcessing,
                resetAll,
            }}
        >
            {children}
        </ShopDataContext.Provider>
    );
}

// ========================================
// Hook
// ========================================

export function useShopData(): ShopDataContextType {
    const context = useContext(ShopDataContext);
    if (!context) {
        throw new Error('useShopData must be used within a ShopDataProvider');
    }
    return context;
}
