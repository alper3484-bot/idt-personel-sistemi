// =====================
// Google Sheets (GVIZ) Ayarları
// =====================
const SHEET_ID = "1sIzswZnMkyRPJejAsE_ylSKzAF0RmFiACP4jYtz-AE0";
const GID_BUTUN_OYUNLAR = "1233566992"; // BÜTÜN OYUNLAR gid

// =====================
// DOM
// =====================
const el = (id) => document.getElementById(id);

const statusEl = el("status");
const gameListEl = el("gameList");
const gameSearchEl = el("gameSearch");
const detailEl = el("detail");
const detailTitleEl = el("detailTitle");

const btnRefresh = el("btnRefresh");
const btnCopy = el("btnCopy");
const btnDownload = el("btnDownload");
const btnBack = el("btnBack");

// Tabs
document.querySelectorAll(".tab").forEach((b) => {
  b.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
    b.classList.add("active");

    const tab = b.dataset.tab;
    document.querySelectorAll(".panel").forEach(p => p.classList.add("hidden"));
    el(`tab-${tab}`).classList.remove("hidden");
  });
});

// =====================
// State
// =====================
let rows = [];          // normalized rows: {oyun, kategori, gorev, kisi}
let games = [];         // unique game names
let selectedGame = null;

// =====================
// Utils
// =====================
function setStatus(msg, kind = "ok") {
  statusEl.textContent = msg;
  statusEl.classList.toggle("error", kind === "error");
}

function norm(s) {
  return (s ?? "")
    .toString()
    .trim()
    .replace(/\s+/g, " ");
}

function normKey(s) {
  return norm(s)
    .toLowerCase()
    .replace(/[ıİ]/g, "i")
    .replace(/[çÇ]/g, "c")
    .replace(/[ğĞ]/g, "g")
    .replace(/[öÖ]/g, "o")
    .replace(/[şŞ]/g, "s")
    .replace(/[üÜ]/g, "u");
}

function toTSV(list) {
  const header = ["Oyun Adı", "Kategori", "Görev", "Kişi"];
  const lines = [header.join("\t")];
  for (const r of list) {
    lines.push([r.oyun, r.kategori, r.gorev, r.kisi].map(v => (v ?? "")).join("\t"));
  }
  return lines.join("\n");
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // fallback
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    return true;
  }
}

function downloadFile(filename, content) {
  const blob = new Blob(["\ufeff" + content], { type: "text/tab-separated-values;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// =====================
// GVIZ Fetch + Parse
// =====================
function gvizUrl(sheetId, gid) {
  // tqx=out:json -> JSON wrapped in JS function
  return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?gid=${gid}&tqx=out:json`;
}

function parseGviz(text) {
  const start = text.indexOf("(");
  const end = text.lastIndexOf(")");
  if (start === -1 || end === -1) throw new Error("GVIZ parse edilemedi.");
  const json = JSON.parse(text.slice(start + 1, end));
  return json;
}

function findColIndex(cols, wanted) {
  // wanted: array of acceptable keys
  // cols: [{label, id, type}, ...]
  const keys = cols.map(c => normKey(c.label || c.id || ""));
  for (let i = 0; i < keys.length; i++) {
    for (const w of wanted) {
      if (keys[i].includes(w)) return i;
    }
  }
  return -1;
}

async function loadData() {
  setStatus("Veri çekiliyor...");
  selectedGame = null;
  rows = [];
  games = [];
  renderGames();
  renderDetail();

  const url = gvizUrl(SHEET_ID, GID_BUTUN_OYUNLAR);

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Veri alınamadı. HTTP ${res.status}`);
  const txt = await res.text();
  const g = parseGviz(txt);

  const cols = g?.table?.cols || [];
  const rws = g?.table?.rows || [];

  // Sheet başlıkları: Oyun Adı / Kategori / Görev / Kişi
  const idxOyun = findColIndex(cols, ["oyun adi", "oyunadi", "oyun"]);
  const idxKat  = findColIndex(cols, ["kategori"]);
  const idxGor  = findColIndex(cols, ["gorev"]);
  const idxKisi = findColIndex(cols, ["kisi"]);

  if (idxOyun === -1) throw new Error("Oyun kolonu bulunamadı. Başlık 'Oyun Adı' olmalı.");
  if (idxKat === -1)  throw new Error("Kategori kolonu bulunamadı.");
  if (idxGor === -1)  throw new Error("Görev kolonu bulunamadı.");
  if (idxKisi === -1) throw new Error("Kişi kolonu bulunamadı.");

  const out = [];
  for (const rr of rws) {
    const c = rr.c || [];
    const oyun = norm(c[idxOyun]?.v ?? c[idxOyun]?.f);
    const kategori = norm(c[idxKat]?.v ?? c[idxKat]?.f);
    const gorev = norm(c[idxGor]?.v ?? c[idxGor]?.f);
    const kisi = norm(c[idxKisi]?.v ?? c[idxKisi]?.f);

    if (!oyun && !kisi && !gorev && !kategori) continue;
    if (!oyun) continue;

    out.push({ oyun, kategori, gorev, kisi });
  }

  rows = out;

  const set = new Set(rows.map(r => r.oyun).filter(Boolean));
  games = Array.from(set).sort((a,b) => a.localeCompare(b, "tr"));

  setStatus(`Yüklendi. (${games.length} oyun, ${rows.length} satır)`);
  renderGames();
  renderDetail();
}

// =====================
// Render
// =====================
function renderGames() {
  const q = norm(gameSearchEl.value);
  const filtered = !q
    ? games
    : games.filter(g => normKey(g).includes(normKey(q)));

  gameListEl.innerHTML = "";

  if (!filtered.length) {
    gameListEl.innerHTML = `<div class="muted">Sonuç yok.</div>`;
    return;
  }

  for (const g of filtered) {
    const div = document.createElement("div");
    div.className = "item" + (g === selectedGame ? " active" : "");
    div.textContent = g;
    div.addEventListener("click", () => selectGame(g));
    gameListEl.appendChild(div);
  }
}

function renderDetail() {
  if (!selectedGame) {
    detailTitleEl.textContent = "Detay";
    detailEl.innerHTML = `<div class="muted">Soldan bir oyun seç.</div>`;
    btnCopy.disabled = true;
    btnDownload.disabled = true;
    return;
  }

  const list = rows.filter(r => r.oyun === selectedGame);

  detailTitleEl.textContent = selectedGame;

  const html = `
    <table class="table">
      <thead>
        <tr>
          <th>Kategori</th>
          <th>Görev</th>
          <th>Kişi</th>
        </tr>
      </thead>
      <tbody>
        ${list.map(r => `
          <tr>
            <td>${escapeHtml(r.kategori)}</td>
            <td>${escapeHtml(r.gorev)}</td>
            <td>${escapeHtml(r.kisi)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
  detailEl.innerHTML = html;

  btnCopy.disabled = false;
  btnDownload.disabled = false;
}

function escapeHtml(s) {
  return (s ?? "").toString()
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

// =====================
// Selection + Mobile Back
// =====================
function selectGame(g) {
  selectedGame = g;
  renderGames();
  renderDetail();

  // mobil davranış: seçim yapınca detail öne çıksın + geri butonu
  if (window.matchMedia("(max-width: 980px)").matches) {
    btnBack.classList.remove("hidden");
    // history state
    history.pushState({ view: "game", game: g }, "", "#game");
    document.getElementById("detailCard").scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

window.addEventListener("popstate", () => {
  // geri basınca listeye dön
  if (window.matchMedia("(max-width: 980px)").matches) {
    if (!location.hash || location.hash === "#") {
      btnBack.classList.add("hidden");
      selectedGame = null;
      renderGames();
      renderDetail();
      document.querySelector(".card").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
});

btnBack.addEventListener("click", () => {
  // listeye dön
  btnBack.classList.add("hidden");
  selectedGame = null;
  renderGames();
  renderDetail();
  history.pushState({}, "", "#");
});

// =====================
// Actions
// =====================
gameSearchEl.addEventListener("input", renderGames);

btnRefresh.addEventListener("click", async () => {
  try { await loadData(); }
  catch (e) { setStatus("HATA: " + e.message, "error"); }
});

btnCopy.addEventListener("click", async () => {
  if (!selectedGame) return;
  const list = rows.filter(r => r.oyun === selectedGame);
  const tsv = toTSV(list);
  await copyText(tsv);
  setStatus("Kopyalandı (Excel'e yapıştırabilirsin).");
});

btnDownload.addEventListener("click", () => {
  if (!selectedGame) return;
  const list = rows.filter(r => r.oyun === selectedGame);
  const tsv = toTSV(list);
  const safe = selectedGame.replace(/[\\/:*?"<>|]+/g, "_");
  downloadFile(`${safe}.tsv`, tsv);
  setStatus("TSV indirildi.");
});

// İlk yükleme
(async function init(){
  try { await loadData(); }
  catch (e) { setStatus("HATA: " + e.message, "error"); }
})();
