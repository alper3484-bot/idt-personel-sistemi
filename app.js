/***************
 * CONFIG
 ***************/
const SPREADSHEET_ID = "1sIzswZnMkyRPJejAsE_ylSKzAF0RmFiACP4jYtz-AE0";
const GID_BUTUN_OYUNLAR = 1233566992; // "BÜTÜN OYUNLAR"

/***************
 * HELPERS
 ***************/
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function norm(s){
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("ı","i")
    .replaceAll("İ","i");
}

function setStatus(msg){ $("#status").textContent = msg; }

function tsvEscape(v){
  const s = String(v ?? "");
  return s.replace(/\r?\n/g, " ").replace(/\t/g, " ");
}

function downloadText(filename, text){
  const blob = new Blob(["\ufeff" + text], {type:"text/tab-separated-values;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href), 2000);
}

/***************
 * NOTIFICATIONS
 ***************/
const NOTIF_KEY = "idt_notifs_v1";
const HASH_KEY  = "idt_hash_v1";

function pushNotif(title, msg){
  const arr = JSON.parse(localStorage.getItem(NOTIF_KEY) || "[]");
  arr.unshift({t:Date.now(), title, msg});
  localStorage.setItem(NOTIF_KEY, JSON.stringify(arr.slice(0,50)));
  renderNotifs();
}

function renderNotifs(){
  const box = $("#notifList");
  const arr = JSON.parse(localStorage.getItem(NOTIF_KEY) || "[]");
  const badge = $("#notifBadge");
  if(arr.length){
    badge.textContent = String(arr.length);
    badge.classList.remove("hidden");
  }else{
    badge.classList.add("hidden");
  }

  if(!box) return;
  if(!arr.length){
    box.innerHTML = `<div class="muted">Henüz bildirim yok.</div>`;
    return;
  }

  box.innerHTML = arr.map(n=>{
    const when = new Date(n.t).toLocaleString("tr-TR");
    return `
      <div class="notif">
        <div class="notifTitle">${escapeHtml(n.title)}</div>
        <div>${escapeHtml(n.msg)}</div>
        <div class="notifMeta">${when}</div>
      </div>
    `;
  }).join("");
}

function escapeHtml(s){
  return String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));
}

function openNotifs(){ $("#notifModal").classList.remove("hidden"); renderNotifs(); }
function closeNotifs(){ $("#notifModal").classList.add("hidden"); }
function clearNotifs(){
  localStorage.removeItem(NOTIF_KEY);
  renderNotifs();
}

/***************
 * DATA FETCH (GViz)
 ***************/
async function fetchGVizRows(gid){
  // GViz endpoint (CORS sıkıntısı yaşamadan text alıp parse ediyoruz)
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?gid=${gid}&tqx=out:json`;
  const res = await fetch(url, {cache:"no-store"});
  if(!res.ok) throw new Error(`Sheet erişilemedi (HTTP ${res.status})`);
  const txt = await res.text();

  // google.visualization.Query.setResponse({...});
  const m = txt.match(/setResponse\(([\s\S]*?)\);\s*$/);
  if(!m) throw new Error("GViz cevap formatı değişmiş görünüyor.");
  const data = JSON.parse(m[1]);

  const table = data.table;
  const cols = (table.cols || []).map(c => c.label || "");
  const rows = (table.rows || []).map(r => (r.c || []).map(cell => (cell && cell.v != null) ? cell.v : ""));

  // Bazı sheetlerde ilk satır header gibi gelebilir; biz zaten "label" var, ama label boşsa ilk satırı header kabul edelim.
  const hasLabels = cols.some(c => String(c).trim() !== "");
  if(hasLabels) return { headers: cols, rows };

  // label yoksa ilk satır header say
  const headers = rows[0] || [];
  const body = rows.slice(1);
  return { headers, rows: body };
}

/***************
 * APP STATE
 ***************/
let RAW = [];         // full rows
let games = [];       // unique game names
let selectedGame = "";
let lastTSV = "";     // selected export
let lastRows = [];    // selected rows

function findHeaderIndex(headers, want){
  const w = norm(want);
  let i = headers.findIndex(h => norm(h) === w);
  if(i >= 0) return i;

  // tolerans: contains
  i = headers.findIndex(h => norm(h).includes(w));
  return i;
}

function makeHash(headers, rows){
  // basit hash/signature (değişiklik algılama için)
  const s = JSON.stringify([headers, rows.slice(0,2000)]);
  let h = 0;
  for(let i=0;i<s.length;i++){
    h = (h*31 + s.charCodeAt(i)) >>> 0;
  }
  return String(h);
}

/***************
 * RENDER
 ***************/
function renderGameList(filter=""){
  const box = $("#oyunList");
  const f = norm(filter);
  const list = games.filter(g => norm(g).includes(f));

  if(!list.length){
    box.innerHTML = `<div class="muted">Sonuç yok.</div>`;
    return;
  }

  box.innerHTML = list.map(g => `
    <div class="item ${g===selectedGame?"active":""}" data-game="${escapeHtml(g)}">
      ${escapeHtml(g)}
    </div>
  `).join("");

  $$("#oyunList .item").forEach(el=>{
    el.addEventListener("click", ()=>{
      selectGame(el.getAttribute("data-game"));
    });
  });
}

function renderDetail(game){
  const box = $("#detail");
  if(!game){
    box.textContent = "Soldan bir oyun seç.";
    $("#btnCopy").disabled = true;
    $("#btnTsv").disabled = true;
    return;
  }

  const rows = RAW.filter(r => r.game === game);
  lastRows = rows;

  const tsv = [
    ["Oyun Adı","Kategori","Görev","Kişi"].join("\t"),
    ...rows.map(r => [r.game,r.category,r.role,r.person].map(tsvEscape).join("\t"))
  ].join("\n");
  lastTSV = tsv;

  $("#btnCopy").disabled = false;
  $("#btnTsv").disabled = false;

  box.innerHTML = `
    <div class="muted">${escapeHtml(game)} — ${rows.length} satır</div>
    <table class="table">
      <thead>
        <tr><th>Kategori</th><th>Görev</th><th>Kişi</th></tr>
      </thead>
      <tbody>
        ${rows.map(r=>`
          <tr>
            <td>${escapeHtml(r.category)}</td>
            <td>${escapeHtml(r.role)}</td>
            <td>${escapeHtml(r.person)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

/***************
 * MOBILE NAV (Back)
 ***************/
function updateMobileUI(){
  const isMobile = window.matchMedia("(max-width: 980px)").matches;
  const btnBack = $("#btnBack");
  if(!isMobile){
    btnBack.classList.add("hidden");
    $("#leftPane").classList.remove("hidden");
    return;
  }

  if(selectedGame){
    btnBack.classList.remove("hidden");
    $("#leftPane").classList.add("hidden"); // oyuna girince list hide
  }else{
    btnBack.classList.add("hidden");
    $("#leftPane").classList.remove("hidden");
  }
}

function selectGame(game){
  selectedGame = game;
  renderGameList($("#qOyun").value || "");
  renderDetail(game);

  // history state
  history.pushState({game}, "", location.pathname + "#oyun=" + encodeURIComponent(game));
  updateMobileUI();
}

/***************
 * LOAD + PARSE
 ***************/
async function loadAll(){
  setStatus("Veri çekiliyor...");
  try{
    const {headers, rows} = await fetchGVizRows(GID_BUTUN_OYUNLAR);

    // Header eşleştirme (Senin sheette A1: Oyun Adı)
    const iGame = findHeaderIndex(headers, "Oyun Adı");
    const iCat  = findHeaderIndex(headers, "Kategori");
    const iRole = findHeaderIndex(headers, "Görev");
    const iPer  = findHeaderIndex(headers, "Kişi");

    if(iGame < 0){
      throw new Error(`Oyun kolonu bulunamadı. Başlık 'Oyun Adı' olmalı. (Mevcut başlıklar: ${headers.filter(Boolean).join(", ")})`);
    }
    if(iPer < 0){
      throw new Error(`Kişi kolonu bulunamadı. Başlık 'Kişi' olmalı.`);
    }

    // Normalize rows -> objects
    RAW = rows
      .map(r => ({
        game: String(r[iGame] ?? "").trim(),
        category: String(r[iCat] ?? "").trim(),
        role: String(r[iRole] ?? "").trim(),
        person: String(r[iPer] ?? "").trim(),
      }))
      .filter(x => x.game && x.person);

    // oyun listesi
    const set = new Set();
    RAW.forEach(x => set.add(x.game));
    games = Array.from(set).sort((a,b)=>a.localeCompare(b,"tr"));

    // change detection
    const h = makeHash(headers, rows);
    const prev = localStorage.getItem(HASH_KEY);
    if(prev && prev !== h){
      pushNotif("Sheet değişti", "BÜTÜN OYUNLAR sayfasında yeni satır/değişiklik algılandı.");
    }
    localStorage.setItem(HASH_KEY, h);

    renderGameList($("#qOyun").value || "");
    renderDetail(selectedGame);
    setStatus(`Yüklendi. Oyun: ${games.length} — Satır: ${RAW.length}`);

  }catch(e){
    console.error(e);
    setStatus("Hata!");
    $("#oyunList").innerHTML = `<div class="muted">Sonuç yok.</div>`;
    $("#detail").textContent = "";
    $("#detail").insertAdjacentHTML("afterbegin", `<div class="muted">HATA: ${e.message}</div>`);
  }
}

/***************
 * TABS
 ***************/
function setupTabs(){
  $$(".tab").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      $$(".tab").forEach(x=>x.classList.remove("active"));
      btn.classList.add("active");

      const id = btn.dataset.tab;
      $$(".panel").forEach(p=>p.classList.add("hidden"));
      $("#"+id).classList.remove("hidden");
    });
  });
}

/***************
 * INIT
 ***************/
function init(){
  setupTabs();
  renderNotifs();

  $("#btnReload").addEventListener("click", loadAll);

  $("#qOyun").addEventListener("input", (e)=>{
    renderGameList(e.target.value || "");
  });

  $("#btnCopy").addEventListener("click", async ()=>{
    if(!lastTSV) return;
    try{
      await navigator.clipboard.writeText(lastTSV);
      setStatus("Kopyalandı (Excel’e yapıştırabilirsin).");
    }catch{
      setStatus("Kopyalama engellendi. (Tarayıcı izin vermedi)");
    }
  });

  $("#btnTsv").addEventListener("click", ()=>{
    if(!lastTSV) return;
    const name = (selectedGame ? selectedGame : "butun_oyunlar").replace(/[^\wığüşöçİĞÜŞÖÇ -]/gi,"").slice(0,80);
    downloadText(`${name}.tsv`, lastTSV);
  });

  // notifications
  $("#btnNotifs").addEventListener("click", openNotifs);
  $("#btnCloseNotifs").addEventListener("click", closeNotifs);
  $("#btnClearNotifs").addEventListener("click", clearNotifs);
  $("#notifModal").addEventListener("click", (e)=>{
    if(e.target.id === "notifModal") closeNotifs();
  });

  // mobile back
  $("#btnBack").addEventListener("click", ()=>{
    history.back();
  });

  window.addEventListener("popstate", ()=>{
    // geri gelince oyunu kapat
    const hash = location.hash || "";
    const m = hash.match(/#oyun=(.*)$/);
    if(m){
      const g = decodeURIComponent(m[1]);
      selectedGame = g;
      renderGameList($("#qOyun").value || "");
      renderDetail(g);
    }else{
      selectedGame = "";
      renderGameList($("#qOyun").value || "");
      renderDetail("");
    }
    updateMobileUI();
  });

  window.addEventListener("resize", updateMobileUI);

  // load on start
  loadAll().then(()=>{
    // hash ile direkt oyun açma
    const m = (location.hash||"").match(/#oyun=(.*)$/);
    if(m){
      const g = decodeURIComponent(m[1]);
      if(g) selectGame(g);
    }
    updateMobileUI();
  });
}

document.addEventListener("DOMContentLoaded", init);
/***************
 * PEOPLE TAB
 ***************/
let persons = [];
let selectedPerson = "";
let lastPersonTSV = "";

function buildPersons(){
  const set = new Set();
  RAW.forEach(r => set.add(r.person));
  persons = Array.from(set).sort((a,b)=>a.localeCompare(b,"tr"));
}

function renderPersonList(filter=""){
  const box = document.querySelector("#kisiList");
  if(!box) return;

  const f = norm(filter);
  const list = persons.filter(p => norm(p).includes(f));

  if(!list.length){
    box.innerHTML = `<div class="muted">Sonuç yok.</div>`;
    return;
  }

  box.innerHTML = list.map(p => `
    <div class="item ${p===selectedPerson?"active":""}" data-person="${escapeHtml(p)}">
      ${escapeHtml(p)}
    </div>
  `).join("");

  document.querySelectorAll("#kisiList .item").forEach(el=>{
    el.addEventListener("click", ()=>{
      selectPerson(el.getAttribute("data-person"));
    });
  });
}

function renderPersonDetail(person){
  const box = document.querySelector("#personDetail");
  if(!box) return;

  if(!person){
    box.textContent = "Soldan bir kişi seç.";
    $("#btnCopyPerson").disabled = true;
    $("#btnTsvPerson").disabled = true;
    return;
  }

  const rows = RAW.filter(r => r.person === person);

  // TSV
  lastPersonTSV = [
    ["Kişi","Oyun Adı","Kategori","Görev"].join("\t"),
    ...rows.map(r => [person, r.game, r.category, r.role].map(tsvEscape).join("\t"))
  ].join("\n");

  $("#btnCopyPerson").disabled = false;
  $("#btnTsvPerson").disabled = false;

  // Oyunlara göre grupla
  const byGame = new Map();
  rows.forEach(r=>{
    if(!byGame.has(r.game)) byGame.set(r.game, []);
    byGame.get(r.game).push(r);
  });

  const gamesHtml = Array.from(byGame.entries())
    .sort((a,b)=>a[0].localeCompare(b[0],"tr"))
    .map(([g, arr]) => `
      <div style="margin-top:14px;">
        <div class="cardTitle" style="margin:0 0 6px;">${escapeHtml(g)}</div>
        <table class="table">
          <thead><tr><th>Kategori</th><th>Görev</th></tr></thead>
          <tbody>
            ${arr.map(r=>`
              <tr>
                <td>${escapeHtml(r.category)}</td>
                <td>${escapeHtml(r.role)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `).join("");

  box.innerHTML = `
    <div class="muted">${escapeHtml(person)} — ${rows.length} satır</div>
    ${gamesHtml}
  `;
}

function selectPerson(person){
  selectedPerson = person;
  renderPersonList($("#qKisi").value || "");
  renderPersonDetail(person);
}

function setupPeopleUI(){
  const q = document.querySelector("#qKisi");
  if(q){
    q.addEventListener("input", (e)=> renderPersonList(e.target.value || ""));
  }

  const btnCopy = document.querySelector("#btnCopyPerson");
  if(btnCopy){
    btnCopy.addEventListener("click", async ()=>{
      if(!lastPersonTSV) return;
      try{
        await navigator.clipboard.writeText(lastPersonTSV);
        setStatus("Kopyalandı (Excel’e yapıştırabilirsin).");
      }catch{
        setStatus("Kopyalama engellendi. (Tarayıcı izin vermedi)");
      }
    });
  }

  const btnTsv = document.querySelector("#btnTsvPerson");
  if(btnTsv){
    btnTsv.addEventListener("click", ()=>{
      if(!lastPersonTSV) return;
      const name = (selectedPerson || "kisi").replace(/[^\wığüşöçİĞÜŞÖÇ -]/gi,"").slice(0,80);
      downloadText(`${name}.tsv`, lastPersonTSV);
    });
  }
}
