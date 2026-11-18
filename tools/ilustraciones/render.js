// node render.js <svg-dir> <png-dir> : renderiza todos los .svg a .png 360x240
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
(async () => {
  const [src, out] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 360, height: 240 } });
  for (const f of fs.readdirSync(src).filter((f) => f.endsWith('.svg'))) {
    await p.setContent(`<body style="margin:0">${fs.readFileSync(path.join(src, f), 'utf8')}</body>`);
    await p.screenshot({ path: path.join(out, f.replace('.svg', '.png')) });
  }
  await b.close();
})();
