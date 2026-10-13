import { BadRequestException, Body, Controller, ForbiddenException, Get, NotFoundException, Param, Patch, Req } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RequirePermissions } from '../auth/auth.decorator';
import type { AuthedRequest } from '../auth/auth.guard';

const userSelect = { id: true, email: true, displayName: true, tenantId: true } as const;

@Controller('users')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('user.read')
  list(@Req() req: AuthedRequest) {
    const tenantId = req.auth!.tenantId;
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.user.findMany({ where: { tenantId }, select: userSelect, orderBy: { email: 'asc' } }),
    );
  }

  @Get(':id')
  @RequirePermissions('user.read')
  async get(@Param('id') id: string, @Req() req: AuthedRequest) {
    const tenantId = req.auth!.tenantId;
    const user = await this.prisma.withTenant(tenantId, (tx) =>
      tx.user.findFirst({ where: { id, tenantId }, select: userSelect }),
    );
    if (!user) {
      throw new NotFoundException('Not found');
    }
    return user;
  }

  @Patch(':id')
  @RequirePermissions('user.update')
  async update(
    @Param('id') id: string,
    @Body() body: { displayName?: string; tenantId?: string },
    @Req() req: AuthedRequest,
  ) {
    const tenantId = req.auth!.tenantId;
    if (body?.tenantId && body.tenantId !== tenantId) {
      throw new ForbiddenException('Tenant mismatch');
    }
    if (typeof body?.displayName !== 'string' || !body.displayName.trim()) {
      throw new BadRequestException('Display name is required');
    }
    const displayName = body.displayName.trim();
    const updated = await this.prisma.withTenant(tenantId, async (tx) => {
      const existing = await tx.user.findFirst({ where: { id, tenantId }, select: { id: true } });
      if (!existing) {
        return null;
      }
      return tx.user.update({ where: { id }, data: { displayName }, select: userSelect });
    });
    if (!updated) {
      throw new NotFoundException('Not found');
    }
    return updated;
  }
}
