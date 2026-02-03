const CSV_URL =
  "https://docs.google.com/spreadsheets/d/1sIzswZnMkyRPJjASe_yISkZAf0RmFIACP4jYtz-AE0/gviz/tq?tqx=out:csv&gid=1233566992";

const durum = document.getElementById("durum");
const liste = document.getElementById("oyunlar");
const detay = document.getElementById("detay");
const yenile = document.getElementById("yenile");
const ara = document.getElementById("ara");

let satirlar = [];

function csvParse(text) {
  return text
    .trim()
    .split("\n")
    .map(r => r.split(",").map(c => c.replace(/^"|"$/g, "")));
}

async function yukle() {
  durum.textContent = "Veri çekiliyor...";
  liste.innerHTML = "";
  detay.textContent = "Soldan bir oyun seç.";

  try {
    const res = await fetch(CSV_URL);
    const text = await res.text();
    const data = csvParse(text);

    const baslik = data[0];
    const oyunIndex = baslik.indexOf("Oyun Adı");

    if (oyunIndex === -1) {
      durum.textContent = "HATA: 'Oyun Adı' sütunu bulunamadı.";
      return;
    }

    satirlar = data.slice(1);
    const oyunlar = [...new Set(satirlar.map(r => r[oyunIndex]))];

    oyunlar.forEach(o => {
      const li = document.createElement("li");
      li.textContent = o;
      li.onclick = () => goster(o);
      liste.appendChild(li);
    });

    durum.textContent = "Hazır.";
  } catch (e) {
    durum.textContent = "Veri alınamadı.";
    console.error(e);
  }
}

function goster(oyun) {
  const filtre = satirlar.filter(r => r.includes(oyun));
  detay.innerHTML = "<strong>" + oyun + "</strong><br><br>" +
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