(function(){
"use strict";
const cfg=window.GOZA_CONFIG||{};
const connected=!!(cfg.supabaseUrl&&/^https:\/\//.test(cfg.supabaseUrl)&&cfg.supabasePublishableKey);
const setup=new URLSearchParams(location.search).has("setup");
const useDemo=!connected;
const style=document.createElement("link");
style.rel="stylesheet";style.href=useDemo?"./demo.css":"./styles.css";
document.head.appendChild(style);
if(setup){document.getElementById("app").innerHTML=`<div class="splash"><h1>Activación de GOZA</h1><p>La base de datos está lista. Por seguridad, la cuenta de propietario se crea desde el panel privado Supabase Authentication.</p><p><a href="https://supabase.com/dashboard/project/cbadexhiekwcxcbivifk/auth/users" target="_blank" rel="noopener noreferrer">Abrir gestión de usuarios en Supabase</a></p><p>Selecciona «Add user» y crea tu usuario con tu correo y una contraseña segura. Después vuelve al chat para vincularlo como administrador.</p><p><a href="./">Volver a GOZA</a></p></div>`;return;}
const script=document.createElement("script");
script.src=useDemo?"./demo.js":"./app.js";
if(!useDemo)script.type="module";
script.onerror=function(){document.getElementById("app").innerHTML="<main style='padding:30px;font:16px system-ui'>No se pudo cargar GOZA. Revisa tu conexión y recarga la página.</main>"};
document.body.appendChild(script);
})();