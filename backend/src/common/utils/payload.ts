import { Prisma } from '@prisma/client';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 将 "YYYY-MM-DD" 这类纯日期字符串补成 Prisma DateTime 接受的完整 ISO 字符串。
 * 前端 el-date-picker（value-format=YYYY-MM-DD）一律只传日期，后端建表是 DateTime，
 * 不转换会触发 "Invalid value ... Expected ISO-8601 DateTime"。
 *
 * 重要：必须跳过 Date 实例和 Prisma.Decimal 实例 —— 它们是类实例对象，
 * `Object.keys()` 会拆出内部字段（d/e/s 等）甚至 `constructor` 函数引用，
 * 会破坏实例完整性。Prisma update 收到残缺对象会报
 * "Invalid value for argument `constructor`: We could not serialize [object Function] value"。
 */
export function normalizeDates(v: any): any {
  if (Array.isArray(v)) return v.map(normalizeDates);
  if (
    v &&
    typeof v === 'object' &&
    !(v instanceof Date) &&
    // 跳过 Prisma.Decimal 类实例（paymentLimitPct/registeredCapital 等 Decimal? 字段）
    !(Prisma as any).Decimal?.isDecimal?.(v)
  ) {
    const out: any = {};
    for (const k of Object.keys(v)) out[k] = normalizeDates(v[k]);
    return out;
  }
  if (typeof v === 'string' && DATE_RE.test(v)) return v + 'T00:00:00.000Z';
  return v;
}

// 顶层关系字段 → 子模型名（用于递归清洗子表数组）
const NESTED: Record<string, Record<string, string>> = {
  CrmCustomer: { contacts: 'CrmContact' },
  CrmOpportunity: { items: 'CrmProjectItem', follows: 'CrmProjectFollow', inherits: 'CrmCustomerInherit' },
  SalesContract: { lines: 'SalesContractLine', paymentPlans: 'SalesContractPaymentPlan' },
  SalesQuotation: { lines: 'SalesQuotationLine' },
};

/**
 * 只保留模型自身的标量字段（来自 Prisma 生成的 ScalarFieldEnum）和已知的子表数组，
 * 丢弃前端可能误传的多余/错名字段（如 followLevel / submitStatus / owner 对象等），
 * 避免 Prisma 抛 "Unknown argument" 导致 500。
 */
export function scrub(model: string, body: any): any {
  const enumName = `${model}ScalarFieldEnum`;
  const flds: any = (Prisma as any)[enumName];
  if (!flds) return body; // 未识别模型，原样返回（保险）
  const allowed = new Set<string>(Object.values(flds));
  const nested = NESTED[model] || {};
  const out: any = {};
  for (const k of Object.keys(body)) {
    if (allowed.has(k)) {
      out[k] = body[k];
    } else if (nested[k]) {
      const arr = Array.isArray(body[k]) ? body[k] : [];
      out[k] = arr.map((it: any) => (it && typeof it === 'object' ? scrub(nested[k], it) : it));
    }
    // 其他未知键丢弃
  }
  return out;
}

/** 组合：先按 schema 清洗字段，再规范日期字符串 */
export function sanitize(model: string, body: any): any {
  return normalizeDates(scrub(model, body));
}

/**
 * 把指定 Int[] 字段的非法值（'' / null / undefined / '[]' / 'null' / 空白字符串）
 * 统一转成 undefined，让 Prisma 走 schema @default([])。
 * 真正的 number[] 数组原样保留。
 * （前端 el-input / 组件从未填状态提交时常回填 ''，Prisma 会拒绝）
 */
export function cleanArrayFields(obj: any, fields: string[]) {
  if (!obj) return obj;
  for (const f of fields) {
    const v = obj[f];
    if (v == null) {
      obj[f] = undefined;
      continue;
    }
    if (Array.isArray(v)) continue;
    if (typeof v === 'string') {
      const s = v.trim();
      if (s === '' || s === '[]' || s === 'null' || s === 'undefined') {
        obj[f] = undefined;
      } else {
        // 看起来是 JSON 数组字串，尝试解析；否则丢弃
        try {
          const parsed = JSON.parse(s);
          if (Array.isArray(parsed)) {
            obj[f] = parsed;
          } else {
            obj[f] = undefined;
          }
        } catch {
          obj[f] = undefined;
        }
      }
      continue;
    }
    // 其它类型（对象 / 数字等）安全地丢掉
    obj[f] = undefined;
  }
  return obj;
}
