const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '..', 'creative data for product campaigns 2026-01-01 00 ~ 2026-01-31 23.xlsx');
const wb = XLSX.readFile(filePath);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws);

const toNum = (v) => {
    if (v === '-' || v === 'N/A' || v == null) return 0;
    const n = parseFloat(String(v).replace(/,/g, ''));
    return isNaN(n) ? 0 : n;
};

let totalCost = 0, totalOrders = 0, totalRevenue = 0;
let totalImpressions = 0, totalClicks = 0;
let totalROI = 0, roiCount = 0;
let totalConvRate = 0, convCount = 0;
let totalCTR = 0, ctrCount = 0;

rows.forEach((r) => {
    const cost = toNum(r['Chi phí']);
    const orders = toNum(r['Số lượng đơn hàng SKU']);
    const revenue = toNum(r['Doanh thu gộp']);
    const impressions = toNum(r['Số lượt hiển thị quảng cáo sản phẩm']);
    const clicks = toNum(r['Số lượt nhấp vào quảng cáo sản phẩm']);
    const roi = toNum(r['ROI']);
    const convRate = toNum(r['Tỷ lệ chuyển đổi quảng cáo']);
    const ctr = toNum(r['Tỷ lệ nhấp vào quảng cáo sản phẩm']);

    totalCost += cost;
    totalOrders += orders;
    totalRevenue += revenue;
    totalImpressions += impressions;
    totalClicks += clicks;

    if (roi > 0) { totalROI += roi; roiCount++; }
    if (convRate > 0) { totalConvRate += convRate; convCount++; }
    if (ctr > 0) { totalCTR += ctr; ctrCount++; }
});

const avgROI = roiCount > 0 ? totalROI / roiCount : 0;
const costPerOrder = totalOrders > 0 ? totalCost / totalOrders : 0;
const avgConvRate = convCount > 0 ? totalConvRate / convCount : 0;
const overallROI = totalCost > 0 ? totalRevenue / totalCost : 0;
const avgCTR = ctrCount > 0 ? totalCTR / ctrCount : 0;

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
console.log('1. Tổng chi phí quảng cáo:', fmt(Math.round(totalCost)), 'VND (~' + fmtM(totalCost) + ')');
console.log('2. Tổng đơn hàng từ ads:', fmt(totalOrders), 'đơn');
console.log('3. Tổng doanh thu gộp:', fmt(Math.round(totalRevenue)), 'VND (~' + fmtM(totalRevenue) + ')');
console.log('4. ROI tổng thể:', overallROI.toFixed(2) + 'x  |  ROI TB theo creative:', avgROI.toFixed(2) + 'x (' + roiCount + ' creatives có ROI > 0)');
console.log('5. Chi phí/đơn hàng TB:', fmt(Math.round(costPerOrder)), 'VND/đơn');
console.log('6. Tỷ lệ chuyển đổi TB:', (avgConvRate * 100).toFixed(2) + '% (' + convCount + ' creatives có conversion)');
console.log('');
console.log('--- Bổ sung ---');
console.log('Tổng lượt hiển thị:', fmt(totalImpressions));
console.log('Tổng lượt nhấp:', fmt(totalClicks));
console.log('CTR trung bình:', (avgCTR * 100).toFixed(2) + '%');
console.log('');

// Campaign breakdown
const campaigns = {};
rows.forEach((r) => {
    const name = r['Tên chiến dịch'] || 'Unknown';
    if (!campaigns[name]) {
        campaigns[name] = { cost: 0, orders: 0, revenue: 0, impressions: 0, clicks: 0, count: 0, roiSum: 0, roiCount: 0, convSum: 0, convCount: 0 };
    }
    const c = campaigns[name];
    c.cost += toNum(r['Chi phí']);
    c.orders += toNum(r['Số lượng đơn hàng SKU']);
    c.revenue += toNum(r['Doanh thu gộp']);
    c.impressions += toNum(r['Số lượt hiển thị quảng cáo sản phẩm']);
    c.clicks += toNum(r['Số lượt nhấp vào quảng cáo sản phẩm']);
    c.count++;
    const roi = toNum(r['ROI']);
    if (roi > 0) { c.roiSum += roi; c.roiCount++; }
    const conv = toNum(r['Tỷ lệ chuyển đổi quảng cáo']);
    if (conv > 0) { c.convSum += conv; c.convCount++; }
});

console.log('=== THEO CHIẾN DỊCH ===');
Object.entries(campaigns).forEach(([name, c]) => {
    const cROI = c.cost > 0 ? (c.revenue / c.cost) : 0;
    const cCPO = c.orders > 0 ? (c.cost / c.orders) : 0;
    const cAvgConv = c.convCount > 0 ? (c.convSum / c.convCount * 100) : 0;
    console.log('\n--- ' + name + ' ---');
    console.log('  Creatives:', fmt(c.count));
    console.log('  Chi phí:', fmtM(c.cost), 'VND');
    console.log('  Đơn hàng:', fmt(c.orders));
    console.log('  Doanh thu:', fmtM(c.revenue), 'VND');
    console.log('  ROI tổng thể:', cROI.toFixed(2) + 'x');
    console.log('  Chi phí/đơn:', fmt(Math.round(cCPO)), 'VND');
    console.log('  Tỷ lệ chuyển đổi TB:', cAvgConv.toFixed(2) + '%');
});
