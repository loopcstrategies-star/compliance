import type { Field } from './types';

export type FieldGroup = {
  title: string;
  fields: Field[];
};

const ENTITY_GROUPS: { title: string; keys: string[] }[] = [
  {
    title: 'Company Details',
    keys: [
      'kyc.entity.name',
      'kyc.entity.registration_no',
      'kyc.entity.legal_structure',
      'kyc.entity.date_of_establishment',
      'kyc.entity.place_of_establishment',
      'kyc.entity.business_type_activities',
      'kyc.entity.corporate_website',
      'kyc.entity.years_in_business',
      'kyc.entity.external_auditor',
      'kyc.entity.tax_reference_no',
      'kyc.entity.main_market_scope',
      'kyc.entity.main_market',
      'kyc.entity.gold_industry_tenure',
    ],
  },
  {
    title: 'Address Information',
    keys: [
      'kyc.entity.registered_office_address',
      'kyc.entity.business_address',
      'kyc.entity.city',
      'kyc.entity.country',
      'kyc.entity.postal_code',
    ],
  },
  {
    title: 'Contact Information',
    keys: [
      'kyc.entity.telephone_fax',
      'kyc.entity.registered_email',
      'kyc.entity.contact_name',
      'kyc.entity.contact_phone',
      'kyc.entity.contact_email',
      'kyc.entity.compliance_officer_name',
      'kyc.entity.compliance_officer_phone',
      'kyc.entity.compliance_officer_email',
    ],
  },
];

/** Short labels for the horizontal stepper (full titles stay on section headers). */
export const STEPPER_LABELS: Record<string, string> = {
  'kyc.entity': 'Business Entity Information',
  'kyc.ownership': 'Ownership & Management',
  'kyc.management': 'Management Structure',
  'kyc.pep': 'PEP Questionnaire (CDD)',
  'kyc.aml': 'AML Questionnaire',
  'kyc.supply': 'Supply Chain Questionnaire',
  'kyc.funds_wealth': 'Source of Funds & Source of Wealth',
  'kyc.bank': 'Bank Details',
  'kyc.docs': 'Documents Required',
  'kyc.declaration': 'CDD Declaration & Signatory',
  pepdec: 'PEP Declaration',
  pepquest: 'PEP Questionnaire',
  rspolicy: 'Policy Acknowledgement',
  review: 'Review',
};

export function isWideField(field: Field): boolean {
  if (field.repeatable) return true;
  if (field.widget === 'declaration' || field.widget === 'multi_checkbox') return true;
  if (field.widget === 'yes_no_comments' || field.widget === 'yes_no_details' || field.widget === 'duration_comments') {
    return true;
  }
  if (field.label.length > 80) return true;
  return false;
}

export function groupsForSection(sectionKey: string, sectionTitle: string, fields: Field[]): FieldGroup[] {
  if (sectionKey !== 'kyc.entity') {
    return [{ title: sectionTitle, fields }];
  }

  const byKey = new Map(fields.map((field) => [field.fieldKey, field]));
  const used = new Set<string>();
  const groups: FieldGroup[] = [];

  for (const group of ENTITY_GROUPS) {
    const grouped = group.keys.map((key) => byKey.get(key)).filter((field): field is Field => Boolean(field));
    for (const field of grouped) {
      used.add(field.fieldKey);
    }
    if (grouped.length) {
      groups.push({ title: group.title, fields: grouped });
    }
  }

  const remaining = fields.filter((field) => !used.has(field.fieldKey));
  if (remaining.length) {
    groups.push({ title: 'Additional details', fields: remaining });
  }

  return groups.length ? groups : [{ title: sectionTitle, fields }];
}
