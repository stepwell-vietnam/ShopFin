const XLSX = require('xlsx');
const wb = XLSX.readFile('/Users/detaunisex/Documents/DUONGBIRKEN/SHOPFIN/Datamauthang1/Income.20260101_20260131.xlsx');
const sheet = wb.Sheets['Summary'];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

function toNum(val) { if (!val) return 0; return Number(val) || 0; }
function find(label) {
    for (const row of rows) {
        if (!row) continue;
        for (let c = 0; c < (row.length || 0); c++) {
            if (row[c] && String(row[c]).includes(label)) {
                for (let v = (row.length || 0) - 1; v > c; v--) {
                    const num = toNum(row[v]);
                    if (num !== 0 || String(row[v]) === '0') return num;
                }
                return toNum(row[c + 1]);
            }
        }
    }
    return 0;
}

console.log('totalRevenue:', find('1. Tổng doanh thu'), '(expect 244085570)');
console.log('productTotal:', find('Tổng hàng hóa'), '(expect 244102070)');
console.log('originalPrice:', find('Giá gốc'), '(expect 370654000)');
console.log('sellerDiscount:', find('Số tiền bạn trợ giá'), '(expect -113525830)');
console.log('refundAmount:', find('Số tiền hoàn lại'), '(expect -13026100)');
console.log('totalCosts:', find('2. Tổng chi phí'), '(expect -73073966)');
console.log('fixedFee:', find('Phí cố định'), '(expect -38349600)');
console.log('serviceFee:', find('Phí Dịch Vụ'), '(expect -12533757)');
console.log('paymentFee:', find('Phí thanh toán'), '(expect -12116052)');
console.log('affiliateFee:', find('Phí hoa hồng Tiếp thị liên kết'), '(expect -4807814)');
console.log('pishipFee:', find('Phí dịch vụ PiShip'), '(expect -1605420)');
console.log('totalFees:', find('Phụ phí'), '(expect -69412643)');
console.log('vatTax:', find('Thuế GTGT'), '(expect -2440856)');
console.log('pitTax:', find('Thuế TNCN'), '(expect -1220467)');
console.log('totalTax:', find('Thuế'), '(expect -3661323)');
console.log('netRevenue:', find('3. Tổng số tiền'), '(expect 171011604)');
