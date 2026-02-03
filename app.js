// ====== AYAR ======
const SHEET_ID = "1sIzswZnMkyRPJejAsE_ylSKzAF0RmFiACP4jYtz-AE0";
const SHEET_NAME = "BÜTÜN OYUNLAR";

// GViz CSV (en stabil yöntem)
const CSV_URL =
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}`;

// ====== DOM ======
const $q = document.getElementById("q");
const $btnReload = document.getElementById("btnReload");
const $status = document.getElementById("status");
const $tbody = document.querySelector("#tbl tbody");
const $conflicts = document.getElementById("conflicts");

let allRows = [];      // {oyun,kategori,gorev,kisi}
let shownRows = [];    // filtrelenmiş

// ====== CSV PARSE ======
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQ = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' ) {
      if (inQ && next === '"') { cur += '"'; i++; }
      else inQ = !inQ;
      continue;
    }
    if (!inQ && ch === ",") { row.push(cur); cur = ""; continue; }
    if (!inQ && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cur); cur = "";
      if (row.some(c => (c ?? "").trim() !== "")) rows.push(row);
      row = [];
      continue;
    }
    cur += ch;
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

function norm(s) {
  return (s ?? "").toString().trim().toLowerCase();
}

function escapeHtml(s) {
  return (s ?? "").toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setStatus(msg) {
  $status.textContent = msg;
}

// ====== RENDER ======
function renderTable(list) {
  $tbody.innerHTML = "";
  for (const r of list) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(r.oyun)}</td>
      <td>${escapeHtml(r.kategori)}</td>
      <td>${escapeHtml(r.gorev)}</td>
      <td>${escapeHtml(r.kisi)}</td>
    `;
    $tbody.appendChild(tr);
  }
}

function renderConflicts(list) {
  const map = new Map(); // kisi -> Set(oyun)

  for (const r of list) {
    const kisiKey = norm(r.kisi);
    const oyun = (r.oyun ?? "").trim();
    if (!kisiKey || !oyun) continue;

    if (!map.has(kisiKey)) map.set(kisiKey, new Set());
    map.get(kisiKey).add(oyun);
  }

  const conflicts = [];
  for (const [k, set] of map.entries()) {
    if (set.size >= 2) conflicts.push({ kisi: k, oyunlar: [...set] });
  }

  $conflicts.innerHTML = "";
  if (!conflicts.length) {
    const li = document.createElement("li");
    li.textContent = "Şimdilik çakışma yok.";
    $conflicts.appendChild(li);
    return;
  }

  conflicts.sort((a,b)=>a.kisi.localeCompare(b.kisi, "tr"));
  for (const c of conflicts) {
    const li = document.createElement("li");
    li.innerHTML = `<b>${escapeHtml(c.kisi)}</b><br>${escapeHtml(c.oyunlar.join(", "))}`;
    $conflicts.appendChild(li);
  }
}

function applySearch() {
  const q = norm($q.value);
  if (!q) {
    shownRows = allRows.slice();
  } else {
    shownRows = allRows.filter(r =>
      norm(r.oyun).includes(q) ||
      norm(r.kategori).includes(q) ||
      norm(r.gorev).includes(q) ||
      norm(r.kisi).includes(q)
    );
  }
  renderTable(shownRows);
  renderConflicts(shownRows);
  setStatus(`Gösterilen: ${shownRows.length} / Toplam: ${allRows.length}`);
}

// ====== LOAD ======
async function loadData() {
  setStatus("Veri çekiliyor...");
  try {
    const res = await fetch(CSV_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const csv = await res.text();
    const grid = parseCSV(csv);
    if (grid.length < 2) throw new Error("Veri boş. Sheet adı/erişim kontrol.");

    const header = grid[0].map(h => norm(h));

    const idxOyun = header.indexOf("oyun adı");
    const idxKat = header.indexOf("kategori");
    const idxGorev = header.indexOf("görev") >= 0 ? header.indexOf("görev") : header.indexOf("gorev");
    const idxKisi = header.indexOf("kişi") >= 0 ? header.indexOf("kişi") : header.indexOf("kisi");

    if ([idxOyun, idxKat, idxGorev, idxKisi].some(i => i < 0)) {
      throw new Error("Başlıklar bulunamadı. İlk satır: Oyun Adı / Kategori / Görev / Kişi olmalı.");
    }

    allRows = grid.slice(1)
      .map(r => ({
        oyun: (r[idxOyun] ?? "").trim(),
        kategori: (r[idxKat] ?? "").trim(),
        gorev: (r[idxGorev] ?? "").trim(),
        kisi: (r[idxKisi] ?? "").trim(),
      }))
      .filter(r => r.oyun || r.kisi || r.gorev || r.kategori);

    applySearch();
  } catch (e) {
    console.error(e);
    setStatus(`Hata: ${e.message}`);
  }
}

// ====== EVENTS ======
$q?.addEventListener("input", applySearch);
$btnReload?.addEventListener("click", loadData);

// sayfa açılınca yükle
loadData();
