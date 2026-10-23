import { BadRequestException, Body, Controller, Get, Param, Put, Req } from '@nestjs/common';
import { RequirePermissions } from '../auth/auth.decorator';
import type { AuthedRequest } from '../auth/auth.guard';
import { ApplicationService } from './application.service';

@Controller('applications')
export class ApplicationController {
  constructor(private readonly applications: ApplicationService) {}

  @Get('current')
  @RequirePermissions('application.read')
  current(@Req() req: AuthedRequest) {
    return this.applications.current(req.auth!);
  }

  @Get(':id')
  @RequirePermissions('application.read')
  get(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.applications.get(req.auth!, id);
  }

  @Put(':id/answers')
  @RequirePermissions('application.write')
  save(
    @Param('id') id: string,
    @Body() body: { answers?: Record<string, unknown> },
    @Req() req: AuthedRequest,
  ) {
    if (!body?.answers || typeof body.answers !== 'object' || Array.isArray(body.answers)) {
      throw new BadRequestException('Answers are required');
    }
    return this.applications.save(req.auth!, id, body.answers);
  }

  @Put(':id/sections/:sectionKey')
  @RequirePermissions('application.write')
  saveSection(
    @Param('id') id: string,
    @Param('sectionKey') sectionKey: string,
    @Body() body: { answers?: Record<string, unknown>; markComplete?: boolean },
    @Req() req: AuthedRequest,
  ) {
    if (!body?.answers || typeof body.answers !== 'object' || Array.isArray(body.answers)) {
      throw new BadRequestException('Answers are required');
    }
    return this.applications.saveSection(req.auth!, id, sectionKey, body.answers, body.markComplete === true);
  }
}
