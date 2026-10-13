import { PrismaClient } from '@prisma/client';
import { PERMISSION_KEYS, ROLE_KEYS, ROLE_PERMISSIONS } from '../domain';

export async function ensureCatalogue(prisma: PrismaClient): Promise<void> {
  for (const key of PERMISSION_KEYS) {
    await prisma.permission.upsert({ where: { key }, update: {}, create: { key } });
  }
  for (const key of ROLE_KEYS) {
    const role = await prisma.role.upsert({ where: { key }, update: {}, create: { key } });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    for (const permissionKey of ROLE_PERMISSIONS[key]) {
      const permission = await prisma.permission.findUniqueOrThrow({ where: { key: permissionKey } });
      await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } });
    }
  }
}
