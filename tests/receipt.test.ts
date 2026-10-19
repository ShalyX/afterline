import assert from "node:assert/strict";
import test from "node:test";
import { isFailedReceipt } from "../src/lib/receipt.ts";

test("accepts a majority-agree receipt when an idle validator reports an execution error", () => {
  const receipt = {
    result_name: "MAJORITY_AGREE",
    consensus_data: {
      validators: [
        { vote: "agree", execution_result: "SUCCESS" },
        { vote: "agree", execution_result: "SUCCESS" },
        { vote: "idle", execution_result: "ERROR" },
      ],
    },
  };

  assert.equal(isFailedReceipt(receipt), false);
});

test("rejects an explicit majority-disagree receipt", () => {
  assert.equal(isFailedReceipt({ result_name: "MAJORITY_DISAGREE" }), true);
});
