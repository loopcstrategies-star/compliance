import { BadRequestException, Body, Controller, Get, Param, Post, Req, UploadedFile, UseFilters, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RequirePermissions } from '../auth/auth.decorator';
import type { AuthedRequest } from '../auth/auth.guard';
import { requireFile, UploadExceptionFilter, uploadOptions } from '../files/upload.filter';
import { DocumentService } from './document.service';

@Controller('applications')
@UseFilters(UploadExceptionFilter)
export class DocumentController {
  constructor(private readonly documents: DocumentService) {}

  @Get(':id/documents')
  @RequirePermissions('document.read')
  list(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.documents.list(req.auth!, id);
  }

  @Post(':id/documents')
  @RequirePermissions('document.upload')
  @UseInterceptors(FileInterceptor('file', uploadOptions))
  upload(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: { fieldKey?: string; expiresOn?: string },
    @Req() req: AuthedRequest,
  ) {
    if (typeof body?.fieldKey !== 'string' || !body.fieldKey) {
      throw new BadRequestException('Unknown field');
    }
    return this.documents.upload(req.auth!, id, body.fieldKey, requireFile(file).buffer, body.expiresOn);
  }

  @Post(':id/signatures')
  @RequirePermissions('document.upload')
  @UseInterceptors(FileInterceptor('file', uploadOptions))
  sign(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: { templateId?: string; authorised?: string; consent?: string },
    @Req() req: AuthedRequest,
  ) {
    if (typeof body?.templateId !== 'string') {
      throw new BadRequestException('Unknown field');
    }
    return this.documents.sign(
      req.auth!,
      id,
      body.templateId,
      requireFile(file).buffer,
      body.authorised === 'true',
      body.consent === 'true',
    );
  }
}
