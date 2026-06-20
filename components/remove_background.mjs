import fs from "fs";
import path from "path";
import sharp from "sharp";

// Flood-fill transparency remover for checkerboard mockups
async function cleanLogo(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return;
  }

  console.log(`Processing background removal for: ${filePath}`);
  const image = sharp(filePath);
  const metadata = await image.metadata();
  const { width, height } = metadata;

  // Get raw RGBA buffer (ensure 4 channels / alpha)
  const rawBuffer = await image.ensureAlpha().raw().toBuffer();

  const visited = new Uint8Array(width * height);
  const queue = [];

  // Helper to get pixel color at (x, y)
  function getPixel(x, y) {
    const idx = (y * width + x) * 4;
    return {
      r: rawBuffer[idx],
      g: rawBuffer[idx + 1],
      b: rawBuffer[idx + 2],
      a: rawBuffer[idx + 3],
    };
  }

  // Helper to set pixel alpha to 0
  function makeTransparent(x, y) {
    const idx = (y * width + x) * 4;
    rawBuffer[idx + 3] = 0; // Alpha
  }

  // Get corner colors to sample the checkerboard background
  const corners = [
    getPixel(0, 0),
    getPixel(width - 1, 0),
    getPixel(0, height - 1),
    getPixel(width - 1, height - 1),
    getPixel(5, 5),
    getPixel(width - 6, 5)
  ];

  // We check if a pixel matches any of the sampled background colors
  function isBackgroundPixel(color) {
    // If it's already transparent, it's background
    if (color.a === 0) return true;
    
    // Check against corner samples with tolerance
    for (const corner of corners) {
      const dist = Math.sqrt(
        Math.pow(color.r - corner.r, 2) +
        Math.pow(color.g - corner.g, 2) +
        Math.pow(color.b - corner.b, 2)
      );
      if (dist < 32) { // Tolerance threshold
        return true;
      }
    }

    // Checkerboard cells are often grayscale. If it's grayscale and very dark/light, let's check
    const isGrayscale = Math.abs(color.r - color.g) < 8 && Math.abs(color.g - color.b) < 8;
    if (isGrayscale) {
      // Gray squares in mockups are typically around #111, #1c1c1c, #ccc, #fff
      const val = color.r;
      if (val < 45 || val > 210) {
        return true;
      }
    }

    return false;
  }

  // Add boundary pixels to queue
  for (let x = 0; x < width; x++) {
    queue.push({ x, y: 0 });
    queue.push({ x, y: height - 1 });
    visited[0 * width + x] = 1;
    visited[(height - 1) * width + x] = 1;
  }
  for (let y = 0; y < height; y++) {
    queue.push({ x: 0, y });
    queue.push({ x: width - 1, y });
    visited[y * width + 0] = 1;
    visited[y * width + (width - 1)] = 1;
  }

  // BFS Flood-fill
  let head = 0;
  while (head < queue.length) {
    const { x, y } = queue[head++];
    const color = getPixel(x, y);

    if (isBackgroundPixel(color)) {
      makeTransparent(x, y);

      // Add 4-way neighbors
      const neighbors = [
        { x: x + 1, y },
        { x: x - 1, y },
        { x, y: y + 1 },
        { x, y: y - 1 }
      ];

      for (const n of neighbors) {
        if (n.x >= 0 && n.x < width && n.y >= 0 && n.y < height) {
          const idx = n.y * width + n.x;
          if (!visited[idx]) {
            visited[idx] = 1;
            queue.push(n);
          }
        }
      }
    }
  }

  // Write the updated raw buffer back to a PNG file
  await sharp(rawBuffer, {
    raw: {
      width,
      height,
      channels: 4
    }
  })
  .png()
  .toFile(filePath + ".temp");

  // Overwrite the original file
  fs.renameSync(filePath + ".temp", filePath);
  console.log(`Successfully cleaned background for: ${filePath}`);
}

async function cleanAll() {
  const assetsDir = "./public/assets";
  const files = fs.readdirSync(assetsDir);
  for (const file of files) {
    if (file.endsWith(".png") && !file.includes("heads") && !file.includes("tails")) {
      await cleanLogo(path.join(assetsDir, file));
    }
  }
}

cleanAll().catch(console.error);
