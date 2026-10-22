import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, StreamableFile, UploadedFile, UseFilters, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RequirePermissions } from '../auth/auth.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { FileService } from '../files/file.service';
import { requireFile, UploadExceptionFilter, uploadOptions } from '../files/upload.filter';
import { readPrivateFile } from '../files/storage';

const ASSET_TYPES = ['logo', 'stamp', 'letterhead', 'authorised_signature'] as const;
type AssetType = (typeof ASSET_TYPES)[number];

@Controller()
@UseFilters(UploadExceptionFilter)
export class CompanyAssetsController {
  constructor(private readonly prisma: PrismaService, private readonly files: FileService) {}

  @Get('tenants/:tenantId/company-assets')
  @RequirePermissions('tenant.manage')
  async list(@Param('tenantId') tenantId: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const [assets, letterhead] = await Promise.all([
        tx.tenantCompanyAsset.findMany({
          where: { tenantId },
          include: { file: { select: { id: true, mediaType: true, byteSize: true, createdAt: true, scanStatus: true, quarantinedAt: true } } },
        }),
        tx.letterhead.findUnique({
          where: { tenantId },
          include: { file: { select: { id: true, mediaType: true, byteSize: true, createdAt: true, scanStatus: true, quarantinedAt: true } } },
        }),
      ]);
      const response = assets
        .filter((asset) => asset.file.scanStatus === 'clean' && asset.file.quarantinedAt === null)
        .map((asset) => ({
          assetType: asset.assetType,
          fileId: asset.file.id,
          mediaType: asset.file.mediaType,
          byteSize: asset.file.byteSize,
          uploadedAt: asset.file.createdAt,
        }));
      if (letterhead?.file && letterhead.file.scanStatus === 'clean' && letterhead.file.quarantinedAt === null) {
        response.push({
          assetType: 'letterhead',
          fileId: letterhead.file.id,
          mediaType: letterhead.file.mediaType,
          byteSize: letterhead.file.byteSize,
          uploadedAt: letterhead.file.createdAt,
        });
      }
      return ASSET_TYPES.flatMap((assetType) => response.filter((asset) => asset.assetType === assetType));
    });
  }

  @Post('tenants/:tenantId/company-assets')
  @RequirePermissions('tenant.manage')
  @UseInterceptors(FileInterceptor('file', uploadOptions))
  async upload(
    @Param('tenantId') tenantId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: { assetType?: string; authorisedUseConfirmed?: string },
  ) {
    const assetType = parseAssetType(body?.assetType);
    if (assetType === 'authorised_signature' && body?.authorisedUseConfirmed !== 'true') {
      throw new BadRequestException('Confirm that you are authorised to upload and use this signature image');
    }
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, isSystem: true } });
    if (!tenant || tenant.isSystem) {
      throw new BadRequestException('Select an onboarding company');
    }
    const stored = await this.files.store(tenantId, requireFile(file).buffer, 'image');
    return this.prisma.withTenant(tenantId, async (tx) => {
      if (assetType === 'letterhead') {
        const existing = await tx.letterhead.findUnique({ where: { tenantId } });
        if (existing) {
          await tx.letterhead.update({ where: { id: existing.id }, data: { fileId: stored.id } });
        } else {
          await tx.letterhead.create({ data: { tenantId, fileId: stored.id } });
        }
      } else {
        await tx.tenantCompanyAsset.upsert({
          where: { tenantId_assetType: { tenantId, assetType } },
          create: { tenantId, assetType, fileId: stored.id },
          update: { fileId: stored.id },
        });
      }
      return {
        assetType,
        fileId: stored.id,
        mediaType: stored.mediaType,
        byteSize: stored.byteSize,
        uploadedAt: stored.createdAt,
      };
    });
  }

  @Get('tenants/:tenantId/company-assets/:assetType/content')
  @RequirePermissions('tenant.manage')
  async content(@Param('tenantId') tenantId: string, @Param('assetType') rawType: string) {
    const assetType = parseAssetType(rawType);
    const file = await this.prisma.withTenant(tenantId, async (tx) => {
      if (assetType === 'letterhead') {
        const row = await tx.letterhead.findUnique({ where: { tenantId }, include: { file: true } });
        return row?.file ?? null;
      }
      const row = await tx.tenantCompanyAsset.findUnique({
        where: { tenantId_assetType: { tenantId, assetType } },
        include: { file: true },
      });
      return row?.file ?? null;
    });
    if (!file || file.scanStatus !== 'clean' || file.quarantinedAt) {
      throw new NotFoundException('Company asset was not found');
    }
    return new StreamableFile(readPrivateFile(file.storageKey), {
      type: file.mediaType,
      disposition: 'inline; filename="company-asset"',
    });
  }
}

function parseAssetType(value: unknown): AssetType {
  if (typeof value !== 'string' || !(ASSET_TYPES as readonly string[]).includes(value)) {
    throw new BadRequestException('Company asset type is invalid');
  }
  return value as AssetType;
}
