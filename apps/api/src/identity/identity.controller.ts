import { BadRequestException, Body, Controller, Post, Req } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RequirePermissions } from '../auth/auth.decorator';
import type { AuthedRequest } from '../auth/auth.guard';

@Controller('identity-files')
export class IdentityController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('access')
  @RequirePermissions('identity_file.read')
  async access(@Body() body: { purpose?: string }, @Req() req: AuthedRequest) {
    const purpose = typeof body?.purpose === 'string' ? body.purpose.trim() : '';
    if (!purpose) {
      throw new BadRequestException('Purpose is required');
    }
    const auth = req.auth!;
    await this.prisma.withTenant(auth.tenantId, (tx) =>
      tx.auditEvent.create({
        data: {
          tenantId: auth.tenantId,
          actorId: auth.userId,
          action: 'identity_file.access',
          targetType: 'identity_file',
          purpose,
        },
      }),
    );
    return { status: 'allowed' };
  }
}
