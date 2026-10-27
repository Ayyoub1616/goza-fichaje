(function(){
"use strict";
const cfg=window.GOZA_CONFIG||{},app=document.getElementById("app");
const root='<div class="brand"><span class="brand-icon">G</span><span class="brand-text"><b>GOZA<span>·</span></b><small>TACOS FRANCESES</small></span></div>';
app.innerHTML='<div style="min-height:100vh;background:#faf8f2;padding:28px 15px">'+
 '<div style="max-width:560px;margin:20px auto 0">'+root+'<section class="card" style="margin-top:28px;padding:30px">'+
 '<div class="eyebrow">ACTIVACIÓN PRIVADA · SOLO UNA VEZ</div><h1 style="margin:10px 0 16px">Crea tu cuenta de administrador<span class="accent">.</span></h1>'+
 '<p>Este paso vincula GOZA a tu cuenta. Elige un correo tuyo y una contraseña segura que solo tú conozcas.</p>'+
 '<form id="setupForm"><label>Nombre del responsable<input type="text" name="name" autocomplete="name" required maxlength="100" minlength="2" placeholder="Nombre y apellidos"></label>'+
 '<label>Correo electrónico del administrador<input type="email" name="email" required autocomplete="email" placeholder="tucorreo@dominio.es"></label>'+
 '<label>Contraseña nueva (mínimo 14 caracteres)<input type="password" name="password" required minlength="14" maxlength="128" autocomplete="new-password" placeholder="Combina letras y números"></label>'+
 '<label>Repetir contraseña<input type="password" name="repeat" required minlength="14" autocomplete="new-password"></label>'+
 '<label>Código privado de activación<input type="text" name="code" required autocomplete="off" maxlength="48" minlength="48" placeholder="Copia el código entregado por ChatGPT"></label>'+
 '<p style="font-size:12px">El código de activación se utiliza solo para crear el primer administrador. No lo compartas con empleados.</p>'+
 '<button class="primary" style="width:100%;margin-top:6px">Activar GOZA Fichaje →</button></form>'+
 '<div id="setupMessage" role="status" style="margin-top:16px"></div>'+
 '<p style="margin-top:18px"><a href="./">Volver al inicio de sesión</a></p></section></div></div>';
const form=document.getElementById("setupForm");
form.onsubmit=async e=>{
 e.preventDefault();const f=new FormData(form),password=String(f.get("password"));
 const message=document.getElementById("setupMessage"),button=form.querySelector("button");
 if(password!==String(f.get("repeat"))){message.textContent="Las contraseñas no coinciden.";return}
 if(!/[A-Za-z]/.test(password)||!/\d/.test(password)){message.textContent="La contraseña debe contener letras y números.";return}
 button.disabled=true;message.textContent="Comprobando activación segura…";
 try{
  const resp=await fetch(cfg.supabaseUrl+"/functions/v1/setup-admin",{
   method:"POST",headers:{"content-type":"application/json","apikey":cfg.supabasePublishableKey},
   body:JSON.stringify({name:String(f.get("name")).trim(),email:String(f.get("email")).trim(),password,setupCode:String(f.get("code")).trim()})
  });
  const data=await resp.json();
  if(!resp.ok||!data.ok)throw Error(data.error||"No se pudo crear el administrador");
  form.style.display="none";
  message.innerHTML='<div class="credentials"><strong>Cuenta creada correctamente</strong><p>Ahora puedes entrar en GOZA como administrador utilizando tu correo y contraseña.</p><a href="./" style="color:#fff;font-weight:800">Entrar a GOZA →</a></div>';
 }catch(err){message.textContent=err.message;button.disabled=false}
 };
})();