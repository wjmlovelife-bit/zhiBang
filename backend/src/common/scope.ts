import { PrismaService } from '../prisma/prisma.service';

/**
 * 数据范围 scope 约定：
 * 1 全部 | 2 本部门及下级 | 3 本部门 | 4 本人 | 5 自定义部门
 * user 需包含：dataScope, deptId, id, customDeptIds(可选, 数字数组或 JSON 串)
 */
export async function applyDataScope(
  prisma: PrismaService,
  user: any,
  baseWhere: any = {},
  options?: { ownerFields?: string[] },
): Promise<any> {
  const scope = user?.dataScope;
  const ownerFields = options?.ownerFields ?? ['ownerId', 'createdById'];

  // 1 全部：不加任何过滤
  if (!scope || scope === 1) return baseWhere;

  // 4 本人：owner / creator 任一等于自己
  if (scope === 4) {
    const or = ownerFields.filter(Boolean).map((f) => ({ [f]: user.id }));
    // 用 AND 嵌套避免 baseWhere 里的 OR 同 key 被覆盖（搜索 keyword 丢失的 bug）
    return { AND: [baseWhere, { OR: or }] };
  }

  // 5 自定义部门列表
  let customDeptIds: number[] = [];
  if (user.customDeptIds) {
    try {
      customDeptIds = Array.isArray(user.customDeptIds)
        ? user.customDeptIds
        : JSON.parse(user.customDeptIds);
    } catch {
      customDeptIds = [];
    }
  }

  let deptIds: number[] = [];
  if (scope === 3) {
    deptIds = user.deptId ? [user.deptId] : [];
  } else if (scope === 2) {
    deptIds = await getDeptSubtreeIds(prisma, user.deptId);
  } else if (scope === 5) {
    deptIds = customDeptIds.length ? customDeptIds : user.deptId ? [user.deptId] : [];
  }

  if (!deptIds.length) {
    // 无部门归属且非全部/本人，返回空集
    return { ...baseWhere, deptId: { in: [] } };
  }
  return { ...baseWhere, deptId: { in: deptIds } };
}

/** 返回 rootId 及其所有子孙部门 id 列表 */
export async function getDeptSubtreeIds(
  prisma: PrismaService,
  rootId?: number | null,
): Promise<number[]> {
  if (!rootId) return [];
  const all = await prisma.sysDept.findMany({ select: { id: true, parentId: true } });
  const childrenOf = (pid: number): number[] => {
    const kids = all.filter((d) => d.parentId === pid).map((d) => d.id);
    return kids.flatMap((k) => [k, ...childrenOf(k)]);
  };
  return [rootId, ...childrenOf(rootId)];
}
