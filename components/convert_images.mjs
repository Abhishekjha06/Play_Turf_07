import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const files = [
  'public/assets/heads.png',
  'public/assets/tails.png',
  'public/public/playturf-logo.png', // wait, let's just search
  'public/playturf-logo.png',
  'public/toss-icon.png'
];

async function convert() {
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const dest = file.replace(/\.png$/, '.webp');
    console.log(`Converting ${file} to ${dest}`);
    await sharp(file).webp({ quality: 80 }).toFile(dest);
    // fs.unlinkSync(file); // maybe don't delete yet
  }
}

convert().catch(console.error);
