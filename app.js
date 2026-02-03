/***********************
 * CONFIG
 ***********************/
const PUBLISH_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vStIO74mPPf_rhjRa-K8pk4ZCA-lCVAaFGg4ZVnE6DxbEwIGXjpICy8uAIa5hhAmyHq6Psyy-wqHUsL/pubhtml?gid=1233566992&single=true";

/***********************
 * STATE
 ***********************/
let RAW = []; // {game, category, role, person}
let games = [];
let persons = [];

let selectedGame = "";
let selectedPerson = "";

let lastGameTSV = "";
let lastPersonTSV = "";

/***********************
 * HELPERS
 ***********************/
const $ = (sel) => document.querySelector(sel);

function setStatus(msg, isError=false){
  const el = $("#status");
  if(!el) return;
  el.textContent = msg;
  el.classList.toggle("muted", !isError);
  el.style.color = isError ? "#b91c1c" : "";
}

function norm(s){
  return (s||"").toString().trim().toLocaleLowerCase("tr-TR");
}

function escapeHtml(s){
  return (s||"").toString()
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function tsvEscape(v){
  const s = (v ?? "").toString();
  // tab/newline kırma
  return s.replace(/\t/g," ").replace(/\r?\n/g," ");
}

function downloadText(filename, content){
  const blob = new Blob([content], {type:"text/tab-separated-values;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 1500);
}

/***********************
 * PARSE pubhtml TABLE
 ***********************/
async function fetchPubHtmlTable(url){
  const res = await fetch(url, {cache:"no-store"});
  if(!res.ok) throw new Error("Sheet alınamadı (HTTP " + res.status + ")");
  const html = await res.text();

  const doc = new DOMParser().parseFromString(html, "text/html");
  const table = doc.querySelector("table");
  if(!table) throw new Error("pubhtml içinde tablo bulunamadı. 'Webde yayınla' doğru mu?");

  const rows = Array.from(table.querySelectorAll("tr")).map(tr =>
    Array.from(tr.querySelectorAll("td,th")).map(td => td.textContent.trim())
  ).filter(r => r.some(x => x !== ""));

  if(!rows.length) throw new Error("Tablo boş görünüyor.");

  return rows;
}

function findHeaderIndexes(headerRow){
  // beklenen başlıklar:
  // Oyun Adı | Kategori | Görev | Kişi
  const h = headerRow.map(norm);

  const idxGame = h.findIndex(x => x === "oyun adı" || x === "oyunadi" || x.includes("oyun adı") || x === "oyun");
  const idxCat  = h.findIndex(x => x === "kategori" || x.includes("kategori"));
  const idxRole = h.findIndex(x => x === "görev" || x.includes("görev"));
  const idxPer  = h.findIndex(x => x === "kişi" || x.includes("kişi"));

  return {idxGame, idxCat, idxRole, idxPer};
}

function buildRawFromRows(rows){
  // header satırı ilk satır kabul edelim
  const header = rows[0];
  const {idxGame, idxCat, idxRole, idxPer} = findHeaderIndexes(header);

  if(idxGame < 0) throw new Error("Oyun kolonu bulunamadı. Başlık 'Oyun Adı' olmalı.");
  if(idxPer < 0) throw new Error("Kişi kolonu bulunamadı. Başlık 'Kişi' olmalı.");
  if(idxCat < 0) throw new Error("Kategori kolonu bulunamadı. Başlık 'Kategori' olmalı.");
  if(idxRole < 0) throw new Error("Görev kolonu bulunamadı. Başlık 'Görev' olmalı.");

  const out = [];
  for(let i=1;i<rows.length;i++){
    const r = rows[i];
    const game = (r[idxGame]||"").trim();
    const category = (r[idxCat]||"").trim();
    const role = (r[idxRole]||"").trim();
    const person = (r[idxPer]||"").trim();

    // boş satır atla
    if(!game && !person && !category && !role) continue;

    // sheet’in sağ tarafındaki panel (OYUN ÇAKIŞMASI...) gibi satırlarda oyun adı boş olabiliyor
    // bizim ana tablo için oyun adı şart:
    if(!game) continue;

    out.push({game, category, role, person});
  }
  return out;
}

/***********************
 * BUILD LISTS
 ***********************/
function buildGames(){
  const set = new Set();
  RAW.forEach(r => set.add(r.game));
  games = Array.from(set).sort((a,b)=>a.localeCompare(b,"tr"));
}

function buildPersons(){
  const set = new Set();
  RAW.forEach(r => set.add(r.person));
  persons = Array.from(set).sort((a,b)=>a.localeCompare(b,"tr"));
}

/***********************
 * RENDER GAMES
 ***********************/
function renderGameList(filter=""){
  const box = $("#oyunList");
  if(!box) return;

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

  document.querySelectorAll("#oyunList .item").forEach(el=>{
    el.addEventListener("click", ()=>{
      selectGame(el.getAttribute("data-game"));
    });
  });
}

function renderGameDetail(game){
  const box = $("#gameDetail");
  if(!box) return;

  if(!game){
    box.textContent = "Soldan bir oyun seç.";
    $("#btnCopyGame").disabled = true;
    $("#btnTsvGame").disabled = true;
    return;
  }

  const rows = RAW.filter(r => r.game === game);

  lastGameTSV = [
    ["Oyun Adı","Kategori","Görev","Kişi"].join("\t"),
    ...rows.map(r => [r.game, r.category, r.role, r.person].map(tsvEscape).join("\t"))
  ].join("\n");

  $("#btnCopyGame").disabled = false;
  $("#btnTsvGame").disabled = false;

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

function selectGame(game){
  selectedGame = game;
  renderGameList($("#qOyun").value || "");
  renderGameDetail(game);
}

/***********************
 * RENDER PEOPLE
 ***********************/
function renderPersonList(filter=""){
  const box = $("#kisiList");
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
  const box = $("#personDetail");
  if(!box) return;

  if(!person){
    box.textContent = "Soldan bir kişi seç.";
    $("#btnCopyPerson").disabled = true;
    $("#btnTsvPerson").disabled = true;
    return;
  }

  const rows = RAW.filter(r => r.person === person);

  lastPersonTSV = [
    ["Kişi","Oyun Adı","Kategori","Görev"].join("\t"),
    ...rows.map(r => [person, r.game, r.category, r.role].map(tsvEscape).join("\t"))
  ].join("\n");

  $("#btnCopyPerson").disabled = false;
  $("#btnTsvPerson").disabled = false;

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

/***********************
 * TABS
 ***********************/
function setupTabs(){
  document.querySelectorAll(".tab").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      document.querySelectorAll(".tab").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");

      const tab = btn.dataset.tab;
      ["oyunlar","kisiler","grafikler"].forEach(t=>{
        const el = document.querySelector(`#tab-${t}`);
        if(!el) return;
        el.classList.toggle("hidden", t !== tab);
      });
    });
  });
}

/***********************
 * UI SETUP
 ***********************/
function setupUI(){
  setupTabs();

  $("#qOyun")?.addEventListener("input", (e)=> renderGameList(e.target.value || ""));
  $("#qKisi")?.addEventListener("input", (e)=> renderPersonList(e.target.value || ""));

  $("#btnReload")?.addEventListener("click", ()=> loadAll());

  $("#btnCopyGame")?.addEventListener("click", async ()=>{
    if(!lastGameTSV) return;
    try{
      await navigator.clipboard.writeText(lastGameTSV);
      setStatus("Kopyalandı (Excel’e yapıştırabilirsin).");
    }catch{
      setStatus("Kopyalama engellendi (tarayıcı izni).", true);
    }
  });

  $("#btnTsvGame")?.addEventListener("click", ()=>{
    if(!lastGameTSV) return;
    const name = (selectedGame || "oyun").replace(/[^\wığüşöçİĞÜŞÖÇ -]/gi,"").slice(0,80);
    downloadText(`${name}.tsv`, lastGameTSV);
  });

  $("#btnCopyPerson")?.addEventListener("click", async ()=>{
    if(!lastPersonTSV) return;
    try{
      await navigator.clipboard.writeText(lastPersonTSV);
      setStatus("Kopyalandı (Excel’e yapıştırabilirsin).");
    }catch{
      setStatus("Kopyalama engellendi (tarayıcı izni).", true);
    }
  });

  $("#btnTsvPerson")?.addEventListener("click", ()=>{
    if(!lastPersonTSV) return;
    const name = (selectedPerson || "kisi").replace(/[^\wığüşöçİĞÜŞÖÇ -]/gi,"").slice(0,80);
    downloadText(`${name}.tsv`, lastPersonTSV);
  });
}

/***********************
 * LOAD
 ***********************/
async function loadAll(){
  try{
    setStatus("Veri çekiliyor...");
    $("#btnCopyGame").disabled = true;
    $("#btnTsvGame").disabled = true;
    $("#btnCopyPerson").disabled = true;
    $("#btnTsvPerson").disabled = true;

    const rows = await fetchPubHtmlTable(PUBLISH_URL);
    RAW = buildRawFromRows(rows);

    buildGames();
    buildPersons();

    // reset selection if not exists
    if(selectedGame && !games.includes(selectedGame)) selectedGame = "";
    if(selectedPerson && !persons.includes(selectedPerson)) selectedPerson = "";

    renderGameList($("#qOyun").value || "");
    renderGameDetail(selectedGame);

    renderPersonList($("#qKisi").value || "");
    renderPersonDetail(selectedPerson);

    setStatus(`Hazır. (Satır: ${RAW.length})`);
  }catch(err){
    console.error(err);
    setStatus("HATA: " + (err?.message || err), true);
  }
}

/***********************
 * INIT
 ***********************/
function init(){
  setupUI();
  loadAll();
}

document.addEventListener("DOMContentLoaded", init);