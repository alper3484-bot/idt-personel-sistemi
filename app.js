// =========================
// IDT Personel Sistemi - FINAL app.js
// Google Sheets (Publish to web) -> CSV çekip oyun listesini üretir
// =========================

// 1) BURAYA CSV LINKİ (pub?output=csv) KOY
const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vStIO74mPPf_rhjRa-K8pk4ZCA-lCVAaFGg4ZVnE6DxbEwIGXjpICy8uAIa5hhAmyHq6Psyy-wqHUsL/pub?gid=1233566992&single=true&output=csv";

let rows = [];          // tüm satırlar
let headers = [];       // başlıklar
let oyunAdiKey = null;  // "Oyun Adı" kolon adı (bulunan)
let currentOyun = null;

// ---------- yardımcı DOM bulucular ----------
function $(sel) { return document.querySelector(sel); }
function ensureEl(id, tag = "div") {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement(tag);
    el.id = id;
    document.body.appendChild(el);
  }
  return el;
}

// ---------- UI hedefleri (index.html içinde yoksa da bozulmasın diye fallback) ----------
const statusEl = document.getElementById("status") || ensureEl("status");
const errorEl  = document.getElementById("error")  || ensureEl("error");
const listEl   = document.getElementById("oyunList") || ensureEl("oyunList");
const searchEl = document.getElementById("oyunSearch") || ensureEl("oyunSearch", "input");
const detailEl = document.getElementById("detay") || ensureEl("detay");

function setStatus(msg) {
  statusEl.textContent = msg || "";
}
function setError(msg) {
  errorEl.textContent = msg || "";
  errorEl.style.color = msg ? "crimson" : "";
}

// ---------- CSV parse (tırnaklı alanları da taşır) ----------
function parseCSV(text) {
  const lines = text.replace(/\r/g, "").split("\n").filter(l => l.trim() !== "");
  const out = [];
  for (const line of lines) out.push(parseCSVLine(line));
  return out;
}
function parseCSVLine(line) {
  const res = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"' ) {
      if (inQuotes && line[i + 1] === '"') { // escaped quote
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      res.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  res.push(cur);
  return res.map(s => (s ?? "").trim());
}

// ---------- başlık normalizasyonu ----------
function norm(s) {
  return (s || "")
    .trim()
    .toLowerCase()
    .replace(/ı/g, "i")   // i/ı farkını kapat
    .replace(/\s+/g, " ");
}

// ---------- oyun kolonunu bul ----------
function findOyunColumn(headerRow) {
  // "Oyun Adı", "Oyun Adi", "Oyun" gibi varyantları yakala
  const candidates = headerRow.map(h => norm(h));

  // önce "oyun adi" içereni ara
  let idx = candidates.findIndex(h => h.includes("oyun adi"));
  if (idx !== -1) return headerRow[idx];

  // sonra direkt "oyun" olanı ara
  idx = candidates.findIndex(h => h === "oyun" || h.includes("oyun"));
  if (idx !== -1) return headerRow[idx];

  return null;
}

// ---------- liste render ----------
function renderOyunList(filterText = "") {
  listEl.innerHTML = "";

  const f = norm(filterText);
  const oyunlar = Array.from(new Set(rows.map(r => r[oyunAdiKey]).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, "tr"));

  const filtered = f ? oyunlar.filter(o => norm(o).includes(f)) : oyunlar;

  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.textContent = "Sonuç yok.";
    empty.style.opacity = "0.7";
    listEl.appendChild(empty);
    return;
  }

  filtered.forEach(oyun => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = oyun;
    btn.style.display = "block";
    btn.style.width = "100%";
    btn.style.textAlign = "left";
    btn.style.padding = "10px";
    btn.style.margin = "6px 0";
    btn.style.borderRadius = "10px";
    btn.style.border = "1px solid #e6e6e6";
    btn.style.background = "white";
    btn.style.cursor = "pointer";
    btn.onclick = () => showOyunDetay(oyun);
    listEl.appendChild(btn);
  });
}

function showOyunDetay(oyun) {
  currentOyun = oyun;
  const oyunRows = rows.filter(r => r[oyunAdiKey] === oyun);

  // tablo oluştur
  const table = document.createElement("table");
  table.style.width = "100%";
  table.style.borderCollapse = "collapse";

  const thead = document.createElement("thead");
  const trh = document.createElement("tr");
  headers.forEach(h => {
    const th = document.createElement("th");
    th.textContent = h;
    th.style.textAlign = "left";
    th.style.padding = "8px";
    th.style.borderBottom = "1px solid #ddd";
    trh.appendChild(th);
  });
  thead.appendChild(trh);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  oyunRows.forEach(row => {
    const tr = document.createElement("tr");
    headers.forEach(h => {
      const td = document.createElement("td");
      td.textContent = row[h] ?? "";
      td.style.padding = "8px";
      td.style.borderBottom = "1px solid #f0f0f0";
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  detailEl.innerHTML = "";
  const title = document.createElement("h3");
  title.textContent = oyun;
  title.style.marginTop = "0";
  detailEl.appendChild(title);
  detailEl.appendChild(table);
}

// ---------- fetch ----------
async function fetchData() {
  setError("");
  setStatus("Veri çekiliyor...");

  // iPad Safari cache kırmak için ?v=
  const url = SHEET_CSV_URL + (SHEET_CSV_URL.includes("?") ? "&" : "?") + "v=" + Date.now();

  let res;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch (e) {
    setStatus("");
    setError("HATA: Veri alınamadı. Ağ bağlantısı / CORS. (" + e.message + ")");
    return;
  }

  if (!res.ok) {
    setStatus("");
    setError("HATA: Veri alınamadı. HTTP " + res.status);
    return;
  }

  const text = await res.text();
  const parsed = parseCSV(text);

  if (!parsed || parsed.length < 2) {
    setStatus("");
    setError("HATA: CSV boş geldi. Publish linkini kontrol et.");
    return;
  }

  headers = parsed[0];
  const oyunColName = findOyunColumn(headers);

  if (!oyunColName) {
    setStatus("");
    setError("HATA: 'Oyun Adı' sütunu bulunamadı. Başlık 'Oyun Adı' veya 'Oyun Adi' olmalı.");
    return;
  }

  oyunAdiKey = oyunColName;

  // satırları object yap
  rows = parsed.slice(1).map(cols => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = cols[i] ?? "");
    return obj;
  });

  setStatus("");
  renderOyunList(searchEl.value || "");
}

// ---------- eventler ----------
function setup() {
  // search input yoksa input gibi ayarla
  if (searchEl.tagName.toLowerCase() === "input") {
    searchEl.placeholder = searchEl.placeholder || "Oyun ara...";
    searchEl.addEventListener("input", () => renderOyunList(searchEl.value));
  }

  // Yenile butonu varsa bağla
  const yenileBtn = document.getElementById("yenileBtn");
  if (yenileBtn) yenileBtn.addEventListener("click", fetchData);

  fetchData();
}

document.addEventListener("DOMContentLoaded", setup);