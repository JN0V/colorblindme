/**
 * The front door.
 *
 * One job beyond showing two links: a shared profile must never land here.
 * The whole product is someone opening `…/#p=CBM1-D5-P2`, and making them
 * read a home page first — or worse, pick a door — would waste the one
 * moment the link had their attention. A profile in the fragment goes
 * straight through to the viewer, fragment intact.
 */
import { fromHash } from "../core/profile.js";
import * as i18n from "../i18n/i18n.js";

if (fromHash()) {
  location.replace("view.html" + location.search + location.hash);
} else {
  (async () => {
    await i18n.load(i18n.negotiate());
    const picker = document.querySelector("#lang");
    picker.innerHTML = Object.entries(i18n.LOCALES)
      .map(([code, meta]) => `<option value="${code}">${meta.name}</option>`).join("");
    picker.value = i18n.activeLocale();
    picker.addEventListener("change", async e => {
      await i18n.setLocale(e.target.value);
      paint();
    });
    paint();
  })();
}
function paint() {
  i18n.apply();
  document.documentElement.lang = i18n.activeLocale();
  document.documentElement.dir = i18n.localeDir();
  document.querySelector("#unreviewed").hidden = i18n.isReviewed();
}
