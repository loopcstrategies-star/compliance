import { BadRequestException, Body, Controller, Get, Param, Post, Put, Query, Req } from '@nestjs/common';
import { RequirePermissions } from '../auth/auth.decorator';
import type { AuthedRequest } from '../auth/auth.guard';
import { ReviewService } from './review.service';

@Controller('applications')
export class ReviewController {
  constructor(private readonly reviews: ReviewService) {}

  @Get()
  @RequirePermissions('application.read')
  board(
    @Query('view') view: string | undefined,
    @Query('tenantId') tenantId: string | undefined,
    @Query('days') days: string | undefined,
    @Req() req: AuthedRequest,
  ) {
    if (view) {
      return this.reviews.board(req.auth!, view, tenantId, days);
    }
    return this.reviews.list(req.auth!);
  }

  @Get(':id/dossier')
  @RequirePermissions('application.read')
  dossier(@Param('id') id: string, @Query('tenantId') tenantId: string | undefined, @Req() req: AuthedRequest) {
    return this.reviews.dossier(req.auth!, id, tenantId);
  }

  @Get(':id/summary')
  @RequirePermissions('application.read')
  summary(@Param('id') id: string, @Query('tenantId') tenantId: string | undefined, @Req() req: AuthedRequest) {
    return this.reviews.summary(req.auth!, id, tenantId);
  }

  @Post(':id/submit')
  @RequirePermissions('application.submit')
  submit(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.reviews.submit(req.auth!, id);
  }

  @Post(':id/decisions')
  decide(
    @Param('id') id: string,
    @Body() body: { stage?: string; outcome?: string; reason?: string; documentVersion?: number; tenantId?: string },
    @Req() req: AuthedRequest,
  ) {
    return this.reviews.decide(req.auth!, id, body ?? {});
  }

  @Get(':id/completeness')
  @RequirePermissions('application.read')
  completeness(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.reviews.completeness(req.auth!, id);
  }
}

@Controller('tenants')
export class SegregationController {
  constructor(private readonly reviews: ReviewService) {}

  @Get(':tenantId/segregation')
  @RequirePermissions('workflow.configure')
  get(@Param('tenantId') tenantId: string) {
    return this.reviews.getPolicy(tenantId);
  }

  @Put(':tenantId/segregation')
  @RequirePermissions('workflow.configure')
  update(
    @Param('tenantId') tenantId: string,
    @Body()
    body: {
      makerDistinctFromChecker?: boolean;
      checkerDistinctFromApprover?: boolean;
      makerDistinctFromApprover?: boolean;
    },
  ) {
    if (!body) {
      throw new BadRequestException('Segregation switches are required');
    }
    return this.reviews.updatePolicy(tenantId, body);
  }
}
