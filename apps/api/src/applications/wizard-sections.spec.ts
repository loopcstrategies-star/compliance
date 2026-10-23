import { fieldBelongsToSection, keysForSection, sectionForField, WIZARD_SECTIONS } from './wizard-sections';

describe('wizard-sections', () => {
  it('keeps thirteen content sections in portal order', () => {
    expect(WIZARD_SECTIONS.map((section) => section.sectionKey)).toEqual([
      'kyc.entity',
      'kyc.ownership',
      'kyc.management',
      'kyc.pep',
      'kyc.aml',
      'kyc.supply',
      'kyc.funds_wealth',
      'kyc.bank',
      'kyc.docs',
      'kyc.declaration',
      'pepdec',
      'pepquest',
      'rspolicy',
    ]);
  });

  it('maps ownership and management keys without treating pepquest as kyc.pep', () => {
    expect(sectionForField('kyc.shareholder_entity.rows')?.sectionKey).toBe('kyc.ownership');
    expect(sectionForField('kyc.management.rows')?.sectionKey).toBe('kyc.management');
    expect(sectionForField('kyc.pep.a')?.sectionKey).toBe('kyc.pep');
    expect(sectionForField('pepquest.1')?.sectionKey).toBe('pepquest');
    expect(fieldBelongsToSection('pepquest.1', WIZARD_SECTIONS.find((s) => s.sectionKey === 'kyc.pep')!)).toBe(false);
  });

  it('filters catalogue keys per section', () => {
    const keys = [
      'kyc.entity.name',
      'kyc.aml.a',
      'kyc.pep.a',
      'pepdec.name',
      'rspolicy.ack.accepted',
      'rspolicy.ack.name',
      'rspolicy.ack.policy_version',
    ];
    expect(keysForSection('kyc.entity', keys)).toEqual(['kyc.entity.name']);
    expect(keysForSection('kyc.pep', keys)).toEqual(['kyc.pep.a']);
    expect(keysForSection('rspolicy', keys)).toEqual([
      'rspolicy.ack.accepted',
      'rspolicy.ack.name',
      'rspolicy.ack.policy_version',
    ]);
  });
});
