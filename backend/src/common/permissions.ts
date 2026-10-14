import { PrismaService } from '../prisma/prisma.service';

/** 计算用户的有效操作权限码（管理员=全部；普通用户=用户级授权并集） */
export async function computePermissions(prisma: PrismaService, user: any): Promise<string[]> {
  if (user.isAdmin) {
    const all = await prisma.sysOperation.findMany({ where: { isActive: true }, select: { code: true } });
    return all.map((o: any) => o.code);
  }
  const grants = await prisma.sysUserOperation.findMany({
    where: { userId: user.id },
    include: { operation: { select: { code: true, isActive: true } } },
  });
  return grants.filter((g: any) => g.operation?.isActive).map((g: any) => g.operation.code);
}
