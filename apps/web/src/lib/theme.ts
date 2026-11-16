export const THEME_STORAGE_KEY = "kouland_theme";

/** Runs before first paint (see app/layout.tsx): dark is the default, only a saved "light" opts out. */
export const THEME_INIT_SCRIPT = `try{if(localStorage.getItem("${THEME_STORAGE_KEY}")==="light")document.documentElement.classList.remove("dark")}catch(e){}`;
