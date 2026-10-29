import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  StreamableFile,
  UploadedFile,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RequirePermissions } from '../auth/auth.decorator';
import type { AuthedRequest } from '../auth/auth.guard';
import { requireFile, UploadExceptionFilter, uploadOptions } from '../files/upload.filter';
import { CompanyNetworkService } from './company-network.service';
import { CompanyNetworkSocialService } from './company-network-social.service';

@Controller('company-network')
@UseFilters(UploadExceptionFilter)
export class CompanyNetworkController {
  constructor(
    private readonly network: CompanyNetworkService,
    private readonly social: CompanyNetworkSocialService,
  ) {}

  @Get('home')
  @RequirePermissions('company_network.read')
  home(@Req() req: AuthedRequest) {
    return this.network.getHome(req.auth!);
  }

  @Get('me')
  @RequirePermissions('company_network.read')
  me(@Req() req: AuthedRequest) {
    return this.network.getMyProfile(req.auth!);
  }

  @Put('me')
  @RequirePermissions('company_network.write')
  updateMe(@Req() req: AuthedRequest, @Body() body: Record<string, unknown>) {
    return this.network.updateMyProfile(req.auth!, body ?? {});
  }

  @Put('me/visibility')
  @RequirePermissions('company_network.write')
  visibility(
    @Req() req: AuthedRequest,
    @Body() body: { discoverable?: boolean; visibility?: string; messagingEnabled?: boolean },
  ) {
    return this.network.updateVisibility(req.auth!, body ?? {});
  }

  @Post('me/assets')
  @RequirePermissions('company_network.write')
  @UseInterceptors(FileInterceptor('file', uploadOptions))
  uploadAsset(
    @Req() req: AuthedRequest,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: { assetType?: string },
  ) {
    return this.network.uploadAsset(req.auth!, body?.assetType ?? '', requireFile(file).buffer);
  }

  @Get('members/me')
  @RequirePermissions('company_network.read')
  myMember(@Req() req: AuthedRequest) {
    return this.social.getMyMemberProfile(req.auth!);
  }

  @Put('members/me')
  @RequirePermissions('company_network.write')
  updateMyMember(@Req() req: AuthedRequest, @Body() body: Record<string, unknown>) {
    return this.social.updateMyMemberProfile(req.auth!, body ?? {});
  }

  @Post('members/me/photo')
  @RequirePermissions('company_network.write')
  @UseInterceptors(FileInterceptor('file', uploadOptions))
  uploadMemberPhoto(@Req() req: AuthedRequest, @UploadedFile() file: Express.Multer.File | undefined) {
    return this.social.uploadMemberPhoto(req.auth!, requireFile(file).buffer);
  }

  @Get('members')
  @RequirePermissions('company_network.read')
  members(@Req() req: AuthedRequest) {
    return this.social.listOwnMembers(req.auth!);
  }

  @Get('feed')
  @RequirePermissions('company_network.read')
  feed(@Req() req: AuthedRequest, @Query() query: { page?: string; pageSize?: string; tenantId?: string }) {
    return this.social.listFeed(req.auth!, query ?? {});
  }

  @Post('posts')
  @RequirePermissions('company_network.write')
  createPost(@Req() req: AuthedRequest, @Body() body: { body?: string; postType?: string }) {
    return this.social.createPost(req.auth!, body ?? {});
  }

  @Patch('posts/:id')
  @RequirePermissions('company_network.write')
  updatePost(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: { body?: string; postType?: string }) {
    return this.social.updatePost(req.auth!, id, body ?? {});
  }

  @Delete('posts/:id')
  @RequirePermissions('company_network.write')
  deletePost(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.social.deletePost(req.auth!, id);
  }

  @Post('posts/:id/comments')
  @RequirePermissions('company_network.write')
  comment(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: { body?: string }) {
    return this.social.addComment(req.auth!, id, body ?? {});
  }

  @Post('posts/:id/reactions')
  @RequirePermissions('company_network.write')
  react(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: { reactionType?: string }) {
    return this.social.toggleReaction(req.auth!, id, body ?? {});
  }

  @Get('notifications')
  @RequirePermissions('company_network.read')
  notifications(@Req() req: AuthedRequest, @Query() query: { page?: string; pageSize?: string }) {
    return this.social.listNotifications(req.auth!, query ?? {});
  }

  @Get('notifications/unread-count')
  @RequirePermissions('company_network.read')
  notificationUnread(@Req() req: AuthedRequest) {
    return this.social.unreadNotificationCount(req.auth!);
  }

  @Post('notifications/read')
  @RequirePermissions('company_network.write')
  markNotificationsRead(@Req() req: AuthedRequest, @Body() body: { ids?: string[]; all?: boolean }) {
    return this.social.markNotificationsRead(req.auth!, body ?? {});
  }

  @Get('discover')
  @RequirePermissions('company_network.read')
  discover(
    @Req() req: AuthedRequest,
    @Query() query: { q?: string; country?: string; city?: string; industry?: string; page?: string; pageSize?: string },
  ) {
    return this.network.discover(req.auth!, query ?? {});
  }

  @Get('companies/:tenantId/members')
  @RequirePermissions('company_network.read')
  companyMembers(@Req() req: AuthedRequest, @Param('tenantId') tenantId: string) {
    return this.social.listCompanyMembers(req.auth!, tenantId);
  }

  @Get('companies/:tenantId')
  @RequirePermissions('company_network.read')
  company(@Req() req: AuthedRequest, @Param('tenantId') tenantId: string) {
    return this.network.getCompany(req.auth!, tenantId);
  }

  @Get('companies/:tenantId/:assetType')
  @RequirePermissions('company_network.read')
  async asset(
    @Req() req: AuthedRequest,
    @Param('tenantId') tenantId: string,
    @Param('assetType') assetType: string,
  ) {
    const file = await this.network.getAssetContent(req.auth!, tenantId, assetType);
    return new StreamableFile(file.buffer, {
      type: file.mediaType,
      disposition: 'inline; filename="company-network-asset"',
    });
  }

  @Post('requests')
  @RequirePermissions('company_network.write')
  sendRequest(@Req() req: AuthedRequest, @Body() body: { tenantId?: string }) {
    return this.network.sendRequest(req.auth!, body?.tenantId ?? '');
  }

  @Get('connections')
  @RequirePermissions('company_network.read')
  connections(@Req() req: AuthedRequest) {
    return this.network.listConnections(req.auth!);
  }

  @Get('requests/received')
  @RequirePermissions('company_network.read')
  received(@Req() req: AuthedRequest) {
    return this.network.listReceived(req.auth!);
  }

  @Get('requests/sent')
  @RequirePermissions('company_network.read')
  sent(@Req() req: AuthedRequest) {
    return this.network.listSent(req.auth!);
  }

  @Post('requests/:id/accept')
  @RequirePermissions('company_network.write')
  accept(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.network.accept(req.auth!, id);
  }

  @Post('requests/:id/decline')
  @RequirePermissions('company_network.write')
  decline(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.network.decline(req.auth!, id);
  }

  @Post('requests/:id/cancel')
  @RequirePermissions('company_network.write')
  cancel(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.network.cancel(req.auth!, id);
  }

  @Post('requests/:id/disconnect')
  @RequirePermissions('company_network.write')
  disconnect(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.network.disconnect(req.auth!, id);
  }

  @Get('conversations')
  @RequirePermissions('company_network.read')
  conversations(@Req() req: AuthedRequest) {
    return this.network.listConversations(req.auth!);
  }

  @Get('conversations/:id/messages')
  @RequirePermissions('company_network.read')
  messages(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Query() query: { cursor?: string; limit?: string },
  ) {
    return this.network.listMessages(req.auth!, id, query ?? {});
  }

  @Post('conversations/:id/read')
  @RequirePermissions('company_network.write')
  markRead(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.network.markRead(req.auth!, id);
  }

  @Post('messages')
  @RequirePermissions('company_network.write')
  sendMessage(
    @Req() req: AuthedRequest,
    @Body() body: { conversationId?: string; connectionId?: string; body?: string },
  ) {
    return this.network.sendMessage(req.auth!, body ?? {});
  }

  @Get('unread-count')
  @RequirePermissions('company_network.read')
  unread(@Req() req: AuthedRequest) {
    return this.network.unreadCount(req.auth!);
  }
}
