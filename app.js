const BASE_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1sIzswZnMkyRPJjASe_yISkZAf0RmFIACP4jYtz-AE0/gviz/tq?tqx=out:csv&gid=1233566992";

const durum = document.getElementById("durum");
const liste = document.getElementById("oyunlar");
const detay = document.getElementById("detay");
const yenile = document.getElementById("yenile");
const ara = document.getElementById("ara");

let satirlar = [];

function parseCSV(text) {
  // Basit CSV (senin sheet’in düz olduğu için yeterli)
  return text
    .trim()
    .split("\n")
    .map(r => r.split(",").map(c => c.replace(/^"|"$/g, "")));
}

async function fetchWithTimeout(url, ms = 8000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(t);
    return res;
  } catch (e) {
    clearTimeout(t);
    throw e;
  }
}

async function yukle() {
  durum.textContent = "Veri çekiliyor...";
  liste.innerHTML = "";
  detay.textContent = "Soldan bir oyun seç.";
  satirlar = [];

  // Cache bust
  const CSV_URL = BASE_CSV_URL + `&cb=${Date.now()}`;

  try {
    const res = await fetchWithTimeout(CSV_URL, 8000);

    if (!res.ok) {
      durum.textContent = `HATA: Veri alınamadı. HTTP ${res.status}`;
      return;
    }

    const text = await res.text();

    // izin sayfası gelirse yakalayalım
    if (text.toLowerCase().includes("sign in") || text.toLowerCase().includes("permission")) {
      durum.textContent = "HATA: Google Sheet erişimi kapalı. 'Herkese açık' yapmalısın.";
      return;
    }

    const data = parseCSV(text);

    if (!data || data.length < 2) {
      durum.textContent = "HATA: Sheet boş görünüyor.";
      return;
    }

    const baslik = data[0].map(x => x.trim());
    const oyunIndex = baslik.indexOf("Oyun Adı");

    if (oyunIndex === -1) {
      durum.textContent = `HATA: 'Oyun Adı' sütunu yok. Bulunan başlıklar: ${baslik.join(" | ")}`;
      return;
    }

    satirlar = data.slice(1).filter(r => r.length);

    const oyunlar = [...new Set(satirlar.map(r => (r[oyunIndex] || "").trim()).filter(Boolean))];

    oyunlar.forEach(o => {
      const li = document.createElement("li");
      li.textContent = o;
      li.onclick = () => goster(o, oyunIndex);
      liste.appendChild(li);
    });

    durum.textContent = `Hazır. (${oyunlar.length} oyun)`;
  } catch (e) {
    if (String(e).includes("AbortError")) {
      durum.textContent = "HATA: Zaman aşımı (8sn). iPad bağlantısı/Google blokladı olabilir.";
    } else {
      durum.textContent = "HATA: Veri alınamadı. (Console’a bak)";
    }
    console.error(e);
  }
}

function goster(oyun, oyunIndex) {
  const filtre = satirlar.filter(r => (r[oyunIndex] || "").trim() === oyun);
  detay.innerHTML =
    `<strong>${oyun}</strong><br><br>` +
    filtre.map(r => r.join(" | ")).join("<br>");
}

ara.oninput = () => {
  const q = ara.value.toLowerCase();
  [...liste.children].forEach(li => {
    li.style.display = li.textContent.toLowerCase().includes(q) ? "" : "none";
  });
};

yenile.onclick = yukle;

yukle();