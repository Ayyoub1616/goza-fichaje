// Regression test for GOZA's login, requires only Node.js.
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("app.js","utf8");
const from=source.indexOf(' $("#signin").onsubmit=async e=>{');
const to=source.indexOf('\nfunction renderBlocked()',from);
assert.ok(from>=0&&to>from,"Login submit handler exists");
let snippet=source.slice(from,to).trim();
assert.ok(snippet.endsWith("}"),"Login function closes");
snippet=snippet.slice(0,-1);
async function test(mode,identity,error=null){
 let calls=0,initCalls=0,notices=[];
 const submit={disabled:false,textContent:"",isConnected:true};
 const form={querySelector:()=>submit};
 const make=new Function("FormData","db","notice","fmtError","init","loginMode",
  'let busy=false;const element={};const $=()=>element;'+snippet+'\nreturn element.onsubmit;');
 const handler=make(class {get(name){return name==="identity"?identity:"safe-test-password"}},
  {auth:{signInWithPassword:async()=>{calls++;return {error}}}},
  (s,b)=>notices.push({message:s,bad:b}),e=>e.message,
  async()=>{initCalls++},mode);
 assert.equal(typeof handler,"function");
 await handler({preventDefault(){},currentTarget:form});
 return {calls,initCalls,notices,submit};
}
(async()=>{
 let ok=await test("admin","test@example.com");
 assert.equal(ok.calls,1,"Admin login must invoke Supabase once");
 assert.equal(ok.initCalls,1,"Successful admin login must open dashboard");
 assert.equal(ok.submit.disabled,false);
 let bad=await test("employee","GOZA-001",{message:"invalid"});
 assert.equal(bad.calls,1,"Employee login must invoke Supabase once");
 assert.equal(bad.initCalls,0);
 assert.ok(bad.notices.some(n=>n.bad),"Authentication failures must give feedback");
 assert.equal(bad.submit.disabled,false,"Button should unlock after error");
 let invalid=await test("employee","no spaces allowed !");
 assert.equal(invalid.calls,0,"Invalid employee codes should not call authentication");
 assert.ok(invalid.notices.some(n=>n.bad),"Invalid codes should give feedback");
 console.log("GOZA login tests passed (admin, employee, errors, invalid codes).");
})().catch(e=>{console.error(e);process.exitCode=1});
