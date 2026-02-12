/**
 * ShopFin — Business Logic Calculations
 * 
 * Computes dashboard KPIs, daily performance, and cashflow audit
 * from parsed Income Excel + other sources.
 */

import type {
    IncomeReport,
    DailyIncome,
    OrderRecord,
    DailyProductData,
    WalletTransaction,
    DashboardMetrics,
    DailyPerformance,
    CashflowAudit,
    PendingOrder,
} from '@/types';

/**
 * Calculate Dashboard KPI metrics (primary source: Income Excel)
 */
export function calculateDashboardMetrics(
    incomeReport: IncomeReport | null,
    orders: OrderRecord[],
    walletTransactions: WalletTransaction[],
): DashboardMetrics {
    // Primary: use Income Excel summary
    const totalRevenue = incomeReport?.totalRevenue || 0;
    const netRevenue = incomeReport?.netRevenue || 0;
    const totalFees = Math.abs(incomeReport?.totalFees || 0);
    const totalTax = Math.abs(incomeReport?.totalTax || 0);
    const fixedFee = Math.abs(incomeReport?.fixedFee || 0);
    const serviceFee = Math.abs(incomeReport?.serviceFee || 0);
    const paymentFee = Math.abs(incomeReport?.paymentFee || 0);
    const affiliateFee = Math.abs(incomeReport?.affiliateFee || 0);
    const pishipFee = Math.abs(incomeReport?.pishipFee || 0);
    const vatTax = Math.abs(incomeReport?.vatTax || 0);
    const pitTax = Math.abs(incomeReport?.pitTax || 0);

    // Ads expense from wallet transactions
    const adsExpense = walletTransactions
        .filter(t => t.type === 'ads_expense')
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    // Order stats
    const totalOrders = orders.length;
    const cancelledOrders = orders.filter(o => o.status === 'cancelled').length;

    // KPI calculations
    const feeRatio = totalRevenue > 0 ? (totalFees / totalRevenue) * 100 : 0;
    const walletIncome = walletTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
    const roas = adsExpense > 0 ? (walletIncome || netRevenue) / adsExpense : 0;
    const cancelRate = totalOrders > 0 ? (cancelledOrders / totalOrders) * 100 : 0;

    return {
        totalRevenue,
        netRevenue,
        totalFees,
        totalTax,
        adsExpense,
        feeRatio,
        roas,
        cancelRate,
        totalOrders,
        cancelledOrders,
        fixedFee,
        serviceFee,
        paymentFee,
        affiliateFee,
        pishipFee,
        vatTax,
        pitTax,
    };
}

/**
 * Calculate daily performance by merging Income daily + products + wallet
 */
export function calculateDailyPerformance(
    dailyIncome: DailyIncome[],
    dailyProducts: DailyProductData[],
    walletTransactions: WalletTransaction[],
): DailyPerformance[] {

    // Group product data by date
    const productsByDate: Record<string, DailyProductData> = {};
    for (const p of dailyProducts) {
        productsByDate[p.date] = p;
    }

    // Group wallet income by date
    const walletByDate: Record<string, number> = {};
    for (const tx of walletTransactions) {
        if (tx.type === 'income' && tx.date) {
            const date = tx.date.substring(0, 10);
            walletByDate[date] = (walletByDate[date] || 0) + tx.amount;
        }
    }

    // Primary: use dailyIncome from Income Excel
    if (dailyIncome.length > 0) {
        const result: DailyPerformance[] = dailyIncome.map(d => {
            const product = productsByDate[d.date];
            return {
                date: d.date,
                productRevenue: d.productPrice,
                netPayment: d.totalPayment,
                totalFees: d.totalFees,
                orderCount: d.orderCount,
                pageViews: product?.pageViews || 0,
                visitors: product?.visitors || 0,
                confirmedSales: product?.confirmedSales || 0,
                walletIncome: walletByDate[d.date] || 0,
            };
        });

        // Add dates from products that aren't in income
        const incomeDates = new Set(dailyIncome.map(d => d.date));
        for (const p of dailyProducts) {
            if (!incomeDates.has(p.date)) {
                result.push({
                    date: p.date,
                    productRevenue: 0,
                    netPayment: 0,
                    totalFees: 0,
                    orderCount: 0,
                    pageViews: p.pageViews,
                    visitors: p.visitors,
                    confirmedSales: p.confirmedSales,
                    walletIncome: walletByDate[p.date] || 0,
                });
            }
        }

        return result.sort((a, b) => a.date.localeCompare(b.date));
    }

    // Fallback: use product data only
    return dailyProducts.map(p => ({
        date: p.date,
        productRevenue: 0,
        netPayment: 0,
        totalFees: 0,
        orderCount: 0,
        pageViews: p.pageViews,
        visitors: p.visitors,
        confirmedSales: p.confirmedSales,
        walletIncome: walletByDate[p.date] || 0,
    })).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Calculate cashflow audit (compare Income report vs wallet)
 */
export function calculateCashflowAudit(
    incomeReport: IncomeReport | null,
    walletTransactions: WalletTransaction[],
): CashflowAudit | null {
    const reportedRevenue = incomeReport?.netRevenue || 0;
    const actualWalletIncome = walletTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

    if (reportedRevenue === 0 && actualWalletIncome === 0) return null;

    const difference = actualWalletIncome - reportedRevenue;
    const differencePercent = reportedRevenue > 0
        ? (Math.abs(difference) / reportedRevenue) * 100
        : 0;

    let status: CashflowAudit['status'];
    if (differencePercent <= 1) status = 'ok';
    else if (differencePercent <= 5) status = 'warning';
    else status = 'danger';

    return {
        reportedRevenue,
        actualWalletIncome,
        difference,
        differencePercent,
        status,
    };
}

/**
 * Find pending orders (completed but no matching wallet transaction)
 */
export function findPendingOrders(
    orders: OrderRecord[],
    walletTransactions: WalletTransaction[],
): PendingOrder[] {
    const completedOrders = orders.filter(o => o.status === 'completed');
    const today = new Date();
    const pending: PendingOrder[] = [];

    for (const order of completedOrders) {
        if (!order.orderDate) continue;
        const orderDate = new Date(order.orderDate);
        const daysPending = Math.floor((today.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysPending > 3 && daysPending <= 14) {
            pending.push({
                orderId: order.orderId,
                amount: order.totalAmount,
                status: daysPending > 7 ? 'needs_review' : 'waiting',
                daysPending,
            });
        }
    }

    return pending
        .sort((a, b) => b.daysPending - a.daysPending)
        .slice(0, 20);
}
