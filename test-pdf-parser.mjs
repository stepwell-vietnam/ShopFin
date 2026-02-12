import fs from 'fs';

function parseCurrencyValue(text) {
    if (!text) return 0;
    const cleaned = text.replace(/[₫đ\s]/gi, '').trim();
    const isNegative = cleaned.includes('-') || cleaned.includes('\u2212');
    const digits = cleaned.replace(/[,.\-\u2212]/g, '');
    const num = parseInt(digits, 10);
    if (isNaN(num)) return 0;
    return isNegative ? -num : num;
}

function findLabeledValue(text, label) {
    const match = text.match(label);
    if (match && match[1]) return parseCurrencyValue(match[1]);
    return 0;
}

const pdfjsLib = await import('./app/node_modules/pdfjs-dist/legacy/build/pdf.mjs');
const data = new Uint8Array(fs.readFileSync('Datamauthang1/monthly_report_20260101.pdf'));
const doc = await pdfjsLib.getDocument({ data }).promise;

let text = '';
for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(item => item.str || '').join(' ') + '\n';
}

const results = {
    productTotal: findLabeledValue(text, /Tổng tiền sản phẩm\s+([\d,.\-\u2212]+)/i),
    grossRevenue: findLabeledValue(text, /Giá sản phẩm\s+([\d,.\-\u2212]+)/i),
    refundAmount: findLabeledValue(text, /Số tiền hoàn lại\s+([\d,.\-\u2212]+)/i),
    totalFees: findLabeledValue(text, /Phí giao dịch\s+([\d,.\-\u2212]+)/i),
    fixedFee: findLabeledValue(text, /Phí cố định\s+([\d,.\-\u2212]+)/i),
    serviceFee: findLabeledValue(text, /Phí Dịch Vụ\s+([\d,.\-\u2212]+)/i),
    paymentFee: findLabeledValue(text, /Phí thanh toán\s+([\d,.\-\u2212]+)/i),
    affiliateFee: findLabeledValue(text, /Phí hoa hồng Tiếp thị liên kết\s+([\d,.\-\u2212]+)/i),
    pishipFee: findLabeledValue(text, /Phí dịch vụ PiShip\s+([\d,.\-\u2212]+)/i),
    vatTax: findLabeledValue(text, /Thuế GTGT\s+([\d,.\-\u2212]+)/i),
    pitTax: findLabeledValue(text, /Thuế TNCN\s+([\d,.\-\u2212]+)/i),
    netRevenue: findLabeledValue(text, /Tổng thanh toán đã chuyển\s+[₫đ]?([\d,.\-\u2212]+)/i),
};

const expected = {
    productTotal: 244102070,
    grossRevenue: 257128170,
    refundAmount: -13026100,
    totalFees: -69412643,
    fixedFee: -38349600,
    serviceFee: -12533757,
    paymentFee: -12116052,
    affiliateFee: -4807814,
    pishipFee: -1605420,
    vatTax: -2440856,
    pitTax: -1220467,
    netRevenue: 171011604,
};

let pass = 0, fail = 0;
for (const [k, exp] of Object.entries(expected)) {
    const got = results[k];
    const ok = got === exp;
    console.log(`${ok ? '✅' : '❌'} ${k}: got=${got} expected=${exp}`);
    if (ok) pass++; else fail++;
}
console.log(`\n${pass}/${pass + fail} correct`);
