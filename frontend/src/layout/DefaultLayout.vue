<template>
  <el-container style="height: 100%">
    <el-aside width="220px" style="background: #001529">
      <div style="padding: 12px 16px; text-align: center">
        <img v-if="companyLogo" :src="companyLogo" style="max-height: 36px; max-width: 180px; display: block; margin: 0 auto 8px" />
        <div style="color: #fff; font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">
          {{ companyName || '陕西飞创腾达电子科技有限公司' }}
        </div>
      </div>
      <el-menu
        background-color="#001529"
        text-color="#fff"
        active-text-color="#409eff"
        :default-active="activeMenu"
        router
      >
        <template v-for="m in menus" :key="m.id">
          <el-sub-menu v-if="m.children && m.children.length" :index="String(m.id)">
            <template #title>{{ m.name }}</template>
            <el-menu-item
              v-for="c in m.children"
              :key="c.id"
              :index="c.path || String(c.id)"
            >
              {{ c.name }}
            </el-menu-item>
          </el-sub-menu>
          <el-menu-item v-else :index="m.path || String(m.id)">{{ m.name }}</el-menu-item>
        </template>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header
        style="
          background: #fff;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #eee;
        "
      >
        <span style="font-size: 16px; font-weight: 600">{{ pageTitle }}</span>
        <div>
          <el-tag type="info" style="margin-right: 12px">{{ user.name }}（{{ user.username }}）</el-tag>
          <el-button text @click="doLogout">退出</el-button>
        </div>
      </el-header>
      <el-main>
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { sysApi } from '@/api';
import { useUserStore } from '@/store/user';
import { logger } from '@/utils/logger';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const user = computed(() => userStore.user);
const menus = ref<any[]>([]);
const companyName = ref('');
const companyLogo = ref('');
const activeMenu = computed(() => route.path);
const pageTitle = computed(() => (route.meta.title as string) || '');

onMounted(async () => {
  try {
    const data = await sysApi.menus();
    menus.value = data || [];
    userStore.setMenus(menus.value);
  } catch (e: any) {
    // 不再空 catch：失败也要在控制台留痕，方便对照 X-Request-Id 排查
    // 401 时 axios 拦截器会跳 /login，这里只补一笔日志
    logger.error('[DefaultLayout] menus failed', e?.response?.status, e?.response?.data);
  }
  try {
    const c: any = await sysApi.company();
    if (c?.name) companyName.value = c.name;
    if (c?.logoUrl) companyLogo.value = c.logoUrl;
  } catch (e: any) {
    // 静默失败，不显示错误提示（公司信息仅展示用，缺失不影响主流程）
    if (e?.response?.status !== 403) logger.error('加载公司信息失败', e);
  }
});

function doLogout() {
  userStore.logout();
  router.push('/login');
}
</script>
