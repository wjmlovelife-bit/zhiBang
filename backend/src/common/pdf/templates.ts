const Handlebars = require('handlebars');

// 通用样式（内联，保证 PDF 渲染一致）
const BASE_STYLE = `
  body{font-family:"Microsoft YaHei","SimSun",sans-serif;color:#222;margin:0;padding:28px;font-size:13px;line-height:1.6}
  .company{font-size:22px;font-weight:bold;letter-spacing:4px;text-align:center}
  .doc-title{font-size:16px;font-weight:bold;text-align:center;margin-top:6px}
  .meta{text-align:right;color:#666;margin:10px 0 16px;font-size:12px}
  table.info{width:100%;border-collapse:collapse;margin-bottom:16px}
  table.info td,table.info th{border:1px solid #999;padding:6px 10px;vertical-align:top}
  table.info th{background:#f4f6f8;width:96px;font-weight:600;text-align:left;white-space:nowrap}
  table.grid{width:100%;border-collapse:collapse;margin-bottom:8px}
  table.grid th,table.grid td{border:1px solid #999;padding:5px 8px;text-align:left;font-size:12px}
  table.grid th{background:#f4f6f8}
  .total{text-align:right;font-weight:bold;margin:8px 0}
  .sec{font-weight:bold;margin:18px 0 8px;border-left:3px solid #0a7;padding-left:8px}
  .sign{display:flex;justify-content:space-between;margin-top:48px;font-size:13px}
`;

const PROJECT_TPL = `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_STYLE}</style></head><body>
  <div class="company">{{companyName}}</div>
  <div class="doc-title">{{docTitle}}</div>
  <div class="meta">编号：{{code}}</div>
  <table class="info">
    <tr><th>项目主题</th><td>{{name}}</td><th>客户名称</th><td>{{customerName}}</td></tr>
    <tr><th>客户编号</th><td>{{customerCode}}</td><th>主负责人</th><td>{{owner}}</td></tr>
    <tr><th>项目分类</th><td>{{category}}</td><th>项目阶段</th><td>{{stage}}</td></tr>
    <tr><th>项目来源</th><td>{{source}}</td><th>项目状态</th><td>{{state}}</td></tr>
    <tr><th>发现日期</th><td>{{dateOpen}}</td><th>预计总额</th><td>{{expectedRevenue}}</td></tr>
    <tr><th>优惠折扣</th><td>{{discountPct}}</td><th>优惠后总额</th><td>{{amountFinal}}</td></tr>
    <tr><th>预计费用</th><td>{{plannedCost}}</td><th>项目日期</th><td>{{projectDate}}</td></tr>
    <tr><th>项目概要</th><td colspan="3">{{description}}</td></tr>
  </table>
  {{#if items}}
  <div class="sec">商品明细</div>
  <table class="grid">
    <tr><th>产品名称</th><th>产品编号</th><th>型号</th><th>单价</th><th>数量</th><th>总价</th></tr>
    {{#each items}}<tr><td>{{productName}}</td><td>{{productCode}}</td><td>{{model}}</td><td>{{unitPrice}}</td><td>{{quantity}}</td><td>{{amount}}</td></tr>{{/each}}
  </table>
  {{/if}}
  <div class="sign"><span>负责人签字：____________</span><span>日期：{{now}}</span></div>
</body></html>`;

const QUOTATION_TPL = `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_STYLE}</style></head><body>
  <div class="company">{{companyName}}</div>
  <div class="doc-title">{{docTitle}}</div>
  <div class="meta">编号：{{code}}</div>
  <table class="info">
    <tr><th>标题</th><td>{{title}}</td><th>客户名称</th><td>{{customerName}}</td></tr>
    <tr><th>联系人</th><td>{{contactName}}</td><th>日期</th><td>{{date}}</td></tr>
    <tr><th>币种</th><td>{{currencyCode}}</td><th>关联项目</th><td>{{opportunityCode}}</td></tr>
    <tr><th>报价说明</th><td colspan="3">{{intro}}</td></tr>
  </table>
  {{#if lines}}
  <div class="sec">报价明细</div>
  <table class="grid">
    <tr><th>产品名称</th><th>数量</th><th>单价</th><th>折扣</th><th>税率%</th><th>金额</th></tr>
    {{#each lines}}<tr><td>{{productName}}</td><td>{{quantity}}</td><td>{{unitPrice}}</td><td>{{discount}}</td><td>{{taxRate}}</td><td>{{amount}}</td></tr>{{/each}}
  </table>
  {{/if}}
  <div class="total">合计金额（{{currencyCode}}）：{{amountTotal}}</div>
  <div class="sign"><span>报价方签字：____________</span><span>日期：{{now}}</span></div>
</body></html>`;

const CONTRACT_TPL = `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_STYLE}</style></head><body>
  <div class="company">{{companyName}}</div>
  <div class="doc-title">{{docTitle}}</div>
  <div class="meta">编号：{{code}}</div>
  <table class="info">
    <tr><th>合同标题</th><td>{{title}}</td><th>客户名称</th><td>{{customerName}}</td></tr>
    <tr><th>负责人</th><td>{{ownerName}}</td><th>签约地点</th><td>{{signPlace}}</td></tr>
    <tr><th>币种</th><td>{{currencyCode}}</td><th>品牌</th><td>{{brand}}</td></tr>
    <tr><th>签约日期</th><td>{{signDate}}</td><th>交付方式</th><td>{{paybackMode}}</td></tr>
    <tr><th>开始日期</th><td>{{startDate}}</td><th>结束日期</th><td>{{endDate}}</td></tr>
    <tr><th>合同说明</th><td colspan="3">{{intro}}</td></tr>
  </table>
  {{#if lines}}
  <div class="sec">合同明细</div>
  <table class="grid">
    <tr><th>产品名称</th><th>数量</th><th>单价</th><th>折扣</th><th>税率%</th><th>金额</th></tr>
    {{#each lines}}<tr><td>{{productName}}</td><td>{{quantity}}</td><td>{{unitPrice}}</td><td>{{discount}}</td><td>{{taxRate}}</td><td>{{amount}}</td></tr>{{/each}}
  </table>
  {{/if}}
  <div class="total">合同金额（{{currencyCode}}）：{{amountTotal}}</div>
  {{#if plans}}
  <div class="sec">付款计划</div>
  <table class="grid">
    <tr><th>序号</th><th>计划日期</th><th>金额</th><th>备注</th></tr>
    {{#each plans}}<tr><td>{{seq}}</td><td>{{planDate}}</td><td>{{amount}}</td><td>{{remark}}</td></tr>{{/each}}
  </table>
  {{/if}}
  <div class="sign"><span>甲方签字：____________</span><span>乙方签字：____________</span></div>
  <div class="sign"><span>日期：{{now}}</span><span>&nbsp;</span></div>
</body></html>`;

export type PdfDocType = 'project' | 'quotation' | 'contract';

export function renderPdf(type: PdfDocType, data: Record<string, any>): string {
  const tpl = type === 'project' ? PROJECT_TPL : type === 'quotation' ? QUOTATION_TPL : CONTRACT_TPL;
  return Handlebars.compile(tpl)(data);
}
