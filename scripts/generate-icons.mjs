import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

// Retain the approved full-resolution artwork for reproducible exports.
const out = new URL('../public/icons/', import.meta.url);
mkdirSync(out, { recursive: true });
const source = `data:image/png;base64,${readFileSync(new URL('workbench-red-source.png', out)).toString('base64')}`;
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
try {
  const page = await browser.newPage();
  for (const [name, size, maskable] of [['icon-192.png', 192, false], ['icon-512.png', 512, false], ['maskable-512.png', 512, true], ['apple-touch-icon.png', 180, true]]) {
    const data = await page.evaluate(async ({ source, size, maskable }) => {
      const image = new Image();
      image.src = source;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const context = canvas.getContext('2d');
      context.imageSmoothingQuality = 'high';
      // Fit the full artwork inside the maskable safe circle. Apple icons
      // also use an opaque backing so the glass stays visible.
      if (maskable) {
        context.fillStyle = '#f7f5ef';
        context.fillRect(0, 0, size, size);
      }
      const scale = maskable ? 0.66 : 1;
      const inset = size * (1 - scale) / 2;
      context.drawImage(image, inset, inset, size * scale, size * scale);
      return canvas.toDataURL('image/png').split(',')[1];
    }, { source, size, maskable });
    writeFileSync(new URL(name, out), Buffer.from(data, 'base64'));
  }
  // Preserve the existing sidebar, favicon and offline-shell public URL.
  const png = readFileSync(new URL('icon-512.png', out)).toString('base64');
  writeFileSync(new URL('../public/icon.svg', import.meta.url), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><image width="512" height="512" href="data:image/png;base64,${png}"/></svg>\n`);
} finally {
  await browser.close();
}
