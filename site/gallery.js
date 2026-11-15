// Gallery lightbox: tap a screenshot to see it large; arrows, Escape and a tap outside close or move it.
// Devlog strip: shows the 3 newest releases from releases.json (one fetch on page open; the HTML holds the same 3 as a fallback).
(function () {
  var shots = Array.prototype.slice.call(document.querySelectorAll("[data-lightbox]"));
  var box = null, img, cap, at = 0;

  function build() {
    box = document.createElement("div");
    box.className = "lightbox";
    box.hidden = true;
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-label", "Screenshot");
    box.innerHTML = '<button type="button" class="lb-close" aria-label="Close">×</button><button type="button" class="lb-prev" aria-label="Previous">‹</button><img alt=""><p></p><button type="button" class="lb-next" aria-label="Next">›</button>';
    img = box.querySelector("img");
    cap = box.querySelector("p");
    box.addEventListener("click", function (e) {
      if (e.target.classList.contains("lb-prev")) show(at - 1);
      else if (e.target.classList.contains("lb-next")) show(at + 1);
      else close();
    });
    document.body.appendChild(box);
  }
  function show(i) {
    at = (i + shots.length) % shots.length;
    var b = shots[at];
    img.src = b.getAttribute("data-full");
    img.alt = b.querySelector("img").alt;
    cap.textContent = b.getAttribute("data-caption") || "";
    box.hidden = false;
    box.querySelector(".lb-close").focus();
    document.body.style.overflow = "hidden";
  }
  function close() {
    box.hidden = true;
    document.body.style.overflow = "";
    shots[at].focus();
  }
  shots.forEach(function (b, i) {
    b.addEventListener("click", function () { if (!box) build(); show(i); });
  });
  document.addEventListener("keydown", function (e) {
    if (!box || box.hidden) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowLeft") show(at - 1);
    else if (e.key === "ArrowRight") show(at + 1);
  });

  var list = document.querySelector("[data-devlog]");
  if (list && window.fetch) {
    fetch("./releases.json").then(function (r) { return r.json(); }).then(function (data) {
      var rel = (data.releases || []).slice(0, 3);
      if (rel.length < 3) return;
      list.textContent = "";
      rel.forEach(function (r) {
        var li = document.createElement("li"), t = document.createElement("time"), h = document.createElement("h3"), p = document.createElement("p");
        t.setAttribute("datetime", r.date);
        t.textContent = new Date(r.date + "T12:00:00").toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
        h.textContent = r.version;
        p.textContent = (r.notes || []).join(" ");
        li.appendChild(t); li.appendChild(h); li.appendChild(p);
        list.appendChild(li);
      });
    }).catch(function () {});
  }
})();
