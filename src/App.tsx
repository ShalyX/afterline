import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import {
  ArrowDownUp, ArrowLeft, ArrowRight, ArrowUpRight, Check, ChevronRight, CircleAlert,
  CloudSun, ExternalLink, FileImage, Focus, LoaderCircle, MapPin, Menu, ScanEye,
  Settings2, ShieldAlert, ShieldCheck, Upload, Wallet, X,
} from "lucide-react";
import {
  CHAIN_ID, AssessmentRecord, connectWallet, getConnectedWallet, getContractAddress,
  getWalletChainId, readAssessment, readAssessmentIds, saveContractAddress,
  switchToStudioNet, validContractAddress, writeAssessment,
} from "./lib/afterline";

type Route = { kind: "overview" } | { kind: "new" } | { kind: "setup" } | { kind: "detail"; id: string };
type ImageDraft = { file: File; preview: string; bytes: Uint8Array; width: number; height: number } | null;
type Notice = { kind: "error" | "info" | "success"; message: string } | null;

const routeFromPath = (): Route => {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  if (path === "/assessments/new") return { kind: "new" };
  if (path === "/operator") return { kind: "setup" };
  if (path.startsWith("/assessments/")) return { kind: "detail", id: decodeURIComponent(path.slice("/assessments/".length)) };
  return { kind: "overview" };
};

function short(value: string | null | undefined): string {
  return value ? `${value.slice(0, 6)}…${value.slice(-4)}` : "Connect wallet";
}

function formatDate(value: bigint | number): string {
  const timestamp = Number(value) * 1000;
  return Number.isFinite(timestamp) && timestamp > 0 ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(timestamp) : "Time unavailable";
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function compressImage(file: File): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  if (!file.type.startsWith("image/")) throw new Error("Choose a JPG, PNG, or WebP image.");
  if (file.size > 12 * 1024 * 1024) throw new Error("Choose an image smaller than 12 MB.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser could not prepare the image.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  let quality = 0.88;
  let blob: Blob | null = null;
  while (quality >= 0.45) {
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= 450_000) break;
    quality -= 0.1;
  }
  if (!blob || blob.size > 450_000) throw new Error("This image is too detailed to fit the 450 KB on-chain limit. Try a smaller crop.");
  return { bytes: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height };
}

function ImagePicker({ label, image, onChange, onClear }: { label: string; image: ImageDraft; onChange: (event: ChangeEvent<HTMLInputElement>) => void; onClear: () => void }) {
  return <div className={`image-picker ${image ? "has-image" : ""}`}>
    {image ? <>
      <img src={image.preview} alt={`${label} evidence preview`} className="image-preview" />
      <div className="image-caption">
        <div><strong>{label}</strong><span>{image.width} × {image.height} · {(image.bytes.byteLength / 1024).toFixed(0)} KB submitted</span></div>
        <button className="icon-button" type="button" onClick={onClear} aria-label={`Remove ${label} image`}><X size={16} /></button>
      </div>
    </> : <label className="picker-empty">
      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onChange} />
      <span className="upload-mark"><Upload size={17} /></span>
      <strong>Add {label.toLowerCase()} image</strong>
      <span>JPG, PNG or WebP · up to 12 MB</span>
    </label>}
  </div>;
}

function PriorityPill({ value }: { value: string }) {
  const tone = value === "urgent_review" ? "urgent" : value === "routine_review" ? "routine" : "review";
  return <span className={`priority-pill ${tone}`}>{value.replaceAll("_", " ")}</span>;
}

function App() {
  const [route, setRoute] = useState<Route>(routeFromPath);
  const [account, setAccount] = useState<string | null>(null);
  const [walletChain, setWalletChain] = useState<string | null>(null);
  const [address, setAddress] = useState(getContractAddress());
  const [addressDraft, setAddressDraft] = useState(getContractAddress());
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [record, setRecord] = useState<AssessmentRecord | null>(null);
  const [recordLoading, setRecordLoading] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [submittedHash, setSubmittedHash] = useState("");
  const [incident, setIncident] = useState("");
  const [location, setLocation] = useState("");
  const [focusArea, setFocusArea] = useState("");
  const [citation, setCitation] = useState("");
  const [beforeImage, setBeforeImage] = useState<ImageDraft>(null);
  const [afterImage, setAfterImage] = useState<ImageDraft>(null);
  const [publicAcknowledged, setPublicAcknowledged] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);

  const configured = validContractAddress(address);
  const onStudioNet = walletChain === CHAIN_ID;
  const canWrite = Boolean(account && onStudioNet && configured && !busy);
  const path = route.kind === "new" ? "/assessments/new" : route.kind === "setup" ? "/operator" : route.kind === "detail" ? `/assessments/${encodeURIComponent(route.id)}` : "/";

  const navigate = (next: Route) => {
    const nextPath = next.kind === "new" ? "/assessments/new" : next.kind === "setup" ? "/operator" : next.kind === "detail" ? `/assessments/${encodeURIComponent(next.id)}` : "/";
    window.history.pushState({}, "", nextPath);
    setRoute(next);
    setNotice(null);
    setMobileNav(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    const onPop = () => setRoute(routeFromPath());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    void getConnectedWallet().then(setAccount);
    void getWalletChainId().then(setWalletChain);
    const injected = window.ethereum;
    if (!injected?.on) return;
    const accountsChanged = (...args: unknown[]) => setAccount(Array.isArray(args[0]) && typeof args[0][0] === "string" ? args[0][0] : null);
    const chainChanged = (...args: unknown[]) => {
      try { setWalletChain(args[0] ? BigInt(String(args[0])).toString(10) : null); } catch { setWalletChain(null); }
    };
    injected.on("accountsChanged", accountsChanged);
    injected.on("chainChanged", chainChanged);
    return () => { injected.removeListener?.("accountsChanged", accountsChanged); injected.removeListener?.("chainChanged", chainChanged); };
  }, []);

  useEffect(() => {
    if (!configured || route.kind !== "overview") return;
    let active = true;
    setRecordsLoading(true);
    void (async () => {
      try {
        const ids = await readAssessmentIds();
        const recent = await Promise.all(ids.slice(0, 8).map((id) => readAssessment(id).catch(() => null)));
        if (active) setAssessments(recent.filter((item): item is AssessmentRecord => item !== null));
      } catch (error) {
        if (active) setNotice({ kind: "error", message: `Could not load public assessments: ${error instanceof Error ? error.message : "GenLayer read failed."}` });
      } finally { if (active) setRecordsLoading(false); }
    })();
    return () => { active = false; };
  }, [configured, route.kind, address]);

  useEffect(() => {
    if (!configured || route.kind !== "detail") return;
    let active = true;
    setRecord(null);
    setRecordLoading(true);
    void readAssessment(route.id).then((value) => { if (active) setRecord(value); })
      .catch((error) => { if (active) setNotice({ kind: "error", message: error instanceof Error ? error.message : "Could not read this assessment." }); })
      .finally(() => { if (active) setRecordLoading(false); });
    return () => { active = false; };
  }, [configured, route, address]);

  const onImage = (slot: "before" | "after") => async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setNotice(null);
    try {
      const compressed = await compressImage(file);
      const preview = URL.createObjectURL(new Blob([compressed.bytes], { type: "image/jpeg" }));
      const next = { file, preview, ...compressed };
      if (slot === "before") { if (beforeImage) URL.revokeObjectURL(beforeImage.preview); setBeforeImage(next); }
      else { if (afterImage) URL.revokeObjectURL(afterImage.preview); setAfterImage(next); }
    } catch (error) { setNotice({ kind: "error", message: error instanceof Error ? error.message : "Image could not be prepared." }); }
  };

  const clearImage = (slot: "before" | "after") => {
    const image = slot === "before" ? beforeImage : afterImage;
    if (image) URL.revokeObjectURL(image.preview);
    if (slot === "before") setBeforeImage(null); else setAfterImage(null);
  };

  const connect = async () => {
    try {
      const wallet = await connectWallet();
      setAccount(wallet);
      setWalletChain(await getWalletChainId());
      setNotice({ kind: "success", message: "Wallet connected. Confirm StudioNet before submitting." });
    } catch (error) { setNotice({ kind: "error", message: error instanceof Error ? error.message : "Wallet connection failed." }); }
  };

  const setNetwork = async () => {
    try { await switchToStudioNet(); setWalletChain(await getWalletChainId()); setNotice({ kind: "success", message: "Wallet is now on GenLayer StudioNet." }); }
    catch (error) { setNotice({ kind: "error", message: error instanceof Error ? error.message : "Could not switch network." }); }
  };

  const submitAssessment = async (event: FormEvent) => {
    event.preventDefault();
    if (!canWrite || !beforeImage || !afterImage || !publicAcknowledged) return;
    setBusy(true);
    setSubmittedHash("");
    setNotice({ kind: "info", message: "Review the wallet request carefully. The submitted images will be public transaction data." });
    const id = `af-${crypto.randomUUID()}`;
    let currentTransactionHash = "";
    try {
      const { hash } = await writeAssessment(account!, {
        assessmentId: id,
        incidentName: incident.trim(),
        locationLabel: location.trim(),
        focusArea: focusArea.trim(),
        sourceCitation: citation.trim(),
        beforeImage: beforeImage.bytes,
        afterImage: afterImage.bytes,
      }, (submitted) => {
        currentTransactionHash = submitted;
        setSubmittedHash(submitted);
      });
      setSubmittedHash(hash);
      currentTransactionHash = hash;
      navigate({ kind: "detail", id });
      setNotice({ kind: "success", message: "Assessment finalized. Reading the committed result from StudioNet." });
    } catch (error) {
      const tx = (error as Error & { transactionHash?: string }).transactionHash;
      setNotice({ kind: "error", message: `${error instanceof Error ? error.message : "Assessment did not complete."}${tx ? ` Transaction: ${tx}` : currentTransactionHash ? ` Transaction: ${currentTransactionHash}` : ""}` });
    } finally { setBusy(false); }
  };

  const saveAddress = (event: FormEvent) => {
    event.preventDefault();
    if (!validContractAddress(addressDraft)) { setNotice({ kind: "error", message: "Enter a valid 20-byte contract address." }); return; }
    saveContractAddress(addressDraft);
    setAddress(addressDraft.trim());
    setNotice({ kind: "success", message: "Contract address saved in this browser. Reads are public; signing still requires a wallet." });
  };

  const navLink = (label: string, to: Route, icon: ReactNode, active: boolean) => <button key={label} className={`rail-link ${active ? "active" : ""}`} onClick={() => navigate(to)}>{icon}<span>{label}</span>{active && <span className="rail-active-mark" />}</button>;

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
      <button className="brand" onClick={() => navigate({ kind: "overview" })} aria-label="Afterline home">
        <span className="brand-mark"><i /><i /><i /></span><span>afterline<span className="brand-period">.</span><small>IMAGE TRIAGE DESK</small></span>
      </button>
      <div className="rail-section-label">WORKSPACE</div>
      <nav className="rail-nav" aria-label="Main navigation">
        {navLink("Overview", { kind: "overview" }, <Focus size={16} />, route.kind === "overview")}
        {navLink("New assessment", { kind: "new" }, <ScanEye size={16} />, route.kind === "new")}
      </nav>
      <div className="rail-section-label rail-section-spaced">SYSTEM</div>
      <nav className="rail-nav" aria-label="System navigation">
        {navLink("Operator setup", { kind: "setup" }, <Settings2 size={16} />, route.kind === "setup")}
      </nav>
      <div className="rail-bottom">
        <div className="rail-dataset"><span className="dataset-dot" /><div><strong>PUBLIC IMAGERY ONLY</strong><span>StudioNet · chain 61999</span></div></div>
        <a href="https://www.sei.cmu.edu/projects/xview-2-challenge/" target="_blank" rel="noreferrer" className="rail-source">xBD dataset source <ExternalLink size={12} /></a>
      </div>
    </aside>

    <main className="main-shell">
      <header className="topbar">
        <button className="mobile-menu" onClick={() => setMobileNav((current) => !current)} aria-label="Toggle navigation">{mobileNav ? <X size={18} /> : <Menu size={18} />}</button>
        <div className="top-context"><span>DISASTER RESPONSE</span><ChevronRight size={13} /><strong>{route.kind === "setup" ? "Operator setup" : route.kind === "new" ? "New assessment" : route.kind === "detail" ? "Assessment record" : "Evidence desk"}</strong></div>
        <div className="top-actions">
          <span className={`network-status ${configured ? "configured" : "unconfigured"}`}><i />{configured ? "StudioNet configured" : "Contract not configured"}</span>
          <button className="wallet-button" onClick={connect}><Wallet size={14} />{short(account)}</button>
        </div>
      </header>

      {notice && <div className={`notice ${notice.kind}`} role="status"><CircleAlert size={16} /><span>{notice.message}</span><button onClick={() => setNotice(null)} aria-label="Dismiss message"><X size={14} /></button></div>}

      <div className="content">
        {route.kind === "overview" && <>
          <section className="overview-head">
            <div>
              <p className="kicker"><span /> FIELD OPERATIONS / 01</p>
              <h1>Read the change.<br /><em>Move with evidence.</em></h1>
              <p className="overview-copy">Compare public satellite imagery across an incident. GenLayer validators review the same before-and-after pair, then commit a visible-change finding and evidence-quality result for human review.</p>
              <button className="button primary" onClick={() => navigate({ kind: "new" })}>Start an image review <ArrowRight size={15} /></button>
            </div>
            <div className="compare-art" aria-label="Illustration showing an earlier and later satellite image separated by a comparison line">
              <div className="compare-grid before-grid"><span /><span /><span /><span /><span /><span /><span /><span /><span /></div>
              <div className="compare-grid after-grid"><span /><span /><span /><span /><span /><span /><span /><span /><span /></div>
              <div className="compare-divider"><span>BEFORE</span><i><ArrowDownUp size={14} /></i><span>AFTER</span></div>
              <div className="art-caption"><span>PAIRED IMAGE REVIEW</span><span>01 / 02</span></div>
            </div>
          </section>

          {!configured && <section className="setup-inline"><div className="setup-inline-icon"><Settings2 size={18} /></div><div><strong>Connect this desk to its deployed contract</strong><p>Set the Afterline StudioNet address in Operator setup to enable public reads and wallet-backed assessments.</p></div><button className="button secondary" onClick={() => navigate({ kind: "setup" })}>Open setup <ArrowRight size={14} /></button></section>}

          <section className="rule-strip" aria-label="Assessment safeguards">
            <div><span>01</span><strong>Two images</strong><small>Same site, earlier and later</small></div>
            <div><span>02</span><strong>Vision consensus</strong><small>Hashes, change &amp; evidence quality</small></div>
            <div><span>03</span><strong>Human review</strong><small>No automatic safety decisions</small></div>
            <div><span>04</span><strong>Public record</strong><small>Hashes and result on StudioNet</small></div>
          </section>

          <section className="records-section">
            <div className="section-heading"><div><p className="kicker">CHAIN RECORDS</p><h2>Recent assessments</h2></div><button className="text-button" onClick={() => configured && window.location.reload()} disabled={!configured || recordsLoading}>Refresh <ArrowRight size={13} /></button></div>
            {!configured ? <div className="empty-records"><div className="empty-mark"><FileImage size={20} /></div><div><strong>Assessment history appears here</strong><p>Configure the contract to read public records from StudioNet.</p></div></div> : recordsLoading ? <div className="empty-records"><LoaderCircle className="spin" size={18} /><div><strong>Reading StudioNet</strong><p>Loading the latest committed assessments.</p></div></div> : assessments.length === 0 ? <div className="empty-records"><div className="empty-mark"><CloudSun size={20} /></div><div><strong>No assessments yet</strong><p>Start with a licensed before-and-after image pair from a documented disaster source.</p></div><a href="https://www.sei.cmu.edu/projects/xview-2-challenge/" target="_blank" rel="noreferrer" className="text-button">Explore xBD <ExternalLink size={12} /></a></div> : <div className="record-list">{assessments.map((item) => <button className="record-row" key={item.assessment_id} onClick={() => navigate({ kind: "detail", id: item.assessment_id })}>
              <span className="record-thumb"><ArrowDownUp size={15} /></span><span className="record-main"><strong>{item.incident_name}</strong><small><MapPin size={11} />{item.location_label} · {item.assessment_id}</small></span><span className={`damage-label damage-${item.damage_level}`}>{item.damage_level.replaceAll("_", " ")}</span><PriorityPill value={item.priority} /><span className="record-date">{formatDate(item.created_at)}</span><ChevronRight size={15} className="row-chevron" />
            </button>)}</div>}
          </section>

          <section className="method-note"><ShieldCheck size={17} /><p><strong>Designed for triage, not a final verdict.</strong> Every output is a cue for a qualified responder to inspect. Image pairs, source citations, and consensus results are public on-chain data.</p><button className="text-button" onClick={() => navigate({ kind: "setup" })}>Read the operating boundary <ArrowRight size={13} /></button></section>
        </>}

        {route.kind === "new" && <>
          <section className="page-intro">
            <button className="back-link" onClick={() => navigate({ kind: "overview" })}><ArrowLeft size={13} /> BACK TO DESK</button>
            <p className="kicker"><span /> IMAGE REVIEW / 02</p><h1>Compare a site.</h1>
            <p>Use a public, licensed image pair for one target area. Validators will classify only what the images show.</p>
          </section>
          <form className="assessment-form" onSubmit={submitAssessment}>
            <div className="form-main">
              <section className="form-section">
                <div className="form-section-title"><span>01</span><div><h2>Incident details</h2><p>Identify the event and the area a responder should inspect.</p></div></div>
                <div className="input-grid">
                  <label className="field"><span>Incident name</span><input required maxLength={140} value={incident} onChange={(event) => setIncident(event.target.value)} placeholder="e.g. Coastal flood response · 2026" /></label>
                  <label className="field"><span>Location label</span><input required maxLength={180} value={location} onChange={(event) => setLocation(event.target.value)} placeholder="District, grid reference, or site ID" /></label>
                  <label className="field wide"><span>Focus area</span><textarea required maxLength={600} value={focusArea} onChange={(event) => setFocusArea(event.target.value)} placeholder="Describe the single building or area to compare. Avoid conclusions such as ‘unsafe’ or ‘uninhabitable’." /></label>
                  <label className="field wide"><span>Image source and license citation</span><input required maxLength={500} value={citation} onChange={(event) => setCitation(event.target.value)} placeholder="Dataset, event, file IDs, and license / attribution" /><small>For xBD, include the event name and original image filenames.</small></label>
                </div>
              </section>

              <section className="form-section image-section">
                <div className="form-section-title"><span>02</span><div><h2>Image pair</h2><p>One location, two moments. We prepare both images in your browser.</p></div></div>
                <div className="image-pair">
                  <ImagePicker label="Earlier image" image={beforeImage} onChange={onImage("before")} onClear={() => clearImage("before")} />
                  <div className="pair-connector"><ArrowDownUp size={15} /></div>
                  <ImagePicker label="Later image" image={afterImage} onChange={onImage("after")} onClear={() => clearImage("after")} />
                </div>
                <div className="image-footnote"><FileImage size={14} /><span>Images are resized to 1,024 px and JPEG-compressed to fit 450 KB each. Browser conversion strips EXIF metadata. The exact submitted bytes are hashed by the contract.</span></div>
              </section>
            </div>

            <aside className="submit-panel">
              <p className="kicker">BEFORE YOU SUBMIT</p>
              <h2>Public evidence.</h2>
              <p className="submit-copy">Image bytes are part of a public StudioNet transaction and may be visible to validators and chain observers. Use only public, licensed, non-sensitive imagery.</p>
              <label className="acknowledge"><input type="checkbox" checked={publicAcknowledged} onChange={(event) => setPublicAcknowledged(event.target.checked)} /><span>I have the right to submit these images, and they contain no private claimant or personal data.</span></label>
              {!configured && <div className="submit-state"><CircleAlert size={15} /><span>Contract address required. Add it in Operator setup.</span></div>}
              {configured && !account && <div className="submit-state"><Wallet size={15} /><span>Connect a wallet to sign the assessment.</span></div>}
              {account && !onStudioNet && <div className="submit-state warning"><CircleAlert size={15} /><span>Switch the wallet to GenLayer StudioNet before writing.</span><button type="button" onClick={setNetwork}>Switch</button></div>}
              {busy && <div className="submit-state pending"><LoaderCircle className="spin" size={15} /><span>{submittedHash ? `Waiting for finality · ${short(submittedHash)}` : "Confirm the wallet transaction…"}</span></div>}
              <button className="button submit-button" type="submit" disabled={!canWrite || !incident.trim() || !location.trim() || !focusArea.trim() || !citation.trim() || !beforeImage || !afterImage || !publicAcknowledged}>
                {busy ? <><LoaderCircle className="spin" size={15} /> Finalizing assessment</> : <>Submit image pair <ArrowRight size={15} /></>}
              </button>
              <small className="submit-foot">Decision priorities route human review only. No funds move and no emergency action is triggered.</small>
            </aside>
          </form>
        </>}

        {route.kind === "detail" && <>
          <section className="page-intro detail-intro">
            <button className="back-link" onClick={() => navigate({ kind: "overview" })}><ArrowLeft size={13} /> ALL ASSESSMENTS</button>
            <p className="kicker"><span /> PUBLIC ASSESSMENT</p><h1>{record?.incident_name || route.id}</h1>
            <p>Every value below is read from the deployed contract. A transaction hash by itself is not treated as a successful result.</p>
          </section>
          {recordLoading ? <div className="detail-empty"><LoaderCircle className="spin" size={20} /><strong>Reading the finalized record</strong><span>Fetching assessment state from StudioNet.</span></div> : record ? <section className="detail-layout">
            <div className="detail-primary">
              <div className="result-banner"><div><span>LEAD CLASSIFICATION</span><h2>{record.damage_level.replaceAll("_", " ")}</h2><p>{record.observed_change === "yes" ? "Visible change reported between the image pair." : record.observed_change === "no" ? "No clear change reported between the image pair." : "The pair does not support a clear comparison."}</p></div><PriorityPill value={record.priority} /></div>
              <div className="result-grid">
                <div><span>Evidence quality</span><strong>{record.evidence_quality}</strong></div><div><span>Confidence</span><strong>{record.confidence_band}</strong></div><div><span>Site</span><strong>{record.location_label}</strong></div><div><span>Recorded</span><strong>{formatDate(record.created_at)}</strong></div>
              </div>
              <section className="rationale-panel"><p className="kicker">LEAD MODEL RATIONALE</p><p>{record.rationale}</p><div className="cue-list">{JSON.parse(record.cue_codes_json || "[]").map((code: string) => <span key={code}>{code.replaceAll("_", " ")}</span>)}</div><p className="consensus-scope">The corrected contract requires agreement on image hashes, visible change, evidence quality, and confidence. Routine review requires clear evidence, no visible change, and agreed high confidence. Damage labels, cue codes, and rationale remain supporting model descriptions. Older deployments may use different consensus rules; check the contract address.</p></section>
              <div className="boundary-inline"><ShieldAlert size={16} /><span>Human review required. This record is not a structural-safety assessment and should not be used to make evacuation or aid eligibility decisions by itself.</span></div>
            </div>
            <aside className="detail-side">
              <p className="kicker">EVIDENCE COMMITMENT</p><h2>Image fingerprints</h2>
              <div className="hash-row"><span>EARLIER IMAGE</span><code>{record.before_image_sha256}</code></div><div className="hash-row"><span>LATER IMAGE</span><code>{record.after_image_sha256}</code></div>
              <div className="detail-meta"><span>Assessment ID</span><strong>{record.assessment_id}</strong></div><div className="detail-meta"><span>Submitted by</span><strong>{record.submitter}</strong></div><div className="detail-meta"><span>Source citation</span><strong>{record.source_citation}</strong></div><div className="detail-meta"><span>Focus area</span><strong>{record.focus_area}</strong></div>
              <p className="public-note">The image files themselves are not repeated in contract storage. Their original bytes remain in the public transaction input; hashes bind this result to that submitted pair.</p>
            </aside>
          </section> : !notice && <div className="detail-empty"><CircleAlert size={20} /><strong>Assessment not found</strong><span>Check the ID or configure the correct contract address.</span></div>}
        </>}

        {route.kind === "setup" && <>
          <section className="page-intro"><button className="back-link" onClick={() => navigate({ kind: "overview" })}><ArrowLeft size={13} /> BACK TO DESK</button><p className="kicker"><span /> OPERATOR SETUP / 03</p><h1>Bring the desk online.</h1><p>Connect the app to an Afterline contract deployed on StudioNet. Public reads work without a wallet; assessment writes require a connected wallet on chain 61999.</p></section>
          <section className="setup-layout">
            <div className="setup-card"><div className="setup-card-head"><div><p className="kicker">CONTRACT CONNECTION</p><h2>Deployment address</h2></div><span className={`setup-status ${configured ? "ready" : "missing"}`}><i />{configured ? "CONNECTED" : "NOT SET"}</span></div>
              <form onSubmit={saveAddress} className="address-form"><label className="field"><span>Afterline contract on StudioNet</span><input value={addressDraft} onChange={(event) => setAddressDraft(event.target.value)} placeholder="0x…" spellCheck={false} autoComplete="off" /><small>Saved in this browser. It is public configuration, not a secret.</small></label><button className="button primary" type="submit">Save address <Check size={14} /></button></form>
              {configured && <a className="text-button explorer-link" href={`https://explorer-studio.genlayer.com/address/${address}`} target="_blank" rel="noreferrer">View contract in Explorer <ArrowUpRight size={14} /></a>}
            </div>
            <div className="setup-card setup-steps"><p className="kicker">DEPLOYMENT PATH</p><h2>Three checks before the first review.</h2><ol><li><span>01</span><div><strong>Deploy the contract</strong><p>Use the checked-in source in GenLayer Studio and select StudioNet.</p></div></li><li><span>02</span><div><strong>Confirm vision support</strong><p>Run the image-pair smoke test and inspect finalized contract state.</p></div></li><li><span>03</span><div><strong>Set the address here</strong><p>Then connect Rabby or another wallet and confirm chain 61999.</p></div></li></ol></div>
          </section>
          <section className="setup-warning"><ShieldAlert size={17} /><div><strong>Public evidence boundary</strong><p>Images go into public transaction calldata. The app strips EXIF metadata and enforces an image limit, but it cannot make a public transaction private. Use licensed public imagery only.</p></div></section>
        </>}
      </div>

      <footer className="footer"><span>AFTERLINE / FIELD EVIDENCE DESK</span><span>PUBLIC DATA · HUMAN REVIEW · GENLAYER STUDIONET</span><button onClick={() => navigate({ kind: "setup" })}>Operator notes <ArrowRight size={12} /></button></footer>
    </main>
  </div>;
}

export default App;
