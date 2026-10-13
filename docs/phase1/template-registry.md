# Template version registry

Phase 1 record only. These files are the immutable source templates. No generated PDF, form schema, or cloud region exists yet.

Page counts were read from each PDF page tree (`/Type /Pages` `/Count`, and `/Kids` for the policy). Hashes are SHA-256 of the bytes copied into this repository. The chat attachments and the copies in `OneDrive\Documents` produced the same four hashes.

Coordinate space for the KYC and PEP files is PDF user space: origin at the bottom left, `MediaBox` `[0 0 595.32 841.92]`.

## Registered templates

| Template id | File | Pages | Version string printed on the source | SHA-256 | Bytes | Default letterhead owner |
| --- | --- | --- | --- | --- | --- | --- |
| `kyc` | [MYKA_KYC_Form.pdf](../templates/source/MYKA_KYC_Form.pdf) | 9 | `KYC/V01/01.04.24` (footer, text origin about x 440.1, y 35, then the page number) | `d1513262ef2c6dac663ccce91152bd8fcf77d2e3fdced8c67379979d3f5430e0` | 327127 | MYKA. Each page draws embedded image `Image4` in a rectangle at x 36.55, y 734.62, width 123.75, height 78.6. |
| `pep-declaration` | [MYKA_PEP_DECLARATION_FORM_V1_01.04.24.pdf](../templates/source/MYKA_PEP_DECLARATION_FORM_V1_01.04.24.pdf) | 1 | `PEPDec/V01/01.04.24` (text origin about x 422.8, y 38) | `f284bb4d99eb8d1575f410a7bb320af0fb08fa21b40095778c259b0eab12f6fd` | 102361 | None. The form uses its own printed heading. Customer letterhead is not applied unless a later reviewed configuration says so. |
| `pep-questionnaire` | [MYKA_PEP_QUESTIONNAIRE_V1_01.04.24.pdf](../templates/source/MYKA_PEP_QUESTIONNAIRE_V1_01.04.24.pdf) | 1 | `PEPQuest/V01/01.04.24` (text origin about x 412.6, y 52) | `f8f5f2a2e1acf07c0608b44183c2917bbbdad247fef87de055965156450697a9` | 116401 | None. Same rule as the declaration. |
| `responsible-sourcing` | [MYKA_RESPONSIBLE_SOURCING_POLICY_V_1.1.11.2024_FOR_CLIENTS.pdf](../templates/source/MYKA_RESPONSIBLE_SOURCING_POLICY_V_1.1.11.2024_FOR_CLIENTS.pdf) | 2 | `VERSION NO.: 1.1/11/2024` | `e2c40454208a001de527daec96678b33274d9c30a5a38bb67cf10a0933467c9c` | 652154 | None. The policy heading is part of the source text. Customer letterhead is not applied unless a later reviewed configuration says so. |

The policy page tree is `/Count 2` with kids `3 0 R` and `143 0 R`. Its text matrices are in a transformed space, so those numbers are not page-point overlay coordinates. See the placement spec.

## Duplicates not copied

The chat attachment folder also contained byte-identical copies of the KYC form (`…__1.pdf`, same SHA-256) and the PEP declaration (`…_1.pdf`, same SHA-256). They are not stored a second time.

## What this registry does not claim

- These PDFs are not AcroForm documents. There are no PDF form-field widgets to import.
- No generated document has been compared with these sources.
- Letterhead defaults above are the Phase 1 reading of the artwork that is already printed. They are configuration defaults for a later per-document setting, not a change to the files.
