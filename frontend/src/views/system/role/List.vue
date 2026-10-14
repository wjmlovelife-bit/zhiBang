<template>
  <div>
    <div style="margin-bottom: 12px">
      <el-button type="primary" v-perm="'role:create'" @click="openCreate">新建角色</el-button>
    </div>
    <el-table :data="list" border stripe>
      <el-table-column prop="code" label="编码" width="140" />
      <el-table-column prop="name" label="名称" width="140" />
      <el-table-column label="数据范围" width="140">
        <template #default="{ row }">{{ scopeLabel(row.dataScope) }}</template>
      </el-table-column>
      <el-table-column label="系统角色" width="100">
        <template #default="{ row }"><el-tag :type="row.isSystem ? 'warning' : 'info'">{{ row.isSystem ? '是' : '否' }}</el-tag></template>
      </el-table-column>
      <el-table-column label="操作" width="280">
        <template #default="{ row }">
          <el-button link type="primary" v-perm="'role:assign'" @click="openMenus(row)">菜单模板</el-button>
          <el-button link type="primary" v-perm="'role:assign'" @click="openOps(row)">操作模板</el-button>
          <el-button link type="primary" v-perm="'role:update'" @click="openEdit(row)">编辑</el-button>
          <el-button link type="danger" v-perm="'role:delete'" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 角色 CRUD -->
    <el-dialog v-model="dlg" :title="form.id ? '编辑角色' : '新建角色'" width="440px">
      <el-form :model="form" label-width="90px">
        <el-form-item label="编码"><el-input v-model="form.code" :disabled="!!form.id" /></el-form-item>
        <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="数据范围">
          <el-select v-model="form.dataScope" style="width: 100%">
            <el-option v-for="(v, k) in scopeMap" :key="k" :label="v" :value="Number(k)" />
          </el-select>
        </el-form-item>
        <el-form-item label="系统角色"><el-switch v-model="form.isSystem" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dlg = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>

    <!-- 菜单模板 -->
    <el-dialog v-model="menuDlg" :title="`菜单模板 - ${curName}`" width="420px">
      <el-tree ref="menuTreeRef" :data="menuTree" node-key="id" :props="{ label: 'name' }" show-checkbox default-expand-all :default-checked-keys="checkedMenuIds" />
      <template #footer>
        <el-button @click="menuDlg = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveMenus">保存</el-button>
      </template>
    </el-dialog>

    <!-- 操作模板 -->
    <el-dialog v-model="opDlg" :title="`操作模板 - ${curName}`" width="520px">
      <el-checkbox-group v-model="checkedOpCodes">
        <div v-for="(ops, mod) in groupedOps" :key="mod" style="margin-bottom: 10px">
          <div style="font-weight: 600; margin-bottom: 4px">{{ mod }}</div>
          <el-checkbox v-for="o in ops" :key="o.code" :value="o.code" :label="o.name" border style="margin: 2px" />
        </div>
      </el-checkbox-group>
      <template #footer>
        <el-button @click="opDlg = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveOps">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { sysApi } from '@/api';
import { buildTree } from '@/utils/tree';

const scopeMap: Record<number, string> = { 1: '全部数据', 2: '本部门及下级', 3: '本部门', 4: '仅本人', 5: '自定义' };
const scopeLabel = (s: number) => scopeMap[s] || `范围${s}`;

const list = ref<any[]>([]);
const dlg = ref(false);
const saving = ref(false);
const form = ref<any>({ code: '', name: '', dataScope: 4, isSystem: false });

const menuDlg = ref(false);
const opDlg = ref(false);
const curId = ref<number | null>(null);
const curName = ref('');
const menuTree = ref<any[]>([]);
const checkedMenuIds = ref<number[]>([]);
const menuTreeRef = ref<any>(null);
const groupedOps = ref<Record<string, any[]>>({});
const checkedOpCodes = ref<string[]>([]);

async function load() {
  list.value = await sysApi.roles();
}
function openCreate() {
  form.value = { code: '', name: '', dataScope: 4, isSystem: false };
  dlg.value = true;
}
function openEdit(row: any) {
  form.value = { ...row };
  dlg.value = true;
}
async function save() {
  if (!form.value.code || !form.value.name) return ElMessage.warning('编码和名称为必填');
  saving.value = true;
  try {
    if (form.value.id) await sysApi.roleUpdate(form.value.id, form.value);
    else await sysApi.roleCreate(form.value);
    ElMessage.success('已保存');
    dlg.value = false;
    load();
  } finally {
    saving.value = false;
  }
}
async function remove(row: any) {
  await ElMessageBox.confirm(`确认删除角色「${row.name}」?`, '提示', { type: 'warning' });
  await sysApi.roleDelete(row.id);
  ElMessage.success('已删除');
  load();
}

async function openMenus(row: any) {
  curId.value = row.id;
  curName.value = row.name;
  const [all, ids] = await Promise.all([sysApi.menusAll(), sysApi.roleMenus(row.id)]);
  menuTree.value = buildTree(all);
  checkedMenuIds.value = ids;
  menuDlg.value = true;
}
async function saveMenus() {
  saving.value = true;
  try {
    const ids = menuTreeRef.value?.getCheckedKeys() || [];
    await sysApi.roleSetMenus(curId.value!, ids);
    ElMessage.success('菜单模板已保存');
    menuDlg.value = false;
  } finally {
    saving.value = false;
  }
}
async function openOps(row: any) {
  curId.value = row.id;
  curName.value = row.name;
  const [ops, codes] = await Promise.all([sysApi.operations(), sysApi.roleOps(row.id)]);
  groupedOps.value = ops.reduce((acc: any, o: any) => {
    (acc[o.module || '其他'] ||= []).push(o);
    return acc;
  }, {});
  checkedOpCodes.value = codes;
  opDlg.value = true;
}
async function saveOps() {
  saving.value = true;
  try {
    await sysApi.roleSetOps(curId.value!, checkedOpCodes.value);
    ElMessage.success('操作模板已保存');
    opDlg.value = false;
  } finally {
    saving.value = false;
  }
}
onMounted(load);
</script>
