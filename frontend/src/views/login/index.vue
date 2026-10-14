<template>
  <div class="login-wrap">
    <el-card class="login-card">
      <h2 style="text-align: center; margin-top: 0">飞创腾达</h2>
      <el-form :model="form" label-width="70px" @submit.prevent>
        <el-form-item label="姓名">
          <el-input v-model="form.username" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" placeholder="请输入密码" autocomplete="new-password" @keyup.enter="doLogin" />
        </el-form-item>
        <el-button type="primary" style="width: 100%" :loading="loading" @click="doLogin">登录</el-button>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { authApi } from '@/api';
import { useUserStore } from '@/store/user';
import { logger } from '@/utils/logger';

const router = useRouter();
const route = useRoute();
const userStore = useUserStore();
const form = reactive({ username: '', password: '' });
const loading = ref(false);

// 仅记住上次登录成功的用户名；密码永不存（安全要求）
const LAST_USERNAME_KEY = 'lastUsername';
onMounted(() => {
  const last = localStorage.getItem(LAST_USERNAME_KEY);
  if (last) form.username = last;
});

async function doLogin() {
  logger.debug('[login] doLogin start', { username: (form.username || '').trim() });
  // trim 防"admin "带空格匹配不到；空值校验先于网络请求
  const username = (form.username || '').trim();
  const password = form.password || '';
  if (!username || !password) {
    ElMessage.warning('请输入用户名和密码');
    return;
  }
  loading.value = true;
  try {
    logger.debug('[login] calling authApi.login...', { url: '/api/auth/login', username });
    const res: any = await authApi.login(username, password);
    logger.debug('[login] authApi.login OK, token length =', res?.token?.length, 'user =', res?.user?.username);
    localStorage.setItem('token', res.token);
    localStorage.setItem(LAST_USERNAME_KEY, username);
    // R27 兼容：登录响应有包装（{code,message,data:{token,user},requestId}），
    // 但前端 axios 拦截器已自动 unwrap，所以 res 直接是 {token, user}。
    // 兼容旧缓存用户（permissions 字段可能缺失），用 ?? [] 兜底。
    const u = res.user;
    if (u) {
      userStore.setUser({
        ...u,
        permissions: u.permissions || [],
        roleCodes: u.roleCodes || [],
      });
    }
    ElMessage.success('登录成功');
    // 若 admin 重置了此用户的密码 → 弹模态提示一次，关闭后调 clear-password-flag 清标记
    if (u?.mustResetPassword) {
      // 异步弹模态（不阻塞 router.push）
      ElMessageBox.alert('您的密码已被管理员重置，下次登录将不再提示。', '密码已被重置', {
        type: 'info',
        confirmButtonText: '我知道了',
      })
        .catch(() => {/* 用户关闭 */})
        .finally(() => {
          // 调清除接口（即使失败也不影响用户进入主界面）
          authApi.clearPasswordFlag().catch((e) => logger.warn('[login] clearPasswordFlag failed', e));
        });
    }
    logger.debug('[login] token saved, pushing to /');
    const redirect = (route.query.redirect as string) || '/';
    router.push(redirect);
    logger.debug('[login] router.push(', redirect, ') called');
  } catch (e: any) {
    logger.debug('[login] authApi.login FAILED', {
      status: e?.response?.status,
      data: e?.response?.data,
      message: e?.message,
    });
    // 控制台永远留痕，方便对照后端 X-Request-Id 排查
    logger.error('[login] failed', {
      status: e?.response?.status,
      detail: e?.response?.data,
      message: e?.message,
    });
    // 401/400 等凭证错误 → 清残留 token（否则路由守卫看到残留 token 又会跳走）
    if (e?.response?.status === 401 || e?.response?.status === 400) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    // 网络层错误（后端没起 / 端口不通 / 超时）单独提示
    if (!e?.response) {
      ElMessage.error('无法连接到服务器，请确认后端已启动（默认 http://localhost:3001）');
    }
    // 其它业务错误（用户名密码错、账号禁用 等）已由 axios 拦截器统一 toast
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-wrap {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1e3c72, #2a5298);
}
.login-card {
  width: 360px;
  padding: 10px 24px 24px;
}
</style>
