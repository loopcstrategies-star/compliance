import { BadRequestException, Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RequirePermissions } from '../auth/auth.decorator';
import { assertUniqueTenantName, duplicateNameError } from './tenant-name';

const profileSelect = {
  id: true,
  name: true,
  isSystem: true,
  displayName: true,
  registrationId: true,
  registeredAddress: true,
  operatingAddress: true,
  country: true,
  phone: true,
  website: true,
  complianceEmail: true,
} as const;

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
  async create(@Body() body: { name?: string }) {
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!name) {
      throw new BadRequestException('Name is required');
    }
    await assertUniqueTenantName(this.prisma, name);
    try {
      return await this.prisma.tenant.create({
        data: { name, isSystem: false },
        select: { id: true, name: true, isSystem: true },
      });
    } catch (error) {
      throw duplicateNameError(error);
    }
  }

  @Get(':id/profile')
  @RequirePermissions('tenant.manage')
  async profile(@Param('id') id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id }, select: profileSelect });
    if (!tenant) {
      throw new BadRequestException('Tenant was not found');
    }
    return tenant;
  }

  @Put(':id/profile')
  @RequirePermissions('tenant.manage')
  async updateProfile(
    @Param('id') id: string,
    @Body()
    body: {
      displayName?: string;
      registrationId?: string;
      registeredAddress?: string;
      operatingAddress?: string;
      country?: string;
      phone?: string;
      website?: string;
      complianceEmail?: string;
    },
  ) {
    const existing = await this.prisma.tenant.findUnique({ where: { id }, select: { id: true } });
    if (!existing || !body) {
      throw new BadRequestException('Tenant was not found');
    }
    return this.prisma.tenant.update({
      where: { id },
      data: {
        displayName: text(body.displayName),
        registrationId: text(body.registrationId),
        registeredAddress: text(body.registeredAddress),
        operatingAddress: text(body.operatingAddress),
        country: text(body.country),
        phone: text(body.phone),
        website: text(body.website),
        complianceEmail: text(body.complianceEmail),
      },
      select: profileSelect,
    });
  }

  @Post(':id/clone')
  @RequirePermissions('tenant.manage')
  async clone(
    @Param('id') id: string,
    @Body() body: { name?: string; confirm?: boolean; copyApplicability?: boolean; copyProfile?: boolean },
  ) {
    if (body?.confirm !== true || typeof body.name !== 'string' || !body.name.trim()) {
      throw new BadRequestException('Confirmation and a new name are required');
    }
    const source = await this.prisma.tenant.findUnique({ where: { id }, select: profileSelect });
    if (!source || source.isSystem) {
      throw new BadRequestException('This tenant cannot be copied');
    }
    const name = body.name.trim();
    await assertUniqueTenantName(this.prisma, name);
    let created: { id: string; name: string; isSystem: boolean };
    try {
      created = await this.prisma.tenant.create({
        data: {
          name,
          isSystem: false,
          ...(body.copyProfile
            ? {
                displayName: source.displayName,
                registrationId: source.registrationId,
                registeredAddress: source.registeredAddress,
                operatingAddress: source.operatingAddress,
                country: source.country,
                phone: source.phone,
                website: source.website,
                complianceEmail: source.complianceEmail,
              }
            : {}),
        },
        select: { id: true, name: true, isSystem: true },
      });
    } catch (error) {
      throw duplicateNameError(error);
    }
    if (body.copyApplicability) {
      const rows = await this.prisma.tenantApplicability.findMany({ where: { tenantId: id } });
      if (rows.length > 0) {
        await this.prisma.tenantApplicability.createMany({
          data: rows.map((row) => ({
            tenantId: created.id,
            customerType: row.customerType,
            templateId: row.templateId,
            required: row.required,
          })),
        });
      }
    }
    const [applications, users, files] = await this.prisma.withTenant(created.id, (tx) =>
      Promise.all([
        tx.application.count({ where: { tenantId: created.id } }),
        tx.user.count({ where: { tenantId: created.id } }),
        tx.storedFile.count({ where: { tenantId: created.id } }),
      ]),
    );
    return { ...created, applications, users, files };
  }
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
