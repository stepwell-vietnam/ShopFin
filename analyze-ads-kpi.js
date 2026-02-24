const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'creative data for product campaigns 2026-01-01 00 ~ 2026-01-31 23.xlsx');
const wb = XLSX.readFile(filePath);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws);

const toNum = (v) => { const n = parseFloat(String(v || '0').replace(/,/g, '')); return isNaN(n) ? 0 : n; };

let totalCost = 0, totalOrders = 0, totalRevenue = 0;
let totalImpressions = 0, totalClicks = 0, totalConversions = 0;

rows.forEach((r) => {
    totalCost += toNum(r['Chi phí (VND)']);
    totalOrders += toNum(r['Số lượng đơn hàng SKU']);
    totalRevenue += toNum(r['Doanh thu gộp (VND)']);
    totalImpressions += toNum(r['Lượt hiển thị']);
    totalClicks += toNum(r['Số lượt nhấp']);
    totalConversions += toNum(r['Chuyển đổi']);
});

const roi = totalCost > 0 ? (totalRevenue / totalCost) : 0;
const costPerOrder = totalOrders > 0 ? (totalCost / totalOrders) : 0;
const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions * 100) : 0;
const convRate = totalClicks > 0 ? (totalConversions / totalClicks * 100) : 0;

const fmt = (n) => n.toLocaleString('vi-VN');
const fmtM = (n) => {
    if (n >= 1e9) return (n / 1e9).toFixed(2) + ' tỷ';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + ' triệu';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return n.toFixed(0);
};

console.log('=== TIKTOK ADS ANALYTICS - Tháng 01/2026 ===\n');
console.log('Tổng creatives:', fmt(rows.length));
console.log('');
console.log('1. Tổng chi phí quảng cáo:', fmt(totalCost), 'VND ~', fmtM(totalCost), 'VND');
console.log('2. Tổng đơn hàng từ ads:', fmt(totalOrders), 'đơn');
console.log('3. Tổng doanh thu gộp:', fmt(totalRevenue), 'VND ~', fmtM(totalRevenue), 'VND');
console.log('4. ROI trung bình:', roi.toFixed(2) + 'x');
console.log('5. Chi phí/đơn hàng TB:', fmt(Math.round(costPerOrder)), 'VND/đơn');
console.log('6. Tỷ lệ chuyển đổi TB:', convRate.toFixed(2) + '%');
console.log('');
console.log('--- Bổ sung ---');
console.log('Tổng lượt hiển thị:', fmt(totalImpressions));
console.log('Tổng lượt nhấp:', fmt(totalClicks));
console.log('CTR:', ctr.toFixed(2) + '%');
console.log('Tổng chuyển đổi:', fmt(totalConversions));

// Campaign breakdown
const campaigns = {};
rows.forEach((r) => {
    const name = r['Tên chiến dịch'] || 'Unknown';
    if (!campaigns[name]) {
        campaigns[name] = { cost: 0, orders: 0, revenue: 0, impressions: 0, clicks: 0, conversions: 0, count: 0 };
    }
    const c = campaigns[name];
    c.cost += toNum(r['Chi phí (VND)']);
    c.orders += toNum(r['Số lượng đơn hàng SKU']);
    c.revenue += toNum(r['Doanh thu gộp (VND)']);
    c.impressions += toNum(r['Lượt hiển thị']);
    c.clicks += toNum(r['Số lượt nhấp']);
    c.conversions += toNum(r['Chuyển đổi']);
    c.count++;
});

console.log('\n=== THEO CHIẾN DỊCH ===');
Object.entries(campaigns).forEach(([name, c]) => {
    const cRoi = c.cost > 0 ? (c.revenue / c.cost) : 0;
    const cCPO = c.orders > 0 ? (c.cost / c.orders) : 0;
    const cConvRate = c.clicks > 0 ? (c.conversions / c.clicks * 100) : 0;
    console.log('\n--- ' + name + ' ---');
    console.log('  Creatives:', fmt(c.count));
    console.log('  Chi phí:', fmtM(c.cost), 'VND');
    console.log('  Đơn hàng:', fmt(c.orders));
    console.log('  Doanh thu:', fmtM(c.revenue), 'VND');
    console.log('  ROI:', cRoi.toFixed(2) + 'x');
    console.log('  Chi phí/đơn:', fmt(Math.round(cCPO)), 'VND');
    console.log('  Tỷ lệ chuyển đổi:', cConvRate.toFixed(2) + '%');
});
