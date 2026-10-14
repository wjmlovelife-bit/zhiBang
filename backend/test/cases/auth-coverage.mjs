// cases/auth-coverage.mjs —— 登录场景细化：错误密码 / 空 body / 异常字符 / 不存在用户 / 并发 / 多账号
export const name = '登录场景细化';
export async function run(ctx) {
  const t = ctx.case;

  // ★ 登录入参现在用 LoginDto + class-validator 校验：
  //   - 空 body / 空 username / 空 password → 400（结构错误）
  //   - NoSQL 注入（{ $ne: null }）→ 400（类型错误）
  //   - 错误密码 / 不存在用户 → 401（业务错误）

  // 1. 正确密码
  const ok = await ctx.login('admin', '112233');
  t.ok(ok.status === 200 || ok.status === 201, `admin 正确密码应 200（${ok.status}）`);

  // 2. 错误密码
  const wrong = await ctx.login('admin', 'wrong_pwd_xx');
  t.ok(wrong.status === 401, `错误密码应拒 401（${wrong.status}）`);

  // 3. 空 username（DTO 校验拦截）
  const emptyU = await ctx.req('POST', '/auth/login', { body: { username: '', password: '123456' } });
  t.ok(emptyU.status === 400, `空 username 应被 DTO 拒为 400（${emptyU.status}）`);

  // 4. 空 password（DTO 校验拦截）
  const emptyP = await ctx.req('POST', '/auth/login', { body: { username: 'admin', password: '' } });
  t.ok(emptyP.status === 400, `空 password 应被 DTO 拒为 400（${emptyP.status}）`);

  // 5. 完全空 body（DTO 校验拦截）
  const emptyBody = await ctx.req('POST', '/auth/login', {});
  t.ok(emptyBody.status === 400, `空 body 应被 DTO 拒为 400（${emptyBody.status}）`);

  // 6. 不存在用户
  const noUser = await ctx.login('no_such_user_zzz', 'whatever');
  t.ok(noUser.status === 401, `不存在用户应拒 401（${noUser.status}）`);

  // 7. SQL 注入字符（DTO 类型校验拦截，因 username 不是字符串会被拒）
  const inj1 = await ctx.login("admin' OR '1'='1", 'x');
  t.ok(inj1.status === 401, `注入 username 应被业务拒 401（${inj1.status}）`);

  // 8. NoSQL 注入（DTO 类型校验拦截，{ $ne: null } 不是 string → 400）
  const inj2 = await ctx.req('POST', '/auth/login', {
    body: { username: { $ne: null }, password: { $ne: null } },
  });
  t.ok(inj2.status === 400, `NoSQL 注入应被 DTO 拒为 400（${inj2.status}）`);

  // 9. 大字段 username（边界）
  const big = 'x'.repeat(1024);
  const bigRes = await ctx.login(big, 'x');
  t.ok(bigRes.status === 400, `长 username 应被 MaxLength 拒为 400（${bigRes.status}）`);

  // 10. 并发：5 个并行登录，全部应得到独立 token
  const conc = await Promise.all([
    ctx.login('admin', '112233'),
    ctx.login('admin', '112233'),
    ctx.login('admin', '112233'),
    ctx.login('admin', '112233'),
    ctx.login('admin', '112233'),
  ]);
  let concOK = 0;
  for (const r of conc) if (r.token) concOK++;
  t.ok(concOK === 5, `并发 5 个 admin 登录全部成功（${concOK}/5）`);

  // 11. 多账号：sales01 也应能登录
  const sales = await ctx.login('sales01', '123456');
  t.ok(sales.status === 200 || sales.status === 201, `sales01 可登录（${sales.status}）`);
  t.ok(!!sales.token, 'sales01 返回 token');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { standalone } = await import('../lib/runner.mjs');
  await standalone({ name, run });
}
