const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vStIO74mPPf_rhjRa-K8pk4ZCA-lCVAaFGg4ZVnE6DxbEwIGXjpICy8uAIa5hhAmyHq6Psyy-wqHUsL/pubhtml?gid=1233566992&single=true";

const oyunListesiDiv = document.getElementById("oyun-listesi");
const durumDiv = document.getElementById("durum");

fetch(SHEET_URL)
  .then(res => res.text())
  .then(html => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const rows = [...doc.querySelectorAll("table tr")];
    if (rows.length < 2) {
      durumDiv.innerText = "HATA: Sheet boş görünüyor.";
      return;
    }

    const headers = [...rows[0].querySelectorAll("td")]
      .map(td => td.innerText.toLowerCase().trim());

    const oyunColIndex = headers.findIndex(h => h.includes("oyun"));

    if (oyunColIndex === -1) {
      durumDiv.innerText =
        "HATA: Oyun kolonu bulunamadı. Sheet başlığında 'Oyun' geçen bir sütun olmalı.";
      return;
    }

    const oyunlar = rows
      .slice(1)
      .map(r => r.querySelectorAll("td")[oyunColIndex]?.innerText.trim())
      .filter(Boolean);

    if (oyunlar.length === 0) {
      durumDiv.innerText = "Oyun bulunamadı.";
      return;
    }

    durumDiv.remove();

    const ul = document.createElement("ul");
    oyunlar.forEach(oyun => {
      const li = document.createElement("li");
      li.innerText = oyun;
      ul.appendChild(li);
    });

    oyunListesiDiv.appendChild(ul);
  })
  .catch(err => {
    console.error(err);
    durumDiv.innerText = "HATA: Veri çekilemedi.";
  });
