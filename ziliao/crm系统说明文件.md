# 智邦 CRM 系统说明文件

> 本文档为智邦 CRM 系统的完整说明文件，包含架构、文件组成、菜单权限、功能、使用、移植等 6 大章节。
>
> **维护规则**：每次有改动都要在对应章节更新。例如：
> - 新增菜单 → 第 2、3、4、5 章都要更新
> - 新增依赖 → 第 1 章依赖清单 + 第 2 章 package.json 描述
> - 修改数据库 → 第 1 章数据库 + 第 2 章 prisma/schema.prisma
> - 修改端口/代理 → 第 1 章公网访问 + 第 2 章 serve-frontend.mjs
>
> 文件位置：`D:\github\xiangmutest\opencode\zhibang\ziliao\crm系统说明文件.md`

---

## 目录

- [第 1 章 架构、依赖、数据库、公网访问](#第-1-章-架构依赖数据库公网访问)
- [第 2 章 文件组成](#第-2-章-文件组成)
- [第 3 章 菜单和权限](#第-3-章-菜单和权限)
- [第 4 章 功能说明](#第-4-章-功能说明)
- [第 5 章 使用说明](#第-5-章-使用说明)
- [第 6 章 移植到其他 Windows 10/11 电脑](#第-6-章-移植到其他-windows-1011-电脑)

---

## 第 1 章 架构、依赖、数据库、公网访问

### 1.1 整体架构

```
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│  Browser (用户)    │      │ serve-frontend    │      │  Backend (NestJS) │
│  http://127.0.0.1 │ ──▶  │   Node.js 8080   │ ──▶  │  http://127.0.0.1 │
│      :8080/       │      │   (代理 /api)     │      │     :3001/api     │
└──────────────────┘      └──────────────────┘      └──────────────────┘
                                                          │
                                                          ▼
                                                  ┌──────────────────┐
                                                  │  PostgreSQL       │
                                                  │  D:\OdooPG\data   │
                                                  │  :5432            │
                                                  └──────────────────┘
```

### 1.2 前端技术栈

#### Vue 3
- **版本**：^3.4.31
- **官网**：https://vuejs.org/
- **说明**：渐进式 JavaScript 框架，使用 Composition API + `<script setup>` 语法。组件化开发、响应式数据、虚拟 DOM。本系统所有页面和组件都用 Vue 3 编写。

#### Element Plus
- **版本**：^2.7.6
- **官网**：https://element-plus.org/
- **说明**：基于 Vue 3 的桌面端组件库。提供了 el-table、el-form、el-dialog、el-upload、el-menu 等 80+ 组件。本系统的所有 UI（表格、表单、弹窗、上传、菜单、表单校验）都基于 Element Plus。

#### Pinia
- **版本**：^2.1.7
- **官网**：https://pinia.vuejs.org/
- **说明**：Vue 3 官方推荐的状态管理库（替代 Vuex）。本系统用于 user store（保存当前登录用户、菜单、权限、isAdmin、roleCodes、dataScope），并自动持久化到 localStorage。

#### Vue Router
- **版本**：^4.4.0
- **官网**：https://router.vuejs.org/
- **说明**：Vue 3 官方路由管理器。本系统路由配置在 `frontend/src/router/index.ts`，支持 `meta.public`（登录页免登录）、`meta.perm`（基于权限显示菜单）、`meta.title`（页面标题）。

#### Axios
- **版本**：^1.7.2（实际安装 1.20.0）
- **官网**：https://axios-http.com/
- **说明**：基于 Promise 的 HTTP 客户端。本系统统一在 `frontend/src/api/request.ts` 封装 axios 实例：baseURL='/api'（由 8080 静态服务器代理到 3001）、自动注入 `Authorization: Bearer <token>` + `X-Request-Id` 头、401 自动跳登录、错误统一 toast。

#### SortableJS
- **版本**：^1.15.2（实际安装 1.15.7）
- **官网**：https://github.com/SortableJS/Sortable
- **说明**：拖拽库。本系统用于问题19 修复——`ConfigurableTable.vue` 的表头拖动 + 字段定制弹窗的行拖动（重排列顺序）。

#### XLSX
- **版本**：^0.18.5
- **官网**：https://github.com/SheetJS/sheetjs
- **说明**：Excel 解析/导出库。本系统用于客户/项目/库存/采购的导入（解析 Excel 文件为 JSON）和导出（List 列表 → .xlsx 文件）。

### 1.3 后端技术栈

#### NestJS
- **版本**：^10.x（`@nestjs/common`、`@nestjs/core`、`@nestjs/platform-express` 等）
- **官网**：https://nestjs.com/
- **说明**：用于构建服务端应用的渐进式 Node.js 框架。本系统后端用 NestJS CLI 开发，模块化组织（按业务拆 customer / project / quotation / contract / worklog / inventory / purchase / auth / upload / sys 等模块）。入口 `backend/src/main.ts` → `app.setGlobalPrefix('api')` → 路由前缀 `/api`。

#### Prisma
- **版本**：^5.20.0
- **官网**：https://www.prisma.io/
- **说明**：Node.js & TypeScript ORM。Schema 定义在 `backend/prisma/schema.prisma`，Prisma client 通过 `backend/src/prisma/` 注入到 NestJS。提供类型安全的数据库访问、自动迁移、查询构建器。

#### PostgreSQL
- **版本**：用户本地 `D:\OdooPG`（推荐 v14+）
- **官网**：https://www.postgresql.org/
- **说明**：开源关系型数据库。DATABASE_URL 在 `backend/.env` 配置（默认 `postgresql://postgres:postgres@localhost:5432/zhibang`）。

#### JWT（@nestjs/jwt）
- **官网**：https://github.com/nestjs/jwt
- **说明**：JSON Web Token，用于无状态认证。前端登录后拿到 token，存 localStorage，每次请求 Header 带 `Authorization: Bearer <token>`。后端 `JwtAuthGuard`（`backend/src/common/guards/`）校验 token 提取 user 注入到 `@CurrentUser()` 装饰器。

#### Multer
- **官网**：https://github.com/expressjs/multer
- **说明**：文件上传中间件（在 `@nestjs/platform-express` 里）。本系统 `backend/src/modules/upload/upload.controller.ts` 用它处理 multipart/form-data，存到 `backend/uploads/` 目录。

#### iconv-lite
- **官网**：https://github.com/ashtuchkin/iconv-lite
- **说明**：Node.js 字符编码转换库。本系统用于中文文件名解码（Node HTTP body 解析按 latin1，需要重新转 UTF-8）—— `upload.controller.ts` 的 `decodeOriginalname` 函数。

#### class-validator / class-transformer
- **官网**：https://github.com/typestack/class-validator
- **说明**：TypeScript 装饰器风格的 DTO 验证。本系统用 `@IsString() @IsNotEmpty() @MaxLength()` 验证登录入参（`backend/src/modules/auth/dto/login.dto.ts`）。

### 1.4 构建工具

#### Vite（前端）
- **版本**：^5.x
- **官网**：https://vitejs.dev/
- **说明**：下一代前端构建工具。`frontend/vite.config.ts` 配置了 dev server（默认 5173 端口）、proxy（`/api` → `http://127.0.0.1:3001`）、path alias `@`。`npm run build` 输出到 `frontend/dist/`。

#### NestJS CLI（后端）
- **官网**：https://docs.nestjs.com/cli/overview
- **说明**：`nest start` / `nest build` 命令。`backend/nest-cli.json` 配置构建选项。`npm run build` 输出到 `backend/dist/`。

### 1.5 数据库

#### PostgreSQL（用户用 D:\OdooPG）
- **数据目录**：`D:\OdooPG\data`
- **bin 目录**：`D:\OdooPG\bin`
- **启动命令**：`D:\OdooPG\bin\pg_ctl.exe -D D:/OdooPG/data start`
- **DATABASE_URL**：`postgresql://postgres:postgres@localhost:5432/zhibang`

#### Prisma Schema 文件
- **位置**：`backend/prisma/schema.prisma`
- **主要模型**（按业务/系统分组）：

**业务模型：**
- `CrmCustomer`（客户）、`CrmContact`（联系人）、`CrmCustomerFollow`（客户跟进）、`CrmCustomerInherit`（客户继承）
- `CrmOpportunity`（项目/商机）、`CrmOpportunityLine`（项目明细）、`CrmProjectItem`（项目商品）、`CrmProjectFollow`（项目跟进）、`CrmProjectInherit`（项目继承）
- `SalesQuotation`（报价）、`SalesQuotationLine`（报价明细）
- `SalesContract`（合同）、`SalesContractLine`（合同明细）、`SalesContractPaymentPlan`（付款计划）
- `CrmWorkLog`（工作日志）、`CrmWeekSummary`（周总结）、`CrmDailyReport`（日报）
- `BizInventory`（库存）、`BizPurchase`（采购）

**系统模型：**
- `SysUser`（用户）、`SysRole`（角色）、`SysDept`（部门）
- `SysMenu`（菜单）、`SysOperation`（操作权限）
- `SysUserRole`（用户-角色关联）、`SysRoleMenu`（角色-菜单）、`SysRoleOperation`（角色-操作）、`SysUserMenu`（用户-菜单覆盖）、`SysUserOperation`（用户-操作覆盖）
- `SysDict`（字典）、`SysRegion`（行政区划）、`SysCompany`（公司信息）
- `SysLoginLog`（登录日志）、`SysOperLog`（操作日志）、`SysAttach`（附件元数据）

### 1.6 公网访问的软件和配置

#### Node.js
- **版本**：v22.22.2（managed 版本：`C:\Users\魏博\.workbuddy\binaries\node\versions\22.22.2-2\node.exe`）
- **官网**：https://nodejs.org/
- **说明**：JavaScript 运行时。本系统前端构建（vite）和后端运行（nest）都依赖 Node.js。

#### 静态文件服务器（自研 Node.js）
- **文件**：`serve-frontend.mjs`
- **功能**：把 `frontend/dist/` 托管为静态资源（端口 8080），同时代理 `/api` 和 `/upload` 到后端 3001
- **缓存策略**（2026-09-02 修改）：
  - `index.html` → `no-cache, no-store, must-revalidate`（每次重新拉取，保证新 build 后能立即看到新入口）
  - `assets/*`（带 hash 的 chunks）→ `public, max-age=31536000, immutable`（永久缓存，hash 文件名自带内容指纹）

#### 后端服务
- **启动**：`cd backend && npm run start`（= `nest start`）
- **端口**：3001
- **JWT 密钥**：在 `backend/.env` 配置 `JWT_SECRET`（默认 dev 环境用 dev secret）

#### 数据库服务
- **PG bin 路径**：`D:\OdooPG\bin\pg_ctl.exe`
- **数据目录**：`D:\OdooPG\data`
- **启动命令**：`D:\OdooPG\bin\pg_ctl.exe -D D:/OdooPG/data start`

#### 客户端
- 浏览器：Chrome / Edge（推荐最新稳定版）
- 访问地址：`http://127.0.0.1:8080/`
- 登录账号：`admin / 123456`（全部数据权限）或 `sales01 / 123456`（仅本人数据）

---

## 第 2 章 文件组成

> 本章按目录层级详细说明 `D:\github\xiangmutest\opencode\zhibang` 下所有文件的作用。**跳过生成产物**（`node_modules/`、`dist/`、`uploads/`、`zhibangbacken/` 备份目录）和临时日志（`*.log`、`_extract*`）。

### 2.1 项目根目录（zhibang/）

| 文件/目录 | 类型 | 作用 |
|---|---|---|
| `backend/` | 目录 | **后端项目目录**（NestJS）|
| `frontend/` | 目录 | **前端项目目录**（Vue3）|
| `ziliao/` | 目录 | 知识库/参考资料/系统说明（含本文件） |
| `20260828改进点.md` | 文档 | 2026-08-28 当天改进点记录（9 项功能） |
| `leader权限等同于admin方案.md` | 文档 | 权限方案设计 |
| `工作日志模块方案.md` | 文档 | 工作日志模块设计稿 |
| `问题19字段加全方案.md` | 文档 | 问题19（字段加全）方案 |
| `问题20客户详情页区块补全方案.md` | 文档 | 问题20（详情页区块）方案 |
| `crm系统说明文件.md` | 文档 | **本文件（系统完整说明）** |
| `ziliao.md` | 文档 | 旧版知识库索引 |
| `_extract.cjs` | 脚本 | 临时脚本（提取数据用） |
| `_extract_user.txt` | 文本 | 临时数据（提取结果） |
| `backend-boot.log` | 日志 | 后端启动日志（最近 8/27 启动记录） |
| `bench-*.log` / `bench*.mjs` | 测试 | 性能基准测试脚本和日志（早期开发用） |
| `diag.bat` | 脚本 | 早期诊断 bat |
| `fix-issue17.bat` | 脚本 | 修复问题17 的批处理（一次性） |
| `restart-zhibang.bat` | 脚本 | **重启 CRM 一键脚本**（杀旧+起 PG+后端+前端 8080）|
| `run-tests.bat` | 脚本 | **后端 e2e 测试批处理**（test/run-all.mjs）|
| `serve-frontend.mjs` | 脚本 | **静态文件 + API 代理服务器**（端口 8080）|
| `smoke-*.mjs` | 脚本 | smoke 测试（早期回归用） |
| `start-frontend.bat` | 脚本 | **单独启前端 8080 静态服务器** |
| `start-zhibang.bat` | 脚本 | **启动 CRM 一键脚本**（PG+后端+前端）|
| `sync-backup.mjs` | 脚本 | **全量同步备份到 zhibangbacken 目录** |
| `verify-backup.mjs` | 脚本 | **校验备份完整性**（0 缺失 0 大小差异）|

### 2.2 backend/ 目录

| 文件/目录 | 类型 | 作用 |
|---|---|---|
| `dist/` | 目录 | **后端编译产物**（`nest build` 输出）|
| `node_modules/` | 目录 | npm 依赖（生成，跳过） |
| `prisma/` | 目录 | Prisma 相关 |
| `scripts/` | 目录 | 辅助脚本 |
| `seed-min.mjs` | 脚本 | 最小数据 seed 脚本 |
| `src/` | 目录 | **后端源码** |
| `start-backend.bat` | 脚本 | 启后端 |
| `test/` | 目录 | e2e 测试 |
| `test-*.mjs` / `test-*.ts` | 脚本 | 临时复现/调试脚本（问题19-21 期间）|
| `nest-cli.json` | 配置 | NestJS CLI 配置 |
| `package.json` | 配置 | npm 包管理 |
| `package-lock.json` | 锁文件 | npm 锁 |
| `tsconfig.json` | 配置 | TypeScript 编译配置 |
| `tsconfig.build.json` | 配置 | 生产构建 TypeScript 配置 |
| `.env` | 配置 | 环境变量（DATABASE_URL / JWT_SECRET 等）|
| `.eslintrc.js` | 配置 | ESLint |
| `.prettierrc` | 配置 | Prettier |
| `.gitignore` | 配置 | Git 忽略 |

#### backend/src/

| 文件/目录 | 作用 |
|---|---|
| `main.ts` | 入口（`app.setGlobalPrefix('api')`、`enableCors`、启动监听） |
| `app.module.ts` | 根模块（import 所有业务模块 + PrismaModule） |
| `common/` | 公共代码 |
| `common/decorators/` | 自定义装饰器（`@CurrentUser` `@Public`） |
| `common/filters/` | 全局过滤器（异常处理） |
| `common/guards/` | 全局守卫（`JwtAuthGuard`） |
| `common/pdf/` | PDF 模板和渲染（项目/报价/合同 PDF） |
| `common/permissions.ts` | 权限计算工具 |
| `common/scope.ts` | 数据范围过滤（按角色 dataScope 过滤数据） |
| `common/utils/` | 公共工具（`payload.ts` 含 `scrub`/`normalizeDates`/`cleanArrayFields`） |
| `prisma/` | Prisma 模块（`prisma.module.ts` + `prisma.service.ts`） |
| `modules/` | 业务模块（auth/upload/sys/customer/project/quotation/contract/worklog/inventory/purchase） |
| `modules/_archive_opportunity/` | 旧项目模块归档（重命名为 project 之前） |

#### backend/prisma/

| 文件 | 作用 |
|---|---|
| `schema.prisma` | **数据库 schema 定义**（所有模型）|
| `migrations/` | Prisma 迁移历史（init migration + 后续变更） |

#### backend/test/

| 文件 | 作用 |
|---|---|
| `ARCHITECTURE.md` | 测试架构说明 |
| `README.md` | 测试运行说明 |
| `cases/` | 各业务模块的测试用例（startup / auth / menu / regions / customer / project / contract / opportunity / quotation / worklog / sys / upload / permission / regression / inventory / purchase） |
| `lib/` | 测试库（`http.mjs` HTTP 客户端 + `runner.mjs` 测试运行器）|
| `run-all.mjs` | **总测试入口**（按 admin + sales01 顺序跑所有用例）|
| `debug.mjs` | 调试脚本 |

### 2.3 frontend/ 目录

| 文件/目录 | 作用 |
|---|---|
| `dist/` | **前端构建产物**（vite build 输出） |
| `node_modules/` | npm 依赖（生成，跳过）|
| `public/` | 静态资源 |
| `src/` | **前端源码** |
| `tests/` | 单元测试（vitest）|
| `index.html` | Vite 入口 HTML |
| `package.json` | npm 包管理 |
| `package-lock.json` | 锁文件 |
| `tsconfig.json` | TS 配置 |
| `tsconfig.node.json` | TS Node 配置（vitest） |
| `vite.config.ts` | **Vite 配置**（port 5173、proxy `/api` → 3001、path alias `@`） |
| `vitest.config.ts` | vitest 配置 |
| `.eslintrc.cjs` / `.prettierrc` | 代码风格 |

#### frontend/src/

| 文件/目录 | 作用 |
|---|---|
| `main.ts` | 入口（createApp、router、pinia、ElementPlus、perm directive）|
| `App.vue` | 根组件 |
| `style.css` | 全局样式 |
| `api/` | API 客户端 |
| `api/index.ts` | API 统一导出（authApi / customerApi / projectApi / quotationApi / contractApi / worklogApi / inventoryApi / purchaseApi / sysApi）|
| `api/request.ts` | **axios 实例 + 拦截器**（401 跳登录 / 错误 toast）|
| `components/` | 公共组件 |
| `components/AttachmentList.vue` | 附件列表展示（缩略图+下载）|
| `components/AttachmentUploader.vue` | **附件上传组件**（el-upload + FormData → /api/upload）|
| `components/ConfigurableTable.vue` | **字段可定制表格**（v-model、列勾选、列拖动、列顺序、CSV 导出）|
| `components/PdfPreviewDialog.vue` | PDF 预览弹窗（独立 Vue app）|
| `composables/` | 组合式函数（Vue3 Composition API） |
| `composables/useAttachments.ts` | 附件 composable（isImage / getDownloadUrl / download / formatSize）|
| `composables/useColumnConfig.ts` | **字段可定制 composable**（localStorage 持久化 + mergeWithDefaults）|
| `composables/usePdfPreview.ts` | PDF 预览 composable（独立 app + ElementPlus）|
| `directive/` | 自定义指令 |
| `directive/perm.ts` | v-perm 指令（按权限显示元素） |
| `layout/` | 布局 |
| `layout/DefaultLayout.vue` | **主布局**（左侧菜单 + 顶部 + 主内容） |
| `router/` | 路由 |
| `router/index.ts` | **路由配置**（所有页面 + meta.public + meta.perm）|
| `store/` | Pinia |
| `store/user.ts` | **用户 store**（user / menus / permissions / isAdmin / roleCodes / dataScope + localStorage 持久化）|
| `utils/` | 工具 |
| `views/` | **业务页面**（sales / biz / system / login / dashboard）|

#### frontend/src/views/

| 目录 | 内容 |
|---|---|
| `login/` | `index.vue` 登录页 |
| `dashboard/` | `index.vue` 工作台 |
| `sales/` | **销售管理**（customer / project / quotation / contract / worklog） |
| `biz/` | **商务管理**（inventory / purchase）|
| `system/` | **系统管理**（user / role / dept / menu / operation / company） |

#### frontend/src/views/sales/（销售管理）

| 目录 | 文件 | 作用 |
|---|---|---|
| `customer/` | `List.vue` | 客户列表（搜索+分页+继承+导入+列定制+导出） |
| `customer/` | `Form.vue` | 客户编辑/新建（17+ 字段 + 联系人子表 + 跟进子表 + 附件） |
| `customer/` | `Detail.vue` | 客户详情（区块：基本信息/业务信息/财务信息/备注+附件/联系人/跟进记录/继承历史） |
| `customer/` | `Import.vue` | 客户 Excel 导入 |
| `project/` | `List.vue` / `Form.vue` / `Import.vue` | 项目列表/编辑/导入 |
| `quotation/` | `List.vue` / `Form.vue` | 报价列表/编辑 |
| `contract/` | `List.vue` / `Form.vue` | 合同列表/编辑 |
| `worklog/` | `List.vue` / `Form.vue` | 工作日志列表（5 区块：筛选/周总结/日志列表/客户变更/项目变更）/编辑 |

#### frontend/src/views/biz/（商务管理）

| 目录 | 文件 | 作用 |
|---|---|---|
| `inventory/` | `List.vue` / `Form.vue` / `Import.vue` / `Detail.vue` | 库存 4 文件 |
| `purchase/` | `List.vue` / `Form.vue` / `Import.vue` / `Detail.vue` | 采购 4 文件 |

#### frontend/src/views/system/（系统管理）

| 目录 | 文件 | 作用 |
|---|---|---|
| `user/` | `List.vue` | 用户管理 |
| `role/` | `List.vue` | 角色管理 |
| `dept/` | `List.vue` | 部门管理 |
| `menu/` | `List.vue` | 菜单管理 |
| `operation/` | `List.vue` | 操作权限管理 |
| `company/` | `Info.vue` | 公司信息 |

---

## 第 3 章 菜单和权限

### 3.1 菜单结构

```
├── 📊 工作台
├── 销售管理
│   ├── 客户
│   ├── 项目
│   ├── 报价
│   ├── 合同
│   └── 日志列表
├── 商务管理
│   ├── 库存
│   └── 采购
└── 系统管理
    ├── 用户管理
    ├── 角色管理
    ├── 部门管理
    ├── 菜单管理
    ├── 操作权限
    └── 公司信息
```

### 3.2 菜单配置
- **菜单数据**：`backend/src/modules/sys/`（菜单 CRUD）
- **前端路由**：`frontend/src/router/index.ts`（路由 path + meta.title + meta.perm）
- **左侧菜单渲染**：`frontend/src/layout/DefaultLayout.vue`（通过 `sysApi.menus()` 拉取后渲染 el-menu）

### 3.3 权限模型

#### 数据范围（5 级）
- **1 全部**（dataScope=1）：能看所有数据
- **2 本部门及下级**（dataScope=2）
- **3 本部门**（dataScope=3）
- **4 本人**（dataScope=4）：只能看自己创建/负责的数据
- **5 自定义**（dataScope=5）：customDeptIds 列表

#### 权限来源
- 用户的**所有角色**的 dataScope 取**最小**（最严格）
- 自定义部门列表（customDeptIds）合并所有角色

#### 角色
- `admin`：dataScope=1（全部）+ 所有 permissions
- `leader`：dataScope=2（本部门及下级）
- `sales`/`sales01` 等：dataScope=4（本人）

#### 权限控制
- **菜单级**：`v-perm` 指令 / `<MenuItem v-if="hasPerm('xxx')">`（`frontend/src/directive/perm.ts` + `store/user.ts` 的 `hasPerm` getter）
- **接口级**：`JwtAuthGuard` 校验 token + `@CurrentUser()` 注入 user + `applyDataScope` 过滤数据范围
- **行级**：`customer.service.ts` 等的 `applyDataScope` 函数根据 user.dataScope 自动加 `ownerId` 等过滤条件

#### 操作权限
- `SysOperation` 表存所有细粒度操作（`crm:customer:view` / `crm:customer:create` 等）
- `SysRoleOperation` 角色-操作映射
- `SysUserOperation` 用户-操作覆盖
- 前端 `user.permissions` 数组（登录时从后端 `computePermissions` 计算），用 `hasPerm('crm:customer:view')` 判断

---

## 第 4 章 功能说明

### 4.1 客户管理（CRM 核心）

#### 客户列表（List）
- 搜索：关键词（名称/编号）、客户分类、跟进程度、价值评估、客户行业、负责销售人
- 列表：列可定制（问题19），表头可拖动，CSV 导出
- 操作：查看/编辑/项目（跳到项目列表，按客户筛选）/删除
- 特殊：选多行 → 继承给他人（带原因）

#### 客户编辑/新建（Form）
- 字段：客户名称（必填）、拼音、编号、客户类型、客户分类、跟进程度、客户来源、客户区域（省/市/区级联）、客户行业、价值评估、信用等级、客户币种、到款限制%、客户地址、邮编、法人代表、注册资本、园区、联系人子表（+ 添加）、业务信息（简介/合作现状/合作前景/跟进策略）、财务信息（9 银行字段）、备注（+ 附件）、跟进子表
- 校验：名称/分类/跟进程度/行业/区域必填
- 保存：草稿 / 正式

#### 客户详情（Detail）
- 区块顺序（按 Form.vue 字段顺序）：
  1. **基本信息**（17 字段）
  2. **业务信息**（简介/合作现状/合作前景/跟进策略，单独行展示长文本）
  3. **财务信息**（9 银行字段）
  4. **备注 + 附件**（图片缩略图 + 文件下载，参考项目 Form.vue 附件设计）
  5. **联系人**（姓名/性别/部门/职务/手机/办公电话/传真/微信）
  6. **跟进记录**（只读，提示"如需修改请联系负责销售人"）
  7. **继承历史**（原负责人/接收人/继承时间/原因）

#### 客户导入（Import）
- Excel 解析，重复检查，批量创建

### 4.2 项目/商机管理

#### 项目列表
- 搜索：关键词（主题/编号）、客户、项目分类、项目阶段、负责销售人、发现日期范围
- **支持"按客户筛选"**（从客户列表的"项目"按钮跳转，query 传 `customerId`）
- 列表：列可定制、CSV 导出、PDF 预览
- 操作：查看（只读 Form）/ 编辑 / PDF / 删除

#### 项目编辑
- 字段：项目编号（自动生成）、客户（搜索选择）、项目主题（必填）、负责销售人（必填）、发现日期（必填）、项目分类、项目阶段、项目来源、项目状态、项目地区、币种、项目总额、优惠折扣、优惠后总额、预计费用、关联合同、项目商品信息（+ 添加商品）、项目概要、附件、跟进记录

### 4.3 报价管理
- 字段：报价编号（自动）、标题、日期、客户（搜索）、联系人、币种、关联项目编号、报价明细（产品名称/数量/单价/折扣/税率/金额）、报价说明
- PDF 预览

### 4.4 合同管理
- 字段：合同编号（自动）、合同标题、签约日期、客户、关联项目编号、币种、负责人、签约地点、品牌、开始日期、结束日期、交付方式、合同明细（+ 添加明细，含交付日期/方式/说明）、付款计划（+ 添加计划）、合同说明
- PDF 预览

### 4.5 工作日志

#### 日志列表（5 区块）
1. **工作日志筛选**（独立卡片）—— 关键词、人员、关联客户、关联项目、日期
2. **本周工作总结** —— 周范围/内容摘要/附件/操作
3. **工作日志列表查询** —— 列表（编号/类型/人员/日期/关联客户/项目/内容/耗时/操作）
4. **客户信息变更**（该时段内有更新的客户）
5. **项目信息变更**（该时段内有更新的项目）

#### 日志编辑
- 字段：日志编号（自动）、日期（必填）、人员（默认当前用户）、关联客户、关联项目、内容（必填）、耗时、附件

#### 周总结弹窗
- 周开始（周一）、总结内容（千字支持）、附件

### 4.6 库存管理
- 字段：商品名称（必填）、商品型号（必填）、厂家（必填）、日期、备注、附件
- Excel 导入/导出
- PDF 导出

### 4.7 采购管理
- 同库存（产品 + 厂家 + 备注 + 附件）

### 4.8 系统管理（5 页面 + 1 公司信息）

#### 用户管理
- 增删改查、分配角色、分配部门、启停用

#### 角色管理
- 增删改查、分配菜单、分配操作、设置 dataScope、自定义部门

#### 部门管理
- 增删改查、树形结构

#### 菜单管理
- 增删改查、目录/菜单/按钮 3 种类型

#### 操作权限
- 增删改查、按模块分组

#### 公司信息
- 编辑公司名称、简称、开户行、账号、电话、地址、税号、邮箱、官网、Logo（首页侧栏显示）

### 4.9 通用功能

#### 字段可定制（ConfigurableTable）
- **弹窗**"字段设置"：勾选列显示 + 拖动列顺序
- **每用户独立** localStorage 持久化（key=`tableConfig:{pageKey}:user:{userId}`）
- 7 个 List 都支持：客户/项目/报价/合同/工作日志/库存/采购

#### 表头拖动
- 直接在表头拖动改变列顺序
- 拖动后整体表格重挂载，el-table 内部 columnConfigs 重新注册

#### CSV 导出
- 每个 List 都有"导出全部"和"导出选中"
- 导出当前显示的列（按用户定制顺序）

#### 附件上传
- 单文件 ≤ 20MB
- 支持图片/常见文档
- 上传到 `backend/uploads/`，存到客户/项目/etc.的 `attachments` 字段（JSON）
- 详情页用 `<AttachmentList>` 只读展示

#### 跟进记录
- 客户/项目分别有跟进子表，跟进人/日期/内容

#### 继承
- 客户/项目都有继承功能（选人 + 原因）
- 继承历史在详情页显示

---

## 第 5 章 使用说明

### 5.1 登录

1. 打开 `http://127.0.0.1:8080/`
2. 输入用户名/密码：
   - `admin / 123456`（全部数据权限）
   - `sales01 / 123456`（仅本人数据）
3. 点"登录"

### 5.2 客户管理

#### 列表操作
1. 左侧菜单 → 销售管理 → 客户
2. 顶部搜索栏：选分类/行业/跟进程度等筛选
3. 点"查询"
4. 列表显示，点"列定制"勾选/拖动列
5. 点"导出"→导出全部/导出选中
6. 勾选多行 → 点"继承给他人"→选接收人 + 原因
7. 点"导入" → 选 Excel → 批量创建

#### 新建客户
1. 列表页点"新增客户"
2. 填必填项：客户名称、分类、跟进程度、行业、区域
3. 添加联系人（点"添加联系人"）
4. 添加跟进（点"添加跟进"）
5. 上传附件（备注下方的"上传附件"按钮）
6. 点"保存为草稿"或"确认"

#### 查看客户
1. 列表点"查看"
2. 详情页显示所有区块（基本信息/业务/财务/备注+附件/联系人/跟进/继承历史）
3. 点"返回"回到列表

#### 编辑客户
1. 列表点"编辑"（或详情页"编辑"）
2. 改字段，点保存

### 5.3 字段定制（通用）

1. 列表页点右上"字段设置"按钮
2. 弹窗里：勾选要显示的列、拖动列顺序
3. 点"保存"——你的配置就生效了
4. **每个用户独立**保存，不影响其他用户
5. 点"恢复默认"清空你的配置

### 5.4 表头拖动

1. 鼠标按住任意表头
2. 拖到新位置
3. 释放——th 和对应 td 一起按新顺序显示
4. 选择列、复选框、操作列锁死在两侧（不可拖动）

### 5.5 导出/导入

#### 导出 CSV
1. 列表点"导出"按钮
2. 选"导出全部"（当前页所有）或"导出选中"（勾选的行）
3. 下载 CSV（Excel 也能打开）

#### 导入 Excel
1. 列表点"导入"按钮
2. 选 .xlsx 文件（第一行是表头）
3. 系统解析、查重、批量创建
4. 显示成功/失败数

### 5.6 附件上传
1. 编辑页"备注"下方点"上传附件"
2. 选图片/文档（≤20MB）
3. 立即显示缩略图/文件图标
4. 鼠标点缩略图 → 大图预览；点文件图标 → 下载
5. 点"移除"删除单个附件
6. 提交编辑 → 附件存到数据库

### 5.7 项目/报价/合同/工作日志
- 操作流程类似客户管理
- 报价/合同有"PDF"按钮可预览 PDF

### 5.8 继承
1. 列表勾选要继承的客户/项目
2. 点"继承给他人"按钮
3. 选接收人 + 填原因
4. 确认 → 负责销售人换人，详情页"继承历史"会显示

### 5.9 系统管理
- 切换 admin 账号登录
- 左侧菜单 → 系统管理
- 用户/角色/部门/菜单/操作权限 增删改查
- 公司信息：编辑公司名/logo

---

## 第 6 章 移植到其他 Windows 10/11 电脑

### 6.1 环境准备

#### 必需软件
1. **Node.js** ≥ v20.x（推荐 v22 LTS）
   - 下载：https://nodejs.org/
   - 安装时勾选"Add to PATH"
2. **PostgreSQL** ≥ v14（推荐 v16）
   - 下载：https://www.postgresql.org/download/windows/
   - 记下 postgres 超级用户密码

#### 推荐软件
- **Git**（可选）：https://git-scm.com/
- **VSCode**（编辑器）：https://code.visualstudio.com/
- **DBeaver / pgAdmin**（PostgreSQL 图形客户端）：https://dbeaver.io/

### 6.2 代码部署

1. 把 `zhibang/` 整个目录**复制**到新电脑（保留 backend/、frontend/、配置文件、scripts/）
2. **不要**复制 `node_modules/`（重新安装）
3. **不要**复制 `dist/`（重新 build）
4. **不要**复制 `uploads/`（可选择性，复制可保留附件）

### 6.3 装依赖

```bat
cd D:\path\to\zhibang\backend
npm install

cd D:\path\to\zhibang\frontend
npm install
```

### 6.4 数据库初始化

1. 启动 PostgreSQL 服务
   ```bat
   D:\PostgreSQL\bin\pg_ctl.exe -D D:/PostgreSQL/data start
   ```
2. 创建 zhibang 库
   ```bat
   psql -U postgres -c "CREATE DATABASE zhibang;"
   ```
3. 跑 Prisma 迁移（自动建表）
   ```bat
   cd D:\path\to\zhibang\backend
   npx prisma db push
   ```
4. （可选）跑 seed 插入基础数据
   ```bat
   node seed-min.mjs
   ```

### 6.5 配环境变量

新建 `backend/.env`（参考示例）：

```env
# 数据库
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/zhibang

# JWT 密钥（生产用强随机字符串）
JWT_SECRET=replace-with-a-strong-random-secret-in-production

# 端口（可选，默认 3001）
PORT=3001

# 跨域（可选）
CORS_ORIGIN=http://localhost:8080
```

### 6.6 启动服务

**方式 1：一键脚本**（推荐）
```bat
cd D:\path\to\zhibang
start-zhibang.bat
```

**方式 2：分别启动**
```bat
:: 窗口 1：后端
cd D:\path\to\zhibang\backend
npm run start

:: 窗口 2：前端静态服务器
cd D:\path\to\zhibang
node serve-frontend.mjs
```

### 6.7 防火墙/端口

确保以下端口开放（或关闭 Windows 防火墙）：
- **3001**（后端 NestJS）
- **8080**（前端 serve-frontend + API 代理）
- **5432**（PostgreSQL，仅本机访问可不开）

如需远程访问：
- **公网映射**：用 frp / 内网穿透 / 路由器端口转发
- **Nginx 反向代理**（推荐）：80/443 反代 8080，前端 + /api 路径

### 6.8 访问

打开 `http://localhost:8080/`，登录 `admin / 123456` 验证。

### 6.9 常见问题

| 问题 | 解决 |
|---|---|
| 后端启动报 PG 连接错 | 检查 `.env` DATABASE_URL + PG 是否启动 |
| 前端 build 报"沙箱 safe-delete" | 这是沙箱限制，本机不会遇到 |
| 浏览器访问 8080 显示"白屏" | 后端没启动，看 D:/tmp/zhibang-backend.log |
| 中文附件名乱码 | 后端 `upload.controller.ts` 的 `decodeOriginalname` 已处理 |
| npm install 慢 | 配 `.npmrc` 用淘宝源（`registry=https://registry.npmmirror.com`） |

---

> **维护提示**：每次新增菜单/字段/功能/依赖，**对应章节**必须同步更新（见开头说明）。文件位置 `D:\github\xiangmutest\opencode\zhibang\ziliao\crm系统说明文件.md`。
