// Revenue report utility types and functions shared across components

export type DailyData = {
    date: string;
    orderCount: number;
    productPrice: number;
    totalPayment: number;
    totalFees: number;
    totalTax: number;
};

export type TimeViewMode = 'day' | 'week' | 'month';
export type TimePreset = 'this_month' | 'this_quarter' | 'this_year' | 'all' | 'custom';

export type AggData = DailyData & { label: string };

export function fmtCur(v: number): string { return Math.round(v).toLocaleString('vi-VN') + 'đ'; }

export function fmtShort(v: number): string {
    const abs = Math.abs(v);
    if (abs >= 1e9) return `đ${(v / 1e9).toFixed(1)}B`;
    if (abs >= 1e6) return `đ${(v / 1e6).toFixed(1)}M`;
    if (abs >= 1e3) return `đ${(v / 1e3).toFixed(0)}K`;
    return `đ${v}`;
}

export function fmtNum(v: number): string { return v.toLocaleString('vi-VN'); }

export function fmtDate(d: string): string { return new Date(d).toLocaleDateString('vi-VN'); }

export function getISOWeek(ds: string): string {
    const d = new Date(ds); d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const w1 = new Date(d.getFullYear(), 0, 4);
    const wn = 1 + Math.round(((d.getTime() - w1.getTime()) / 86400000 - 3 + ((w1.getDay() + 6) % 7)) / 7);
    return `${d.getFullYear()}-W${String(wn).padStart(2, '0')}`;
}

export function getMonthKey(ds: string): string { return ds.substring(0, 7); }

export function fmtAggLabel(label: string, mode: TimeViewMode): string {
    if (mode === 'day') return label.substring(5);
    if (mode === 'week') { const p = label.split('-W'); return `T${p[1]}/${p[0].substring(2)}`; }
    const [y, m] = label.split('-'); return `T${m}/${y.substring(2)}`;
}

export function aggregateByMode(daily: DailyData[], mode: TimeViewMode): AggData[] {
    const bk: Record<string, AggData> = {};
    for (const d of daily) {
        const key = mode === 'day' ? d.date : mode === 'week' ? getISOWeek(d.date) : getMonthKey(d.date);
        if (!bk[key]) { bk[key] = { ...d, label: key }; }
        else {
            const b = bk[key];
            b.orderCount += d.orderCount; b.productPrice += d.productPrice;
            b.totalPayment += d.totalPayment; b.totalFees += d.totalFees; b.totalTax += d.totalTax;
        }
    }
    return Object.values(bk).sort((a, b) => a.label.localeCompare(b.label));
}

export function getDateRange(preset: TimePreset, customFrom: string, customTo: string): [string, string] | null {
    const now = new Date();
    if (preset === 'all') return null;
    if (preset === 'custom' && customFrom && customTo) return [customFrom + '-01', customTo + '-31'];
    if (preset === 'this_month') {
        const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        return [ym + '-01', ym + '-31'];
    }
    if (preset === 'this_quarter') {
        const q = Math.floor(now.getMonth() / 3);
        const m1 = q * 3 + 1; const m3 = q * 3 + 3;
        const y = now.getFullYear();
        return [`${y}-${String(m1).padStart(2, '0')}-01`, `${y}-${String(m3).padStart(2, '0')}-31`];
    }
    if (preset === 'this_year') return [`${now.getFullYear()}-01-01`, `${now.getFullYear()}-12-31`];
    return null;
}
