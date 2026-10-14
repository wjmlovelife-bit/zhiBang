// scripts/export-swagger.mjs
// 从运行中的 NestJS 后端导出 OpenAPI 规范到 docs/api.swagger.json
//
// 使用步骤：
//   1. 启动后端：cd backend && npm run start （保持运行）
//   2. 在另一个 cmd 跑：node scripts/export-swagger.mjs
//   3. 检查 docs/api.swagger.json 是否生成（提交进 git）
//
// 注意：后端必须能访问，否则 fetch 会失败。
// 如需 YAML 格式：npx openapi-typescript docs/api.swagger.json --output src/types/api.d.ts
//                或：npm i -g yaml-cli && yaml < docs/api.swagger.json > docs/api.swagger.yml

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SWAGGER_URL = process.env.SWAGGER_URL || 'http://127.0.0.1:3001/api/docs-json';
const OUT_PATH = path.join(__dirname, '..', 'docs', 'api.swagger.json');

async function main() {
  console.log(`[export-swagger] fetching ${SWAGGER_URL} ...`);
  const t0 = Date.now();
  let json;
  try {
    const res = await fetch(SWAGGER_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    json = await res.json();
  } catch (e) {
    console.error(`[export-swagger] FAILED: ${e.message}`);
    const port = (SWAGGER_URL.match(/:(\d+)/) || [, ''])[1];
    console.error(`  - 提示：后端是否已启动？端口 ${port}`);
    console.error(`  - 启动后端：cd backend && npm run start`);
    process.exit(1);
  }
  const dt = Date.now() - t0;
  console.log(`[export-swagger] fetched in ${dt}ms, ${(JSON.stringify(json).length / 1024).toFixed(1)} KB`);

  // 确保 docs/ 目录存在
  const docsDir = path.dirname(OUT_PATH);
  if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });

  fs.writeFileSync(OUT_PATH, JSON.stringify(json, null, 2), 'utf-8');
  const size = (fs.statSync(OUT_PATH).size / 1024).toFixed(1);
  console.log(`[export-swagger] written: ${OUT_PATH} (${size} KB)`);
  console.log(`[export-swagger] paths=${Object.keys(json.paths || {}).length}, tags=${(json.tags || []).length}, schemas=${Object.keys(json.components?.schemas || {}).length}`);
}

main().catch(e => { console.error(e); process.exit(1); });