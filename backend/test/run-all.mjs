// 端到端测试入口：登录一�?(admin/sales01)，顺序执行各模块用例，汇�? PASS/FAIL
import { req, login } from './lib/http.mjs';
import { Case } from './lib/runner.mjs';
import { PrismaClient } from '@prisma/client';
import * as startup from './cases/startup.mjs';
import * as auth from './cases/auth.mjs';
import * as authCoverage from './cases/auth-coverage.mjs';
import * as passwordChange from './cases/password-change.mjs';
import * as menu from './cases/menu.mjs';
import * as regions from './cases/regions.mjs';
import * as customer from './cases/customer.mjs';
import * as project from './cases/project.mjs';
import * as contract from './cases/contract.mjs';
import * as opportunity from './cases/opportunity.mjs';
import * as quotation from './cases/quotation.mjs';
import * as worklog from './cases/worklog.mjs';
import * as sysModule from './cases/sys.mjs';
import * as upload from './cases/upload.mjs';
import * as permission from './cases/permission.mjs';
import * as regression from './cases/regression.mjs';
import * as inventory from './cases/inventory.mjs';
import * as purchase from './cases/purchase.mjs';

const ctx = { req, login, Case };

const admin = await login('admin', '112233');
let sales = await login('sales01', '123456');
ctx.tokens = { admin: admin.token, sales: sales.token };
ctx.users = { admin: admin.user, sales: sales.user };

// R32 ����C ���䣺sales01 �� token �� password-change.mjs / permission.mjs �� case ������� tokenVersion++ ʧЧ
// ÿ�� case �����1) ���� sales01.tv=0��2) refreshSales �ص� + ��һ�νӿڴ��� cache miss �ؽ�
// ���� cache �� sales01 entry ��Զ tv=0������� ctx.tokens.sales (tv=0) һ��
const p = new PrismaClient();
ctx.refreshSales = async () => {
  // ���� sales01.tv=0���ƿ�ҵ������ cache invalidate��ǿ�� cache �ؽ���
  await p.sysUser.update({ where: { id: 2 }, data: { tokenVersion: 0 } });
  // ���µ�¼ sales01 ���� token��tv=0��
  sales = await login('sales01', '123456');
  ctx.tokens.sales = sales.token;
  ctx.users.sales = sales.user;
  // ����һ�� cache miss���ú�� cache д�� tv=0��
  const probe = await req('GET', '/sys/menus', { token: sales.token });
  console.log(`  [refreshSales] tv=${decodeJwt(sales.token).tv} /sys/menus=${probe.status} body=${(probe.raw||probe.text||'').substring(0, 100)}`);
  return sales.token;
};

function decodeJwt(t) {
  try { return JSON.parse(Buffer.from(t.split('.')[1], 'base64').toString('utf8')); }
  catch { return {}; }
}

console.log('=== 智邦管理系统 端到端测�? ===');
console.log('BASE    :', process.env.API_BASE || 'http://localhost:3001/api');
console.log('admin   :', admin.status, admin.token ? '�? token' : '�? �? token');
console.log('sales01 :', sales.status, sales.token ? '�? token' : '�? �? token');
if (!admin.token) {
  console.log('�? 无法获取 admin token，请确认后端已启动且账号可用');
  process.exit(1);
}

const cases = [startup, auth, authCoverage, passwordChange, menu, regions, customer, project, contract, opportunity, quotation, worklog, sysModule, upload, permission, regression, inventory, purchase];
let TP = 0,
  TF = 0,
  TW = 0;

for (const c of cases) {
  const inst = new Case(c.name);
  try {
    await c.run({ ...ctx, case: inst });
  } catch (e) {
    inst.fail++;
    inst.lines.push('  �? 运行异常: ' + e.message);
  }
  console.log('\n[' + inst.summary() + ']');
  inst.lines.forEach((l) => console.log(l));
  TP += inst.pass;
  TF += inst.fail;
  TW += inst.warns;

  // R32 ����C ���䣺ÿ�� case ��������� sales01.tv=0 + refreshSales
  // ���� sales01 token ʼ�� tv=0���� cache �� tv=0 һ��
  await ctx.refreshSales();
}

await p.$disconnect();

console.log(`\n=== 汇�?: ${TP}�?  ${TF}�?  ${TW}⚠️ ===`);
console.log(TF === 0 ? '全部通过 �?' : `存在 ${TF} 项失�? ❌`);
process.exit(TF ? 1 : 0);
