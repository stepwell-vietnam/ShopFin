// ========================================
// ShopFin — Formatting Utilities
// ========================================

/**
 * Format number as Vietnamese Dong currency
 * @example formatCurrency(257128170) → "₫257.128.170"
 */
export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
        maximumFractionDigits: 0,
    }).format(amount);
}

/**
 * Format number with short suffix
 * @example formatShortCurrency(257128170) → "₫257.1M"
 */
export function formatShortCurrency(amount: number): string {
    if (Math.abs(amount) >= 1_000_000_000) {
        return `₫${(amount / 1_000_000_000).toFixed(1)}B`;
    }
    if (Math.abs(amount) >= 1_000_000) {
        return `₫${(amount / 1_000_000).toFixed(1)}M`;
    }
    if (Math.abs(amount) >= 1_000) {
        return `₫${(amount / 1_000).toFixed(0)}K`;
    }
    return `₫${amount}`;
}

/**
 * Format number with thousand separators
 * @example formatNumber(12450) → "12.450"
 */
export function formatNumber(num: number): string {
    return new Intl.NumberFormat('vi-VN').format(num);
}

/**
 * Format percentage
 * @example formatPercent(28.35) → "28.4%"
 */
export function formatPercent(value: number, decimals: number = 1): string {
    return `${value.toFixed(decimals)}%`;
}

/**
 * Format ROAS value
 * @example formatROAS(19.3) → "19.3x"
 */
export function formatROAS(value: number): string {
    return `${value.toFixed(1)}x`;
}

/**
 * Format date string to Vietnamese format
 * @example formatDate("2026-01-15") → "15/01/2026"
 */
export function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).format(date);
}

/**
 * Format date to short format
 * @example formatDateShort("2026-01-15") → "15/01"
 */
export function formatDateShort(dateStr: string): string {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
    }).format(date);
}

/**
 * Format file size
 * @example formatFileSize(426703) → "416.7 KB"
 */
export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
