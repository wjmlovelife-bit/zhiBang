# frontend tests

> 配套设计与抗菜单 / 权限变更策略见 [test/ARCHITECTURE.md](../../backend/test/ARCHITECTURE.md)（虽在后端目录，但策略适用于全栈）。

## 当前阶段

- ✅ **单元测试**：vitest + happy-dom，覆盖 pinia store、工具函数、权限指令
- ⏳ **E2E（浏览器）测试**：未实施；下阶段引入 Playwright（跑真浏览器，跨页面流程）

## 准备（一次性）

```bash
cd frontend
npm install -D vitest happy-dom @vitest/coverage-v8
```

> 注意：放进 `devDependencies`，**不影响生产构建**。本仓库本身**未自动安装**，需要按上面命令手动加（避免污染现有 lockfile）。

## 运行

```bash
# 跑全部
npm run test:unit

# 监听模式（开发时反复改）
npx vitest

# 跑单个文件
npx vitest tests/unit/tree.spec.ts

# 覆盖率
npm run test:unit -- --coverage
```

## 目录约定

```
frontend/
├── tests/
│   └── unit/                          # 单元测试
│       ├── setup.ts                   # vitest 全局 setup
│       ├── tree.spec.ts               # utils/tree.ts
│       ├── user-store.spec.ts         # pinia store/user
│       └── perm.spec.ts               # v-perm 权限指令（行为级）
├── vitest.config.ts                   # vitest 配置（含 @ 别名）
└── package.json                       # 加 scripts.test:unit
```

## 抗菜单 / 权限变更

- **不要在 spec 中硬编码** `customer:view` 这类权限码字符串 —— 改权限码后 spec 失败是因为业务改了，不是测试错。
- 提供 `tests/unit/fixtures/permissions.ts`：集中定义本测试用的权限码常量 + 角色 → 权限码映射。

## E2E（下一步计划）

引入 `playwright` 后会增加：

```
tests/e2e/
├── fixtures/                          # 登录态、菜单数据
├── pages/                             # 页面对象（PO）
│   ├── login.page.ts
│   ├── worklog-list.page.ts
│   └── ...
├── scenarios/
│   ├── login.spec.ts                  # 登录 → 跳转 → 菜单可见性
│   ├── worklog.spec.ts                # 新建周报 → 编辑 → 删除
│   └── ...
└── playwright.config.ts
```
