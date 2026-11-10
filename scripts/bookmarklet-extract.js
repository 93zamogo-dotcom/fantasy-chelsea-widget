// Fallback: open Fantasy Prediction Matchday in the browser, then paste into DevTools console.
// Copies a JSON payload {tour, data} you can save and feed to:
//   python scraper/fetch_chelsea.py --from-file tour.json
(async () => {
  function run(name, ...args) {
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler(resolve)
        .withFailureHandler((e) => reject(e && e.message ? e : String(e)))[name](...args);
    });
  }
  const tours = await run("getTours");
  const tour = parseInt(tours[tours.length - 1], 10);
  const data = await run("getTourData", tour);
  const payload = { tour, data };
  const text = JSON.stringify(payload);
  try {
    await navigator.clipboard.writeText(text);
    alert("Tour " + tour + " copied to clipboard (" + text.length + " chars)");
  } catch (e) {
    console.log(payload);
    alert("Tour " + tour + " logged to console (clipboard blocked)");
  }
})();
