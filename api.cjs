const fs=require("node:fs"),path=require("node:path");
const {run,seed}=require("./service.cjs");
const localPath=path.join(__dirname,".local","school.json");
const {firebaseConfig,firstAdmin,serverFailure}=require("./backend-config.cjs");
async function handle(event,local=false){
 let operation; const requestId=require("node:crypto").randomUUID().slice(0,12);
 const headers={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
 try{
 if(event.httpMethod!=="POST")throw Object.assign(Error("Dùng POST."),{status:405});
 if((event.body||"").length>4500000)throw Object.assign(Error("Dữ liệu quá lớn."),{status:413});
 const {action,...body}=JSON.parse(event.body||"{}"), h=event.headers||{};
 operation=action; const token=(h.cookie||"").match(/(?:^|; )ph_session=([a-f0-9]{64})/)?.[1];
 let result;
 function apply(db){result=run(db,action,body,token,h["x-nf-client-connection-ip"]||"local");return db}
 if(local){
 fs.mkdirSync(path.dirname(localPath),{recursive:true});
 const db=fs.existsSync(localPath)?JSON.parse(fs.readFileSync(localPath)):seed(firstAdmin(process.env));
 if(action==="tikz"){run(db,"templateAdmin",{},token,"local");result=await require("./tikz.cjs").render(body.source,body.libraries)}else{apply(db);fs.writeFileSync(localPath+".tmp",JSON.stringify(db));fs.renameSync(localPath+".tmp",localPath);}
 }else{
 const cfg=firebaseConfig(process.env);
 const {getApps,initializeApp,cert}=require("firebase-admin/app");
 const {getDatabase}=require("firebase-admin/database");
 const app=getApps()[0]||initializeApp({credential:cert(cfg.serviceAccount),databaseURL:cfg.databaseURL});
 const ref=getDatabase(app).ref("phongHocV2");
 const {reads,scoped}=require("./firebase-access.cjs");
 if(action==="tikz"){await scoped(ref,"templateAdmin",{},token,"");result=await require("./tikz.cjs").render(body.source,body.libraries)}else if(reads.has(action)||action==="submit"){
 result=await scoped(ref,action,body,token,h["x-nf-client-connection-ip"]||"local");
 }else{
 const initial=(await ref.get()).val();
 await ref.transaction(value=>apply(Object.assign({sessions:{},limits:{},results:{}},value||initial||seed(firstAdmin(process.env)))),undefined,false);
 }
 } if(result.secret||action==="logout"){
 headers["Set-Cookie"]="ph_session="+(result.secret||"")+"; HttpOnly; SameSite=Strict; Path=/; Max-Age="+(action==="logout"?0:28800)+(local?"":"; Secure");delete result.secret;
 }
 return {statusCode:result.status||200,headers,body:JSON.stringify(result)};
 }catch(e){return {headers,...serverFailure(e,operation,requestId)}}
}
module.exports={handle};





