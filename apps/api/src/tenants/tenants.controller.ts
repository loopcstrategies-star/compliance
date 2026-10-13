import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RequirePermissions } from '../auth/auth.decorator';

@Controller('tenants')
export class TenantsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('tenant.manage')
  list() {
    return this.prisma.tenant.findMany({
      select: { id: true, name: true, isSystem: true, createdAt: true },
      orderBy: { name: 'asc' },
    });
  }

  @Post()
  @RequirePermissions('tenant.manage')
  create(@Body() body: { name?: string }) {
    if (typeof body?.name !== 'string' || !body.name.trim()) {
      throw new BadRequestException('Name is required');
    }
    return this.prisma.tenant.create({
      data: { name: body.name.trim() },
      select: { id: true, name: true, isSystem: true },
    });
  }
}
