import { getReceiptFailureMessage, isFailedReceipt, type Receipt } from "./receipt";

const FINALITY_INTERVAL_MS = 5_000;
const FINALITY_RETRIES = 60;
const environment = import.meta.env ?? {};
export const endpoint = String(environment.VITE_GENLAYER_ENDPOINT || "https://studio.genlayer.com/api").trim();
export const configuredAddress = String(environment.VITE_AFTERLINE_ADDRESS || "").trim();
export const CHAIN_ID = "61999";
export const CHAIN_ID_HEX = "0xf22f";
const STORAGE_KEY = "afterline.contract-address";

type Provider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
  removeListener?(event: string, handler: (...args: unknown[]) => void): void;
  isRabby?: boolean;
  providers?: Provider[];
};

declare global { interface Window { ethereum?: Provider } }

type GenLayerClient = {
  writeContract(request: Record<string, unknown>): Promise<string>;
  readContract(request: Record<string, unknown>): Promise<unknown>;
  waitForTransactionReceipt(request: Record<string, unknown>): Promise<Receipt>;
};

export type AssessmentRecord = {
  assessment_id: string;
  submitter: string;
  incident_name: string;
  location_label: string;
  focus_area: string;
  source_citation: string;
  before_image_sha256: string;
  after_image_sha256: string;
  damage_level: string;
  observed_change: string;
  evidence_quality: string;
  confidence_band: string;
  priority: string;
  cue_codes_json: string;
  rationale: string;
  created_at: bigint | number;
};

export type AssessmentInput = {
  assessmentId: string;
  incidentName: string;
  locationLabel: string;
  focusArea: string;
  sourceCitation: string;
  beforeImage: Uint8Array;
  afterImage: Uint8Array;
};

export type WriteResult = { hash: string; receipt: Receipt };

function provider(): Provider | null {
  if (typeof window === "undefined" || !window.ethereum) return null;
  const injected = window.ethereum;
  const candidates = injected.providers ?? [];
  return candidates.find((candidate) => candidate.isRabby) ?? (injected.isRabby ? injected : candidates[0] ?? injected);
}
export function hasWallet(): boolean { return Boolean(provider()); }

export function getContractAddress(): string {
  if (typeof window !== "undefined") {
    const saved = window.localStorage.getItem(STORAGE_KEY)?.trim();
    if (saved) return saved;
  }
  return configuredAddress;
}

export function saveContractAddress(value: string): void {
  if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, value.trim());
}

export function validContractAddress(value: string): boolean { return /^0x[0-9a-fA-F]{40}$/.test(value.trim()); }

export async function getConnectedWallet(): Promise<string | null> {
  const injected = provider();
  if (!injected) return null;
  try {
    const accounts = await injected.request({ method: "eth_accounts" });
    return Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : null;
  } catch { return null; }
}

export async function getWalletChainId(): Promise<string | null> {
  const injected = provider();
  if (!injected) return null;
  try {
    const id = await injected.request({ method: "eth_chainId" });
    return typeof id === "string" ? BigInt(id).toString(10) : null;
  } catch { return null; }
}

export async function connectWallet(): Promise<string> {
  const injected = provider();
  if (!injected) throw new Error("Install Rabby or another EVM wallet to sign an assessment.");
  const accounts = await injected.request({ method: "eth_requestAccounts" });
  if (!Array.isArray(accounts) || typeof accounts[0] !== "string") throw new Error("The wallet did not return an account.");
  return accounts[0];
}

export async function switchToStudioNet(): Promise<void> {
  const injected = provider();
  if (!injected) throw new Error("Connect a browser wallet first.");
  await injected.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_ID_HEX }] });
}

async function createClient(account?: string): Promise<GenLayerClient> {
  const [{ createClient: createGenLayerClient }, { studionet }] = await Promise.all([
    import("genlayer-js"), import("genlayer-js/chains"),
  ]);
  return createGenLayerClient({
    chain: studionet,
    ...(account ? { account: account as `0x${string}` } : {}),
    ...(account && provider() ? { provider: provider() as never } : {}),
    endpoint,
  }) as unknown as GenLayerClient;
}

export async function readAssessment(id: string): Promise<AssessmentRecord> {
  const client = await createClient();
  return client.readContract({ address: getContractAddress(), functionName: "get_assessment", args: [id] }) as Promise<AssessmentRecord>;
}

export async function readAssessmentIds(): Promise<string[]> {
  const client = await createClient();
  const ids = await client.readContract({ address: getContractAddress(), functionName: "get_assessment_ids", args: [] }) as Record<string, string>;
  return Object.keys(ids).sort((a, b) => Number(b) - Number(a)).map((key) => ids[key]);
}

export async function writeAssessment(
  account: string,
  input: AssessmentInput,
  onSubmitted?: (hash: string) => void,
): Promise<WriteResult> {
  const client = await createClient(account);
  const hash = await client.writeContract({
    address: getContractAddress(),
    functionName: "assess_images",
    args: [input.assessmentId, input.incidentName, input.locationLabel, input.focusArea, input.sourceCitation, input.beforeImage, input.afterImage],
    value: 0n,
  });
  onSubmitted?.(hash);
  const receipt = await client.waitForTransactionReceipt({ hash, status: "FINALIZED", interval: FINALITY_INTERVAL_MS, retries: FINALITY_RETRIES });
  if (isFailedReceipt(receipt)) {
    const error = new Error(getReceiptFailureMessage(receipt) ?? "The transaction finalized without a successful assessment.") as Error & { transactionHash?: string };
    error.transactionHash = hash;
    throw error;
  }
  return { hash, receipt };
}
