import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaService } from './prisma/prisma.service';
import { AuthService } from './auth/auth.service';
import { AuthGuard } from './auth/auth.guard';
import { AuthController } from './auth/auth.controller';
import { UsersController } from './users/users.controller';
import { TenantsController } from './tenants/tenants.controller';
import { IdentityController } from './identity/identity.controller';
import { HealthController } from './health.controller';
import { InvitationController } from './invitations/invitation.controller';
import { InvitationService } from './invitations/invitation.service';
import { ApplicationController } from './applications/application.controller';
import { ApplicationService } from './applications/application.service';
import { ChecklistController } from './checklist/checklist.controller';
import { FileController } from './files/file.controller';
import { FileService } from './files/file.service';
import { DocumentController } from './documents/document.controller';
import { DocumentService } from './documents/document.service';
import { PackageController } from './packages/package.controller';
import { PackageService } from './packages/package.service';
import { LetterheadController } from './letterhead/letterhead.controller';
import { ReviewController, SegregationController } from './reviews/review.controller';
import { ReviewService } from './reviews/review.service';
import { OperationsController, OperationsPolicyController } from './operations/operations.controller';
import { OperationsService } from './operations/operations.service';
import { AdministrationController, AuditController } from './administration/administration.controller';
import { AdministrationService } from './administration/administration.service';
import { CompanyKycController } from './company-kyc/company-kyc.controller';
import { CompanyKycService } from './company-kyc/company-kyc.service';
import { CompanyAssetsController } from './company-assets/company-assets.controller';
import { CompanyNetworkController } from './company-network/company-network.controller';
import { CompanyNetworkService } from './company-network/company-network.service';

@Module({
  controllers: [
    HealthController,
    AuthController,
    UsersController,
    TenantsController,
    IdentityController,
    InvitationController,
    ApplicationController,
    ChecklistController,
    FileController,
    DocumentController,
    PackageController,
    LetterheadController,
    ReviewController,
    SegregationController,
    OperationsController,
    OperationsPolicyController,
    AdministrationController,
    AuditController,
    CompanyKycController,
    CompanyAssetsController,
    CompanyNetworkController,
  ],
  providers: [
    PrismaService,
    AuthService,
    InvitationService,
    ApplicationService,
    FileService,
    DocumentService,
    PackageService,
    ReviewService,
    OperationsService,
    AdministrationService,
    CompanyKycService,
    CompanyNetworkService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
