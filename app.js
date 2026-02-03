// ==== IDT - Sheets (GViz) + Oyun Detay + Excel Export + Bildirim ====

const SHEET_ID = "1sIzswZnMkyRPJejAsE_ylSKzAF0RmFiACP4jYtz-AE0";
const GID_BUTUN_OYUNLAR = "1233566992";

const NOTIF_KEY = "idt_notifs_v1";
const HASH_KEY = "idt_sheet_hash_v1";

const el = (id) => document.getElementById(id);
const norm = (s) => String(s ?? "").trim();

function setStatus(msg){ const s=el("status"); if(s) s.textContent = msg; }

async function fetchGvizTable(sheetId, gid) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&gid=${gid}`;
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("GViz JSON parse edilemedi.");

  const json = JSON.parse(text.slice(start, end + 1));
  const table = json.table;

  const cols = (table.cols || []).map(c => (c.label || "").trim());
  const rows = (table.rows || []).map(r => (r.c || []).map(cell => cell ? (cell.v ?? "") : ""));

  return { cols, rows };
}

function findColIndex(cols, patterns){
  const low = cols.map(c => c.toLocaleLowerCase("tr-TR"));
  for(const p of patterns){
    const pi = low.findIndex(c => c.includes(p));
    if(pi !== -1) return pi;
  }
  return -1;
}

function uniq(arr){
  return [...new Set(arr.map(x => norm(x)).filter(Boolean))];
}

// basit hash (satırlar için)
function hashRows(rows){
  // ilk 800 satırı, ilk 10 hücreyi baz al (performans)
  const sample = rows.slice(0, 800).map(r => r.slice(0, 10).join("|")).join("\n");
  let h = 2166136261;
  for(let i=0;i<sample.length;i++){
    h ^= sample.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

function pushNotif(title, msg){
  const arr = JSON.parse(localStorage.getItem(NOTIF_KEY) || "[]");
  arr.unshift({ t: Date.now(), title, msg });
  localStorage.setItem(NOTIF_KEY, JSON.stringify(arr.slice(0, 30)));

  const badge = el("notifBadge");
  if(badge){
    badge.textContent = String(arr.length);
    badge.classList.remove("hidden");
  }
}

function renderNotifs(){
  const box = el("notifList");
  if(!box) return;
  const arr = JSON.parse(localStorage.getItem(NOTIF_KEY) || "[]");
  if(!arr.length){
    box.innerHTML = `<div class="notifItem">Henüz bildirim yok.</div>`;
    return;
  }
  box.innerHTML = arr.map(n => {
    const when = new Date(n.t).toLocaleString("tr-TR");
    return `<div class="notifItem"><b>${escapeHtml(n.title)}</b><div>${escapeHtml(n.msg)}</div><div style="opacity:.65;font-size:12px;margin-top:4px">${when}</div></div>`;
  }).join("");
}

function escapeHtml(s){
  return String(s ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function downloadTSV(filename, headers, rows){
  const bom = "\ufeff";
  const esc = (v) => String(v ?? "").replace(/\r?\n/g, " ").replace(/\t/g, " ");
  const tsv = [headers.map(esc).join("\t"), ...rows.map(r => r.map(esc).join("\t"))].join("\n");
  const blob = new Blob([bom + tsv], { type: "text/tab-separated-values;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

let DATA = null; // { cols, rows, idxOyun, idxKisi, idxGorev, idxKategori }

function renderOyunlar(oyunlar){
  const ul = el("oyunList");
  if(!ul) return;
  ul.innerHTML = "";
  oyunlar.forEach(name => {
    const li = document.createElement("li");
    li.style.cursor = "pointer";
    li.style.padding = "8px 6px";
    li.style.borderBottom = "1px solid #eee";
    li.textContent = name;
    li.addEventListener("click", () => openGame(name, true));
    ul.appendChild(li);
  });
}

function openGame(gameName, pushState){
  if(!DATA) return;

  const { cols, rows, idxOyun, idxKisi, idxGorev, idxKategori } = DATA;

  const filtered = rows.filter(r => norm(r[idxOyun]) === gameName);

  const detailTitle = el("detailTitle");
  const detailBody = el("detailBody");
  if(detailTitle) detailTitle.textContent = gameName;

  const lines = filtered.map(r => {
    const kisi = norm(r[idxKisi]);
    const gorev = idxGorev >= 0 ? norm(r[idxGorev]) : "";
    const kat = idxKategori >= 0 ? norm(r[idxKategori]) : "";
    return { kisi, gorev, kat };
  }).filter(x => x.kisi);

  // Görsel liste
  const html = lines.length
    ? `<div><b>${lines.length}</b> kayıt</div>` +
      `<ul style="margin-top:10px;padding-left:18px">` +
      lines.map(x => `<li><b>${escapeHtml(x.kisi)}</b>${x.gorev ? ` — ${escapeHtml(x.gorev)}` : ""}${x.kat ? ` <span style="opacity:.7">(${escapeHtml(x.kat)})</span>` : ""}</li>`).join("") +
      `</ul>`
    : `<div>Bu oyun için veri bulunamadı.</div>`;

  if(detailBody) detailBody.innerHTML = html;

  // mobil/geri
  const backBtn = el("btnBack");
  if(backBtn) backBtn.classList.remove("hidden");

  if(pushState){
    history.pushState({ view:"game", game: gameName }, "", `#game=${encodeURIComponent(gameName)}`);
  }
}

function closeGame(){
  const detailTitle = el("detailTitle");
  const detailBody = el("detailBody");
  if(detailTitle) detailTitle.textContent = "Detay";
  if(detailBody) detailBody.textContent = "Soldan bir oyun seç.";

  const backBtn = el("btnBack");
  if(backBtn) backBtn.classList.add("hidden");
}

function buildFiguranRows(){
  // Figüran kriteri: görev/kategori içinde "figüran" veya "kurumdan emekli"
  const { cols, rows, idxKisi, idxGorev, idxKategori } = DATA;

  const fig = rows.filter(r => {
    const gorev = (idxGorev >= 0 ? norm(r[idxGorev]) : "").toLocaleLowerCase("tr-TR");
    const kat = (idxKategori >= 0 ? norm(r[idxKategori]) : "").toLocaleLowerCase("tr-TR");
    return gorev.includes("figüran") || gorev.includes("figuran") || kat.includes("figüran") || kat.includes("figuran") || gorev.includes("kurumdan emekl") || kat.includes("kurumdan emekl");
  });

  return { headers: cols, rows: fig };
}

async function loadAndRender(){
  setStatus("Veri çekiliyor...");

  const { cols, rows } = await fetchGvizTable(SHEET_ID, GID_BUTUN_OYUNLAR);

  // Header’dan akıllı kolon bulma
  const idxOyun = findColIndex(cols, ["oyun", "oyun adı", "play"]);
  const idxKisi = findColIndex(cols, ["kişi", "isim", "ad soyad", "personel"]);
  const idxGorev = findColIndex(cols, ["görev", "rol", "role"]);
  const idxKategori = findColIndex(cols, ["kategori", "category"]);

  if(idxOyun < 0) throw new Error("Oyun kolonu bulunamadı. Sheet başlığında 'Oyun' geçen bir sütun olmalı.");
  if(idxKisi < 0) throw new Error("Kişi/İsim kolonu bulunamadı. Sheet başlığında 'Kişi/İsim/Ad Soyad' geçen bir sütun olmalı.");

  DATA = { cols, rows, idxOyun, idxKisi, idxGorev, idxKategori };

  // Bildirim: değişiklik var mı?
  const newHash = hashRows(rows);
  const oldHash = localStorage.getItem(HASH_KEY);
  if(oldHash && oldHash !== newHash){
    pushNotif("Sheet güncellendi", "Satır eklendi/değişti. Yenile ile güncel listeye baktın.");
  }
  localStorage.setItem(HASH_KEY, newHash);

  const oyunlar = uniq(rows.map(r => r[idxOyun]));
  renderOyunlar(oyunlar);

  // badge sayısı
  const arr = JSON.parse(localStorage.getItem(NOTIF_KEY) || "[]");
  const badge = el("notifBadge");
  if(badge){
    if(arr.length){
      badge.textContent = String(arr.length);
      badge.classList.remove("hidden");
    } else badge.classList.add("hidden");
  }

  setStatus(`Hazır. Oyun: ${oyunlar.length}`);
}

function bindUI(){
  const backBtn = el("btnBack");
  if(backBtn){
    backBtn.addEventListener("click", () => history.back());
  }

  window.addEventListener("popstate", () => {
    const hash = location.hash || "";
    if(hash.startsWith("#game=")){
      const name = decodeURIComponent(hash.replace("#game=", ""));
      openGame(name, false);
    } else {
      closeGame();
    }
  });

  const bell = el("btnBell");
  const modal = el("notifModal");
  const close = el("btnCloseNotif");
  if(bell && modal){
    bell.addEventListener("click", () => {
      renderNotifs();
      modal.classList.remove("hidden");
    });
  }
  if(close && modal){
    close.addEventListener("click", () => modal.classList.add("hidden"));
  }

  const btnFig = el("btnFiguranExcel");
  if(btnFig){
    btnFig.addEventListener("click", () => {
      if(!DATA) return;
      const { headers, rows } = buildFiguranRows();
      downloadTSV("figuranlar.xls", headers, rows); // Excel açar
    });
  }

  const btnAll = el("btnAllExcel");
  if(btnAll){
    btnAll.addEventListener("click", () => {
      if(!DATA) return;
      downloadTSV("tum_personel.xls", DATA.cols, DATA.rows);
    });
  }
}

async function init(){
  try{
    bindUI();
    await loadAndRender();

    // url hash ile direkt oyun açma
    if(location.hash.startsWith("#game=")){
      const name = decodeURIComponent(location.hash.replace("#game=", ""));
      openGame(name, false);
    }
  }catch(err){
    console.error(err);
    setStatus("HATA: " + (err?.message || err));
  }
}

document.addEventListener("DOMContentLoaded", init);
