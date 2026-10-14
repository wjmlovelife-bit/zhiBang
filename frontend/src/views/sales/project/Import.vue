<template>
  <div>
    <el-card>
      <el-page-header @back="$router.back()" content="导入项目" style="margin-bottom: 16px" />
      <el-alert type="info" :closable="false">
        模板字段（带*为必填）：项目主题*、客户编号*、发现日期*(YYYY-MM-DD)、项目分类*、项目阶段*、项目来源*、项目状态*、负责销售人*(用户ID)、币种、项目总额、优惠折扣、预计费用、项目概要。
        必填缺失的行会被跳过。
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
        <el-table :data="preview.valid.slice(0, 50)" border max-height="300">
          <el-table-column label="项目主题" prop="name" />
          <el-table-column label="客户编号" prop="customerCode" />
          <el-table-column label="项目分类" prop="category" />
          <el-table-column label="负责销售人" prop="ownerId" />
        </el-table>
        <h4 style="color: #f56c6c">跳过行（{{ preview.invalidCount }}）</h4>
        <el-table :data="preview.invalid.slice(0, 50)" border max-height="200">
          <el-table-column label="行号" prop="row" width="80" />
          <el-table-column label="缺失字段" :formatter="(r:any)=>r.miss.join('、')" />
        </el-table>
      </template>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
// R21 B-2（2026-09-28）：xlsx 改动态 import，~390 KB 全量 → 拆独立 chunk 按需加载
//    之前静态 import * as XLSX from 'xlsx' 会把整个 xlsx 全量塞进 vendor-data.js (414 KB)，
//    现在按 await import('xlsx') 让 rollup 把它拆为独立 chunk（vite-plugin 的默认行为）
import { projectApi, sysApi } from '@/api';

const preview = ref<any>(null);

async function downloadTpl() {
  const XLSX = await import('xlsx');
  const headers = ['项目主题', '客户编号', '发现日期', '项目分类', '项目阶段', '项目来源', '项目状态', '负责销售人ID', '币种', '项目总额', '优惠折扣', '预计费用', '项目概要'];
  const ws = XLSX.utils.aoa_to_sheet([headers]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '项目导入');
  XLSX.writeFile(wb, '项目导入模板.xlsx');
}

const FIELDS = ['name', 'customerCode', 'dateOpen', 'category', 'stage', 'source', 'state', 'ownerId', 'currencyCode', 'expectedRevenue', 'discountPct', 'plannedCost', 'description'];

async function onFile(file: any) {
  const data = await file.raw.arrayBuffer();
  const XLSX = await import('xlsx');
  const wb = XLSX.read(data, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  const list = rows.slice(1).filter((r) => r.some((c) => c !== '' && c != null));
  const mapped = list.map((r) => {
    const o: any = {};
    FIELDS.forEach((f, i) => (o[f] = r[i]));
    return o;
  });
  const users = await sysApi.users();
  const userMap = Object.fromEntries(users.map((u) => [u.name, u.id]));
  // 允许负责销售人填用户名时转换
  mapped.forEach((m) => {
    if (m.ownerId && isNaN(Number(m.ownerId))) m.ownerId = userMap[m.ownerId] || '';
  });
  preview.value = await projectApi.importPreview(mapped);
}

async function confirmImport() {
  if (!preview.value?.valid?.length) return ElMessage.warning('没有可导入的有效行');
  const res: any = await projectApi.importConfirm(preview.value.valid);
  ElMessage.success(`成功导入 ${res.count} 条`);
  preview.value = null;
}
</script>
