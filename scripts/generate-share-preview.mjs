// Run from the repository root: node scripts/generate-share-preview.mjs
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
// Preserve the supplied FLS Transport logo and tagline on a square white canvas.
const logo = await sharp(fileURLToPath(new URL('public/brand/fls-transport-logo-with-tagline.png', root)))
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
  .toFile(fileURLToPath(new URL('public/brand/fls-transport-square-v4.png', root)));
console.log('Generated public/brand/fls-transport-square-v4.png (1200 x 1200)');
