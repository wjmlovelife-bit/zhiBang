// 纯 Node 静态服务器：托管 frontend/dist，并把 /api、/upload 代理到后端 3001。
// 不依赖数据库/后端进程，即使后端崩溃，页面也能正常显示（登录失败会明确报错而非白屏）。
import http from 'node:http';
import { stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { existsSync } from 'node:fs';
import { join, extname, normalize, sep } from 'node:path';

const ROOT = join(process.cwd(), 'frontend', 'dist');
const API_HOST = '127.0.0.1';
const API_PORT = 3001;
const PORT = 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
};

function proxy(req, res, fullPath) {
  const options = {
    host: API_HOST,
    port: API_PORT,
    path: fullPath,
    method: req.method,
    headers: { ...req.headers, host: `${API_HOST}:${API_PORT}` },
  };
  const p = http.request(options, (pres) => {
    res.writeHead(pres.statusCode, pres.headers);
    pres.pipe(res);
  });
  p.on('error', (e) => {
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(
      JSON.stringify({
        message: 'Backend unreachable: ' + e.message,
        hint: '后端(3001)未启动 或 PostgreSQL 未运行。请检查 D:/tmp/zhibang-backend.log',
      }),
    );
  });
  req.pipe(p);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);

  // 接口请求：代理到后端
  if (pathname.startsWith('/api') || pathname.startsWith('/upload')) {
    return proxy(req, res, pathname + url.search);
  }

  // 静态文件
  // 先做路径安全校验：归一化后必须落在 ROOT 内，否则直接拒绝（不兜底成首页）
  if (pathname.includes('..') || pathname.includes('\0')) {
    res.writeHead(400);
    return res.end('Bad Request');
  }
  let filePath = normalize(join(ROOT, pathname));
  if (filePath !== ROOT && !filePath.startsWith(ROOT + sep)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  let exists = false;
  try {
    const s = await stat(filePath);
    if (s.isDirectory()) {
      filePath = join(filePath, 'index.html');
    }
    exists = true;
  } catch {
    exists = false;
  }
  if (!exists) {
    // SPA 回退：仅对“无文件后缀”的 GET 路由返回 index.html；其余 404
    if (req.method === 'GET' && !extname(pathname)) {
      filePath = join(ROOT, 'index.html');
    } else {
      res.writeHead(404);
      return res.end('Not Found');
    }
  }
  const ext = extname(filePath) || '.html';
  // Cache-Control 策略：
  // - index.html 走 no-cache：每次重新拉取，保证新 build 后用户能立刻看到新入口 hash，
  //   避免浏览器缓存老 index-XXX.js 导致老 dist 持续生效（曾踩坑）。
  // - assets/* 下带 hash 的 chunks（index-XXX.js、List-XXX.js、Index-XXX.css 等）：
  //   永久缓存。vite 的 hash 文件名自带内容指纹，永久缓存可最大化复用、减小传输。
  //   index.html 重新拉取后会指向新 hash 的入口，老 hash 文件自然失效（不浪费）。
  // - R21 B-3（2026-09-28）：移除 PWA 后不再有 /sw.js 和 /workbox-* 文件，无需特殊处理
  const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
  if (ext === '.html') {
    headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    headers['Pragma'] = 'no-cache';
    headers['Expires'] = '0';
  } else {
    headers['Cache-Control'] = 'public, max-age=31536000, immutable';
  }
  // 3.3 gzip 协商：build 时 vite-plugin-compression 已生成 .gz 副本；
  //    浏览器送 Accept-Encoding: gzip 时返回 .gz + Content-Encoding: gzip，否则返回明文。
  //    Vary: Accept-Encoding 必须设置，避免 CDN/中间代理把压缩版缓存给非 gzip 客户端。
  const ae = req.headers['accept-encoding'] || '';
  const acceptsGzip = typeof ae === 'string' && /\bgzip\b/.test(ae);
  const gzPath = filePath + '.gz';
  const useGz = acceptsGzip && existsSync(gzPath);
  const finalPath = useGz ? gzPath : filePath;
  headers['Vary'] = 'Accept-Encoding';
  if (useGz) {
    headers['Content-Encoding'] = 'gzip';
  }
  res.writeHead(200, headers);
  createReadStream(finalPath).pipe(res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[serve-frontend] http://127.0.0.1:${PORT}/  (proxies /api -> ${API_HOST}:${API_PORT})`);
  console.log(`[serve-frontend] serving: ${ROOT}`);
});
