export type ExecutionReceipt = { execution_result?: string; executionResult?: string; result?: { status?: string; payload?: unknown } };
export type Receipt = {
  resultName?: string; result_name?: string; txExecutionResultName?: string; tx_execution_result_name?: string;
  status?: string | number; statusName?: string; status_name?: string;
  consensus_data?: { leader_receipt?: ExecutionReceipt[]; validators?: ExecutionReceipt[] };
  consensusData?: { leaderReceipt?: ExecutionReceipt[]; validators?: ExecutionReceipt[] };
};

const FAILED_NAMES = new Set(["DISAGREE", "TIMEOUT", "DETERMINISTIC_VIOLATION", "NO_MAJORITY", "MAJORITY_DISAGREE"]);
const FAILED_EXECUTION = new Set(["ERROR", "FINISHED_WITH_ERROR", "ROLLBACK"]);
const SUCCESS_EXECUTION = new Set(["SUCCESS", "FINISHED_WITH_RETURN", "RETURN"]);
const upper = (value: unknown) => typeof value === "string" && value.trim() ? value.trim().toUpperCase() : null;

function executionReceipts(receipt: Receipt): ExecutionReceipt[] {
  return [...(receipt.consensus_data?.leader_receipt ?? []), ...(receipt.consensus_data?.validators ?? []), ...(receipt.consensusData?.leaderReceipt ?? []), ...(receipt.consensusData?.validators ?? [])];
}

export function isFailedReceipt(receipt: Receipt): boolean {
  const name = upper(receipt.resultName ?? receipt.result_name);
  if (name && FAILED_NAMES.has(name)) return true;
  const results = [...[receipt.txExecutionResultName, receipt.tx_execution_result_name], ...executionReceipts(receipt).map((row) => row.execution_result ?? row.executionResult)].map(upper).filter((value): value is string => Boolean(value));
  if (results.some((value) => FAILED_EXECUTION.has(value))) return true;
  if (results.some((value) => SUCCESS_EXECUTION.has(value))) return false;
  return true;
}

export function getReceiptFailureMessage(receipt: Receipt): string | null {
  for (const item of executionReceipts(receipt)) {
    if (upper(item.result?.status) === "ROLLBACK" && typeof item.result?.payload === "string" && item.result.payload.trim()) return item.result.payload.trim();
  }
  return null;
}
