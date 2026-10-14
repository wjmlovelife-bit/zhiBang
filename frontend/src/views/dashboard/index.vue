<template>
  <div>
    <el-card>
      <h2 style="margin-top: 0">工作台</h2>
      <p>欢迎使用陕西飞创腾达电子科技有限公司 CRM。请通过左侧菜单进入「销售管理」下的客户、项目、报价、合同模块。</p>
      <el-alert type="info" :closable="false" title="模块说明">
        <ul style="margin: 0; padding-left: 18px">
          <li><b>客户</b>：客户添加 / 导入 / 列表，支持继承给他人、跟进记录、草稿状态。</li>
          <li><b>项目</b>：商机改名的项目模块，含商品明细（可导出 PDF）、跟进、继承。</li>
          <li><b>报价</b>：销售报价单与明细。</li>
          <li><b>合同</b>：销售合同与明细、付款计划。</li>
        </ul>
      </el-alert>
    </el-card>
  </div>
</template>

<script setup lang="ts"></script>
