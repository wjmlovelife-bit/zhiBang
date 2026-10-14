# 智邦管理系统 — 端到端测试

> 进阶架构与设计原则见 [ARCHITECTURE.md](./ARCHITECTURE.md)。本文档只讲"怎么跑"。

纯 Node（内置 `fetch` + `FormData`，无需安装任何依赖）的 API 端到端测试，覆盖后端启动、登录鉴权、菜单、区域数据，以及全部 8 个业务模块（**客户 / 项目 / 合同 / 商机 / 报价 / 工作日志 / 系统管理 / 附件**）+ 跨模块回归用例。

## 前置条件

1. 后端已启动并监听 `3001`：
   ```bash
   cd backend
   npm run start:dev      # 或 nest start
   ```
2. 数据库已就绪（PostgreSQL，库名 `zhibang`），区域数据已 seed（3806 行）。
3. 存在账号 `admin/123456` 与 `sales01/123456`。

## 运行方式

```bash
# 进入测试目录
cd backend/test

# 运行全部用例（默认 http://localhost:3001/api）
node run-all.mjs

# 自定义后端地址
API_BASE=http://192.168.1.10:3001/api node run-all.mjs

# 仅运行单个用例（例如只看项目模块）
node cases/project.mjs
node cases/worklog.mjs
```

退出码：`0` = 全部通过；`1` = 存在失败项。可直接接入 CI。

## 用例清单（11 个，按执行顺序）

| # | 文件 | 覆盖点 |
|---|---|---|
| 1 | `cases/startup.mjs` | 后端存活、JWT 鉴权中间件（未授权返回 401）|
| 2 | `cases/auth.mjs` | admin / sales01 基础登录、错误凭据被拒 |
| 3 | `cases/auth-coverage.mjs` | 登录场景细化：空 body / SQL 注入字符 / 长字段 / 并发 5 session |
| 4 | `cases/menu.mjs` | 菜单含客户/项目/合同 等核心模块 |
| 5 | `cases/regions.mjs` | 省/市/区三级树（34 省），解析北京 id 供其它用例复用 |
| 6 | `cases/customer.mjs` | 编号生成、创建、详情、跟进、继承、列表过滤、搜索、附件上传 |
| 7 | `cases/project.mjs` | 编号生成、客户关联、商品子表、跟进、地区 id、继承、CSV 导出、PDF、导入 |
| 8 | `cases/contract.mjs` | 编号生成、创建（明细子表+付款计划）、详情、更新、删除 |
| 9 | `cases/opportunity.mjs` | 编号、详情、新建/更新/删除、跟进、继承、导出、PDF（warn）、导入预览 |
| 10 | `cases/quotation.mjs` | 编号、明细子表、详情、更新、PDF 预览/下载（warn）、删除 |
| 11 | `cases/worklog.mjs` | 列表/新建/详情/更新/删除 + 周报 CRUD + 日报 CRUD + 数据范围（admin vs sales）|
| 12 | `cases/sys.mjs` | 用户/角色/菜单/部门/区域/字典/操作码池 + 公司（@Public 读 + 鉴权写） |
| 13 | `cases/upload.mjs` | 上传 PNG / 下载 / 隔离 / 权限 |
| 14 | `cases/permission.mjs` | 权限码驱动的越权/有权限断言 |
| 15 | `cases/regression.mjs` | 历史 bug 防回归（继承姓名、日志时间聚合等）|

## 断言约定

- `ok(条件, 文案)`：失败计入 ❌，会导致退出码为 1。
- `warn(条件, 文案)`：仅用于环境依赖型功能（如 PDF 生成依赖 Chromium/puppeteer、PNG 上传依赖二进制安装）；失败时计为 ⚠️ 提示，**不计入失败**。

## 抗菜单 / 权限码变更

`lib/fixtures.mjs` 维护 `SCENARIOS`（账号）与 `NEED`（业务动作 → 权限码）的映射。改了菜单、改了权限码，**只动这一份文件**。

新建模块用例：复制 `cases/<mod>.mjs` 模板到 `cases/<新模块>.mjs` 并 export `name` + `run(ctx)`，然后在 `run-all.mjs` 加一行 import + 注册即可。后续会演化为**自动发现 `_*.mjs` 之外的 case 文件**（见 ARCHITECTURE.md）。

## 目录结构

```
backend/test/
├── lib/
│   ├── http.mjs        # 共享 fetch 封装 + login()
│   ├── runner.mjs      # Case 框架 + 单文件独立运行引导
│   └── fixtures.mjs    # ★ 权限码驱动 + SCENARIOS + NEED（抗菜单变更）
├── cases/              # 各模块用例
│   ├── startup.mjs
│   ├── auth.mjs
│   ├── auth-coverage.mjs
│   ├── menu.mjs
│   ├── regions.mjs
│   ├── customer.mjs
│   ├── project.mjs
│   ├── contract.mjs
│   ├── opportunity.mjs
│   ├── quotation.mjs
│   ├── worklog.mjs
│   ├── sys.mjs
│   ├── upload.mjs
│   ├── permission.mjs
│   └── regression.mjs
├── ARCHITECTURE.md     # ★ 架构方案（分层 / 抗变更 / 数据隔离 / CI）
├── run-all.mjs         # 聚合入口（注册 15 个 case）
└── README.md           # 本文档
```
