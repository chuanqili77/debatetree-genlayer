import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { STRINGS } from "./i18n.js";

const $ = (id) => document.getElementById(id);
import deployment from "../../evidence/deployment-v2.json";
import demo from "../../evidence/appeals-v2.json";

const legacy = new URLSearchParams(location.search).has("legacy");
const DEPLOYED = legacy ? "0x1cEC1De81f9466C366d3d7782d2eF0c453B43925" : deployment.contractAddress;
const EXPLORER = "https://explorer-studio.genlayer.com/address/";
const REPO = "https://github.com/chuanqili77/debatetree-genlayer";

let lang = "en";
let contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS || DEPLOYED;
let debateId = legacy ? "debate-0" : demo.debateId;
let debate = null;
let args = [];
let counts = null;
let walletAddress = null;
let writeClient = null;
let loadGen = 0;
let selectedId = null;
let sideFilter = "ALL";
let verdictFilter = "ALL";

const readClient = createClient({ chain: studionet });

const t = (key) => STRINGS[lang][key] ?? STRINGS.en[key] ?? key;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const short = (a) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a || "—");
const parse = (s) => {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
};
const isRateLimit = (e) => /-32029|rate limit|too many requests/i.test(String(e?.message || e));

function setStatus(text, err = false) {
  const el = $("statusLine");
  if (!text) { el.hidden = true; return; }
  el.textContent = text;
  el.classList.toggle("err", err);
  el.hidden = false;
}

function applyLang() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    if (el.id === "walletBtn") return;
    el.textContent = t(el.dataset.i18n);
  });
  $("langBtn").textContent = lang === "en" ? "中文" : "English";
  renderStage();
  renderTree();
  renderDetail();
  renderWalletState();
}

function explorerUrl() {
  return EXPLORER + contractAddress;
}

function renderWalletState() {
  const btn = $("walletBtn");
  btn.textContent = walletAddress ? `${short(walletAddress)} · ${t("disconnectWallet")}` : t("connectWallet");
  const note = $("walletNote");
  if (walletAddress) {
    note.textContent = t("walletConnected");
    note.hidden = false;
  } else {
    note.hidden = true;
  }
  renderStage();
  renderDetail();
}

async function readRetry(fn, argsList, attempts = 5, address = contractAddress) {
  let lastErr = null;
  for (let a = 0; a < attempts; a++) {
    try {
      return await readClient.readContract({ address, functionName: fn, args: argsList, transactionHashVariant: "latest-final" });
    } catch (e) {
      lastErr = e;
      if (a < attempts - 1) await sleep(isRateLimit(e) ? 8000 * (a + 1) : 1500 * (a + 1));
      else throw e;
    }
  }
  throw lastErr;
}

function renderStage() {
  if (!debate) return;
  $("debateTopic").textContent = debate.topic;
  $("debateDescription").textContent = debate.description;
  $("debateIdLabel").textContent = debate.id;
  $("debateCreator").textContent = debate.creator;
  const statusEl = $("debateStatus");
  statusEl.textContent = debate.status === "CLOSED" ? t("statusClosed") : t("statusOpen");
  const winnerEl = $("debateWinner");
  if (debate.status === "CLOSED") {
    winnerEl.hidden = false;
    winnerEl.textContent = debate.winner === "FOR" ? t("winnerFor") : debate.winner === "AGAINST" ? t("winnerAgainst") : t("winnerTie");
  } else {
    winnerEl.hidden = true;
  }
  $("forTotal").textContent = debate.for_total;
  $("againstTotal").textContent = debate.against_total;
  $("leadingLabel").textContent = debate.for_total > debate.against_total ? t("leadingFor")
    : debate.against_total > debate.for_total ? t("leadingAgainst") : t("leadingTie");
  const closeBtn = $("closeDebateBtn");
  const hint = $("closeHint");
  if (debate.status !== "OPEN") {
    closeBtn.disabled = true;
    hint.textContent = "";
  } else if (!walletAddress || walletAddress.toLowerCase() !== debate.creator.toLowerCase()) {
    closeBtn.disabled = true;
    hint.textContent = t("closeHintCreator");
  } else if (debate.pending_appeals) {
    closeBtn.disabled = true;
    hint.textContent = lang === "zh" ? "有待处理申诉" : "Resolve, withdraw or expire pending appeals first.";
  } else if (debate.assessed_count < 2) {
    closeBtn.disabled = true;
    hint.textContent = `${t("closeHintVotes")} (${debate.assessed_count}/2)`;
  } else {
    closeBtn.disabled = false;
    hint.textContent = t("closeHintReady");
  }
  if (counts) {
    $("countsLabel").textContent = `${counts.debate_count} debates · ${counts.argument_count} arguments · ${counts.assessed_count} assessed · ${counts.closed_count} closed`;
  }
}

function filteredArgs() {
  return args.filter((a) =>
    (sideFilter === "ALL" || a.side === sideFilter) &&
    (verdictFilter === "ALL" || (verdictFilter === "PENDING" ? a.status === "PENDING" : a.verdict === verdictFilter)));
}

function nodeCard(a) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "node" + (selectedId === a.id ? " selected" : "");
  btn.dataset.arg = a.id;
  const verdictPill = a.status === "PENDING"
    ? `<span class="pill pill-pending">${t("pending")}</span>`
    : `<span class="pill ${a.verdict === "SOUND" ? "pill-sound" : a.verdict === "FLAWED" ? "pill-flawed" : "pill-unverified"}">${t(a.verdict.toLowerCase())}</span>`;
  const weightPill = a.status === "PENDING" ? "" :
    `<span class="pill ${a.weight > 0 ? "pill-pos" : a.weight < 0 ? "pill-neg" : "pill-unverified"}">${a.weight > 0 ? "+" + a.weight : a.weight}</span>`;
  btn.innerHTML = `<p class="node-claim">${escapeHtml(a.claim)}</p>
    <span class="node-meta">${verdictPill}${weightPill}<span>${short(a.author)}</span></span>`;
  btn.addEventListener("click", () => {
    selectedId = a.id;
    renderTree();
    renderDetail();
    $("detailPanel").scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
  return btn;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function renderTree() {
  const list = filteredArgs();
  const forList = list.filter((a) => a.side === "FOR");
  const againstList = list.filter((a) => a.side === "AGAINST");
  $("forCount").textContent = args.filter((a) => a.side === "FOR").length;
  $("againstCount").textContent = args.filter((a) => a.side === "AGAINST").length;
  const forEl = $("forNodes");
  const againstEl = $("againstNodes");
  forEl.innerHTML = "";
  againstEl.innerHTML = "";
  if (forList.length === 0) forEl.innerHTML = `<p class="hint">${t("noArguments")}</p>`;
  if (againstList.length === 0) againstEl.innerHTML = `<p class="hint">${t("noArguments")}</p>`;
  forList.forEach((a) => forEl.appendChild(nodeCard(a)));
  againstList.forEach((a) => againstEl.appendChild(nodeCard(a)));
}

function showAppeal(a) {
  const enabled = debate?.protocol === "debatetree-2" && a.status === "ASSESSED";
  $("appealPanel").hidden = !enabled;
  if (!enabled) return;
  const appeal = a.appeal;
  const author = walletAddress?.toLowerCase() === a.author.toLowerCase();
  const open = debate.status === "OPEN";
  const pending = open && appeal?.status === "PENDING";
  const expired = pending && Date.now() >= appeal.expires_at * 1000;
  $("appealStatus").dataset.outcome = appeal?.status ?? "NONE";
  $("appealStatus").textContent = appeal
    ? appeal.status + (appeal.delta == null ? " · expires " + new Date(appeal.expires_at * 1000).toISOString() : " · score delta " + (appeal.delta > 0 ? "+" : "") + appeal.delta)
    : (lang === "zh" ? "暂无申诉" : "No appeal filed");
  $("appealOriginal").textContent = a.original ? "Original verdict · " + a.original.verdict + " (" + a.original.weight + ")" : "";
  $("appealPriorReason").textContent = a.original ? [a.original.reason, a.original.quote].filter(Boolean).join(" · ") : "";
  $("appealGrounds").textContent = appeal?.grounds ?? "";
  $("appealQuote").textContent = appeal?.quote ?? "";
  $("appealReason").textContent = appeal?.reason ?? "";
  const demoIndex = demo.arguments.findIndex(row => row.id === a.id);
  const record = contractAddress.toLowerCase() === deployment.contractAddress.toLowerCase()
    ? demo.transactions[["reversed", "upheld", "withdrawn"][demoIndex]] : null;
  $("appealReceipt").hidden = !record;
  if (record) $("appealReceipt").href = "https://explorer-studio.genlayer.com/tx/" + record.hash;
  $("appealSource").hidden = !appeal;
  if (appeal) $("appealSource").href = appeal.evidence_url;
  $("appealForm").hidden = !open || !author || Boolean(appeal) || a.verdict === "SOUND";
  $("resolveAppealBtn").hidden = !pending || !walletAddress || expired;
  $("endAppealBtn").hidden = !pending || !walletAddress || (!author && !expired);
}

function renderDetail() {
  const panel = $("detailPanel");
  const a = args.find((x) => x.id === selectedId);
  document.querySelectorAll("[data-appeal-demo]").forEach(button => {
    const row = demo.arguments[Number(button.dataset.appealDemo)];
    button.setAttribute("aria-pressed", String(
      contractAddress.toLowerCase() === deployment.contractAddress.toLowerCase() &&
      debate?.id === demo.debateId && Boolean(a) && row?.id === selectedId,
    ));
  });
  if (!a) { panel.hidden = true; return; }
  panel.hidden = false;
  $("detailClaim").textContent = a.claim;
  $("detailSide").textContent = a.side === "FOR" ? t("forSide") : t("againstSide");
  $("detailAuthor").textContent = a.author;
  $("detailStatus").textContent = a.status === "PENDING" ? t("pending") : a.status;
  $("detailVerdict").textContent = a.status === "PENDING" ? "—" : t(a.verdict.toLowerCase());
  $("detailWeight").textContent = a.status === "PENDING" ? "—" : (a.weight > 0 ? "+" + a.weight : String(a.weight));
  const ev = $("detailEvidence");
  ev.textContent = a.evidence_url;
  ev.href = a.evidence_url;
  $("detailNote").textContent = a.note || "—";
  $("detailQuote").textContent = a.quote || "—";
  $("detailReason").textContent = a.reason || "—";
  showAppeal(a);
  const btn = $("assessBtn");
  const hint = $("assessHint");
  if (debate && debate.status !== "OPEN") {
    btn.disabled = true;
    hint.textContent = t("assessHintClosed");
  } else if (a.status !== "PENDING") {
    btn.disabled = true;
    hint.textContent = "";
  } else if (!walletAddress) {
    btn.disabled = true;
    hint.textContent = t("assessHintWallet");
  } else {
    btn.disabled = false;
    hint.textContent = "";
  }
}

async function loadDebate() {
  const gen = ++loadGen;
  const keepId = selectedId;
  const address = contractAddress;
  const id = debateId;
  const tree = document.querySelector(".tree");
  debate = null;
  args = [];
  selectedId = null;
  renderDetail();
  tree.hidden = true;
  $("closeDebateBtn").disabled = true;
  setStatus(t("loadingTree"));
  try {
    const raw = await readRetry("get_debate", [id], 3, address);
    if (gen !== loadGen) return;
    debate = parse(raw);
    $("protocolLabel").textContent = debate?.protocol ?? "—";
    if (!debate) {
      setStatus(t("errDebateNotFound"), true);
      return;
    }
    renderStage();
    const ids = debate.argument_ids || [];
    const countRequest = readRetry("get_counts", [], 2, address).then(raw => {
      if (gen === loadGen) { counts = parse(raw); renderStage(); }
    }).catch(() => {});
    for (let i = 0; i < ids.length; i += 4) {
      if (gen !== loadGen) return;
      const batch = await Promise.allSettled(ids.slice(i, i + 4).map(
        argId => readRetry("get_argument", [argId], 3, address).then(parse),
      ));
      if (gen !== loadGen) return;
      args.push(...batch.flatMap(item => item.status === "fulfilled" && item.value ? [item.value] : []));
      setStatus(t("loadingTree") + " " + args.length + "/" + ids.length);
    }
    tree.hidden = false;
    selectedId = keepId && args.some(a => a.id === keepId) ? keepId : null;
    renderTree();
    renderDetail();
    setStatus(args.length < ids.length ? t("treePartial") : "", args.length < ids.length);
    await countRequest;
  } catch (error) {
    if (gen === loadGen) setStatus(t("errLoad"), true);
  }
}

function statusNameOf(tx) {
  const map = { 0: "UNINITIALIZED", 1: "PENDING", 2: "PROPOSING", 3: "COMMITTING", 4: "REVEALING", 5: "ACCEPTED", 6: "UNDETERMINED", 7: "FINALIZED", 8: "CANCELED" };
  if (typeof tx?.statusName === "string") return tx.statusName;
  if (typeof tx?.status === "string") return tx.status;
  if (typeof tx?.status === "number") return map[tx.status] ?? `STATUS_${tx.status}`;
  return "UNKNOWN";
}

async function waitFinalizedBrowser(hash) {
  const deadline = Date.now() + 600000;
  while (Date.now() < deadline) {
    try {
      const tx = await writeClient.getTransaction({ hash });
      const status = statusNameOf(tx);
      if (status === "FINALIZED" || status === "CANCELED") return tx;
    } catch (e) { console.error(e); }
    await sleep(15000);
  }
  throw new Error("receipt timeout");
}

function failureCode(tx) {
  try {
    const lr = tx?.consensus_data?.leader_receipt?.[0];
    if (!lr) return "";
    const hay = JSON.stringify(lr);
    const m = hay.match(/"payload"\s*:\s*"([A-Z_]+)"/) || hay.match(/\b([A-Z]{3,30}_[A-Z_]{2,30})\b/);
    return m ? m[1] : "";
  } catch { return ""; }
}

function executionFailed(tx) {
  const leader = [tx?.consensus_data?.leader_receipt].flat().find(item => item?.mode === "leader");
  return ![6, "MAJORITY_AGREE"].includes(tx?.result) || leader?.execution_result !== "SUCCESS";
}

async function sendWrite(fn, fnArgs, after) {
  if (!walletAddress || !writeClient) {
    setStatus(t("errConnectWallet"), true);
    return;
  }
  setStatus(t("txSending"));
  try {
    const hash = await writeClient.writeContract({ account: walletAddress, address: contractAddress, functionName: fn, args: fnArgs, value: 0n });
    setStatus(`${t("txWaiting")} ${hash.slice(0, 12)}…`);
    const receipt = await waitFinalizedBrowser(hash);
    if (statusNameOf(receipt) !== "FINALIZED" || executionFailed(receipt)) {
      const code = failureCode(receipt);
      setStatus(t("txFailed") + (code ? ` ${t("errCode")}${code}` : ""), true);
      return;
    }
    setStatus(t("txSuccess"));
    if (after) await after();
    await loadDebate();
  } catch (e) {
    console.error(e);
    setStatus(`${t("txFailed")} ${String(e?.message || e).slice(0, 200)}`, true);
  }
}

function initEvents() {
  window.ethereum?.on?.("accountsChanged", accounts => {
    if (!writeClient) return;
    walletAddress = accounts[0] ?? null;
    if (!walletAddress) writeClient = null;
    renderWalletState();
  });
  document.querySelectorAll("[data-appeal-demo]").forEach(button => button.addEventListener("click", async () => {
    const alreadyLoaded = contractAddress.toLowerCase() === deployment.contractAddress.toLowerCase()
      && debate?.id === demo.debateId && args.some(row => row.id === demo.arguments[Number(button.dataset.appealDemo)].id);
    contractAddress = deployment.contractAddress;
    debateId = demo.debateId;
    selectedId = demo.arguments[Number(button.dataset.appealDemo)].id;
    $("contractInput").value = contractAddress;
    $("debateInput").value = debateId;
    $("explorerLink").href = explorerUrl();
    $("footerExplorer").href = explorerUrl();
    if (alreadyLoaded) { renderTree(); renderDetail(); }
    else await loadDebate();
    if (!$("detailPanel").hidden) $("detailPanel").scrollIntoView({block:"nearest"});
  }));
  $("appealForm").addEventListener("submit", e => {
    e.preventDefault();
    if (selectedId) sendWrite("file_appeal", [selectedId, $("appealUrl").value.trim(), $("appealGroundsInput").value.trim()]);
  });
  $("resolveAppealBtn").addEventListener("click", () => {
    if (selectedId) sendWrite("resolve_appeal", [selectedId]);
  });
  $("endAppealBtn").addEventListener("click", () => {
    if (selectedId) sendWrite("end_appeal", [selectedId]);
  });
  $("langBtn").addEventListener("click", () => {
    lang = lang === "en" ? "zh" : "en";
    applyLang();
  });
  $("walletBtn").addEventListener("click", async () => {
    if (walletAddress) {
      walletAddress = null;
      writeClient = null;
      renderWalletState();
      return;
    }
    if (!window.ethereum) {
      setStatus(t("noWalletFound"), true);
      return;
    }
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      walletAddress = accounts[0];
      writeClient = createClient({ chain: studionet, provider: window.ethereum });
      renderWalletState();
      setStatus("");
    } catch (e) {
      console.error(e);
      setStatus(t("noWalletFound"), true);
    }
  });
  $("loadContractBtn").addEventListener("click", () => {
    const v = $("contractInput").value.trim();
    if (!v) return;
    contractAddress = v;
    $("explorerLink").href = explorerUrl();
    $("footerExplorer").href = explorerUrl();
    loadDebate();
  });
  $("loadDebateBtn").addEventListener("click", () => {
    const v = $("debateInput").value.trim();
    if (!v) return;
    debateId = v;
    loadDebate();
  });
  $("reloadBtn").addEventListener("click", loadDebate);
  $("sideFilter").addEventListener("change", (e) => { sideFilter = e.target.value; renderTree(); });
  $("verdictFilter").addEventListener("change", (e) => { verdictFilter = e.target.value; renderTree(); });
  $("detailCloseBtn").addEventListener("click", () => { selectedId = null; renderTree(); renderDetail(); });
  $("assessBtn").addEventListener("click", () => {
    if (!selectedId) return;
    const keep = selectedId;
    sendWrite("assess_argument", [keep], async () => { selectedId = keep; });
  });
  $("closeDebateBtn").addEventListener("click", () => sendWrite("close_debate", [debateId]));
  $("createForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const topic = $("topicInput").value.trim();
    const desc = $("descInput").value.trim();
    if (!topic || !desc) return;
    const before = counts ? counts.debate_count : 0;
    await sendWrite("create_debate", [topic, desc], async () => {
      debateId = `debate-${before}`;
      $("debateInput").value = debateId;
    });
  });
  $("postForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const side = $("argSide").value;
    const claim = $("claimInput").value.trim();
    const url = $("evidenceInput").value.trim();
    const note = $("noteInput").value.trim();
    if (!claim || !url) return;
    await sendWrite("post_argument", [debateId, side, claim, url, note]);
  });
}

$("contractInput").value = contractAddress;
$("explorerLink").href = explorerUrl();
$("footerExplorer").href = explorerUrl();
$("repoLink").href = REPO;
applyLang();
initEvents();
loadDebate();
