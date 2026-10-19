var toggle = document.querySelector(".menu-toggle");
var menu = document.querySelector("#site-menu");

if (toggle && menu) {
  toggle.addEventListener("click", function () {
    var open = menu.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });
}

var form = document.querySelector("#contact-form");
if (form) {
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var data = new FormData(form);
    var body = "Name: " + data.get("name") + "\nEmail: " + data.get("email") + "\n\n" + data.get("message");
    window.location.href = "mailto:jgriffith3433@gmail.com?subject=" + encodeURIComponent("Yooba Land") + "&body=" + encodeURIComponent(body);
  });
}

// Hawkes Analytics (loaded in each page's <head>): a play_click for every Play button, with where it was pressed.
// The SDK counts page views and outbound links by itself; the page leaving sends the click with them.
document.addEventListener("click", function (event) {
  var link = event.target && event.target.closest && event.target.closest('a[href="/Game/"]');
  if (!link) return;
  var where = link.closest(".site-footer") ? "footer" : link.classList.contains("play-large") ? "hero" : "header";
  var props = { where: where };
  var analytics = window.hawkesAnalytics;
  if (analytics && analytics.track) analytics.track("play_click", props);
  else (window.hawkesAnalyticsQ = window.hawkesAnalyticsQ || []).push(["track", "play_click", props]);
});
