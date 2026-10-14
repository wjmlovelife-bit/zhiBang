<template>
  <div>
    <el-card>
      <el-page-header @back="goBack" :content="isView ? '查看合同' : (isEdit ? '编辑合同' : '新建合同')" style="margin-bottom:16px" />
      <el-form :model="form" label-width="110px" :disabled="isView">
        <el-row :gutter="16">
          <el-col :span="8"><el-form-item label="合同编号"><el-input v-model="form.code" :placeholder="codePlaceholder" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="合同标题"><el-input v-model="form.title" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="签约日期"><el-date-picker v-model="form.signDate" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="8"><el-form-item label="客户">
            <el-select v-model="form.customerName" filterable remote :remote-method="searchCustomer" style="width:100%" placeholder="搜索客户" clearable>
              <el-option v-for="c in custOpts" :key="c.id" :label="c.name" :value="c.name" />
            </el-select>
          </el-form-item></el-col>
          <el-col :span="8"><el-form-item label="关联项目编号"><el-input v-model="form.opportunityCode" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="币种"><el-select v-model="form.currencyCode" style="width:100%"><el-option v-for="o in curr" :key="o" :label="o" :value="o" /></el-select></el-form-item></el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="8"><el-form-item label="负责人"><el-input v-model="form.ownerName" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="签约地点"><el-input v-model="form.signPlace" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="品牌"><el-input v-model="form.brand" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="8"><el-form-item label="开始日期"><el-date-picker v-model="form.startDate" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="结束日期"><el-date-picker v-model="form.endDate" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="交付方式"><el-input v-model="form.paybackMode" /></el-form-item></el-col>
        </el-row>

        <el-divider content-position="left">合同明细</el-divider>
        <el-button size="small" :disabled="isView" @click="addLine">+ 添加明细</el-button>
        <el-table :data="form.lines" border style="margin-top:10px">
          <el-table-column label="产品名称" min-width="150"><template #default="{row}"><el-input v-model="row.productName" /></template></el-table-column>
          <el-table-column label="数量" width="100"><template #default="{row}"><el-input v-model="row.quantity" @input="recalc(row)" /></template></el-table-column>
          <el-table-column label="单价" width="110"><template #default="{row}"><el-input v-model="row.unitPrice" @input="recalc(row)" /></template></el-table-column>
          <el-table-column label="折扣%" width="90"><template #default="{row}"><el-input v-model="row.discount" @input="recalc(row)" /></template></el-table-column>
          <el-table-column label="税率%" width="90"><template #default="{row}"><el-input v-model="row.taxRate" @input="recalc(row)" /></template></el-table-column>
          <el-table-column label="金额" width="120"><template #default="{row}"><el-input v-model="row.amount" readonly /></template></el-table-column>
          <el-table-column label="交付日期" width="140"><template #default="{row}"><el-date-picker v-model="row.deliveryDate" type="date" value-format="YYYY-MM-DD" style="width:100%" /></template></el-table-column>
          <el-table-column label="交付方式" width="120"><template #default="{row}"><el-input v-model="row.deliveryMode" /></template></el-table-column>
          <el-table-column label="说明" min-width="120"><template #default="{row}"><el-input v-model="row.intro" /></template></el-table-column>
          <el-table-column label="操作" width="70"><template #default="{$index}"><el-button link type="danger" :disabled="isView" @click="form.lines.splice($index,1)">删</el-button></template></el-table-column>
        </el-table>

        <el-divider content-position="left">付款计划</el-divider>
        <el-button size="small" :disabled="isView" @click="addPlan">+ 添加计划</el-button>
        <el-table :data="form.paymentPlans" border style="margin-top:10px">
          <el-table-column label="序号" width="80"><template #default="{row}"><el-input v-model="row.seq" /></template></el-table-column>
          <el-table-column label="计划日期" width="160"><template #default="{row}"><el-date-picker v-model="row.planDate" type="date" value-format="YYYY-MM-DD" style="width:100%" /></template></el-table-column>
          <el-table-column label="金额" width="140"><template #default="{row}"><el-input v-model="row.amount" /></template></el-table-column>
          <el-table-column label="备注" min-width="160"><template #default="{row}"><el-input v-model="row.remark" /></template></el-table-column>
          <el-table-column label="操作" width="70"><template #default="{$index}"><el-button link type="danger" :disabled="isView" @click="form.paymentPlans.splice($index,1)">删</el-button></template></el-table-column>
        </el-table>

        <el-form-item label="合同说明" style="margin-top:12px"><el-input v-model="form.intro" type="textarea" :rows="3" /></el-form-item>

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
import { contractApi, quotationApi } from '@/api';
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
  code:'', title:'', signDate:new Date().toISOString().slice(0,10), customerName:'', opportunityCode:'',
  currencyCode:'人民币', ownerName:'', signPlace:'', brand:'', startDate:'', endDate:'', paybackMode:'',
  intro:'', approvalState:'draft', lines:[] as any[], paymentPlans:[] as any[],
});
const form = reactive(blank());

function recalc(row:any){
  const q = parseFloat(row.quantity)||0; const u = parseFloat(row.unitPrice)||0;
  const d = parseFloat(row.discount)||0; const t = parseFloat(row.taxRate)||0;
  const before = q*u*(1-d/100);
  row.amount = Math.round(before*(1+t/100)*100)/100;
}
function addLine(){ form.lines.push({productName:'',quantity:'',unitPrice:'',discount:'',taxRate:'',amount:'',deliveryMode:'',intro:''}); }
function addPlan(){ form.paymentPlans.push({seq:form.paymentPlans.length+1, planDate:'', amount:'', remark:''}); }
async function searchCustomer(kw:string){ if(!kw) return; custOpts.value = await quotationApi.searchCustomer(kw); }

async function loadDetail(){
  const d:any = await contractApi.detail(id);
  Object.assign(form, d, {
    lines:(d.lines||[]).map(({id,contractId,createdAt,updatedAt,...r}:any)=>r),
    paymentPlans:(d.paymentPlans||[]).map(({id,contractId,createdAt,updatedAt,...r}:any)=>r),
  });
}
async function save(state:string){
  form.approvalState = state;
  const payload:any = {...form};
  if(!isEdit.value && !form.code) payload.code = codePlaceholder.value || undefined;
  try{
    if(isEdit.value) await contractApi.update(id, payload);
    else await contractApi.create(payload);
    ElMessage.success('已保存');
    router.push('/sales/contract');
  }catch{}
}
function previewPdf(){
  const token = localStorage.getItem('token') || '';
  openPdfPreview(`${contractApi.pdfUrl(id)}?token=${token}`, `合同-${id}.pdf`);
}

// 统一方案 A：history.back()，无历史栈时兜底跳到本模块列表
function goBack() {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.replace('/sales/contract');
  }
}
onMounted(async()=>{
  codePlaceholder.value = (await contractApi.nextCode())||'';
  if(isEdit.value) await loadDetail();
});
</script>
