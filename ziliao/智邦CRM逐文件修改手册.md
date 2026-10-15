# 智邦 CRM 逐文件修改手册

> 仓库：https://github.com/wjmlovelife-bit/zhiBang  
> 对照版本：e898e1c7d1332b46226744b7c42a9640c2cb03c2  
> 编写日期：2026-10-14  
> 本文只给修改说明和代码，没有修改仓库。

## 0. 阅读与执行规则

本文按现有代码给出一套确定的第一阶段修改，不把互相排斥的方案混在一起。先完成第一阶段，再考虑附录的数据模型扩展。

**全文路径相对于仓库根目录。** “新增文件”表示写入代码块全部内容；“替换方法”表示替换从方法声明到对应结束大括号的整个方法；“替换片段”用原代码作为搜索锚点。不要只按旧行号操作。

本文不包含安全、明文密码、Docker、CI、部署、日志、测试、公网、CDN、UI 审计、限流和 Redis 改造。表单修改仅为配合数据读写和业务动作。

### 0.1 本版选择的业务规则

| 事项 | 本文采用的规则 |
| --- | --- |
| 联系人 | 保留 ID；被项目引用的联系人不能直接删除；第一阶段保留现有 contactIds 数组 |
| 报价明细 | 第一阶段保留整单替换，但事务必须原子完成 |
| 项目金额 | discountPct 是“折数”，10=原价、8=八折 |
| 报价/合同折扣 | discount 是“减免百分比”，10=减免 10% |
| 单价 | 报价/合同 unitPrice 按现有前端公式视为不含税单价 |
| 金额舍入 | 每行含税金额四舍五入到两位；主表为已舍入行金额之和 |
| 可空字段 | 未传不修改；null/兼容空字符串表示清空 |
| 业务日期 | 第一阶段继续用 UTC 零点编码纯日期，不直接改变现有日期列类型 |
| 创建时间统计 | 按 Asia/Shanghai 的业务日边界统计真实时间戳 |
| 导入 | 整批事务；一个批次确认成功后重复确认返回原结果 |
| 日程 | 草稿实时聚合；显式提交冻结；重新打开草稿保留旧快照，直到再次提交 |
| 销售统计 | 新增按创建人；持有量按当前负责人；总计与人员明细同口径 |
| 编号 | 使用现有全局序列；日期为上海业务日期；允许空号，不做每日序号重置 |

上述金额规则来自目前表单公式，但 pricejy 等旧字段没有足够业务定义。本文不会凭字段名发明公式：保留旧字段值，新的零值仍仅作为兼容必填列的默认值；不将它们当作统计依据。

**不要对已确认历史合同直接批量重算金额。** 本文代码对新建和后续编辑采用统一公式；历史差异应先列出再由业务人员决定。

### 0.2 第一阶段执行顺序

1. 第 1 节：新增公共值解析与金额工具。
2. 第 2 节：修复客户创建人和联系人更新。
3. 第 3 节：修复项目金额、客户关联、跟进日期。
4. 第 4 节：报价与合同事务及金额。
5. 第 5 节：Excel 导出。
6. 第 6 节：销售统计。
7. 第 7 节：导入批次。
8. 第 8 节：日程草稿与提交。
9. 第 9 节：分页、编号和接口类型。
10. 第 10 节：前端配套映射、日期及联动。
11. 附录：后续关系表和业务模型扩展，不与第一阶段代码混贴。

后文依赖前文新增的方法。不要跳过公共工具后直接粘贴 Service 方法。

### 0.3 修改范围清单

新增文件：

- backend/src/common/utils/business-values.ts
- backend/src/common/utils/money.ts
- backend/src/common/utils/number-code.ts
- backend/src/common/dto/pagination-query.dto.ts
- backend/src/modules/project/dto/project-import.dto.ts
- backend/prisma/migrations/202610140001_business_consistency/migration.sql
- frontend/src/utils/business-date.ts
- frontend/src/utils/form-payload.ts

修改文件：

- backend/src/common/utils/payload.ts
- backend/src/modules/customer/customer.service.ts
- backend/src/modules/customer/customer.controller.ts
- backend/src/modules/project/project.service.ts
- backend/src/modules/project/project.controller.ts
- backend/src/modules/quotation/quotation.service.ts
- backend/src/modules/quotation/quotation.controller.ts
- backend/src/modules/contract/contract.service.ts
- backend/src/modules/contract/contract.controller.ts
- backend/src/modules/stats/stats.service.ts
- backend/src/modules/stats/stats.controller.ts
- backend/src/modules/weekly-schedule/weekly-schedule.service.ts
- backend/src/modules/weekly-schedule/weekly-schedule.controller.ts
- backend/src/modules/sales-schedule/sales-schedule.service.ts
- backend/src/modules/sales-schedule/sales-schedule.controller.ts
- backend/prisma/schema.prisma
- frontend/src/api/index.ts
- frontend/src/views/sales/customer/Form.vue
- frontend/src/views/sales/project/Form.vue
- frontend/src/views/sales/project/Import.vue
- frontend/src/views/sales/quotation/Form.vue
- frontend/src/views/sales/contract/Form.vue
- frontend/src/views/sales/sales-schedule/Index.vue
- frontend/src/views/stats/sales/Index.vue

## 1. 公共工具：明确空值、日期和金额规则

### 1.1 新增 backend/src/common/utils/business-values.ts

**为什么：** 当前每个模块各自清理空值，且递归日期转换可能改写普通文本。集中实现格式转换，再按模型的具体字段调用。

~~~ts
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function isBlank(value: unknown): boolean {
  return value === null ||
    (typeof value === 'string' && value.trim() === '');
}

export function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException(field + '不能为空');
  }
  return value.trim();
}

export function nullableInt(
  value: unknown,
  field: string,
): number | null | undefined {
  if (value === undefined) return undefined;
  if (isBlank(value)) return null;
  if (typeof value !== 'number' && typeof value !== 'string') {
    throw new BadRequestException(field + '必须是整数');
  }
  if (typeof value === 'string' && !/^-?\d+$/.test(value.trim())) {
    throw new BadRequestException(field + '必须是整数');
  }
  const number = Number(value);
  if (!Number.isSafeInteger(number)) {
    throw new BadRequestException(field + '必须是整数');
  }
  return number;
}

export function positiveInt(value: unknown, field: string): number {
  const number = nullableInt(value, field);
  if (number == null || number <= 0) {
    throw new BadRequestException(field + '必须是正整数');
  }
  return number;
}

export function nullableDecimal(
  value: unknown,
  field: string,
): Prisma.Decimal | null | undefined {
  if (value === undefined) return undefined;
  if (isBlank(value)) return null;

  const text = Prisma.Decimal.isDecimal(value)
    ? (value as Prisma.Decimal).toString()
    : typeof value === 'string'
      ? value.trim()
      : typeof value === 'number' && Number.isFinite(value)
        ? String(value)
        : '';

  if (!/^-?\d+(\.\d+)?$/.test(text)) {
    throw new BadRequestException(field + '必须是合法金额或数量');
  }
  return new Prisma.Decimal(text);
}

export function decimalOr(
  value: unknown,
  fallback: string,
  field: string,
): Prisma.Decimal {
  return nullableDecimal(value, field) ?? new Prisma.Decimal(fallback);
}

export function dateOnly(value: unknown, field: string): Date {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new BadRequestException(field + '必须采用 YYYY-MM-DD 格式');
  }
  const date = new Date(text + 'T00:00:00.000Z');
  if (Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== text) {
    throw new BadRequestException(field + '不是有效日期');
  }
  return date;
}

export function nullableDate(
  value: unknown,
  field: string,
): Date | null | undefined {
  if (value === undefined) return undefined;
  if (isBlank(value)) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new BadRequestException(field + '不是有效日期');
    }
    return value;
  }
  if (typeof value === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return dateOnly(value, field);
  }
  if (typeof value !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    throw new BadRequestException(field + '不是有效日期');
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(field + '不是有效日期');
  }
  // 对带时间的旧值至少验证日期部分不是无效日历日期。
  dateOnly(value.slice(0, 10), field);
  return date;
}

export function normalizeWeekStart(value: unknown): Date {
  let date: Date;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new BadRequestException('weekStart 不是有效日期');
    }
    date = dateOnly(value.toISOString().slice(0, 10), 'weekStart');
  } else {
    const text = typeof value === 'string' ? value : '';
    date = dateOnly(text.slice(0, 10), 'weekStart');
  }
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return date;
}

export function businessToday(now = new Date()): string {
  const shifted = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

export function businessDateRange(
  from?: string,
  to?: string,
): { gte?: Date; lt?: Date } | undefined {
  if (!from && !to) return undefined;
  const range: { gte?: Date; lt?: Date } = {};
  if (from) {
    const date = dateOnly(from, '开始日期');
    range.gte = new Date(date.getTime() - 8 * 60 * 60 * 1000);
  }
  if (to) {
    const date = dateOnly(to, '结束日期');
    range.lt = new Date(
      date.getTime() + 24 * 60 * 60 * 1000 - 8 * 60 * 60 * 1000,
    );
  }
  if (from && to && from > to) {
    throw new BadRequestException('开始日期不能晚于结束日期');
  }
  return range;
}

export function intArray(
  value: unknown,
  field: string,
): number[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new BadRequestException(field + '必须是数组；清空请传 []');
  }
  const numbers = value.map((item) => positiveInt(item, field));
  if (new Set(numbers).size !== numbers.length) {
    throw new BadRequestException(field + '不能包含重复值');
  }
  return numbers;
}

export function optionalArray(
  value: unknown,
  field: string,
): any[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new BadRequestException(field + '必须是数组');
  }
  if (value.some((item) =>
    !item || typeof item !== 'object' || Array.isArray(item))) {
    throw new BadRequestException(field + '每项必须是对象');
  }
  return value;
}

export function stripSystemFields(data: Record<string, any>): void {
  for (const field of [
    'id', 'createdAt', 'updatedAt', 'createdById', 'updatedById',
  ]) {
    delete data[field];
  }
}

export function normalizeNullableFields(
  data: Record<string, any>,
  fields: {
    ints?: string[];
    decimals?: string[];
    dates?: string[];
  },
): void {
  for (const field of fields.ints ?? []) {
    if (data[field] !== undefined) {
      data[field] = nullableInt(data[field], field);
    }
  }
  for (const field of fields.decimals ?? []) {
    if (data[field] !== undefined) {
      data[field] = nullableDecimal(data[field], field);
    }
  }
  for (const field of fields.dates ?? []) {
    if (data[field] !== undefined) {
      data[field] = nullableDate(data[field], field);
    }
  }
}
~~~

说明：

- 第一阶段支持 Date 和完整 ISO 字符串，兼容现有详情回填。
- 上海业务日只用于创建时间统计、今天和编号；旧的纯日期 UTC 零点编码继续保留。
- nullableDate 不负责将一个真实时间戳改写成业务日期；调用者必须区分字段含义。
- 金额字符串不支持科学计数法，避免不同输入方式被静默接受。
- 数据库 Decimal 列精度仍限制最终存储范围；第 1.2 节会校验常用明细字段精度。

### 1.2 新增 backend/src/common/utils/money.ts

~~~ts
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  decimalOr,
  nullableDecimal,
  requiredText,
} from './business-values';

const D = Prisma.Decimal;
const ROUND = D.ROUND_HALF_UP;

function assertRange(
  value: Prisma.Decimal,
  min: string,
  max: string,
  field: string,
) {
  if (value.lt(min) || value.gt(max)) {
    throw new BadRequestException(field + '超出允许范围');
  }
}

function assertPrecision(
  value: Prisma.Decimal,
  integerDigits: number,
  decimalDigits: number,
  field: string,
) {
  if (value.decimalPlaces() > decimalDigits ||
      value.abs().gte(new D(10).pow(integerDigits))) {
    throw new BadRequestException(
      field + '最多 ' + integerDigits + ' 位整数和 ' +
      decimalDigits + ' 位小数',
    );
  }
}

export function calculateSalesLine(input: any, sort: number) {
  const productName = requiredText(input.productName, '商品名称');
  const quantity = nullableDecimal(input.quantity, '数量');
  const unitPrice = nullableDecimal(input.unitPrice, '单价');
  if (quantity == null || quantity.lte(0)) {
    throw new BadRequestException('数量必须大于零');
  }
  if (unitPrice == null || unitPrice.lt(0)) {
    throw new BadRequestException('单价必须大于或等于零');
  }
  assertPrecision(quantity, 14, 4, '数量');
  assertPrecision(unitPrice, 14, 4, '单价');

  const discount = decimalOr(input.discount, '0', '折扣百分比');
  const taxRate = decimalOr(input.taxRate, '0', '税率');
  assertRange(discount, '0', '100', '折扣百分比');
  assertRange(taxRate, '0', '100', '税率');
  assertPrecision(discount, 3, 2, '折扣百分比');
  assertPrecision(taxRate, 3, 2, '税率');

  const factor = new D(1).minus(discount.div(100));
  const beforeTax = quantity.mul(unitPrice).mul(factor);
  const amount = beforeTax
    .mul(new D(1).plus(taxRate.div(100)))
    .toDecimalPlaces(2, ROUND);
  assertPrecision(amount, 16, 2, '明细金额');
  const roundedBeforeTax = beforeTax.toDecimalPlaces(2, ROUND);
  const priceIncludeTax = unitPrice
    .mul(new D(1).plus(taxRate.div(100)))
    .toDecimalPlaces(4, ROUND);
  assertPrecision(roundedBeforeTax, 16, 2, '税前金额');
  assertPrecision(priceIncludeTax, 14, 4, '含税单价');

  return {
    productName,
    quantity,
    unitPrice,
    discount,
    taxRate,
    priceIncludeTax,
    moneyBeforeTax: roundedBeforeTax,
    moneyAfterTax: amount,
    amount,
    sort,
  };
}

export function sumAmounts(
  rows: Array<{ amount: Prisma.Decimal | string | number }>,
): Prisma.Decimal {
  const total = rows.reduce(
    (sum, row) => sum.plus(row.amount),
    new D(0),
  ).toDecimalPlaces(2, ROUND);
  assertPrecision(total, 16, 2, '单据总额');
  return total;
}

export function calculateProjectAmount(
  revenue: Prisma.Decimal | null | undefined,
  discountFactor: Prisma.Decimal | null | undefined,
): Prisma.Decimal | null {
  if (revenue == null) return null;
  if (revenue.lt(0)) {
    throw new BadRequestException('项目总额不能小于零');
  }
  assertPrecision(revenue, 16, 2, '项目总额');
  const factor = discountFactor ?? new D(10);
  assertRange(factor, '0', '10', '项目优惠折扣');
  return revenue.mul(factor).div(10).toDecimalPlaces(2, ROUND);
}

export function calculateProjectItem(input: any, sort: number) {
  const quantity = nullableDecimal(input.quantity, '项目商品数量') ?? null;
  const unitPrice = nullableDecimal(input.unitPrice, '项目商品单价') ?? null;
  if (quantity != null) {
    if (quantity.lt(0)) throw new BadRequestException('项目商品数量不能小于零');
    assertPrecision(quantity, 14, 4, '项目商品数量');
  }
  if (unitPrice != null) {
    if (unitPrice.lt(0)) throw new BadRequestException('项目商品单价不能小于零');
    assertPrecision(unitPrice, 14, 4, '项目商品单价');
  }
  const amount = quantity == null || unitPrice == null
    ? null
    : quantity.mul(unitPrice).toDecimalPlaces(2, ROUND);
  if (amount != null) assertPrecision(amount, 16, 2, '项目商品金额');
  return {
    productName: requiredText(input.productName, '项目商品名称'),
    productCode: input.productCode || null,
    model: input.model || null,
    quantity,
    unitPrice,
    amount,
    sort,
  };
}

export function formatMoney(value: any): string {
  if (value == null || value === '') return '-';
  const text = new D(value).toFixed(2, ROUND);
  const [integer, decimal] = text.split('.');
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',') +
    '.' + decimal;
}
~~~

如果现有数据使用大于 10 的项目折数或大于 100 的税率，先确定那是否是输入错误或不同业务含义；不要为绕过报错随意删除范围规则。

### 1.3 修改 payload.ts：只规范模型日期字段

保留 scrub、cleanArrayFields 的导出名称，避免影响其他模块。修改 scrub 中已知子数组处理：

原代码：

~~~ts
const arr = Array.isArray(body[k]) ? body[k] : [];
out[k] = arr.map(...);
~~~

替换为：

~~~ts
if (!Array.isArray(body[k])) {
  throw new BadRequestException(k + '必须是数组');
}
out[k] = body[k].map((it: any) =>
  it && typeof it === 'object'
    ? scrub(nested[k], it)
    : it,
);
~~~

文件顶部增加：

~~~ts
import { BadRequestException } from '@nestjs/common';
import { nullableDate } from './business-values';
~~~

将 NESTED 中：

~~~ts
inherits: 'CrmCustomerInherit'
~~~

改为：

~~~ts
inherits: 'CrmProjectInherit'
~~~

在文件中新增下列常量和函数：

~~~ts
const MODEL_DATE_FIELDS: Record<string, string[]> = {
  CrmCustomer: ['createdAt', 'updatedAt'],
  CrmContact: ['createdAt'],
  CrmOpportunity: [
    'dateOpen', 'projectDate', 'lastFollowDate',
    'expectedDate', 'createdAt', 'updatedAt',
  ],
  CrmProjectItem: ['createdAt'],
  CrmProjectFollow: ['followDate', 'createdAt'],
  CrmProjectInherit: ['inheritedAt'],
  SalesQuotation: [
    'date', 'validDate', 'createdAt', 'updatedAt',
  ],
  SalesQuotationLine: ['validDate'],
  SalesContract: [
    'signDate', 'startDate', 'endDate',
    'createdAt', 'updatedAt',
  ],
  SalesContractLine: ['deliveryDate'],
  SalesContractPaymentPlan: ['planDate', 'receivedAt'],
};

function normalizeModelDates(model: string, body: any): any {
  const out = { ...body };
  for (const field of MODEL_DATE_FIELDS[model] ?? []) {
    if (out[field] !== undefined) {
      out[field] = nullableDate(out[field], field);
    }
  }
  for (const [field, childModel] of
    Object.entries(NESTED[model] ?? {})) {
    if (out[field] !== undefined) {
      out[field] = out[field].map((item: any) =>
        normalizeModelDates(childModel, item),
      );
    }
  }
  return out;
}
~~~

将 sanitize 的整个方法替换为：

~~~ts
export function sanitize(model: string, body: any): any {
  return normalizeModelDates(model, scrub(model, body));
}
~~~

第一阶段保留 normalizeDates 的旧导出，避免不在本次清单内的调用断裂；sanitize 不再调用它。若其他地方直接使用 normalizeDates，需要先查找调用，再单独迁移：

~~~bash
rg -n 'normalizeDates' backend/src
~~~

**为什么这样改：** 备注、标题、商品名称即使正好写成“2026-10-14”，仍保持原文本；只有日期字段被转换。非法子数组不再变成 [] 清空业务明细。

## 2. 客户：创建人、空值与联系人稳定 ID

### 2.1 customer.service.ts 增加 import

把 Nest import 中增加 BadRequestException。新增：

~~~ts
import { Prisma } from '@prisma/client';
import {
  normalizeNullableFields,
  optionalArray,
  positiveInt,
  requiredText,
  stripSystemFields,
} from '../../common/utils/business-values';
~~~

### 2.2 替换 private cleanEmpty()

~~~ts
private cleanEmpty(obj: any, fields: string[]) {
  if (!obj) return obj;
  for (const field of fields) {
    if (obj[field] === '' || obj[field] === null) {
      obj[field] = null;
    }
  }
  return obj;
}
~~~

随后在 create 和 update 中，把原来的 this.cleanEmpty(data, [...]) 调用都替换为：

~~~ts
normalizeNullableFields(data, {
  ints: [
    'stateId', 'cityId', 'districtId',
    'paymentDays', 'settleDay', 'ownerId', 'deptId',
  ],
  decimals: ['paymentLimitPct', 'registeredCapital'],
});
~~~

新工具承担合法格式解析；保留 cleanEmpty 方法仅用于避免遗漏旧调用，可在 rg 确认没有调用后删除。

### 2.3 新增联系人字段构建和同步方法

加入 CustomerService 类内：

~~~ts
private buildContact(contact: any, sort: number) {
  const data: any = {
    name: requiredText(contact.name, '联系人姓名'),
    sort,
  };
  for (const field of [
    'gender', 'department', 'position', 'officePhone',
    'fax', 'mobile', 'wechat', 'email', 'remark',
  ]) {
    if (contact[field] !== undefined) {
      data[field] = contact[field] === '' ? null : contact[field];
    }
  }
  if (contact.isPrimary !== undefined) {
    if (typeof contact.isPrimary !== 'boolean') {
      throw new BadRequestException('主要联系人标识必须为布尔值');
    }
    data.isPrimary = contact.isPrimary;
  }
  return data;
}

private async syncContacts(
  tx: Prisma.TransactionClient,
  customerId: number,
  contacts: any[],
) {
  const existing = await tx.crmContact.findMany({
    where: { customerId },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((item) => item.id));
  const submittedIds = contacts
    .filter((item) => item.id !== undefined)
    .map((item) => positiveInt(item.id, '联系人 ID'));

  if (new Set(submittedIds).size !== submittedIds.length) {
    throw new BadRequestException('联系人 ID 不能重复');
  }
  for (const contactId of submittedIds) {
    if (!existingIds.has(contactId)) {
      throw new BadRequestException('联系人不属于当前客户');
    }
  }

  const retained = new Set(submittedIds);
  const removedIds = [...existingIds].filter(
    (contactId) => !retained.has(contactId),
  );

  if (removedIds.length) {
    const referenced = await tx.crmOpportunity.findFirst({
      where: { contactIds: { hasSome: removedIds } },
      select: { id: true, name: true },
    });
    if (referenced) {
      throw new BadRequestException(
        '联系人被项目“' + referenced.name +
        '”引用，请先解除项目关联再删除',
      );
    }
    await tx.crmContact.deleteMany({
      where: { customerId, id: { in: removedIds } },
    });
  }

  for (const [sort, contact] of contacts.entries()) {
    const data = this.buildContact(contact, sort);
    if (contact.id !== undefined) {
      await tx.crmContact.update({
        where: { id: positiveInt(contact.id, '联系人 ID') },
        data,
      });
    } else {
      await tx.crmContact.create({
        data: { ...data, customerId },
      });
    }
  }
}
~~~

第一阶段没有新联系人关系表，引用检查基于原有 contactIds。它修复当前 ID 被重建的问题；如果项目与客户并发编辑频繁，附录关联表是更可靠的最终方案。

### 2.4 修改 create()

在原方法中找到：

~~~ts
delete data.createdById;
~~~

只删除 create() 内这一句。update() 内的同名句保留。

在构建 data 后设置：

~~~ts
data.createdById = user.id;
data.updatedById = user.id;
data.name = requiredText(data.name, '客户名称');
~~~

将原：

~~~ts
if (Array.isArray(contacts)) data.contacts = { create: contacts };
~~~

替换为：

~~~ts
const contactRows = optionalArray(contacts, '联系人');
if (contactRows !== undefined) {
  data.contacts = {
    create: contactRows.map((contact, sort) =>
      this.buildContact(contact, sort),
    ),
  };
}
~~~

不要将旧联系人 ID 用于创建新客户。buildContact 显式选取业务字段，自动忽略 ID。

### 2.5 替换 update() 的事务部分

保留方法前半段 sanitize、关系字段剥离、系统字段剥离和 normalizeNullableFields。把原 return this.prisma.$transaction(...) 整块替换为：

~~~ts
const contactRows = optionalArray(contacts, '联系人');
if (data.name !== undefined) {
  data.name = requiredText(data.name, '客户名称');
}
return this.prisma.$transaction(async (tx) => {
  const customer = await tx.crmCustomer.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!customer) {
    throw new NotFoundException('客户不存在');
  }
  if (contactRows !== undefined) {
    await this.syncContacts(tx, id, contactRows);
  }
  return tx.crmCustomer.update({
    where: { id },
    data,
    include: { contacts: { orderBy: [
      { sort: 'asc' }, { id: 'asc' },
    ] } },
  });
}, {
  isolationLevel: 'ReadCommitted',
  maxWait: 5000,
  timeout: 10000,
});
~~~

### 2.6 前端 customer/Form.vue

loadDetail() 的 contacts 映射必须保留 id，不要改成去掉 id 的 map。

save() 中：

~~~ts
const payload: any = { ...form };
~~~

替换为第 10 节的 buildFormPayload('customer', form)。联系人由该函数显式构建，保留已有 ID。

**为什么：** 修改电话或职位不再生成新 ID；项目 contactIds 继续指向同一个联系人。创建人不再被剥离，后续新增统计能正确归属。

## 3. 项目：局部更新金额、客户关联与跟进日期

### 3.1 project.service.ts 增加 import

~~~ts
import { Prisma } from '@prisma/client';
import {
  businessToday,
  dateOnly,
  intArray,
  normalizeNullableFields,
  nullableDate,
  nullableDecimal,
  optionalArray,
  positiveInt,
  requiredText,
} from '../../common/utils/business-values';
import {
  calculateProjectAmount,
  calculateProjectItem,
  formatMoney,
} from '../../common/utils/money';
~~~

### 3.2 替换 calcAmountFinal()

~~~ts
private calcAmountFinal(
  expectedRevenue?: Prisma.Decimal | number | string | null,
  discountPct?: Prisma.Decimal | number | string | null,
) {
  return calculateProjectAmount(
    nullableDecimal(expectedRevenue, '项目总额'),
    nullableDecimal(discountPct, '项目优惠折扣'),
  );
}
~~~

### 3.3 修改 buildData()

按顺序修改以下片段：

1. 系统字段剥离后增加：

~~~ts
delete data.amountFinal;
delete data.lastFollowDate;
delete data.inheritDate;
~~~

2. 原 this.cleanEmpty(data, [...]) 整块改为：

~~~ts
normalizeNullableFields(data, {
  ints: [
    'customerId', 'stateId', 'cityId', 'districtId',
    'contractId', 'workflowId', 'ownerId', 'deptId',
  ],
  dates: ['projectDate', 'expectedDate'],
  decimals: [
    'expectedRevenue', 'discountPct', 'plannedCost',
    'discountValue', 'amountTotal',
  ],
});
if (data.dateOpen !== undefined) {
  const parsed = nullableDate(data.dateOpen, '发现日期');
  if (parsed === null) {
    throw new BadRequestException('发现日期不能为空');
  }
  data.dateOpen = parsed;
}
~~~

3. 删除这两处逻辑：

- 字符串 contactIds 自动改为空数组的 if。
- 原 cleanArrayFields(data, ['contactIds'])。

替换为：

~~~ts
if (rest.contactIds !== undefined) {
  data.contactIds = intArray(rest.contactIds, '项目联系人');
}
~~~

4. 删除整个“if (rest.expectedRevenue !== undefined || rest.discountPct !== undefined)”金额计算块。金额由 create/update 合并完数据后计算。

5. 不再接受普通表单修改最后跟进日期。前面的 delete data.lastFollowDate 已实现。

6. 返回前校验子数组：

~~~ts
optionalArray(items, '项目明细');
optionalArray(follows, '初始跟进');
~~~

### 3.4 新增客户和联系人一致性方法

加入 ProjectService 类：

~~~ts
private async resolveCustomer(
  tx: Prisma.TransactionClient,
  data: any,
  existing?: {
    customerId: number | null;
    contactIds: number[];
  },
) {
  const hasId = data.customerId !== undefined;
  const hasCode = data.customerCode !== undefined;
  let customerId = hasId ? data.customerId : existing?.customerId;
  let customer: { id: number; code: string } | null = null;

  if (hasId && customerId === null) {
    data.customerCode = null;
    data.contactIds = [];
  } else if (hasCode && data.customerCode) {
    customer = await tx.crmCustomer.findUnique({
      where: { code: String(data.customerCode).trim() },
      select: { id: true, code: true },
    });
    if (!customer) {
      throw new BadRequestException('客户编号不存在');
    }
    if (hasId && customerId !== customer.id) {
      throw new BadRequestException('客户 ID 与客户编号不一致');
    }
    customerId = customer.id;
    data.customerId = customer.id;
    data.customerCode = customer.code;
  } else if (customerId != null) {
    customer = await tx.crmCustomer.findUnique({
      where: { id: customerId },
      select: { id: true, code: true },
    });
    if (!customer) {
      throw new BadRequestException('客户不存在');
    }
    data.customerCode = customer.code;
  } else if (hasCode) {
    data.customerId = null;
    data.customerCode = null;
    data.contactIds = [];
    customerId = null;
  }

  if (existing &&
      customerId !== existing.customerId &&
      data.contactIds === undefined) {
    data.contactIds = [];
  }

  const contactIds: number[] =
    data.contactIds ?? existing?.contactIds ?? [];
  if (contactIds.length) {
    if (customerId == null) {
      throw new BadRequestException('选择联系人前必须选择客户');
    }
    const count = await tx.crmContact.count({
      where: { id: { in: contactIds }, customerId },
    });
    if (count !== contactIds.length) {
      throw new BadRequestException('联系人不存在或不属于所选客户');
    }
  }
}
~~~

有些草稿允许暂不关联客户，本方法保留此能力；确认状态必填规则可在 DTO/业务状态校验中继续执行。导入则要求客户编号存在。

### 3.5 新增项目行锁与最后跟进日期方法

~~~ts
private async lockProject(
  tx: Prisma.TransactionClient,
  projectId: number,
) {
  const rows = await tx.$queryRaw<Array<{ id: number }>>`
    SELECT id FROM "CrmOpportunity"
    WHERE id = ${projectId}
    FOR UPDATE
  `;
  if (!rows.length) {
    throw new NotFoundException('项目不存在');
  }
}

private async refreshLastFollowDate(
  tx: Prisma.TransactionClient,
  projectId: number,
) {
  const result = await tx.crmProjectFollow.aggregate({
    where: { projectId },
    _max: { followDate: true },
  });
  await tx.crmOpportunity.update({
    where: { id: projectId },
    data: { lastFollowDate: result._max.followDate },
  });
}
~~~

本版本 Prisma 模型没有 @@map，所以 SQL 表名采用 "CrmOpportunity"。如果你的目标版本改过 @@map，SQL 表名必须同步调整。

### 3.6 新增 createWithinTransaction()，替换 create()

该方法也供第 7 节导入调用：

~~~ts
private async createWithinTransaction(
  tx: Prisma.TransactionClient,
  body: any,
  user: any,
) {
  const { data, items, follows } =
    await this.buildData(body, user, false);
  data.name = requiredText(data.name, '项目主题');
  data.dateOpen = data.dateOpen ?? dateOnly(businessToday(), '发现日期');
  data.code = body.code || (await this.nextCode());
  await this.resolveCustomer(tx, data);
  data.amountFinal = this.calcAmountFinal(
    data.expectedRevenue,
    data.discountPct,
  );

  if (items !== undefined) {
    data.items = {
      create: items.map((item: any, sort: number) =>
        calculateProjectItem(item, sort),
      ),
    };
  }

  const created = await tx.crmOpportunity.create({ data });
  if (follows?.length) {
    await tx.crmProjectFollow.createMany({
      data: follows.map((follow: any) => ({
        projectId: created.id,
        followerId: positiveInt(
          follow.followerId ?? user.id,
          '跟进人',
        ),
        followDate:
          nullableDate(follow.followDate, '跟进日期') ??
          dateOnly(businessToday(), '跟进日期'),
        period: follow.period ?? null,
        schedule: follow.schedule ?? null,
        contactName: this.normalizeContactName(follow.contactName),
        content: follow.content ?? '',
      })),
    });
    await this.refreshLastFollowDate(tx, created.id);
  }
  return tx.crmOpportunity.findUniqueOrThrow({
    where: { id: created.id },
    include: { items: true },
  });
}

async create(body: any, user: any) {
  return this.prisma.$transaction(
    (tx) => this.createWithinTransaction(tx, body, user),
    { isolationLevel: 'ReadCommitted' },
  );
}
~~~

注意：现有 nextCode() 使用根 Prisma 连接调用序列，序列即使业务事务回滚也可能产生空号，这符合本文规则。第 9 节会去掉它的非原子回退。

### 3.7 替换 update()

~~~ts
async update(id: number, body: any, user: any) {
  const { data, items } = await this.buildData(body, user, true);
  return this.prisma.$transaction(async (tx) => {
    await this.lockProject(tx, id);
    const existing = await tx.crmOpportunity.findUniqueOrThrow({
      where: { id },
      select: {
        expectedRevenue: true,
        discountPct: true,
        customerId: true,
        contactIds: true,
      },
    });

    await this.resolveCustomer(tx, data, existing);
    if (data.name !== undefined) {
      data.name = requiredText(data.name, '项目主题');
    }
    if (data.expectedRevenue !== undefined ||
        data.discountPct !== undefined) {
      const revenue = data.expectedRevenue !== undefined
        ? data.expectedRevenue
        : existing.expectedRevenue;
      const discount = data.discountPct !== undefined
        ? data.discountPct
        : existing.discountPct;
      data.amountFinal = this.calcAmountFinal(revenue, discount);
    }

    if (items !== undefined) {
      await tx.crmProjectItem.deleteMany({
        where: { projectId: id },
      });
      data.items = {
        create: items.map((item: any, sort: number) =>
          calculateProjectItem(item, sort),
        ),
      };
    }

    return tx.crmOpportunity.update({
      where: { id },
      data,
      include: { items: true },
    });
  }, { isolationLevel: 'ReadCommitted' });
}
~~~

为什么先读原值：只修改折扣不再把收入当缺失，只修改收入不再丢掉原折扣。显式 null 仍然可以清空收入并将 amountFinal 设为 null。

### 3.8 替换三个跟进方法

原有删除人业务约束保留，不扩展本次分析范围。

~~~ts
async addFollow(id: number, body: any, user: any) {
  return this.prisma.$transaction(async (tx) => {
    await this.lockProject(tx, id);
    const created = await tx.crmProjectFollow.create({
      data: {
        projectId: id,
        followerId: positiveInt(body.followerId ?? user.id, '跟进人'),
        followDate:
          nullableDate(body.followDate, '跟进日期') ??
          dateOnly(businessToday(), '跟进日期'),
        period: body.period ?? null,
        schedule: body.schedule ?? null,
        contactName: this.normalizeContactName(body.contactName),
        content: body.content ?? '',
      },
      include: { follower: { select: { id: true, name: true } } },
    });
    await this.refreshLastFollowDate(tx, id);
    return created;
  });
}

async updateFollow(
  projectId: number,
  followId: number,
  body: any,
  user: any,
) {
  return this.prisma.$transaction(async (tx) => {
    await this.lockProject(tx, projectId);
    const existing = await tx.crmProjectFollow.findFirst({
      where: { id: followId, projectId },
    });
    if (!existing) {
      throw new NotFoundException('跟进记录不存在');
    }
    const data: any = {};
    if (body.followDate !== undefined) {
      const date = nullableDate(body.followDate, '跟进日期');
      if (!date) throw new BadRequestException('跟进日期不能为空');
      data.followDate = date;
    }
    for (const field of ['period', 'schedule', 'content']) {
      if (body[field] !== undefined) data[field] = body[field];
    }
    if (body.contactName !== undefined) {
      data.contactName = this.normalizeContactName(body.contactName);
    }
    if (body.followerId !== undefined) {
      data.followerId = positiveInt(body.followerId, '跟进人');
    }
    const result = await tx.crmProjectFollow.update({
      where: { id: followId },
      data,
      include: { follower: { select: { id: true, name: true } } },
    });
    await this.refreshLastFollowDate(tx, projectId);
    return result;
  });
}

async deleteFollow(
  projectId: number,
  followId: number,
  user: any,
) {
  return this.prisma.$transaction(async (tx) => {
    await this.lockProject(tx, projectId);
    const existing = await tx.crmProjectFollow.findFirst({
      where: { id: followId, projectId },
    });
    if (!existing) {
      throw new NotFoundException('跟进记录不存在');
    }
    if (existing.followerId !== user.id && !user?.isAdmin) {
      throw new ForbiddenException('仅跟进创建人或管理员可删除');
    }
    await tx.crmProjectFollow.delete({ where: { id: followId } });
    await this.refreshLastFollowDate(tx, projectId);
    return { ok: true, id: followId };
  });
}
~~~

### 3.9 旧缓存重算与索引

这些 SQL 只写入第 7 节统一 migration.sql，不要在多个迁移中重复执行：

~~~sql
CREATE INDEX IF NOT EXISTS "CrmProjectFollow_projectId_followDate_idx"
ON "CrmProjectFollow" ("projectId", "followDate" DESC);

UPDATE "CrmOpportunity" AS p
SET "lastFollowDate" = (
  SELECT MAX(f."followDate")
  FROM "CrmProjectFollow" AS f
  WHERE f."projectId" = p.id
);
~~~

schema.prisma 的 CrmProjectFollow 中增加：

~~~prisma
@@index([projectId, followDate(sort: Desc)],
  map: "CrmProjectFollow_projectId_followDate_idx")
~~~

联系人旧失效 ID 不会通过重算跟进日期自动恢复。另行导出无法对应 CrmContact 的 ID，不根据姓名盲目回填。


## 4. 报价与合同：事务、后端核算、付款计划保留 ID

### 4.1 两个 Service 的 import

quotation.service.ts 与 contract.service.ts 的 Nest import 都增加 BadRequestException；两个文件都增加：

~~~ts
import { Prisma } from '@prisma/client';
import {
  businessToday,
  dateOnly,
  intArray,
  nullableDate,
  nullableDecimal,
  optionalArray,
  positiveInt,
  requiredText,
  stripSystemFields,
} from '../../common/utils/business-values';
import {
  calculateSalesLine,
  formatMoney,
  sumAmounts,
} from '../../common/utils/money';
~~~

继续保留原 sanitize、PdfService 和 renderPdf import。

### 4.2 quotation.service.ts 替换 fixLine()

~~~ts
private fixLine(line: any, sort = 0) {
  const {
    id, quotationId, createdAt, updatedAt, ...rest
  } = line;
  const calculated = calculateSalesLine(rest, sort);
  const { moneyAfterTax, ...quotationAmounts } = calculated;
  return {
    ...rest,
    ...quotationAmounts,
    // pricejy 旧语义未确认，保留传入值，仅兼容其必填列。
    pricejy: nullableDecimal(rest.pricejy, 'pricejy') ?? 0,
  };
}
~~~

不能将 moneyAfterTax 写入 SalesQuotationLine，该字段只在合同明细中存在，所以显式移除。

### 4.3 quotation.service.ts 新增 buildQuotationData()

~~~ts
private buildQuotationData(body: any) {
  const clean = sanitize('SalesQuotation', body);
  const { lines, ...data } = clean;
  stripSystemFields(data);
  delete data.amountTotal;
  delete data.isContracted;
  if (data.title !== undefined) {
    data.title = requiredText(data.title, '报价标题');
  }
  if (data.customerName !== undefined) {
    data.customerName = requiredText(data.customerName, '报价客户');
  }
  if (data.date === null) {
    throw new BadRequestException('报价日期不能为空');
  }
  const rows = optionalArray(lines, '报价明细');
  const lineData = rows?.map((line, sort) =>
    this.fixLine(line, sort),
  );
  return { data, lineData };
}
~~~

第一阶段 amountTotal 明确定义为税后明细金额之和；旧 discountType/discountValue 不参与整单再次打折。当前页面没有该整单优惠功能。若你的数据曾使用该功能，先保留其历史记录，不自动重算已确认报价；后续须在确认其原含义后单独实现整单优惠。

### 4.4 quotation.service.ts 整体替换 create() 和 update()

~~~ts
async create(body: any, user: any) {
  const { data, lineData } = this.buildQuotationData(body);
  data.title = requiredText(data.title, '报价标题');
  data.customerName = requiredText(data.customerName, '报价客户');
  data.code = data.code || (await this.nextCode());
  data.date = data.date ?? dateOnly(businessToday(), '报价日期');
  data.createdById = user.id;
  data.deptId = user.deptId ?? data.deptId;
  data.amountTotal = sumAmounts(lineData ?? []);
  if (lineData !== undefined) {
    data.lines = { create: lineData };
  }
  return this.prisma.salesQuotation.create({
    data,
    include: { lines: true },
  });
}

async update(id: number, body: any, user: any) {
  const { data, lineData } = this.buildQuotationData(body);
  delete data.code;
  return this.prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: number }>>`
      SELECT id FROM "SalesQuotation"
      WHERE id = ${id}
      FOR UPDATE
    `;
    if (!locked.length) {
      throw new NotFoundException('报价单不存在');
    }
    if (lineData !== undefined) {
      data.amountTotal = sumAmounts(lineData);
      await tx.salesQuotationLine.deleteMany({
        where: { quotationId: id },
      });
      data.lines = { create: lineData };
    }
    return tx.salesQuotation.update({
      where: { id },
      data,
      include: {
        lines: { orderBy: [{ sort: 'asc' }, { id: 'asc' }] },
      },
    });
  }, {
    isolationLevel: 'ReadCommitted',
    maxWait: 5000,
    timeout: 10000,
  });
}
~~~

为什么创建不额外套事务：Prisma 主表加 nested create 本身是原子写入；更新中的独立 deleteMany 必须和 update 处于同一事务。

### 4.5 contract.service.ts 替换 cleanDates()

~~~ts
private cleanDates(obj: any, dateFields: string[]) {
  if (!obj) return obj;
  for (const field of dateFields) {
    if (obj[field] !== undefined) {
      obj[field] = nullableDate(obj[field], field);
    }
  }
  return obj;
}
~~~

这使结束日期清空后真正写入 null，而不是跳过更新。

### 4.6 contract.service.ts 替换 fixLine()

~~~ts
private fixLine(line: any, sort = 0) {
  const { id, contractId, createdAt, updatedAt, ...rest } = line;
  const calculated = calculateSalesLine(rest, sort);
  const { moneyBeforeTax, ...contractAmounts } = calculated;
  return {
    ...rest,
    ...contractAmounts,
    deliveryDate: nullableDate(rest.deliveryDate, '交付日期'),
    pricejy: nullableDecimal(rest.pricejy, 'pricejy') ?? 0,
  };
}
~~~

合同没有 moneyBeforeTax 字段，不能将整个公共结果直接展开进去。

### 4.7 新增合同头和付款计划构建方法

加入 ContractService 类：

~~~ts
private buildContractData(body: any) {
  const clean = sanitize('SalesContract', body);
  const { lines, paymentPlans, ...data } = clean;
  stripSystemFields(data);
  delete data.amountTotal;
  delete data.amountFinal;

  if (data.title !== undefined) {
    data.title = requiredText(data.title, '合同标题');
  }
  if (data.customerName !== undefined) {
    data.customerName = requiredText(data.customerName, '合同客户');
  }
  if (data.signDate === null) {
    throw new BadRequestException('签订日期不能为空');
  }
  this.cleanDates(data, ['signDate', 'startDate', 'endDate']);
  if (data.sharedUserIds !== undefined) {
    data.sharedUserIds = intArray(data.sharedUserIds, '共享人员');
  }
  if (data.discountValue !== undefined) {
    data.discountValue =
      nullableDecimal(data.discountValue, '整单优惠金额');
  }

  const rows = optionalArray(lines, '合同明细');
  const plans = optionalArray(paymentPlans, '付款计划');
  return {
    data,
    lineData: rows?.map((line, sort) => this.fixLine(line, sort)),
    plans,
  };
}

private buildPlan(plan: any, index: number) {
  const planDate = nullableDate(plan.planDate, '付款计划日期');
  if (!planDate) {
    throw new BadRequestException('付款计划日期不能为空');
  }
  const amount = nullableDecimal(plan.amount, '付款计划金额');
  if (amount == null || amount.lt(0)) {
    throw new BadRequestException('付款计划金额不能小于零');
  }
  if (amount.decimalPlaces() > 2 ||
      amount.gte('10000000000000000')) {
    throw new BadRequestException('付款计划金额超出 Decimal(18,2) 精度');
  }
  return {
    seq: index + 1,
    planDate,
    amount,
    remark: plan.remark === '' ? null : plan.remark ?? null,
  };
}

private calculateContractFinal(
  total: Prisma.Decimal,
  discount: any,
) {
  const value = nullableDecimal(discount, '整单优惠金额') ??
    new Prisma.Decimal(0);
  if (value.lt(0) || value.gt(total)) {
    throw new BadRequestException('整单优惠必须在零和合同总额之间');
  }
  if (value.decimalPlaces() > 2) {
    throw new BadRequestException('整单优惠最多两位小数');
  }
  return total.minus(value).toDecimalPlaces(2);
}

private validatePlanTotal(
  state: string,
  finalAmount: Prisma.Decimal,
  plans: Array<{ amount: any }>,
) {
  // 当前表单提交时传 approved。
  if (state !== 'approved') return;
  const total = plans.reduce(
    (sum, plan) => sum.plus(plan.amount),
    new Prisma.Decimal(0),
  );
  if (!total.eq(finalAmount)) {
    throw new BadRequestException(
      '提交合同时付款计划合计必须等于最终应收金额',
    );
  }
}

private async syncPaymentPlans(
  tx: Prisma.TransactionClient,
  contractId: number,
  plans: any[],
) {
  const existing = await tx.salesContractPaymentPlan.findMany({
    where: { contractId },
  });
  const existingMap = new Map(existing.map((plan) => [plan.id, plan]));
  const ids = plans
    .filter((plan) => plan.id !== undefined)
    .map((plan) => positiveInt(plan.id, '付款计划 ID'));
  if (ids.length !== new Set(ids).size) {
    throw new BadRequestException('付款计划 ID 不能重复');
  }
  for (const id of ids) {
    if (!existingMap.has(id)) {
      throw new BadRequestException('付款计划不属于当前合同');
    }
  }
  const retained = new Set(ids);
  const removed = existing.filter((plan) => !retained.has(plan.id));
  if (removed.some((plan) => plan.isReceived)) {
    throw new BadRequestException('已收款计划不能删除');
  }
  if (removed.length) {
    await tx.salesContractPaymentPlan.deleteMany({
      where: { id: { in: removed.map((plan) => plan.id) } },
    });
  }

  for (const [index, plan] of plans.entries()) {
    const data = this.buildPlan(plan, index);
    if (plan.id !== undefined) {
      const id = positiveInt(plan.id, '付款计划 ID');
      const old = existingMap.get(id)!;
      if (old.isReceived &&
          (!old.amount.eq(data.amount) ||
           old.planDate.getTime() !== data.planDate.getTime())) {
        throw new BadRequestException('已收款计划不能修改金额和计划日期');
      }
      await tx.salesContractPaymentPlan.update({
        where: { id },
        data,
      });
    } else {
      await tx.salesContractPaymentPlan.create({
        data: { ...data, contractId },
      });
    }
  }
}
~~~

付款计划的 isReceived 和 receivedAt 由数据库原值保留，不让普通合同编辑把收款状态重置。第一阶段不新增收款动作；如果现有其他接口负责收款，继续通过原流程处理。

### 4.8 替换合同 create() 和 update()

~~~ts
async create(body: any, user: any) {
  const { data, lineData, plans } = this.buildContractData(body);
  data.title = requiredText(data.title, '合同标题');
  data.customerName = requiredText(data.customerName, '合同客户');
  data.code = data.code || (await this.nextCode());
  data.signDate =
    data.signDate ?? dateOnly(businessToday(), '签订日期');
  data.createdById = user.id;
  data.deptId = user.deptId ?? data.deptId;

  const total = sumAmounts(lineData ?? []);
  data.amountTotal = total;
  data.amountFinal =
    this.calculateContractFinal(total, data.discountValue);

  const planData = (plans ?? []).map((plan, index) =>
    this.buildPlan(plan, index),
  );
  this.validatePlanTotal(
    data.approvalState ?? 'draft',
    data.amountFinal,
    planData,
  );
  if (lineData !== undefined) {
    data.lines = { create: lineData };
  }
  if (plans !== undefined) {
    data.paymentPlans = { create: planData };
  }
  return this.prisma.salesContract.create({
    data,
    include: { lines: true, paymentPlans: true },
  });
}

async update(id: number, body: any, user: any) {
  const { data, lineData, plans } = this.buildContractData(body);
  delete data.code;
  return this.prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: number }>>`
      SELECT id FROM "SalesContract"
      WHERE id = ${id}
      FOR UPDATE
    `;
    if (!locked.length) {
      throw new NotFoundException('合同不存在');
    }
    const existing = await tx.salesContract.findUniqueOrThrow({
      where: { id },
      include: { lines: true, paymentPlans: true },
    });

    const total = lineData !== undefined
      ? sumAmounts(lineData)
      : existing.amountTotal ?? sumAmounts(existing.lines);
    const discount = data.discountValue !== undefined
      ? data.discountValue
      : existing.discountValue;
    const moneyChanged =
      lineData !== undefined || data.discountValue !== undefined;
    const finalAmount = moneyChanged
      ? this.calculateContractFinal(total, discount)
      : existing.amountFinal ??
        this.calculateContractFinal(total, discount);
    if (moneyChanged || existing.amountTotal == null) {
      data.amountTotal = total;
      data.amountFinal = finalAmount;
    }

    const effectivePlans = plans !== undefined
      ? plans.map((plan, index) => this.buildPlan(plan, index))
      : existing.paymentPlans;
    if (moneyChanged || plans !== undefined ||
        data.approvalState !== undefined) {
      this.validatePlanTotal(
        data.approvalState ?? existing.approvalState,
        finalAmount,
        effectivePlans,
      );
    }

    if (lineData !== undefined) {
      await tx.salesContractLine.deleteMany({
        where: { contractId: id },
      });
      data.lines = { create: lineData };
    }
    if (plans !== undefined) {
      await this.syncPaymentPlans(tx, id, plans);
    }
    return tx.salesContract.update({
      where: { id },
      data,
      include: {
        lines: { orderBy: [{ sort: 'asc' }, { id: 'asc' }] },
        paymentPlans: { orderBy: [{ seq: 'asc' }, { id: 'asc' }] },
      },
    });
  }, {
    isolationLevel: 'ReadCommitted',
    maxWait: 5000,
    timeout: 10000,
  });
}
~~~

已收款合同金额如果变化会触发回款合计规则，避免无提示地留下不一致账期。后续要支持合同变更单时另建明确业务动作。

### 4.9 PDF 金额统一

quotation、contract、project 三个 Service 的 private fmtMoney() 整体替换为：

~~~ts
private fmtMoney(value: any): string {
  return formatMoney(value);
}
~~~

ProjectService 已在第 3 节加入 import；其余两个已在第 4.1 节加入。

quotation.generatePdf()：

- 删除 let total = 0。
- 删除 lines map 内 total += Number(l.amount) || 0。
- 将 amountTotal: this.fmtMoney(total) 改成：

~~~ts
amountTotal: this.fmtMoney(
  q.amountTotal ?? sumAmounts(q.lines),
),
~~~

contract.generatePdf()：

- 删除 let total = 0 和 total += Number(l.amount) || 0。
- 将 amountTotal 的值替换为：

~~~ts
amountTotal: this.fmtMoney(
  c.amountFinal ?? c.amountTotal ?? sumAmounts(c.lines),
),
~~~

这是“合同应收金额”显示。如果模板标题明确写“原始合同总额”，应把模板标签同步改为“最终应收金额”，不要名称仍表示原始额而数字变成最终额。

### 4.10 前端明细与付款计划

quotation/Form.vue 的明细仍可剥离 ID，因为本阶段明细采用整单事务替换。

contract/Form.vue 的 loadDetail() 中，将 paymentPlans 映射替换为：

~~~ts
paymentPlans: (d.paymentPlans || []).map((plan: any) => ({
  id: plan.id,
  seq: plan.seq,
  planDate: plan.planDate?.slice(0, 10) ?? '',
  amount: plan.amount == null ? '' : String(plan.amount),
  remark: plan.remark ?? '',
  isReceived: plan.isReceived,
  receivedAt: plan.receivedAt,
})),
~~~

id 必须保留，否则后端将全部原计划视为移除。

两份表单 save() 中的 payload 构建分别使用：

~~~ts
const payload = buildFormPayload('quotation', form);
~~~

~~~ts
const payload = buildFormPayload('contract', form);
~~~

第 10 节给出完整公共构建函数。保留前端 recalc 做即时预览；后端保存结果为正式值，不把 row.amount 当作最终计算依据。

## 5. Excel：直接替换两个导出方法

### 5.1 weekly-schedule.service.ts 替换 exportToBuffer()

~~~ts
async exportToBuffer(ownerId: number, weekStart: Date): Promise<Buffer> {
  const row = await this.prisma.crmWeeklySchedule.findUnique({
    where: { ownerId_weekStart: { ownerId, weekStart } },
  });
  const days: any[] = Array.isArray(row?.days) &&
    row.days.length === 7
    ? row.days
    : this.defaultDays(weekStart);

  const start = new Date(weekStart);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const fmt = (date: Date) =>
    date.getUTCFullYear() + '年' +
    (date.getUTCMonth() + 1) + '月' +
    date.getUTCDate() + '日';
  const rangeText = fmt(start) + ' ~ ' + fmt(end);

  const aoa: any[][] = [
    [rangeText, '本周工作计划', row?.planText ?? '', '', '', '', ''],
    ['', '本周工作总结', row?.summaryText ?? '', '', '', '', ''],
    ['', '领导评定', row?.leaderComment ?? '', '', '', '', ''],
    ['', '日期', '上下午', '工作内容', '完成进度', '是否完成', '备注'],
  ];
  const labels = [
    '星期一', '星期二', '星期三', '星期四',
    '星期五', '星期六', '星期日',
  ];

  for (let i = 0; i < 7; i++) {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + i);
    const key = date.toISOString().slice(0, 10);
    const day = days.find((item) => item.date === key) ?? {};
    for (const [slot, label] of [
      ['am', '上午'], ['pm', '下午'],
    ] as const) {
      const cell = day[slot] ?? {};
      aoa.push([
        '',
        date.getUTCDate() + '日 ' + labels[i],
        label,
        cell.content ?? '',
        cell.progress ?? '',
        cell.done === true ? '是' :
          cell.done === false ? '否' : '',
        cell.remark ?? '',
      ]);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const merges: XLSX.Range[] = [
    { s: { r: 0, c: 0 }, e: { r: aoa.length - 1, c: 0 } },
  ];
  for (let r = 0; r < 3; r++) {
    merges.push({ s: { r, c: 2 }, e: { r, c: 6 } });
  }
  for (let i = 0; i < 7; i++) {
    const r = 4 + i * 2;
    merges.push({ s: { r, c: 1 }, e: { r: r + 1, c: 1 } });
  }
  ws['!merges'] = merges;
  ws['!cols'] = [
    { wch: 22 }, { wch: 14 }, { wch: 8 },
    { wch: 50 }, { wch: 12 }, { wch: 10 }, { wch: 24 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '周日程');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
~~~

不能继续用 days[i] 直接匹配日期：如果 JSON 中日期顺序错乱，会导出错日。按 date 键匹配更明确。

### 5.2 sales-schedule.service.ts 替换 exportToBuffer()

~~~ts
async exportToBuffer(ownerId: number, weekStart: Date): Promise<Buffer> {
  const data = await this.getByWeek(ownerId, weekStart);
  const fmt = (date: Date) =>
    date.getUTCFullYear() + '年' +
    (date.getUTCMonth() + 1) + '月' +
    date.getUTCDate() + '日';
  const range = fmt(new Date(data.weekStart)) +
    ' ~ ' + fmt(new Date(data.weekEnd));
  const aoa: any[][] = [
    [range, '本周工作计划', data.planText, '', '', '', '', '', '', ''],
    ['', '本周工作总结', data.summaryText, '', '', '', '', '', '', ''],
    ['', '领导评定', data.leaderComment, '', '', '', '', '', '', ''],
    ['', '日期', '上下午', '当日总结', '日程',
      '客户', '项目', '联系人', '里程碑', '跟进情况'],
  ];
  const merges: XLSX.Range[] = [];
  for (let r = 0; r < 3; r++) {
    merges.push({ s: { r, c: 2 }, e: { r, c: 9 } });
  }

  for (const day of data.days as any[]) {
    const dayStart = aoa.length;
    for (const [slot, label] of [
      ['am', '上午'], ['pm', '下午'],
    ] as const) {
      const slotStart = aoa.length;
      const cells = day[slot]?.length ? day[slot] : [{}];
      for (const cell of cells) {
        aoa.push([
          '',
          day.dateLabel,
          label,
          day.daySummary ?? '',
          cell.schedule ?? '',
          cell.customer ?? '',
          cell.project ?? '',
          (cell.contactNames ?? []).join('; '),
          cell.milestone ?? '',
          cell.content ?? '',
        ]);
      }
      if (aoa.length - slotStart > 1) {
        merges.push({
          s: { r: slotStart, c: 2 },
          e: { r: aoa.length - 1, c: 2 },
        });
      }
    }
    const dayEnd = aoa.length - 1;
    if (dayEnd > dayStart) {
      merges.push({
        s: { r: dayStart, c: 1 },
        e: { r: dayEnd, c: 1 },
      });
      merges.push({
        s: { r: dayStart, c: 3 },
        e: { r: dayEnd, c: 3 },
      });
    }
  }
  merges.push({
    s: { r: 0, c: 0 },
    e: { r: aoa.length - 1, c: 0 },
  });
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!merges'] = merges;
  ws['!cols'] = [
    { wch: 22 }, { wch: 14 }, { wch: 8 }, { wch: 22 },
    { wch: 18 }, { wch: 22 }, { wch: 22 }, { wch: 18 },
    { wch: 14 }, { wch: 36 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '销售日程');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
~~~

**为什么：** 顶部合并区域正文位于左上角；当日总结合并 D 列；上午与下午分别合并 C 列，不再丢失下午标识。

## 6. 销售统计：创建贡献、当前持有与批量聚合

### 6.1 stats.service.ts 新增 import

~~~ts
import { businessDateRange } from '../../common/utils/business-values';
~~~

SalesSummaryRow 的 userId 已允许 null，保留。新增可选字段：

~~~ts
isActive?: boolean;
~~~

### 6.2 完整替换 summary()

~~~ts
async summary(q: SalesSummaryQuery): Promise<SalesSummaryResult> {
  const createdAt = businessDateRange(q.dateFrom, q.dateTo);
  const creatorFilter = q.userId !== undefined
    ? { createdById: q.userId }
    : {};
  const ownerFilter = q.userId !== undefined
    ? { ownerId: q.userId }
    : {};
  const createdWhere = createdAt ? { createdAt } : {};

  const grouped = await this.prisma.$transaction(async (tx) => {
    const createdCustomers = await tx.crmCustomer.groupBy({
      by: ['createdById'],
      where: { ...createdWhere, ...creatorFilter },
      _count: { _all: true },
    });
    const createdProjects = await tx.crmOpportunity.groupBy({
      by: ['createdById'],
      where: { ...createdWhere, ...creatorFilter },
      _count: { _all: true },
    });
    const ownedCustomers = await tx.crmCustomer.groupBy({
      by: ['ownerId'],
      where: ownerFilter,
      _count: { _all: true },
    });
    const ownedProjects = await tx.crmOpportunity.groupBy({
      by: ['ownerId'],
      where: ownerFilter,
      _count: { _all: true },
    });

    const ids = new Set<number>();
    for (const row of createdCustomers) {
      if (row.createdById != null) ids.add(row.createdById);
    }
    for (const row of createdProjects) {
      if (row.createdById != null) ids.add(row.createdById);
    }
    for (const row of ownedCustomers) {
      if (row.ownerId != null) ids.add(row.ownerId);
    }
    for (const row of ownedProjects) {
      if (row.ownerId != null) ids.add(row.ownerId);
    }
    const users = await tx.sysUser.findMany({
      where: { id: { in: [...ids] } },
      select: {
        id: true, username: true, name: true, isActive: true,
        dept: { select: { name: true } },
      },
    });
    return {
      createdCustomers, createdProjects,
      ownedCustomers, ownedProjects, users,
    };
  }, { isolationLevel: 'RepeatableRead' });

  const users = new Map(grouped.users.map((user) => [user.id, user]));
  const rows = new Map<string, SalesSummaryRow>();
  const ensure = (
    id: number | null,
    kind: 'created' | 'owned',
  ) => {
    const key = id == null
      ? (kind === 'created' ? 'unknown-creator' : 'unassigned-owner')
      : 'user-' + id;
    if (!rows.has(key)) {
      const user = id == null ? undefined : users.get(id);
      rows.set(key, {
        userId: id,
        username: user?.username ??
          (id == null ? '-' : 'ID=' + id),
        name: user?.name ??
          (id == null
            ? (kind === 'created' ? '历史创建人未知' : '未分配')
            : '历史人员'),
        deptName: user?.dept?.name ?? '-',
        isActive: user?.isActive,
        newCustomers: 0,
        newProjects: 0,
        customerCount: 0,
        projectCount: 0,
      });
    }
    return rows.get(key)!;
  };

  for (const row of grouped.createdCustomers) {
    ensure(row.createdById, 'created').newCustomers = row._count._all;
  }
  for (const row of grouped.createdProjects) {
    ensure(row.createdById, 'created').newProjects = row._count._all;
  }
  for (const row of grouped.ownedCustomers) {
    ensure(row.ownerId, 'owned').customerCount = row._count._all;
  }
  for (const row of grouped.ownedProjects) {
    ensure(row.ownerId, 'owned').projectCount = row._count._all;
  }

  const perUser = [...rows.values()].sort(
    (a, b) => b.newCustomers - a.newCustomers ||
      b.newProjects - a.newProjects ||
      (a.userId ?? 0) - (b.userId ?? 0),
  );
  const total = perUser.reduce((sum, row) => ({
    newCustomers: sum.newCustomers + row.newCustomers,
    newProjects: sum.newProjects + row.newProjects,
    customerCount: sum.customerCount + row.customerCount,
    projectCount: sum.projectCount + row.projectCount,
  }), {
    newCustomers: 0, newProjects: 0,
    customerCount: 0, projectCount: 0,
  });
  return { total, perUser };
}
~~~

第一阶段保持原有“记录数”统计：不自动新增 isActive 或 submitStatus 过滤。以后若改成有效正式记录，应同时修改所有四项指标，并在页面说明口径。

### 6.3 删除旧 buildDateFilter()

summary 不再调用原 buildDateFilter，删除该 private 方法，避免两套日期边界继续并存。

buildExcel() 仍调用 summary，无需复制任何聚合逻辑。修改其表头：

~~~ts
rows.push([
  '人员', '部门', '新建客户', '新建项目',
  '当前持有客户', '当前持有项目',
]);
~~~

### 6.4 stats.controller.ts 参数检查

新增 import：

~~~ts
import { positiveInt } from '../../common/utils/business-values';
~~~

summary() 和 exportExcel() 中，将：

~~~ts
userId: userId ? Number(userId) : undefined,
~~~

都改成：

~~~ts
userId: userId ? positiveInt(userId, '人员 ID') : undefined,
~~~

空日期由前端不传；businessDateRange 会拒绝非法日期或起止反向。

### 6.5 前端 stats/sales/Index.vue

修改本地 interface：

~~~ts
userId: number | null;
isActive?: boolean;
~~~

所有标签按下表替换，包括指标卡、表头和合计行：

| 原标签 | 新标签 |
| --- | --- |
| 新增客户 | 新建客户 |
| 新增项目 | 新建项目 |
| 客户总数、客户累计 | 当前持有客户 |
| 项目总数、项目累计 | 当前持有项目 |

人员显示改为：

~~~vue
<template #default="{ row }">
  {{ row.name }}（{{ row.username }}）
  <span v-if="row.isActive === false">（已停用）</span>
</template>
~~~

loadUserOptions() 删除 .filter((u) => u.isActive)，改为：

~~~ts
userOptions.value = (list || []).map((user) => ({
  id: user.id,
  name: user.name +
    (user.isActive === false ? '（已停用）' : ''),
  username: user.username,
}));
~~~

如果 sysApi.users() 后端本身只返回有效人员，当前报表仍能显示已有停用人员，但筛选候选无法完整显示；在需要完整候选时新增专门统计人员接口，不直接改其他模块共用的用户候选语义。

### 6.6 历史创建人不要用 ownerId 冒充

第 2 节只修复以后新建客户。过去 createdById=null 的记录进入“历史创建人未知”。没有可靠来源时不执行：

~~~sql
-- 不要执行：
UPDATE "CrmCustomer" SET "createdById" = "ownerId";
~~~

当前负责人可能经历转交，把它用作创建人会制造错误历史。


## 7. 项目导入：预览解析、整批事务和批次幂等

### 7.1 schema.prisma 新增 ProjectImportBatch

在文件末尾新增：

~~~prisma
model ProjectImportBatch {
  id          String   @id
  createdById Int
  status      String   @default("prepared")
  rows        Json
  result      Json?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([createdById, createdAt])
}
~~~

此阶段采用整批回滚，所以不需要导入行表。批次中只保存预览通过的标准化行。批次完成后保存结果，重复确认不再次创建项目。

### 7.2 新增 project-import.dto.ts

路径：backend/src/modules/project/dto/project-import.dto.ts

~~~ts
import { Type } from 'class-transformer';
import {
  IsArray, IsInt, IsNotEmpty, IsObject,
  IsString, Min, ValidateNested,
} from 'class-validator';

export class ProjectImportRowDto {
  @Type(() => Number)
  @IsInt()
  @Min(2)
  sourceRow!: number;

  @IsObject()
  data!: Record<string, unknown>;
}

export class ProjectImportPreviewDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectImportRowDto)
  rows!: ProjectImportRowDto[];
}

export class ProjectImportConfirmDto {
  @IsString()
  @IsNotEmpty()
  batchId!: string;
}
~~~

### 7.3 ProjectService 新增 import 与常量

~~~ts
import { randomUUID } from 'crypto';
~~~

类外增加：

~~~ts
const PROJECT_OPTIONS: Record<string, string[]> = {
  category: ['系统集成', '电磁兼容', '仪表销售',
    '仪器租赁', '代客户购', '过单转售'],
  stage: ['初期沟通', '立项评估', '方案制定',
    '招投标', '商务谈判', '合同签订', '长期合作'],
  source: ['电话咨询', '客户介绍', '独立开发',
    '展会活动', '公司分派'],
  state: ['成功', '失败', '延误', '跟踪', '初期跟进'],
  currencyCode: ['人民币', '美元', '欧元',
    '日元', '英镑', '港币', '其他'],
};
~~~

这些枚举与当前项目表单一致。后续统一到字典表时前后端共同读取，不能只修改某一边。

### 7.4 替换 importPreview()

~~~ts
async importPreview(inputRows: any[], user: any) {
  optionalArray(inputRows, '导入行');
  const codes = [...new Set(inputRows.map((row) =>
    String(row.data?.customerCode ?? '').trim(),
  ).filter(Boolean))];
  const userIds = [...new Set(inputRows.map((row) => {
    const text = String(row.data?.ownerId ?? '').trim();
    return /^\d+$/.test(text) ? Number(text) : 0;
  }).filter((id) => id > 0))];

  const [customers, users] = await Promise.all([
    this.prisma.crmCustomer.findMany({
      where: { code: { in: codes } },
      select: { id: true, code: true },
    }),
    this.prisma.sysUser.findMany({
      where: { id: { in: userIds }, isActive: true },
      select: { id: true, deptId: true },
    }),
  ]);
  const customerMap = new Map(
    customers.map((customer) => [customer.code, customer]),
  );
  const userMap = new Map(users.map((item) => [item.id, item]));
  const valid: any[] = [];
  const invalid: any[] = [];
  const seenRows = new Set<number>();

  for (const input of inputRows) {
    const rowNumber = positiveInt(input.sourceRow, 'Excel 行号');
    if (seenRows.has(rowNumber)) {
      throw new BadRequestException('Excel 行号重复');
    }
    seenRows.add(rowNumber);
    const raw = input.data ?? {};
    const errors: Array<{ field: string; message: string }> = [];
    const normalized: any = { sourceRow: rowNumber };
    const collect = (field: string, fn: () => any) => {
      try { normalized[field] = fn(); }
      catch (error: any) {
        errors.push({ field, message: error.message });
      }
    };

    collect('name', () => requiredText(raw.name, '项目主题'));
    collect('customerCode', () =>
      requiredText(raw.customerCode, '客户编号'));
    collect('ownerId', () => positiveInt(raw.ownerId, '负责销售人'));
    collect('dateOpen', () =>
      dateOnly(raw.dateOpen, '发现日期').toISOString().slice(0, 10));

    for (const field of ['category', 'stage', 'source', 'state']) {
      collect(field, () => {
        const value = requiredText(raw[field], field);
        if (!PROJECT_OPTIONS[field].includes(value)) {
          throw new BadRequestException(field + '不是模板允许的选项');
        }
        return value;
      });
    }
    collect('currencyCode', () => {
      const value = raw.currencyCode
        ? String(raw.currencyCode).trim()
        : '人民币';
      if (!PROJECT_OPTIONS.currencyCode.includes(value)) {
        throw new BadRequestException('币种不在允许范围内');
      }
      return value;
    });

    for (const field of [
      'expectedRevenue', 'discountPct', 'plannedCost',
    ]) {
      collect(field, () =>
        nullableDecimal(raw[field], field)?.toString() ?? null);
    }
    if (normalized.expectedRevenue !== undefined &&
        normalized.discountPct !== undefined) {
      collect('amountFinal', () => this.calcAmountFinal(
        normalized.expectedRevenue,
        normalized.discountPct,
      )?.toString() ?? null);
    }
    if (normalized.plannedCost != null &&
        new Prisma.Decimal(normalized.plannedCost).lt(0)) {
      errors.push({ field: 'plannedCost', message: '预计费用不能小于零' });
    }

    const customer = customerMap.get(normalized.customerCode);
    if (!customer) {
      errors.push({ field: 'customerCode', message: '客户编号不存在' });
    } else {
      normalized.customerId = customer.id;
    }
    const owner = userMap.get(normalized.ownerId);
    if (!owner) {
      errors.push({ field: 'ownerId', message: '负责人不存在或已停用' });
    }
    normalized.description = raw.description == null
      ? null : String(raw.description);
    normalized.submitStatus = 'active';

    if (errors.length) {
      invalid.push({
        row: rowNumber,
        data: raw,
        errors,
        // 保留当前预览页面的 miss 字段。
        miss: [...new Set(errors.map((error) => error.field))],
      });
    } else {
      valid.push(normalized);
    }
  }

  const batchId = valid.length ? randomUUID() : null;
  if (batchId) {
    await this.prisma.projectImportBatch.create({
      data: {
        id: batchId,
        createdById: user.id,
        rows: valid,
      },
    });
  }
  return {
    batchId,
    total: inputRows.length,
    validCount: valid.length,
    invalidCount: invalid.length,
    valid,
    invalid,
  };
}
~~~

预览只解析数据，不分配项目编号。发现关联变更时确认阶段会再次检查。

### 7.5 替换 importConfirm()

~~~ts
async importConfirm(batchId: string, user: any) {
  return this.prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "ProjectImportBatch"
      WHERE id = ${batchId}
      FOR UPDATE
    `;
    if (!locked.length) {
      throw new NotFoundException('导入批次不存在，请重新预览');
    }
    const batch = await tx.projectImportBatch.findUniqueOrThrow({
      where: { id: batchId },
    });
    if (batch.createdById !== user.id) {
      throw new BadRequestException('当前批次创建人不一致');
    }
    if (batch.status === 'done') return batch.result;
    if (batch.status !== 'prepared' || !Array.isArray(batch.rows)) {
      throw new BadRequestException('导入批次状态不正确');
    }

    const created: Array<{ sourceRow: number; projectId: number }> = [];
    for (const storedRow of batch.rows as any[]) {
      const { sourceRow, amountFinal, ...body } = storedRow;
      const owner = await tx.sysUser.findFirst({
        where: { id: body.ownerId, isActive: true },
        select: { id: true },
      });
      if (!owner) {
        throw new BadRequestException(
          '第 ' + sourceRow + ' 行负责人已停用或不存在；整批未导入',
        );
      }
      try {
        const project = await this.createWithinTransaction(tx, body, user);
        created.push({ sourceRow, projectId: project.id });
      } catch (error: any) {
        throw new BadRequestException(
          '第 ' + sourceRow + ' 行：' + error.message + '；整批未导入',
        );
      }
    }
    const result = {
      batchId,
      count: created.length,
      items: created,
    };
    await tx.projectImportBatch.update({
      where: { id: batchId },
      data: { status: 'done', result },
    });
    return result;
  }, {
    isolationLevel: 'ReadCommitted',
    maxWait: 5000,
    timeout: 30000,
  });
}
~~~

本代码适用于普通人工 Excel 批量导入。极大文件不宜仅增加事务超时；后续需要按批次分段设计，不在本阶段把部分成功偷偷加入整批回滚语义。

数据库写入仍可能因关联/字段约束失败，整个事务回滚；批次仍为 prepared，可修正条件后重试。同批次已成功的确认不会再次生成项目。

### 7.6 project.controller.ts

新增 import：

~~~ts
import {
  ProjectImportPreviewDto,
  ProjectImportConfirmDto,
} from './dto/project-import.dto';
~~~

两个方法完整替换：

~~~ts
@Post('import-preview')
importPreview(
  @Body() body: ProjectImportPreviewDto,
  @CurrentUser() user: any,
) {
  return this.svc.importPreview(body.rows, user);
}

@Post('import-confirm')
importConfirm(
  @Body() body: ProjectImportConfirmDto,
  @CurrentUser() user: any,
) {
  return this.svc.importConfirm(body.batchId, user);
}
~~~

原本确认接口接收 rows，修改后只接受 batchId；前端必须同步修改。

### 7.7 frontend/src/api/index.ts

替换 projectApi 中对应两项：

~~~ts
importPreview: (rows: Array<{
  sourceRow: number;
  data: Record<string, unknown>;
}>) => request.post('/project/import-preview', { rows }),

importConfirm: (batchId: string) =>
  request.post('/project/import-confirm', { batchId }),
~~~

### 7.8 project/Import.vue 替换 onFile() 和 confirmImport()

~~~ts
async function onFile(file: any) {
  const data = await file.raw.arrayBuffer();
  const XLSX = await import('xlsx');
  const wb = XLSX.read(data, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
  }) as any[][];
  const workbookUses1904 =
    !!wb.Workbook?.WBProps?.date1904;

  const usersResult: any = await sysApi.users();
  const users: any[] = Array.isArray(usersResult)
    ? usersResult : usersResult.items ?? [];
  const byUsername = new Map(
    users.map((user) => [user.username, user.id]),
  );

  const mapped = rows.slice(1).map((row, index) => {
    const object: any = {};
    FIELDS.forEach((field, column) => {
      object[field] = row[column];
    });
    if (typeof object.dateOpen === 'number') {
      const parsed = XLSX.SSF.parse_date_code(
        object.dateOpen,
        { date1904: workbookUses1904 },
      );
      object.dateOpen = parsed
        ? String(parsed.y).padStart(4, '0') + '-' +
          String(parsed.m).padStart(2, '0') + '-' +
          String(parsed.d).padStart(2, '0')
        : '';
    }
    if (object.ownerId &&
        !/^\d+$/.test(String(object.ownerId).trim())) {
      // 只按唯一用户名解析，不按可能重名的姓名猜测。
      object.ownerId =
        byUsername.get(String(object.ownerId).trim()) ??
        object.ownerId;
    }
    return { sourceRow: index + 2, data: object };
  }).filter((item) =>
    Object.values(item.data).some(
      (value) => value !== '' && value != null,
    ),
  );
  preview.value = await projectApi.importPreview(mapped);
}

async function confirmImport() {
  if (!preview.value?.batchId) {
    return ElMessage.warning('没有可导入的有效行');
  }
  const result: any =
    await projectApi.importConfirm(preview.value.batchId);
  ElMessage.success('成功导入 ' + result.count + ' 条');
  preview.value = null;
}
~~~

模板说明改成“负责销售人填用户 ID 或用户名；无效行不会进入本批次；确认时整批成功或整批回滚”。

原“缺失字段”列替换为：

~~~vue
<el-table-column
  label="错误原因"
  :formatter="(row:any) =>
    row.errors.map((error:any) => error.message).join('；')"
/>
~~~

避免用户只看到字段名而不知道是不存在、格式错还是缺失。

## 8. 销售日程：保存与提交分开，旧版本保留

### 8.1 schema.prisma 修改 CrmSalesSchedule

保留现有字段，新增：

~~~prisma
status        String    @default("draft")
version       Int       @default(0)
submittedAt   DateTime?
daySummaries  Json?
revisions     CrmSalesScheduleRevision[]
~~~

新增模型：

~~~prisma
model CrmSalesScheduleRevision {
  id            Int      @id @default(autoincrement())
  scheduleId    Int
  revision      Int
  planText      String?
  summaryText   String?
  leaderComment String?
  daysSnapshot  Json
  submittedAt   DateTime @default(now())

  schedule CrmSalesSchedule @relation(
    fields: [scheduleId],
    references: [id],
    onDelete: Cascade
  )

  @@unique([scheduleId, revision])
}
~~~

第一阶段只有 draft/submitted；提交版本表承担历史保留，不另外引入还没有明确动作的 archived 状态。

### 8.2 sales-schedule.service.ts import

Nest import 增加 ConflictException、NotFoundException。新增：

~~~ts
import { Prisma } from '@prisma/client';
import {
  normalizeWeekStart,
  positiveInt,
} from '../../common/utils/business-values';
~~~

### 8.3 让聚合方法可以使用事务连接

将 aggregateWeek() 声明改成：

~~~ts
private async aggregateWeek(
  ownerId: number,
  weekStart: Date,
  db: Prisma.TransactionClient | PrismaService = this.prisma,
) {
~~~

仅在该方法内部，把两个 this.prisma.crm... 改成 db.crm...。

将 buildDaysArray() 声明和调用改成：

~~~ts
private async buildDaysArray(
  ownerId: number,
  weekStart: Date,
  start: Date,
  db: Prisma.TransactionClient | PrismaService = this.prisma,
): Promise<any[]> {
  const dayCells = await this.aggregateWeek(ownerId, weekStart, db);
~~~

该方法剩余逻辑保留。两种连接兼容性取决于 PrismaService 继承 PrismaClient，当前项目符合这种写法。

### 8.4 替换 getByWeek()

~~~ts
async getByWeek(ownerId: number, weekStart: Date) {
  const normalized = normalizeWeekStart(weekStart);
  const row = await this.prisma.crmSalesSchedule.findUnique({
    where: {
      ownerId_weekStart: { ownerId, weekStart: normalized },
    },
  });
  const { start, end } = this.weekRange(normalized);
  const storedSnapshot = row?.daysSnapshot;
  let days: any[];

  if (row?.status === 'submitted') {
    if (!Array.isArray(storedSnapshot)) {
      throw new BadRequestException('已提交日程缺少快照，需要修复该记录');
    }
    days = storedSnapshot as any[];
  } else {
    days = await this.buildDaysArray(ownerId, normalized, start);
    const summaries = row?.daySummaries;
    const byDate = summaries &&
      typeof summaries === 'object' &&
      !Array.isArray(summaries)
      ? summaries as Record<string, any>
      : {};
    days = days.map((day) => ({
      ...day,
      daySummary: typeof byDate[day.date] === 'string'
        ? byDate[day.date] : '',
    }));
  }
  return {
    id: row?.id ?? null,
    ownerId,
    weekStart: start,
    weekEnd: end,
    status: row?.status ?? 'draft',
    version: row?.version ?? 0,
    submittedAt: row?.submittedAt ?? null,
    planText: row?.planText ?? '',
    summaryText: row?.summaryText ?? '',
    leaderComment: row?.leaderComment ?? '',
    days,
  };
}
~~~

### 8.5 新增规范化请求与行锁方法

~~~ts
private readScheduleInput(body: any) {
  const ownerId = positiveInt(body.ownerId, '日程人员');
  const weekStart = normalizeWeekStart(body.weekStart);
  const version = Number(body.version);
  if (!Number.isSafeInteger(version) || version < 0) {
    throw new BadRequestException('必须提交读取时的日程版本号');
  }
  const data: any = {};
  for (const field of ['planText', 'summaryText', 'leaderComment']) {
    if (body[field] !== undefined) {
      if (body[field] !== null && typeof body[field] !== 'string') {
        throw new BadRequestException(field + '必须是文本');
      }
      data[field] = body[field];
    }
  }
  if (body.days !== undefined) {
    if (!Array.isArray(body.days)) {
      throw new BadRequestException('days 必须是数组');
    }
    const summaries: Record<string, string> = {};
    const validDates = new Set<string>();
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setUTCDate(date.getUTCDate() + i);
      validDates.add(date.toISOString().slice(0, 10));
    }
    for (const day of body.days) {
      if (!day || !validDates.has(day.date) ||
          typeof day.daySummary !== 'string') {
        throw new BadRequestException('当日总结日期或内容不合法');
      }
      if (Object.prototype.hasOwnProperty.call(summaries, day.date)) {
        throw new BadRequestException('当日总结日期重复');
      }
      summaries[day.date] = day.daySummary;
    }
    if (Object.keys(summaries).length !== 7) {
      throw new BadRequestException('保存当日总结须包含本周七天');
    }
    data.daySummaries = summaries;
  }
  return { ownerId, weekStart, version, data };
}

private async lockSchedule(
  tx: Prisma.TransactionClient,
  ownerId: number,
  weekStart: Date,
) {
  const created = await tx.crmSalesSchedule.upsert({
    where: { ownerId_weekStart: { ownerId, weekStart } },
    create: { ownerId, weekStart },
    update: {},
  });
  await tx.$queryRaw`
    SELECT id FROM "CrmSalesSchedule"
    WHERE id = ${created.id}
    FOR UPDATE
  `;
  return tx.crmSalesSchedule.findUniqueOrThrow({
    where: { id: created.id },
  });
}
~~~

这里 version 必须由前端读取后返回；不能固定写 0。行锁防止同周写入交叉，版本号防止旧页面覆盖后来保存的内容。

### 8.6 替换 upsert()；新增 submit() 和 reopen()

~~~ts
async upsert(body: any) {
  const input = this.readScheduleInput(body);
  return this.prisma.$transaction(async (tx) => {
    const row = await this.lockSchedule(
      tx, input.ownerId, input.weekStart,
    );
    if (row.version !== input.version) {
      throw new ConflictException('日程已被修改，请重新读取后保存');
    }
    if (row.status !== 'draft') {
      throw new BadRequestException('已提交日程请先重新打开草稿');
    }
    return tx.crmSalesSchedule.update({
      where: { id: row.id },
      data: { ...input.data, version: { increment: 1 } },
    });
  });
}

async submit(body: any) {
  const input = this.readScheduleInput(body);
  return this.prisma.$transaction(async (tx) => {
    const row = await this.lockSchedule(
      tx, input.ownerId, input.weekStart,
    );
    if (row.version !== input.version) {
      throw new ConflictException('日程已被修改，请重新读取后提交');
    }
    if (row.status !== 'draft') {
      throw new BadRequestException('本周日程已经提交');
    }
    const merged: any = { ...row, ...input.data };
    const { start } = this.weekRange(input.weekStart);
    const days = await this.buildDaysArray(
      input.ownerId, input.weekStart, start, tx,
    );
    const summaries = merged.daySummaries ?? {};
    const snapshot = days.map((day) => ({
      ...day,
      daySummary: summaries[day.date] ?? '',
    }));
    const version = row.version + 1;
    const submittedAt = new Date();
    await tx.crmSalesScheduleRevision.create({
      data: {
        scheduleId: row.id,
        revision: version,
        planText: merged.planText,
        summaryText: merged.summaryText,
        leaderComment: merged.leaderComment,
        daysSnapshot: snapshot,
        submittedAt,
      },
    });
    return tx.crmSalesSchedule.update({
      where: { id: row.id },
      data: {
        ...input.data,
        status: 'submitted',
        version,
        submittedAt,
        daysSnapshot: snapshot,
      },
    });
  }, { isolationLevel: 'RepeatableRead' });
}

async reopen(body: any) {
  const input = this.readScheduleInput(body);
  return this.prisma.$transaction(async (tx) => {
    const row = await this.lockSchedule(
      tx, input.ownerId, input.weekStart,
    );
    if (row.version !== input.version) {
      throw new ConflictException('日程已被修改，请重新读取');
    }
    if (row.status !== 'submitted') {
      throw new BadRequestException('仅已提交日程可以重新打开');
    }
    return tx.crmSalesSchedule.update({
      where: { id: row.id },
      data: {
        status: 'draft',
        version: { increment: 1 },
      },
    });
  });
}

async revisions(ownerId: number, weekStart: Date) {
  const row = await this.prisma.crmSalesSchedule.findUnique({
    where: {
      ownerId_weekStart: {
        ownerId,
        weekStart: normalizeWeekStart(weekStart),
      },
    },
    select: { id: true },
  });
  if (!row) return [];
  return this.prisma.crmSalesScheduleRevision.findMany({
    where: { scheduleId: row.id },
    orderBy: { revision: 'desc' },
  });
}
~~~

重新打开只改变状态，不删除旧 daysSnapshot 和 revision。草稿读取实时数据；再次提交会生成新版本。

在 aggregateWeek 的两个 pushCell 对象中分别增加：

~~~ts
followId: f.id,
~~~

快照保留来源记录 ID，后续修订时能准确定位。不用当前项目名称替换已保存版本中的项目名称。

### 8.7 sales-schedule.controller.ts

Nest import 增加 Post。新增公共工具 import：

~~~ts
import { normalizeWeekStart } from '../../common/utils/business-values';
~~~

文件内所有：

~~~ts
const ws = new Date(weekStart + 'T00:00:00.000Z');
~~~

替换为：

~~~ts
const ws = normalizeWeekStart(weekStart);
~~~

类内增加：

~~~ts
private withOwner(body: any, user: any) {
  return {
    ...body,
    ownerId: user?.isAdmin && body.ownerId
      ? Number(body.ownerId) : user.id,
  };
}

@Post('submit')
submit(@Body() body: any, @CurrentUser() user: any) {
  return this.svc.submit(this.withOwner(body, user));
}

@Post('reopen')
reopen(@Body() body: any, @CurrentUser() user: any) {
  return this.svc.reopen(this.withOwner(body, user));
}

@Get('revisions')
revisions(
  @Query('weekStart') weekStart: string,
  @Query('ownerId') queryOwnerId: string,
  @CurrentUser() user: any,
) {
  const ownerId = user?.isAdmin && queryOwnerId
    ? Number(queryOwnerId) : user.id;
  return this.svc.revisions(
    ownerId,
    normalizeWeekStart(weekStart),
  );
}
~~~

现有 upsert() 的人员选择逻辑保留，或改成：

~~~ts
@Put()
upsert(@Body() body: any, @CurrentUser() user: any) {
  return this.svc.upsert(this.withOwner(body, user));
}
~~~

### 8.8 前端 api/index.ts 的 salesScheduleApi 增加

~~~ts
submit: (data: any) => request.post('/sales-schedule/submit', data),
reopen: (data: any) => request.post('/sales-schedule/reopen', data),
revisions: (weekStart: string, ownerId?: number) =>
  request.get('/sales-schedule/revisions', {
    params: { weekStart, ownerId },
  }),
~~~

### 8.9 前端 sales-schedule/Index.vue

form 声明增加：

~~~ts
status: 'draft' as 'draft' | 'submitted',
version: 0,
~~~

fetchOne() 在设置 form.id 后增加：

~~~ts
form.status = data.status;
form.version = data.version;
~~~

resetForm() 增加：

~~~ts
form.status = 'draft';
form.version = 0;
~~~

类内新增请求构建和两个动作：

~~~ts
function schedulePayload() {
  return {
    ownerId: canViewOwnerFilter.value ? q.ownerId : undefined,
    weekStart: q.startDate,
    version: form.version,
    planText: form.planText,
    summaryText: form.summaryText,
    leaderComment: form.leaderComment,
    days: form.days.map((day) => ({
      date: day.date,
      daySummary: day.daySummary,
    })),
  };
}

async function onSubmit() {
  if (!q.startDate) return;
  await salesScheduleApi.submit(schedulePayload());
  ElMessage.success('已提交，本周跟进已冻结');
  await fetchOne();
}

async function onReopen() {
  if (!q.startDate) return;
  await salesScheduleApi.reopen({
    ownerId: canViewOwnerFilter.value ? q.ownerId : undefined,
    weekStart: q.startDate,
    version: form.version,
  });
  ElMessage.success('已重新打开，原提交版本仍保留');
  await fetchOne();
}
~~~

onSave() 中原 salesScheduleApi.save({...}) 替换为：

~~~ts
await salesScheduleApi.save(schedulePayload());
~~~

顶部保存按钮替换为：

~~~vue
<el-button
  v-if="form.status === 'draft'"
  type="success"
  @click="onSave"
>保存草稿</el-button>
<el-button
  v-if="form.status === 'draft'"
  type="primary"
  @click="onSubmit"
>提交并冻结</el-button>
<el-button
  v-else
  @click="onReopen"
>重新打开草稿</el-button>
~~~

三个顶部文本框和当日总结 textarea 增加：

~~~vue
:readonly="form.status === 'submitted'"
~~~

这是配合业务状态的输入控制。后端同样执行状态规则，不能仅靠表单只读。

现有历史版本读取通过 revisions 接口完成；第一阶段无须另建整页历史浏览器，也不要删除版本记录。

### 8.10 非销售日程周键同步

weekly-schedule.controller.ts 增加 normalizeWeekStart import，替换全部 new Date(weekStart + ...) 为 normalizeWeekStart(weekStart)。

weekly-schedule.service.ts 增加该 import；upsert() 中把 weekStart 解析替换成：

~~~ts
const weekStart = normalizeWeekStart(body.weekStart);
~~~

getByWeek() 与 exportToBuffer() 开头增加：

~~~ts
weekStart = normalizeWeekStart(weekStart);
~~~

本阶段非销售 days JSON 保持原结构，额外要求 days 如果提供则为七项数组，每项 date 唯一且属于当前周。可以在 upsert() 构建 data 前加入：

~~~ts
if (body.days !== undefined) {
  if (!Array.isArray(body.days) || body.days.length !== 7) {
    throw new BadRequestException('days 必须包含本周七天');
  }
  const expected = new Set(this.defaultDays(weekStart).map(
    (day) => day.date,
  ));
  const dates = body.days.map((day: any) => day?.date);
  if (new Set(dates).size !== 7 ||
      dates.some((date: string) => !expected.has(date))) {
    throw new BadRequestException('days 日期重复或不属于本周');
  }
}
~~~

upsert() 原 data 使用 ?? null，会把未提交字段清空。改成显式选取已提交字段：

~~~ts
const data: any = {};
for (const field of [
  'planText', 'summaryText', 'leaderComment', 'days',
]) {
  if (body[field] !== undefined) data[field] = body[field];
}
~~~

## 8.11 统一数据库变更文件

新增：
backend/prisma/migrations/202610140001_business_consistency/migration.sql

全部内容：

~~~sql
CREATE INDEX IF NOT EXISTS "CrmProjectFollow_projectId_followDate_idx"
ON "CrmProjectFollow" ("projectId", "followDate" DESC);

UPDATE "CrmOpportunity" AS p
SET "lastFollowDate" = (
  SELECT MAX(f."followDate")
  FROM "CrmProjectFollow" AS f
  WHERE f."projectId" = p.id
);

CREATE TABLE "ProjectImportBatch" (
  "id" TEXT NOT NULL,
  "createdById" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'prepared',
  "rows" JSONB NOT NULL,
  "result" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProjectImportBatch_createdById_createdAt_idx"
ON "ProjectImportBatch" ("createdById", "createdAt");

ALTER TABLE "CrmSalesSchedule"
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'draft',
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "submittedAt" TIMESTAMP(3),
ADD COLUMN "daySummaries" JSONB;

CREATE TABLE "CrmSalesScheduleRevision" (
  "id" SERIAL NOT NULL,
  "scheduleId" INTEGER NOT NULL,
  "revision" INTEGER NOT NULL,
  "planText" TEXT,
  "summaryText" TEXT,
  "leaderComment" TEXT,
  "daysSnapshot" JSONB NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmSalesScheduleRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CrmSalesScheduleRevision_scheduleId_fkey"
    FOREIGN KEY ("scheduleId")
    REFERENCES "CrmSalesSchedule"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CrmSalesScheduleRevision_scheduleId_revision_key"
ON "CrmSalesScheduleRevision" ("scheduleId", "revision");

-- 旧快照完整保留，不因改成草稿实时聚合而丢失。
UPDATE "CrmSalesSchedule"
SET "status" = 'submitted',
    "version" = 1,
    "submittedAt" = "updatedAt"
WHERE jsonb_typeof("daysSnapshot") = 'array';

INSERT INTO "CrmSalesScheduleRevision" (
  "scheduleId", "revision", "planText", "summaryText",
  "leaderComment", "daysSnapshot", "submittedAt"
)
SELECT id, 1, "planText", "summaryText",
       "leaderComment", "daysSnapshot", "submittedAt"
FROM "CrmSalesSchedule"
WHERE "status" = 'submitted';

UPDATE "CrmSalesSchedule" AS s
SET "daySummaries" = (
  SELECT COALESCE(
    jsonb_object_agg(day->>'date', COALESCE(day->>'daySummary', '')),
    '{}'::jsonb
  )
  FROM jsonb_array_elements(s."daysSnapshot") AS day
  WHERE day ? 'date' AND day->>'date' IS NOT NULL
)
WHERE jsonb_typeof(s."daysSnapshot") = 'array';
~~~

schema.prisma 中 Revision 三个文本字段使用 String? 时默认 TEXT，与 SQL 一致。

**顺序：** 先完成 schema.prisma 和迁移文件，再在你的开发数据库应用结构变更并重新生成 Prisma Client；随后使用新 Service 代码。不应使用旧客户端编译新模型方法。

~~~bash
cd backend
npx prisma migrate dev
npx prisma generate
~~~

上述命令是你实施修改时执行；本次文档编写没有连接或修改数据库。

不在本次迁移中统一改写旧 weekStart。应先查找同一人员、同一自然周多条记录，并合并后再统一周键。若已存在非周一旧记录，normalizeWeekStart 将无法直接命中它，需要先完成下面的数据检查：

~~~sql
SELECT "ownerId",
       date_trunc('week', "weekStart") AS normalized_week,
       count(*)
FROM "CrmSalesSchedule"
GROUP BY "ownerId", date_trunc('week', "weekStart")
HAVING count(*) > 1;

SELECT "ownerId",
       date_trunc('week', "weekStart") AS normalized_week,
       count(*)
FROM "CrmWeeklySchedule"
GROUP BY "ownerId", date_trunc('week', "weekStart")
HAVING count(*) > 1;
~~~

如果没有重叠，并确认旧字段确实是 UTC 零点日期编码，可以另行统一为 date_trunc('week', "weekStart")。若有重叠不能自动丢弃某行，先保留各行内容及旧快照后合并。


## 9. 分页、编号与接口类型

### 9.1 新增 pagination-query.dto.ts

路径：backend/src/common/dto/pagination-query.dto.ts

~~~ts
import { BadRequestException } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  pageSize?: number;
}

export function parsePagination(
  q: { page?: unknown; pageSize?: unknown },
  defaultSize: number,
) {
  const page = q.page === undefined || q.page === ''
    ? 1 : Number(q.page);
  const pageSize = q.pageSize === undefined || q.pageSize === ''
    ? defaultSize : Number(q.pageSize);
  if (!Number.isSafeInteger(page) || page < 1 ||
      !Number.isSafeInteger(pageSize) ||
      pageSize < 1 || pageSize > 1000) {
    throw new BadRequestException('分页参数必须是有效正整数');
  }
  const skip = (page - 1) * pageSize;
  if (!Number.isSafeInteger(skip)) {
    throw new BadRequestException('页码过大');
  }
  return { page, pageSize, skip };
}
~~~

### 9.2 四个 Service 分页替换

customer、project、quotation、contract 的 Service 都增加：

~~~ts
import { parsePagination } from '../../common/dto/pagination-query.dto';
~~~

list() 中原两句 page、pageSize 定义替换：

客户、项目：

~~~ts
const { page, pageSize, skip } = parsePagination(q, 10);
~~~

报价、合同：

~~~ts
const { page, pageSize, skip } = parsePagination(q, 20);
~~~

查询中的：

~~~ts
skip: (page - 1) * pageSize,
~~~

替换为：

~~~ts
skip,
~~~

客户和项目的 findMany 中：

~~~ts
orderBy,
~~~

替换为：

~~~ts
orderBy: [orderBy, { id: 'desc' }],
~~~

报价、合同的 orderBy 替换为：

~~~ts
orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
~~~

稳定排序只保证相同排序值的先后确定；持续新增、更新造成的跨页移动仍可能发生。第一阶段不更换页面为游标分页。

### 9.3 list DTO 接入

四个 Controller 增加：

~~~ts
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
~~~

仅将 list() 的：

~~~ts
@Query() q: any
~~~

替换成：

~~~ts
@Query() q: PaginationQueryDto
~~~

各 Service 的 q 暂时保持现有类型，避免把原有筛选字段一次全部丢掉。当前全局 ValidationPipe 的 whitelist=false 保持原值；额外 keyword 等筛选字段继续传入。

新接口如导入已经采用专门 DTO。对大型客户表单，第一阶段使用显式提交映射加字段解析，后续才能按实际可编辑字段补齐完整 DTO；不要全局打开 whitelist 然后把未声明的老表单字段静默丢弃。

### 9.4 新增 number-code.ts

路径：backend/src/common/utils/number-code.ts

~~~ts
import { PrismaClient } from '@prisma/client';
import { businessToday } from './business-values';

const TYPES = {
  customer: { prefix: 'KH', sequence: 'public.customer_code_seq' },
  project: { prefix: 'XM', sequence: 'public.project_code_seq' },
  quotation: { prefix: 'BJ', sequence: 'public.quotation_code_seq' },
  contract: { prefix: 'HT', sequence: 'public.contract_code_seq' },
} as const;

export async function allocateCode(
  db: Pick<PrismaClient, '$queryRaw'>,
  type: keyof typeof TYPES,
): Promise<string> {
  const config = TYPES[type];
  const date = businessToday().replace(/-/g, '');
  const rows = await db.$queryRaw<Array<{ nextval: bigint }>>`
    SELECT nextval(${config.sequence}::regclass) AS nextval
  `;
  if (!rows.length) {
    throw new Error('编号序列未返回值');
  }
  return config.prefix + date +
    rows[0].nextval.toString().padStart(4, '0');
}
~~~

这里传入的序列名称来自固定映射；不是从请求选择任意表。日期固定上海业务日，避免运行进程时区变化导致编号日期变化。

四个 Service 增加：

~~~ts
import { allocateCode } from '../../common/utils/number-code';
~~~

各自 nextCode() 完整替换：

~~~ts
// CustomerService
async nextCode() {
  return allocateCode(this.prisma, 'customer');
}
~~~

~~~ts
// ProjectService
async nextCode() {
  return allocateCode(this.prisma, 'project');
}
~~~

~~~ts
// QuotationService
async nextCode() {
  return allocateCode(this.prisma, 'quotation');
}
~~~

~~~ts
// ContractService
async nextCode() {
  return allocateCode(this.prisma, 'contract');
}
~~~

移除 catch 中 findFirst 再加一的回退，避免序列错误时重新引入重复编号。

本阶段保留四个 next-code API 以免其他现有消费者立刻断裂；第 10 节移除四个表单的预分配调用。API 被调用仍会消耗序列，不属于纯预览接口。

### 9.5 搜索候选数量

CustomerService.search() 与 ProjectService.searchCustomer() 的 findMany 参数中增加：

~~~ts
take: 50,
~~~

仅返回候选字段和前 50 项。前端需要提示“可继续输入更精确关键词”，而不是把候选 50 项解释成全部客户。

如果已有功能明确需要全量客户（如数据导入映射），它应使用批量编号查询，不复用这个候选接口。

## 10. 前端显式提交映射与业务日期

### 10.1 新增 frontend/src/utils/business-date.ts

~~~ts
export function businessToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = (type: string) =>
    parts.find((part) => part.type === type)!.value;
  return value('year') + '-' + value('month') + '-' + value('day');
}

export function encodeDate(text: string): Date {
  const date = new Date(text.slice(0, 10) + 'T00:00:00.000Z');
  if (Number.isNaN(date.getTime())) {
    throw new Error('无效业务日期');
  }
  return date;
}

export function dateText(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function monday(text = businessToday()): string {
  const date = encodeDate(text);
  const offset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - offset);
  return dateText(date);
}

export function addBusinessDays(text: string, days: number): string {
  const date = encodeDate(text);
  date.setUTCDate(date.getUTCDate() + days);
  return dateText(date);
}
~~~

纯日期文本按 UTC 零点编码仅用于日历加减，真实时间戳的“今天”通过指定业务时区生成；不要混用本地 getDate 与 UTC getter。

### 10.2 新增 frontend/src/utils/form-payload.ts

~~~ts
type Model = 'customer' | 'project' | 'quotation' | 'contract';

const FIELDS: Record<Model, string[]> = {
  customer: [
    'code', 'name', 'pinyin', 'shortName', 'type', 'category',
    'followStage', 'source', 'industry', 'scale', 'valueRating',
    'creditLevel', 'currencyCode', 'paymentLimitPct', 'address',
    'zipcode', 'legalPerson', 'registeredCapital', 'park',
    'phone', 'fax', 'email', 'website', 'stateId', 'cityId',
    'districtId', 'region', 'intro', 'cooperationStatus',
    'prospect', 'strategy', 'taxId', 'invoiceTitle',
    'invoiceBank', 'invoiceBankAccount', 'bankName',
    'accountName', 'bankCode', 'bankAccount', 'bankAddress',
    'bankPhone', 'paymentDays', 'settleDay', 'settleContact',
    'ownerId', 'deptId', 'sharedUserIds', 'attachments', 'remark',
  ],
  project: [
    'code', 'name', 'customerCode', 'customerId', 'contactIds',
    'dateOpen', 'region', 'stateId', 'cityId', 'districtId',
    'ownerId', 'deptId', 'currencyCode', 'expectedRevenue',
    'discountPct', 'category', 'stage', 'source', 'state',
    'plannedCost', 'projectDate', 'contractId', 'submitStatus',
    'description', 'attachments', 'expectedDate',
  ],
  quotation: [
    'code', 'title', 'date', 'customerName', 'contactName',
    'sort1', 'currencyCode', 'discountType', 'discountValue',
    'opportunityId', 'opportunityCode', 'linkCustomerName',
    'linkContactName', 'validDate', 'intro',
    'intro1', 'intro2', 'intro3', 'intro4', 'intro5', 'intro6',
    'approvalState',
  ],
  contract: [
    'code', 'title', 'customerName', 'signDate', 'startDate',
    'endDate', 'person1Name', 'person2Name', 'ownerName', 'sort',
    'completeState', 'currencyCode', 'discountValue', 'plan',
    'invoicePlan', 'paybackMode', 'invoiceMode', 'paybackDays',
    'opportunityCode', 'linkCustomer', 'linkContact',
    'signPlace', 'brand', 'intro', 'intro1', 'intro2', 'intro3',
    'intro4', 'intro5', 'intro6', 'approvalState',
    'quotationId', 'sharedUserIds',
  ],
};

const NULLABLE: Record<Model, string[]> = {
  customer: [
    'stateId', 'cityId', 'districtId', 'registeredCapital',
    'paymentLimitPct', 'paymentDays', 'settleDay', 'ownerId', 'deptId',
  ],
  project: [
    'customerId', 'stateId', 'cityId', 'districtId', 'contractId',
    'projectDate', 'expectedDate', 'expectedRevenue',
    'discountPct', 'plannedCost',
  ],
  quotation: ['validDate', 'opportunityId', 'discountValue'],
  contract: [
    'startDate', 'endDate', 'quotationId', 'paybackDays', 'discountValue',
  ],
};

function select(source: any, fields: string[]) {
  const result: Record<string, any> = {};
  for (const field of fields) {
    if (source[field] !== undefined) result[field] = source[field];
  }
  return result;
}

function emptyToNull(value: any) {
  return value === '' || value === null ? null : value;
}

export function buildFormPayload(model: Model, form: any) {
  const result = select(form, FIELDS[model]);
  if (!result.code) delete result.code;
  for (const field of NULLABLE[model]) {
    if (result[field] !== undefined) {
      result[field] = emptyToNull(result[field]);
    }
  }

  if (model === 'customer' && form.contacts !== undefined) {
    result.contacts = form.contacts.map((contact: any, sort: number) => ({
      ...select(contact, [
        'id', 'name', 'gender', 'department', 'position',
        'officePhone', 'fax', 'mobile', 'wechat', 'email',
        'isPrimary', 'remark',
      ]),
      sort,
    }));
  }

  if (model === 'project' && form.items !== undefined) {
    result.items = form.items.map((item: any, sort: number) => ({
      ...select(item, [
        'productName', 'productCode', 'model',
        'unitPrice', 'quantity', 'amount',
      ]),
      sort,
    }));
  }

  if ((model === 'quotation' || model === 'contract') &&
      form.lines !== undefined) {
    result.lines = form.lines.map((line: any, sort: number) => {
      const row = select(line, [
        'productName', 'quantity', 'unitPrice', 'discount',
        'taxRate', 'invoiceType', 'pricejy', 'concessions',
        'moneyAfterConcessions', 'validDate', 'intro',
        'zdy1', 'zdy2', 'zdy3', 'zdy4', 'zdy5', 'zdy6',
      ]);
      if (model === 'contract') {
        delete row.validDate;
        row.deliveryDate = emptyToNull(line.deliveryDate);
        row.deliveryMode = line.deliveryMode ?? null;
        row.zdy2435 = line.zdy2435 ?? null;
      }
      for (const field of ['discount', 'taxRate']) {
        if (row[field] === '' || row[field] == null) row[field] = '0';
      }
      row.sort = sort;
      return row;
    });
  }

  if (model === 'contract' && form.paymentPlans !== undefined) {
    result.paymentPlans = form.paymentPlans.map(
      (plan: any, index: number) => ({
        ...select(plan, ['id', 'planDate', 'amount', 'remark']),
        seq: index + 1,
      }),
    );
  }
  return result;
}
~~~

本函数只排除数据库系统字段和后端计算的派生字段，不改变当前联系人名称快照、附件 JSON 或跟进编辑器的数据结构。

当前 Customer 模型没有 submitStatus 字段，现有表单提交该值会被 scrub 丢弃。本文不凭空增加一个未定义的客户状态流程，所以客户映射没有提交该字段。这是原项目已有的接口/模型不一致：若业务确实需要客户草稿/确认，应另行定义状态列和旧数据语义，不能把本手册的客户数据修复误认为同时完成了客户状态功能。

### 10.3 四份 Form.vue 增加 import

~~~ts
import { buildFormPayload } from '@/utils/form-payload';
import { businessToday } from '@/utils/business-date';
~~~

修改 save() 的原 const payload 句：

| 文件 | 替换代码 |
| --- | --- |
| customer/Form.vue | const payload: any = buildFormPayload('customer', form); |
| project/Form.vue | const payload: any = buildFormPayload('project', form); |
| quotation/Form.vue | const payload: any = buildFormPayload('quotation', form); |
| contract/Form.vue | const payload: any = buildFormPayload('contract', form); |

删除其后“使用 codePlaceholder 给 payload.code 赋值”的 if 整句。

onMounted() 中删除以下四种调用：

~~~ts
codePlaceholder.value = (await customerApi.nextCode()) || '';
codePlaceholder.value = (await projectApi.nextCode()) || '';
codePlaceholder.value = (await quotationApi.nextCode()) || '';
codePlaceholder.value = (await contractApi.nextCode()) || '';
~~~

保留 codePlaceholder 变量及模板绑定，初始值改为：

~~~ts
const codePlaceholder = ref('保存后自动生成');
~~~

用户可以继续填自定义编号；编号已存在时仍由数据库唯一约束反馈。编辑时后端不改变正式编号。

### 10.4 默认日期

quotation blank()：

~~~ts
date: businessToday(),
~~~

contract blank()：

~~~ts
signDate: businessToday(),
~~~

project 如希望默认发现日期为今天，则将 dateOpen: '' 改为：

~~~ts
dateOpen: businessToday(),
~~~

如果原流程要求用户手选发现日期，保留空值和必填校验；两者都不能用 UTC toISOString() 推断上海当天。

### 10.5 加载详情后裁剪日期字符串

quotation loadDetail() 的 Object.assign 后增加：

~~~ts
form.date = d.date?.slice(0, 10) ?? '';
~~~

contract loadDetail() 的 Object.assign 后增加：

~~~ts
form.signDate = d.signDate?.slice(0, 10) ?? '';
form.startDate = d.startDate?.slice(0, 10) ?? '';
form.endDate = d.endDate?.slice(0, 10) ?? '';
~~~

project loadDetail() 后对应：

~~~ts
form.dateOpen = d.dateOpen?.slice(0, 10) ?? '';
form.projectDate = d.projectDate?.slice(0, 10) ?? '';
~~~

付款计划日期按第 4.10 节处理；合同明细 deliveryDate 在 loadDetail 的 map 中转换为 YYYY-MM-DD。

### 10.6 项目折扣预览修复

project/Form.vue 的 calcFinal() 完整替换：

~~~ts
function calcFinal() {
  const revenue = Number(form.expectedRevenue);
  const discount = form.discountPct === '' ||
    form.discountPct == null
    ? 10 : Number(form.discountPct);
  if (!Number.isFinite(revenue) || !Number.isFinite(discount)) {
    form.amountFinal = '';
    return;
  }
  form.amountFinal = Math.round(revenue * discount / 10 * 100) / 100;
}
~~~

原 parseFloat(form.discountPct) || 10 会把合法的零折扣改成 10 折，本次明确区分空值和 0。正式金额以后端 Decimal 结果为准。

### 10.7 切换客户清空旧联系人

project/Form.vue 的 onCustomerPick(code) 中，在找到 c 后，设置客户 ID 前增加：

~~~ts
if (form.customerId !== c.id) {
  (form as any).contactIds = [];
}
~~~

clearCustomer() 中增加：

~~~ts
(form as any).contactIds = [];
~~~

项目 blank() 增加：

~~~ts
contactIds: [] as number[],
~~~

这里仅修复项目关系字段。现有跟进联系人按姓名保存历史快照，继续使用其 contactNames，不把“项目关系 ID”与“跟进文本快照”混成同一个字段。

### 10.8 日程页面统一日期加减

sales-schedule/Index.vue 新增：

~~~ts
import {
  businessToday,
  monday,
  encodeDate,
} from '@/utils/business-date';
~~~

现有 fmtDate、startOfWeek、addDays 三个函数替换：

~~~ts
function fmtDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfWeek(date: Date): Date {
  return encodeDate(monday(businessToday(date)));
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}
~~~

该文件对 q.startDate/q.endDate 转换后的 Date，所有 getFullYear/getMonth/getDate/getDay 改成对应 getUTCFullYear/getUTCMonth/getUTCDate/getUTCDay。日期选择器 disabledStartDate/disabledEndDate 接收浏览器本地 Date，应保留其 getDay，不批量替换这些回调。

watch、shiftWeek 和默认周使用上述统一加减。resetForm() 没有 q.startDate 时调用 startOfWeek(new Date())，会按上海今天计算周一。

stats/sales/Index.vue 增加 import：

~~~ts
import { businessToday, monday } from '@/utils/business-date';
~~~

替换 weekStartISO 和 todayISO：

~~~ts
function weekStartISO(date: Date = new Date()): string {
  return monday(businessToday(date));
}

function todayISO(date: Date = new Date()): string {
  return businessToday(date);
}
~~~

fmtLocalDate 无调用后删除，不再混用浏览器本地时区。

## 11. 实施后必须理解的行为变化

本节是业务结果对照，不是另一个改造范围。

| 场景 | 修改后的结果 |
| --- | --- |
| 修改联系人电话 | 联系人 ID 保持不变 |
| 删除项目正在引用的联系人 | 返回明确错误，先解除关联 |
| 清空合同结束日期 | 写入 null |
| 只改项目折扣 | 使用数据库现有收入重新计算 |
| 补录较早跟进 | 最后跟进日期不倒退 |
| 删除最近跟进 | 最后跟进日期变成剩余记录最大值 |
| 报价明细更新失败 | 原主表和明细一起保留 |
| 普通编辑合同付款计划 | 已收款计划的 ID 与收款状态保留 |
| 预览 Excel | 不分配项目正式编号 |
| 确认 Excel 中某行失败 | 整批回滚 |
| 已完成批次重复确认 | 返回原项目结果，不再次创建 |
| 周一保存日程计划 | 后续跟进继续实时显示 |
| 提交日程 | 当时跟进冻结成版本 |
| 重新打开日程 | 草稿实时显示，旧提交版本仍在 |
| 筛选单个人员统计 | 总计与该人员明细同口径 |
| 转交客户 | 创建贡献不变，持有量改变 |
| 编辑或查看表单 | 不再消耗编号 |
| 普通文本写成日期样式 | 不被改写成时间字符串 |

## 12. 实施前的编译与数据边界说明

这份手册的代码依据固定版本源码核对。文档编写环境没有项目依赖和真实业务数据库，因此没有声称全部片段已在你的数据库完成编译和执行。

在你按本文完成修改后，应重新生成 Prisma Client，并执行项目现有编译命令：

~~~bash
cd backend
npx prisma generate
npm run build
~~~

前端：

~~~bash
cd frontend
npx vue-tsc --noEmit
npm run build
~~~

这里仅检查代码与类型是否能编译，没有添加测试或其他被排除范围。

特别注意：

1. 实际代码不是 e898e1c 时，不应机械按行号覆盖，应按方法声明和原代码锚点比对。
2. 日程旧 weekStart 如非标准周一，先处理重叠记录，再统一键。
3. 历史联系人 ID 已丢失的数据不能通过本文自动复原。
4. 本文没有自动重算已确认历史金额。
5. 旧创建人缺失保持未知，不能用当前负责人猜测。
6. 第 4 节新增合同批准时付款计划金额校验。现有表单允许零计划直接提交，修改后需要填写完整付款计划或先存草稿。这是本文选择的业务规则。
7. 旧 pricejy、concessions、moneyAfterConcessions 等字段仍保留兼容数据；没有确认含义前不将它们加入新的金额公式。
8. 第 7、8 节模型变更、客户端生成与调用代码必须同时完成，不能只粘贴 Service。
9. 本次客户状态未被重新定义；现有客户 submitStatus 问题不能靠字段清洗修复。


## 附录 A. 第二阶段：项目联系人关系表

本附录在第一阶段完成后实施。第一阶段已保留联系人 ID，本附录进一步通过外键保证引用存在。

### A.1 schema.prisma 新增模型及反向字段

~~~prisma
model CrmProjectContact {
  projectId Int
  contactId Int
  sort      Int @default(0)

  project CrmOpportunity @relation(
    fields: [projectId], references: [id], onDelete: Cascade
  )
  contact CrmContact @relation(
    fields: [contactId], references: [id], onDelete: Restrict
  )

  @@id([projectId, contactId])
  @@index([contactId])
}
~~~

CrmOpportunity 增加：

~~~prisma
projectContacts CrmProjectContact[]
~~~

CrmContact 增加：

~~~prisma
projectLinks CrmProjectContact[]
~~~

**暂时保留 contactIds Int[]。** 第二阶段采用事务内双写，保留旧接口兼容；不在这一阶段直接删除数组，否则需要同时改写所有读取、筛选和旧数据工具。

### A.2 新增关系表迁移

路径：
backend/prisma/migrations/202610140002_project_contacts/migration.sql

~~~sql
CREATE TABLE "CrmProjectContact" (
  "projectId" INTEGER NOT NULL,
  "contactId" INTEGER NOT NULL,
  "sort" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "CrmProjectContact_pkey"
    PRIMARY KEY ("projectId", "contactId"),
  CONSTRAINT "CrmProjectContact_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "CrmOpportunity"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CrmProjectContact_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "CrmProjectContact_contactId_idx"
ON "CrmProjectContact" ("contactId");

INSERT INTO "CrmProjectContact" ("projectId", "contactId", "sort")
SELECT p.id, c.id, MIN(ids.position)::integer - 1
FROM "CrmOpportunity" AS p
CROSS JOIN LATERAL
  unnest(p."contactIds") WITH ORDINALITY AS ids("contactId", position)
JOIN "CrmContact" AS c
  ON c.id = ids."contactId" AND c."customerId" = p."customerId"
GROUP BY p.id, c.id;
~~~

以下查询只读，列出不能迁移的 ID：

~~~sql
SELECT p.id AS "projectId", ids."contactId", p."customerId"
FROM "CrmOpportunity" AS p
CROSS JOIN LATERAL unnest(p."contactIds") AS ids("contactId")
LEFT JOIN "CrmContact" AS c
  ON c.id = ids."contactId" AND c."customerId" = p."customerId"
WHERE c.id IS NULL;
~~~

不自动将这些失效 ID 替换为同名联系人。

### A.3 ProjectService 新增同步方法

~~~ts
private async syncProjectContactLinks(
  tx: Prisma.TransactionClient,
  projectId: number,
  contactIds: number[],
) {
  await tx.crmProjectContact.deleteMany({
    where: { projectId },
  });
  if (contactIds.length) {
    await tx.crmProjectContact.createMany({
      data: contactIds.map((contactId, sort) => ({
        projectId, contactId, sort,
      })),
    });
  }
}
~~~

第一阶段 createWithinTransaction() 中，在创建项目后、创建 follows 前增加：

~~~ts
await this.syncProjectContactLinks(
  tx,
  created.id,
  data.contactIds ?? [],
);
~~~

第一阶段 update() 中，将最后 return tx.crmOpportunity.update(...) 替换为：

~~~ts
const updated = await tx.crmOpportunity.update({
  where: { id },
  data,
  include: { items: true },
});
if (data.contactIds !== undefined) {
  await this.syncProjectContactLinks(tx, id, data.contactIds);
}
return updated;
~~~

双写都在同一个事务里，任意引用不存在会导致项目与关联变更一起回滚。

### A.4 CustomerService 删除引用检查

syncContacts() 中，数组引用检查保留，再增加关系表检查：

~~~ts
const linked = await tx.crmProjectContact.findFirst({
  where: { contactId: { in: removedIds } },
  select: { projectId: true },
});
if (linked) {
  throw new BadRequestException(
    '联系人仍被项目引用，不能直接删除',
  );
}
~~~

放在 crmContact.deleteMany() 之前。

### A.5 什么时候移除旧 contactIds

只有所有入口都改为从 projectContacts 读取后才删除旧字段。本文的第二阶段仍保留它，便于旧前端兼容，不给出一个会使第一阶段 resolveCustomer 立即失效的删除操作。

如果之后彻底移除数组，必须同时修改：

- resolveCustomer() 的 existing.contactIds 来源。
- ProjectService.detail()/list() 的返回映射。
- CustomerService.syncContacts() 的数组引用检查。
- 前端 project/Form.vue 的提交字段。
- 所有使用 contactIds 的数据脚本。

先通过关联表生成接口兼容 contactIds，再移除数据库数组，是更稳妥的步骤。

## 附录 B. 第二阶段：客户、项目、报价、合同关系

这里给出可独立加入的数据结构和关联解析工具。第一阶段金额代码不依赖这些新增外键，所以不需要一边改金额一边改变所有表单。

### B.1 schema.prisma

CrmCustomer 增加：

~~~prisma
quotations SalesQuotation[] @relation("QuotationCustomer")
contracts  SalesContract[]  @relation("ContractCustomer")
~~~

CrmOpportunity 增加：

~~~prisma
quotations SalesQuotation[] @relation("QuotationProject")
sourceContracts SalesContract[] @relation("ContractSourceProject")
~~~

SalesQuotation 增加：

~~~prisma
customerId Int?
customer CrmCustomer? @relation(
  "QuotationCustomer",
  fields: [customerId], references: [id], onDelete: Restrict
)
opportunity CrmOpportunity? @relation(
  "QuotationProject",
  fields: [opportunityId], references: [id], onDelete: Restrict
)
contracts SalesContract[] @relation("ContractQuotation")

@@index([customerId])
@@index([opportunityId])
~~~

现有 opportunityId 已存在，不要重复声明。

SalesContract 增加：

~~~prisma
customerId Int?
opportunityId Int?
customer CrmCustomer? @relation(
  "ContractCustomer",
  fields: [customerId], references: [id], onDelete: Restrict
)
sourceProject CrmOpportunity? @relation(
  "ContractSourceProject",
  fields: [opportunityId], references: [id], onDelete: Restrict
)
quotation SalesQuotation? @relation(
  "ContractQuotation",
  fields: [quotationId], references: [id], onDelete: Restrict
)

@@index([customerId])
@@index([opportunityId])
@@index([quotationId])
~~~

现有 quotationId 已存在，不要重复声明。CrmOpportunity.contractId 的原关系保留；sourceProject 是合同来源项目，与原“项目当前关联合同”关系显式区分，避免 Prisma 出现两条未命名关系歧义。

### B.2 先查找孤立 ID，不直接加约束失败后强行清空

~~~sql
SELECT q.id, q."opportunityId"
FROM "SalesQuotation" q
LEFT JOIN "CrmOpportunity" p ON p.id = q."opportunityId"
WHERE q."opportunityId" IS NOT NULL AND p.id IS NULL;

SELECT c.id, c."quotationId"
FROM "SalesContract" c
LEFT JOIN "SalesQuotation" q ON q.id = c."quotationId"
WHERE c."quotationId" IS NOT NULL AND q.id IS NULL;
~~~

新增外键前先处理这些引用。不能以“迁移能执行”为理由删除历史单据的业务线索。

### B.3 关联客户与项目的公共解析

新增：
backend/src/common/utils/sales-links.ts

~~~ts
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { nullableInt } from './business-values';

export async function resolveSalesLinks(
  tx: Prisma.TransactionClient,
  data: any,
  existing?: any,
) {
  let customerId = data.customerId !== undefined
    ? nullableInt(data.customerId, '客户 ID')
    : existing?.customerId;

  if (data.customerId !== undefined) {
    if (customerId == null) {
      data.customerId = null;
      // 客户名称快照仍保留，允许历史单据暂时无关系。
    } else {
      const customer = await tx.crmCustomer.findUnique({
        where: { id: customerId },
        select: { id: true, name: true },
      });
      if (!customer) throw new BadRequestException('客户不存在');
      data.customerId = customer.id;
      data.customerName = customer.name;
    }
  }

  let projectId = data.opportunityId !== undefined
    ? nullableInt(data.opportunityId, '项目 ID')
    : existing?.opportunityId;

  if (data.opportunityCode !== undefined) {
    const code = String(data.opportunityCode ?? '').trim();
    if (!code) {
      projectId = null;
      data.opportunityId = null;
      data.opportunityCode = null;
    } else {
      const project = await tx.crmOpportunity.findUnique({
        where: { code },
        select: { id: true, code: true, customerId: true },
      });
      if (!project) throw new BadRequestException('项目编号不存在');
      if (data.opportunityId !== undefined &&
          projectId != null && projectId !== project.id) {
        throw new BadRequestException('项目 ID 与编号不一致');
      }
      projectId = project.id;
      data.opportunityId = project.id;
      data.opportunityCode = project.code;
      if (customerId != null && project.customerId != null &&
          customerId !== project.customerId) {
        throw new BadRequestException('项目与单据客户不一致');
      }
    }
  } else if (projectId != null) {
    const project = await tx.crmOpportunity.findUnique({
      where: { id: projectId },
      select: { id: true, code: true, customerId: true },
    });
    if (!project) throw new BadRequestException('项目不存在');
    data.opportunityCode = project.code;
    if (customerId != null && project.customerId != null &&
        customerId !== project.customerId) {
      throw new BadRequestException('项目与单据客户不一致');
    }
  }
}
~~~

只在显式修改客户关系时刷新客户名称快照；修改合同说明不自动改写历史客户名称。

### B.4 Service 接入点

两个 Service 新增 resolveSalesLinks import。

update() 中读取原主表后、主表 update 前调用：

~~~ts
await resolveSalesLinks(tx, data, existing);
~~~

报价 update() 当前只查询行锁，需在锁之后新增：

~~~ts
const existing = await tx.salesQuotation.findUniqueOrThrow({
  where: { id },
});
await resolveSalesLinks(tx, data, existing);
~~~

create() 最后的 Prisma create 替换成事务包裹：

~~~ts
return this.prisma.$transaction(async (tx) => {
  await resolveSalesLinks(tx, data);
  return tx.salesQuotation.create({
    data,
    include: { lines: true },
  });
});
~~~

合同对应：

~~~ts
return this.prisma.$transaction(async (tx) => {
  await resolveSalesLinks(tx, data);
  return tx.salesContract.create({
    data,
    include: { lines: true, paymentPlans: true },
  });
});
~~~

第 4 节创建前的 data.title/customerName 校验仍保留，前端会提交选中客户的名称快照。

### B.5 前端选择客户使用 ID

quotation 和 contract blank() 增加：

~~~ts
customerId: null as number | null,
~~~

选择器：

~~~vue
<el-select
  v-model="form.customerId"
  filterable
  remote
  :remote-method="searchCustomer"
  @change="onCustomerChange"
>
  <el-option
    v-for="customer in custOpts"
    :key="customer.id"
    :label="customer.name"
    :value="customer.id"
  />
</el-select>
~~~

两个文件新增：

~~~ts
function onCustomerChange(value: number | null) {
  const customer = custOpts.value.find((item) => item.id === value);
  if (customer) form.customerName = customer.name;
}
~~~

加载详情后如 customerId 存在，将该客户当前选项补入 custOpts，避免尚未搜索时选中项只显示数字。可使用后端详情 include 的 customer，或当前名称快照构建：

~~~ts
if (d.customerId != null) {
  custOpts.value = [{
    id: d.customerId,
    name: d.customerName,
  }];
}
~~~

form-payload.ts：

- quotation/contract 的 FIELDS 增加 customerId。
- contract 的 FIELDS 增加 opportunityId。
- 对应 NULLABLE 增加 customerId/opportunityId。

报价转合同的自动复制、合同部分收款、商品库存流水，需要再定义具体业务规则。它们不是修复现有数据一致性所必需的步骤，不能在规则未确认时加入一个“按字复制就能正确工作”的大流程。

## 附录 C. 采购库存与其余架构建议的落地边界

之前建议中“采购和库存扩展为真实业务流水”是产品扩展，不是已有代码可直接替换的修复。

**第一阶段选择维持台账用途。** 不增加一个缺少流水来源的库存数量字段，不用商品名称匹配来自动扣减库存，不自动将采购备注解释成到货数量。

如果未来确认需要真实库存，应先确定：

- 商品是否以 SKU 唯一识别。
- 是否多仓库。
- 是否允许负库存。
- 是否存在批次、序列号。
- 入出库的单位与换算。
- 采购是否部分到货。
- 合同是否分批交付。
- 退货和取消单如何反向记账。

明确上述规则后，再新增 Product、PurchaseOrder、PurchaseOrderLine、StockMovement 和对应业务动作。当前不足以写出可信的整套业务代码，本文没有把假设写成已确认规则。

“完整 DTO 覆盖所有模块”“全部旧字段移除”“所有详情整对象回填替换”同样分模块推进。本手册已给出第一阶段显式提交映射、核心值解析、导入 DTO 和分页 DTO，不一次删除未梳理的旧字段，防止存量功能数据被丢弃。

## 附录 D. 文档实施核对索引

| 原问题 | 主修改章节 |
| --- | --- |
| 报价删明细后更新失败 | 4.2—4.4 |
| 客户更新导致联系人 ID 变化 | 2.3—2.6；附录 A |
| 最后跟进日期不准确 | 3.5—3.9 |
| 清空字段被忽略 | 1.1、2.2、3.3、4.5、10.2 |
| 金额计算与局部更新错误 | 1.2、3.2—3.7、4.6—4.10 |
| 导入关联缺失与重复确认 | 7 |
| 日程快照与实时数据混用 | 8 |
| 统计口径与逐人查询 | 6 |
| Excel 列与合并范围错误 | 5 |
| any、日期、分页、编号及跨模块关系 | 1、9、10；附录 B/C |

### 本文最终原则

先确保已有功能保存正确、关联稳定和历史可解释，再增加新的业务流程。可以逐字执行的代码只对应本文已明确选择的规则；需要业务定义的扩展明确保留为后续事项，不用假设替代你的业务决定。

