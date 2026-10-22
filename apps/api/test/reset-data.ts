import { PrismaClient } from '@prisma/client';

export async function resetTenantData(admin: PrismaClient): Promise<void> {
  await admin.profileShareGrant.deleteMany();
  await admin.companyEvidence.deleteMany();
  await admin.companyKycAnswer.deleteMany();
  await admin.companyKycProfile.deleteMany();
  await admin.deletionRequest.deleteMany();
  await admin.legalHold.deleteMany();
  await admin.retentionPolicy.deleteMany();
  await admin.tenantApplicability.deleteMany();
  await admin.delivery.deleteMany();
  await admin.operationsPolicy.deleteMany();
  await admin.reviewDecision.deleteMany();
  await admin.submission.deleteMany();
  await admin.segregationPolicy.deleteMany();
  await admin.generatedPackage.deleteMany();
  await admin.signatureEvidence.deleteMany();
  await admin.tenantCompanyAsset.deleteMany();
  await admin.letterhead.deleteMany();
  await admin.document.deleteMany();
  await admin.storedFile.deleteMany();
  await admin.answer.deleteMany();
  await admin.application.deleteMany();
  await admin.customer.deleteMany();
  await admin.invitation.deleteMany();
  await admin.checklistCategory.deleteMany();
  await admin.auditEvent.deleteMany();
  await admin.session.deleteMany();
  await admin.userRole.deleteMany();
  await admin.user.deleteMany();
  await admin.rolePermission.deleteMany({ where: { role: { key: 'identity_reader_test' } } });
  await admin.role.deleteMany({ where: { key: 'identity_reader_test' } });
  await admin.tenant.deleteMany();
}
