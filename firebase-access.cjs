const crypto=require("node:crypto");
const {run}=require("./service.cjs");

const reads=new Set(["catalog","history","open","accounts","report","templateAdmin","review"]);
const deny=(status,message)=>{throw Object.assign(Error(message),{status})};
const value=async ref=>(await ref.get()).val();
const safeKey=s=>typeof s==="string"&&/^[\w-]{1,180}$/.test(s);
async function byItem(ref,id){
 if(!safeKey(id))deny(404,"Không tìm thấy bài.");
 return Object.values(await value(ref.child("items").orderByChild("id").equalTo(id))||{});
}
// Load only the authenticated student's history, never the whole school ledger.
async function scoped(ref,action,b,token,address){
 const digest=crypto.createHash("sha256").update(token||"").digest("hex");
 const session=await value(ref.child("sessions/"+digest));
 if(!session||session.until<=Date.now()||!/^\d{5}$/.test(session.code))deny(401,"Hãy đăng nhập lại.");
 const code=session.code,user=await value(ref.child("users/"+code));
 if(!user)deny(401,"Hãy đăng nhập lại.");
 if(["accounts","report","templateAdmin"].includes(action)&&user.role!=="admin")deny(403,"Chỉ quản trị viên được truy cập.");
 const db={users:{[code]:user},sessions:{[digest]:session},items:[],results:{}};
 if(action==="catalog")db.items=Object.values(await value(ref.child("items"))||{});
 if(action==="accounts")db.users=await value(ref.child("users"))||{};
 if(action==="templateAdmin"||action==="open")db.template=await value(ref.child("template"))||{};
 if(action==="history"||action==="report"){
 const owner=action==="history"?code:b.code;
 if(owner&&!/^\d{5}$/.test(owner))deny(400,"Mã học sinh không hợp lệ.");
 const query=ref.child("results");
 db.results=await value(owner?query.orderByKey().startAt(owner+"_").endAt(owner+"_\uf8ff"):query)||{};
 }
 if(action==="review"){
 if(!safeKey(b.attempt)||!b.attempt.startsWith(code+"_"))deny(404,"Không tìm thấy lượt làm của bạn.");
 const r=await value(ref.child("results/"+b.attempt));
 if(!r||r.code!==code)deny(404,"Không tìm thấy lượt làm của bạn.");
 db.results[b.attempt]=r;db.items=await byItem(ref,r.id);
 }
 if(action==="open"||action==="submit")db.items=await byItem(ref,b.id);
 const result=run(db,action,b,token,address);
 if(action!=="submit")return result;
 const id=result.attempt;
 const write=await ref.child("results/"+id).transaction(existing=>existing||db.results[id],undefined,false);
 return {...write.snapshot.val(),attempt:id};
}
module.exports={reads,scoped};
