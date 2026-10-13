import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { RequirePermissions } from '../auth/auth.decorator';
import type { AuthedRequest } from '../auth/auth.guard';
import { PackageService } from './package.service';

@Controller('applications')
export class PackageController {
  constructor(private readonly packages: PackageService) {}

  @Get(':id/package-preview')
  @RequirePermissions('package.generate')
  preview(@Param('id') id: string, @Query('templateId') templateId: string | undefined, @Req() req: AuthedRequest) {
    if (!templateId) {
      throw new BadRequestException('Unknown field');
    }
    return this.packages.preview(req.auth!, id, templateId);
  }

  @Get(':id/packages')
  @RequirePermissions('document.read')
  list(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.packages.list(req.auth!, id);
  }

  @Post(':id/packages')
  @RequirePermissions('package.generate')
  generate(@Param('id') id: string, @Body() body: { templateId?: string }, @Req() req: AuthedRequest) {
    if (typeof body?.templateId !== 'string' || !body.templateId) {
      throw new BadRequestException('Unknown field');
    }
    return this.packages.generate(req.auth!, id, body.templateId);
  }
}
