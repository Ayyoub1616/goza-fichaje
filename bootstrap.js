(function(){
"use strict";
const cfg=window.GOZA_CONFIG||{};
const active=!!(cfg.supabaseUrl&&/^https:\/\//.test(cfg.supabaseUrl)&&cfg.supabasePublishableKey);
const setting=active&&new URLSearchParams(location.search).has("setup");
const demo=!setting&&(!active||new URLSearchParams(location.search).has("demo"));
const style=document.createElement("link");
style.rel="stylesheet";style.href=demo?"./demo.css":"./styles.css";
document.head.appendChild(style);
const script=document.createElement("script");
script.src=setting?"./setup.js":demo?"./demo.js":"./app.js";
if(!demo&&!setting)script.type="module";
script.onerror=function(){document.getElementById("app").innerHTML="<main style='padding:30px;font:16px system-ui'>No se pudo cargar la aplicación. Revisa la conexión y recarga la página.</main>"};
document.body.appendChild(script);
})();