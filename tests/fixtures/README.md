# Real-world image fixtures

## Hurricane Katrina, New Orleans

- Source record: [USGS, Hurricane Katrina — Before and After in New Orleans](https://www.usgs.gov/media/images/hurricane-katrina-and-after-new-orleans)
- Source image: `sources/Hurricane_Katrina_USGS_composite.jpg`
- Pair: `sources/Hurricane_Katrina_before.jpg` and `sources/Hurricane_Katrina_after.jpg`
- Attribution: USGS National Land Imaging Program. The source page marks the image Public Domain.
- Dates: Landsat 7, April 24, 2005 (before) and August 30, 2005 (after).
- Preparation: the original 1,190 × 513 side-by-side image was split at its midpoint into two 595 × 513 JPEG crops. No retouching or image enhancement was applied.
- Scenario: compare visible regional water extent and image quality around New Orleans after Hurricane Katrina. The later image contains substantial cloud cover.
- Interpretation limit: this is a regional Landsat comparison, not a building-level damage label or a substitute for ground truth. The imagery is suitable for checking whether the vision path notices obvious water/scene changes and routes obscured or low-detail evidence to human review. Record the live output without presuming the model's answer.

The source file and derived crops are retained for reproducible local and StudioNet testing. Do not describe this single case as a validated benchmark; it is one real-world smoke-test pair.
