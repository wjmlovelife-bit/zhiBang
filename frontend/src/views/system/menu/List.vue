<template>
  <div>
    <div style="margin-bottom: 12px">
      <el-button type="primary" v-perm="'menu:view'" @click="openCreate(null)">新建根菜单</el-button>
    </div>
    <el-table :data="tree" row-key="id" :tree-props="{ children: 'children' }" border default-expand-all>
      <el-table-column prop="name" label="菜单名称" />
      <el-table-column prop="path" label="路由/路径" />
      <el-table-column prop="type" label="类型" width="90" />
      <el-table-column prop="sort" label="排序" width="80" />
      <el-table-column label="操作" width="220">
        <template #default="{ row }">
          <el-button link type="primary" v-perm="'menu:view'" @click="openCreate(row.id)">新增子级</el-button>
          <el-button link type="primary" v-perm="'menu:view'" @click="openEdit(row)">编辑</el-button>
          <el-button link type="danger" v-perm="'menu:view'" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialog" :title="form.id ? '编辑菜单' : '新建菜单'" width="440px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="路由路径"><el-input v-model="form.path" placeholder="如 /system/user，父菜单留空" /></el-form-item>
        <el-form-item label="类型">
          <el-select v-model="form.type" style="width: 100%">
            <el-option label="菜单(menu)" value="menu" />
            <el-option label="按钮(button)" value="button" />
          </el-select>
        </el-form-item>
        <el-form-item label="上级">
          <el-select v-model="form.parentId" placeholder="无（根菜单）" clearable style="width: 100%">
            <el-option v-for="m in flatMenus" :key="m.id" :label="`${m.name}`" :value="m.id" :disabled="m.id === form.id" />
          </el-select>
        </el-form-item>
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
import { buildTree } from '@/utils/tree';

const flatMenus = ref<any[]>([]);
const tree = ref<any[]>([]);
const dialog = ref(false);
const saving = ref(false);
const form = ref<any>({ name: '', path: '', type: 'menu', parentId: null, sort: 0, isActive: true });

async function load() {
  flatMenus.value = await sysApi.menusAll();
  tree.value = buildTree(flatMenus.value);
}
function openCreate(parentId: number | null) {
  form.value = { name: '', path: '', type: 'menu', parentId, sort: 0, isActive: true };
  dialog.value = true;
}
function openEdit(row: any) {
  form.value = { id: row.id, name: row.name, path: row.path || '', type: row.type || 'menu', parentId: row.parentId ?? null, sort: row.sort ?? 0, isActive: row.isActive ?? true };
  dialog.value = true;
}
async function save() {
  if (!form.value.name) return ElMessage.warning('请填写菜单名称');
  saving.value = true;
  try {
    const payload = { name: form.value.name, path: form.value.path || null, type: form.value.type, parentId: form.value.parentId ?? null, sort: form.value.sort, isActive: form.value.isActive };
    if (form.value.id) await sysApi.menuUpdate(form.value.id, payload);
    else await sysApi.menuCreate(payload);
    ElMessage.success('已保存');
    dialog.value = false;
    load();
  } finally {
    saving.value = false;
  }
}
async function remove(row: any) {
  await ElMessageBox.confirm(`确认删除菜单「${row.name}」?`, '提示', { type: 'warning' });
  await sysApi.menuDelete(row.id);
  ElMessage.success('已删除');
  load();
}
onMounted(load);
</script>
