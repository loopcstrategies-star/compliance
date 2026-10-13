import { BadRequestException, Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { AllowPendingMfa, Public } from './auth.decorator';
import type { AuthedRequest } from './auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  login(
    @Body() body: { email?: string; password?: string; tenantId?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    if (typeof body?.email !== 'string' || typeof body?.password !== 'string' || !body.email || !body.password) {
      throw new BadRequestException('Email and password are required');
    }
    if (body.tenantId !== undefined && typeof body.tenantId !== 'string') {
      throw new BadRequestException('Tenant id is invalid');
    }
    return this.auth.login(body.email, body.password, body.tenantId, res);
  }

  @AllowPendingMfa()
  @Get('mfa/setup')
  setup(@Req() req: AuthedRequest) {
    if (!req.auth) {
      return;
    }
    return this.auth.setupMfa(req.auth);
  }

  @AllowPendingMfa()
  @Post('mfa')
  mfa(@Body() body: { code?: string }, @Req() req: AuthedRequest) {
    if (!req.auth) {
      return;
    }
    if (typeof body?.code !== 'string' || !body.code) {
      throw new BadRequestException('Code is required');
    }
    return this.auth.confirmMfa(req.auth, body.code);
  }

  @AllowPendingMfa()
  @Post('logout')
  async logout(@Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.auth, res);
    return { ok: true };
  }

  @AllowPendingMfa()
  @Get('me')
  me(@Req() req: AuthedRequest) {
    const auth = req.auth;
    if (!auth) {
      return;
    }
    return {
      userId: auth.userId,
      email: auth.email,
      displayName: auth.displayName,
      tenantId: auth.tenantId,
      roles: auth.roles,
      mfaSatisfied: auth.mfaSatisfied,
      mfaEnrolled: auth.mfaEnrolled,
      privileged: auth.privileged,
    };
  }
}
