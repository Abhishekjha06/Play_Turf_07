import fs from 'fs';
import path from 'path';

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('f:/Play_Turf_copy/components/src');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  // Fix the invalid syntax injected by the previous script
  let newContent = content.replace(/\/ loading="lazy" decoding="async">/g, 'loading="lazy" decoding="async" />');
  
  if (content !== newContent) {
    fs.writeFileSync(file, newContent, 'utf8');
    console.log(`Fixed syntax in ${file}`);
  }
});
