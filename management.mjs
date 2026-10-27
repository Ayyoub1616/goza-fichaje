import {localMadridToISO} from "./attendance.mjs";
const tz="Europe/Madrid";
const isoLocal=v=>{
 if(!v)return "";
 const p=new Intl.DateTimeFormat("en-GB",{timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(v));
 const get=k=>p.find(x=>x.type===k)?.value||"00";
 return get("year")+"-"+get("month")+"-"+get("day")+"T"+get("hour")+":"+get("minute");
};
const escCell=v=>{let s=typeof v==="object"?JSON.stringify(v):String(v??"");if(/^\s*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
const kinds={
 manual_shift:"Fichaje añadido por administración",
 shift_correction:"Fichaje corregido",role_change:"Cambio de permisos",
 schedule_create:"Horario creado",schedule_update:"Horario actualizado",
 schedule_cancel:"Horario anulado",attendance_request:"Solicitud de justificación",
 attendance_review:"Justificación revisada",incident_submit:"Incidencia comunicada",
 incident_review:"Incidencia revisada",staff_create:"Alta de empleado",
 staff_reset:"Contraseña restablecida",staff_status:"Cambio de estado del empleado"
};
export class GozaManagement{
 constructor({db,e,fmt,getMe,getPeople,getShifts,notify,reload}){
 this.db=db;this.e=e;this.fmt=fmt;this.getMe=getMe;this.getPeople=getPeople;
 this.getShifts=getShifts;this.notify=notify;this.reload=reload;
 this.audit=[];this.auditFilter="all";this.busy=false;
 }
 async rpc(name,p){const r=await this.db.rpc(name,p);if(r.error)throw Error(r.error.message);return r.data}
 async load(){
  if(this.getMe()?.role!=="admin"){this.audit=[];return}
  const r=await this.db.from("admin_audit").select("*").order("at",{ascending:false}).limit(1500);
  if(r.error)throw r.error;
  this.audit=r.data||[];
 }
 name(id){return this.getPeople().find(x=>x.id===id)?.full_name||"—"}
 canManageEmployees(){return this.getMe()?.role==="admin"}
 async run(fn){
  if(this.busy)return;this.busy=true;
  try{await fn();await this.reload();this.notify("Operación guardada y auditada")}
  catch(e){this.notify(e?.message||"Error al guardar",true)}
  finally{this.busy=false}
 }
 manualCard(){
  const employees=this.getPeople().filter(x=>x.role==="employee"||x.role==="manager");
  const d=isoLocal(new Date().toISOString());
  return '<section class="card goza-manual-card"><div class="section-head"><div><div class="eyebrow">GESTIÓN DE FICHAJES</div><h2>Fichar por un empleado</h2></div><span class="goza-legal">Con auditoría</span></div>'+
  '<p class="goza-help">Úsalo cuando alguien haya olvidado fichar. Registra la hora real comunicada, tu identidad y una justificación. No modifica las marcas anteriores.</p>'+
  '<form id="supervisor-add-shift" class="goza-manual-form"><label>Empleado<select name="staff" required>'+employees.map(x=>'<option value="'+x.id+'">'+this.e(x.full_name)+' · '+this.e(x.employee_code)+'</option>').join("")+'</select></label>'+
  '<label>Entrada real (Zaragoza)<input type="datetime-local" name="start" required value="'+d+'"></label>'+
  '<label>Salida real (opcional si sigue trabajando)<input type="datetime-local" name="end" placeholder="Dejar vacío si la jornada sigue abierta"></label>'+
  '<label>Pausa no trabajada (min)<input type="number" name="pause" value="0" min="0" max="720" step="1" required></label>'+
  '<label class="goza-span2">Motivo de la intervención<textarea name="reason" required minlength="8" maxlength="1000" placeholder="El empleado olvidó registrar la entrada. Turno confirmado por el encargado."></textarea></label>'+
  '<div class="goza-manual-shortcuts"><button class="light" type="button" data-start-now>Entrada = ahora</button><button class="light" type="button" data-end-now>Salida = ahora</button><button class="light" type="button" data-end-clear>Jornada abierta</button></div>'+
  '<button class="primary" type="submit">+ Registrar fichaje manual</button></form></section>';
 }
 bindManual(){
  const form=document.getElementById("supervisor-add-shift");if(!form)return;
  form.querySelector("[data-start-now]").onclick=()=>{form.elements.start.value=isoLocal(new Date().toISOString())};
  form.querySelector("[data-end-now]").onclick=()=>{form.elements.end.value=isoLocal(new Date().toISOString())};
  form.querySelector("[data-end-clear]").onclick=()=>{form.elements.end.value=""};
  form.onsubmit=ev=>{ev.preventDefault();const f=new FormData(form);const reason=String(f.get("reason")||"").trim();if(reason.length<8)return this.notify("Indica el motivo de la intervención",true);
   this.run(async()=>{
    const start=localMadridToISO(String(f.get("start"))),end=f.get("end")?localMadridToISO(String(f.get("end"))):null;
    await this.rpc("supervisor_add_shift",{
     p_staff:String(f.get("staff")),p_start:start,p_end:end,
     p_paused_seconds:Math.round(Number(f.get("pause"))*60),p_reason:reason,p_plan:null
    });
   });
  };
 }
 correctionModal(shiftId){
  const s=this.getShifts().find(x=>x.id===shiftId);
  if(!s)return this.notify("Fichaje no encontrado",true);
  const wrapper=document.createElement("div");wrapper.className="goza-modal-shell";wrapper.id="goza-correct-modal";
  wrapper.innerHTML='<div class="goza-modal-mask" data-close-correction></div><section class="goza-dialog" role="dialog" aria-modal="true" aria-label="Corregir fichaje">'+
   '<div class="section-head"><div><div class="eyebrow">CAMBIO AUDITADO</div><h2>Corregir fichaje</h2></div><button class="light" type="button" data-close-correction>Cerrar ×</button></div>'+
   '<p class="goza-help">'+this.e(this.name(s.staff_id))+' · Se conservarán los valores anteriores y los nuevos.</p>'+
   '<form id="correct-shift-form" class="goza-manual-form"><label>Entrada<input name="start" type="datetime-local" required value="'+isoLocal(s.started_at)+'"></label>'+
   '<label>Salida<input name="end" type="datetime-local" required value="'+isoLocal(s.ended_at||new Date().toISOString())+'"></label>'+
   '<label>Pausa (minutos)<input name="pause" type="number" min="0" max="720" value="'+Math.round(s.paused_seconds/60)+'" required></label>'+
   '<label class="goza-span2">Motivo de corrección<textarea required name="reason" minlength="8" maxlength="1000" placeholder="Se olvidó fichar al llegar; verificado con el responsable."></textarea></label>'+
   '<button class="primary" type="submit">Guardar corrección con auditoría</button></form></section>';
  document.body.appendChild(wrapper);
  wrapper.querySelectorAll("[data-close-correction]").forEach(b=>b.onclick=()=>wrapper.remove());
  wrapper.querySelector("#correct-shift-form").onsubmit=ev=>{
   ev.preventDefault();const f=new FormData(ev.currentTarget);
   this.run(async()=>{
    await this.rpc("correct_shift",{p_id:shiftId,p_start:localMadridToISO(String(f.get("start"))),
     p_end:localMadridToISO(String(f.get("end"))),
     p_pause_seconds:Math.round(Number(f.get("pause"))*60),p_reason:String(f.get("reason")).trim()});
    wrapper.remove();
   });
  };
 }
 ownerRolesCard(){
  if(!this.canManageEmployees())return "";
  const employees=this.getPeople().filter(x=>x.role!=="admin");
  return '<section class="card"><div class="section-head"><div><div class="eyebrow">PERMISOS</div><h2>Delegar en un encargado</h2></div><span class="goza-legal">Solo tú</span></div>'+
   '<p class="goza-help">Un encargado puede consultar horarios, aprobar incidencias, corregir o crear fichajes y revisar puntualidad. No puede crear empleados, cambiar contraseñas ni conceder permisos.</p>'+
   '<div class="goza-role-list">'+employees.map(x=>'<div class="goza-role-row"><div><b>'+this.e(x.full_name)+'</b><small>'+this.e(x.employee_code)+'</small></div><span class="att-badge '+(x.role==="manager"?"att-approved":"att-planned")+'">'+(x.role==="manager"?"ENCARGADO":"EMPLEADO")+'</span>'+
      '<button type="button" class="table-btn" data-manage-role="'+x.id+'">'+(x.role==="manager"?"Retirar permisos":"Hacer encargado")+'</button></div>').join("")+'</div></section>';
 }
 bindRoles(){
  document.querySelectorAll("[data-manage-role]").forEach(b=>b.onclick=()=>{
   const p=this.getPeople().find(x=>x.id===b.dataset.manageRole),role=p.role==="manager"?"employee":"manager";
   const message=role==="manager"?"Convertir a encargado con permiso para corregir fichajes y aprobar solicitudes":"Retirar los permisos del encargado";
   if(!confirm(message+" de "+p.full_name+"?"))return;
   const reason=prompt("Motivo del cambio de permisos (mínimo 8 caracteres):",role==="manager"?"Delegación operativa de encargado":"Fin de la delegación operativa");
   if(reason===null)return;
   this.run(async()=>await this.rpc("owner_set_role",{p_staff:p.id,p_role:role,p_reason:reason}));
  });
 }
 auditPage({layout,heading}){
  if(!this.canManageEmployees())return;
  const entries=this.audit.filter(x=>this.auditFilter==="all"||x.action===this.auditFilter);
  const types=[...new Set(this.audit.map(x=>x.action))].sort();
  layout(heading('Registro de auditoría<span class="accent">.</span>','Quién hizo cada cambio, cuándo, sobre qué empleado y con qué justificación.')+
   '<section class="card"><div class="section-head"><h2>Historial de modificaciones</h2><span class="goza-legal">Solo administrador principal</span></div>'+
   '<div class="goza-audit-toolbar"><label>Filtrar por acción<select id="goza-audit-filter"><option value="all">Todas las acciones</option>'+
   types.map(k=>'<option '+(k===this.auditFilter?"selected":"")+' value="'+this.e(k)+'">'+this.e(kinds[k]||k)+'</option>').join("")+
   '</select></label><button class="light" id="goza-audit-export">↓ Exportar auditoría</button></div>'+
   '<div class="table-scroll"><table><thead><tr><th>Fecha y hora</th><th>Acción</th><th>Quién lo hizo</th><th>Empleado afectado</th><th>Antes / después</th><th>Motivo</th></tr></thead><tbody>'+
   (entries.length?entries.map(x=>'<tr><td>'+this.fmt(x.at)+'</td><td><b>'+this.e(kinds[x.action]||x.action)+'</b></td><td>'+this.e(this.name(x.actor_staff_id))+'</td><td>'+this.e(this.name(x.target_staff_id))+'</td>'+
    '<td><details><summary>Ver cambios</summary><pre class="goza-audit-data">'+this.e(JSON.stringify({antes:x.before_data,despues:x.after_data},null,2))+'</pre></details></td><td>'+this.e(x.reason||'—')+'</td></tr>').join(""):'<tr><td colspan="6" class="empty">No hay cambios registrados.</td></tr>')+'</tbody></table></div></section>');
  document.querySelector("#goza-audit-filter").onchange=ev=>{this.auditFilter=ev.target.value;this.auditPage({layout,heading})};
  document.querySelector("#goza-audit-export").onclick=()=>{
   const rows=[["Fecha UTC","Acción","Operador","Empleado","Datos anteriores","Datos nuevos","Motivo"],
    ...entries.map(x=>[x.at,kinds[x.action]||x.action,this.name(x.actor_staff_id),this.name(x.target_staff_id),
     x.before_data,x.after_data,x.reason])];
   const csv="\ufeff"+rows.map(r=>r.map(escCell).join(";")).join("\r\n");
   const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");
   a.href=url;a.download="goza-auditoria.csv";a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
  };
 }
}