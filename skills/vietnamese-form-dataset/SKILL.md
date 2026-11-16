---
name: vietnamese-form-dataset
description: Generate labelled synthetic Vietnamese administrative form datasets from original Word/PDF templates, with consistent people and dates, multiple fonts, two or more copies per template, raster PDFs, field values and input coordinates. Use for bulk test data or OCR fixtures; preserve original layouts and distinguish synthetic labels from model predictions.
---

# Vietnamese Form Dataset

Use the supplied templates as the layout authority. Generate test records independently of OCR predictions. Keep field IDs, roles, values, page numbers and coordinates in separate ground-truth JSON files.

For the existing UBND project, use [the project workflow](references/project-workflow.md). The executable is `scripts/build_dataset.py`; run `--help` before using a new option. `--root` selects the project and `--targets` selects a frozen classification snapshot. The `applicant_inputs_detected` classification is a candidate selection, not proof that every dotted line is an input.

For whole dossiers by ward procedure, use `scripts/build_dossiers.py --root <project> --copies 2 --phase all --resume`. This creates `data/tuliem-dossiers/` with source-backed checklists, shared profiles, per-document labels, merged test PDFs and ZIPs. Read the dossier section of [the project workflow](references/project-workflow.md#whole-dossiers) before changing case selection.

## Outputs and review

- Produce exactly the requested copies for every selected template. A blank, conversion failure or missing schema must not count as a filled sample. Record per-template outcomes and retry failures without replacing successful copies.
- Retain source SHA-256, original attachment and conversion method. Render Word with an actual office engine and overlay the resulting PDF. Preserve printed paragraphs, tables and pagination of that conversion. Do not rebuild government forms as generic label/value lists.
- Generate related names, identifiers, dates and addresses from one seeded scenario per copy. Treat roles separately. Do not assign the same ID to different persons. Branches that do not apply can remain blank with an explicit reason.
- A dossier uses one shared profile across all its forms. Independently seeded template samples must be regenerated before merging. Verify role identities across documents and store merged PDF page ranges in the packet manifest.
- Preserve submit/show/instruction/authority roles and conditional requirements. Public `executionCases` can mean headings or true alternatives; never concatenate all alternatives into one purported ordinary application. Keep all source cases visible and state which condition the test selects. Do not interpret `required=false` as a universal exemption.
- A source-less checklist is not a filled dossier. Do not count missing supporting papers as supplied or portray an amended/repealed baseline code as current. Distinguish the dated inventory denominator, cases with actual filled PDFs and unresolved legal/source coverage.
- Use font styles for volume, and describe them as font simulation. An image generator is optional for a separate small set of natural handwriting variants; inspect the actual generated values before assigning labels. Never describe a synthetic font as real handwriting.
- Exclude instructional footnotes, page numbers, official signature/seal areas and administrative confirmation sections from applicant inputs. Mixed files can contain both applicant and agency forms. Leave uncertain candidates visible in the schema review report instead of filling them with generic prose.
- Store any deliberately missing values as empty ground-truth fields. Separate value matching from page/region matching during evaluation. Keep train/eval groups by source template and writer/style so neighbouring variants do not leak into both sets.
- Raster PDFs must not contain hidden answer text or field values. Verify source hashes, per-template copy counts, unique IDs, values fitting within their regions and preservation of the printed background outside insertion regions. Inspect rendered contact sheets and pages flagged by checks before reporting completion.

The schema report distinguishes automatically inferred semantics from human-reviewed mappings. Do not label automatic coverage as a legal review or claim the test documents are ready for administrative submission.
