import fs from 'node:fs';
import path from 'node:path';

const SRC = 'D:/github/xiangmutest/opencode/zhibang';
const DST = 'D:/github/xiangmutest/opencode/zhibangbacken';
const IGNORE = new Set(['sync-backup.mjs', 'verify-backup.mjs']);

function walk(dir, base = '') {
  const files = [];
  for (const name of fs.readdirSync(dir)) {
    const rel = base ? `${base}/${name}` : name;
    if (IGNORE.has(rel)) continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      files.push(...walk(full, rel));
    } else {
      files.push({ rel, size: stat.size });
    }
  }
  return files;
}

const srcFiles = walk(SRC);
const srcMap = new Map(srcFiles.map((f) => [f.rel, f]));
const dstFiles = walk(DST);
const dstMap = new Map(dstFiles.map((f) => [f.rel, f]));

const missing = [];
const sizeDiff = [];

for (const [rel, f] of srcMap) {
  const d = dstMap.get(rel);
  if (!d) {
    missing.push(rel);
  } else if (d.size !== f.size) {
    sizeDiff.push(`${rel} (src=${f.size}, dst=${d.size})`);
  }
}

const extra = dstFiles.filter((f) => !srcMap.has(f.rel)).map((f) => f.rel);

console.log(`源文件数: ${srcFiles.length}`);
console.log(`备份文件数: ${dstFiles.length}`);
console.log(`缺失: ${missing.length}`);
console.log(`大小差异: ${sizeDiff.length}`);
console.log(`备份多余: ${extra.length}`);

if (missing.length) {
  console.log('\n--- 缺失文件 ---');
  missing.forEach((r) => console.log(r));
}
if (sizeDiff.length) {
  console.log('\n--- 大小差异 ---');
  sizeDiff.forEach((r) => console.log(r));
}
if (extra.length) {
  console.log('\n--- 备份多余文件（可接受）---');
  extra.forEach((r) => console.log(r));
}

if (missing.length === 0 && sizeDiff.length === 0) {
  console.log('\n校验通过: 0 缺失, 0 大小差异');
  process.exit(0);
} else {
  console.log('\n校验未通过');
  process.exit(1);
}
