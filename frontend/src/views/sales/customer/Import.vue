<template>
  <div>
    <el-card>
      <el-page-header @back="$router.back()" content="导入客户" style="margin-bottom: 16px" />
      <el-alert type="info" :closable="false">
        模板字段：客户名称*、客户编号、客户分类、跟进程度、客户来源、客户行业、价值评估、客户区域、客户地址、法人代表、联系人姓名、手机。必填缺失的行会被跳过。
      </el-alert>
      <div style="margin: 16px 0; display: flex; gap: 12px">
        <el-button @click="downloadTpl">下载模板</el-button>
        <el-upload :auto-upload="false" :show-file-list="false" accept=".xlsx,.xls,.csv" :on-change="onFile">
          <el-button type="primary">选择文件</el-button>
        </el-upload>
        <el-button type="success" :loading="importing" :disabled="!preview || importing" @click="confirmImport">{{ importing ? '导入中...' : '确认导入' }}</el-button>
      </div>

      <template v-if="preview">
        <h4>有效行（{{ preview.validCount }}）</h4>
        <el-table :data="preview.valid.slice(0, 50)" border max-height="320">
          <el-table-column label="客户名称" prop="name" />
          <el-table-column label="客户编号" prop="code" />
          <el-table-column label="客户分类" prop="category" />
          <el-table-column label="客户行业" prop="industry" />
        </el-table>
        <h4 style="color: #f56c6c">跳过行（{{ preview.invalidCount }}）</h4>
        <el-table :data="preview.invalid.slice(0, 50)" border max-height="220">
          <el-table-column label="行号" prop="row" width="80" />
          <el-table-column label="缺失字段" :formatter="(r:any)=>r.miss.join('、')" />
        </el-table>
      </template>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
// R21 B-2（2026-09-28）：xlsx 改动态 import，~390 KB 全量 → 拆独立 chunk 按需加载
import { customerApi } from '@/api';

const preview = ref<any>(null);
// R22（2026-09-29）：导入按钮防重复点击保护
//   9/28 余林森导入 74 条客户，结果 DB 出现 2072 条 = 74 × 28
//   根因："确认导入"按钮没 loading/disabled 控制，用户连续点击 28 次，每次都触发新的 for 循环
//   修复：1) 加 importing ref 2) 按钮 :loading + :disabled 3) confirmImport 顶部 if (importing) return 4) try/finally 保 importing 必释放
const importing = ref(false);

async function downloadTpl() {
  const XLSX = await import('xlsx');
  const headers = ['客户名称', '客户编号', '客户分类', '跟进程度', '客户来源', '客户行业', '价值评估', '客户区域', '客户地址', '法人代表', '联系人姓名', '手机'];
  const ws = XLSX.utils.aoa_to_sheet([headers]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '客户导入');
  XLSX.writeFile(wb, '客户导入模板.xlsx');
}

function mapRow(arr: any[]) {
  return {
    name: arr[0], code: arr[1], category: arr[2], followStage: arr[3], source: arr[4],
    industry: arr[5], valueRating: arr[6], regionText: arr[7], address: arr[8], legalPerson: arr[9],
    contactName: arr[10], mobile: arr[11],
  };
}

async function onFile(file: any) {
  const data = await file.raw.arrayBuffer();
  const XLSX = await import('xlsx');
  const wb = XLSX.read(data, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  const list = rows.slice(1).filter((r) => r.some((c) => c !== '' && c != null));
  const mapped = list.map(mapRow).map((r) => ({
    ...r,
    contacts: r.contactName ? [{ name: r.contactName, mobile: r.mobile }] : [],
  }));
  const valid: any[] = [];
  const invalid: any[] = [];
  mapped.forEach((r, i) => {
    if (!r.name) invalid.push({ row: i + 2, miss: ['name'] });
    else valid.push(r);
  });
  preview.value = { valid, invalid, validCount: valid.length, invalidCount: invalid.length, _rows: valid };
}

async function confirmImport() {
  // R22 防重复触发：即使按钮 disabled 被绕过（DevTools/快捷键/双击），代码层也拦
  if (importing.value) return;
  const rows = (preview.value as any)._rows || [];
  if (!rows.length) return ElMessage.warning('没有可导入的有效行');

  // R22 防误点二次确认：循环跑起来就要 1-2 分钟，提示一下让用户先确认
  try {
    await ElMessageBox.confirm(
      `即将导入 ${rows.length} 条客户，是否继续？`,
      '确认导入',
      { confirmButtonText: '确认', cancelButtonText: '取消', type: 'info' },
    );
  } catch {
    return; // 用户点取消
  }

  importing.value = true;
  let n = 0, fail = 0;
  try {
    for (const r of rows) {
      try {
        await customerApi.create({
          name: r.name, code: r.code, category: r.category, followStage: r.followStage, source: r.source,
          industry: r.industry, valueRating: r.valueRating, address: r.address, legalPerson: r.legalPerson,
          contacts: r.contacts || [], submitStatus: 'active',
        });
        n++;
      } catch (e: any) {
        fail++;
        // 单条失败不阻塞整体（继续后续行）；错误详情去 console 看
        console.error('[import] 单条失败', r.name, e?.message);
      }
    }
    if (fail === 0) {
      ElMessage.success(`成功导入 ${n} 条`);
    } else {
      ElMessage.warning(`成功 ${n} 条，失败 ${fail} 条（详见控制台）`);
    }
    preview.value = null;
  } finally {
    importing.value = false; // R22 关键：无论成败或异常，必须释放按钮（catch 不到的同步 throw 也兜住）
  }
}
</script>
