// Run from the repository root: node scripts/generate-share-preview.mjs
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
// Reuse only the supplied symbol; the source wordmark says FLS Trading.
const symbol = await sharp(fileURLToPath(new URL('public/brand/fls-logo-source.jpg', root)))
  .extract({ left: 50, top: 50, width: 235, height: 235 })
  .resize(132, 132)
  .png()
  .toBuffer();

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#f1f5f9"/>
  <rect width="1200" height="12" fill="#006cb3"/>
  <rect x="48" y="48" width="1104" height="534" rx="28" fill="white"/>
  <rect x="48" y="48" width="10" height="534" rx="5" fill="#00bd62"/>
  <image x="96" y="86" width="132" height="132" href="data:image/png;base64,${symbol.toString('base64')}"/>
  <g font-family="Arial, sans-serif">
    <text x="256" y="143" font-size="44" font-weight="700" fill="#006cb3">FLS Transport</text>
    <text x="258" y="181" font-size="20" letter-spacing="2" fill="#64748b">FLS TRANSPORT CO., LTD.</text>
    <rect x="100" y="254" width="72" height="6" rx="3" fill="#00bd62"/>
    <text x="96" y="344" font-size="70" font-weight="700" fill="#0f172a">Yard Management</text>
    <text x="100" y="397" font-size="28" fill="#64748b">Container inspection &amp; yard operations</text>
    <rect x="100" y="462" width="330" height="54" rx="27" fill="#eaf5fc"/>
    <text x="127" y="497" font-size="23" font-weight="700" fill="#006cb3">CHECK · TRACK · MOVE</text>
  </g>
  <rect x="952" y="462" width="46" height="54" rx="7" fill="#006cb3"/>
  <rect x="1006" y="440" width="46" height="76" rx="7" fill="#00bd62"/>
  <rect x="1060" y="416" width="46" height="100" rx="7" fill="#006cb3"/>
</svg>`;

await sharp(Buffer.from(svg))
  .png()
  .toFile(fileURLToPath(new URL('public/brand/fls-yard-preview-v1.png', root)));
console.log('Generated public/brand/fls-yard-preview-v1.png (1200 × 630)');
