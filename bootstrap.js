(function(){
"use strict";
const cfg=window.GOZA_CONFIG||{};
const connected=!!(cfg.supabaseUrl&&/^https:\/\//.test(cfg.supabaseUrl)&&cfg.supabasePublishableKey);
const setup=new URLSearchParams(location.search).has("setup");
const useDemo=!connected;
const style=document.createElement("link");
style.rel="stylesheet";style.href=useDemo?"./demo.css":"./styles.css";
document.head.appendChild(style);
if(!useDemo){const extra=document.createElement('link');extra.rel='stylesheet';extra.href='./attendance.css?v=20261027-v3';document.head.appendChild(extra);const brand=document.createElement('link');brand.rel='stylesheet';brand.href='./goza-brand.css?v=20261027-v4';document.head.appendChild(brand);}
if(setup){location.replace("./activate.html");return;}
const script=document.createElement("script");
script.src=useDemo?"./demo.js":"./app.js?v=20261027-manager-v4";
if(!useDemo)script.type="module";
script.onerror=function(){document.getElementById("app").innerHTML="<main style='padding:30px;font:16px system-ui'>No se pudo cargar GOZA. Revisa tu conexión y recarga la página.</main>"};
document.body.appendChild(script);
})();