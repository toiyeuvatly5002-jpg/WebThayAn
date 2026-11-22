const {createPrivateKey}=require("node:crypto");

function configError(code,message){
 return Object.assign(Error(message),{status:503,diagnostic:code});
}
function firebaseConfig(env){
 const missing=["FIREBASE_DATABASE_URL","FIREBASE_SERVICE_ACCOUNT"].filter(name=>!env[name]?.trim());
 if(missing.length)throw configError("CFG_MISSING","Netlify Functions đang thiếu "+missing.join(", ")+".");
 const raw=env.FIREBASE_DATABASE_URL.trim();
 let url;
 try{url=new URL(raw)}catch{}
 if(!url||url.protocol!=="https:"||!/\.(?:firebaseio\.com|firebasedatabase\.app)$/.test(url.hostname)||url.pathname!=="/"||url.search||url.hash||url.username||url.password||url.port){
 throw configError("CFG_DATABASE_URL","FIREBASE_DATABASE_URL cần là URL gốc của Realtime Database trong Firebase Console.");
 }
 let sa;
 try{sa=JSON.parse(env.FIREBASE_SERVICE_ACCOUNT.trim());if(typeof sa==="string")sa=JSON.parse(sa)}catch{}
 if(!sa?.project_id||!sa?.client_email||typeof sa.private_key!=="string")throw configError("CFG_ACCOUNT","FIREBASE_SERVICE_ACCOUNT cần chứa toàn bộ JSON tài khoản dịch vụ, gồm project_id, client_email và private_key.");
 sa.private_key=sa.private_key.replace(/\\n/g,"\n");
 try{createPrivateKey(sa.private_key)}catch{throw configError("CFG_KEY","Không đọc được private_key trong FIREBASE_SERVICE_ACCOUNT. Hãy đối chiếu với JSON tài khoản dịch vụ gốc.")}
 return {serviceAccount:sa,databaseURL:url.origin};
}
function firstAdmin(env){
 const code=env.BOOTSTRAP_ADMIN_CODE?.trim();
 if(!/^\d{5}$/.test(code||""))throw configError("CFG_FIRST_ADMIN","Database mới cần BOOTSTRAP_ADMIN_CODE gồm đúng 5 chữ số trong Netlify Functions.");
 return code;
}
function serverFailure(e,action,requestId){
 const tag=String(e.diagnostic||e.code||e.name||"unknown").replace(/[^A-Za-z0-9_/-]/g,"").slice(0,80);
 const hints={
 "app/invalid-credential":"Firebase từ chối thông tin xác thực của tài khoản dịch vụ.",
 "PERMISSION_DENIED":"Firebase từ chối quyền truy cập Realtime Database của máy chủ.",
 "database/permission-denied":"Firebase từ chối quyền truy cập Realtime Database của máy chủ.",
 "app/network-error":"Máy chủ chưa kết nối được với Firebase."
 };
 if(!e.status||e.status>=500)console.error("school backend", {requestId,action:["login","catalog"].includes(action)?action:"school",code:tag});
 const status=e.status||503;
 const message=e.status?e.message:(hints[tag]||"Không kết nối được dịch vụ phòng học. Quản trị viên có thể tra mã lỗi trong Functions → school.");
 return {statusCode:status,body:JSON.stringify({error:message+(status>=500?" (Mã tra cứu "+requestId+")":"")})};
}
module.exports={firebaseConfig,firstAdmin,serverFailure};
