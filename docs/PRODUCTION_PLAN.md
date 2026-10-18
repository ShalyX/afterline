# Afterline production plan

## Intended users

Disaster-response analysts at local emergency-management teams and relief organizations who need to compare public satellite imagery and decide which sites deserve a faster human inspection.

## Product job

Turn a cited pair of public before-and-after images into an auditable, consensus-backed triage record. The output helps organize human review. It never declares structural safety or replaces an on-site inspection.

## Current verification evidence

- Public desk: https://afterline-shalyxs-projects.vercel.app/
- StudioNet contract: `0x39CA4c8686E536d57Eb425996066742be790Dc8e`
- Live control assessment: `af-789d4557-71d6-4c1d-83a8-878a984757ba`
- Verified readback: identical before/after SHA-256 commitments, `no_damage`, `observed_change: no`, `evidence_quality: clear`, `confidence_band: high`, and `routine_review`.
- Remaining release gate: independent field-practitioner review of categories, routing language, and representative examples.

## Release gates

### 1. Evidence and dataset gate

- Select an xBD event only after recording the official registration terms and confirming that the intended evaluation is permitted. Public availability is not the same as a commercial-use grant; mirror listings identify xBD as CC BY-NC-SA 4.0, so do not use it for commercial testing or redistribute samples unless the rights are confirmed.
- Build a small, balanced image-pair set for no visible damage, minor, major, destroyed, low-resolution, obstructed, and mismatched-site cases.
- Preserve original labels and source filenames in a private test manifest; publish only where the dataset license permits redistribution.
- Confirm each image pair fits the contract input cap after browser-side resizing without removing damage cues.

### 2. Contract gate

- Deploy the vision contract to StudioNet and confirm the validator/model path accepts both images in one transaction.
- Run live positive, no-change, ambiguous, mismatched-pair, low-quality, malformed input, oversize input, and duplicate-ID cases.
- Confirm the leader and validators agree on both image hashes, visible change, and evidence quality. Damage severity, confidence, cue codes, rationale, and routing are supporting lead-model details; any changed pair is stored as `human_review`.
- Inspect finalized reads from the contract. A transaction badge alone is not a successful assessment.

### 3. Product gate

- The local app includes operator setup, wallet/chain checks, public-image disclosure, finality waiting, and public assessment pages; verify each against a StudioNet deployment before calling the flow complete.
- Test reconnect and refresh against a real submitted assessment and confirm the public record is read back from contract state.
- Keep the interface read-only when a deployment is absent or the wallet is on the wrong chain.
- Do not seed example decisions that appear to be live contract results.

### 4. Field validation gate

- Ask at least one disaster-response practitioner to review the damage categories, priority labels, and example results.
- Compare live consensus results with the dataset labels and record disagreements by image quality and damage class.
- Treat disagreements and unclear cases as human review, not model failure hidden from the operator.
- Do not use the system to direct evacuations, certify safety, approve payments, or deny assistance.

### 5. Public launch gate

- Complete mobile and desktop visual QA, accessibility checks, build verification, and live flow walkthrough.
- Publish source, deployment manifest, methodology, limitations, dataset attributions, and reproducible live transaction evidence.
- Publish only after the product has at least one validated end-to-end StudioNet assessment and the field-review limitation is stated accurately.

## Privacy boundary

The first release accepts public, licensed imagery only. Image bytes appear in public transaction input and must be treated as public. Private insurance evidence and identifiable personal images are out of scope until there is a technically verified privacy-preserving validator workflow.
