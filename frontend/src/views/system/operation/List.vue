<template>
  <div>
    <div style="margin-bottom: 12px; display: flex; gap: 8px">
      <el-button type="primary" v-perm="'operation:create'" @click="openCreate">新建操作</el-button>
    </div>
    <el-table :data="list" border stripe>
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="module" label="模块" width="110" />
      <el-table-column prop="group" label="分组" width="120" />
      <el-table-column prop="code" label="权限码" width="220" />
      <el-table-column prop="name" label="名称" />
      <el-table-column prop="sort" label="排序" width="80" />
      <el-table-column label="启用" width="80">
        <template #default="{ row }"><el-tag :type="row.isActive ? 'success' : 'info'">{{ row.isActive ? '是' : '否' }}</el-tag></template>
      </el-table-column>
      <el-table-column label="操作" width="150">
        <template #default="{ row }">
          <el-button link type="primary" v-perm="'operation:update'" @click="openEdit(row)">编辑</el-button>
          <el-button link type="danger" v-perm="'operation:delete'" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialog" :title="form.id ? '编辑操作' : '新建操作'" width="460px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="模块"><el-input v-model="form.module" placeholder="如 客户 / 系统" /></el-form-item>
        <el-form-item label="分组"><el-input v-model="form.group" placeholder="如 客户 / 用户" /></el-form-item>
        <el-form-item label="权限码"><el-input v-model="form.code" placeholder="如 crm:customer:view（唯一）" :disabled="!!form.id" /></el-form-item>
        <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="排序"><el-input-number v-model="form.sort" :min="0" /></el-form-item>
        <el-form-item label="启用"><el-switch v-model="form.isActive" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { sysApi } from '@/api';

const list = ref<any[]>([]);
const dialog = ref(false);
const saving = ref(false);
const form = ref<any>({ module: '', group: '', code: '', name: '', sort: 0, isActive: true });

async function load() {
  list.value = await sysApi.operations();
}
function openCreate() {
  form.value = { module: '', group: '', code: '', name: '', sort: 0, isActive: true };
  dialog.value = true;
}
function openEdit(row: any) {
  form.value = { ...row };
  dialog.value = true;
}
async function save() {
  if (!form.value.code || !form.value.name) return ElMessage.warning('权限码和名称为必填');
  saving.value = true;
  try {
    if (form.value.id) await sysApi.operationUpdate(form.value.id, form.value);
    else await sysApi.operationCreate(form.value);
    ElMessage.success('已保存');
    dialog.value = false;
    load();
  } finally {
    saving.value = false;
  }
}
async function remove(row: any) {
  await ElMessageBox.confirm(`确认删除操作「${row.name}」?`, '提示', { type: 'warning' });
  await sysApi.operationDelete(row.id);
  ElMessage.success('已删除');
  load();
}
onMounted(load);
</script>
