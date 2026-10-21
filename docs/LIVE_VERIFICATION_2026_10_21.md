# Corrected StudioNet visual-consensus verification

## Source and deployment

- Contract source: [`contracts/afterline.py`](../contracts/afterline.py).
- `gen_getContractCode` returned source byte-for-byte equal to that file; SHA-256 `2be031ca4f417566979c551474e6c44aa5defa86defca06355fcbe09b816833e`.
- Contract: `0xC0262244F0a1bEE29940012CcB4f4e2260865fB8`.
- Deployment transaction: `0xf264571764cbf234fd3d5d7b6f070a6f3ec00be2cd3b58c3a51a191848735568`.
- Assessment transaction: [`0xadd15b9dcf62dabf982fd50b0affc4fc47381550b8c622c26e9d0dbd9b6727f8`](https://explorer-studio.genlayer.com/tx/0xadd15b9dcf62dabf982fd50b0affc4fc47381550b8c622c26e9d0dbd9b6727f8).
- Assessment transaction status: `FINALIZED`, consensus result `MAJORITY_AGREE`.
- Votes: three agree, two idle. This is majority agreement, not unanimity.
- The persisted assessment was independently retrieved with `get_assessment`.
- [Public assessment](https://afterline-ten.vercel.app/assessments/af-katrina-20261021-consensus).
- A fresh HTTP request without cookies returned 200 and no authentication redirect for that URL. The production app loaded and retrieved the assessment through its normal read path.
- [Studio import](https://studio.genlayer.com/contracts?import-contract=0xC0262244F0a1bEE29940012CcB4f4e2260865fB8).

## Image provenance and commitments

The two images are separate crops of the [USGS Katrina before-and-after composite](https://www.usgs.gov/media/images/hurricane-katrina-and-after-new-orleans). USGS explicitly marks this source Public Domain. The earlier Landsat 7 observation is April 24, 2005; the later is August 30, 2005. The source and derived crops are checked into `tests/fixtures/sources/`; preparation is documented in the fixture README.

| Input | SHA-256 of exact submitted bytes |
| --- | --- |
| Earlier | `0100f37887e4ae3c928e47d4ddde9a5eca2fcc065455d355efe2dcb815617472` |
| Later | `52f7aae76d8c1e0905f5dc6935d4be2264ebc1edffa05677784f1feecf18731b` |

These hashes differ. The corrected contract has no identical-image success path: identical inputs reject without storing an assessment. This transaction therefore exercised nondeterministic image comparison.

## Persisted assessment

```json
{
  "assessment_id": "af-katrina-20261021-consensus",
  "damage_level": "unclear",
  "observed_change": "unclear",
  "evidence_quality": "limited",
  "confidence_band": "low",
  "priority": "human_review",
  "cue_codes_json": "[\"low_resolution\",\"standing_water\"]",
  "rationale": "Later image shows significant cloud cover over water body preventing reliable extent comparison; visible standing water in both but change unclear."
}
```

The focus was regional visible surface-water extent, with an explicit instruction not to classify individual buildings. Cloud cover and regional resolution produced a conservative human-review outcome. This is one real-image consensus smoke test, not evidence of building-level accuracy or a field-validated benchmark.

## Corrections and regression coverage

- Confidence is part of validator equivalence. A high-confidence leader versus a medium- or low-confidence validator cannot pass, including no-change cases that would otherwise receive routine review.
- Medium- and low-confidence no-change results route to human review; high confidence alone is insufficient without clear evidence and no visible change.
- Identical bytes reject and leave no assessment. Byte identity is never presented as absence of damage.
- The frontend decodes uploaded images and emits JPEG. Direct callers must submit JPEG, which is checked for bounded dimensions, frame/scan structure, marker lengths, quantization presence and a final end marker. This is container validation, not a complete entropy decoder. Visual analysis still runs through the image service.
- Forged JPEG signatures, truncated payloads and invalid segment lengths reject before assessment storage.
- `python -m pytest -p no:cacheprovider tests/direct -q --tb=short`: 27 passed.
- GenVM lint and SDK schema validation passed.

## Reproduce

Install the GenLayer CLI and select a StudioNet test account. From this repository:

```powershell
node scripts/live-pair.mjs 0xC0262244F0a1bEE29940012CcB4f4e2260865fB8 YOUR_UNIQUE_ID tests/fixtures/sources/Hurricane_Katrina_before.jpg tests/fixtures/sources/Hurricane_Katrina_after.jpg
genlayer call 0xC0262244F0a1bEE29940012CcB4f4e2260865fB8 get_assessment --args YOUR_UNIQUE_ID --rpc https://studio.genlayer.com/api
```

For the user flow, open the public app, choose New assessment, upload those two crops, enter the citation and a narrow regional-water question, connect a StudioNet wallet, acknowledge public-image rights, and submit. Wait for finalized execution and contract readback. Visual outcomes may vary; disagreement or image-service failure must not be reported as a successful assessment.
