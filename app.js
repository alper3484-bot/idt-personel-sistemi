// ==== IDT Personel Sistemi - Google Sheets (GViz) Veri Çekme ====

// 1) Burayı doğru tut
const SHEET_ID = "1sIzswZnMkyRPJejAsE_ylSKzAF0RmFiACP4jYtz-AE0";
const GID_BUTUN_OYUNLAR = "1233566992";

// 2) Hangi sütundan "oyun adı" okunacak?
// Varsayım: A sütunu oyun adı (index 0). Eğer sende farklıysa 0'ı değiştir.
const COL_OYUN_ADI_INDEX = 0;

const el = (id) => document.getElementById(id);

function setStatus(msg) {
  const s = el("status");
  if (s) s.textContent = msg;
}

async function fetchGvizTable(sheetId, gid) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&gid=${gid}`;
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();

  // GViz response: google.visualization.Query.setResponse({...});
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("GViz JSON parse edilemedi.");

  const json = JSON.parse(text.slice(start, end + 1));
  const table = json.table;

  const cols = (table.cols || []).map(c => c.label || "");
  const rows = (table.rows || []).map(r => (r.c || []).map(cell => cell ? (cell.v ?? "") : ""));

  return { cols, rows };
}

function uniq(arr) {
  return [...new Set(arr.map(x => String(x).trim()).filter(Boolean))];
}

function renderOyunlar(oyunlar) {
  const list = el("oyunList");
  if (!list) return;

  list.innerHTML = "";
  oyunlar.forEach(name => {
    const li = document.createElement("li");
    li.textContent = name;
    list.appendChild(li);
  });
}

async function init() {
  try {
    setStatus("Veri çekiliyor...");

    const { cols, rows } = await fetchGvizTable(SHEET_ID, GID_BUTUN_OYUNLAR);

    // Oyun adlarını ilgili sütundan çek
    const oyunlar = uniq(rows.map(r => r[COL_OYUN_ADI_INDEX]));

    renderOyunlar(oyunlar);

    setStatus(`Hazır. Oyun: ${oyunlar.length}`);
    console.log("Cols:", cols);
    console.log("First rows:", rows.slice(0, 5));
  } catch (err) {
    console.error(err);
    setStatus("HATA: " + (err?.message || err));
  }
}

document.addEventListener("DOMContentLoaded", init);
