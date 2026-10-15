import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { IS_PUBLIC, PERMISSIONS } from './auth.decorator';
import { SESSION_COOKIE } from '../domain';
import type { AuthState } from './auth.types';

export type AuthedRequest = Request & { auth: AuthState | null };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const raw = req.cookies?.[SESSION_COOKIE] as string | undefined;
    req.auth = raw ? await this.authService.fromCookie(raw) : null;

    const headerTenant = req.header('x-tenant-id');
    if (req.auth && headerTenant && headerTenant !== req.auth.tenantId) {
      throw new ForbiddenException('Tenant mismatch');
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    if (!req.auth) {
      throw new UnauthorizedException();
    }

    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS, [
      context.getHandler(),
      context.getClass(),
    ]) ?? [];
    if (required.some((key) => !req.auth?.permissions.includes(key))) {
      throw new ForbiddenException();
    }
    return true;
  }
}
