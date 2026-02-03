const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vStIO74mPPf_rhjRa-K8pk4ZCA-lCVAaFGg4ZVnE6DxbEwIGXjpICy8uAIa5hhAmyHq6Psyy-wqHUsL/pub?gid=1233566992&single=true&output=csv";

function showTab(id, btn) {
  document.querySelectorAll(".box").forEach(b => b.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");

  document.querySelectorAll("nav button").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
}

async function loadOyunlar() {
  const status = document.getElementById("status");
  status.textContent = "Oyunlar yükleniyor...";

  try {
    const res = await fetch(SHEET_URL);
    const text = await res.text();

    const rows = text.split("\n").slice(1);
    const ul = document.getElementById("oyunList");
    ul.innerHTML = "";

    rows.forEach(r => {
      const cols = r.split(",");
      if (cols[0]) {
        const li = document.createElement("li");
        li.textContent = cols[0];
        ul.appendChild(li);
      }
    });

    status.textContent = "Hazır.";
  } catch (e) {
    status.textContent = "Veri alınamadı!";
    console.error(e);
  }
}

loadOyunlar();
