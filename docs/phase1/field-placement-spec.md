# Field placement specification

This is the mapping layer for a later PDF overlay. It does not generate a PDF.

## Rules

- Overlay on a copy of the registered source bytes. Do not redraw the template in HTML and call that the source layout.
- Coordinates below are PDF user space, origin bottom-left, unit points, unless the status is `unresolved`.
- `anchor` is the text-origin of the source label (`Tm` translation), not the rectangle where an answer should be painted.
- An answer rectangle is recorded only when the source itself draws the answer marks (a ballot box, the words Yes/No, or underscore characters). Otherwise the answer rectangle is `unresolved`. Do not invent a box by estimating "to the right of the label".
- Repeating rows: column header origins are anchors. Empty body rows have no text operators, so row-slot rectangles are `unresolved` until a line-art pass measures the rules.
- Letterhead, stamp, and signature images are placed only in slots this spec marks. Customer letterhead follows `config.letterhead_owner` for that document.
- After submission, the generated file is immutable. A correction creates a new version.

KYC and both PEP forms use `MediaBox [0 0 595.32 841.92]`.

## Letterhead and fixed artwork

| Slot | Template | Status | Placement |
| --- | --- | --- | --- |
| `kyc.letterhead.myka` | kyc, every page | measured | Image `Image4`. Rectangle operator `36.55 734.62 123.75 78.6 re`, then a transform of width 123.75 and height 78.6 at (36.55, 734.62). Default owner `myka`. Customer artwork is not substituted into this slot unless the document setting says `customer`, and that substitution is a later reviewed change. |
| `pepdec.letterhead` | pep-declaration | none on source | No customer letterhead slot measured. Owner default `none`. |
| `pepquest.letterhead` | pep-questionnaire | none on source | Owner default `none`. |
| `rspolicy.letterhead` | responsible-sourcing | none on source | Heading is text in the policy body. Owner default `none`. |

## KYC label anchors

Answer rectangles for the single-line entity and bank fields are `unresolved`. The label origins are measured.

### Page 1

| Field | Anchor x | Anchor y |
| --- | --- | --- |
| `kyc.entity.name` | 76.7 | 598 |
| `kyc.entity.registered_office_address` | 76.7 | 558 |
| `kyc.entity.city` | 76.7 | 518 |
| `kyc.entity.country` | 76.7 | 477 |
| `kyc.entity.business_address` | 76.7 | 436 (wrap continues at x 84.3, y 422) |
| `kyc.entity.postal_code` | 76.7 | 381 |
| `kyc.entity.telephone_fax` | 76.7 | 339 |
| `kyc.entity.registered_email` | 76.7 | 298 |
| `kyc.entity.registration_no` | 76.7 | 257 |
| `kyc.entity.date_of_establishment` | 76.7 | 215 |
| `kyc.entity.place_of_establishment` | 76.7 | 174 |
| `kyc.entity.legal_structure` | 76.7 | 132 (wrap at x 84.3, y 119) |
| `kyc.entity.business_type_activities` | 76.6 | 91 |

### Page 2

| Field | Anchor x | Anchor y |
| --- | --- | --- |
| `kyc.entity.corporate_website` | 76.6 | 691 |
| `kyc.entity.years_in_business` | 76.6 | 649 |
| `kyc.entity.external_auditor` | 76.6 | 608 |
| `kyc.entity.tax_reference_no` | 76.6 | 567 |
| `kyc.entity.contact_name` | 76.6 | 525 |
| `kyc.entity.contact_phone` | 76.6 | 484 (wrap x 84.1, y 470) |
| `kyc.entity.contact_email` | 76.6 | 429 |
| `kyc.entity.compliance_officer_name` | 76.6 | 388 |
| `kyc.entity.compliance_officer_phone` | 76.6 | 346 (wrap x 84.1, y 333) |
| `kyc.entity.compliance_officer_email` | 76.6 | 292 |
| `kyc.entity.main_market_scope` | 76.6 | 250 |
| `kyc.entity.main_market` | 76.6 | 209 |
| `kyc.entity.gold_industry_tenure` | 76.6 | 167 (wrap x 84.1, y 154) |

### Page 3 tables

Header baselines are measured. Individual column cut-points are `unresolved` because several header words share a line and the extractor did not separate every column origin. Repeating-row rectangles are `unresolved`.

| Table | Header band y (top of the header cluster) | Left of header cluster x |
| --- | --- | --- |
| `kyc.shareholder_entity.rows` | 630 down to 607 | 51.0. Render shows four blank body rows. Row rectangles `unresolved`. |
| `kyc.ubo.rows` | 434 down to 411 | 51.0. Render shows four blank body rows. Row rectangles `unresolved`. |
| `kyc.shareholder_individual.rows` | 250 down to 227 | 51.0. Render shows four blank body rows. Row rectangles `unresolved`. |

Section titles: ownership heading x 68.1, y 693. Entity-shareholder title x 79.5, y 657. UBO title x 79.5, y 473, with the pattern sentence at x 58.1, y 461. Individual-shareholder title x 79.5, y 277.

### Page 4 management, PEP, AML a

Management title x 65.3, y 693. Header cluster from y 657 to y 634, left x 70.6, with passport/nationality text also at x 303.1 and document reference at x 488.1. Group labels: Board of Directors around y 568–557, x 62.5; Management around y 455, x 52.6. The page 4 render shows two blank body rows under Board of Directors and two under Management. Those row rectangles are still `unresolved` in points. The render also confirms questions a and b are both printed with the same wording.

| Field | Measured marks |
| --- | --- |
| `kyc.pep.a` | Question text x 66.3, y 347, wrapping at x 84.3. `☐ Yes` at x 303.1, y 355. `☐ No` at x 303.1, y 333. Details prompt x 303.1, y 320. Details writing rectangle: `unresolved`. |
| `kyc.pep.b` | Question text x 66.3, y 273, wrapping at x 84.3. `☐ Yes` at x 303.1, y 278. `☐ No` at x 303.1, y 259. Details prompt x 303.1, y 246. Details writing rectangle: `unresolved`. |
| `kyc.aml.a` | Question x 104.9, y 110, wrapping at x 122.9, y 99 and y 88. Yes/No and comments cells: `unresolved`. |

AML title x 65.3, y 196. Column headings: Description / Yes/No around x 48.2, y 155; Comments around x 388.0, y 166, with the No/N/A instruction at x 388.0, y 143.

### Page 5 AML b–p

Question text starts at x 104.9. Continuation lines start at x 122.9. Yes/No and comments rectangles are `unresolved`. Group titles are at x 48.2.

| Field | First-line y |
| --- | --- |
| `kyc.aml.b` | 707 |
| `kyc.aml.c` | 673 |
| `kyc.aml.d` | 629 |
| `kyc.aml.e` | 584 |
| `kyc.aml.f` | 540 |
| `kyc.aml.g` | 517 |
| `kyc.aml.h` | 495. "If yes, please provide details." at x 141.3, y 451 |
| `kyc.aml.i` | 439. "If yes, please provide details." at x 139.2, y 395 |
| `kyc.aml.j` | 371. Group II title y 383 |
| `kyc.aml.k` | 338 |
| `kyc.aml.l` | 270. Group III title y 281 |
| `kyc.aml.m` | 225 |
| `kyc.aml.n` | 192 |
| `kyc.aml.o` | 153. Group IV title y 168 |
| `kyc.aml.p` | 114 |

### Page 6

| Field | Anchor |
| --- | --- |
| `kyc.aml.q` | x 104.9, y 694. Group V title x 48.2, y 706 |
| `kyc.aml.r` | x 104.9, y 660 |
| `kyc.aml.s` | x 104.9, y 625. Group VI title x 48.2, y 637 |
| `kyc.declaration.accepted` | Block from x 42.6, y 570 ("DECLARATION:") through y 436. This is printed text, not an overlay. |
| `kyc.signature.*` | One source line at x 51.4, y 380 reads "Authorised Signatory's Full Name Designation Signature Date Company Stamp". Separate column rectangles for name, designation, signature, date, and stamp are `unresolved`. |

### Page 7

Supply-chain questions a–i: label x 84.3, wrap x 102.3. Answer rectangles `unresolved`.

| Field | First-line y |
| --- | --- |
| `kyc.supply.a` | 664 |
| `kyc.supply.b` | 628 |
| `kyc.supply.c` | 589 |
| `kyc.supply.d` | 550 |
| `kyc.supply.e` | 514 |
| `kyc.supply.f` | 479 |
| `kyc.supply.g` | 443 |
| `kyc.supply.h` | 408 |
| `kyc.supply.i` | 367 |

Funds and wealth. Section title x 65.3, y 314.

| Field | Measured marks |
| --- | --- |
| `kyc.funds.source` | Prompt x 84.3, y 281. Definition x 102.3, y 266–238. Option line, including ballot boxes, is one text run at x 102.3, y 223, continuing at y 207. Individual option x positions inside that run are `unresolved`. |
| `kyc.wealth.source` | Prompt x 84.3, y 160. Definition x 102.3, y 146–132. Option line at x 102.3, y 116, continuing at y 100. Individual option x positions are `unresolved`. |

### Page 8

| Field | Anchor x | Anchor y |
| --- | --- | --- |
| `kyc.bank.name` | 48.2 | 619 |
| `kyc.bank.address` | 48.2 | 534 |
| `kyc.bank.account_number` | 48.2 | 448 |
| `kyc.bank.iban` | 48.2 | 363 |
| `kyc.bank.currency` | 48.2 | 277 |
| `kyc.bank.swift` | 48.2 | 192 |

Section title x 65.3, y 687. Value rectangles `unresolved`.

### Page 9 checklist

Title x 42.6, y 705. Instruction x 42.6, y 683. Column headings Description / Yes / No at x 119.4, y 658. Separate Yes and No column origins are `unresolved` because they share that heading run. Comments column origin is `unresolved`.

Row description anchors (first line):

| Field | x | y |
| --- | --- | --- |
| `kyc.docs.1` | 66.3 | 639 |
| `kyc.docs.2` | 66.3 | 615 |
| `kyc.docs.3` | 66.3 | 582 |
| `kyc.docs.4` | 66.3 | 548 |
| `kyc.docs.5` | 66.3 | 524 |
| `kyc.docs.6` | 66.3 | 491 |
| `kyc.docs.7` | 66.3 | 466 |
| `kyc.docs.8.domestic` | 66.3 | 442 |
| `kyc.docs.8.international` | 84.3 | 405 |
| `kyc.docs.9.domestic` | 66.3 | 376 |
| `kyc.docs.9.international` | 84.3 | 348 |
| `kyc.docs.10.domestic` | 66.3 | 319 |
| `kyc.docs.10.international` | 84.3 | 282 |
| `kyc.docs.11.domestic` | 66.3 | 244 |
| `kyc.docs.11.international` | 84.3 | 206 |
| `kyc.docs.12` | 66.3 | 159 |
| `kyc.docs.13` | 66.3 | 130 |

Yes, No, and Comments cells for every numbered row are `unresolved` in points. The page 9 render shows one Yes cell, one No cell, and one Comments cell per number. Items 8–11 put the domestic line and the international line in that same row.

## PEP declaration

Page-point anchors. Underscore characters are in the same text run as Name, Designation, Date, Signature, and Stamp, so the glyph run origin is known and the ink width of the underscores is `unresolved` (font widths were not measured).

| Field | Anchor x | Anchor y | Answer marks |
| --- | --- | --- | --- |
| `pepdec.q1` | 90.0 | 382 | Yes/No text at x 180.0, y 369. Separate checkbox rectangles `unresolved`. |
| `pepdec.q2` | 90.0 | 356 | Yes/No at x 180.0, y 331. |
| `pepdec.q3.profile` | 90.0 | 318 | Profile lines from y 306 to y 230, x 144.0. Checkbox rectangles `unresolved`. |
| `pepdec.q3.other` | 144.0 | 230 | Specify line rectangle `unresolved`. |
| `pepdec.declaration` | 72.0 | 204 | Printed text through y 192. |
| `pepdec.signature.name` | 72.0 | 154 | Underscores in the same run. Width `unresolved`. |
| `pepdec.signature.designation` | 72.0 | 139 | Same. |
| `pepdec.signature.date` | 72.0 | 125 | Same. |
| `pepdec.signature.image` | 72.0 | 110 | Same. Image box `unresolved`. |
| `pepdec.signature.stamp` | 72.0 | 96 | Same. Image box `unresolved`. |

## PEP questionnaire

| Field | Anchor x | Anchor y | Answer marks |
| --- | --- | --- | --- |
| `pepquest.q1` | 72.0 | 510 | YES/NO at x 470.1, y 509 |
| `pepquest.q2` | 72.0 | 488 | YES/NO in the same line. Split x `unresolved`. |
| `pepquest.q3` | 72.0 | 466 | YES/NO in the same line. Split x `unresolved`. |
| `pepquest.q4` | 72.0 | 444 | YES/NO on the wrap line at x 90.0, y 431. Split x `unresolved`. |
| `pepquest.q5` | 72.0 | 403 | YES/NO on the last wrap at x 108.0, y 376. Split x `unresolved`. |
| `pepquest.q6` | 72.0 | 348 | YES/NO on the wrap at x 154.8, y 334. Split x `unresolved`. |
| `pepquest.details` | 72.0 | 311 | Underscore lines at x 72.0, y 289 and y 267. Line width `unresolved`. |
| `pepquest.declaration` | 79.1 | 227 | Printed text. |
| `pepquest.signature.name` | 79.1 | 197 | Underscore run. Width `unresolved`. |
| `pepquest.signature.designation` | 79.1 | 179 | Same. |
| `pepquest.signature.date` | 79.1 | 160 | Same. |
| `pepquest.signature.image` | 79.1 | 142 | Image box `unresolved`. |
| `pepquest.signature.stamp` | 79.1 | 123 | Image box `unresolved`. |

## Responsible sourcing policy

Status of page-point coordinates: `unresolved`.

The content stream draws the policy text with text-matrix translations in the thousands (for example the title line's matrix translation is about x 2556, y 3153, and the version line is about x 11847, y 22909). Those numbers are not positions on a 595 by 842 page. A transform (`cm`) is in effect. This spec does not divide those numbers by an assumed scale.

What is known without guessing a scale:

- Page 1 contains the title and commitments 1–5, in that reading order.
- Page 2 contains commitments 6–8, the further policy bullets, the contact line `backoffice@mykaprecious.com`, the OECD acknowledgement, the policy acknowledgement, then Name, Signature, Stamp, then `VERSION NO.: 1.1/11/2024`.
- Name, Signature, and Stamp are distinct text objects. Their page-point rectangles are `unresolved`.
- Both pages show a footer in the render that is not in the text layer: "MYKA PRECIOUS METALS TRADING L.L.C" and "Office No 4, Belhoul Bldg., Al Dhagaya St., Deira, Gold Souk, P.O. Box: 3975, Dubai, United Arab Emirates,". Page 2 also shows a centered Myka logo above the body. These are source artwork. Their page-point rectangles are `unresolved`. They are not customer-letterhead slots.
- No customer letterhead image slot was identified.

A later calibration pass must invert the page transform and record page-point rectangles before any overlay is drawn. Until that pass, the policy acknowledgement signature and stamp are not placeable.

## Signature evidence the overlay must not invent

The placement spec positions images. It does not define a signature as verified. When a later phase stores a signature it must record method (image versus verifiable electronic signature), the explicit authorisation, consent, and the evidence reference. That record is data, not a coordinate.
