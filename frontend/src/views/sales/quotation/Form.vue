<template>
  <div>
    <el-card>
      <el-page-header @back="goBack" :content="isView ? '查看报价' : (isEdit ? '编辑报价' : '新建报价')" style="margin-bottom:16px" />
      <el-form :model="form" label-width="110px" :disabled="isView">
        <el-row :gutter="16">
          <el-col :span="8"><el-form-item label="报价编号"><el-input v-model="form.code" :placeholder="codePlaceholder" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="标题"><el-input v-model="form.title" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="日期"><el-date-picker v-model="form.date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="8"><el-form-item label="客户"><el-select v-model="form.customerName" filterable remote :remote-method="searchCustomer" style="width:100%" placeholder="搜索客户"><el-option v-for="c in custOpts" :key="c.id" :label="c.name" :value="c.name" /></el-select></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="联系人"><el-input v-model="form.contactName" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="币种"><el-select v-model="form.currencyCode" style="width:100%"><el-option v-for="o in curr" :key="o" :label="o" :value="o" /></el-select></el-form-item></el-col>
        </el-row>
        <el-form-item label="关联项目编号"><el-input v-model="form.opportunityCode" /></el-form-item>

        <el-divider content-position="left">报价明细</el-divider>
        <el-button size="small" :disabled="isView" @click="addLine">+ 添加明细</el-button>
        <el-table :data="form.lines" border style="margin-top:10px">
          <el-table-column label="产品名称" min-width="140"><template #default="{row}"><el-input v-model="row.productName" /></template></el-table-column>
          <el-table-column label="数量" width="100"><template #default="{row}"><el-input v-model="row.quantity" @input="recalc(row)" /></template></el-table-column>
          <el-table-column label="单价" width="110"><template #default="{row}"><el-input v-model="row.unitPrice" @input="recalc(row)" /></template></el-table-column>
          <el-table-column label="折扣" width="90"><template #default="{row}"><el-input v-model="row.discount" @input="recalc(row)" /></template></el-table-column>
          <el-table-column label="税率%" width="90"><template #default="{row}"><el-input v-model="row.taxRate" @input="recalc(row)" /></template></el-table-column>
          <el-table-column label="金额" width="120"><template #default="{row}"><el-input v-model="row.amount" readonly /></template></el-table-column>
          <el-table-column label="操作" width="70"><template #default="{$index}"><el-button link type="danger" :disabled="isView" @click="form.lines.splice($index,1)">删</el-button></template></el-table-column>
        </el-table>

        <el-form-item label="报价说明" style="margin-top:12px"><el-input v-model="form.intro" type="textarea" :rows="3" /></el-form-item>

        <div style="margin-top:20px; text-align:right">
          <el-button @click="goBack">返回</el-button>
          <el-button v-if="isEdit" @click="previewPdf">预览/下载 PDF</el-button>
          <template v-if="!isView">
            <el-button @click="save('draft')">存草稿</el-button>
            <el-button type="primary" @click="save('approved')">提交</el-button>
          </template>
        </div>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { quotationApi, sysApi } from '@/api';
import { openPdfPreview } from '@/composables/usePdfPreview';

const route = useRoute();
const router = useRouter();
const isEdit = computed(()=>!!route.params.id);
const id = Number(route.params.id);
const isView = computed(()=>route.query.mode === 'view');
const codePlaceholder = ref('');
const custOpts = ref<any[]>([]);
const curr = ['人民币','美元','欧元','日元','英镑','港币','其他'];

const blank = ()=>({
  code:'', title:'', date:new Date().toISOString().slice(0,10), customerName:'', contactName:'',
  currencyCode:'人民币', opportunityCode:'', intro:'', approvalState:'draft', lines:[] as any[],
});
const form = reactive(blank());

function recalc(row:any){
  const q = parseFloat(row.quantity)||0; const u = parseFloat(row.unitPrice)||0;
  const d = parseFloat(row.discount)||0; const t = parseFloat(row.taxRate)||0;
  const before = q*u*(1-d/100);
  row.amount = Math.round(before*(1+t/100)*100)/100;
}
function addLine(){ form.lines.push({productName:'',quantity:'',unitPrice:'',discount:'',taxRate:'',amount:''}); }
async function searchCustomer(kw:string){ if(!kw) return; custOpts.value = await quotationApi.searchCustomer(kw); }

async function loadDetail(){
  const d:any = await quotationApi.detail(id);
  Object.assign(form, d, { lines:(d.lines||[]).map(({id,quotationId,createdAt,updatedAt,...r}:any)=>r) });
}
async function save(state:string){
  form.approvalState = state;
  const payload:any = {...form};
  if(!isEdit.value && !form.code) payload.code = codePlaceholder.value || undefined;
  try{
    if(isEdit.value) await quotationApi.update(id, payload);
    else await quotationApi.create(payload);
    ElMessage.success('已保存');
    router.push('/sales/quotation');
  }catch{}
}
function previewPdf(){
  const token = localStorage.getItem('token') || '';
  openPdfPreview(`${quotationApi.pdfUrl(id)}?token=${token}`, `报价单-${id}.pdf`);
}

// 统一方案 A：history.back()，无历史栈时兜底跳到本模块列表
function goBack() {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.replace('/sales/quotation');
  }
}
onMounted(async()=>{
  codePlaceholder.value = (await quotationApi.nextCode())||'';
  if(isEdit.value) await loadDetail();
});
</script>
