import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RequirePermissions } from '../auth/auth.decorator';

@Controller('checklist-categories')
export class ChecklistController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  @RequirePermissions('checklist.configure')
  create(@Body() body: { tenantId?: string; label?: string }) {
    const label = body?.label?.trim();
    if (!body?.tenantId || !label) {
      throw new BadRequestException('Tenant and label are required');
    }
    return this.prisma.withTenant(body.tenantId, (tx) =>
      tx.checklistCategory.create({
        data: { tenantId: body.tenantId!, label },
        select: { id: true, tenantId: true, label: true },
      }),
    );
  }
}
