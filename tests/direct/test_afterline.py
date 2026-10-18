import json


CONTRACT = "contracts/afterline.py"
BEFORE = b"\xff\xd8\xff\xe0before-public-sample"
AFTER = b"\xff\xd8\xff\xe0after-public-sample"


def deploy(direct_deploy):
    return direct_deploy(CONTRACT, sdk_version="v0.2.16")


def result(**changes):
    value = {
        "damage_level": "major",
        "observed_change": "yes",
        "evidence_quality": "clear",
        "confidence_band": "high",
        "cue_codes": ["debris", "roof_loss"],
        "rationale": "The later image shows roof loss and debris within the stated focus area.",
    }
    value.update(changes)
    return json.dumps(value)


def submit(contract, direct_vm, direct_alice, assessment_id="flood-test-001"):
    direct_vm.sender = direct_alice
    contract.assess_images(
        assessment_id,
        "Coastal flood exercise",
        "Ward 4, north block",
        "Compare the central building footprint for visible flood or structural damage.",
        "xBD sample pair; public research imagery; source citation recorded by operator",
        BEFORE,
        AFTER,
    )


def consensus_assessment(
    damage_level="major",
    observed_change="yes",
    evidence_quality="clear",
    confidence_band="high",
    cue_codes=None,
    before_hash="a" * 64,
    after_hash="b" * 64,
):
    if evidence_quality != "clear" or confidence_band != "high" or damage_level == "unclear" or observed_change == "unclear":
        priority = "human_review"
    elif damage_level in ("major", "destroyed"):
        priority = "urgent_review"
    else:
        priority = "routine_review"
    return {
        "damage_level": damage_level,
        "observed_change": observed_change,
        "evidence_quality": evidence_quality,
        "confidence_band": confidence_band,
        "priority": priority,
        "cue_codes": cue_codes or [],
        "before_image_sha256": before_hash,
        "after_image_sha256": after_hash,
    }


def test_parser_derives_urgent_triage_from_complete_visual_fields(direct_vm, direct_deploy, direct_alice):
    contract = deploy(direct_deploy)
    parsed = contract._parse_assessment(result())
    assert parsed["damage_level"] == "major"
    assert parsed["priority"] == "urgent_review"
    assert parsed["cue_codes"] == ["debris", "roof_loss"]


def test_unclear_or_limited_evidence_routes_to_human_review(direct_vm, direct_deploy, direct_alice):
    contract = deploy(direct_deploy)
    parsed = contract._parse_assessment(result(
        damage_level="unclear",
        observed_change="unclear",
        evidence_quality="limited",
        confidence_band="low",
        cue_codes=["low_resolution"],
        rationale="The target is too small to classify reliably.",
    ))
    assert parsed["priority"] == "human_review"


def test_parser_normalizes_contradictory_visual_classification_to_human_review(direct_vm, direct_deploy, direct_alice):
    contract = deploy(direct_deploy)
    parsed = contract._parse_assessment(result(damage_level="major", observed_change="no"))
    assert parsed["damage_level"] == "unclear"
    assert parsed["observed_change"] == "unclear"
    assert parsed["priority"] == "human_review"


def test_parser_normalizes_unclear_damage_with_binary_change(direct_vm, direct_deploy, direct_alice):
    contract = deploy(direct_deploy)
    parsed = contract._parse_assessment(result(damage_level="unclear", observed_change="no"))
    assert parsed["damage_level"] == "unclear"
    assert parsed["observed_change"] == "unclear"
    assert parsed["priority"] == "human_review"


def test_parser_normalizes_common_observed_change_synonyms(direct_vm, direct_deploy, direct_alice):
    contract = deploy(direct_deploy)
    parsed = contract._parse_assessment(result(damage_level="no_damage", observed_change="no_change"))
    assert parsed["damage_level"] == "no_damage"
    assert parsed["observed_change"] == "no"
    assert parsed["priority"] == "routine_review"


def test_parser_rejects_missing_or_extra_consequential_fields(direct_vm, direct_deploy, direct_alice):
    contract = deploy(direct_deploy)
    with direct_vm.expect_revert("exactly the required assessment fields"):
        contract._parse_assessment(result(unverified_claim=True))


def test_parser_rejects_unknown_cue_codes(direct_vm, direct_deploy, direct_alice):
    contract = deploy(direct_deploy)
    with direct_vm.expect_revert("unknown or duplicate"):
        contract._parse_assessment(result(cue_codes=["roof_loss", "confidence:100%!"]))


def test_consensus_commits_image_hashes_and_bounded_decision(direct_vm, direct_deploy, direct_alice):
    contract = deploy(direct_deploy)
    direct_vm.mock_llm(r"(?s).*AFTERLINE_VISUAL_REVIEW.*", result())
    submit(contract, direct_vm, direct_alice)
    assessment = contract.get_assessment("flood-test-001")
    assert assessment["damage_level"] == "major"
    assert assessment["priority"] == "urgent_review"
    assert len(assessment["before_image_sha256"]) == 64
    assert len(assessment["after_image_sha256"]) == 64
    assert assessment["before_image_sha256"] != assessment["after_image_sha256"]
    assert json.loads(assessment["cue_codes_json"]) == ["debris", "roof_loss"]


def test_identical_image_bytes_commit_deterministic_no_change(direct_vm, direct_deploy, direct_alice):
    contract = deploy(direct_deploy)
    direct_vm.sender = direct_alice
    contract.assess_images(
        "same-image-control",
        "Katrina control",
        "New Orleans xBD reference site",
        "Visible structural damage, debris, and standing water only",
        "Public xBD research imagery",
        BEFORE,
        BEFORE,
    )
    assessment = contract.get_assessment("same-image-control")
    assert assessment["damage_level"] == "no_damage"
    assert assessment["observed_change"] == "no"
    assert assessment["priority"] == "routine_review"
    assert assessment["before_image_sha256"] == assessment["after_image_sha256"]


def test_duplicate_assessment_id_cannot_overwrite_prior_record(direct_vm, direct_deploy, direct_alice):
    contract = deploy(direct_deploy)
    direct_vm.mock_llm(r"(?s).*AFTERLINE_VISUAL_REVIEW.*", result())
    submit(contract, direct_vm, direct_alice)
    with direct_vm.expect_revert("assessment_id already exists"):
        submit(contract, direct_vm, direct_alice)


def test_non_image_bytes_are_rejected_before_consensus(direct_vm, direct_deploy, direct_alice):
    contract = deploy(direct_deploy)
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("must be JPEG, PNG, or WebP"):
        contract.assess_images(
            "bad-image",
            "Exercise",
            "Ward 4",
            "Check the building.",
            "Public source citation",
            b"not an image",
            AFTER,
        )


def test_consensus_accepts_same_triage_with_non_material_label_variance(direct_vm, direct_deploy, direct_alice):
    contract = deploy(direct_deploy)
    leader = consensus_assessment(cue_codes=["standing_water"])
    validator = consensus_assessment(damage_level="destroyed", cue_codes=["debris"])

    assert contract._consensus_equivalent(leader, validator) is True


def test_consensus_rejects_different_priority_or_observed_change(direct_vm, direct_deploy, direct_alice):
    contract = deploy(direct_deploy)
    leader = consensus_assessment()

    assert contract._consensus_equivalent(leader, consensus_assessment(confidence_band="medium")) is False
    assert contract._consensus_equivalent(
        leader,
        consensus_assessment(observed_change="unclear", confidence_band="medium"),
    ) is False


def test_consensus_rejects_evidence_quality_or_image_hash_mismatch(direct_vm, direct_deploy, direct_alice):
    contract = deploy(direct_deploy)
    leader = consensus_assessment()

    assert contract._consensus_equivalent(leader, consensus_assessment(evidence_quality="limited")) is False
    assert contract._consensus_equivalent(leader, consensus_assessment(after_hash="c" * 64)) is False


def test_consensus_keeps_no_damage_and_minor_separate(direct_vm, direct_deploy, direct_alice):
    contract = deploy(direct_deploy)
    no_damage = consensus_assessment(
        damage_level="no_damage",
        observed_change="no",
        cue_codes=["no_clear_change"],
    )
    minor = consensus_assessment(
        damage_level="minor",
        observed_change="yes",
        cue_codes=["debris"],
    )

    assert no_damage["priority"] == minor["priority"] == "routine_review"
    assert contract._consensus_equivalent(no_damage, minor) is False


def test_consensus_rejects_confidence_threshold_disagreement_even_when_both_need_review(direct_vm, direct_deploy, direct_alice):
    contract = deploy(direct_deploy)
    leader = consensus_assessment(evidence_quality="limited", confidence_band="high")
    validator = consensus_assessment(evidence_quality="limited", confidence_band="medium")

    assert leader["priority"] == validator["priority"] == "human_review"
    assert contract._consensus_equivalent(leader, validator) is False
