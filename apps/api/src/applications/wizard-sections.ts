export const SECTION_STATUSES = ['not_started', 'in_progress', 'completed'] as const;
export type SectionStatus = (typeof SECTION_STATUSES)[number];

export type WizardSectionDef = {
  sectionKey: string;
  title: string;
  /** Field keys belonging to this section (exact or prefix match ending with .). */
  fieldKeys?: string[];
  fieldPrefixes?: string[];
};

/** Ordered content sections (review is UI-only). */
export const WIZARD_SECTIONS: WizardSectionDef[] = [
  {
    sectionKey: 'kyc.entity',
    title: 'Business Entity Information',
    fieldPrefixes: ['kyc.entity.'],
  },
  {
    sectionKey: 'kyc.ownership',
    title: 'Ownership Structure',
    fieldKeys: ['kyc.shareholder_entity.rows', 'kyc.ubo.rows', 'kyc.shareholder_individual.rows'],
  },
  {
    sectionKey: 'kyc.management',
    title: 'Management Structure',
    fieldKeys: ['kyc.management.rows'],
  },
  {
    sectionKey: 'kyc.pep',
    title: 'PEP Questionnaire — Customer Due Diligence',
    fieldKeys: ['kyc.pep.a', 'kyc.pep.b'],
  },
  {
    sectionKey: 'kyc.aml',
    title: 'AML Questionnaire',
    fieldPrefixes: ['kyc.aml.'],
  },
  {
    sectionKey: 'kyc.supply',
    title: 'Supply Chain Questionnaire',
    fieldPrefixes: ['kyc.supply.'],
  },
  {
    sectionKey: 'kyc.funds_wealth',
    title: 'Source of Funds and Source of Wealth',
    fieldKeys: ['kyc.funds.source', 'kyc.wealth.source'],
  },
  {
    sectionKey: 'kyc.bank',
    title: 'Bank Details',
    fieldPrefixes: ['kyc.bank.'],
  },
  {
    sectionKey: 'kyc.docs',
    title: 'Documents Required',
    fieldPrefixes: ['kyc.docs.'],
  },
  {
    sectionKey: 'kyc.declaration',
    title: 'CDD Declaration & Authorised Signatory',
    fieldKeys: [
      'kyc.declaration.accepted',
      'kyc.signature.full_name',
      'kyc.signature.designation',
      'kyc.signature.image',
      'kyc.signature.date',
      'kyc.signature.stamp',
    ],
  },
  {
    sectionKey: 'pepdec',
    title: 'Politically Exposed Person (PEP) Declaration Form',
    fieldPrefixes: ['pepdec.'],
  },
  {
    sectionKey: 'pepquest',
    title: 'Questionnaire for Politically Exposed Persons (PEP)',
    fieldPrefixes: ['pepquest.'],
  },
  {
    sectionKey: 'rspolicy',
    title: 'Policy Acknowledgement',
    fieldPrefixes: ['rspolicy.ack.'],
  },
];

export function fieldBelongsToSection(fieldKey: string, section: WizardSectionDef): boolean {
  if (section.fieldKeys?.includes(fieldKey)) {
    return true;
  }
  return Boolean(section.fieldPrefixes?.some((prefix) => fieldKey.startsWith(prefix)));
}

export function sectionForField(fieldKey: string): WizardSectionDef | undefined {
  return WIZARD_SECTIONS.find((section) => fieldBelongsToSection(fieldKey, section));
}

export function keysForSection(sectionKey: string, allKeys: string[]): string[] {
  const section = WIZARD_SECTIONS.find((item) => item.sectionKey === sectionKey);
  if (!section) {
    return [];
  }
  return allKeys.filter((key) => fieldBelongsToSection(key, section));
}
