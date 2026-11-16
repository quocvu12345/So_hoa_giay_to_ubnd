Vietnamese Form Dataset — synthetic administrative form fixtures

441 source attachments × 2 copies = 882 nonempty synthetic PDFs.
2436 PDF pages; 22490 inserted values with separate ground-truth JSON.
Two OFL font styles: Patrick Hand and Mali. All records and identifiers are synthetic; not real handwriting.
Original Word files are rendered by LibreOffice 26.8.3.1 and preserved as PDF backgrounds.
The layout authority for insertion coordinates is source-pdf/<template_id>.pdf, not text reconstructed from a document.
Original source hashes and public source URLs are in targets.json and manifest.json.

Only recognized applicant fields are filled. Official signatures, stamps and confirmation sections are reserved.
Unresolved labels, unfitted values and conditional/unused slots remain explicit in schemas/ and ground-truth/.
Schema semantics are automatically inferred, not manually reviewed legal classifications.
Some second copies intentionally omit one optional contact/identity field. Check expected_status before scoring.

Use pdf/ as OCR input. Use ground-truth/ only for scoring or supervised labels, never as part of the OCR prompt.
Value matching must use field ID, role and page/region; finding a name elsewhere on a page does not count.
The PDFs contain a raster image per page and no hidden answer text or AcroForm values.
verification.json documents hash, count, bounds and printed-background checks for all PDFs.
Contact sheets under qa/ are for visual inspection. Automatic checks do not prove every semantic label correct.

Open index.html offline or http://127.0.0.1:8765/vietnamese-form-dataset/ to browse sources, copies and labels.
The skill source is in the project skills/vietnamese-form-dataset/ directory and installed in the user's Codex skills directory.
