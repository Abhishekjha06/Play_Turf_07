import fs from 'fs';
import path from 'path';
import { EXCLUDE_DIRS, EXCLUDE_FILES } from '../config.js';

export async function walkDirectory(dir: string): Promise<string[]> {
  let results: string[] = [];
  const list = await fs.promises.readdir(dir);

  for (const file of list) {
    if (EXCLUDE_DIRS.includes(file) || EXCLUDE_FILES.includes(file)) {
      continue;
    }
    const fullPath = path.join(dir, file);
    const stat = await fs.promises.stat(fullPath);

    if (stat && stat.isDirectory()) {
      const subResults = await walkDirectory(fullPath);
      results = results.concat(subResults);
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

export function isPathSafe(resolvedPath: string, rootDir: string): boolean {
  const relative = path.relative(rootDir, resolvedPath);
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}
