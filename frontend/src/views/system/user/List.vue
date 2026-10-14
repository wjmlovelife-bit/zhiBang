<template>
  <div>
    <div style="margin-bottom: 12px; display: flex; gap: 8px; flex-wrap: wrap">
      <el-button type="primary" v-perm="'user:create'" @click="openCreate">新建用户</el-button>
      <el-button v-perm="'user:import'" @click="importDlg = true">Excel 导入</el-button>
      <el-button v-perm="'user:import'" @click="downloadTpl">下载模板</el-button>
      <el-input v-model="kw" placeholder="搜索用户名/姓名" style="width: 200px" @keyup.enter="load" clearable @clear="load" />
      <el-button @click="load">查询</el-button>
    </div>

    <el-table :data="rows" border stripe v-loading="loading">
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="username" label="用户名" width="120" />
      <el-table-column prop="name" label="姓名" width="120" />
      <el-table-column prop="deptName" label="部门" width="120" />
      <el-table-column label="角色" min-width="160">
        <template #default="{ row }">
          <el-tag v-for="r in row.roles" :key="r.id" size="small" style="margin: 2px">{{ r.name }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="管理员" width="80">
        <template #default="{ row }"><el-tag :type="row.isAdmin ? 'danger' : 'info'">{{ row.isAdmin ? '是' : '否' }}</el-tag></template>
      </el-table-column>
      <el-table-column label="状态" width="80">
        <template #default="{ row }"><el-tag :type="row.isActive ? 'success' : 'info'">{{ row.isActive ? '启用' : '禁用' }}</el-tag></template>
      </el-table-column>
      <el-table-column label="操作" width="300" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" v-perm="'user:update'" @click="openEdit(row)">编辑</el-button>
          <el-button link type="primary" v-perm="'user:assign'" @click="openMenus(row)">菜单授权</el-button>
          <el-button link type="primary" v-perm="'user:assign'" @click="openOps(row)">操作授权</el-button>
          <el-button link type="primary" v-perm="'user:assign'" @click="openApply(row)">套用角色</el-button>
          <el-button link type="danger" v-perm="'user:delete'" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination style="margin-top: 12px" background layout="prev, pager, next, total" :total="total" :page-size="pageSize" v-model:current-page="page" @current-change="load" />

    <!-- 用户 CRUD -->
    <el-dialog v-model="dlg" :title="form.id ? '编辑用户' : '新建用户'" width="480px">
      <el-form :model="form" label-width="90px">
        <el-form-item label="用户名"><el-input v-model="form.username" :disabled="!!form.id" /></el-form-item>
        <el-form-item label="姓名"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="密码"><el-input v-model="form.password" type="password" :placeholder="form.id ? '留空则不修改' : '默认 123456'" /></el-form-item>
        <!-- 仅 admin 在编辑模式下显示"修改密码"按钮（点开弹窗输入原密码 + 新密码 → 自动退出登录） -->
        <el-form-item v-if="form.id && isAdminCurrent">
          <el-button link type="primary" @click="openChangePwd">修改密码</el-button>
        </el-form-item>
        <el-form-item label="部门">
          <el-select v-model="form.deptId" placeholder="请选择" clearable style="width: 100%">
            <el-option v-for="d in depts" :key="d.id" :label="d.name" :value="d.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="form.roleIds" multiple placeholder="请选择" style="width: 100%">
            <el-option v-for="r in roles" :key="r.id" :label="r.name" :value="r.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="管理员"><el-switch v-model="form.isAdmin" /></el-form-item>
        <el-form-item label="启用"><el-switch v-model="form.isActive" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dlg = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>

    <!-- 修改密码（嵌套挂在 root，append-to-body 避免与编辑弹窗 z-index 冲突） -->
    <el-dialog v-model="pwdDlg" :title="`修改密码 - ${form.name || ''}`" width="420px" append-to-body>
      <el-form :model="pwdForm" label-width="90px">
        <el-form-item label="原密码"><el-input v-model="pwdForm.oldPassword" type="password" show-password /></el-form-item>
        <el-form-item label="新密码"><el-input v-model="pwdForm.newPassword" type="password" show-password /></el-form-item>
        <el-form-item label="确认新密码"><el-input v-model="pwdForm.confirmPassword" type="password" show-password /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="pwdDlg = false">取消</el-button>
        <el-button type="primary" :loading="pwdSaving" @click="doChangePwd">确认修改</el-button>
      </template>
    </el-dialog>

    <!-- 菜单授权 -->
    <el-dialog v-model="menuDlg" :title="`菜单授权 - ${curName}`" width="420px">
      <el-tree ref="menuTreeRef" :data="menuTree" node-key="id" :props="{ label: 'name' }" show-checkbox default-expand-all :default-checked-keys="checkedMenuIds" />
      <template #footer>
        <el-button @click="menuDlg = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveMenus">保存</el-button>
      </template>
    </el-dialog>

    <!-- 操作授权 -->
    <el-dialog v-model="opDlg" :title="`操作授权 - ${curName}`" width="560px">
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

    <!-- 套用角色模板 -->
    <el-dialog v-model="applyDlg" :title="`套用角色模板 - ${curName}`" width="420px">
      <el-alert type="info" :closable="false" style="margin-bottom: 12px" title="将选中角色的菜单与操作权限复制为该用户的直接授权" />
      <el-select v-model="applyRoleId" placeholder="选择角色" style="width: 100%">
        <el-option v-for="r in roles" :key="r.id" :label="`${r.name}（${r.code}）`" :value="r.id" />
      </el-select>
      <template #footer>
        <el-button @click="applyDlg = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="doApply">套用</el-button>
      </template>
    </el-dialog>

    <!-- Excel 导入 -->
    <el-dialog v-model="importDlg" title="Excel 导入用户" width="460px">
      <el-upload drag :auto-upload="false" :limit="1" accept=".xlsx,.xls" :on-change="onFile">
        <el-icon><UploadFilled /></el-icon>
        <div>拖入或点击选择 Excel 文件</div>
      </el-upload>
      <div v-if="importResult" style="margin-top: 10px">
        共 {{ importResult.total }} 条，成功 {{ importResult.success }}，失败 {{ importResult.failed }}
      </div>
      <template #footer>
        <el-button @click="importDlg = false">关闭</el-button>
        <el-button type="primary" :loading="saving" :disabled="!file" @click="doImport">开始导入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { UploadFilled } from '@element-plus/icons-vue';
import { sysApi, authApi } from '@/api';
import { useUserStore } from '@/store/user';
import { buildTree } from '@/utils/tree';

const router = useRouter();
const userStore = useUserStore();

const rows = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);
const loading = ref(false);
const kw = ref('');

const depts = ref<any[]>([]);
const roles = ref<any[]>([]);
const menuTree = ref<any[]>([]);
const groupedOps = ref<Record<string, any[]>>({});

const dlg = ref(false);
const saving = ref(false);
const form = ref<any>({ username: '', name: '', password: '', deptId: null, roleIds: [], isAdmin: false, isActive: true });

// 当前登录用户是否管理员（决定是否显示"修改密码"按钮）
const isAdminCurrent = computed(() => {
  try { return !!JSON.parse(localStorage.getItem('user') || '{}').isAdmin; } catch { return false; }
});

// 当前登录用户的 id（用于判断 admin 改的是不是自己 → 决定要不要 logout）
const currentUserId = computed(() => {
  try { return JSON.parse(localStorage.getItem('user') || '{}').id; } catch { return undefined; }
});

// 修改密码弹窗状态
const pwdDlg = ref(false);
const pwdSaving = ref(false);
const pwdForm = ref({ oldPassword: '', newPassword: '', confirmPassword: '' });

function openChangePwd() {
  pwdForm.value = { oldPassword: '', newPassword: '', confirmPassword: '' };
  pwdDlg.value = true;
}

async function doChangePwd() {
  const { oldPassword, newPassword, confirmPassword } = pwdForm.value;
  if (!oldPassword) return ElMessage.warning('请输入原密码');
  if (!newPassword) return ElMessage.warning('请输入新密码');
  if (newPassword.length < 6) return ElMessage.warning('新密码长度不能少于 6 位');
  if (newPassword !== confirmPassword) return ElMessage.warning('两次输入的新密码不一致');
  pwdSaving.value = true;
  try {
    await authApi.changeUserPassword(form.value.id, { oldPassword, newPassword });
    pwdDlg.value = false;
    if (form.value.id === currentUserId.value) {
      // admin 改自己 → 强退
      ElMessage.success('密码修改成功，请用新密码重新登录');
      dlg.value = false;
      userStore.logout();
      router.push('/login');
    } else {
      // admin 改别人 → 保留编辑弹窗，仅提示
      ElMessage.success('已修改该用户密码');
    }
  } catch {
    // 业务错误（"原密码错误" / "仅管理员可修改密码"）已由 axios 拦截器统一 toast
  } finally {
    pwdSaving.value = false;
  }
}

const menuDlg = ref(false);
const opDlg = ref(false);
const applyDlg = ref(false);
const curId = ref<number | null>(null);
const curName = ref('');
const checkedMenuIds = ref<number[]>([]);
const checkedOpCodes = ref<string[]>([]);
const applyRoleId = ref<number | null>(null);
const menuTreeRef = ref<any>(null);

const importDlg = ref(false);
const file = ref<File | null>(null);
const importResult = ref<any>(null);

async function load() {
  loading.value = true;
  try {
    const res: any = await sysApi.usersPage({ page: page.value, pageSize: pageSize.value, keyword: kw.value });
    // R27 兼容：res 可能是包装 {code, data, ...} 或直接解包后的对象
    const payload = res?.data ?? res;
    rows.value = (payload.items || []).map((u: any) => ({ ...u, deptName: u.dept?.name || '-', roles: u.roles?.map((r: any) => r.role) || [] }));
    total.value = payload.total || 0;
  } finally {
    loading.value = false;
  }
}
async function ensureMeta() {
  if (!depts.value.length) depts.value = await sysApi.depts();
  if (!roles.value.length) roles.value = await sysApi.roles();
}

function openCreate() {
  ensureMeta();
  form.value = { username: '', name: '', password: '', deptId: null, roleIds: [], isAdmin: false, isActive: true };
  dlg.value = true;
}
function openEdit(row: any) {
  ensureMeta();
  form.value = { id: row.id, username: row.username, name: row.name, password: '', deptId: row.deptId ?? null, roleIds: (row.roles || []).map((r: any) => r.id), isAdmin: !!row.isAdmin, isActive: row.isActive !== false };
  dlg.value = true;
}
async function save() {
  if (!form.value.username || !form.value.name) return ElMessage.warning('用户名和姓名为必填');
  saving.value = true;
  try {
    const payload = { username: form.value.username, name: form.value.name, deptId: form.value.deptId ?? null, roleIds: form.value.roleIds, isAdmin: form.value.isAdmin, isActive: form.value.isActive };
    if (form.value.password) (payload as any).password = form.value.password;
    if (form.value.id) await sysApi.userUpdate(form.value.id, payload);
    else await sysApi.userCreate(payload);
    ElMessage.success('已保存');
    dlg.value = false;
    load();
  } finally {
    saving.value = false;
  }
}
async function remove(row: any) {
  await ElMessageBox.confirm(`确认删除用户「${row.name}」？删除后不可恢复。`, '提示', { type: 'warning' });
  await sysApi.userDelete(row.id);
  ElMessage.success('已删除');
  load();
}

async function openMenus(row: any) {
  curId.value = row.id;
  curName.value = row.name;
  const [all, ids] = await Promise.all([sysApi.menusAll(), sysApi.userMenus(row.id)]);
  menuTree.value = buildTree(all);
  checkedMenuIds.value = ids;
  menuDlg.value = true;
}
async function saveMenus() {
  saving.value = true;
  try {
    const ids = menuTreeRef.value?.getCheckedKeys() || [];
    await sysApi.userSetMenus(curId.value!, ids);
    ElMessage.success('菜单授权已保存');
    menuDlg.value = false;
  } finally {
    saving.value = false;
  }
}
async function openOps(row: any) {
  curId.value = row.id;
  curName.value = row.name;
  const [ops, codes] = await Promise.all([sysApi.operations(), sysApi.userOps(row.id)]);
  groupedOps.value = ops.reduce((acc: any, o: any) => { (acc[o.module || '其他'] ||= []).push(o); return acc; }, {});
  checkedOpCodes.value = codes;
  opDlg.value = true;
}
async function saveOps() {
  saving.value = true;
  try {
    await sysApi.userSetOps(curId.value!, checkedOpCodes.value);
    ElMessage.success('操作授权已保存');
    opDlg.value = false;
  } finally {
    saving.value = false;
  }
}
async function openApply(row: any) {
  await ensureMeta();
  curId.value = row.id;
  curName.value = row.name;
  applyRoleId.value = null;
  applyDlg.value = true;
}
async function doApply() {
  if (!applyRoleId.value) return ElMessage.warning('请选择角色');
  saving.value = true;
  try {
    await sysApi.userApplyRole(curId.value!, applyRoleId.value);
    ElMessage.success('已套用角色权限');
    applyDlg.value = false;
  } finally {
    saving.value = false;
  }
}

function downloadTpl() {
  sysApi.userTemplate().then((blob: any) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'user-import-template.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  });
}
function onFile(_: any, files: any[]) {
  file.value = files[0]?.raw || null;
}
async function doImport() {
  if (!file.value) return;
  saving.value = true;
  try {
    const res: any = await sysApi.userImport(file.value);
    importResult.value = res?.data ?? res;
    ElMessage.success(`导入完成：成功 ${res.success ?? res.data?.success} / 共 ${res.total ?? res.data?.total}`);
    load();
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>
