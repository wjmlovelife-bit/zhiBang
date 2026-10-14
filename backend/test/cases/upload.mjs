// cases/upload.mjs —— 附件：上传图片 / 下载 / 隔离 / 权限
export const name = '附件上传';
export async function run(ctx) {
  const t = ctx.case;

  // 上传端点不存在或要权限校验
  const noAuth = await ctx.req('POST', '/upload');
  t.ok(noAuth.status === 401 || noAuth.status === 400 || noAuth.status === 404, `无 token 上传返回 401/400/404（${noAuth.status}）`);

  // 上传一个最小 PNG（1x1 透明）
  const png = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6300010000000500010d0a2db40000000049454e44ae426082',
    'hex',
  );
  const fd = new FormData();
  fd.append('file', new Blob([png], { type: 'image/png' }), 't_auto.png');
  const up = await ctx.req('POST', '/upload', { token: ctx.tokens.admin, body: fd });
  // 上传可能要求模块目录（customer/file 等）或单文件
  t.ok(up.status === 200 || up.status === 201 || up.status === 400 || up.status === 404, `上传返回（${up.status}；接口形态视后端约定）`);

  // 下载一个肯定不存在的文件（@Public 装饰器让 getFile 跳过 JwtAuthGuard，文件不存在返回 404）
  const noFile = await ctx.req('GET', '/upload/no-such-file.png', { token: ctx.tokens.admin });
  t.ok(noFile.status === 404 || noFile.status === 400, `不存在的文件返回 4xx（${noFile.status}）`);
  // 裸 GET 也应能进 controller（@Public 标记），文件不存在时 404
  const noAuthFile = await ctx.req('GET', '/upload/no-such-file.png');
  t.ok(noAuthFile.status === 404, `裸 GET（@Public）不存在的文件应 404（${noAuthFile.status}）`);

  // ============ 问题15：中文文件名解码 + 下载响应头 ============
  // 上传一个中文名文件
  const txt = Buffer.from('hello\n中文内容\n', 'utf8');
  const fd2 = new FormData();
  fd2.append('file', new Blob([txt], { type: 'text/plain' }), '中文测试报告.txt');
  const up2 = await ctx.req('POST', '/upload', { token: ctx.tokens.admin, body: fd2 });
  t.ok(up2.status === 200 || up2.status === 201, `中文名文件上传 2xx（${up2.status}）`);
  t.ok(up2.data?.originalname === '中文测试报告.txt', `返回 originalname 解码正确（${up2.data?.originalname}）`);
  t.ok(typeof up2.data?.url === 'string' && up2.data.url.includes('originalname='), `url 包含 originalname query`);

  // 下载该文件：响应头应包含 Content-Disposition: attachment
  if (up2.data?.filename) {
    const dlPath = '/upload/' + up2.data.filename + '?originalname=' + encodeURIComponent(up2.data.originalname || up2.data.filename);
    // 带 token 下载（兼容 PDF 预览等方式）
    const dl = await ctx.req('GET', dlPath, { token: ctx.tokens.admin });
    t.ok(dl.status === 200, `下载中文名文件 200（${dl.status}）`);
    const cd = dl.headers.get('content-disposition') || '';
    t.ok(cd.startsWith('attachment;'), `Content-Disposition 应为 attachment（${cd.slice(0, 60)}）`);
    t.ok(cd.includes("filename*=UTF-8''") || cd.includes('filename='), `Content-Disposition 包含 filename 段`);
    // 解码后的中文名应能在 filename*=UTF-8'' 段里
    t.ok(cd.includes(encodeURIComponent('中文测试报告.txt')), `Content-Disposition 含 UTF-8 编码后的中文名`);

    // 关键：裸 GET（浏览器 <img src> / <a download>.click()）也能成功（@Public 装饰器）
    const dlPublic = await ctx.req('GET', dlPath);
    t.ok(dlPublic.status === 200, `裸 GET 下载（浏览器原生）200（${dlPublic.status}）`);
    const cdPublic = dlPublic.headers.get('content-disposition') || '';
    t.ok(cdPublic.startsWith('attachment;'), `裸 GET 也返回 attachment（${cdPublic.slice(0, 40)}）`);

    // 关键：图片裸 GET 应返回正确的 Content-Type（保证 <img> 渲染）
    const png = Buffer.from(
      '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6300010000000500010d0a2db40000000049454e44ae426082',
      'hex',
    );
    const fdPng = new FormData();
    fdPng.append('file', new Blob([png], { type: 'image/png' }), 'test.png');
    const upPng = await ctx.req('POST', '/upload', { token: ctx.tokens.admin, body: fdPng });
    if (upPng.data?.filename) {
      const dlPng = await ctx.req('GET', '/upload/' + upPng.data.filename);
      t.ok(dlPng.status === 200, `裸 GET 图片 200（${dlPng.status}）`);
      const ct = dlPng.headers.get('content-type') || '';
      t.ok(ct.startsWith('image/'), `图片 Content-Type 正确（${ct}）`);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { standalone } = await import('../lib/runner.mjs');
  await standalone({ name, run });
}
