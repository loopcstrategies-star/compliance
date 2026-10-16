import { BadRequestException, Body, Controller, Param, Post, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AllowPendingMfa, Public, RequirePermissions } from '../auth/auth.decorator';
import type { AuthedRequest } from '../auth/auth.guard';
import { InvitationService } from './invitation.service';

@Controller('invitations')
export class InvitationController {
  constructor(private readonly invitations: InvitationService) {}

  @Post()
  @RequirePermissions('invitation.create')
  create(
    @Body() body: { email?: string; legalName?: string; customerType?: string; tenantId?: string },
    @Req() req: AuthedRequest,
  ) {
    if (typeof body?.email !== 'string' || typeof body.legalName !== 'string' || typeof body.customerType !== 'string') {
      throw new BadRequestException('Email, legal name, and customer type are required');
    }
    return this.invitations.create(req.auth!, {
      email: body.email,
      legalName: body.legalName,
      customerType: body.customerType,
      tenantId: typeof body.tenantId === 'string' ? body.tenantId : undefined,
    });
  }

  @Post('resume')
  @RequirePermissions('invitation.create')
  resume(@Body() body: { email?: string; tenantId?: string }, @Req() req: AuthedRequest) {
    if (typeof body?.email !== 'string') {
      throw new BadRequestException('Email is required');
    }
    return this.invitations.resume(req.auth!, body.email, typeof body.tenantId === 'string' ? body.tenantId : undefined);
  }

  @Post(':id/revoke')
  @RequirePermissions('invitation.create')
  async revoke(@Param('id') id: string, @Req() req: AuthedRequest) {
    await this.invitations.revoke(req.auth!, id);
    return { ok: true };
  }

  @Public()
  @AllowPendingMfa()
  @Post('accept')
  accept(
    @Body() body: { token?: string; password?: string; displayName?: string },
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.invitations.accept(req.auth, body, res);
  }
}
