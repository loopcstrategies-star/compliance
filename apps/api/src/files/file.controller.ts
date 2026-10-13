import { Controller, Get, Param, Query, Req, StreamableFile } from '@nestjs/common';
import type { AuthedRequest } from '../auth/auth.guard';
import { FileService } from './file.service';

@Controller('files')
export class FileController {
  constructor(private readonly files: FileService) {}

  @Get(':id')
  async download(@Param('id') id: string, @Query('purpose') purpose: string | undefined, @Req() req: AuthedRequest) {
    const file = await this.files.download(req.auth!, id, purpose);
    return new StreamableFile(file.bytes, {
      type: file.mediaType,
      disposition: 'attachment; filename="document"',
    });
  }
}
