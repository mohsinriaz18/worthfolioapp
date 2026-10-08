export type ThemePref = "system" | "light" | "dark";
const KEY = "wf-theme";

export function getThemePref(): ThemePref {
  if (typeof window === "undefined") return "system";
  return (localStorage.getItem(KEY) as ThemePref) || "system";
}

export function applyTheme(pref: ThemePref) {
  const light = pref === "light" || (pref === "system" && window.matchMedia("(prefers-color-scheme: light)").matches);
  document.documentElement.classList.toggle("light", light);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", light ? "#f3f7f7" : "#0b1216");
}

export function setThemePref(pref: ThemePref) {
  localStorage.setItem(KEY, pref);
  applyTheme(pref);
}

/** Inline script run before paint to avoid a theme flash. */
export const themeBootScript = `(function(){try{var p=localStorage.getItem('${KEY}')||'system';var l=p==='light'||(p==='system'&&matchMedia('(prefers-color-scheme: light)').matches);if(l)document.documentElement.classList.add('light');}catch(e){}})();`;
