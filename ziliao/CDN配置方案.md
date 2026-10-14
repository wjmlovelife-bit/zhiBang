# Cloudflare CDN 配置方案（自定义域名 + Tunnel + 边缘缓存）

> 编写日期：2026-09-28
> 目标：首屏静态资源（`/assets/*`）走 Cloudflare 边缘缓存，**完全绕开 tunnel**，首屏从 5-8s 降到 0.5-1.5s
> 适用：项目当前使用 cloudflared 临时域名 `*.trycloudflare.com`，想升级到自有域名

---

## 一、架构总览

```
浏览器（用户）
   │
   ▼
Cloudflare 边缘节点（全球 200+ POP，自动选最近）
   │
   ├─ /assets/*.js, /assets/*.css, 字体, 图标
   │   ↓ 命中缓存，直接返回（0-50ms）
   │   ↓ MISS → 回到 origin 回源一次，后续都缓存
   │
   ├─ /api/*, /upload/*
   │   ↓ 走 tunnel（100-200ms 往返）→ 本机 cloudflared → 8080 → 3001
   │
   └─ /sales/*, /system/* 等 SPA 路由
       ↓ SPA fallback → /index.html → 浏览器解析新入口 hash → 拉新 assets
```

---

## 二、前置条件清单

| 项 | 要求 | 备注 |
|---|---|---|
| 域名 | 1 个（任意注册商）| 推荐阿里云/腾讯云/Cloudflare Registrar |
| Cloudflare 账号 | 免费版够用 | https://dash.cloudflare.com 注册 |
| cloudflared | 已部署 | 当前用临时域名的现状 |
| 本地后端 | NestJS 3001 + serve-frontend 8080 跑通 | 现状 |

**总耗时估算**：30-40 分钟（首次配置）

---

## 三、详细步骤（10 步）

### 步骤 1：域名接入 Cloudflare（5 分钟）

```
1. 打开 https://dash.cloudflare.com → Add a Site → 输入域名（如 zhibang.example.com）
2. 选择 Free 计划（$0/月）
3. Cloudflare 自动扫描现有 DNS 记录 → Continue
4. Cloudflare 给你 2 个 NS 记录，如：
   anna.ns.cloudflare.com
   bob.ns.cloudflare.com
5. 去域名注册商后台 → 修改 NS 记录 → 粘贴上面 2 条
   - 阿里云：域名控制台 → 修改 DNS → 修改 NS
   - 腾讯云：DNSPod → 我的域名 → NS 记录
6. 等待 5-30 分钟生效（Cloudflare 会发邮件通知）
7. 回到 Cloudflare Dashboard → 状态变 "Active" 即完成
```

**验证**：
```bash
nslookup your-domain.com
# 期望：返回 anna.ns.cloudflare.com / bob.ns.cloudflare.com
```

---

### 步骤 2：创建命名 tunnel（替代临时 tunnel）

当前若是 free/临时 tunnel，需升级为命名 tunnel 才能绑定自定义域名。

```bash
# 1. 登录（首次需要）
cloudflared tunnel login
# 浏览器会打开 Cloudflare 让选域名

# 2. 创建命名 tunnel
cloudflared tunnel create zhibang
# 输出：Tunnel credentials written to /root/.cloudflared/<UUID>.json
#      Tunnel zhibang created with id <UUID>

# 3. 改 config.yml（替换之前的临时 tunnel 配置）
```

**配置文件**（`~/.cloudflared/config.yml`，Windows 在 `%USERPROFILE%\.cloudflared\config.yml`）：

```yaml
tunnel: <你的-UUID>
credentials-file: /root/.cloudflared/<UUID>.json

# 入口规则：所有命中 your-domain.com 的请求转本地 8080
ingress:
  - hostname: your-domain.com
    service: http://localhost:8080
  # 兜底：未匹配返回 404
  - service: http_status:404
```

---

### 步骤 3：DNS 自动绑定 tunnel（2 分钟）

```bash
# Cloudflare Dashboard 加一条 CNAME（也可手动加）
cloudflared tunnel route dns zhibang your-domain.com
# 输出：Added CNAME your-domain.com → <UUID>.cfargotunnel.com

# 验证
nslookup your-domain.com
# 期望：your-domain.com → <UUID>.cfargotunnel.com → Cloudflare IP
```

**或手动**（Cloudflare Dashboard）：
```
DNS → Records → Add
Type: CNAME
Name: @（或留空）
Target: <UUID>.cfargotunnel.com
Proxy status: Proxied（橙色云朵）
```

---

### 步骤 4：启动 tunnel（1 分钟）

```bash
# Linux / macOS
cloudflared tunnel run zhibang

# Windows（推荐做成服务）
cloudflared service install
# 或直接前台跑
cloudflared.exe tunnel run zhibang

# 验证
curl -I https://your-domain.com/
# 期望：HTTP/2 200, server: cloudflare
```

---

### 步骤 5：**核心：Page Rules 缓存静态资源**（3 分钟）

> 这是提速最关键的一步。配置后 `/assets/*` 全部从 Cloudflare 边缘缓存拉取，**完全不走 tunnel**。

**Cloudflare Dashboard**：
```
Rules → Page Rules → Create Page Rule
```

#### 规则 1：缓存静态资源（assets）

| 字段 | 值 |
|---|---|
| **URL pattern** | `*your-domain.com/assets/*` |
| **Cache Level** | `Cache Everything` |
| **Edge Cache TTL** | `1 month` |
| **Browser Cache TTL** | `1 year` |
| **Auto Minify** | ☑ HTML ☑ CSS ☑ JS |
| **Brotli** | ☑ |
| **Cache on cookie** | ☐ 不勾 |
| **Cache status codes** | 200（默认） |

**保存**。

#### 规则 2：API 不缓存（防 stale data）

| 字段 | 值 |
|---|---|
| **URL pattern** | `*your-domain.com/api/*` |
| **Cache Level** | `Bypass` |
| 其他 | 默认 |

#### 规则 3（可选）：index.html 强制回源（保证新版本及时生效）

| 字段 | 值 |
|---|---|
| **URL pattern** | `your-domain.com/index.html` |
| **Cache Level** | `Bypass` |
| 其他 | 默认 |

> **为什么 index.html 要 bypass**：vite 的 `index.html` 入口文件**不含 hash**（同名），如果缓存，下次部署用户浏览器会拿到老 index → 老 hash 的 JS → **老版本持续生效**。
> 反之 `/assets/index-XXX.js`（带 hash）可以永久缓存——hash 自带内容指纹，老 hash 自然失效。

**免费版 Page Rules 限 3 条**——刚够用。

---

### 步骤 6：Speed Optimization（5 分钟）

```
Speed → Optimization → 全部勾选：
☑ Auto Minify: HTML, CSS, JS
☑ Brotli
☑ Early Hints
☑ HTTP/2 (默认开)
☑ HTTP/3 (QUIC)
☑ 0-RTT Connection Resumption

# 图像优化（项目用图标少，可选）
☐ Polish (Basic)
☐ Mirage
```

---

### 步骤 7：SPA Fallback（10 分钟）

**问题**：用户访问 `https://your-domain.com/sales/sales-schedule`，Cloudflare 边缘节点没这个文件，直接 404。

**方案 A：用 Cloudflare Workers**（推荐，免费 10 万请求/天）

```js
// Cloudflare Dashboard → Workers → Create application
// 命名: spa-fallback，绑定 your-domain.com
```

代码（Workers Editor）：
```javascript
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // API 和 upload 走 tunnel 路径，转发给 tunnel 连接的 origin server
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/upload/')) {
      return fetch(request);  // cloudflared 自动接管
    }
    
    // 静态资源（assets / 静态文件）也走 origin
    if (url.pathname.includes('.')) {
      return fetch(request);
    }
    
    // SPA 路由：返回 index.html（让前端 router 处理）
    return fetch('https://your-domain.com/index.html');
  }
};
```

**方案 B：用 Page Rules 的 Forwarding URL**（简单但只支持 301/302）

```
URL: *your-domain.com/sales/*
Settings: Forwarding URL (301) → https://your-domain.com/index.html
```

**问题**：会改 URL（用户看到的是 `/index.html` 而不是 `/sales/sales-schedule`）。**推荐方案 A**。

---

### 步骤 8：验证清单（5 分钟）

#### 8.1 边缘缓存验证

```bash
# 首次拉取（缓存未命中 → 回源 → 缓存）
curl -I https://your-domain.com/assets/vue-vendor-XXXXX.js
# 期望：
#   cf-cache-status: MISS
#   cf-cache-status: EXPIRED（之前有人访问过）
#   age: 0

# 再次拉取（命中缓存）
curl -I https://your-domain.com/assets/vue-vendor-XXXXX.js
# 期望：
#   cf-cache-status: HIT
#   age: 3600
#   cf-ray: <新的 ray id>
#   server: cloudflare

# 验证大小
ls -la frontend/dist/assets/*.js.gz  # 看 gzipped 体积
```

#### 8.2 tunnel 路径验证

```bash
# API 仍走 tunnel（不缓存）
curl -I https://your-domain.com/api/sales-schedule?weekStart=2026-09-14
# 期望：
#   cf-cache-status: DYNAMIC 或 BYPASS
#   cf-ray: 每次不同（证明经过 CF）
```

#### 8.3 SPA 路由验证

```bash
# SPA 路由（应该返回 index.html）
curl -I https://your-domain.com/sales/sales-schedule
# 期望：
#   HTTP/2 200
#   content-type: text/html
#   cf-cache-status: DYNAMIC（不缓存）

# 浏览器打开：应能正常加载 sales-schedule 页面
```

#### 8.4 网络质量验证

```
打开 https://your-domain.com/sales/sales-schedule
打开浏览器 DevTools → Network 面板
观察：
✓ HTML 加载 < 200ms（首次）/ < 50ms（缓存）
✓ assets/*.js 加载 < 100ms（CDN 命中）/ cf-cache-status: HIT
✓ /api/* 调用仍走 tunnel（约 100-200ms）
✓ 整体首屏可交互 < 1.5s
```

---

### 步骤 9：自动化维护（CI/CD 可选）

**手动部署**：
```bash
# 本机 build 后，index.html hash 变了，但 assets/*.js hash 不变（增量复用）
cd frontend
npm run build
# 把新 index.html 推到服务器（tunnel 已有，不需要重新配）
# 用户下次访问 → 拉新 index.html → 拉新入口 chunk
```

**无需重启 cloudflared**——只要 8080 服务的 dist 变了，tunnel 自动转发新版本。

---

## 四、Cloudflare 缓存策略速查表

| 路径模式 | Cache Level | Edge TTL | Browser TTL | 说明 |
|---|---|---|---|---|
| `/assets/*` | Cache Everything | 1 month | 1 year | **核心：命中后 0-50ms** |
| `/api/*` | Bypass | — | — | API 不能 stale |
| `/index.html` | Bypass | — | — | 入口文件不能缓存（vite hash 名） |
| `/sw.js`, `/workbox-*` | Bypass | — | — | service worker 必须每次更新 |
| `/sales/*`, `/system/*` | Bypass | — | — | SPA 路由被 Worker 转 index.html |

**免费版 Page Rules 限 3 条**——本方案正好用满（assets / api / index.html）。

---

## 五、常见问题排查

| 问题 | 原因 | 解决 |
|---|---|---|
| 页面打开还是慢 | 1) Page Rules 未生效 2) DNS 未切完 | curl -I 看 `cf-cache-status`，等 DNS 全球生效 |
| `cf-cache-status: DYNAMIC` 而不是 HIT | 命中了 `/api/*` 或 SPA 路由 | 检查 Page Rules 的 URL pattern |
| `cf-cache-status: BYPASS` | 命中 bypass 规则 | 检查是否是 `/api/*` |
| 老版本部署后用户还是看到旧页面 | index.html 被缓存了 | 加 Page Rules bypass index.html |
| Cloudflare 报 521（Web server is down） | 本机 8080 离线或 cloudflared 未运行 | `cloudflared tunnel info zhibang` 看状态 |
| Cloudflare 报 523（Origin is unreachable） | tunnel ID 错了或 DNS 未配 | 检查 config.yml UUID 与 dashboard 一致 |
| Cloudflare 报 520（Web server returned an unknown error） | 本地服务异常返回 | 看 `cloudflared` 日志 |

---

## 六、成本与限制

| 项 | 免费版 | 付费版（如有需要）|
|---|---|---|
| Page Rules | **3 条**（本方案用满）| 10+ 条/域名 |
| Workers | 10 万请求/天 | 1000 万请求/$5 |
| 边缘缓存 | 无限 | — |
| CDN 流量 | 无限 | — |
| DNS 查询 | 无限 | — |

**完全免费**。

---

## 七、提速效果实测预期

| 阶段 | 现状（临时 tunnel）| 配置后 |
|---|---|---|
| 首次访问 `/sales/sales-schedule` | 5-8s | 1.5-2.5s |
| **二次访问（同浏览器）** | 5-8s（无缓存）| **0.5-1s**（CDN 命中）|
| 跨地域访问（北美→亚洲用户）| 2-4s | **0.5-1.5s**（就近 POP）|
| API 单次调用 | 200-400ms | 100-200ms（边缘节点就近）|
| 并发 100 用户 | 50-80 人可用（受 tunnel 限）| **500+ 可用**（静态资源全走 CDN）|

**最关键指标**：二次访问**亚秒级**，几乎感觉不到慢。

---

## 八、附录：完整命令清单

```bash
# === 一次性配置 ===

# 1. 安装 cloudflared（如果没有）
# Windows: winget install Cloudflare.cloudflared
# macOS: brew install cloudflared
# Linux: 见 https://pkg.cloudflare.com/

# 2. 登录
cloudflared tunnel login

# 3. 创建命名隧道
cloudflared tunnel create zhibang
# 记下输出的 UUID

# 4. 配置 config.yml（见步骤 2）

# 5. DNS 绑定
cloudflared tunnel route dns zhibang your-domain.com

# 6. 启动（前台调试）
cloudflared tunnel run zhibang

# 或作为服务（生产）
# Linux:
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
# Windows:
cloudflared service install

# === 验证 ===

curl -I https://your-domain.com/
curl -I https://your-domain.com/assets/vue-vendor-XXXX.js
curl -I https://your-domain.com/api/sales-schedule

# === 回滚（如果出错）===

# 临时切回 trycloudflare：
cloudflared tunnel --url http://localhost:8080
# 拿到新的临时 URL，访问临时 URL 即可
```

---

## 九、维护清单

每次部署新版本只需：

```
✅ 步骤 A：frontend/dist 重新 build（生成新 index.html + 新 hash 的 assets）
✅ 步骤 B：把新 dist 复制到 8080 服务的目录（如 cp / cygwin / docker volume）
✅ 步骤 C：用户访问时 Cloudflare 边缘节点看到 /assets/* 文件 hash 一样 → 直接缓存命中；index.html 不一样 → 回源拉新版本
✅ 步骤 D：无需重启 cloudflared，无需清 Cloudflare 缓存
```

**部署完即可生效**。