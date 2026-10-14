<template>
  <div>
    <div style="margin-bottom: 12px">
      <el-button type="primary" v-perm="'dept:manage'" @click="openCreate(null)">新建根部门</el-button>
    </div>
    <el-table :data="tree" row-key="id" :tree-props="{ children: 'children' }" border default-expand-all>
      <el-table-column prop="name" label="部门名称" />
      <el-table-column prop="sort" label="排序" width="90" />
      <el-table-column label="操作" width="220">
        <template #default="{ row }">
          <el-button link type="primary" v-perm="'dept:manage'" @click="openCreate(row.id)">新增子级</el-button>
          <el-button link type="primary" v-perm="'dept:manage'" @click="openEdit(row)">编辑</el-button>
          <el-button link type="danger" v-perm="'dept:manage'" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialog" :title="form.id ? '编辑部门' : '新建部门'" width="420px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="上级">
          <el-select v-model="form.parentId" placeholder="无（根部门）" clearable style="width: 100%">
            <el-option v-for="d in flatDepts" :key="d.id" :label="d.name" :value="d.id" :disabled="isDescendant(d.id, form.id)" />
          </el-select>
        </el-form-item>
        <el-form-item label="排序"><el-input-number v-model="form.sort" :min="0" /></el-form-item>
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
import { buildTree } from '@/utils/tree';

const flatDepts = ref<any[]>([]);
const tree = ref<any[]>([]);
const dialog = ref(false);
const saving = ref(false);
const form = ref<any>({ name: '', parentId: null, sort: 0 });

async function load() {
  flatDepts.value = await sysApi.depts();
  tree.value = buildTree(flatDepts.value);
}
function isDescendant(candidateId: number, selfId: number | null) {
  if (!selfId) return false;
  if (candidateId === selfId) return true;
  const find = (nodes: any[]): boolean => nodes.some((n) => n.id === candidateId || find(n.children || []));
  const self = flatDepts.value.find((d) => d.id === selfId);
  // 通过 parentId 链判断 candidate 是否为 self 的后代
  let cur = self;
  while (cur && cur.parentId != null) {
    if (cur.parentId === candidateId) return true;
    cur = flatDepts.value.find((d) => d.id === cur!.parentId);
  }
  return false;
}
function openCreate(parentId: number | null) {
  form.value = { name: '', parentId, sort: 0 };
  dialog.value = true;
}
function openEdit(row: any) {
  form.value = { id: row.id, name: row.name, parentId: row.parentId ?? null, sort: row.sort ?? 0 };
  dialog.value = true;
}
async function save() {
  if (!form.value.name) return ElMessage.warning('请填写部门名称');
  saving.value = true;
  try {
    if (form.value.id) await sysApi.deptUpdate(form.value.id, { name: form.value.name, parentId: form.value.parentId ?? null, sort: form.value.sort });
    else await sysApi.deptCreate({ name: form.value.name, parentId: form.value.parentId ?? null, sort: form.value.sort });
    ElMessage.success('已保存');
    dialog.value = false;
    load();
  } finally {
    saving.value = false;
  }
}
async function remove(row: any) {
  await ElMessageBox.confirm(`确认删除部门「${row.name}」?`, '提示', { type: 'warning' });
  await sysApi.deptDelete(row.id);
  ElMessage.success('已删除');
  load();
}
onMounted(load);
</script>
