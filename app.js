const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vStIO74mPPf_rhjRa-K8pk4ZCA-lCVAaFGg4ZVnE6DxbEwIGXjpICy8uAIa5hhAmyHq6Psyy-wqHUsL/pubhtml?gid=1233566992&single=true";

async function loadOyunlar() {
  const container = document.getElementById("oyun-listesi");
  container.innerHTML = "Veri çekiliyor...";

  try {
    const res = await fetch(SHEET_URL);
    const html = await res.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const table = doc.querySelector("table");
    if (!table) {
      container.innerHTML = "HATA: Sheet tablosu bulunamadı.";
      return;
    }

    const rows = Array.from(table.querySelectorAll("tr"));
    const headers = Array.from(rows[0].querySelectorAll("td")).map(td =>
      td.textContent.trim()
    );

    // 🔥 KRİTİK SATIR
    const oyunIndex = headers.findIndex(h =>
      h.toLowerCase().includes("oyun")
    );

    if (oyunIndex === -1) {
      container.innerHTML =
        "HATA: 'Oyun Adı' sütunu bulunamadı.";
      return;
    }

    const oyunlar = new Set();

    rows.slice(1).forEach(row => {
      const cells = row.querySelectorAll("td");
      if (cells[oyunIndex]) {
        const oyun = cells[oyunIndex].textContent.trim();
        if (oyun) oyunlar.add(oyun);
      }
    });

    container.innerHTML = "";

    [...oyunlar].forEach(oyun => {
      const div = document.createElement("div");
      div.textContent = oyun;
      div.className = "oyun-item";
      container.appendChild(div);
    });

  } catch (err) {
    container.innerHTML = "HATA: Veri çekilemedi.";
    console.error(err);
  }
}

document.addEventListener("DOMContentLoaded", loadOyunlar);
