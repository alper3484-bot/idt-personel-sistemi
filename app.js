// ======================
// CONFIG (senin sheet)
// ======================
const SHEET_PUBLISHED_BASE =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vStIO74mPPf_rhjRa-K8pk4ZCA-lCVAaFGg4ZVnE6DxbEwIGXjpICy8uAIa5hhAmyHq6Psyy-wqHUsL";
const GID = "1233566992";

// Google Visualization JSON endpoint
const GVIZ_URL = `${SHEET_PUBLISHED_BASE}/gviz/tq?tqx=out:json&gid=${encodeURIComponent(GID)}`;

// ======================
// DOM
// ======================
const el = (id) => document.getElementById(id);

const statusEl = el("status");
const gamesListEl = el("gamesList");
const gameDetailEl = el("gameDetail");
const detailTitleEl = el("detailTitle");

const gameSearchEl = el("gameSearch");
const btnReload = el("btnReload");
const btnCopy = el("btnCopy");
const btnDownload = el("btnDownload");

// tabs
document.querySelectorAll(".tab").forEach((b) => {
  b.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    const tab = b.dataset.tab;
    document.querySelectorAll(".panel").forEach(p => p.classList.add("hidden"));
    el(tab).classList.remove("hidden");
  });
});

// ======================
// DATA
// ======================
let allRows = [];      // {oyun,kategori,gorev,kisi}
let currentGame = null;
let filteredGames = [];

// Normalize helpers
const norm = (s) =>
  String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");

function pickColumnIndex(headers, synonyms) {
  // headers: string[]
  const nHeaders = headers.map(norm);

  for (const syn of synonyms) {
    const nSyn = norm(syn);
    const idx = nHeaders.findIndex(h => h === nSyn || h.includes(nSyn));
    if (idx !== -1) return idx;
  }
  return -1;
}

function parseGvizJson(text) {
  // gviz response: /*O_o*/ google.visualization.Query.setResponse({...});
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("GVIZ JSON parse edilemedi.");
  const json = JSON.parse(text.slice(start, end + 1));
  return json;
}

async function loadSheet() {
  statusEl.textContent = "Veri çekiliyor...";
  gamesListEl.innerHTML = "";
  gameDetailEl.innerHTML = `<div class="empty">Soldan bir oyun seç.</div>`;
  detailTitleEl.textContent = "Detay";
  currentGame = null;

  try {
    const res = await fetch(GVIZ_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("Sheet verisi çekilemedi (HTTP " + res.status + ")");
    const txt = await res.text();
    const data = parseGvizJson(txt);

    const table = data.table;
    if (!table || !table.cols || !table.rows) throw new Error("Sheet tablosu boş görünüyor.");

    // headers
    const headers = table.cols.map(c => (c.label ?? "").trim());

    // Column detection (senin sheet'e uygun)
    const idxOyun = pickColumnIndex(headers, ["Oyun Adı", "Oyun", "OyunAdi"]);
    const idxKategori = pickColumnIndex(headers, ["Kategori"]);
    const idxGorev = pickColumnIndex(headers, ["Görev", "Gorev"]);
    const idxKisi = pickColumnIndex(headers, ["Kişi", "Kisi", "Personel", "Ad Soyad", "Adı Soyadı"]);

    if (idxOyun === -1) {
      throw new Error("Oyun kolonu bulunamadı. Başlık 'Oyun Adı' olmalı (sende öyle zaten).");
    }
    if (idxKisi === -1) {
      throw new Error("Kişi kolonu bulunamadı. Başlık 'Kişi' olmalı.");
    }

    // rows -> plain objects
    allRows = table.rows
      .map(r => (r.c || []).map(cell => (cell && (cell.v ?? cell.f)) ?? ""))
      .map(cells => ({
        oyun: String(cells[idxOyun] ?? "").trim(),
        kategori: String(cells[idxKategori] ?? "").trim(),
        gorev: String(cells[idxGorev] ?? "").trim(),
        kisi: String(cells[idxKisi] ?? "").trim(),
      }))
      .filter(x => x.oyun && x.kisi); // minimum

    const games = Array.from(new Set(allRows.map(r => r.oyun))).sort((a,b)=>a.localeCompare(b,"tr"));
    filteredGames = games;

    renderGames(filteredGames);

    statusEl.textContent = `Yüklendi: ${games.length} oyun, ${allRows.length} satır.`;
  } catch (err) {
    statusEl.textContent = "HATA: " + (err?.message || String(err));
  }
}

// ======================
// RENDER
// ======================
function renderGames(games) {
  if (!games.length) {
    gamesListEl.innerHTML = `<div class="item">Oyun bulunamadı.</div>`;
    return;
  }

  gamesListEl.innerHTML = "";
  games.forEach((g) => {
    const div = document.createElement("div");
    div.className = "item";
    div.textContent = g;
    div.addEventListener("click", () => selectGame(g));
    gamesListEl.appendChild(div);
  });
}

function selectGame(gameName) {
  currentGame = gameName;

  // active class
  [...gamesListEl.querySelectorAll(".item")].forEach(it => {
    it.classList.toggle("active", it.textContent === gameName);
  });

  detailTitleEl.textContent = gameName;

  const rows = allRows.filter(r => r.oyun === gameName);

  // group by kişi (same person can have multiple görev)
  const map = new Map(); // kisi -> {kategori:Set, gorev:Set}
  rows.forEach(r => {
    const key = r.kisi;
    if (!map.has(key)) map.set(key, { kategori: new Set(), gorev: new Set() });
    if (r.kategori) map.get(key).kategori.add(r.kategori);
    if (r.gorev) map.get(key).gorev.add(r.gorev);
  });

  const people = [...map.keys()].sort((a,b)=>a.localeCompare(b,"tr"));

  const html = `
    <table class="table">
      <thead>
        <tr>
          <th>Kişi</th>
          <th>Kategori</th>
          <th>Görev</th>
        </tr>
      </thead>
      <tbody>
        ${people.map(p => {
          const v = map.get(p);
          const kat = [...v.kategori].join(", ");
          const gor = [...v.gorev].join(", ");
          return `<tr>
            <td>${escapeHtml(p)}</td>
            <td>${escapeHtml(kat)}</td>
            <td>${escapeHtml(gor)}</td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>
  `;

  gameDetailEl.innerHTML = html;
}

function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}

// ======================
// EXPORT
// ======================
function currentTableRowsForExport() {
  if (!currentGame) return [];
  const rows = allRows.filter(r => r.oyun === currentGame);

  // export raw satır satır (sheet’e yakın)
  return rows.map(r => [r.oyun, r.kategori, r.gorev, r.kisi]);
}

async function copyAsTsv() {
  const rows = currentTableRowsForExport();
  if (!rows.length) return alert("Önce bir oyun seç.");
  const header = ["Oyun Adı","Kategori","Görev","Kişi"];
  const tsv = [header, ...rows].map(r => r.map(x => String(x ?? "").replace(/\t/g," ")).join("\t")).join("\n");

  try {
    await navigator.clipboard.writeText(tsv);
    alert("Kopyalandı. Excel'e yapıştırabilirsin.");
  } catch {
    // fallback
    const ta = document.createElement("textarea");
    ta.value = tsv;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    alert("Kopyalandı. Excel'e yapıştırabilirsin.");
  }
}

function downloadTsv() {
  const rows = currentTableRowsForExport();
  if (!rows.length) return alert("Önce bir oyun seç.");
  const header = ["Oyun Adı","Kategori","Görev","Kişi"];
  const tsv = [header, ...rows].map(r => r.map(x => String(x ?? "").replace(/\t/g," ")).join("\t")).join("\n");
  const blob = new Blob(["\ufeff" + tsv], { type: "text/tab-separated-values;charset=utf-8" });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${currentGame}-liste.tsv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ======================
// EVENTS
// ======================
gameSearchEl.addEventListener("input", () => {
  const q = norm(gameSearchEl.value);
  const games = Array.from(new Set(allRows.map(r => r.oyun))).sort((a,b)=>a.localeCompare(b,"tr"));
  filteredGames = q ? games.filter(g => norm(g).includes(q)) : games;
  renderGames(filteredGames);
});

btnReload.addEventListener("click", loadSheet);
btnCopy.addEventListener("click", copyAsTsv);
btnDownload.addEventListener("click", downloadTsv);

// boot
loadSheet();
