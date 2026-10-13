# Field inventory

Each row is either **source** (printed on a supplied PDF) or **configuration** (a platform rule that does not add words to a template). No source field was added to fill a gap. Decoded wording is the text recovered from the PDF. A later generation test must compare pixels and text with the source file, not with this markdown.

Checkbox glyphs on the KYC form are the ballot box `☐` (U+2610). PEP declaration and PEP questionnaire yes/no pairs are the words Yes/No or YES/NO without a separate ballot glyph in the decoded text.

## Configuration, not source fields

| Id | Rule |
| --- | --- |
| `config.customer_type` | Local company, foreign company, mine, individual. The KYC template is an entity form. It has a mining-licence row and no separate individual questionnaire. Applicability chooses which templates and which checklist rows apply. It does not invent individual-only KYC questions. |
| `config.checklist_extra` | Authorised administrators may add checklist categories and conditional rules later. Those categories are not in the 13 source rows. |
| `config.letterhead_owner` | Per document: `myka`, `customer`, or `none`. Defaults are in the template registry. Customer letterhead is not painted onto the responsible sourcing policy unless that document's setting is later changed and reviewed. |
| `config.domestic_international` | KYC page 9 already distinguishes domestic and international on items 8–11, and domestic only on item 12. Customer type may select which of those printed lines is required. It does not rewrite the lines. |

## KYC source fields

### Page 1 — business entity

| Field id | Source label |
| --- | --- |
| `kyc.entity.name` | Name |
| `kyc.entity.registered_office_address` | Registered Office Address |
| `kyc.entity.city` | City |
| `kyc.entity.country` | Country |
| `kyc.entity.business_address` | Business Address (If different from the registered address) |
| `kyc.entity.postal_code` | Postal Code / PO Box |
| `kyc.entity.telephone_fax` | Telephone & Fax |
| `kyc.entity.registered_email` | Registered Email |
| `kyc.entity.registration_no` | Registration No. |
| `kyc.entity.date_of_establishment` | Date of Establishment |
| `kyc.entity.place_of_establishment` | Place of Establishment |
| `kyc.entity.legal_structure` | Legal Structure (LLC, DMCC, FZCO, FZE, RAKEZ, ETC.) |
| `kyc.entity.business_type_activities` | Business Type and Activities |

The parenthetical legal-structure examples are label text, not a closed list of allowed values.

### Page 2 — business entity continued

| Field id | Source label |
| --- | --- |
| `kyc.entity.corporate_website` | Corporate Website |
| `kyc.entity.years_in_business` | Years in Business |
| `kyc.entity.external_auditor` | External Auditor |
| `kyc.entity.tax_reference_no` | Tax Reference No. (e.g. Tin, TRN) |
| `kyc.entity.contact_name` | Contact Person's Name |
| `kyc.entity.contact_phone` | Contact Person's Mobile / Landline No. |
| `kyc.entity.contact_email` | Contact Person's Email |
| `kyc.entity.compliance_officer_name` | Compliance Officer's Name |
| `kyc.entity.compliance_officer_phone` | Compliance Officer's Mobile / Landline No. |
| `kyc.entity.compliance_officer_email` | Compliance Officer's Email |
| `kyc.entity.main_market_scope` | Main Market (Geographical Scope) |
| `kyc.entity.main_market` | Main Market |
| `kyc.entity.gold_industry_tenure` | How long has the entity been in the gold industry business |

### Page 3 — repeating tables

Threshold text on all three tables: shares equal to or more than 5%. Row count is not printed. Empty row lines have no text operators, so the number of blank rows on the paper is a layout fact for the placement spec, not an extra field.

Entity shareholders, `kyc.shareholder_entity.rows[]`:

| Column id | Source column |
| --- | --- |
| `holding_pct` | Percentage Holding (%) |
| `name` | Name |
| `registration_number` | Company Registration Number |
| `address` | Company Address |
| `country_of_incorporation` | Country of Incorporation |
| `date_of_incorporation` | Date of Incorporation |
| `authorized_signatory` | Authorized Signatory Yes / No |
| `document_reference` | Document Reference |

Ultimate beneficial owners, `kyc.ubo.rows[]`. The heading says to complete this when any entity in the shareholding pattern above holds shares equal to or more than 5%:

| Column id | Source column |
| --- | --- |
| `holding_pct` | Percentage Holding (%) |
| `name` | Name |
| `passport_number` | Passport Number |
| `current_address` | Current Location Address |
| `nationality` | Nationality |
| `date_of_birth` | Date of Birth |
| `authorized_signatory` | Authorized Signatory Yes / No |
| `document_reference` | Document Reference |

Individual shareholders, `kyc.shareholder_individual.rows[]`, same columns as the UBO table. Heading: individuals with shares equal to or more than 5%.

### Page 4 — management and PEP

Management table `kyc.management.rows[]`, with the printed row-group labels Board of Directors and Management:

| Column id | Source column |
| --- | --- |
| `group` | Details (the printed groups are Board of Directors and Management) |
| `name` | Name |
| `title` | Title |
| `identity` | Passport No., Nationality, Date Of Birth |
| `contact_details` | Contact Details |
| `document_reference` | Document Reference |

PEP questionnaire. The content stream draws two separate questions, a and b, with the same wording. A render of page 4 shows both questions on the form, each with its own Yes, No, and details line. Both are source fields. They are not collapsed.

| Field id | Source text |
| --- | --- |
| `kyc.pep.a` | a. Is there any of the shareholder / ultimate beneficial owner / director / authorized signatory a Politically Exposed Person. Yes / No. If yes, please provide details. |
| `kyc.pep.b` | b. The same sentence as question a, drawn again lower on the page, with its own Yes / No and details line. |

Question a sits around y 355–320 and question b around y 278–246. The page 4 render matches those two blocks.

AML section header and column headers are source text, not answers: `5. AML QUESTIONNAIRE`; columns Description, Yes/No, and Comments with the instruction `IF ANSWERING "NO" OR "N/A", PLEASE PROVIDE AN EXPLANATION`.

| Field id | Source question |
| --- | --- |
| `kyc.aml.a` | I. General, AML Policies, Practices and Procedures. a. Does the Company have documented AML/CTF policies and procedures approved by Board or Senior committee in place? |

### Page 5 — AML b through p

| Field id | Group | Source question | Answer shape on the form |
| --- | --- | --- | --- |
| `kyc.aml.b` | I | b. Do these policies document the processes in place to prevent, detect and report suspicious transactions? | Yes/No and comments |
| `kyc.aml.c` | I | c. Do these policies and practices being applied to all branches and subsidiaries of the entity both in the home country and in locations outside of that jurisdiction? | Yes/No and comments. Grammar kept. |
| `kyc.aml.d` | I | d. Do these policies cover relationships with Politically Exposed Persons (PEPs), their family, close associates, Shell Companies and Shell Banks? | Yes/No and comments |
| `kyc.aml.e` | I | e. Does the Company have an internal audit function or other independent third party that assesses AML policies and practices on a regular basis? | Yes/No and comments |
| `kyc.aml.f` | I | f. Does the Company have a third-party contracts policy? | Yes/No and comments |
| `kyc.aml.g` | I | g. How long does the Company keep its due diligence files (records)? | A duration answer, not only Yes/No. Comments column still exists. |
| `kyc.aml.h` | I | h. In the last 5 years, has your institution/affiliates/subsidiaries been subjected to investigation in any jurisdictions relating AML / CTF Compliance Issues? | Yes/No, comments, and the printed line "If yes, please provide details." |
| `kyc.aml.i` | I | i. In the past 5 years, have any owners/ shareholders/ partners / Top management Executive been investigated of any criminal activity? | Yes/No, comments, and "If yes, please provide details." |
| `kyc.aml.j` | II. Risk Assessment | j. Does the Company undertake a risk-based assessment of its customer base and their transactions? | Yes/No and comments |
| `kyc.aml.k` | II | k. Does this risk-based assessment include consideration of conducting enhanced levels of due diligence for clients that it has reason to believe pose a heightened risk of illicit activities being conducted through the Company? | Yes/No and comments |
| `kyc.aml.l` | III. Know Your Client and reviewing due diligence | l. Does the company have procedures to establish a record for each new customer noting their respective identification documents and 'Know Your Client' information? | Yes/No and comments |
| `kyc.aml.m` | III | m. Does the company have a process to review and, where appropriate, update client 'Know Your Client' information? | Yes/No and comments |
| `kyc.aml.n` | III | n. Does the company screen clients and transactions against sanctions lists? | Yes/No and comments |
| `kyc.aml.o` | IV. Monitoring and review | o. Does the company have a designated officer that is responsible for coordinating and overseeing the AML Policy and Procedures? | Yes/No and comments |
| `kyc.aml.p` | IV | p. Does the company's Board or Committee make a regular assessment of these Policies and Procedure? | Yes/No and comments. "Procedure" is singular in the source. |

### Page 6 — AML q through s, declaration, signature

| Field id | Group | Source question |
| --- | --- | --- |
| `kyc.aml.q` | V. Staff Screening and training | q. Does the company have in place a Know your employee Policy and Procedure for screening and selection of the employees? |
| `kyc.aml.r` | V | r. Does the company provide AML training to relevant employees? |
| `kyc.aml.s` | VI. Taxation | s. Does the company comply with all relevant tax legislation in the jurisdictions in which it is registered and those in which it operates? |

Declaration, field `kyc.declaration.accepted`. The source paragraph is one block, not a set of optional clauses. Decoded text, spacing normalised only where separate PDF runs were clearly word breaks:

> DECLARATION: I/We hereby assure MYKA PRECIOUS METALS TRADING LLC, that the entity, employees, subsidiaries and associates are free from any Money Laundering or Terrorist Financing activities and abide by the local and international AML, CTF laws, and other applicable regulations. I/We confirm that we will provide all the necessary documents as and when required by MYKA PRECIOUS METALS TRADING LLC that all documents provided are true copies of the original. Information within this form is correct and complete, to the best of my knowledge and belief. I/we undertake to inform you of any changes therein, immediately. In case any of the above information is found to be false or untrue or misleading or misrepresenting, I am/we are aware that I/we may be held liable for it. I/We also hereby give consent to MYKA PRECIOUS METALS TRADING LLC to process and use the Personal Data, which may include transfer of Data to jurisdiction outside the UAE within the context of business relationship requirements. I am/we are authorized to confirm the above information and sign this declaration on behalf of the company.

Some runs in the content stream draw "METALS" as adjacent pieces (`MET` `AL` `S`). The inventory keeps the company name as it reads. The generation test must use the source PDF's glyphs rather than this paragraph.

Signature row, all source:

| Field id | Label |
| --- | --- |
| `kyc.signature.full_name` | Authorised Signatory's Full Name |
| `kyc.signature.designation` | Designation |
| `kyc.signature.image` | Signature |
| `kyc.signature.date` | Date |
| `kyc.signature.stamp` | Company Stamp |

### Page 7 — supply chain, funds, wealth

| Field id | Source question |
| --- | --- |
| `kyc.supply.a` | a. Type / Profile of your precious metal supplier / customer (Individual / Company) |
| `kyc.supply.b` | b. Countries of origin of precious metals delivered to us? |
| `kyc.supply.c` | c. What is the type or form of precious metals traded? (dore bars, minted bars, coins, etc.) |
| `kyc.supply.d` | d. What is the Volume and expected purity of precious metals traded? |
| `kyc.supply.e` | e. What mode of payment is used to pay your customer for purchases? |
| `kyc.supply.f` | f. What is the destination of your precious metals sold to your customers? |
| `kyc.supply.g` | g. What mode of payment is used for payments by your customer for your sales? |
| `kyc.supply.h` | h. Are the details of all purchases and sales recorded in a register? |
| `kyc.supply.i` | i. What type of information is recorded? |

Source of funds, `kyc.funds.source`, single tick. The definition under the question is source text and is not an answer:

> Source of funds refers to the origin of the particular funds or other assets which are the subject of the establishment of business relations (e.g. the amounts being invested, deposited, or wired as part of the business relations).

Options: Business Profits; Gift / Inheritance; Savings; Sale of Real Estate; Salary; Investment Earnings; Others (with a specify line).

Source of wealth, `kyc.wealth.source`, single tick. Definition:

> Source of wealth generally refers to the origin of the entire body of wealth (i.e. total assets).

Options: Business Profits; Gift / Inheritance; Savings; Sale of Real Estate; Salary; Investment Earnings; Other (specify). The last label is "Other (specify)", not "Others".

### Page 8 — bank

| Field id | Label |
| --- | --- |
| `kyc.bank.name` | Bank Name |
| `kyc.bank.address` | Bank Address |
| `kyc.bank.account_number` | Account Number |
| `kyc.bank.iban` | IBAN |
| `kyc.bank.currency` | Currency |
| `kyc.bank.swift` | Swift Code |

### Page 9 — 13 document categories

Instruction, source text: "DOCUMENTS REQUIRED: Please attach copies of the following documents." Columns: Description, Yes, No, Comments.

Each numbered category has one `yes`, one `no`, and one `comments` cell. Items 8–11 print two descriptions in that single row (domestic, then international). The two lines are separate source descriptions. They do not add a second Yes/No pair.

| No. | Field id | Source description |
| --- | --- | --- |
| 1 | `kyc.docs.1` | Valid Trade License / Mining License / Commercial License |
| 2 | `kyc.docs.2` | Certificate Of Incorporation / Registration / Commercial Registry / Export License / Gold Buyers License |
| 3 | `kyc.docs.3` | Company Registry Extract / Certificate of Incumbency |
| 4 | `kyc.docs.4` | Shareholder Certificate / Partner's List |
| 5 | `kyc.docs.5` | Memorandum Of Association / Agreement (MOA) |
| 6 | `kyc.docs.6` | Articles Of Association (AOA) |
| 7 | `kyc.docs.7` | Company Proof of Address (Lease Agreement / Utility Bill / Bank Statement / Title Deed) |
| 8 | `kyc.docs.8.domestic` | Shareholders Passport, Visa & Emirates ID Copy / License Copy (if company) – For Domestic Customers |
| 8 | `kyc.docs.8.international` | Shareholders Passport Copy – For International Customers |
| 9 | `kyc.docs.9.domestic` | Ultimate Beneficial Owners Passport, Visa & Emirates ID copy – For Domestic Customers |
| 9 | `kyc.docs.9.international` | Ultimate Beneficial Owners Passport – For International Customer |
| 10 | `kyc.docs.10.domestic` | Board of Directors, Senior Management & Authorised Signatories ID copies (passport, visa and emirates id) – For Domestic Customers |
| 10 | `kyc.docs.10.international` | Board of Directors, Senior Management & Authorised Signatories Passport copy – For International Customers |
| 11 | `kyc.docs.11.domestic` | Contact Person / Authorized Representatives (Fixing and Physical Transactions) Passport, Visa & Emirates ID Copy – For Domestic Customers |
| 11 | `kyc.docs.11.international` | Contact Person / Authorized Representatives (Fixing and Physical Transactions) Passport Copy – For International Customers |
| 12 | `kyc.docs.12` | VAT Certificate – For Domestic Customers Only |
| 13 | `kyc.docs.13` | Anti-Money Laundering policies/ procedures |

Item 9's international line says "International Customer" (singular) in the source.

## PEP declaration source fields

Introductory and profile text is template wording, not answers. Profiles listed: Head of State or of Government; Senior politician; Senior government, judicial or military official; Member of ruling royal family; Senior executive of state-owned corporation / government linked company; Important political party official.

| Field id | Source text | Widget |
| --- | --- | --- |
| `pepdec.q1` | 1. Are you a PEP? Yes / No | yes/no |
| `pepdec.q2` | 2. Is you or the entity related to a PEP? (Please fill in the below questions if the first two questions you answered - yes) Yes / No | yes/no. Grammar kept. The instruction refers to the first two questions. |
| `pepdec.q3.profile` | 3. If you are or related to a PEP, please indicate the profile and relationship to you | multi-checkbox: the six profiles above, plus Other (please specify) |
| `pepdec.q3.relationship` | relationship to you, inside question 3's prompt | text. The form does not print a separate relationship label. The relationship is part of question 3, not a new heading. |
| `pepdec.q3.other` | Other (please specify) | text |
| `pepdec.declaration` | I hereby declare that the details and information given above are complete and true to the best of my knowledge. | declaration text, not an optional clause |
| `pepdec.signature.name` | Name | text on an underscore line |
| `pepdec.signature.designation` | Designation | text on an underscore line |
| `pepdec.signature.date` | Date | text on an underscore line |
| `pepdec.signature.image` | Signature | signature |
| `pepdec.signature.stamp` | Stamp | stamp |

Question 3 repeats the same six profiles as the introduction. Both printings stay.

## PEP questionnaire source fields

| Field id | Source text |
| --- | --- |
| `pepquest.q1` | 1. Holding a senior public position, Member of Parliament/ member of a legislature? YES / NO |
| `pepquest.q2` | 2. Judge of financial court or member of the council of the Central? YES / NO. The question ends at "Central?" in the source. |
| `pepquest.q3` | 3. An Ambassador, consul or high ranked military officer? YES / NO |
| `pepquest.q4` | 4. A member of the managing or supervisory board of (majority) state-owned Legal Entities? YES / NO |
| `pepquest.q5` | 5. Have an immediate family member of the mentioned person(s) commonly benefit from the Assets or from an established business relationship or from another form of close business contact with the above stated person(s)? YES / NO |
| `pepquest.q6` | 6. Has a time period of at least 12 months expired since the termination of any of the above mentioned senior public position? YES / NO |
| `pepquest.details` | If Answer is YES to any of the above, kindly provide details. Two underscore lines. |
| `pepquest.declaration` | I, hereby declare that the information provided above are true and correct. |
| `pepquest.signature.name` | Name |
| `pepquest.signature.designation` | Designation |
| `pepquest.signature.date` | Date |
| `pepquest.signature.image` | Signature |
| `pepquest.signature.stamp` | Stamp |

The opening paragraphs, including "Are you?" and the Prevention Act sentences, are template wording.

## Responsible sourcing policy

The body is fixed template text, field `rspolicy.body`, pages 1 and 2 through the staff-compliance sentence, contact block, and OECD Annex II acknowledgement. It is not a questionnaire. Contact address printed in the source: `backoffice@mykaprecious.com`.

Acknowledgement inputs:

| Field id | Label |
| --- | --- |
| `rspolicy.ack.name` | Name |
| `rspolicy.ack.signature` | Signature |
| `rspolicy.ack.stamp` | Stamp |

The policy acknowledgement paragraph is source wording and stays unchanged. Version `1.1/11/2024` is source text, not an editable field.

Footer artwork on both pages, not a text-layer field and not an answer: "MYKA PRECIOUS METALS TRADING L.L.C" and "Office No 4, Belhoul Bldg., Al Dhagaya St., Deira, Gold Souk, P.O. Box: 3975, Dubai, United Arab Emirates,". Page 2 also shows the Myka logo above commitment 6. These stay by retaining the source PDF. They are not retyped into the acknowledgement.

Decoded body used for this inventory is the ToUnicode reading. It is the working copy of the wording for schema design. It is not a substitute for the PDF when a generation test checks layout.
