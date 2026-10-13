import { Prisma, PrismaClient } from '@prisma/client';
import { CUSTOMER_TYPES } from '../domain';

const SCHEMA_VERSION = 1;
const TEMPLATES = ['kyc', 'pep-declaration', 'pep-questionnaire', 'responsible-sourcing'] as const;

type Column = { key: string; label: string };
type FieldSeed = {
  fieldKey: string;
  label: string;
  widget: string;
  repeatable?: boolean;
  options?: string[];
  columns?: Column[];
};

const text = (fieldKey: string, label: string): FieldSeed => ({ fieldKey, label, widget: 'text' });

const ENTITY_SHAREHOLDER_COLUMNS: Column[] = [
  { key: 'holding_pct', label: 'Percentage Holding (%)' },
  { key: 'name', label: 'Name' },
  { key: 'registration_number', label: 'Company Registration Number' },
  { key: 'address', label: 'Company Address' },
  { key: 'country_of_incorporation', label: 'Country of Incorporation' },
  { key: 'date_of_incorporation', label: 'Date of Incorporation' },
  { key: 'authorized_signatory', label: 'Authorized Signatory Yes / No' },
  { key: 'document_reference', label: 'Document Reference' },
];

const INDIVIDUAL_COLUMNS: Column[] = [
  { key: 'holding_pct', label: 'Percentage Holding (%)' },
  { key: 'name', label: 'Name' },
  { key: 'passport_number', label: 'Passport Number' },
  { key: 'current_address', label: 'Current Location Address' },
  { key: 'nationality', label: 'Nationality' },
  { key: 'date_of_birth', label: 'Date of Birth' },
  { key: 'authorized_signatory', label: 'Authorized Signatory Yes / No' },
  { key: 'document_reference', label: 'Document Reference' },
];

const MANAGEMENT_COLUMNS: Column[] = [
  { key: 'group', label: 'Details' },
  { key: 'name', label: 'Name' },
  { key: 'title', label: 'Title' },
  { key: 'identity', label: 'Passport No., Nationality, Date Of Birth' },
  { key: 'contact_details', label: 'Contact Details' },
  { key: 'document_reference', label: 'Document Reference' },
];

const PEP_PROFILES = [
  'Head of State or of Government',
  'Senior politician',
  'Senior government, judicial or military official',
  'Member of ruling royal family',
  'Senior executive of state-owned corporation / government linked company',
  'Important political party official',
  'Other (please specify)',
];

const FUND_OPTIONS = [
  'Business Profits',
  'Gift / Inheritance',
  'Savings',
  'Sale of Real Estate',
  'Salary',
  'Investment Earnings',
  'Others',
];

const WEALTH_OPTIONS = [
  'Business Profits',
  'Gift / Inheritance',
  'Savings',
  'Sale of Real Estate',
  'Salary',
  'Investment Earnings',
  'Other (specify)',
];

const KYC_FIELDS: FieldSeed[] = [
  text('kyc.entity.name', 'Name'),
  text('kyc.entity.registered_office_address', 'Registered Office Address'),
  text('kyc.entity.city', 'City'),
  text('kyc.entity.country', 'Country'),
  text('kyc.entity.business_address', 'Business Address (If different from the registered address)'),
  text('kyc.entity.postal_code', 'Postal Code / PO Box'),
  text('kyc.entity.telephone_fax', 'Telephone & Fax'),
  text('kyc.entity.registered_email', 'Registered Email'),
  text('kyc.entity.registration_no', 'Registration No.'),
  text('kyc.entity.date_of_establishment', 'Date of Establishment'),
  text('kyc.entity.place_of_establishment', 'Place of Establishment'),
  text('kyc.entity.legal_structure', 'Legal Structure (LLC, DMCC, FZCO, FZE, RAKEZ, ETC.)'),
  text('kyc.entity.business_type_activities', 'Business Type and Activities'),
  text('kyc.entity.corporate_website', 'Corporate Website'),
  text('kyc.entity.years_in_business', 'Years in Business'),
  text('kyc.entity.external_auditor', 'External Auditor'),
  text('kyc.entity.tax_reference_no', 'Tax Reference No. (e.g. Tin, TRN)'),
  text('kyc.entity.contact_name', "Contact Person's Name"),
  text('kyc.entity.contact_phone', "Contact Person's Mobile / Landline No."),
  text('kyc.entity.contact_email', "Contact Person's Email"),
  text('kyc.entity.compliance_officer_name', "Compliance Officer's Name"),
  text('kyc.entity.compliance_officer_phone', "Compliance Officer's Mobile / Landline No."),
  text('kyc.entity.compliance_officer_email', "Compliance Officer's Email"),
  text('kyc.entity.main_market_scope', 'Main Market (Geographical Scope)'),
  text('kyc.entity.main_market', 'Main Market'),
  text('kyc.entity.gold_industry_tenure', 'How long has the entity been in the gold industry business'),
  {
    fieldKey: 'kyc.shareholder_entity.rows',
    label: 'SHAREHOLDER(S) – ENTITY/IES WITH SHARES EQUAL TO OR MORE THAN 5 %',
    widget: 'repeating',
    repeatable: true,
    columns: ENTITY_SHAREHOLDER_COLUMNS,
  },
  {
    fieldKey: 'kyc.ubo.rows',
    label: 'ULTIMATE BENEFICIAL OWNER(S) – IF THERE IS ANY ENTITY/IES IN THE ABOVE SHAREHOLDING PATTERN WITH SHARES EQUAL TO OR MORE THAN 5 %',
    widget: 'repeating',
    repeatable: true,
    columns: INDIVIDUAL_COLUMNS,
  },
  {
    fieldKey: 'kyc.shareholder_individual.rows',
    label: 'SHAREHOLDER(S) – INDIVIDUALS WITH SHARES EQUAL TO OR MORE THAN 5 %',
    widget: 'repeating',
    repeatable: true,
    columns: INDIVIDUAL_COLUMNS,
  },
  {
    fieldKey: 'kyc.management.rows',
    label: 'MANAGEMENT STRUCTURE',
    widget: 'repeating',
    repeatable: true,
    columns: MANAGEMENT_COLUMNS,
  },
  {
    fieldKey: 'kyc.pep.a',
    label: 'a. Is there any of the shareholder / ultimate beneficial owner / director / authorized signatory a Politically Exposed Person',
    widget: 'yes_no_details',
  },
  {
    fieldKey: 'kyc.pep.b',
    label: 'b. Is there any of the shareholder / ultimate beneficial owner / director / authorized signatory a Politically Exposed Person',
    widget: 'yes_no_details',
  },
  ...[
    ['kyc.aml.a', 'a. Does the Company have documented AML/CTF policies and procedures approved by Board or Senior committee in place?'],
    ['kyc.aml.b', 'b. Do these policies document the processes in place to prevent, detect and report suspicious transactions?'],
    ['kyc.aml.c', 'c. Do these policies and practices being applied to all branches and subsidiaries of the entity both in the home country and in locations outside of that jurisdiction?'],
    ['kyc.aml.d', 'd. Do these policies cover relationships with Politically Exposed Persons (PEPs), their family, close associates, Shell Companies and Shell Banks?'],
    ['kyc.aml.e', 'e. Does the Company have an internal audit function or other independent third party that assesses AML policies and practices on a regular basis?'],
    ['kyc.aml.f', 'f. Does the Company have a third-party contracts policy?'],
    ['kyc.aml.h', 'h. In the last 5 years, has your institution/affiliates/subsidiaries been subjected to investigation in any jurisdictions relating AML / CTF Compliance Issues?'],
    ['kyc.aml.i', 'i. In the past 5 years, have any owners/ shareholders/ partners / Top management Executive been investigated of any criminal activity?'],
    ['kyc.aml.j', 'j. Does the Company undertake a risk-based assessment of its customer base and their transactions?'],
    ['kyc.aml.k', 'k. Does this risk-based assessment include consideration of conducting enhanced levels of due diligence for clients that it has reason to believe pose a heightened risk of illicit activities being conducted through the Company?'],
    ['kyc.aml.l', "l. Does the company have procedures to establish a record for each new customer noting their respective identification documents and 'Know Your Client' information?"],
    ['kyc.aml.m', "m. Does the company have a process to review and, where appropriate, update client 'Know Your Client' information?"],
    ['kyc.aml.n', 'n. Does the company screen clients and transactions against sanctions lists?'],
    ['kyc.aml.o', 'o. Does the company have a designated officer that is responsible for coordinating and overseeing the AML Policy and Procedures?'],
    ['kyc.aml.p', "p. Does the company's Board or Committee make a regular assessment of these Policies and Procedure?"],
    ['kyc.aml.q', 'q. Does the company have in place a Know your employee Policy and Procedure for screening and selection of the employees?'],
    ['kyc.aml.r', 'r. Does the company provide AML training to relevant employees?'],
    ['kyc.aml.s', 's. Does the company comply with all relevant tax legislation in the jurisdictions in which it is registered and those in which it operates?'],
  ].map(([fieldKey, label]) => ({ fieldKey, label, widget: 'yes_no_comments' })),
  {
    fieldKey: 'kyc.aml.g',
    label: 'g. How long does the Company keep its due diligence files (records)?',
    widget: 'duration_comments',
  },
  {
    fieldKey: 'kyc.declaration.accepted',
    label: 'DECLARATION: I/We hereby assure MYKA PRECIOUS METALS TRADING LLC, that the entity, employees, subsidiaries and associates are free from any Money Laundering or Terrorist Financing activities and abide by the local and international AML, CTF laws, and other applicable regulations. I/We confirm that we will provide all the necessary documents as and when required by MYKA PRECIOUS METALS TRADING LLC that all documents provided are true copies of the original. Information within this form is correct and complete, to the best of my knowledge and belief. I/we undertake to inform you of any changes therein, immediately. In case any of the above information is found to be false or untrue or misleading or misrepresenting, I am/we are aware that I/we may be held liable for it. I/We also hereby give consent to MYKA PRECIOUS METALS TRADING LLC to process and use the Personal Data, which may include transfer of Data to jurisdiction outside the UAE within the context of business relationship requirements. I am/we are authorized to confirm the above information and sign this declaration on behalf of the company.',
    widget: 'declaration',
  },
  text('kyc.signature.full_name', "Authorised Signatory's Full Name"),
  text('kyc.signature.designation', 'Designation'),
  text('kyc.signature.image', 'Signature'),
  text('kyc.signature.date', 'Date'),
  text('kyc.signature.stamp', 'Company Stamp'),
  text('kyc.supply.a', 'a. Type / Profile of your precious metal supplier / customer (Individual / Company)'),
  text('kyc.supply.b', 'b. Countries of origin of precious metals delivered to us?'),
  text('kyc.supply.c', 'c. What is the type or form of precious metals traded? (dore bars, minted bars, coins, etc.)'),
  text('kyc.supply.d', 'd. What is the Volume and expected purity of precious metals traded?'),
  text('kyc.supply.e', 'e. What mode of payment is used to pay your customer for purchases?'),
  text('kyc.supply.f', 'f. What is the destination of your precious metals sold to your customers?'),
  text('kyc.supply.g', 'g. What mode of payment is used for payments by your customer for your sales?'),
  text('kyc.supply.h', 'h. Are the details of all purchases and sales recorded in a register?'),
  text('kyc.supply.i', 'i. What type of information is recorded?'),
  {
    fieldKey: 'kyc.funds.source',
    label: 'Please indicate your source of funds (please tick one): Source of funds refers to the origin of the particular funds or other assets which are the subject of the establishment of business relations (e.g. the amounts being invested, deposited, or wired as part of the business relations).',
    widget: 'single_choice',
    options: FUND_OPTIONS,
  },
  {
    fieldKey: 'kyc.wealth.source',
    label: 'Please indicate your source of wealth (please tick one): Source of wealth generally refers to the origin of the entire body of wealth (i.e. total assets).',
    widget: 'single_choice',
    options: WEALTH_OPTIONS,
  },
  text('kyc.bank.name', 'Bank Name'),
  text('kyc.bank.address', 'Bank Address'),
  text('kyc.bank.account_number', 'Account Number'),
  text('kyc.bank.iban', 'IBAN'),
  text('kyc.bank.currency', 'Currency'),
  text('kyc.bank.swift', 'Swift Code'),
  { fieldKey: 'kyc.docs.1', label: 'Valid Trade License / Mining License / Commercial License', widget: 'yes_no_comments' },
  { fieldKey: 'kyc.docs.2', label: 'Certificate Of Incorporation / Registration / Commercial Registry / Export License / Gold Buyers License', widget: 'yes_no_comments' },
  { fieldKey: 'kyc.docs.3', label: 'Company Registry Extract / Certificate of Incumbency', widget: 'yes_no_comments' },
  { fieldKey: 'kyc.docs.4', label: "Shareholder Certificate / Partner's List", widget: 'yes_no_comments' },
  { fieldKey: 'kyc.docs.5', label: 'Memorandum Of Association / Agreement (MOA)', widget: 'yes_no_comments' },
  { fieldKey: 'kyc.docs.6', label: 'Articles Of Association (AOA)', widget: 'yes_no_comments' },
  { fieldKey: 'kyc.docs.7', label: 'Company Proof of Address (Lease Agreement / Utility Bill / Bank Statement / Title Deed)', widget: 'yes_no_comments' },
  {
    fieldKey: 'kyc.docs.8',
    label: 'Shareholders Passport, Visa & Emirates ID Copy / License Copy (if company) – For Domestic Customers\nShareholders Passport Copy – For International Customers',
    widget: 'yes_no_comments',
  },
  {
    fieldKey: 'kyc.docs.9',
    label: 'Ultimate Beneficial Owners Passport, Visa & Emirates ID copy – For Domestic Customers\nUltimate Beneficial Owners Passport – For International Customer',
    widget: 'yes_no_comments',
  },
  {
    fieldKey: 'kyc.docs.10',
    label: 'Board of Directors, Senior Management & Authorised Signatories ID copies (passport, visa and emirates id) – For Domestic Customers\nBoard of Directors, Senior Management & Authorised Signatories Passport copy – For International Customers',
    widget: 'yes_no_comments',
  },
  {
    fieldKey: 'kyc.docs.11',
    label: 'Contact Person / Authorized Representatives (Fixing and Physical Transactions) Passport, Visa & Emirates ID Copy – For Domestic Customers\nContact Person / Authorized Representatives (Fixing and Physical Transactions) Passport Copy – For International Customers',
    widget: 'yes_no_comments',
  },
  { fieldKey: 'kyc.docs.12', label: 'VAT Certificate – For Domestic Customers Only', widget: 'yes_no_comments' },
  { fieldKey: 'kyc.docs.13', label: 'Anti-Money Laundering policies/ procedures', widget: 'yes_no_comments' },
];

const PEP_DECLARATION_FIELDS: FieldSeed[] = [
  { fieldKey: 'pepdec.q1', label: '1. Are you a PEP?', widget: 'yes_no' },
  {
    fieldKey: 'pepdec.q2',
    label: '2. Is you or the entity related to a PEP? (Please fill in the below questions if the first two questions you answered - yes)',
    widget: 'yes_no',
  },
  {
    fieldKey: 'pepdec.q3.profile',
    label: '3. If you are or related to a PEP, please indicate the profile and relationship to you',
    widget: 'multi_checkbox',
    options: PEP_PROFILES,
  },
  { fieldKey: 'pepdec.q3.relationship', label: 'relationship to you', widget: 'text' },
  { fieldKey: 'pepdec.q3.other', label: 'Other (please specify)', widget: 'text' },
  {
    fieldKey: 'pepdec.declaration',
    label: 'I hereby declare that the details and information given above are complete and true to the best of my knowledge.',
    widget: 'declaration',
  },
  text('pepdec.signature.name', 'Name'),
  text('pepdec.signature.designation', 'Designation'),
  text('pepdec.signature.date', 'Date'),
  text('pepdec.signature.image', 'Signature'),
  text('pepdec.signature.stamp', 'Stamp'),
];

const PEP_QUESTIONNAIRE_FIELDS: FieldSeed[] = [
  { fieldKey: 'pepquest.q1', label: '1. Holding a senior public position, Member of Parliament/ member of a legislature?', widget: 'yes_no' },
  { fieldKey: 'pepquest.q2', label: '2. Judge of financial court or member of the council of the Central?', widget: 'yes_no' },
  { fieldKey: 'pepquest.q3', label: '3. An Ambassador, consul or high ranked military officer?', widget: 'yes_no' },
  { fieldKey: 'pepquest.q4', label: '4. A member of the managing or supervisory board of (majority) state-owned Legal Entities?', widget: 'yes_no' },
  {
    fieldKey: 'pepquest.q5',
    label: '5. Have an immediate family member of the mentioned person(s) commonly benefit from the Assets or from an established business relationship or from another form of close business contact with the above stated person(s)?',
    widget: 'yes_no',
  },
  {
    fieldKey: 'pepquest.q6',
    label: '6. Has a time period of at least 12 months expired since the termination of any of the above mentioned senior public position?',
    widget: 'yes_no',
  },
  { fieldKey: 'pepquest.details', label: 'If Answer is YES to any of the above, kindly provide details.', widget: 'text' },
  { fieldKey: 'pepquest.declaration', label: 'I, hereby declare that the information provided above are true and correct.', widget: 'declaration' },
  text('pepquest.signature.name', 'Name'),
  text('pepquest.signature.designation', 'Designation'),
  text('pepquest.signature.date', 'Date'),
  text('pepquest.signature.image', 'Signature'),
  text('pepquest.signature.stamp', 'Stamp'),
];

const POLICY_FIELDS: FieldSeed[] = [
  text('rspolicy.ack.name', 'Name'),
  text('rspolicy.ack.signature', 'Signature'),
  text('rspolicy.ack.stamp', 'Stamp'),
];

const FIELDS: Record<(typeof TEMPLATES)[number], FieldSeed[]> = {
  kyc: KYC_FIELDS,
  'pep-declaration': PEP_DECLARATION_FIELDS,
  'pep-questionnaire': PEP_QUESTIONNAIRE_FIELDS,
  'responsible-sourcing': POLICY_FIELDS,
};

export async function ensureFormCatalogue(prisma: PrismaClient): Promise<void> {
  const existing = await prisma.formSchema.count();
  if (existing > 0) {
    return;
  }
  for (const templateId of TEMPLATES) {
    const schema = await prisma.formSchema.create({ data: { templateId, version: SCHEMA_VERSION } });
    let sortOrder = 0;
    for (const field of FIELDS[templateId]) {
      await prisma.formField.create({
        data: {
          schemaId: schema.id,
          fieldKey: field.fieldKey,
          label: field.label,
          widget: field.widget,
          repeatable: field.repeatable ?? false,
          options: field.options ?? undefined,
          columns: (field.columns as Prisma.InputJsonValue | undefined) ?? undefined,
          sortOrder,
        },
      });
      sortOrder += 1;
    }
  }
  for (const customerType of CUSTOMER_TYPES) {
    for (const templateId of TEMPLATES) {
      await prisma.applicabilityRule.create({
        data: { customerType, templateId, fieldKey: '', required: true },
      });
    }
    await prisma.applicabilityRule.create({
      data: {
        customerType,
        templateId: 'kyc',
        fieldKey: 'kyc.docs.12',
        required: customerType === 'local_company',
      },
    });
  }
}

export const FORM_SCHEMA_VERSION = SCHEMA_VERSION;
