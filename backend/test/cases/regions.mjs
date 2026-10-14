// 区域数据：省/市/区三级树，解析北京 id 供后续用例复用
function collectIds(tree) {
  const bj = (tree || []).find((p) => p.label === '北京市');
  const city = bj && bj.children && bj.children[0];
  const dist = city && city.children && city.children[0];
  return {
    stateId: bj ? bj.value : null,
    cityId: city ? city.value : null,
    districtId: dist ? dist.value : null,
    region: ['北京市', city && city.label, dist && dist.label].filter(Boolean),
  };
}

export const name = '区域数据';
export async function run(ctx) {
  const t = ctx.case;
  const r = await ctx.req('GET', '/sys/regions-tree', { token: ctx.tokens.admin });
  t.ok(r.status === 200, `regions-tree 返回 200（${r.status}）`);

  const provs = r.data || [];
  t.ok(provs.length === 34, `省级行政区数量 = 34（收到 ${provs.length}）`);
  t.ok(provs[0] && Array.isArray(provs[0].children) && provs[0].children.length > 0, '省级节点含下级市');

  const bj = provs.find((p) => p.label === '北京市');
  t.ok(!!bj, '找到「北京市」节点');
  if (bj) {
    t.ok(typeof bj.value === 'number', `北京市 id 为数字（${bj.value}）`);
    t.ok(bj.children && bj.children.length > 0, '北京市含市级节点');
  }

  ctx.regionIds = collectIds(r.data);
  t.ok(ctx.regionIds.stateId && ctx.regionIds.cityId, '成功解析省/市 id 供其他用例复用');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { standalone } = await import('../lib/runner.mjs');
  await standalone({ name, run });
}
