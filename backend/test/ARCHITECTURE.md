# zhibang 测试架构方案

> 适用：`backend/`（NestJS+Prisma）和 `frontend/`（Vue3+ElementPlus）双仓库；当前在端到端（E2E）层最成熟，单元测试与浏览器测试为补充层。

---

## 1. 设计目标与原则

| 目标 | 落地原则 |
|---|---|
| **覆盖登录 / 权限 / 所有功能** | 每个模块独立 case + 跨模块流程 case |
| **抗菜单 / 角色 / 权限码变更** | 不硬编码 menuId / roleId，全部走**权限码驱动**（`xxx:view/update/delete/...`） |
| **抗新增 / 删除模块 / 页面** | 自动发现 `cases/*.mjs`，新建文件即被纳入，无需改 `run-all.mjs` |
| **沙箱 + 本地都能跑** | 纯 Node（内置 fetch + FormData），无额外依赖 |
| **结果可读、可入 CI** | PASS/FAIL/WARN 三态汇总，退出码与 CI 联动 |

---

## 2. 测试金字塔（3 层）

```
        ▲ 浏览器端到端（最少量、最高价值）
        │  - 前端 tests/e2e/ ：登录 → 看 → 编辑 → 提交，跨页跳转
        │
       ┌┴┐
      ●●●
     ●●●●●  API 端到端（主力）
     ●●●●●  backend/test/cases/*.mjs ：登录、权限、CRUD、流程
      ●●●
       └┘
        │  单元测试
        │  - 后端：src/**/__tests__/*.spec.ts（接近业务关键 util / 自写 validator）
        │  - 前端：src/**/__tests__/*.spec.ts（permission 指令、formatter、pinia store）
        ▼
```

E2E 占主力 —— 沙箱内只能跑 e2e（连真实 3001）；单元测试为辅。

---

## 3. 目录约定

```
backend/
├── src/                            # 业务代码
│   └── modules/<m>/__tests__/      # 单元测试（可选，最近一个）
└── test/                           # ★ E2E 测试（绝对主体）
    ├── lib/
    │   ├── http.mjs                # fetch 封装 + login/request helper
    │   ├── runner.mjs              # Case 基类、断言、计时
    │   ├── fixtures.mjs            # 权限码驱动 + 数据 fixture
    │   └── report.mjs              # 结果输出（控制台 + Markdown / JSON 报告）
    ├── cases/
    │   ├── _smoke.mjs              # 启动 / 进程 / 数据库 / 上传目录
    │   ├── _auth.mjs               # 登录全部场景
    │   ├── _menu.mjs               # 菜单树 / 权限码
    │   ├── customer.mjs            # 业务模块，与 modules 1:1
    │   ├── project.mjs
    │   ├── contract.mjs
    │   ├── opportunity.mjs
    │   ├── quotation.mjs
    │   ├── worklog.mjs
    │   ├── sys.mjs                 # 用户/角色/菜单/字典/公司
    │   ├── upload.mjs              # 上传/下载/权限
    │   ├── regression.mjs          # 历史上踩过的 bug
    │   └── _scenarios/             # 跨模块流程（继承、领用、释放等）
    ├── ARCHITECTURE.md             # 本文档
    ├── README.md                   # 入门 + 运行说明
    └── run-all.mjs                 # 自动发现 + 跑全套

frontend/
└── tests/
    ├── unit/                       # vitest 单测
    ├── e2e/                        # playwright 浏览器测试（当前未实施）
    └── README.md
```

### 自动发现规则（抗菜单变更的关键）

`run-all.mjs` 不再手工 list 哪个 case：

1. 跑 `cases/_*.mjs`（下划线开头）的"基础设施 case"先跑
2. 再跑剩下 `cases/*.mjs`
3. 跑 `cases/_scenarios/*.mjs` 做跨模块流程
4. 任何新建 `cases/<name>.mjs` **自动被收**，无需注册

> 改名 / 删 menuId / 加模块 → **零改动**测试架构。

---

## 4. 抗菜单 / 权限变更的核心机制

**问题：** 后端权限码绑在 `@Permissions('menu:view')` 上；如果改菜单 / 改权限码 / 加新菜单，原有测试可能因为"权限码变了"而失效。

**对策：** `lib/fixtures.mjs` 集中维护一份"业务场景 → 所需权限码"映射，**测试只引用场景名不引用权限码**。

```js
// fixtures.mjs (示意)
export const SCENARIOS = {
  admin: { login: ['admin', '123456'], expect: { menus: 'all' } },
  sales:  { login: ['sales01', '123456'], expect: { menus: 'all' } },
  readOnly: { synthetic: 'userA', grant: ['customer:view'], expect: { canCreate: false } },
};
export const NEEDED = {
  'opportunity:create': 'opportunity:create',
  'worklog:weekSave':   'worklog:update',
  'company:edit':       'company:update',
};
```

任何 case 只写 `await ctx.as('admin').req('POST', '/opportunity', ...)`；权限码改动只动 `fixtures.mjs`。

---

## 5. 用例分层

| 层 | 文件前缀 | 作用 |
|---|---|---|
| **infra** | `_smoke.mjs` | 启动 / 健康检查 / DB / uploads 目录 |
| **auth** | `_auth.mjs` | 登录全部场景（正确密码 / 错密码 / 锁 / 过期 / 并发 / 异常字符） |
| **menu** | `_menu.mjs` | 菜单树 / 权限码完整性 / 加菜单自动列出 |
| **module** | `<mod>.mjs` | 1:1 对应 `modules/<mod>` 的 CRUD + 业务 |
| **upload** | `upload.mjs` | 上传 / 下载 / 隔离 / 权限 |
| **cross** | `_scenarios/*.mjs` | 多模块联合（领用-继承、合同-报价-回款） |
| **regression** | `regression.mjs` | 历史 bug 防回归 |

每个 case 在各自文件内 export `name`、`run(ctx)`、`tags`；跑完报告汇总：

```
=== SUMMARY ===
  PASS: 124
  FAIL: 0
  WARN: 3
Cases: 18  Modules covered: 9/9  Permissions covered: 47/52
```

---

## 6. 数据隔离 & 可重复执行

| 风险 | 对策 |
|---|---|
| 用例会删改真实数据 | 用 `__test_` 前缀的测试账号 + 测试客户/项目（每次 run 用时间戳后缀 ID） |
| 并发用 sales01 同时跑 | 每个 case 默认串行；只有加 `tags:['concurrency']` 才并发 |
| DB 漂移 | 用 `prisma migrate deploy` 后跑测试；测试运行前自动 reset test fixtures（不是全库） |

---

## 7. 报告输出（可入 CI）

- **stdout**：`PASS / FAIL / WARN` 行 + 错误 stack 简版
- **退出码**：`0` 全过 / `1` 有失败
- **可选**（`REPORT=md` 时）：`backend/test/reports/<ts>.md` 报告
- **GitLab CI** 接入：`<pipeline>.gitlab-ci.yml` + `node test/run-all.mjs`，退出码即结果

---

## 8. 待补（下一阶段）

| 优先级 | 内容 |
|---|---|
| P0 | `worklog.mjs`（之前只口述"后续可补"）|
| P0 | `opportunity.mjs`（商机）|
| P0 | `quotation.mjs`（报价单）|
| P0 | `sys.mjs`（用户/角色/菜单/公司）|
| P0 | `upload.mjs` |
| P1 | `_auth.mjs`：错密码、空 body、并发、过期 |
| P1 | `fixtures.mjs`：权限码驱动 |
| P1 | `_smoke.mjs`：拆分 startup + 启动后状态 |
| P2 | `frontend/tests/unit/` + vitest（含 perm 指令、formatter 测试）|
| P3 | `frontend/tests/e2e/` + Playwright（登录 → 改 → 看）|

---

## 9. 跑测试的标准姿势

```bash
cd backend/test

# 全量
node run-all.mjs

# 指定后端地址
API_BASE=http://192.168.1.10:3001/api node run-all.mjs

# 只跑某文件（业务模块）
node cases/worklog.mjs

# 单 tag 过滤（用 quick）
TAG=quick node run-all.mjs

# CI 模式（更快报告）
REPORT=md node run-all.mjs    # 写 reports/<ts>.md
```
