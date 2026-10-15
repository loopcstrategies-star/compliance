import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Req, UploadedFile, UseFilters, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RequirePermissions } from '../auth/auth.decorator';
import type { AuthedRequest } from '../auth/auth.guard';
import { LETTERHEAD_OWNERS, type LetterheadOwner } from '../domain';
import { PrismaService } from '../prisma/prisma.service';
import { FileService } from '../files/file.service';
import { requireFile, UploadExceptionFilter, uploadOptions } from '../files/upload.filter';
import { ensureTemplateCatalogue } from '../seed/template-catalogue';
import { ensureFormCatalogue } from '../seed/form-catalogue';

const templateSelect = {
  templateId: true,
  version: true,
  pageCount: true,
  sha256: true,
  letterheadOwner: true,
} as const;

@Controller()
@UseFilters(UploadExceptionFilter)
export class LetterheadController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FileService,
  ) {}

  @Get('templates')
  @RequirePermissions('letterhead.configure')
  async list() {
    await ensureTemplateCatalogue(this.prisma);
    await ensureFormCatalogue(this.prisma);
    const [templates, schemas] = await Promise.all([
      this.prisma.templateVersion.findMany({
        select: {
          ...templateSelect,
          placements: { select: { fieldKey: true, status: true } },
        },
        orderBy: { templateId: 'asc' },
      }),
      this.prisma.formSchema.findMany({
        where: { version: 1 },
        select: { templateId: true, _count: { select: { fields: true } } },
      }),
    ]);
    const fieldsByTemplate = new Map(schemas.map((schema) => [schema.templateId, schema._count.fields]));
    return templates.map((template) => {
      const unresolvedPlacements = template.placements.filter((placement) => placement.status !== 'measured');
      return {
        templateId: template.templateId,
        version: template.version,
        pageCount: template.pageCount,
        sha256: template.sha256,
        letterheadOwner: template.letterheadOwner,
        blockedFieldCount: fieldsByTemplate.get(template.templateId) ?? 0,
        unresolvedPlacementCount: unresolvedPlacements.length,
        blocked: (fieldsByTemplate.get(template.templateId) ?? 0) > 0 || unresolvedPlacements.length > 0,
      };
    });
  }

  @Patch('templates/:templateId')
  @RequirePermissions('letterhead.configure')
  async update(@Param('templateId') templateId: string, @Body() body: { letterheadOwner?: string }) {
    if (!body?.letterheadOwner || !(LETTERHEAD_OWNERS as readonly string[]).includes(body.letterheadOwner)) {
      throw new BadRequestException('Letterhead owner is invalid');
    }
    await ensureTemplateCatalogue(this.prisma);
    return this.prisma.templateVersion.update({
      where: { templateId_version: { templateId, version: 1 } },
      data: { letterheadOwner: body.letterheadOwner as LetterheadOwner },
      select: templateSelect,
    });
  }

  @Post('tenants/:tenantId/letterhead')
  @RequirePermissions('letterhead.configure')
  @UseInterceptors(FileInterceptor('file', uploadOptions))
  async upload(
    @Param('tenantId') tenantId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: AuthedRequest,
  ) {
    if (req.header('x-tenant-id') && req.header('x-tenant-id') !== req.auth!.tenantId) {
      throw new BadRequestException('Tenant mismatch');
    }
    const stored = await this.files.store(tenantId, requireFile(file).buffer, 'image');
    return this.prisma.withTenant(tenantId, async (tx) => {
      const existing = await tx.letterhead.findUnique({ where: { tenantId } });
      if (existing) {
        return tx.letterhead.update({
          where: { id: existing.id },
          data: { fileId: stored.id },
          select: { id: true, tenantId: true, fileId: true },
        });
      }
      return tx.letterhead.create({
        data: { tenantId, fileId: stored.id },
        select: { id: true, tenantId: true, fileId: true },
      });
    });
  }
}
