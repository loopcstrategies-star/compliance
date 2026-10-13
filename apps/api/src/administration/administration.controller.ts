import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { RequirePermissions } from '../auth/auth.decorator';
import type { AuthedRequest } from '../auth/auth.guard';
import { AdministrationService } from './administration.service';

@Controller('tenants')
export class AdministrationController {
  constructor(private readonly admin: AdministrationService) {}

  @Patch(':id')
  @RequirePermissions('tenant.manage')
  rename(@Param('id') id: string, @Body() body: { name?: string }) {
    if (typeof body?.name !== 'string') {
      throw new BadRequestException('Name is required');
    }
    return this.admin.renameTenant(id, body.name);
  }

  @Post(':tenantId/applicability')
  @RequirePermissions('checklist.configure')
  applicability(
    @Param('tenantId') tenantId: string,
    @Body() body: { customerType?: string; templateId?: string; required?: boolean },
  ) {
    return this.admin.setApplicability(tenantId, body?.customerType ?? '', body?.templateId ?? '', body?.required === true);
  }

  @Post(':tenantId/users/:userId/roles')
  @RequirePermissions('role.assign')
  grant(@Param('tenantId') tenantId: string, @Param('userId') userId: string, @Body() body: { role?: string }) {
    return this.admin.grantRole(tenantId, userId, body?.role ?? '');
  }

  @Delete(':tenantId/users/:userId/roles/:role')
  @RequirePermissions('role.assign')
  remove(@Param('tenantId') tenantId: string, @Param('userId') userId: string, @Param('role') role: string) {
    return this.admin.removeRole(tenantId, userId, role);
  }

  @Post(':tenantId/users/:userId/revoke-sessions')
  @RequirePermissions('role.assign')
  revoke(@Param('tenantId') tenantId: string, @Param('userId') userId: string) {
    return this.admin.revokeSessions(tenantId, userId);
  }

  @Post(':tenantId/retention')
  @RequirePermissions('retention.configure')
  retention(
    @Param('tenantId') tenantId: string,
    @Body() body: { category?: string; retentionDays?: number; effectiveFrom?: string },
  ) {
    return this.admin.saveRetention(tenantId, body?.category ?? '', body?.retentionDays ?? 0, body?.effectiveFrom ?? '');
  }

  @Post(':tenantId/holds')
  @RequirePermissions('retention.configure')
  hold(
    @Param('tenantId') tenantId: string,
    @Body() body: { targetType?: string; targetId?: string; reason?: string },
  ) {
    return this.admin.hold(tenantId, body?.targetType ?? '', body?.targetId ?? '', body?.reason ?? '');
  }

  @Post(':tenantId/deletions')
  @RequirePermissions('retention.approve')
  requestDeletion(
    @Param('tenantId') tenantId: string,
    @Body() body: { targetType?: string; targetId?: string; reason?: string },
    @Req() req: AuthedRequest,
  ) {
    return this.admin.requestDeletion(req.auth!, tenantId, body?.targetType ?? '', body?.targetId ?? '', body?.reason ?? '');
  }

  @Post(':tenantId/deletions/:id/approve')
  @RequirePermissions('retention.approve')
  approve(@Param('tenantId') tenantId: string, @Param('id') id: string, @Req() req: AuthedRequest) {
    return this.admin.approveDeletion(req.auth!, tenantId, id);
  }

  @Post(':tenantId/deletions/:id/reject')
  @RequirePermissions('retention.approve')
  reject(@Param('tenantId') tenantId: string, @Param('id') id: string, @Req() req: AuthedRequest) {
    return this.admin.rejectDeletion(req.auth!, tenantId, id);
  }

  @Post(':tenantId/purge')
  @RequirePermissions('retention.approve')
  purge(@Param('tenantId') tenantId: string) {
    return this.admin.purge(tenantId);
  }
}

@Controller('audit')
export class AuditController {
  constructor(private readonly admin: AdministrationService) {}

  @Get()
  @RequirePermissions('audit.read')
  list(@Query('tenantId') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant is required');
    }
    return this.admin.audit(tenantId);
  }
}
