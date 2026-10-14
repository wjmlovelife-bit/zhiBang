// 轻量测试用例框架：累计 PASS/FAIL/WARN，支持单文件独立运行
export class Case {
  constructor(name) {
    this.name = name;
    this.pass = 0;
    this.fail = 0;
    this.warns = 0;
    this.lines = [];
  }
  ok(cond, msg) {
    if (cond) {
      this.pass++;
      this.lines.push('  ✅ ' + msg);
    } else {
      this.fail++;
      this.lines.push('  ❌ ' + msg);
    }
  }
  warn(cond, msg) {
    // 环境依赖型断言（如 PDF 依赖 Chromium）：失败不计入失败数，仅提示
    if (cond) {
      this.pass++;
      this.lines.push('  ✅ ' + msg);
    } else {
      this.warns++;
      this.lines.push('  ⚠️ ' + msg + '（环境依赖，未计失败）');
    }
  }
  log(msg) {
    this.lines.push('  · ' + msg);
  }
  summary() {
    return `${this.name}: ${this.pass}✅ ${this.fail}❌ ${this.warns}⚠️`;
  }
}

// 单文件直接运行时的引导：用 admin 登录后跑该用例
export async function standalone(mod) {
  const { req, login } = await import('./http.mjs');
  const a = await login('admin', '123456');
  if (!a.token) {
    console.log('❌ 无法以 admin 登录，检查后端是否启动');
    process.exit(1);
  }
  const ctx = { req, login, tokens: { admin: a.token }, users: { admin: a.user } };
  const inst = new Case(mod.name);
  try {
    await mod.run({ ...ctx, case: inst });
  } catch (e) {
    inst.fail++;
    inst.lines.push('  ❌ 运行异常: ' + e.message);
  }
  inst.lines.forEach((l) => console.log(l));
  console.log(inst.summary());
  process.exit(inst.fail ? 1 : 0);
}
