# 智邦 CRM

> 飞创腾达（FUTURE TREND）内部 CRM：销售日程 / 客户 / 项目 / 跟进 / 合同 / 报价 / 库存 / 采购 / 周总结 / 工作日志一体化管理

## 技术栈

| 层 | 选型 | 版本 |
|---|---|---|
| 前端 | Vue 3 + Vite + Element Plus | Vue 3.4 / Vite 5 / Element Plus 2.7 |
| 后端 | NestJS + Prisma | NestJS 10 / Prisma 5.20 |
| 数据库 | PostgreSQL | 16+ |
| 鉴权 | JWT (passport-jwt + bcryptjs) | - |
| 运行时 | Node.js | 22+ |

## 环境要求

- **Node.js** ≥ 22（推荐 22.22.2-LTS 或 24+）
- **PostgreSQL** ≥ 16（默认监听 localhost:5432）
- **Git** + Bash（Windows 下推荐 Git Bash 或 PowerShell）

## 快速启动（5 步）

```bash
# 1. 克隆项目
git clone <repository-url> zhibang
cd zhibang

# 2. 配置环境变量（每个 .env.example 复制成 .env，按需修改）
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 3. 安装依赖
cd backend && npm install
cd ../frontend && npm install

# 4. 初始化数据库（首次启动）
# 4.1 启动 PostgreSQL（详见 D:\OdooPG\bin\pg_ctl.exe）
# 4.2 跑 schema 迁移 + 种子数据（仅本地/测试）
cd backend
npx prisma migrate deploy         # 跑迁移（生产用 deploy，开发用 migrate dev）
npm run seed                       # 灌种子数据（**禁止生产环境跑**）

# 5. 启动开发服务
# 5.1 后端（端口 3001）
cd backend && npm run start:dev
# 5.2 前端（端口 5173，默认代理 /api 到后端）
cd frontend && npm run dev
```

打开浏览器：`http://localhost:5173`，登录：
- **admin / 123456**（管理员，看全部）
- **sales01 / 123456**（销售员，仅看自己）

## 项目结构

```
zhibang/
├── backend/                 # NestJS 后端
│   ├── src/
│   │   ├── modules/         # 业务模块（customer/project/contract/quotation 等）
│   │   ├── common/          # 公共工具（guards/utils/pdf/scope）
│   │   ├── prisma/          # PrismaService + schema.prisma
│   │   └── main.ts          # 启动入口
│   ├── prisma/
│   │   ├── schema.prisma    # PG schema（数据模型）
│   │   ├── migrations/      # 数据库迁移（含 nextCode-seq.sql 等）
│   │   └── seed.ts          # 种子数据脚本（npm run seed）
│   ├── test/                # e2e 测试
│   └── package.json
├── frontend/                # Vue 3 前端
│   ├── src/
│   │   ├── api/             # axios 封装 + 后端接口
│   │   ├── components/      # 公共组件（ConfigurableTable 等）
│   │   ├── views/           # 页面（customer/ project/ contract/ quotation ...）
│   │   ├── router/          # vue-router 配置
│   │   ├── store/           # Pinia store
│   │   └── main.ts
│   └── package.json
├── backendTest/             # 后端单元测试（jest + PrismaService mock）
│   └── src/unit/
├── frontendTest/            # 前端单元测试（vitest + happy-dom）
│   └── src/
├── zhibangDataBackup/       # PG 数据备份目录（每日 00:00 自动备份）
│   ├── db/                  # pg_dump 文件，保留 7 天
│   ├── uploads/             # 用户上传文件备份
│   └── logs/                # 备份日志
├── docs/                    # 内部文档（架构 / ER / API + 自动导出的 Swagger）
│   ├── architecture.md       # 系统架构图（4.1）
│   ├── database-er.md       # 数据库 ER 图（4.2）
│   ├── api.md               # API 文档补充（4.3）
│   └── api.swagger.json     # OpenAPI 规范（自动生成）
├── scripts/                 # 工具脚本
│   └── export-swagger.mjs   # Swagger 导出
└── README.md                # 本文件
```

## 测试

```bash
# 后端单元测试（46 套件 / 491 用例）
cd backendTest && npm test

# 前端单元测试（13 套件 / 218 用例）
cd frontendTest && npm test
```

## 常用命令速查

| 命令 | 说明 |
|---|---|
| `npm run start` | 后端启动（端口 3001） |
| `npm run start:dev` | 后端开发模式（带 watch） |
| `npm run build` | 后端编译（输出 dist/） |
| `npx prisma studio` | 打开 PG 数据浏览器 |
| `npx prisma migrate dev` | 开发环境生成新迁移 |
| `npx prisma migrate deploy` | 生产环境应用迁移 |
| `npm run seed` | 灌种子数据（**仅本地/测试**） |
| `npm test` | 跑测试 |
| `npm run lint` | ESLint 检查 |
| `npm run lint:fix` | ESLint 自动修复 |

## 数据备份

每天 00:00 自动备份 PG 数据到 `D:\github\xiangmutest\opencode\zhibangDataBackup\db\`，保留最近 7 天。
手动备份：双击 `zhibangDataBackup\backup-master.bat`（需管理员权限）。

## 文档导航

| 文档 | 内容 |
|---|---|
| `README.md` | 本文件：项目介绍 + 快速启动 + FAQ |
| `docs/architecture.md` | 系统架构图（C4 L1/L2/L3 + 数据流） |
| `docs/database-er.md` | 数据库 ER 图（38 张业务表 + 5 个子图） |
| `docs/api.md` | API 文档补充（认证 / 错误码 / 分页 / 排序 / dataScope / 业务约定） |
| `docs/api.swagger.json` | OpenAPI 规范（自动生成，前端可用 openapi-typescript 生成类型） |

## 常见问题

**Q: 重启后端后 401 跳登录，会丢表单吗？**
A: 不会。已用 SPA 路由跳转（`router.push({path:'/login', query:{redirect:原页面路径}}`），登录后自动跳回。

**Q: 新建客户/项目时 code 重复怎么办？**
A: 已修复：5 个业务表（客户/项目/合同/报价/工作日志）使用 PG SEQUENCE 原子计数器，并发安全。

**Q: SysOperLog 表为什么是空的？**
A: 后端暂未启用操作日志中间件，待后续开发。

## 联系

- 项目 Owner：刘德彬（admin）
- 技术栈：NestJS + Vue 3 + Prisma + PostgreSQL 16
- 公司：陕西飞创腾达电子科技有限公司（FUTURE TREND，深圳）
