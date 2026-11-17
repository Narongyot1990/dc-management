// Run from the repository root: node scripts/generate-share-preview.mjs
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
// Preserve the full FLS Group logo and its proportions on a square white canvas.
// Source: https://fls-group.com/wp-content/themes/flsgroup/images/fls-logo-tagline-blue.webp
const logo = await sharp(fileURLToPath(new URL('public/brand/fls-group-logo.webp', root)))
  .resize({ width: 1024 })
  .png()
  .toBuffer();

await sharp({
  create: {
    width: 1200,
    height: 1200,
    channels: 3,
    background: '#ffffff',
  },
})
  .composite([{ input: logo, gravity: 'centre' }])
  .png()
  .toFile(fileURLToPath(new URL('public/brand/fls-logo-square-v3.png', root)));
console.log('Generated public/brand/fls-logo-square-v3.png (1200 x 1200)');
