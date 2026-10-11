export const THEME_KEY = "dd-theme";

/** Runs in <head> before first paint so the saved theme never flashes. */
export const themeScript = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}})();`;
