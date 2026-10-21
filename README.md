# Afterline

Afterline is a disaster-response image triage desk built around GenLayer's native image processing. A field analyst submits a public, licensed before-and-after image pair for one site. Validators independently compare the images and check both image hashes, visible change, evidence quality, and confidence. The contract stores that finding for a human response team to review.

Afterline helps teams identify image pairs that need human inspection. It does not declare a building safe, estimate casualties, approve insurance, or direct emergency operations. A changed pair is routed to `human_review`; the contract does not turn an unverified severity label into an autonomous urgent action.

## Why image consensus

Validators must agree on visible change, evidence quality, confidence, and both image commitments. Confidence disagreement rejects the proposed result, including a high-confidence leader versus a medium- or low-confidence validator. Routine review requires agreed high confidence, clear evidence, and no visible change. Damage labels, cue codes, and rationale remain supporting descriptions rather than independently agreed facts.

The first release targets public disaster imagery and response teams. Image bytes are included in a public GenLayer transaction. Submit only public, licensed, non-sensitive images. Do not submit private claimant photos, identifiable people, addresses, or evidence subject to a confidentiality restriction.

## Current product state

The corrected StudioNet deployment is [`0xC0262244F0a1bEE29940012CcB4f4e2260865fB8`](https://explorer-studio.genlayer.com/address/0xC0262244F0a1bEE29940012CcB4f4e2260865fB8). The [public desk](https://afterline-ten.vercel.app/) and [distinct-image assessment](https://afterline-ten.vercel.app/assessments/af-katrina-20261021-consensus) use this deployment. The assessment transaction is finalized with `MAJORITY_AGREE`; persisted readback reports unclear change, limited evidence, low confidence and human review. [Exact hashes, licensing, transaction and reproduction steps](docs/LIVE_VERIFICATION_2026_10_21.md) are documented together.

The previous deployment `0x39CA4c8686E536d57Eb425996066742be790Dc8e` used an identical-byte shortcut. Its control assessment does **not** demonstrate visual consensus or the corrected workflow. Production access is now public; an HTTP request without cookies returned 200 without an authentication redirect on October 21, 2026.

Identical image bytes now fail before consensus and create no assessment. Every committed comparison must use the nondeterministic visual workflow. No field-practitioner review has been completed yet.

The frontend decodes JPEG, PNG, or WebP uploads and re-encodes them to JPEG. Direct contract callers must submit JPEG. On-chain checks bound file size, dimensions, marker lengths, frame and scan structure, quantization presence, and the final end marker. These container checks are not a full entropy decoder or evidence of undamaged contents. Image-provider decode failures cannot create a successful visual assessment.

## Local verification

```powershell
python -m pip install -r requirements.txt
python -m pytest -p no:cacheprovider tests/direct -q
python -m genvm_linter.cli check --json contracts/afterline.py

npm install
npm run build
npm run dev
```

The 27 direct tests mock the vision result. They verify input validation, contradictory-output normalization, conservative routing, image commitments, duplicate-ID protection, and rejection of confidence disagreements or malformed images. Live visual consensus is demonstrated separately by the finalized USGS image-pair transaction documented above. This single real-image run does not establish a disaster-triage accuracy benchmark.

## Real-image data plan

- **USGS Hurricane Katrina pair:** a real public-domain before/after Landsat comparison of New Orleans, dated April 24 and August 30, 2005. The pair is cropped from the USGS composite and documented in [`tests/fixtures/README.md`](tests/fixtures/README.md). It supports a regional water-change and image-quality smoke test only; it does not establish building-level ground truth.
- **xBD / xView2:** paired, human-labeled satellite images of real disaster events, suitable for realistic before-and-after tests. SEI describes the dataset as public under a Creative Commons license, but that does not mean unrestricted commercial use. Dataset mirrors identify the terms as CC BY-NC-SA 4.0; verify the official registration terms and the specific image source before use. For this non-commercial evaluation, keep each image's event, source filename, original label, and attribution in the test manifest. Do not redistribute image pairs or use them commercially without confirming permission. [SEI overview](https://www.sei.cmu.edu/projects/xview-2-challenge/) · [Official xBD dataset page](https://xview2.org/dataset)
- **CarDD:** real vehicle damage photos and labels that could support a later, separately scoped vehicle workflow. The dataset requires a licensing form and prior consent; commercial testing requires additional authorization. It is not included in this product's first test set. [CarDD project page](https://cardd-ustc.github.io/) · [license](https://cardd-ustc.github.io/docs/CarDD_license.pdf)
- **Field review:** after the public-dataset benchmark, ask a disaster-response analyst to review an opt-in sample of public or properly de-identified imagery. Record disagreements and use them to refine the damage rubric; do not treat a model score as ground truth.

## Contract interface

- `assess_images(...)` compares two public image byte arrays and commits a consensus result.
- `get_assessment(assessment_id)` reads the committed result and image hashes.
- `get_assessment_ids()` lists assessment identifiers.

Triage routing is conservative: a clear no-change pair with consensus-supported high confidence becomes `routine_review`; every visible-change, uncertain, or limited-evidence pair becomes `human_review`. A confidence disagreement fails consensus and does not create a new assessment.
