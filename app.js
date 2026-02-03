function showTab(id, event) {
  document.querySelectorAll(".box").forEach(box => {
    box.classList.add("hidden");
  });

  document.getElementById(id).classList.remove("hidden");

  document.querySelectorAll("nav button").forEach(btn => {
    btn.classList.remove("active");
  });

  event.target.classList.add("active");
}

console.log("app.js yüklendi ✔");
