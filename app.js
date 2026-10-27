import {createClient} from "https://esm.sh/@supabase/supabase-js@2.57.4";
import {AttendanceModule} from "./attendance.mjs";
import {GozaManagement} from "./management.mjs";
const cfg=window.GOZA_CONFIG||{},app=document.getElementById("app"),TZ="Europe/Madrid";
if(!cfg.supabaseUrl||!cfg.supabasePublishableKey)throw new Error("Falta conexión de GOZA.");
const db=createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{auth:{autoRefreshToken:true,persistSession:true}});
let user=null,me=null,people=[],shifts=[],incidents=[],corrections=[],events=[],selectedRecords=null,page="home",range="month",filterEmployee="all",filterFrom="",filterTo="",loginMode="employee",busy=false,secret=null,refreshing=false;
const $=q=>document.querySelector(q),$$=q=>Array.from(document.querySelectorAll(q));
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const now=()=>new Date(), dateKey=d=>new Intl.DateTimeFormat("sv-SE",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(d));
const dateLong=d=>new Intl.DateTimeFormat("es-ES",{timeZone:TZ,weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date(d));
const fmt=d=>d?new Intl.DateTimeFormat("es-ES",{timeZone:TZ,day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(d)):"—";
const clock=d=>new Intl.DateTimeFormat("es-ES",{timeZone:TZ,hour:"2-digit",minute:"2-digit",second:"2-digit"}).format(d);
const monthAgo=()=>{let d=now();d.setDate(d.getDate()-95);return d.toISOString()};
const weekStart=()=>{let d=now(),v=dateKey(d).split("-").map(Number),today=new Date(Date.UTC(v[0],v[1]-1,v[2])),wd=(today.getUTCDay()+6)%7;today.setUTCDate(today.getUTCDate()-wd);return today.toISOString().slice(0,10)};
const netSeconds=s=>Math.max(0,(new Date(s.ended_at||now())-new Date(s.started_at))/1000-(s.paused_seconds||0)-(s.pause_started_at?(now()-new Date(s.pause_started_at))/1000:0));
const addDate=(ymd,days=1)=>{const d=new Date(ymd+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)};
const madridMidnight=ymd=>{
 const y=Number(ymd.slice(0,4)),m=Number(ymd.slice(5,7)),d=Number(ymd.slice(8,10));
 const t=new Date(Date.UTC(y,m-1,d)),check=new Intl.DateTimeFormat("sv-SE",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
 for(let offset=-3;offset<=1;offset++){const cand=new Date(t.getTime()+offset*3600000);if(check.format(cand).replace(" ","T")===ymd+"T00:00")return cand}
 return new Date(t.getTime()-3600000)
};
// Estimación proporcional cuando un turno cruza medianoche; el detalle de eventos conserva pausas originales.
const overlapNet=(s,from,to)=>{const a=new Date(s.started_at).getTime(),b=new Date(s.ended_at||now()).getTime(),lo=Math.max(a,new Date(from).getTime()),hi=Math.min(b,new Date(to).getTime()),dur=Math.max(0,b-a);return dur?Math.max(0,(hi-lo)/dur*netSeconds(s)):0};
const hm=sec=>{const m=Math.max(0,Math.round(sec/60));return Math.floor(m/60)+" h "+String(m%60).padStart(2,"0")+" min"};
const hrs=s=>Number(netSeconds(s)/3600).toLocaleString("es-ES",{minimumFractionDigits:2,maximumFractionDigits:2});
const staffName=id=>people.find(x=>x.id===id)?.full_name||"Empleado";
const state=s=>!s.ended_at?(s.pause_started_at?"En pausa":"Trabajando"):"Finalizado";
const statusPill=s=>'<span class="status '+(!s.ended_at?"on":"off")+'">'+esc(state(s))+"</span>";
const logo='<div class="brand goza-logo"><img src="./goza-mark.svg" alt="GOZA TACOS À LA FRANÇAISE" class="goza-logo-img"><span class="brand-text"><b>GOZA<span>·</span></b><small>TACOS À LA FRANÇAISE</small></span></div>';
const setLoading=x=>{busy=x;$$("button[data-action]").forEach(e=>e.disabled=x)};
const notice=(message,bad=false)=>{let x=$("#message");if(x){x.className="message "+(bad?"bad":"ok");x.textContent=message; x.hidden=false; setTimeout(()=>{if(x)x.hidden=true},7000)}else alert(message)};
const fmtError=e=>e?.message||"No se pudo completar la operación";
const rpc=async(name,args)=>{const {data,error}=await db.rpc(name,args);if(error)throw error;return data};
const all=async()=>{const [ss,pp,ii,cc]=await Promise.all([
 db.from("staff").select("*").order("full_name"),
 db.from("shifts").select("*").gte("started_at",monthAgo()).order("started_at",{ascending:false}).limit(5000),
 db.from("incidents").select("*").order("created_at",{ascending:false}).limit(300),
 db.from("corrections").select("*").order("changed_at",{ascending:false}).limit(300)]);
 for(const t of [ss,pp,ii,cc])if(t.error)throw t.error;
 people=ss.data||[];shifts=pp.data||[];incidents=ii.data||[];corrections=cc.data||[];
};
const attendance=new AttendanceModule({
 db,escape:esc,format:fmt,getMe:()=>me,getPeople:()=>people,getShifts:()=>shifts,
 onChange:async()=>{await all();await attendance.load();await management.load();render()},
 notify:notice
});
const management=new GozaManagement({
 db,e:esc,fmt,getMe:()=>me,getPeople:()=>people,getShifts:()=>shifts,notify:notice,
 reload:async()=>{await all();await attendance.load();await management.load();if(selectedRecords)selectedRecords=await loadHistoricalRecords();render()}
});
async function loadHistoricalRecords(){
 // Consulta paginada: los 95 días del dashboard no limitan el histórico disponible.
 const base=filterFrom||dateKey(new Date(Date.now()-95*86400000));
 const last=filterTo||dateKey(now());
 const from=madridMidnight(base).toISOString(),to=madridMidnight(addDate(last)).toISOString();
 if(new Date(from)>new Date(to))throw Error("La fecha inicial debe ser anterior a la final");
 let records=[];for(let n=0;n<80;n++){
 const {data,error}=await db.from("shifts").select("*").gte("started_at",from).lt("started_at",to).order("started_at",{ascending:false}).range(n*1000,n*1000+999);
 if(error)throw error;records.push(...(data||[]));if((data||[]).length<1000)break;
 }
 return records;
}
async function init(){
 try{
 const {data,error}=await db.auth.getUser();if(error||!data.user){user=null;me=null;return renderLogin()}
 user=data.user;
 let x=await db.from("staff").select("*").eq("user_id",user.id).maybeSingle();
 if(x.error)throw x.error;
 if(!x.data||!x.data.active){return renderBlocked()}
 me=x.data;await all();await attendance.load();await management.load();
 render();
 }catch(e){app.innerHTML='<div class="splash"><h1>No se pudo cargar GOZA</h1><p>'+esc(fmtError(e))+'</p><button onclick="location.reload()">Reintentar</button></div>'}
}
const heading=(title,sub="")=>'<div class="heading"><div><div class="eyebrow">GOZA / CONTROL HORARIO</div><h1>'+title+'</h1><p>'+sub+'</p></div><span class="dateChip">'+esc(dateLong(now()))+'</span></div>';
function layout(content){
 app.innerHTML='<div class="shell"><header class="top"><div class="top-inner">'+logo+'<div class="top-right">'+(me?'<span class="profile">'+esc(me.full_name)+'</span><button class="light" data-action="logout">Salir ↗</button>':"")+'</div></div></header>'+
 (me?.role==="admin"||me?.role==="manager"?'<nav class="admin-nav"><div class="nav-in">'+[
 ["home","Resumen"],...(me.role==="admin"?[["team","Empleados"]]:[]),
 ["schedule","Horarios"],["attendance","Asistencia"],["records","Fichajes"],["issues","Incidencias"],
 ...(me.role==="admin"?[["audit","Auditoría"]]:[]),["account","Mi cuenta"]
 ].map(([k,l])=>'<button data-page="'+k+'" class="'+(page===k?"active"?"active":"")+'">'+l+"</button>").join("")+'</div></nav>':"")+
 '<main class="container">'+content+'<div id="message" class="message" hidden></div></main><footer>GOZA TACOS · Zaragoza · Hora oficial de España · Acceso privado</footer></div>';
 $$("[data-page]").forEach(b=>b.onclick=()=>{page=b.dataset.page;secret=null;render()});
 $("[data-action=logout]")?.addEventListener("click",async()=>{await db.auth.signOut();location.reload()});
}

function renderSetup(){
 app.innerHTML='<div class="login-wrap"><div class="login-visual"><div>'+logo+'<div class="login-head">GOZA<br><em>CONTROL.</em></div><p>Activa tu acceso privado como responsable del restaurante.</p></div><div class="login-foot">ACTIVACIÓN INICIAL · SOLO PROPIETARIO</div></div>'+
 '<div class="login-side"><div class="login-form"><div class="eyebrow">CONFIGURACIÓN INICIAL PROTEGIDA</div><h1>Crear administrador<span class="accent">.</span></h1><p>Elige tu correo y contraseña. El código de activación se utiliza una sola vez y no es tu contraseña.</p>'+
 '<form id="setupForm"><label>Tu correo personal de administración<input name="email" type="email" required autocomplete="email" placeholder="tu@correo.es"></label>'+
 '<label>Contraseña nueva (mínimo 12 caracteres)<input name="password" type="password" minlength="12" required autocomplete="new-password"></label>'+
 '<label>Repetir contraseña<input name="confirm" type="password" minlength="12" required autocomplete="new-password"></label>'+
 '<label>Código privado de activación<input name="code" type="password" required autocomplete="off" placeholder="Código que te entregaré"></label>'+
 '<button class="primary full" type="submit">Activar mi administrador →</button></form>'+
 '<p class="small-help">Este formulario crea una única cuenta administradora; después se bloquea automáticamente.</p>'+
 '<a href="./">Volver al acceso</a><div id="message" class="message" hidden></div></div></div></div>';
 $("#setupForm").onsubmit=async e=>{
  e.preventDefault();if(busy)return;const f=new FormData(e.target),email=String(f.get("email")).trim(),password=String(f.get("password")),confirm=String(f.get("confirm")),code=String(f.get("code")).trim();
  if(password!==confirm){notice("Las dos contraseñas no coinciden",true);return}
  if(password.length<12||!/[A-Za-z]/.test(password)||!/\d/.test(password)){notice("Usa 12 caracteres, letras y números como mínimo",true);return}
  busy=true;$("#setupForm button").disabled=true;
  try{
   const res=await fetch(cfg.supabaseUrl+"/functions/v1/bootstrap-goza-admin",{
    method:"POST",headers:{"Content-Type":"application/json","apikey":cfg.supabasePublishableKey},
    body:JSON.stringify({email,password,code})});
   const data=await res.json().catch(()=>({error:"Respuesta del servidor no válida"}));
   if(!res.ok)throw Error(data.error||"No se pudo activar tu cuenta");
   const {error}=await db.auth.signInWithPassword({email,password});
   if(error)throw Error("Cuenta creada, pero no se pudo iniciar sesión. Entra con tu correo y contraseña.");
   history.replaceState(null,"",location.pathname);
   busy=false;await init();
  }catch(ex){notice(fmtError(ex),true);busy=false;$("#setupForm button").disabled=false}
 };
}
function renderLogin(){
 if(new URLSearchParams(location.search).has('setup'))return renderSetup();
 me=null;
 app.innerHTML='<div class="login-wrap"><div class="login-visual"><div>'+logo+'<div class="login-head">EL TIEMPO<br><em>IMPORTA.</em></div><p>GOZA / Equipo. Una forma más fácil de registrar tu jornada.</p></div><div class="login-foot">ZARAGOZA · TACOS FRANCESES</div></div>'+
 '<div class="login-side"><div class="login-form"><div class="eyebrow">ACCESO PRIVADO</div><h1>Bienvenido<br>al equipo<span class="accent">.</span></h1><p>Inicia sesión para registrar tu jornada.</p>'+
 '<div class="segment"><button class="'+(loginMode==="employee"?"selected":"")+'" data-mode="employee">Empleado</button><button class="'+(loginMode==="admin"?"selected":"")+'" data-mode="admin">Administrador</button></div>'+
 '<form id="signin"><label>'+(loginMode==="admin"?"Correo del administrador":"Número de empleado")+'<input name="identity" '+(loginMode==="admin"?'type="email"':'autocapitalize="characters"')+' required autocomplete="username" placeholder="'+(loginMode==="admin"?"tu@correo.es":"GOZA-001")+'"></label>'+
 '<label>Contraseña individual<input name="password" type="password" minlength="8" autocomplete="current-password" required placeholder="••••••••••••"></label>'+
 '<button class="primary full" type="submit" id="submitLogin">Entrar a GOZA →</button></form>'+
 '<div class="login-help">¿No tienes acceso? Solicítalo al responsable del restaurante.<br>La contraseña no se comparte entre empleados.</div><div id="message" class="message" hidden></div></div></div></div>';
 $$("[data-mode]").forEach(b=>b.onclick=()=>{loginMode=b.dataset.mode;renderLogin()});
 $("#signin").onsubmit=async e=>{
 e.preventDefault();
 if(busy)return;
 const form=e.currentTarget,submit=form.querySelector('button[type="submit"]');
 busy=true;
 if(submit){submit.disabled=true;submit.textContent="Iniciando sesión…";}
 try{
  const f=new FormData(form);
  let identity=String(f.get("identity")||"").trim();
  const password=String(f.get("password")||"");
  if(loginMode==="employee"){
   identity=identity.toUpperCase();
   if(!/^[A-Z0-9-]{3,24}$/.test(identity))throw Error("Introduce un código de empleado válido.");
   identity=identity.toLowerCase()+"@goza-staff.example.com";
  }else if(!identity.includes("@"))throw Error("Introduce tu correo de administrador.");
  const {error}=await db.auth.signInWithPassword({email:identity,password});
  if(error)throw Error("Correo/código o contraseña incorrectos. Comprueba los datos.");
  await init();
 }catch(error){notice(fmtError(error),true)}
 finally{
  busy=false;
  if(submit.isConnected){submit.disabled=false;submit.textContent="Entrar a GOZA →";}
 }
 };
}
function renderBlocked(){
 app.innerHTML='<div class="splash">'+logo+'<h1>Acceso sin autorización</h1><p>Tu usuario aún no está dado de alta o está desactivado. Consulta con el responsable.</p><button id="bye" class="primary">Cerrar sesión</button></div>';
 $("#bye").onclick=async()=>{await db.auth.signOut();location.reload()};
}
function render(){if(!me)return renderLogin();if(me.role==="employee")return renderEmployee();if(page==="home")return renderHome();if(page==="team"&&me.role==="admin")return renderTeam();if(page==="records")return renderRecords();if(page==="schedule")return attendance.adminSchedule({layout,heading});if(page==="attendance")return attendance.adminAttendance({layout,heading});if(page==="issues")return renderIssues();if(page==="audit"&&me.role==="admin")return management.auditPage({layout,heading});renderAccount()}
function currentShift(){return shifts.find(s=>s.staff_id===me.id&&!s.ended_at)}
function renderEmployee(){
 const current=currentShift(),my=shifts.filter(s=>s.staff_id===me.id);
 const today=dateKey(now()),recent=my.filter(s=>dateKey(s.started_at)===today);
 const todayStart=madridMidnight(today),todayEnd=madridMidnight(addDate(today));const todaySecs=my.reduce((n,s)=>n+overlapNet(s,todayStart,todayEnd),0);
 layout('<section class="employee-hero"><div class="eyebrow cream">REGISTRO DE JORNADA / '+esc(me.employee_code)+'</div>'+
 '<h1>Hola, '+esc(me.full_name.split(" ")[0])+'<span class="accent">.</span></h1><p>Tu jornada, en un toque.</p>'+
 '<div class="live-clock" id="liveclock">'+clock(now())+'</div><div class="todaydate">'+esc(dateLong(now()))+'</div><div class="hero-status '+(current?"working":"")+'">● '+(current?state(current):"Fuera de servicio")+'</div>'+
 '<div class="big-actions">'+(!current?'<button data-clock="entry" class="primary giant">▶&nbsp; Fichar entrada</button>':
 '<button data-clock="'+(current.pause_started_at?"break_end":"break_start")+'" class="primary giant">'+(current.pause_started_at?"↻&nbsp; Terminar pausa":"Ⅱ&nbsp; Iniciar pausa")+'</button>'+
 '<button data-clock="exit" class="outline giant">■&nbsp; Fichar salida</button>')+'</div>'+
 (current?'<p class="started">Entrada registrada: '+fmt(current.started_at)+'</p>':'<p class="started">Pulsa entrada cuando comiences tu turno.</p>')+
 '</section><div class="two-panel"><section class="card"><div class="eyebrow">MIS HORAS HOY</div><div class="big-number">'+hm(todaySecs)+'</div><p>Tiempo estimado sin pausas no trabajadas.</p></section>'+
 '<section class="card"><div class="eyebrow">¿OLVIDASTE FICHAR?</div><h3>Notifica una incidencia</h3><p>El responsable podrá revisar una entrada, salida o pausa olvidada.</p><form id="incident"><textarea name="reason" required minlength="8" maxlength="1000" placeholder="Ej.: Ayer terminé a las 00:20 y olvidé registrar la salida"></textarea><button class="small-primary">Enviar incidencia</button></form></section></div>'+
 '<section class="card"><div class="section-head"><h2>Mis últimos fichajes</h2><span class="hint">Solo puedes ver los tuyos</span></div><div class="table-scroll"><table><thead><tr><th>Entrada</th><th>Salida</th><th>Pausa</th><th>Tiempo</th><th>Estado</th></tr></thead><tbody>'+
 (my.length?my.slice(0,25).map(s=>'<tr><td>'+fmt(s.started_at)+'</td><td>'+fmt(s.ended_at)+'</td><td>'+Math.round(s.paused_seconds/60)+' min</td><td><b>'+hrs(s)+' h</b></td><td>'+statusPill(s)+'</td></tr>').join(""):'<tr><td colspan="5" class="empty">Aún no hay fichajes.</td></tr>')+
 '</tbody></table></div></section>'+attendance.employeeWidget()+'<section class="card small-text"><b>Privacidad y control</b><p>Los fichajes usan la hora del servidor. Si te equivocas, informa del error; las correcciones quedan auditadas. No compartas tu contraseña.</p><button class="light" data-action="password">Cambiar mi contraseña</button></section>');
 $$("[data-clock]").forEach(b=>b.onclick=async()=>{if(busy)return;setLoading(true);try{await rpc("clock_action",{p_action:b.dataset.clock});await all();await attendance.load();render();notice("Fichaje confirmado y guardado en el servidor")}catch(e){notice(fmtError(e),true)}finally{setLoading(false)}});
 $("#incident").onsubmit=async e=>{e.preventDefault();if(busy)return;setLoading(true);try{await rpc("submit_incident",{p_reason:new FormData(e.target).get("reason")});await all();render();notice("Incidencia enviada al responsable")}catch(e){notice(fmtError(e),true)}finally{setLoading(false)}};
 $("[data-action=password]").onclick=()=>changePassword();
 attendance.bindEmployee();
}
function stats(){
 const active=people.filter(p=>p.active&&p.role==="employee"),open=shifts.filter(s=>!s.ended_at),
 today=dateKey(now()),week=weekStart();
 const todaySeconds=shifts.reduce((n,s)=>n+overlapNet(s,madridMidnight(today),madridMidnight(addDate(today))),0);
 const weekSeconds=shifts.reduce((n,s)=>n+overlapNet(s,madridMidnight(week),now()),0);
 const over12=open.filter(s=>now()-new Date(s.started_at)>12*3600000);
 const pending=incidents.filter(i=>i.status==="pending");
 const dayRest=[];
 for(const p of active){let rs=shifts.filter(s=>s.staff_id===p.id&&s.ended_at).sort((a,b)=>a.started_at.localeCompare(b.started_at));for(let j=1;j<rs.length;j++){
 const rest=(new Date(rs[j].started_at)-new Date(rs[j-1].ended_at))/3600000;
 if(rest>=0&&rest<12&&dateKey(rs[j-1].ended_at)!==dateKey(rs[j].started_at))dayRest.push({staff:p,rest,cur:rs[j]});
 }}
 return {active,open,todaySeconds,weekSeconds,over12,pending,dayRest};
}
function renderHome(){
 const s=stats();
 layout(heading('Panel de control<span class="accent">.</span>','Tu restaurante en tiempo real. Horas e incidencias basadas en fichajes guardados.')+
 '<div class="kpis">'+[
 ["Empleados activos",s.active.length,"Gestión del equipo","people"],["Ahora trabajando",s.open.filter(x=>!x.pause_started_at).length,"Jornadas abiertas","live"],["Horas de hoy",hm(s.todaySeconds),"Neto estimado","clock"],["Horas esta semana",hm(s.weekSeconds),"Jornadas iniciadas esta semana","hours"],["Incidencias",s.pending.length,"Pendientes de revisión","warning"],["Alertas",s.over12.length+s.dayRest.length,"Jornadas largas / descanso","alert"]
 ].map(([label,value,desc,icon],i)=>'<div class="kpi"><div class="kpi-icon">'+["◉","▶","◷","▤","!","⚑"][i]+'</div><small>'+label+'</small><strong>'+value+'</strong><span>'+desc+'</span></div>').join("")+'</div>'+
 '<div class="two-panel admin-panels"><section class="card"><div class="section-head"><h2>En servicio ahora</h2><span class="live-dot">● En directo</span></div>'+
 (s.open.length?s.open.map(x=>'<div class="person-row"><span class="avatar">'+esc(staffName(x.staff_id).slice(0,1))+'</span><div><b>'+esc(staffName(x.staff_id))+'</b><small>Entrada '+fmt(x.started_at)+'</small></div>'+statusPill(x)+'</div>').join(""):'<div class="empty">Ahora mismo no hay jornadas abiertas.</div>')+'</section>'+
 '<section class="card"><div class="section-head"><h2>Atención necesaria</h2><span class="counter">'+(s.over12.length+s.dayRest.length+s.pending.length)+'</span></div>'+
 (s.over12.map(x=>'<div class="warning-row">⚠ Jornada abierta +12 h: '+esc(staffName(x.staff_id))+'</div>').join("")+
 s.dayRest.slice(-5).map(x=>'<div class="warning-row">⚠ Descanso entre turnos inferior a 12 h: '+esc(x.staff.full_name)+' ('+x.rest.toFixed(1)+' h)</div>').join("")+
 s.pending.slice(0,5).map(x=>'<div class="warning-row">◉ Incidencia de '+esc(staffName(x.staff_id))+': '+esc(x.reason.slice(0,90))+'</div>').join("")||
 '<div class="empty">No hay avisos pendientes.</div>')+'</section></div>'+
 '<section class="card"><div class="section-head"><h2>Últimos movimientos</h2><button class="light" data-action="go-records">Ver todos →</button></div>'+shiftTable(shifts.slice(0,12))+'</section>'+
 attendance.adminDashboard()+'<div class="tip">Las alertas ayudan a revisar posibles incidencias, pero no determinan por sí solas infracciones u horas extra. Comprueba el convenio y el contrato.</div>');
 $("[data-action=go-records]").onclick=()=>{page="records";render()};
 attendance.bindDashboard(next=>{page=next;render()});
}
function shiftTable(list,actions=false){
 return '<div class="table-scroll"><table><thead><tr><th>Empleado</th><th>Entrada</th><th>Salida</th><th>Pausas</th><th>Neto</th><th>Estado</th>'+(actions?"<th>Corrección</th>":"")+'</tr></thead><tbody>'+
 (list.length?list.map(s=>'<tr><td><b>'+esc(staffName(s.staff_id))+'</b></td><td>'+fmt(s.started_at)+'</td><td>'+fmt(s.ended_at)+'</td><td>'+Math.round(s.paused_seconds/60)+' min</td><td>'+hrs(s)+' h</td><td>'+statusPill(s)+'</td>'+
 (actions?'<td><button class="table-btn" data-correct="'+s.id+'">Corregir</button></td>':"")+'</tr>').join(""):'<tr><td class="empty" colspan="'+(actions?7:6)+'">No hay registros.</td></tr>')+"</tbody></table></div>"
}
function renderTeam(){
 const employees=people.filter(e=>e.role!=="admin"),active=employees.filter(e=>e.active).length;
 layout(heading('Tu equipo<span class="accent">.</span>','Solo el administrador puede crear accesos y cambiar las credenciales.')+
 '<div class="card"><div class="section-head"><h2>Dar de alta empleado</h2><span class="counter">'+active+' / 10 activos</span></div><form id="add" class="create-form">'+
 '<label>Nombre y apellidos<input name="name" required minlength="2" maxlength="100" placeholder="Nombre completo"></label><label>Número de empleado<input name="code" required pattern="[A-Za-z0-9-]{3,24}" placeholder="GOZA-001" autocapitalize="characters"></label>'+
 '<label>Horas contratadas / semana (opcional)<input name="weeklyTarget" type="number" min="0" max="60" step="0.5" placeholder="Ej. 20 o 40"></label><button class="primary" type="submit">+ Crear acceso</button></form>'+
 '<p class="small-help">Al dar de alta generaremos una contraseña segura que podrás entregar al trabajador. No se puede consultar después; sí restablecerla.</p></div>'+
 (secret?'<section class="credentials"><b>Acceso creado — copia ahora estas credenciales</b><p>Código: <strong>'+esc(secret.code)+'</strong></p><p>Contraseña: <strong id="onepass">'+esc(secret.password)+'</strong></p><button class="primary" data-action="copy-secret">Copiar credenciales</button><p>Este aviso desaparece al cambiar de pantalla. No hagas capturas con datos de otras personas.</p></section>':"")+
 '<section class="card"><div class="section-head"><h2>Personal</h2><span class="hint">Accesos individuales y privados</span></div>'+
 (employees.length?employees.map(e=>'<div class="person-row team-row"><span class="avatar">'+esc(e.full_name.slice(0,1))+'</span><div><b>'+esc(e.full_name)+'</b><small>'+esc(e.employee_code)+' · '+(e.weekly_target===null?"Jornada no configurada":e.weekly_target+" h/semana")+'</small></div>'+
 '<span class="status '+(e.active?"on":"off")+'">'+(e.active?"Activo":"Inactivo")+'</span>'+
 '<button class="table-btn" data-reset="'+e.id+'">Nueva clave</button><button class="table-btn" data-target="'+e.id+'">Horas</button><button class="table-btn" data-toggle="'+e.id+'">'+(e.active?"Desactivar":"Activar")+'</button></div>').join(""):'<div class="empty">No hay empleados dados de alta.</div>')+
 '</section>');
 $("#add").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);if(busy)return;setLoading(true);try{
 const response=await manage({action:"create",name:f.get("name"),code:String(f.get("code")).toUpperCase(),weeklyTarget:f.get("weeklyTarget")});
 secret={code:response.code,password:response.password};await all();render();notice("Empleado creado con acceso individual");
 }catch(ex){notice(fmtError(ex),true)}finally{setLoading(false)}};
 $("[data-action=copy-secret]")?.addEventListener("click",async()=>{try{await navigator.clipboard.writeText("GOZA Fichaje\nCódigo: "+secret.code+"\nContraseña: "+secret.password+"\nWeb: "+location.origin+location.pathname);notice("Copiado. Entrégalo de forma privada.")}catch{notice("Tu navegador no ha permitido copiar automáticamente",true)}});
 $$("[data-reset]").forEach(b=>b.onclick=async()=>{if(!confirm("¿Generar una nueva contraseña? La anterior dejará de funcionar."))return;try{const res=await manage({action:"reset",staffId:b.dataset.reset});const e=people.find(x=>x.id===b.dataset.reset);secret={code:e.employee_code,password:res.password};render();notice("Contraseña restablecida")}catch(e){notice(fmtError(e),true)}});
 $$("[data-toggle]").forEach(b=>b.onclick=async()=>{const p=people.find(e=>e.id===b.dataset.toggle);if(!confirm((p.active?"¿Desactivar":"¿Activar")+" el acceso de "+p.full_name+"?"))return;try{await manage({action:"toggle",staffId:p.id,active:!p.active});await all();render();notice("Estado actualizado")}catch(e){notice(fmtError(e),true)}});
 $$("[data-target]").forEach(b=>b.onclick=async()=>{const p=people.find(e=>e.id===b.dataset.target);const v=prompt("Horas contratadas por semana de "+p.full_name+" (vacío para quitar):",p.weekly_target??"");if(v===null)return;try{await manage({action:"target",staffId:p.id,weeklyTarget:v});await all();render();notice("Horas semanales actualizadas")}catch(e){notice(fmtError(e),true)}});
}
async function manage(body){const r=await db.functions.invoke("manage-staff",{body});if(r.error)throw Error("No se pudo gestionar el empleado. Comprueba la función privada de Supabase.");if(r.data?.error)throw Error(r.data.error);return r.data}
function renderRecords(){
 let d=(selectedRecords||shifts).filter(s=>(filterEmployee==="all"||s.staff_id===filterEmployee)&&(!filterFrom||dateKey(s.started_at)>=filterFrom)&&(!filterTo||dateKey(s.started_at)<=filterTo));
 const by={};d.forEach(s=>{(by[s.staff_id]||=[]).push(s)});
 const agg=Object.entries(by).map(([id,rows])=>({id,secs:rows.reduce((n,s)=>n+netSeconds(s),0),count:rows.length})).sort((a,b)=>b.secs-a.secs);
 layout(heading('Fichajes y horas<span class="accent">.</span>','Historial del equipo, cálculo de horas y exportación a CSV.')+
 '<section class="card"><div class="filters"><label>Desde<input type="date" id="from" value="'+esc(filterFrom)+'"></label><label>Hasta<input type="date" id="to" value="'+esc(filterTo)+'"></label><label>Empleado<select id="worker"><option value="all">Todos</option>'+people.map(p=>'<option value="'+p.id+'" '+(filterEmployee===p.id?"selected":"")+'>'+esc(p.full_name)+'</option>').join("")+'</select></label>'+
 '<button class="primary" data-action="filter">Aplicar</button><button class="light" data-action="export">↓ Descargar CSV</button></div>'+
 '<div class="results"><strong>'+d.length+' jornadas</strong><span>'+hm(d.reduce((n,s)=>n+netSeconds(s),0))+' registradas en el filtro</span></div></section>'+
 '<section class="card"><div class="section-head"><h2>Resumen por empleado</h2><span class="hint">Horas netas estimadas</span></div><div class="summary-grid">'+
 (agg.length?agg.map(x=>'<div class="summary-item"><small>'+esc(staffName(x.id))+'</small><b>'+hm(x.secs)+'</b><span>'+x.count+' jornadas</span></div>').join(""):'<div class="empty">Sin resultados</div>')+'</div></section>'+
 '<section class="card"><div class="section-head"><h2>Detalle de jornadas</h2><span class="hint">Las correcciones quedan registradas</span></div>'+shiftTable(d,true)+'</section>'+
 '<section class="card"><div class="section-head"><h2>Historial de correcciones</h2><span class="hint">Trazabilidad</span></div>'+
 '<div class="table-scroll"><table><thead><tr><th>Fecha</th><th>Empleado</th><th>Antes</th><th>Después</th><th>Motivo</th></tr></thead><tbody>'+
 (corrections.length?corrections.slice(0,30).map(c=>'<tr><td>'+fmt(c.changed_at)+'</td><td>'+esc(staffName(c.staff_id))+'</td><td>'+fmt(c.old_started_at)+' / '+fmt(c.old_ended_at)+'</td><td>'+fmt(c.new_started_at)+' / '+fmt(c.new_ended_at)+'</td><td>'+esc(c.reason)+'</td></tr>').join(""):'<tr><td colspan="5" class="empty">Todavía no hay correcciones.</td></tr>')+
 '</tbody></table></div></section>');
 $("[data-action=filter]").onclick=async()=>{filterFrom=$("#from").value;filterTo=$("#to").value;filterEmployee=$("#worker").value;try{selectedRecords=await loadHistoricalRecords();render();notice("Registros consultados desde el servidor")}catch(e){notice(fmtError(e),true)}};
 $("[data-action=export]").onclick=()=>downloadCsv(d);
 $$("[data-correct]").forEach(b=>b.onclick=()=>correctDialog(b.dataset.correct));
}
function madridFormDate(iso){
 if(!iso)return "";
 const parts=new Intl.DateTimeFormat("sv-SE",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(iso));
 const get=k=>parts.find(x=>x.type===k)?.value||"00";return get("year")+"-"+get("month")+"-"+get("day")+"T"+get("hour")+":"+get("minute");
}
function localMadridToISO(t){
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(t))throw Error("Fecha no válida");
 // Seleccionar UTC que representa exactamente la hora local de Madrid; DST ambiguo -> exigir revisión.
 const target=t.replace("T"," ");const probe=new Date(t+"Z"),matches=[];
 for(let h=-3;h<=3;h++){const d=new Date(probe.getTime()+h*3600000);if(madridFormDate(d.toISOString())===t)matches.push(d.toISOString())}
 if(matches.length!==1)throw Error(matches.length?"Hora ambigua por cambio de horario; usa otro momento o consulta soporte":"Esa hora no existe en el horario de Zaragoza");
 return matches[0];
}
function correctDialog(shiftId){
 const s=(selectedRecords||shifts).find(x=>x.id===shiftId);if(!s)return;
 const start=prompt("Corregir ENTRADA de "+staffName(s.staff_id)+" (hora Zaragoza: AAAA-MM-DDTHH:MM)",madridFormDate(s.started_at));
 if(start===null)return;
 const end=prompt("Corregir SALIDA (hora Zaragoza: AAAA-MM-DDTHH:MM)",madridFormDate(s.ended_at||now()));
 if(end===null)return;
 const pause=prompt("Pausas no trabajadas en minutos",String(Math.round(s.paused_seconds/60)));if(pause===null)return;
 const reason=prompt("Motivo obligatorio de la corrección (mínimo 8 caracteres):");if(reason===null)return;
 (async()=>{try{
 const p_start=localMadridToISO(start),p_end=localMadridToISO(end);
 const v=Number(pause);
 if(!Number.isFinite(v)||v<0||reason.trim().length<8)throw Error("Datos inválidos");
 await rpc("correct_shift",{p_id:shiftId,p_start,p_end,p_pause_seconds:Math.round(v*60),p_reason:reason.trim()});
 await all();if(selectedRecords)selectedRecords=await loadHistoricalRecords();render();notice("Corrección realizada y registrada en auditoría");
 }catch(e){notice(fmtError(e),true)}})();
}
function renderIssues(){
 const pending=incidents.filter(x=>x.status==="pending");
 layout(heading('Incidencias<span class="accent">.</span>','Revisa olvidos de fichaje, avisos y solicitudes de corrección.')+
 '<section class="card"><div class="section-head"><h2>Pendientes</h2><span class="counter">'+pending.length+'</span></div>'+
 (incidents.length?incidents.map(i=>'<div class="incident-row"><div class="incident-info"><b>'+esc(staffName(i.staff_id))+'</b><small>'+fmt(i.created_at)+'</small><p>'+esc(i.reason)+'</p><span class="status '+(i.status==="pending"?"on":"off")+'">'+({pending:"Pendiente",resolved:"Resuelta",rejected:"Rechazada"}[i.status])+'</span></div>'+
 (i.status==="pending"?'<div class="buttons"><button class="light" data-review="'+i.id+'" data-status="resolved">Marcar resuelta</button><button class="light" data-review="'+i.id+'" data-status="rejected">Rechazar</button></div>':"")+'</div>').join(""):'<div class="empty">No hay incidencias.</div>')+
 '</section><div class="tip">Marcar una incidencia como resuelta no cambia fichajes. Si corresponde, aplica la corrección en «Fichajes», dejando el motivo y la auditoría.</div>');
 $$("[data-review]").forEach(b=>b.onclick=async()=>{const note=prompt("Nota para la revisión (opcional):","");if(note===null)return;try{await rpc("review_incident",{p_id:b.dataset.review,p_status:b.dataset.status,p_note:note});await all();render();notice("Incidencia revisada")}catch(e){notice(fmtError(e),true)}});
}
function renderAccount(){
 layout(heading('Mi cuenta<span class="accent">.</span>','Seguridad del administrador y configuración básica.')+
 '<section class="card account"><h2>Administrador</h2><p><b>Nombre:</b> '+esc(me.full_name)+'</p><p><b>Correo:</b> '+esc(user.email)+'</p><p><b>Identificador:</b> '+esc(me.employee_code)+'</p><p>Tu cuenta administra los fichajes y las credenciales de los empleados. Activa MFA en Supabase para mayor seguridad.</p><button class="primary" data-action="password">Cambiar mi contraseña</button></section>'+
 '<section class="card"><h2>Retención y copias de seguridad</h2><p>Conserva los registros cuatro años y configura copias externas y recuperación de datos. La publicación GitHub Pages no almacena los fichajes.</p></section>');
 $("[data-action=password]").onclick=changePassword;
}
async function changePassword(){
 const password=prompt("Escribe tu nueva contraseña (mínimo 12 caracteres, mezcla de letras, números y símbolos).");
 if(password===null)return;
 if(password.length<12||!/[A-Za-z]/.test(password)||!/\d/.test(password)){notice("Usa al menos 12 caracteres, letras y números.",true);return}
 const {error}=await db.auth.updateUser({password});
 notice(error?"No se pudo cambiar la contraseña":"Contraseña actualizada",!!error);
}
function downloadCsv(data){
 const heads=["Código","Empleado","Entrada UTC","Salida UTC","Pausa segundos","Horas netas","Estado","ID jornada"];
 const rows=[heads,...data.map(s=>[people.find(p=>p.id===s.staff_id)?.employee_code||"",staffName(s.staff_id),s.started_at,s.ended_at||"",s.paused_seconds,(netSeconds(s)/3600).toFixed(4),state(s),s.id])];
 const csv="\ufeff"+rows.map(r=>r.map(x=>{let v=String(x??"");if(/^[\s]*[=+@]/.test(v))v="'"+v;return '"'+v.replaceAll('"','""')+'"'}).join(";")).join("\r\n");
 const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"})),a=document.createElement("a");
 a.href=url;a.download="goza-fichajes-"+dateKey(now())+".csv";a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
setInterval(()=>{let x=$("#liveclock");if(x)x.textContent=clock(now())},1000);
setInterval(async()=>{if(!me||document.hidden||refreshing||busy)return;refreshing=true;try{await all();await attendance.load();render()}catch{}finally{refreshing=false}},60000);
db.auth.onAuthStateChange((event)=>{if(event==="SIGNED_OUT"){me=null;user=null;renderLogin()}});
init();