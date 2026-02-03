// ✅ BÜTÜN OYUNLAR (pubhtml) linkin:
const SHEET_PUBHTML =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vStIO74mPPf_rhjRa-K8pk4ZCA-lCVAaFGg4ZVnE6DxbEwIGXjpICy8uAIa5hhAmyHq6Psyy-wqHUsL/pubhtml?gid=1233566992&single=true";

function setStatus(msg) {
  const el = document.getElementById("durum");
  if (el) el.textContent = msg || "";
}

async function loadOyunlar() {
  const container = document.getElementById("oyun-listesi");
  if (!container) return;

  container.textContent = "Veri çekiliyor...";
  setStatus("Sheet'e bağlanılıyor...");

  try {
    const res = await fetch(SHEET_PUBHTML, { cache: "no-store" });
    const html = await res.text();

    const doc = new DOMParser().parseFromString(html, "text/html");
    const table = doc.querySelector("table");
    if (!table) {
      container.textContent = "HATA: Sheet tablosu bulunamadı (pubhtml).";
      setStatus("Hata: tablo yok.");
      return;
    }

    const rows = Array.from(table.querySelectorAll("tr"));
    if (rows.length < 2) {
      container.textContent = "HATA: Sheet tablosu boş görünüyor.";
      setStatus("Hata: satır yok.");
      return;
    }

    // Başlık satırı (pubhtml'de genelde td gelir)
    const headerCells = Array.from(rows[0].querySelectorAll("td,th"))
      .map(x => x.textContent.trim());

    // "Oyun" geçen sütunu bul (Oyun, Oyun Adı, OyunAdi vs.)
    const oyunColIndex = headerCells.findIndex(h => h.toLowerCase().includes("oyun"));
    if (oyunColIndex === -1) {
      container.textContent = "HATA: Oyun kolonu bulunamadı. (Başlıkta 'Oyun' geçen bir sütun olmalı.)";
      setStatus("Hata: oyun kolonu yok.");
      return;
    }

    const oyunlar = new Set();

    rows.slice(1).forEach(r => {
      const cells = Array.from(r.querySelectorAll("td,th"));
      const val = (cells[oyunColIndex]?.textContent || "").trim();
      if (val) oyunlar.add(val);
    });

    const list = Array.from(oyunlar).sort((a,b) => a.localeCompare(b, "tr"));
    container.innerHTML = "";

    if (!list.length) {
      container.textContent = "Oyun bulunamadı (liste boş).";
      setStatus("Tamamlandı ama oyun yok.");
      return;
    }

    list.forEach(name => {
      const div = document.createElement("div");
      div.className = "oyun-item";
      div.textContent = name;
      container.appendChild(div);
    });

    setStatus(`Hazır. ${list.length} oyun bulundu.`);
  } catch (e) {
    console.error(e);
    container.textContent = "HATA: Veri çekilemedi.";
    setStatus("Hata: fetch başarısız.");
  }
}

document.addEventListener("DOMContentLoaded", loadOyunlar);
