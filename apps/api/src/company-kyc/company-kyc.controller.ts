import { Body, Controller, Get, Param, Post, Put, Req, Res, StreamableFile, UploadedFile, UseFilters, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AllowPendingMfa, Public, RequirePermissions } from '../auth/auth.decorator';
import type { AuthedRequest } from '../auth/auth.guard';
import { requireFile, UploadExceptionFilter, uploadOptions } from '../files/upload.filter';
import { CompanyKycService } from './company-kyc.service';

@Controller()
@UseFilters(UploadExceptionFilter)
export class CompanyKycController {
  constructor(private readonly profiles: CompanyKycService) {}

  @Get('tenants/:tenantId/company-kyc')
  @RequirePermissions('tenant.manage')
  get(@Param('tenantId') tenantId: string, @Req() req: AuthedRequest) {
    return this.profiles.get(req.auth!, tenantId);
  }

  @Put('tenants/:tenantId/company-kyc')
  @RequirePermissions('tenant.manage')
  save(
    @Param('tenantId') tenantId: string,
    @Body() body: { answers?: Record<string, unknown>; status?: string },
    @Req() req: AuthedRequest,
  ) {
    return this.profiles.save(req.auth!, tenantId, body ?? {});
  }

  @Post('tenants/:tenantId/company-kyc/evidence')
  @RequirePermissions('tenant.manage')
  @UseInterceptors(FileInterceptor('file', uploadOptions))
  evidence(
    @Param('tenantId') tenantId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: { documentType?: string; issuedOn?: string; expiresOn?: string },
    @Req() req: AuthedRequest,
  ) {
    return this.profiles.addEvidence(req.auth!, tenantId, body ?? {}, requireFile(file).buffer);
  }

  @Post('tenants/:tenantId/company-kyc/shares')
  @RequirePermissions('tenant.manage')
  share(
    @Param('tenantId') tenantId: string,
    @Body()
    body: {
      confirm?: boolean;
      recipientName?: string;
      recipientContact?: string;
      fieldKeys?: string[];
      evidenceIds?: string[];
      expiresInDays?: number;
    },
    @Req() req: AuthedRequest,
  ) {
    return this.profiles.share(req.auth!, tenantId, body ?? {});
  }

  @Post('tenants/:tenantId/company-kyc/shares/:grantId/revoke')
  @RequirePermissions('tenant.manage')
  revoke(@Param('tenantId') tenantId: string, @Param('grantId') grantId: string, @Req() req: AuthedRequest) {
    return this.profiles.revoke(req.auth!, tenantId, grantId);
  }

  @Public()
  @AllowPendingMfa()
  @Post('company-kyc/accept')
  accept(@Body() body: { token?: string }, @Res({ passthrough: true }) res: Response) {
    return this.profiles.accept(body?.token, res);
  }

  @Public()
  @AllowPendingMfa()
  @Get('company-kyc/current')
  current(@Req() req: AuthedRequest) {
    return this.profiles.current(req.cookies?.myka_share);
  }

  @Public()
  @AllowPendingMfa()
  @Get('company-kyc/files/:fileId')
  async download(@Param('fileId') fileId: string, @Req() req: AuthedRequest) {
    const file = await this.profiles.download(req.cookies?.myka_share, fileId);
    return new StreamableFile(file.bytes, { type: file.mediaType });
  }
}
