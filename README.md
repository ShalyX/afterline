# Afterline

Afterline is a disaster-response image triage desk built around GenLayer's native image processing. A field analyst submits a public, licensed before-and-after image pair for one site. Validators independently compare the images and check the stable fields behind the product claim: both image hashes, visible change, and evidence quality. The contract stores that evidence-bound finding for a human response team to review.

Afterline helps teams identify image pairs that need human inspection. It does not declare a building safe, estimate casualties, approve insurance, or direct emergency operations. A changed pair is routed to `human_review`; the contract does not turn an unverified severity label into an autonomous urgent action.

## Why image consensus

The core decision depends on whether the same two images show a visible change and whether the evidence is usable, not on a text page or a policy statement. Validators must agree on those stable fields and on both image commitments. The lead model's damage label, confidence, cue codes, and rationale are supporting descriptions; validators do not need identical wording or cue lists. A committed result therefore confirms the visible-change finding and evidence integrity, not pixel-level ground truth or every detailed label.

The first release targets public disaster imagery and response teams. Image bytes are included in a public GenLayer transaction. Submit only public, licensed, non-sensitive images. Do not submit private claimant photos, identifiable people, addresses, or evidence subject to a confidentiality restriction.

## Current product state

The current StudioNet deployment is `0x39CA4c8686E536d57Eb425996066742be790Dc8e`. The public desk is available at [afterline-shalyxs-projects.vercel.app](https://afterline-shalyxs-projects.vercel.app/), with the [contract explorer](https://explorer-studio.genlayer.com/address/0x39CA4c8686E536d57Eb425996066742be790Dc8e) and [live control assessment](https://afterline-shalyxs-projects.vercel.app/assessments/af-789d4557-71d6-4c1d-83a8-878a984757ba) available for review. The assessment is committed on-chain; its before and after SHA-256 commitments match and the contract readback is `no_damage`, `observed_change: no`, `evidence_quality: clear`, `confidence_band: high`, and `priority: routine_review`.

The identical-byte control is intentionally resolved deterministically before nondeterministic visual analysis. Changed image pairs still use GenLayer validator consensus and fail closed when validators disagree on image hashes, visible change, or evidence quality. No field-practitioner review has been completed yet.

## Local verification

```powershell
python -m pip install -r requirements.txt
python -m pytest -p no:cacheprovider tests/direct -q
python -m genvm_linter.cli check --json contracts/afterline.py

npm install
npm run build
npm run dev
```

The direct tests mock the vision result. They verify input validation, contradictory-output rejection, conservative human-review routing, image hash commitment, duplicate-ID protection, consensus tolerance for lead-detail variation, and fail-closed behavior for changed visible findings, evidence quality, or image hashes. They do not prove that a live Studio validator will agree on a real image pair; that remains a release gate.

## Real-image data plan

- **USGS Hurricane Katrina pair:** a real public-domain before/after Landsat comparison of New Orleans, dated April 24 and August 30, 2005. The pair is cropped from the USGS composite and documented in [`tests/fixtures/README.md`](tests/fixtures/README.md). It supports a regional water-change and image-quality smoke test only; it does not establish building-level ground truth.
- **xBD / xView2:** paired, human-labeled satellite images of real disaster events, suitable for realistic before-and-after tests. SEI describes the dataset as public under a Creative Commons license, but that does not mean unrestricted commercial use. Dataset mirrors identify the terms as CC BY-NC-SA 4.0; verify the official registration terms and the specific image source before use. For this non-commercial evaluation, keep each image's event, source filename, original label, and attribution in the test manifest. Do not redistribute image pairs or use them commercially without confirming permission. [SEI overview](https://www.sei.cmu.edu/projects/xview-2-challenge/) · [Official xBD dataset page](https://xview2.org/dataset)
- **CarDD:** real vehicle damage photos and labels that could support a later, separately scoped vehicle workflow. The dataset requires a licensing form and prior consent; commercial testing requires additional authorization. It is not included in this product's first test set. [CarDD project page](https://cardd-ustc.github.io/) · [license](https://cardd-ustc.github.io/docs/CarDD_license.pdf)
- **Field review:** after the public-dataset benchmark, ask a disaster-response analyst to review an opt-in sample of public or properly de-identified imagery. Record disagreements and use them to refine the damage rubric; do not treat a model score as ground truth.

## Contract interface

- `assess_images(...)` compares two public image byte arrays and commits a consensus result.
- `get_assessment(assessment_id)` reads the committed result and image hashes.
- `get_assessment_ids()` lists assessment identifiers.

Triage routing is conservative: a clear, high-confidence no-change pair becomes `routine_review`; every visible-change, uncertain, or limited-evidence pair becomes `human_review`. Severity and confidence remain lead-model context, not autonomous routing authority.
