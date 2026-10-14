# PDF 修改策略

## 1. 核心原理

```
数据库数据 → Handlebars 模板渲染 → HTML → Puppeteer → PDF
```

PDF 本质是一个 **HTML + CSS 模板**，通过 Puppeteer（Headless Chrome）渲染为 PDF 文件。

---

## 2. 模板文件位置

| 文件 | 路径 |
|---|---|
| 模板定义 | `backend/src/common/pdf/templates.ts` |
| PDF 生成服务 | `backend/src/common/pdf/pdf.service.ts` |
| 项目调用示例 | `backend/src/modules/project/project.service.ts` |

---

## 3. 模板结构说明

### 3.1 通用样式（BASE_STYLE）

位置：`templates.ts` 第 4-18 行

```typescript
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
```

### 3.2 模板语法区分

| 类型 | 语法 | 示例 | 含义 |
|---|---|---|---|
| 固定文字 | 直接写 | `<div>项目详情单</div>` | 写死在模板里，全局生效 |
| 动态数据 | `{{字段名}}` | `{{companyName}}` | 从数据库获取，每个项目不同 |

---

## 4. 可调整内容一览

| 类别 | 能否修改 | 修改位置 | 示例 |
|---|---|---|---|
| **页眉页脚** | ✅ 可 | BASE_STYLE + HTML | 用 CSS `position:fixed` 固定定位 |
| **表格样式** | ✅ 可 | BASE_STYLE | 修改 `border`, `font-size`, `padding` |
| **字体大小/格式** | ✅ 可 | BASE_STYLE | 修改 `font-size`, `font-weight` |
| **固定文字** | ✅ 可 | HTML 模板区 | 直接修改模板中的文字 |
| **动态字段** | ✅ 可 | HTML 模板 + Service | 模板加 `{{新字段}}`，Service 传入数据 |
| **页面布局** | ✅ 可 | HTML 模板 | 加/删行、加/删列、调整结构 |
| **纸张大小** | ✅ 可 | `pdf.service.ts` | 修改 `format: 'A4'` 为 `'Letter'` |
| **页边距** | ✅ 可 | `pdf.service.ts` | 修改 `margin: {top:'15mm',...}` |

---

## 5. 页面配置（pdf.service.ts）

位置：`backend/src/common/pdf/pdf.service.ts` 第 26-30 行

```typescript
const pdf = await page.pdf({
  format: 'A4',                                    // 纸张大小
  printBackground: true,                            // 打印背景色
  margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },  // 页边距
});
```

可调整项：
- `format`: `'A4'` / `'Letter'` / `'Legal'` 等
- `margin`: 任意 mm/cm/in 单位

---

## 6. 修改示例

### 6.1 修改固定文字

修改 `templates.ts` 第 26 行：

```html
<!-- 修改前 -->
<th>主负责人</th><td>{{owner}}</td>

<!-- 修改后 -->
<th>负责销售人</th><td>{{owner}}</td>
```

### 6.2 调整字体大小

修改 `templates.ts` 第 5 行：

```css
/* 修改前 */
body{font-size:13px;...}

/* 修改后 */
body{font-size:14px;...}
```

### 6.3 添加页眉

1. 在 HTML 模板顶部加：

```html
<div class="header" style="position:fixed;top:0;left:0;right:0;height:40px;border-bottom:1px solid #ccc;text-align:center;">
  <img src="/logo.png" height="30" />
</div>
```

2. 在 BASE_STYLE 加：

```css
.header{position:fixed;top:0;left:0;right:0;height:40px;}
body{padding-top:50px;}  /* 避开页眉 */
```

### 6.4 添加新字段

1. 在 `project.service.ts` 的 `generatePdf` 方法中传入新字段：

```typescript
const data = {
  // ... 现有字段
  newField: o.newField,  // 新增字段
};
```

2. 在 `templates.ts` 模板中加：

```html
<tr><th>新字段</th><td colspan="3">{{newField}}</td></tr>
```

### 6.5 去掉整行

直接删除模板中对应的 `<tr>...</tr>` 行即可。

---

## 7. 已支持的 PDF 类型

| 类型 | 模板变量 | 调用位置 |
|---|---|---|
| 项目详情单 | `PROJECT_TPL` | `project.service.ts` |
| 报价单 | `QUOTATION_TPL` | `quotation.service.ts` |
| 合同 | `CONTRACT_TPL` | `contract.service.ts` |
| 商机（归档） | `OPP TPL` | `opportunity.service.ts` |

---

## 8. 注意事项

1. **改完需重启后端**：`nest start` 或 `npm run start` 重启服务
2. **CSS 兼容性**：使用内联 CSS，Puppeteer 对现代 CSS 支持良好
3. **中文渲染**：已配置 `Microsoft YaHei` 字体，中文显示正常
4. **调试技巧**：直接在浏览器打开渲染后的 HTML，确认样式后再生成 PDF
