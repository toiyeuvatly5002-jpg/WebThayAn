const assert=require("node:assert/strict"),Module=require("node:module"),crypto=require("node:crypto");
const {handler}=require("../netlify/functions/school");
const {firebaseConfig}=require("../backend-config.cjs");
const env=process.env;
const entries=["FIREBASE_DATABASE_URL","FIREBASE_SERVICE_ACCOUNT","BOOTSTRAP_ADMIN_CODE"];
const saved=entries.map(k=>env[k]);
let db=null;
function ref(parts=[]){
 const current=()=>parts.reduce((v,k)=>v?.[k],db)??null;
 return {child:k=>ref([...parts,...k.split("/")]),get:async()=>({val:current}),
 transaction:async fn=>{assert.equal(parts.length,0);db=fn(structuredClone(db));return {committed:true,snapshot:{val:()=>db}}}};
}
const original=Module._load;
Module._load=function(id,...args){
 if(id==="firebase-admin/app")return {getApps:()=>[],initializeApp:x=>x,cert:x=>x};
 if(id==="firebase-admin/database")return {getDatabase:()=>({ref:()=>ref()})};
 return original.call(this,id,...args);
};
async function post(action,params={},cookie=""){
 const res=await handler({httpMethod:"POST",headers:{cookie},body:JSON.stringify({action,...params})},{});
 return {...res,data:JSON.parse(res.body)};
}
(async()=>{
 for(const k of entries)delete env[k];
 assert.match((await post("login",{code:"38162"})).data.error,/FIREBASE_DATABASE_URL/);
 env.FIREBASE_DATABASE_URL="https://test-default-rtdb.firebaseio.com";
 env.FIREBASE_SERVICE_ACCOUNT="{";
 assert.match((await post("login",{code:"38162"})).data.error,/JSON/);
 const {privateKey}=crypto.generateKeyPairSync("rsa",{modulusLength:2048});
 const pem=privateKey.export({type:"pkcs8",format:"pem"});
 env.FIREBASE_SERVICE_ACCOUNT=JSON.stringify({project_id:"test",client_email:"test@example.org",private_key:pem.replaceAll("\n","\\n")});
 assert.equal(firebaseConfig(env).serviceAccount.private_key,pem);
 assert.match((await post("login",{code:"38162"})).data.error,/BOOTSTRAP_ADMIN_CODE/);
 env.BOOTSTRAP_ADMIN_CODE=" 38162 ";
 const login=await post("login",{code:"38162"});assert.equal(login.statusCode,200);
 const cookie=login.headers["Set-Cookie"].split(";")[0];assert.equal((await post("catalog",{},cookie)).data.user.role,"admin");
 delete env.BOOTSTRAP_ADMIN_CODE;
 assert.equal((await post("login",{code:"38162"})).statusCode,200);
 assert.equal((await post("login",{code:"83917"})).statusCode,401);
 console.log("PASS cloud handler with simulated database: first login, session, existing admin, invalid code and config diagnostics");
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{
 Module._load=original;entries.forEach((k,i)=>{if(saved[i]===undefined)delete env[k];else env[k]=saved[i]});
});
