const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vStIO74mPPf_rhjRa-K8pk4ZCA-lCVAaFGg4ZVnE6DxbEwIGXjpICy8uAIa5hhAmyHq6Psyy-wqHUsL/pubhtml?gid=1233566992&single=true";

const oyunListesiDiv = document.getElementById("oyun-listesi");
const durumDiv = document.getElementById("durum");

function cellText(cell) {
  return (cell?.innerText ?? "").replace(/\u00a0/g, " ").trim(); // nbsp temizle
}

fetch(SHEET_URL, { cache: "no-store" })
  .then((res) => res.text())
  .then((html) => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const table = doc.querySelector("table");
    if (!table) {
      durumDiv.innerText = "HATA: Yayınlanan sayfada tablo bulunamadı (link/gid yanlış olabilir).";
      return;
    }

    const rows = [...table.querySelectorAll("tr")];
    if (rows.length < 2) {
      durumDiv.innerText = "HATA: Sheet boş görünüyor.";
      return;
    }

    // 1) Başlık satırını bul: ilk 10 satır içinde "oyun" geçen satırı ara
    let headerRowIndex = -1;
    let headers = [];
    for (let i = 0; i < Math.min(10, rows.length); i++) {
      const cells = [...rows[i].querySelectorAll("th, td")].map((c) => cellText(c).toLowerCase());
      if (cells.some((t) => t.includes("oyun"))) {
        headerRowIndex = i;
        headers = cells;
        break;
      }
    }

    if (headerRowIndex === -1) {
      durumDiv.innerText =
        "HATA: Başlık satırında 'oyun' geçen bir sütun bulunamadı. (Başlık satırın ilk 10 satır içinde olmalı)";
      return;
    }

    // 2) Google pubhtml bazen en sola satır numarası koyuyor: onu görmezden gelmek için index kaydırma
    // headers içinde boş / sadece sayı olan ilk hücreyi kırp
    // ama en garanti yol: her satırda aynı kolon sayısını baz alacağız.
    const oyunColIndex = headers.findIndex((h) => h.includes("oyun"));
    if (oyunColIndex === -1) {
      durumDiv.innerText =
        "HATA: Oyun kolonu bulunamadı. Başlık hücresinde 'Oyun' kelimesi geçmeli.";
      return;
    }

    // 3) Veri satırları: başlıktan sonraki satırlar
    const dataRows = rows.slice(headerRowIndex + 1);

    const oyunlar = [];
    for (const r of dataRows) {
      const cells = [...r.querySelectorAll("th, td")].map(cellText);

      // tamamen boş satırı geç
      if (cells.every((x) => !x)) continue;

      const oyun = cells[oyunColIndex];
      if (oyun) oyunlar.push(oyun);
    }

    if (oyunlar.length === 0) {
      durumDiv.innerText =
        "HATA: Oyun verisi bulunamadı. (Oyun kolonunun altı boş olabilir ya da yanlış sayfaya bakıyor olabiliriz.)";
      return;
    }

    // Aynı oyunları tekilleştir + sırala
    const uniq = [...new Set(oyunlar)].sort((a, b) => a.localeCompare(b, "tr"));

    durumDiv.remove();
    const ul = document.createElement("ul");
    uniq.forEach((oyun) => {
      const li = document.createElement("li");
      li.textContent = oyun;
      ul.appendChild(li);
    });
    oyunListesiDiv.innerHTML = "";
    oyunListesiDiv.appendChild(ul);
  })
  .catch((err) => {
    console.error(err);
    durumDiv.innerText = "HATA: Veri çekilemedi (console’a bak).";
  });
