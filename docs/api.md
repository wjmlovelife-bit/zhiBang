# 智邦 CRM API 文档（人工补充部分）

> **主源**：NestJS Swagger 自动生成的 OpenAPI 规范 → `docs/api.swagger.json`（可用 `openapi-typescript` 生成前端 TS 类型）。
>
> **本文件**：Swagger 不覆盖的"使用约定"和"业务规范"。

## 目录

- [1. 认证（Authentication）](#1-认证)
- [2. 错误码规范](#2-错误码规范)
- [3. 分页规范](#3-分页规范)
- [4. 排序规范](#4-排序规范)
- [5. 数据范围（dataScope）](#5-数据范围)
- [6. 业务约定](#6-业务约定)
- [7. OpenAPI 导出](#7-openapi-导出)

---

## 1. 认证

### 1.1 登录

```
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "123456"
}
```

**响应 200**：
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "realName": "管理员",
    "role": "admin",
    "dataScope": 1,
    "deptId": 1
}
```

### 1.2 Token 使用

- **算法**：HS256
- **有效期**：`JWT_EXPIRES_IN`（默认 7 天，后端 `.env` 配置）
- **传输**：HTTP Header `Authorization: Bearer <token>`
- **刷新**：当前无 refresh 机制；过期后前端跳登录页重新登录（保留 redirect 参数）

### 1.3 Token 校验失败

| 错误 | HTTP | 现象 |
|---|---|---|
| Token 缺失 | 401 | 后端 `[JwtAuthGuard] Unauthorized` |
| Token 过期 | 401 | 同上 |
| Token 签名错 | 401 | 同上 |
| 用户被禁用 `enabled=false` | 403 | `[RolesGuard] forbidden resource` |

前端处理见 `frontend/src/api/request.ts`：自动 `router.push({path:'/login', query:{redirect: currentPath}})`，登录成功后回跳。

### 1.4 Profile 查询

```
GET /api/auth/profile
Authorization: Bearer <token>
```

返回 `user` 对象（同登录响应中的 `user`），用于前端恢复登录态。

---

## 2. 错误码规范

后端使用 NestJS 内置 `HttpException` + 全局 `LoggingExceptionFilter`，统一返回：

```json
{
  "statusCode": 400,
  "message": "参数错误：xxx",
  "error": "Bad Request"
}
```

| HTTP | 含义 | 常见触发 | 前端处理 |
|---|---|---|---|
| 400 | 参数校验失败 | DTO 字段缺失 / 类型错 / 长度超限 | 显示 `message` 提示用户 |
| 401 | 未登录或 Token 失效 | Token 缺失/过期/签名错 | 自动跳登录 |
| 403 | 权限不足 | `RolesGuard` 拒绝 / dataScope 过滤后无权访问 | 显示"无权限" |
| 404 | 资源不存在 | `findUnique` 返回 null | 显示"记录不存在" |
| 409 | 资源冲突 | 唯一约束冲突（已用 SEQUENCE 防 nextCode TOCTOU） | 提示用户重试 |
| 422 | 业务校验失败 | 自定义业务规则（如删除有引用的记录） | 显示 `message` |
| 500 | 内部错误 | 异常未捕获 | 提示"系统异常"+ 日志上报 |

**全局异常过滤器**：`backend/src/common/filters/logging-exception.filter.ts` — 输出 `[REQ]` `[RES]` + 5xx 完整堆栈，便于定位。

---

## 3. 分页规范

**统一格式**（适用于所有 `GET /api/{resource}?page=1` 类列表接口）：

**Query 参数：**
| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `page` | int | 1 | 页码（从 1 开始） |
| `pageSize` | int | 20 | 每页条数（最大 100） |
| `keyword` | string | — | 模糊关键字（多数模块支持） |
| `sortField` | string | `createdAt` | 排序字段 |
| `orderBy` | enum | `desc` | `asc` 或 `desc` |
| ...其他过滤字段 | — | — | 按各模块 |

**响应结构：**
```json
{
  "items": [ ... ],
  "total": 123,
  "page": 1,
  "pageSize": 20
}
```

> 部分老接口可能仅返回 `{ items, total }`（无 page/pageSize）；前端兜底用 `items.length` + `total`。

**实现位置：** `backend/src/common/utils/payload.ts` + 各 service.findAll()。

---

## 4. 排序规范

**默认排序**：`createdAt DESC`（最新在前）

**可排序字段**：每个模块的 service.allowSortFields 白名单控制（防 SQL 注入 / 字段泄露）。

**示例：**
```
GET /api/customer?sortField=name&orderBy=asc
GET /api/worklog?sortField=workDate&orderBy=desc
```

**不传排序字段** → 走模块默认（如 `CrmWorkLog` 按 `workDate desc`）。

---

## 5. 数据范围（dataScope）

所有"列表查询"接口都会经过 `applyDataScope()` 自动加 `WHERE` 条件。

### 5.1 取值含义

| 值 | 含义 | 实际 SQL 行为 |
|---|---|---|
| 1 | 全部 | 不加任何 deptId 过滤 |
| 2 | 本部门及下级 | `deptId IN (当前部门 + 所有子部门)` |
| 3 | 本部门 | `deptId = 当前部门` |
| 4 | 本人 | `(ownerId = 当前用户 OR createdById = 当前用户)` |
| 5 | 自定义部门 | `deptId IN (customDeptIds)` |

### 5.2 角色级 vs 用户级

- **角色级 dataScope**（SysRole.dataScope）：通过角色授权时的数据范围。
- **用户级 dataScope**（SysUser.dataScope）：实际生效值（登录后注入 token）。
- 用户登录时取 `role.dataScope ?? user.dataScope ?? 1`，见 `backend/src/modules/auth/auth.service.ts`。

### 5.3 自定义部门

仅当 `dataScope = 5` 时使用 `SysUser.customDeptIds`（JSON 数组）。

```json
{ "customDeptIds": [1, 3, 5] }  // 仅看 1/3/5 部门
```

### 5.4 实现位置

`backend/src/common/scope.ts` 的 `applyDataScope(prisma, user, baseWhere, { ownerFields })`。

**典型调用：**
```typescript
const where = await applyDataScope(this.prisma, user, { keyword: { contains: kw } });
const rows = await this.prisma.crmCustomer.findMany({ where, ... });
```

---

## 6. 业务约定

### 6.1 nextCode（业务编号自动生成）

| 模块 | 前缀 | SEQUENCE | 示例 |
|---|---|---|---|
| 客户 | KH | `customer_code_seq` | `KH202608270002` |
| 项目/商机 | XM | `project_code_seq` | `XM202609210001` |
| 销售合同 | HT | `contract_code_seq` | `HT202609020001` |
| 报价 | QJ | `quotation_code_seq` | `QJ202609010001` |
| 工作日志 | RJ | `worklog_code_seq` | `RJ202609230003` |

**格式：** `{前缀}{YYYYMMDD}{4位序号}`，由 PG SEQUENCE 保证全局唯一 + 并发安全（TOCTOU 修复见 Round 3）。

**fallback：** 若 SEQUENCE 不可用（如 PG 初始化失败），自动回退到原 `findFirst + parseInt + create` 三步实现。

### 6.2 客户转移继承（CrmCustomerInherit）

- **追加历史而非覆盖**：每次客户换 owner 都新增一条 `CrmCustomerInherit` 记录。
- 字段：`fromOwnerId` / `toOwnerId` / `inheritAt` / `reason`
- 前端列表显示"转移链"。

### 6.3 项目转移继承（CrmProjectInherit）

- 同 6.1.2，作用于商机/项目。
- 与客户转移是**独立两条流**：换项目 owner 不自动换客户 owner。

### 6.4 跟进关联（CrmCustomerFollow / CrmProjectFollow）

- **客户跟进**强绑定客户：`customerId` 必填，与 `CrmCustomer` 一对多。
- **项目跟进**强绑定项目：`projectId` 必填，与 `CrmOpportunity` 一对多。
- **工作日志**(`CrmWorkLog`) 的 `customerId` / `projectId` 都可以为空——独立的"日报"也可以不存在客户。

### 6.5 商机 customerCode ↔ customerId 同步（防孤儿数据）

PG 层有 trigger 自动同步：

```sql
CREATE TRIGGER trg_sync_opportunity_customer
BEFORE INSERT OR UPDATE OF "customerCode", "customerId"
ON "CrmOpportunity"
FOR EACH ROW
EXECUTE FUNCTION sync_opportunity_customer();
```

应用层只填 `customerCode`，trigger 自动反查 `customerId`（新建时）；更新时也同步。详见 `backend/prisma/fix-orphan-projects.sql`。

### 6.6 共享权限（CrmOpportunityShare）

- 单个商机可共享给多个同事，权限分两级：`VIEW`（看）/ `EDIT`（改）。
- `permission` 字段为枚举。
- 与 `SysRole` 权限独立——基于业务对象而非角色。

### 6.7 文件上传（SysAttach）

- 上传目录：`backend/uploads/`
- 文件名格式：`{epochMillis}-{random}.{ext}`
- 数据库存元数据（`SysAttach` 表），文件实际存 uploads/ 目录。
- 访问通过 `/api/upload/{filename}` 走 controller，不用 NestJS 静态中间件（避免 Content-Disposition 被覆盖）。

### 6.8 软删除策略

**当前：物理删除。** 没有 `isDeleted` 字段。
- 删除客户/项目等会被检查外键引用，有引用则拒绝（409）。
- 如需"软删除"，需加字段（参见 `20260828改进点.md` 待办）。

### 6.9 操作日志

`SysOperLog` / `SysLoginLog` 表已建，**中间件未启用**（目前为空表）。
- 临时方案：操作追溯靠 PG dump + 手写日志。
- 后续 TODO：加全局 interceptor 写日志。

### 6.10 时区

- 数据库存 `timestamp without time zone`，**所有时间按本地时区（GMT+8）写入**。
- 前端 `dayjs` 默认按本地时区展示。
- 如需 UTC 化，需全栈改造（参见 `20260828改进点.md`）。

---

## 7. OpenAPI 导出

### 7.1 导出 Swagger JSON

```bash
# 1. 启动后端（保持运行）
cd backend && npm run start

# 2. 另一个 cmd 跑导出脚本
node scripts/export-swagger.mjs

# 输出：docs/api.swagger.json
```

### 7.2 前端 TypeScript 类型生成

```bash
# 安装工具（项目级）
cd frontend && npm install -D openapi-typescript

# 生成
npx openapi-typescript ../docs/api.swagger.json --output src/types/api.d.ts
```

### 7.3 Swagger UI 在线浏览

启动后端后访问：http://localhost:3001/api/docs

UI 提供：
- 所有接口列表（按 tag 分组）
- 每个接口的请求/响应 schema
- Bearer Auth 测试（在 UI 右上角"Authorize"输入 token）

### 7.4 版本控制建议

- `docs/api.swagger.json` 每次有 API 变更时**重新生成并提交**。
- 大文件：可加 `.gitattributes` 用 `linguist-generated=true` 标记为自动生成。
- CI 可加 Swagger Diff 检查 PR 是否带来非预期变更。

---

## 8. 相关文档

- `docs/architecture.md` — 系统架构（C4 L1/L2/L3 + 数据流）
- `docs/database-er.md` — 数据库 ER 图
- `docs/api.swagger.json` — OpenAPI 规范（自动生成）
- `backend/src/common/scope.ts` — dataScope 实现
- `backend/src/main.ts` — SwaggerModule 集成
- `backend/prisma/migrations/` — 数据库迁移 SQL