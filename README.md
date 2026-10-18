# Afterline

Afterline is a disaster-response image triage desk built around GenLayer's native image processing. A field analyst submits a public, licensed before-and-after image pair for one site. Validators independently compare the images and check the fields that affect routing: both image hashes, visible change, evidence quality, the broad damage band, the high-confidence threshold, and the derived priority. The contract stores that triage result for a human response team to review.

Afterline helps teams prioritize inspection. It does not declare a building safe, estimate casualties, approve insurance, or direct emergency operations. `urgent_review` is a request for a qualified person to inspect the evidence sooner; it is not an autonomous action.

## Why image consensus

The core decision depends on visual differences between two images, not a text page or a policy statement. Major and destroyed share the same severe triage band because both route to urgent human review. The exact cue codes and rationale are supporting descriptions from the lead model; validators do not need identical wording or cue lists. A committed result therefore confirms the triage route and evidence integrity, not pixel-level ground truth or every detailed label.

The first release targets public disaster imagery and response teams. Image bytes are included in a public GenLayer transaction. Submit only public, licensed, non-sensitive images. Do not submit private claimant photos, identifiable people, addresses, or evidence subject to a confidentiality restriction.

## Current product state

The current StudioNet deployment is `0x39CA4c8686E536d57Eb425996066742be790Dc8e`. The public desk is available at [afterline-shalyxs-projects.vercel.app](https://afterline-shalyxs-projects.vercel.app/). A live wallet-backed control assessment is committed on-chain as `af-789d4557-71d6-4c1d-83a8-878a984757ba`; its before and after SHA-256 commitments match and the contract readback is `no_damage`, `observed_change: no`, `evidence_quality: clear`, `confidence_band: high`, and `priority: routine_review`.

The identical-byte control is intentionally resolved deterministically before nondeterministic visual analysis. Changed image pairs still use GenLayer validator consensus and fail closed when validators disagree on image hashes, visible change, evidence quality, confidence threshold, or routing priority. No field-practitioner review has been completed yet.

## Local verification

```powershell
python -m pip install -r requirements.txt
python -m pytest -p no:cacheprovider tests/direct -q
python -m genvm_linter.cli check --json contracts/afterline.py

npm install
npm run build
npm run dev
```

The direct tests mock the vision result. They verify input validation, contradictory-output rejection, priority derivation, image hash commitment, duplicate-ID protection, consensus tolerance for same-route label variation, and fail-closed behavior for changed priority, visible change, evidence quality, confidence threshold, or image hashes. They do not prove that a live Studio validator will agree on a real image pair; that remains a release gate.

## Real-image data plan

- **USGS Hurricane Katrina pair:** a real public-domain before/after Landsat comparison of New Orleans, dated April 24 and August 30, 2005. The pair is cropped from the USGS composite and documented in [`tests/fixtures/README.md`](tests/fixtures/README.md). It supports a regional water-change and image-quality smoke test only; it does not establish building-level ground truth.
- **xBD / xView2:** paired, human-labeled satellite images of real disaster events, suitable for realistic before-and-after tests. SEI describes the dataset as public under a Creative Commons license, but that does not mean unrestricted commercial use. Dataset mirrors identify the terms as CC BY-NC-SA 4.0; verify the official registration terms and the specific image source before use. For this non-commercial evaluation, keep each image's event, source filename, original label, and attribution in the test manifest. Do not redistribute image pairs or use them commercially without confirming permission. [SEI overview](https://www.sei.cmu.edu/projects/xview-2-challenge/) · [Official xBD dataset page](https://xview2.org/dataset)
- **CarDD:** real vehicle damage photos and labels that could support a later, separately scoped vehicle workflow. The dataset requires a licensing form and prior consent; commercial testing requires additional authorization. It is not included in this product's first test set. [CarDD project page](https://cardd-ustc.github.io/) · [license](https://cardd-ustc.github.io/docs/CarDD_license.pdf)
- **Field review:** after the public-dataset benchmark, ask a disaster-response analyst to review an opt-in sample of public or properly de-identified imagery. Record disagreements and use them to refine the damage rubric; do not treat a model score as ground truth.

## Contract interface

- `assess_images(...)` compares two public image byte arrays and commits a consensus result.
- `get_assessment(assessment_id)` reads the committed result and image hashes.
- `get_assessment_ids()` lists assessment identifiers.

Triage priority is deterministic: a clear, high-confidence major or destroyed classification becomes `urgent_review`; a clear, high-confidence no-damage or minor classification becomes `routine_review`; uncertain or limited evidence becomes `human_review`.
