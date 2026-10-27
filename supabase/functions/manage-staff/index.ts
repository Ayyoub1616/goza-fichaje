// Supabase Edge Function: manage-staff. Deploy con verify_jwt=true.
// Supabase provee SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY en servidor.
// Nunca publicar SERVICE_ROLE en GitHub Pages ni en config.js.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
const allowOrigins=new Set(["https://ayyoub1616.github.io","http://localhost:5173","http://localhost:8080"]);
const reply=(status:number,body:Record<string,unknown>,cors:Record<string,string>)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...cors}});
const str=(v:unknown)=>typeof v==="string"?v.trim():"";
const alphabet="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#";
function newSecret(){const a=new Uint32Array(20);crypto.getRandomValues(a);return Array.from(a,v=>alphabet[v%alphabet.length]).join("");}
function errorMsg(e:unknown){return e instanceof Error?e.message:"Error desconocido";}
Deno.serve(async req=>{
 const origin=req.headers.get("origin")||"";
 const cors={"Access-Control-Allow-Origin":allowOrigins.has(origin)?origin:"https://ayyoub1616.github.io",
   "Vary":"Origin","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
   "Access-Control-Allow-Methods":"POST,OPTIONS"};
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="POST")return reply(405,{error:"Método no permitido"},cors);
 if(origin&&!allowOrigins.has(origin))return reply(403,{error:"Origen no autorizado"},cors);
 try{
   const projectUrl=Deno.env.get("SUPABASE_URL");
   const publishKey=Deno.env.get("SUPABASE_ANON_KEY");
   const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
   if(!projectUrl||!publishKey||!serviceKey)throw new Error("Falta configurar el servidor.");
   const authz=req.headers.get("Authorization")||"";
   const jwt=authz.replace(/^Bearer\s+/i,"");
   if(!jwt||jwt===publishKey)return reply(401,{error:"Inicia sesión"},cors);
   const publicClient=createClient(projectUrl,publishKey,{auth:{persistSession:false,autoRefreshToken:false}});
   const who=await publicClient.auth.getUser(jwt);
   if(who.error||!who.data.user)return reply(401,{error:"Sesión inválida"},cors);
   const admin=createClient(projectUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
   const owner=await admin.from("staff").select("id,role,active").eq("user_id",who.data.user.id).maybeSingle();
   if(owner.error||owner.data?.role!=="admin"||owner.data?.active!==true)return reply(403,{error:"Acceso reservado al administrador"},cors);
   const body=await req.json();
   const action=str(body.action);
   if(action==="create"){
     const name=str(body.name),code=str(body.code).toUpperCase(),weekly=body.weeklyTarget;
     if(name.length<2||name.length>100||!/^[A-Z0-9-]{3,24}$/.test(code))
       return reply(400,{error:"Nombre o código no válido (mín. 3 caracteres A-Z, 0-9, guion)"},cors);
     if(weekly!==null&&weekly!==""&&weekly!==undefined&&(!Number.isFinite(Number(weekly))||Number(weekly)<0||Number(weekly)>60))
       return reply(400,{error:"Horas semanales no válidas"},cors);
     const {count,error:countError}=await admin.from("staff").select("id",{count:"exact",head:true}).eq("active",true).eq("role","employee");
     if(countError)throw countError;
     if((count||0)>=10)return reply(409,{error:"Límite de 10 empleados activos"},cors);
     const existing=await admin.from("staff").select("id").eq("employee_code",code).maybeSingle();
     if(existing.data)return reply(409,{error:"Ese código ya está registrado"},cors);
     const password=newSecret();
     const email=code.toLowerCase()+"@goza-staff.example.com";
     const made=await admin.auth.admin.createUser({email,password,email_confirm:true});
     if(made.error||!made.data.user)return reply(409,{error:"No se pudo crear el acceso. Comprueba que el código sea único."},cors);
     const ins=await admin.from("staff").insert({
       user_id:made.data.user.id,employee_code:code,full_name:name,role:"employee",active:true,
       weekly_target:weekly===""||weekly===null||weekly===undefined?null:Number(weekly)
     }).select("id").single();
     if(ins.error){await admin.auth.admin.deleteUser(made.data.user.id);return reply(400,{error:"No se pudo registrar el empleado: "+ins.error.message},cors);}
     return reply(200,{ok:true,code,password,note:"Entrega la contraseña por un canal privado. Solo se muestra ahora."},cors);
   }
   if(action==="reset"||action==="toggle"){
     const id=str(body.staffId);
     if(!/^[0-9a-f-]{36}$/i.test(id))return reply(400,{error:"Empleado inválido"},cors);
     const one=await admin.from("staff").select("id,user_id,role,active").eq("id",id).maybeSingle();
     if(one.error||!one.data||one.data.role!=="employee")return reply(404,{error:"Empleado no encontrado"},cors);
     if(action==="reset"){
       const password=newSecret();
       const upd=await admin.auth.admin.updateUserById(one.data.user_id,{password});
       if(upd.error)throw upd.error;
       return reply(200,{ok:true,password,note:"La nueva contraseña sustituye a la anterior. Cópiala ahora."},cors);
     }
     const active=Boolean(body.active);
     if(active){
       const {count}=await admin.from("staff").select("id",{count:"exact",head:true}).eq("active",true).eq("role","employee");
       if((count||0)>=10)return reply(409,{error:"Máximo 10 empleados activos"},cors);
     }
     const upd=await admin.from("staff").update({active}).eq("id",id).eq("role","employee");
     if(upd.error)throw upd.error;
     return reply(200,{ok:true},cors);
   }
   if(action==="target"){
     const id=str(body.staffId),v=body.weeklyTarget;
     if(!/^[0-9a-f-]{36}$/i.test(id)||v!==null&&v!==""&&(!Number.isFinite(Number(v))||Number(v)<0||Number(v)>60))
       return reply(400,{error:"Datos inválidos"},cors);
     const upd=await admin.from("staff").update({weekly_target:v===""||v===null?null:Number(v)}).eq("id",id).eq("role","employee");
     if(upd.error)throw upd.error;
     return reply(200,{ok:true},cors);
   }
   return reply(400,{error:"Acción desconocida"},cors);
 }catch(e){return reply(500,{error:"No se ha podido completar la operación: "+errorMsg(e)},cors);}
});