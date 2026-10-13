import { BadRequestException, Body, Controller, Get, Header, Param, Post, Put, Req } from '@nestjs/common';
import { RequirePermissions } from '../auth/auth.decorator';
import type { AuthedRequest } from '../auth/auth.guard';
import { OperationsService } from './operations.service';

@Controller()
export class OperationsController {
  constructor(private readonly operations: OperationsService) {}

  @Get('dashboard')
  @RequirePermissions('dashboard.read')
  dashboard(@Req() req: AuthedRequest) {
    return this.operations.dashboard(req.auth!);
  }

  @Post('applications/:id/assignment')
  @RequirePermissions('application.assign')
  assign(@Param('id') id: string, @Body() body: { assigneeId?: string }, @Req() req: AuthedRequest) {
    if (!body?.assigneeId) {
      throw new BadRequestException('Assignee is required');
    }
    return this.operations.assign(req.auth!, id, body.assigneeId);
  }

  @Get('reports/processing')
  @RequirePermissions('dashboard.read')
  processing(@Req() req: AuthedRequest) {
    return this.operations.processing(req.auth!);
  }

  @Get('reports/export')
  @RequirePermissions('report.export')
  @Header('content-type', 'text/csv; charset=utf-8')
  exportCsv(@Req() req: AuthedRequest) {
    return this.operations.exportCsv(req.auth!);
  }
}

@Controller('tenants')
export class OperationsPolicyController {
  constructor(private readonly operations: OperationsService) {}

  @Get(':tenantId/operations')
  @RequirePermissions('operations.configure')
  get(@Param('tenantId') tenantId: string) {
    return this.operations.getPolicy(tenantId);
  }

  @Put(':tenantId/operations')
  @RequirePermissions('operations.configure')
  update(
    @Param('tenantId') tenantId: string,
    @Body()
    body: {
      makerHours?: number;
      checkerHours?: number;
      approverHours?: number;
      draftReminderDays?: number;
      expiryLeadDays?: number;
      escalationEmail?: string;
    },
  ) {
    if (
      body?.makerHours === undefined ||
      body.checkerHours === undefined ||
      body.approverHours === undefined ||
      body.draftReminderDays === undefined ||
      body.expiryLeadDays === undefined ||
      body.escalationEmail === undefined
    ) {
      throw new BadRequestException('Operations settings are required');
    }
    return this.operations.updatePolicy(tenantId, {
      makerHours: body.makerHours,
      checkerHours: body.checkerHours,
      approverHours: body.approverHours,
      draftReminderDays: body.draftReminderDays,
      expiryLeadDays: body.expiryLeadDays,
      escalationEmail: body.escalationEmail,
    });
  }
}
