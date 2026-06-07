import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const assetsDir = path.resolve('../assets');
const files = fs.readdirSync(assetsDir);

async function convert() {
  for (const file of files) {
    if (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg')) {
      const srcPath = path.join(assetsDir, file);
      const ext = path.extname(file);
      const destPath = path.join(assetsDir, file.replace(ext, '.webp'));
      console.log(`Converting ${file} to .webp...`);
      await sharp(srcPath).webp({ quality: 80 }).toFile(destPath);
      // Wait to delete until confirmed
    }
  }
  console.log("Done converting!");
}

convert().catch(console.error);
