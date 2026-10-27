// GOZA Asistencia: planificación y justificaciones con permisos RLS en servidor.
// Las horas y los cálculos de puntualidad se muestran en Europe/Madrid.
const ZONE="Europe/Madrid";
export const localDay = (d)=>new Intl.DateTimeFormat("sv-SE",{timeZone:ZONE,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(d));
export function plusDays(day,amount){
 const d=new Date(day+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+amount);return d.toISOString().slice(0,10);
}
export const minutes = (x,y)=>Math.round((new Date(x)-new Date(y))/60000);
const isoParts=(d)=>{
 const parts=new Intl.DateTimeFormat("en-GB",{timeZone:ZONE,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(d));
 const val=k=>parts.find(v=>v.type===k)?.value||"00";
 return val("year")+"-"+val("month")+"-"+val("day")+"T"+val("hour")+":"+val("minute");
};
export function localMadridToISO(local){
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local))throw Error("La fecha y hora no son válidas");
 const probe=new Date(local+"Z");if(Number.isNaN(probe.getTime()))throw Error("Fecha incorrecta");
 const matches=[];
 for(let min=-180;min<=180;min+=30){
  const candidate=new Date(probe.getTime()+min*60000);
  if(isoParts(candidate)===local)matches.push(candidate.toISOString());
 }
 if(matches.length!==1)throw Error(matches.length?"Hora ambigua por cambio al horario de invierno; elige otra hora":"Esa hora no existe en el horario de Zaragoza");
 return matches[0];
}
export function attendanceStatus(plan,actual,nowTime=Date.now(),grace=5){
 if(plan.status==="cancelled")return {key:"cancelled",label:"Anulado",severity:0};
 if(actual){
  const late=minutes(actual.started_at,plan.starts_at);
  const exit=actual.ended_at?minutes(actual.ended_at,plan.ends_at):null;
  if(late>grace&&exit!==null&&exit < -grace)return {key:"late-early",label:"Entrada "+late+" min tarde y salida "+Math.abs(exit)+" min antes",severity:2,late,exit};
  if(late>grace&&exit!==null&&exit > grace)return {key:"late-extra",label:"Entrada "+late+" min tarde y salida "+exit+" min después",severity:2,late,exit};
  if(late>grace)return {key:"late",label:"Entrada "+late+" min tarde",severity:2,late};
  if(exit!==null&&exit < -grace)return {key:"early",label:"Salida "+Math.abs(exit)+" min antes",severity:2,exit};
  if(exit!==null&&exit > grace)return {key:"extra",label:"Salida "+exit+" min después",severity:2,exit};
  return {key:actual.ended_at?"done":"working",label:actual.ended_at?"Completado":"En curso",severity:0};
 }
 const start=new Date(plan.starts_at).getTime(),end=new Date(plan.ends_at).getTime();
 if(nowTime>end)return {key:"absent",label:"Sin fichaje · revisar falta",severity:2};
 if(nowTime>start+grace*60000)return {key:"missing",label:"Fichaje pendiente",severity:2};
 if(nowTime>=start)return {key:"pending",label:"Comienza ahora",severity:1};
 return {key:"planned",label:"Programado",severity:0};
}
const kinds={late:"Llegada tarde",medical:"Cita médica",absence:"Ausencia",personal:"Asunto personal",early_exit:"Salida anticipada",other:"Otra incidencia"};
const states={pending:"Pendiente",approved:"Aceptada",rejected:"Rechazada"};
export class AttendanceModule{
 constructor({db,escape,format,getMe,getPeople,getShifts,onChange,notify}){
  this.db=db;this.e=escape;this.fmt=format;this.getMe=getMe;this.getPeople=getPeople;this.getShifts=getShifts;this.onChange=onChange;this.notify=notify;
  this.plans=[];this.requests=[];this.history=[];this.week=localDay(new Date());this.week=this.weekBegin(this.week);
  this.filterStaff="all";this.working=false;
 }
 weekBegin(day){const dt=new Date(day+"T12:00:00Z");dt.setUTCDate(dt.getUTCDate()-(dt.getUTCDay()+6)%7);return dt.toISOString().slice(0,10)}
 async load(){
  const from=plusDays(localDay(new Date()),-120),to=plusDays(localDay(new Date()),120);
  const [p,j]=await Promise.all([
   this.db.from("planned_shifts").select("*").gte("work_date",from).lte("work_date",to).order("starts_at",{ascending:true}).limit(3000),
   this.db.from("attendance_requests").select("*").order("created_at",{ascending:false}).limit(1000)]);
  if(p.error)throw p.error;if(j.error)throw j.error;
  this.plans=p.data||[];this.requests=j.data||[];
 }
 async rpc(name,args){const r=await this.db.rpc(name,args);if(r.error)throw Error(r.error.message);return r.data}
 async perform(action){
  if(this.working)return;this.working=true;
  try{await action();await this.onChange();this.notify("Cambios guardados correctamente")}
  catch(err){this.notify(err?.message||"No se pudo completar la operación",true)}
  finally{this.working=false}
 }
 name(id){return this.getPeople().find(p=>p.id===id)?.full_name||"Empleado";}
 myPlans(){return this.plans.filter(p=>p.staff_id===this.getMe()?.id&&p.status==="scheduled")}
 getShift(p){return this.getShifts().find(x=>x.planned_shift_id===p.id)}
 justified(p){
  return this.requests.find(x=>x.staff_id===p.staff_id&&x.status==="approved"&&
   x.date_from<=p.work_date&&x.date_to>=p.work_date&&["absence","medical","personal"].includes(x.kind));
 }
 status(p){
  if(this.justified(p)&&!this.getShift(p))return {key:"justified",label:"Justificada · revisada",severity:0};
  return attendanceStatus(p,this.getShift(p));
 }
 badge(info){return '<span class="att-badge att-'+info.key+'">'+this.e(info.label)+'</span>'}
 time(t){return new Intl.DateTimeFormat("es-ES",{timeZone:ZONE,hour:"2-digit",minute:"2-digit"}).format(new Date(t))}
 prettyDay(day){return new Intl.DateTimeFormat("es-ES",{timeZone:ZONE,weekday:"short",day:"2-digit",month:"short"}).format(new Date(day+"T12:00:00Z"))}
 duration(p){return Math.round((new Date(p.ends_at)-new Date(p.starts_at))/60000)}
 dateTime(p){return this.prettyDay(p.work_date)+" · "+this.time(p.starts_at)+"–"+this.time(p.ends_at)+(localDay(p.ends_at)!==p.work_date?" (+1 día)":"")}
 employeeWidget(){
  const mine=this.myPlans(),today=localDay(new Date()),coming=mine.filter(p=>p.work_date>=plusDays(today,-1)&&p.work_date<=plusDays(today,9)).sort((a,b)=>a.starts_at.localeCompare(b.starts_at));
  const warnings=mine.filter(p=>p.work_date>=plusDays(today,-7)&&p.work_date<=today)
   .map(p=>({p,s:this.status(p)})).filter(x=>["late","early","extra","late-early","late-extra","missing","absent"].includes(x.s.key));
  const requests=this.requests.filter(x=>x.staff_id===this.getMe()?.id);
  return '<section class="card attendance-card"><div class="section-head"><div><div class="eyebrow">MIS TURNOS</div><h2>Horarios asignados</h2></div><span class="hint">Zaragoza · horario oficial</span></div>'+
   (coming.length?'<div class="att-plan-grid">'+coming.map(p=>
     '<div class="att-day-card"><div><b>'+this.e(this.prettyDay(p.work_date))+'</b><span>'+this.e(this.time(p.starts_at))+' — '+this.e(this.time(p.ends_at))+'</span></div>'+
     this.badge(this.status(p))+'</div>').join("")+'</div>':'<p class="att-empty">No hay turnos asignados en los próximos días. Puedes fichar igualmente; avisa al responsable para planificar tu horario.</p>')+
   (warnings.length?'<div class="att-alerts"><strong>Revisa tus fichajes</strong>'+
    warnings.slice(0,5).map(x=>'<div class="att-alert-item"><span>'+this.e(this.dateTime(x.p))+'</span>'+this.badge(x.s)+'<button class="table-btn" data-att-justify="'+x.p.id+'">Explicar</button></div>').join("")+'</div>':"")+'</section>'+
   '<section class="card attendance-card"><div class="section-head"><div><div class="eyebrow">COMUNICACIONES</div><h2>Justificar ausencia o retraso</h2></div><span class="hint">El responsable revisará tu solicitud</span></div>'+
   '<form class="att-request-form" id="att-request"><label>Motivo<select name="kind" required>'+Object.entries(kinds).map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join("")+'</select></label>'+
   '<label>Desde<input type="date" name="from" required value="'+this.e(today)+'"></label><label>Hasta<input type="date" name="to" required value="'+this.e(today)+'"></label>'+
   '<label class="att-full">Explicación (sin incluir información médica sensible)<textarea name="reason" minlength="8" maxlength="1000" required placeholder="Ejemplo: he tenido una cita médica y he avisado al encargado"></textarea></label>'+
   '<button class="small-primary" type="submit">Enviar justificación →</button></form>'+
   '<div class="att-my-requests"><h3>Mis solicitudes</h3>'+
   (requests.length?requests.slice(0,8).map(x=>'<div class="att-request-row"><div><b>'+this.e(kinds[x.kind]||x.kind)+'</b><small>'+this.e(x.date_from)+(x.date_to!==x.date_from?" a "+this.e(x.date_to):"")+' · '+this.e(x.reason)+'</small></div>'+this.badge({key:x.status,label:states[x.status]||x.status})+'</div>').join(""):'<p class="att-empty">Todavía no has enviado solicitudes.</p>')+'</div></section>';
 }
 bindEmployee(){
  document.querySelector("#att-request")?.addEventListener("submit",ev=>{
   ev.preventDefault();const form=ev.currentTarget,f=new FormData(form);
   this.perform(async()=>await this.rpc("submit_attendance_request",{
    p_from:String(f.get("from")),p_to:String(f.get("to")),p_kind:String(f.get("kind")),p_reason:String(f.get("reason")).trim(),p_plan:null
   }));
  });
  document.querySelectorAll("[data-att-justify]").forEach(b=>b.onclick=()=>{
   const p=this.plans.find(x=>x.id===b.dataset.attJustify);if(!p)return;
   const why=prompt("Motivo de incidencia del turno "+this.dateTime(p)+" (mínimo 8 caracteres). No incluyas diagnósticos médicos.");
   if(why===null)return;
   const k=["late","late-early","late-extra"].includes(this.status(p).key)?"late":["early","extra"].includes(this.status(p).key)?"early_exit":"absence";
   this.perform(async()=>await this.rpc("submit_attendance_request",{
    p_from:p.work_date,p_to:p.work_date,p_kind:k,p_reason:why,p_plan:p.id
   }));
  });
 }
 adminDashboard(){
  const today=localDay(new Date()),planned=this.plans.filter(p=>p.work_date===today&&p.status==="scheduled");
  const alerts=planned.map(p=>({p,s:this.status(p)})).filter(x=>x.s.severity>=2);
  const pending=this.requests.filter(x=>x.status==="pending");
  return '<section class="card att-admin-snapshot"><div class="section-head"><div><div class="eyebrow">CONTROL DE ASISTENCIA</div><h2>Turnos y puntualidad de hoy</h2></div><button class="light" data-att-open="attendance">Ver control completo →</button></div>'+
   '<div class="att-mini-kpis"><div><small>Turnos previstos</small><strong>'+planned.length+'</strong></div>'+
   '<div><small>Avisos horarios</small><strong>'+alerts.length+'</strong></div>'+
   '<div><small>Justificaciones pendientes</small><strong>'+pending.length+'</strong></div></div>'+
   (alerts.length?'<div class="att-dashboard-warnings">'+alerts.slice(0,7).map(x=>'<div class="att-alert-item"><b>'+this.e(this.name(x.p.staff_id))+'</b><small>'+this.e(this.dateTime(x.p))+'</small>'+this.badge(x.s)+'</div>').join("")+'</div>':'<p class="att-empty">Sin retrasos ni ausencias detectados con los horarios asignados de hoy.</p>')+
   '<p class="att-helper">Las alertas se calculan a partir de los horarios publicados; no son sanciones ni justifican automáticamente una falta.</p></section>';
 }
 bindDashboard(onNavigate){
  document.querySelectorAll("[data-att-open]").forEach(b=>b.onclick=()=>onNavigate(b.dataset.attOpen));
 }
 adminSchedule({layout,heading}){
  const workers=this.getPeople().filter(x=>x.role==="employee");
  const start=this.week,days=Array.from({length:7},(_,i)=>plusDays(start,i));
  const shown=this.plans.filter(p=>p.status==="scheduled"&&p.work_date>=start&&p.work_date<=plusDays(start,6)&&
    (this.filterStaff==="all"||p.staff_id===this.filterStaff));
  const active=workers.filter(x=>x.active);
  let body=heading('Planificación<span class="accent">.</span>','Asigna turnos individuales, incluso partidos o terminados después de medianoche.')+
   '<section class="card"><div class="section-head"><h2>Nuevo turno</h2><span class="hint">Se comprobarán horarios solapados</span></div>'+
   '<form class="att-plan-form" id="att-add-plan"><label>Empleado<select name="staff" required>'+
   active.map(x=>'<option value="'+x.id+'">'+this.e(x.full_name)+'</option>').join("")+'</select></label>'+
   '<label>Día<input type="date" name="day" value="'+this.e(localDay(new Date()))+'" required></label>'+
   '<label>Entrada<input name="start" type="time" value="13:00" required></label>'+
   '<label>Salida<input name="end" type="time" value="17:00" required></label>'+
   '<label class="att-check"><input name="overnight" type="checkbox"> Sale al día siguiente</label>'+
   '<label class="att-full">Nota opcional<input name="note" maxlength="300" placeholder="Ej. servicio de cenas, preparación de sala"></label>'+
   '<button class="primary" type="submit" '+(!active.length?"disabled":"")+'>+ Guardar turno</button></form></section>'+
   '<section class="card"><div class="att-calendar-head"><div><div class="eyebrow">PLAN SEMANAL</div><h2>'+this.e(this.prettyDay(start))+' — '+this.e(this.prettyDay(plusDays(start,6)))+'</h2></div>'+
   '<div class="att-cal-controls"><button class="light" data-week="-7">‹ Anterior</button><button class="light" data-week="0">Hoy</button><button class="light" data-week="7">Siguiente ›</button></div></div>'+
   '<div class="att-calendar-filter"><label>Empleados<select id="att-staff-filter"><option value="all">Todo el equipo</option>'+
   workers.map(x=>'<option value="'+x.id+'" '+(this.filterStaff===x.id?"selected":"")+'>'+this.e(x.full_name)+'</option>').join("")+'</select></label>'+
   '<button class="light" data-copy-week>Copiar semana anterior a esta</button></div>'+
   '<div class="att-week-grid">'+days.map(d=>{
     const daily=shown.filter(p=>p.work_date===d);
     return '<div class="att-week-day"><div class="att-week-title">'+this.e(this.prettyDay(d))+'</div>'+
     (daily.length?daily.map(p=>'<div class="att-shift"><b>'+this.e(this.name(p.staff_id))+'</b><strong>'+this.time(p.starts_at)+'–'+this.time(p.ends_at)+'</strong>'+
      (localDay(p.ends_at)!==p.work_date?'<small>Salida +1 día</small>':'')+
      (p.note?'<small>'+this.e(p.note)+'</small>':'')+
      '<div class="att-row-controls"><button data-edit-plan="'+p.id+'">Editar</button><button data-cancel-plan="'+p.id+'">Anular</button></div></div>').join(""):'<div class="att-empty-day">Libre / sin turnos</div>')+'</div>'
   }).join("")+'</div></section>';
  layout(body);
  const form=document.querySelector("#att-add-plan");
  if(form)form.onsubmit=ev=>{
   ev.preventDefault();const f=new FormData(form);
   const st=String(f.get("day"))+"T"+f.get("start");
   const ed=(f.has("overnight")?plusDays(String(f.get("day")),1):String(f.get("day")))+"T"+f.get("end");
   this.perform(async()=>{
    const p_start=localMadridToISO(st),p_end=localMadridToISO(ed);
    if(new Date(p_end)<=new Date(p_start))throw Error("La salida debe ser después de la entrada. Para turnos nocturnos marca «Sale al día siguiente».");
    await this.rpc("admin_plan_shift",{p_staff:String(f.get("staff")),p_start,p_end,p_note:String(f.get("note")||""),p_id:null});
   });
  };
  document.querySelectorAll("[data-week]").forEach(b=>b.onclick=()=>{const n=Number(b.dataset.week);this.week=n?plusDays(this.week,n):this.weekBegin(localDay(new Date()));this.onChange()});
  document.querySelector("#att-staff-filter")?.addEventListener("change",ev=>{this.filterStaff=ev.target.value;this.onChange()});
  document.querySelectorAll("[data-cancel-plan]").forEach(b=>b.onclick=()=>{
   if(!confirm("¿Anular este horario? El cambio quedará auditado y se notificará al empleado al consultar sus turnos."))return;
   this.perform(async()=>await this.rpc("admin_cancel_plan",{p_id:b.dataset.cancelPlan}));
  });
  document.querySelectorAll("[data-edit-plan]").forEach(b=>b.onclick=()=>{
   const p=this.plans.find(x=>x.id===b.dataset.editPlan);if(!p)return;
   const from=prompt("Entrada (AAAA-MM-DDTHH:MM)",isoParts(p.starts_at));if(from===null)return;
   const to=prompt("Salida (AAAA-MM-DDTHH:MM)",isoParts(p.ends_at));if(to===null)return;
   const note=prompt("Nota del turno",p.note||"");if(note===null)return;
   this.perform(async()=>await this.rpc("admin_plan_shift",{p_staff:p.staff_id,p_start:localMadridToISO(from),p_end:localMadridToISO(to),p_note:note,p_id:p.id}));
  });
  document.querySelector("[data-copy-week]")?.addEventListener("click",()=>{
   const previousStart=plusDays(this.week,-7),previousEnd=plusDays(this.week,-1);
   const olds=this.plans.filter(p=>p.status==="scheduled"&&p.work_date>=previousStart&&p.work_date<=previousEnd&&
      (this.filterStaff==="all"||p.staff_id===this.filterStaff));
   if(!olds.length){this.notify("No hay turnos en la semana anterior para copiar.",true);return}
   if(!confirm("¿Copiar "+olds.length+" turnos de la semana anterior a esta? Los duplicados se omitirán."))return;
   this.perform(async()=>{
    let copied=0,skipped=0;
    for(const p of olds){
     const from=isoParts(p.starts_at),to=isoParts(p.ends_at);
     const proposedFrom=plusDays(from.slice(0,10),7)+from.slice(10);
     const proposedTo=plusDays(to.slice(0,10),7)+to.slice(10);
     if(this.plans.some(x=>x.staff_id===p.staff_id&&x.status==="scheduled"&&isoParts(x.starts_at)===proposedFrom)){skipped++;continue}
     try{
      await this.rpc("admin_plan_shift",{p_staff:p.staff_id,p_start:localMadridToISO(proposedFrom),p_end:localMadridToISO(proposedTo),p_note:p.note||"",p_id:null});copied++;
     }catch{skipped++}
    }
    if(!copied&&skipped)throw Error("No se pudo copiar ningún turno (duplicados o conflictos).");
    this.notify("Se copiaron "+copied+" turnos; omitidos "+skipped);
   });
  });
 }
 adminAttendance({layout,heading}){
  const today=localDay(new Date()),from=plusDays(today,-14),to=plusDays(today,7);
  const list=this.plans.filter(p=>p.status==="scheduled"&&p.work_date>=from&&p.work_date<=to).slice().sort((a,b)=>b.starts_at.localeCompare(a.starts_at));
  const alerts=list.map(p=>({p,s:this.status(p)})).filter(x=>x.s.severity>=2);
  const pending=this.requests.filter(r=>r.status==="pending");
  const todayPlans=list.filter(p=>p.work_date===today);
  const lateToday=todayPlans.filter(p=>this.status(p).key==="late");
  const missingToday=todayPlans.filter(p=>["missing","absent"].includes(this.status(p).key));
  layout(heading('Asistencia y avisos<span class="accent">.</span>','Cruce automático de turnos y fichajes, incidencias y justificaciones.')+
   '<div class="kpis att-attendance-kpis">'+[
     ["Turnos de hoy",todayPlans.length],["Entradas tarde hoy",lateToday.length],
     ["Sin fichar hoy",missingToday.length],["Solicitudes pendientes",pending.length]
   ].map(([k,v])=>'<div class="kpi"><small>'+k+'</small><strong>'+v+'</strong></div>').join("")+'</div>'+
   '<div class="two-panel"><section class="card"><div class="section-head"><h2>Alertas que revisar</h2><span class="counter">'+alerts.length+'</span></div>'+
   (alerts.length?alerts.slice(0,35).map(x=>'<div class="att-issue-line"><div><b>'+this.e(this.name(x.p.staff_id))+'</b><small>'+this.e(this.dateTime(x.p))+'</small></div>'+this.badge(x.s)+
     (["absent","missing"].includes(x.s.key)?'<button class="table-btn" data-att-admin-absence="'+x.p.id+'">Justificar falta</button>':"")+'</div>').join(""):'<p class="att-empty">Sin anomalías detectadas en los turnos.</p>')+
   '</section><section class="card"><div class="section-head"><h2>Solicitudes pendientes</h2><span class="counter">'+pending.length+'</span></div>'+
   (pending.length?pending.map(r=>'<div class="att-pending-request"><div><strong>'+this.e(this.name(r.staff_id))+' · '+this.e(kinds[r.kind]||r.kind)+'</strong><small>'+this.e(r.date_from)+(r.date_from===r.date_to?"":" — "+this.e(r.date_to))+'</small><p>'+this.e(r.reason)+'</p></div>'+
     '<div class="att-row-controls"><button data-req-review="'+r.id+'" data-verdict="approved">Aceptar</button><button data-req-review="'+r.id+'" data-verdict="rejected">Rechazar</button></div></div>').join(""):'<p class="att-empty">No hay justificaciones pendientes.</p>')+
   '</section></div>'+
   '<section class="card"><div class="section-head"><h2>Estado de turnos (últimas 2 semanas y próximos 7 días)</h2><span class="hint">Tolerancia visual: 5 minutos</span></div><div class="table-scroll"><table><thead><tr><th>Empleado</th><th>Turno previsto</th><th>Entrada real</th><th>Salida real</th><th>Situación</th></tr></thead><tbody>'+
   (list.length?list.map(p=>{const actual=this.getShift(p);return '<tr><td><b>'+this.e(this.name(p.staff_id))+'</b></td><td>'+this.e(this.dateTime(p))+'</td><td>'+this.e(actual?this.time(actual.started_at):"—")+'</td><td>'+this.e(actual?.ended_at?this.time(actual.ended_at):"—")+'</td><td>'+this.badge(this.status(p))+'</td></tr>'}).join(""):'<tr><td colspan="5" class="empty">No hay turnos en estas fechas.</td></tr>')+
   '</tbody></table></div></section>'+
   '<section class="card"><div class="section-head"><h2>Histórico de justificaciones</h2><span class="hint">Se conserva el estado y la revisión</span></div>'+
   '<div class="table-scroll"><table><thead><tr><th>Empleado</th><th>Fecha</th><th>Tipo</th><th>Comentario</th><th>Estado</th></tr></thead><tbody>'+
   (this.requests.length?this.requests.slice(0,60).map(r=>'<tr><td>'+this.e(this.name(r.staff_id))+'</td><td>'+this.e(r.date_from)+'</td><td>'+this.e(kinds[r.kind]||r.kind)+'</td><td>'+this.e(r.reason)+'</td><td>'+this.badge({key:r.status,label:states[r.status]||r.status})+'</td></tr>').join(""):'<tr><td class="empty" colspan="5">Sin solicitudes.</td></tr>')+'</tbody></table></div></section>');
  document.querySelectorAll("[data-req-review]").forEach(b=>b.onclick=()=>{
   const r=this.requests.find(x=>x.id===b.dataset.reqReview);
   const note=prompt("Nota de revisión para "+this.name(r.staff_id)+" (opcional):","");if(note===null)return;
   this.perform(async()=>await this.rpc("admin_review_attendance",{p_id:r.id,p_status:b.dataset.verdict,p_note:note}));
  });
  document.querySelectorAll("[data-att-admin-absence]").forEach(b=>b.onclick=()=>{
   const plan=this.plans.find(x=>x.id===b.dataset.attAdminAbsence);
   const reason=prompt("Motivo de ausencia justificada para "+this.name(plan.staff_id)+" el "+plan.work_date+" (mínimo 8 caracteres):");
   if(reason===null)return;
   const kind=confirm("¿Se trata de cita médica? Aceptar = médica; cancelar = otra ausencia justificada.")?"medical":"absence";
   this.perform(async()=>await this.rpc("admin_mark_absence",{p_staff:plan.staff_id,p_day:plan.work_date,p_kind:kind,p_reason:reason}));
  });
 }
}
