<template>
  <div>
    <el-card>
      <el-page-header @back="$router.back()" content="导入采购" style="margin-bottom: 16px" />
      <el-alert type="info" :closable="false">
        模板字段：商品名称*、商品型号*、厂家*、日期（YYYY-MM-DD 格式）、备注。必填缺失的行会被跳过。
      </el-alert>
      <div style="margin: 16px 0; display: flex; gap: 12px">
        <el-button @click="downloadTpl">下载模板</el-button>
        <el-upload :auto-upload="false" :show-file-list="false" accept=".xlsx,.xls,.csv" :on-change="onFile">
          <el-button type="primary">选择文件</el-button>
        </el-upload>
        <el-button type="success" :disabled="!preview" @click="confirmImport">确认导入</el-button>
      </div>

      <template v-if="preview">
        <h4>有效行（{{ preview.validCount }}）</h4>
        <el-table :data="preview.valid.slice(0, 50)" border max-height="320">
          <el-table-column label="商品名称" prop="productName" />
          <el-table-column label="商品型号" prop="productModel" />
          <el-table-column label="厂家" prop="manufacturer" />
          <el-table-column label="日期" prop="date" />
        </el-table>
        <h4 style="color: #f56c6c">跳过行（{{ preview.invalidCount }}）</h4>
        <el-table :data="preview.invalid.slice(0, 50)" border max-height="220">
          <el-table-column label="行号" prop="row" width="80" />
          <el-table-column label="缺失字段" :formatter="(r: any) => r.miss.join('、')" />
        </el-table>
      </template>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
// R21 B-2（2026-09-28）：xlsx 改动态 import，~390 KB 全量 → 拆独立 chunk 按需加载
import { purchaseApi } from '@/api';

const preview = ref<any>(null);

async function downloadTpl() {
  const XLSX = await import('xlsx');
  const headers = ['商品名称', '商品型号', '厂家', '日期', '备注'];
  const ws = XLSX.utils.aoa_to_sheet([headers]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '采购导入');
  XLSX.writeFile(wb, '采购导入模板.xlsx');
}

function normalizeDate(v: any) {
  if (v == null || v === '') return new Date().toISOString().slice(0, 10);
  if (typeof v === 'number') {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + v * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{1,2}-\d{1,2}/.test(s)) return s.slice(0, 10);
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  return s;
}

function mapRow(arr: any[]) {
  return {
    productName: arr[0],
    productModel: arr[1],
    manufacturer: arr[2],
    date: normalizeDate(arr[3]),
    remark: arr[4],
  };
}

async function onFile(file: any) {
  const data = await file.raw.arrayBuffer();
  const XLSX = await import('xlsx');
  const wb = XLSX.read(data, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  const list = rows.slice(1).filter((r) => r.some((c) => c !== '' && c != null));
  const mapped = list.map(mapRow);
  const valid: any[] = [];
  const invalid: any[] = [];
  mapped.forEach((r, i) => {
    const miss: string[] = [];
    if (!r.productName) miss.push('商品名称');
    if (!r.productModel) miss.push('商品型号');
    if (!r.manufacturer) miss.push('厂家');
    if (miss.length) invalid.push({ row: i + 2, miss });
    else valid.push(r);
  });
  preview.value = { valid, invalid, validCount: valid.length, invalidCount: invalid.length, _rows: valid };
}

async function confirmImport() {
  const rows = (preview.value as any)._rows || [];
  let n = 0;
  for (const r of rows) {
    await purchaseApi.create({
      productName: r.productName,
      productModel: r.productModel,
      manufacturer: r.manufacturer,
      date: r.date,
      remark: r.remark || '',
    });
    n++;
  }
  ElMessage.success(`成功导入 ${n} 条`);
  preview.value = null;
}
</script>
