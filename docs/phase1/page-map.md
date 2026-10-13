# Page map

Reading order and section boundaries taken from decoded PDF text operators. Label origins are PDF user-space points, origin bottom-left, unless a row says the matrix is transformed. Wording in this map is the reading recovered from those operators. Where the PDF draws a word in separate positioned runs, spaces are shown as a person reads the line. The source grammar is kept, including awkward or truncated phrases.

Empty answer lines are not pages of text. Their ink positions are not in this map unless the source draws the blank as characters such as underscores.

## KYC — 9 pages

`MediaBox` `[0 0 595.32 841.92]`. Footer version `KYC/V01/01.04.24` plus the page number, text origin about x 440.1, y 35, on every page. The page number sits in an orange square. Logo image on every page: rectangle x 36.55, y 734.62, width 123.75, height 78.6. A render of the header also shows the title "CUSTOMER DUE DILIGENCE QUESTIONNAIRE" on two lines. That title is not in the text layer (`get_text` does not return it), so it is header artwork and must stay in the source PDF rather than be retyped.

| Page | Section | What is on the page |
| --- | --- | --- |
| 1 | Intro and 1. Business entity information | Intro paragraph for Myka Precious Metals Trading L.L.C. Then bullet labels: Name; Registered Office Address; City; Country; Business Address (if different from the registered address); Postal Code / PO Box; Telephone & Fax; Registered Email; Registration No.; Date of Establishment; Place of Establishment; Legal Structure (LLC, DMCC, FZCO, FZE, RAKEZ, ETC.); Business Type and Activities. |
| 2 | Business entity information, continued | Corporate Website; Years in Business; External Auditor; Tax Reference No. (e.g. Tin, TRN); Contact Person's Name; Contact Person's Mobile / Landline No.; Contact Person's Email; Compliance Officer's Name; Compliance Officer's Mobile / Landline No.; Compliance Officer's Email; Main Market (Geographical Scope); Main Market; How long has the entity been in the gold industry business. |
| 3 | 2. Ownership and management structure | Three repeating tables, each for holdings equal to or more than 5%: entity shareholders; ultimate beneficial owners where an entity in the shareholding pattern meets that threshold; individual shareholders. The render shows four blank body rows under each table. |
| 4 | 3. Management structure; 4. PEP questionnaire; 5. AML questionnaire starts | Management table with row groups Board of Directors and Management. The render shows two blank body rows under each group. PEP questions a and b are both printed, and the wording is the same. AML section I, item a only. |
| 5 | AML questionnaire continued | Items b through p, groups I through IV. |
| 6 | AML questionnaire end, declaration, signature | Items q through s, groups V and VI. Declaration. Signature row: Authorised Signatory's Full Name, Designation, Signature, Date, Company Stamp. |
| 7 | 6. Supply chain questionnaire; 7. Source of funds and source of wealth | Supply-chain items a through i. Source-of-funds definition and single-tick options. Source-of-wealth definition and single-tick options. |
| 8 | 8. Bank details | Bank Name; Bank Address; Account Number; IBAN; Currency; Swift Code. |
| 9 | Documents required | Instruction to attach copies, then 13 numbered categories. Each number has one Yes cell, one No cell, and one Comments cell. Items 8–11 print a domestic line and an international line inside that same row. Item 12 is marked for domestic customers only. |

## PEP declaration — 1 page

`MediaBox` `[0 0 595.32 841.92]`. Footer `PEPDec/V01/01.04.24` at about x 422.8, y 38.

| Page | Section | What is on the page |
| --- | --- | --- |
| 1 | Whole form | Title. Collection purpose. PEP definition, profile bullets, and the sentence that includes immediate family members, relatives, advisers, close associates, personal advisers, or business associates, citing FATF Recommendations 12 and 22 and UAE AML/CFT laws and regulations. Questions 1, 2, and 3. Declaration. Name, Designation, Date, Signature, Stamp. |

## PEP questionnaire — 1 page

`MediaBox` `[0 0 595.32 841.92]`. Footer `PEPQuest/V01/01.04.24` at about x 412.6, y 52.

| Page | Section | What is on the page |
| --- | --- | --- |
| 1 | Whole form | Title. Introductory paragraphs, including the Money Laundering and Terrorism Financing Prevention Act wording as printed. Six yes/no questions. A details area of two underscore lines if any answer is yes. Declaration. Name, Designation, Date, Signature, Stamp. |

## Responsible sourcing policy — 2 pages

`/Count 2`. Text is drawn under a scaling transform, so the text-matrix numbers are not page points. Page-point placement of the acknowledgement lines is unresolved. See the placement spec.

| Page | Section | What is on the page |
| --- | --- | --- |
| 1 | Title and commitments 1–5 | Title "Myka Precious Metals Trading LLC Responsible Sourcing Policy". Opening paragraphs. OECD, RJC COC, LBMA Responsible Gold Guidance, and DMCC rules sentence. Commitments 1 through 5. |
| 2 | Commitments 6–8, acknowledgement | Commitments 6 through 8. "As part of our Responsible Precious Metals Policy" bullets. Staff compliance sentence. Contact Information and `backoffice@mykaprecious.com`. OECD Annex II acknowledgement. Policy Acknowledgement paragraph. Name, Signature, Stamp. `VERSION NO.: 1.1/11/2024`. A Myka logo is centered at the top. |

Both policy pages end with footer artwork that is not in the text layer. The render reads: "MYKA PRECIOUS METALS TRADING L.L.C" and "Office No 4, Belhoul Bldg., Al Dhagaya St., Deira, Gold Souk, P.O. Box: 3975, Dubai, United Arab Emirates,". That footer is part of the source appearance. It is not a fill-in field. A later rebuild-from-text would drop it, so generation must keep the original PDF bytes.

## Configuration that is not a source page

These are not extra pages and not extra source questions:

- Which of the four templates apply to a local company, a foreign company, a mine, or an individual.
- Which of the 13 checklist rows are required for a customer type, on top of the domestic/international split already printed on KYC page 9.
- Per-document letterhead owner. The defaults are in the template registry.
- Additional checklist categories an authorised administrator may add later. Those are not part of this page map.
