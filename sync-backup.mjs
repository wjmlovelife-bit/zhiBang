import fs from 'node:fs';
import path from 'node:path';

const SRC = 'D:/github/xiangmutest/opencode/zhibang';
const DST = 'D:/github/xiangmutest/opencode/zhibangbacken';
const IGNORE = new Set(['sync-backup.mjs', 'verify-backup.mjs']);

function walk(dir, base = '') {
  const entries = [];
  for (const name of fs.readdirSync(dir)) {
    const rel = base ? `${base}/${name}` : name;
    if (IGNORE.has(rel)) continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      entries.push({ type: 'dir', rel, full });
      entries.push(...walk(full, rel));
    } else {
      entries.push({ type: 'file', rel, full, size: stat.size });
    }
  }
  return entries;
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(2)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(2)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

const start = Date.now();
const entries = walk(SRC);
const dirs = entries.filter((e) => e.type === 'dir');
const files = entries.filter((e) => e.type === 'file');
let copied = 0;
let updated = 0;

for (const d of dirs) {
  const dstDir = path.join(DST, d.rel);
  if (!fs.existsSync(dstDir)) fs.mkdirSync(dstDir, { recursive: true });
}

for (const f of files) {
  const dstFile = path.join(DST, f.rel);
  const dstDir = path.dirname(dstFile);
  if (!fs.existsSync(dstDir)) fs.mkdirSync(dstDir, { recursive: true });
  const existed = fs.existsSync(dstFile);
  const needCopy = !existed || fs.statSync(dstFile).size !== f.size;
  if (needCopy) {
    fs.copyFileSync(f.full, dstFile);
    const ok = fs.existsSync(dstFile) && fs.statSync(dstFile).size === f.size;
    if (!ok) throw new Error(`Copy failed: ${f.rel}`);
    existed ? updated++ : copied++;
  }
}

const totalSize = files.reduce((sum, f) => sum + f.size, 0);
const topItems = fs.readdirSync(SRC)
  .filter((n) => !IGNORE.has(n))
  .map((n) => {
    const full = path.join(SRC, n);
    const stat = fs.statSync(full);
    return { rel: n, size: stat.size };
  });

const manifestPath = path.join(DST, '备份清单.txt');
const lines = [
  '备份时间: ' + new Date().toISOString(),
  `源目录: ${SRC}`,
  `目标目录: ${DST}`,
  `顶层项目数: ${topItems.length}`,
  `文件总数: ${files.length}`,
  `总大小: ${formatBytes(totalSize)}`,
  '',
  '--- 顶层统计 ---',
  ...topItems.map((i) => `${i.rel}\t${formatBytes(i.size)}`),
  '',
  '--- 完整相对路径清单 ---',
  ...files.map((f) => f.rel),
];
fs.writeFileSync(manifestPath, lines.join('\n'), 'utf-8');

console.log(`备份完成: ${files.length} 个文件, ${formatBytes(totalSize)}, 耗时 ${Date.now() - start}ms`);
console.log(`清单已生成: ${manifestPath}`);
