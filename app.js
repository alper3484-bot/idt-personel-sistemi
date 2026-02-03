// ===== Google Sheets -> CSV (gviz) =====
const SHEET_ID = "1sIzswZnMkyRPJejAsE_ylSKzAF0RmFiACP4jYtz-AE0";
const TAB_NAME = "BÜTÜN OYUNLAR"; // birebir aynı yazım olmalı

const CSV_URL =
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(TAB_NAME)}`;

function $(id) { return document.getElementById(id); }

// Basit CSV parser (tırnak + virgül destekli)
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1];

    if (c === '"' && inQuotes && n === '"') { cur += '"'; i++; continue; }
    if (c === '"') { inQuotes = !inQuotes; continue; }

    if (c === ',' && !inQuotes) { row.push(cur); cur = ""; continue; }
    if ((c === '\n' || c === '\r') && !inQuotes) {
      if (cur.length || row.length) { row.push(cur); rows.push(row); }
      cur = ""; row = [];
      continue;
    }
    cur += c;
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

async function loadData() {
  const status = $("status");
  try {
    status.textContent = "Veri çekiliyor...";
    const res = await fetch(CSV_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("CSV alınamadı: " + res.status);
    const text = await res.text();

    const table = parseCSV(text);
    if (!table.length) throw new Error("Boş veri geldi.");

    // 1. satır başlık kabul
    const headers = table[0].map(h => (h || "").trim());
    const rows = table.slice(1);

    // Bu isimleri senin sheet başlıklarına göre eşleştir
    // (Bilmiyorsak, en azından "Oyun" sütununu bulmaya çalışalım)
    const oyunCol =
      headers.findIndex(h => /oyun/i.test(h)) >= 0
        ? headers.findIndex(h => /oyun/i.test(h))
        : 0;

    // oyunları toparla
    const oyunMap = new Map();
    for (const r of rows) {
      const oyun = (r[oyunCol] || "").trim();
      if (!oyun) continue;
      oyunMap.set(oyun, (oyunMap.get(oyun) || 0) + 1);
    }

    renderOyunlar([...oyunMap.entries()].sort((a,b)=>a[0].localeCompare(b[0], "tr")));
    status.textContent = `Yüklendi (${oyunMap.size} oyun)`;
  } catch (e) {
    console.error(e);
    $("status").textContent = "Hata: " + e.message;
  }
}

function renderOyunlar(list) {
  const ul = $("oyunList");
  ul.innerHTML = "";
  for (const [oyun, count] of list) {
    const li = document.createElement("li");
    li.className = "item";
    li.textContent = `${oyun} (${count})`;
    ul.appendChild(li);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadData();
});
