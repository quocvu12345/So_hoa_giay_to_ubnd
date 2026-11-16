# UBND project workflow

The project has `data/form-test-data/classification.json` with 768 unique attachments. The snapshot for the requested batch contains exactly 441 entries with `input_status=applicant_inputs_detected`: 376 DOCX, 53 legacy DOC, and 12 PDF. Freeze this selection; do not silently regenerate the classifier and change the requested denominator.

The batch lives under `data/vietnamese-form-dataset/`. The original 68 curated PDFs under `data/form-test-data/` are a separate dataset and must not be overwritten or used to inflate batch coverage.

On the current machine the Python environment with PyMuPDF, Pillow and ReportLab is `/Volumes/quocDisk/AI/document-samples/venv/bin/python`. A private LibreOffice 26.8.3.1 runtime is at `/Volumes/quocDisk/AI/document-samples/tools/lo-extracted/LibreOffice/LibreOffice.app/Contents/MacOS/soffice`. It was extracted from the official installer into the task tools directory; the user's desktop office installation is not used. If these paths are absent, accept explicit CLI paths and resolve available runtimes without changing unrelated user settings.

From the project root:

```sh
/Volumes/quocDisk/AI/document-samples/venv/bin/python skills/vietnamese-form-dataset/scripts/build_dataset.py --root . --copies 2 --phase all --resume
```

Use `--phase convert`, `plan`, `generate`, `verify` or `package` to resume a stage. Source PDFs can be rendered without Word conversion. Conversion uses isolated headless profiles; parallel renderer processes must have separate office profiles.

Inspect `coverage.json`, `verification.json`, `schema-review.json` and `index.html`. The archive contains output PDFs, separate labels, schemas and provenance. Raw DOC/DOCX files remain in the official source library; source download links point to those files.

When returning to the task, inspect progress and records before regenerating. Existing source hashes and run settings determine whether outputs are reusable. Changing field semantics or fonts requires rebuilding the affected samples and labels together.

## Whole dossiers

`build_dossiers.py` uses the 425-item Hanoi commune notice dated 27 April 2026 as a traceable inventory for Từ Liêm. This is not a declaration that all 425 remain legally applicable today. The current source library records 32 reviewed lifecycle changes and 55 baseline entries without matched details. Preserve these denominators and the source links.

The directory `data/tuliem-dossiers/` has one blueprint for every inventory row and two synthetic scenario manifests per blueprint. Only scenarios with actual source forms have a merged test PDF. All others keep a profile/checklist and an explicit source/lifecycle gap. `legally_complete` is false until the complete conditional requirements and actual supporting papers have been reviewed.

`profile.json` is generated once per packet. Roles and explicit aliases apply to every form in that packet. Supporting papers that have no supplied original are left missing; a generated fact sheet must not be passed off as a government certificate. `checklist.json` retains the source component wording, section, published quantities, candidate form versions and selected condition. `packet.json` supplies document identities, hashes and merged-PDF page ranges.

The API's `cases` hold service case IDs/codes and processing times, while `executionCases` often hold submit/show/notes headings mixed with genuine alternative conditions. They must not be blindly treated as a flat list of simultaneously mandatory papers. The default test selects one published condition for which a usable source form exists; alternate groups remain listed as not selected.

Stages: `prepare` reuses the 441-file batch and converts additional applicant-prepared attachments; `plan` creates all checklists; `generate` re-renders shared-profile documents and merges packets; `verify` checks cross-document entities, source pixels and page boundaries; `package` includes only current referenced files, excluding stale PDFs from earlier case selections.
