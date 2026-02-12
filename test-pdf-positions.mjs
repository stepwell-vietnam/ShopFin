import fs from 'fs';

const pdfjsLib = await import('./app/node_modules/pdfjs-dist/legacy/build/pdf.mjs');
const data = new Uint8Array(fs.readFileSync('Datamauthang1/monthly_report_20260101.pdf'));
const doc = await pdfjsLib.getDocument({ data }).promise;

console.log('Total pages:', doc.numPages);

// Analyze page 2 to understand table layout
for (let pageNum = 2; pageNum <= 2; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();

    // Group items by Y position (same Y = same row)
    const rowMap = {};
    for (const item of content.items) {
        if (!item.str || !item.str.trim()) continue;
        const y = Math.round(item.transform[5]);
        const x = Math.round(item.transform[4]);
        if (!rowMap[y]) rowMap[y] = [];
        rowMap[y].push({ x, text: item.str.trim() });
    }

    // Sort by Y descending (top of page = higher Y)
    const sortedYs = Object.keys(rowMap).map(Number).sort((a, b) => b - a);

    console.log(`\n=== Page ${pageNum}: ${sortedYs.length} rows ===\n`);

    // Show first 3 rows to understand header
    for (let i = 0; i < Math.min(3, sortedYs.length); i++) {
        const y = sortedYs[i];
        const items = rowMap[y].sort((a, b) => a.x - b.x);
        console.log(`Row Y=${y}: ${items.map(it => `"${it.text}"`).join(' | ')}`);
    }

    // Find rows containing date pattern "2026-01"
    console.log('\n--- Date rows ---');
    for (const y of sortedYs) {
        const items = rowMap[y].sort((a, b) => a.x - b.x);
        const allText = items.map(it => it.text).join(' ');
        if (allText.match(/2026-01/)) {
            // Show x positions to understand column layout
            console.log(`Y=${y} (${items.length} items): ${items.map(it => `[x${it.x}]${it.text}`).join(' ')}`);
        }
    }
}
