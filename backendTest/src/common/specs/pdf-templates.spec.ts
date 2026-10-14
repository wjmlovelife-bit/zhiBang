/**
 * common/pdf/templates.ts 单元测试
 *
 * renderPdf 是纯函数（无 prisma 依赖），覆盖：
 *  - 3 种类型（contract/quotation/project）正常含明细渲染
 *  - HTML 转义（Handlebars 默认防 XSS）
 *  - 空 items/plans 跳过明细表（{{#if}} 行为）
 *  - 必填字段缺失时给出空字符串兜底
 */
import { renderPdf } from '@app/common/pdf/templates';

describe('renderPdf', () => {
  // ============================================================
  // contract 模板
  // ============================================================
  describe("contract", () => {
    it('1. 正常合同：含公司名/标题/客户名/明细行/付款计划', () => {
      const html = renderPdf('contract', {
        companyName: '智邦科技',
        docTitle: '销售合同',
        now: '2026-09-22',
        code: 'HT202609220001',
        title: '测试合同',
        customerName: '客户A',
        ownerName: '张三',
        signPlace: '深圳',
        currencyCode: 'CNY',
        brand: 'RIGOL',
        signDate: '2026-09-22',
        paybackMode: '电汇',
        startDate: '2026-09-22',
        endDate: '2026-12-31',
        intro: '合同说明',
        lines: [
          { productName: 'P1', quantity: 1, unitPrice: '100.00', discount: 0, taxRate: 13, amount: '100.00' },
        ],
        plans: [
          { seq: 1, planDate: '2026-09-22', amount: '50.00', remark: '预付款' },
        ],
        amountTotal: '100.00',
      });
      expect(html).toContain('智邦科技');
      expect(html).toContain('销售合同');
      expect(html).toContain('HT202609220001');
      expect(html).toContain('客户A');
      expect(html).toContain('张三');
      expect(html).toContain('合同明细');
      expect(html).toContain('付款计划');
      expect(html).toContain('P1');
      expect(html).toContain('100.00');
    });

    it('2. 空 lines/plans：明细表整段不渲染（{{#if}}）', () => {
      const html = renderPdf('contract', {
        companyName: 'X', docTitle: '销售合同', code: 'HT001', now: '2026-09-22',
        title: '', customerName: '', ownerName: '', currencyCode: 'CNY',
        lines: [], plans: [], amountTotal: '0.00',
      });
      expect(html).not.toContain('合同明细');
      expect(html).not.toContain('付款计划');
    });

    it('3. 防 XSS：客户名含 <script> 标签自动转义', () => {
      const html = renderPdf('contract', {
        companyName: 'X', docTitle: '销售合同', code: 'HT001', now: '2026-09-22',
        title: 't', customerName: '<script>alert(1)</script>', ownerName: 'o',
        currencyCode: 'CNY', lines: [], plans: [], amountTotal: '0',
      });
      expect(html).not.toContain('<script>alert(1)</script>');
      expect(html).toContain('&lt;script&gt;');
    });
  });

  // ============================================================
  // quotation 模板
  // ============================================================
  describe("quotation", () => {
    it('4. 正常报价：含产品/数量/单价/折扣/税率/合计', () => {
      const html = renderPdf('quotation', {
        companyName: '智邦科技', docTitle: '报价单', now: '2026-09-22',
        code: 'BJ001', title: 't', customerName: 'c', contactName: '张三',
        date: '2026-09-22', currencyCode: 'CNY', opportunityCode: 'XM001',
        intro: '说明',
        lines: [{ productName: 'P', quantity: 2, unitPrice: '100', discount: 10, taxRate: 13, amount: '180' }],
        amountTotal: '180',
      });
      expect(html).toContain('报价单');
      expect(html).toContain('BJ001');
      expect(html).toContain('报价明细');
      expect(html).toContain('合计金额');
      expect(html).toContain('CNY');
      expect(html).toContain('P');
    });

    it('5. 空 lines：明细表不渲染', () => {
      const html = renderPdf('quotation', {
        companyName: 'X', docTitle: '报价单', code: 'BJ001', now: '2026-09-22',
        title: '', customerName: '', currencyCode: 'CNY',
        lines: [], amountTotal: '0',
      });
      expect(html).not.toContain('报价明细');
    });

    it('6. 防 XSS：联系人名含 HTML 自动转义', () => {
      const html = renderPdf('quotation', {
        companyName: 'X', docTitle: '报价单', code: 'BJ001', now: '2026-09-22',
        title: '', customerName: '', contactName: '<img src=x onerror=alert(1)>',
        currencyCode: 'CNY', lines: [], amountTotal: '0',
      });
      expect(html).not.toContain('<img src=x');
      expect(html).toContain('&lt;img');
    });
  });

  // ============================================================
  // project 模板
  // ============================================================
  describe("project", () => {
    it('7. 正常项目：含客户名/分类/阶段/明细/日期', () => {
      const html = renderPdf('project', {
        companyName: '智邦科技', docTitle: '项目信息表', now: '2026-09-22',
        code: 'XM001', name: '测试项目', customerName: '客户A', customerCode: 'KH001',
        owner: '张三', category: '终端', stage: '签约', source: '展会',
        state: '进行', dateOpen: '2026-09-22',
        expectedRevenue: '100,000.00', discountPct: '9 折', amountFinal: '90,000.00',
        plannedCost: '50,000.00', projectDate: '2026-10-01',
        description: '描述',
        items: [{ productName: 'P1', productCode: 'PC1', model: 'M1', unitPrice: '100', quantity: 1, amount: '100' }],
      });
      expect(html).toContain('智邦科技');
      expect(html).toContain('项目信息表');
      expect(html).toContain('XM001');
      expect(html).toContain('客户A');
      expect(html).toContain('商品明细');
      expect(html).toContain('P1');
    });

    it('8. 空 items：明细表不渲染', () => {
      const html = renderPdf('project', {
        companyName: 'X', docTitle: '项目信息表', code: 'XM001', now: '2026-09-22',
        name: 'n', customerName: '', owner: '', category: '', stage: '',
        source: '', state: '', dateOpen: '', expectedRevenue: '', discountPct: '',
        amountFinal: '', plannedCost: '', projectDate: '', description: '',
        items: [],
      });
      expect(html).not.toContain('商品明细');
    });

    it('9. 防 XSS：项目名含可执行 <a> 标签自动转义', () => {
      const html = renderPdf('project', {
        companyName: 'X', docTitle: '项目信息表', code: 'XM001', now: '2026-09-22',
        name: '<a href="javascript:alert(1)">click</a>', customerName: '', owner: '',
        category: '', stage: '', source: '', state: '', dateOpen: '',
        expectedRevenue: '', discountPct: '', amountFinal: '', plannedCost: '',
        projectDate: '', description: '', items: [],
      });
      // 整个 <a href="javascript:..."> 标签必须被转义成 &lt;a href=...&gt;（属性里的 "javascript:" 不可执行）
      expect(html).not.toContain('<a href="javascript:alert(1)">');
      expect(html).toContain('&lt;a');
    });
  });
});