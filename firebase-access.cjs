const crypto=require("node:crypto");
const {run,submissionReceipt}=require("./service.cjs");

const reads=new Set(["catalog","history","open","accounts","report","templateAdmin","review","gradingQueue","gradingPaper"]);
const deny=(status,message)=>{throw Object.assign(Error(message),{status})};
const value=async ref=>(await ref.get()).val();
const safeKey=s=>typeof s==="string"&&/^[\w-]{1,180}$/.test(s);
async function byItem(ref,id){
 if(!safeKey(id))deny(404,"Không tìm thấy bài.");
 const items=ref.child("items");
 const location=ref.child("itemLocations/"+id);
 const key=await value(location);
 if(safeKey(key)){
  const item=await value(items.child(key));
  if(item?.id===id)return [item];
 }
 // Older publications store the UUID inside a numerically keyed collection.
 const snapshot=await items.get();
 let match;
 snapshot.forEach(child=>{
  const item=child.val();
  if(item?.id!==id)return false;
  match={key:child.key,item};
  return true;
 });
 if(!match)return [];
 try{await location.set(match.key)}catch{console.warn("school: item location could not be cached")}
 return [match.item];
}
// Load only the authenticated student's history, never the whole school ledger.
async function scoped(ref,action,b,token,address){
 const digest=crypto.createHash("sha256").update(token||"").digest("hex");
 const session=await value(ref.child("sessions/"+digest));
 if(!session||session.until<=Date.now()||!/^\d{5}$/.test(session.code))deny(401,"Hãy đăng nhập lại.");
 const code=session.code,user=await value(ref.child("users/"+code));
 if(!user)deny(401,"Hãy đăng nhập lại.");
 if(["accounts","report","templateAdmin","gradingQueue","gradingPaper"].includes(action)&&user.role!=="admin")deny(403,"Chỉ quản trị viên được truy cập.");
 const db={users:{[code]:user},sessions:{[digest]:session},items:[],results:{}};
 if(action==="catalog")db.items=Object.values(await value(ref.child("items"))||{});
 if(action==="accounts")db.users=await value(ref.child("users"))||{};
 if(["templateAdmin","open","review","gradingPaper"].includes(action))db.template=await value(ref.child("template"))||{};
 if(action==="history"||action==="report"){
 const owner=action==="history"?code:b.code;
 if(owner&&!/^\d{5}$/.test(owner))deny(400,"Mã học sinh không hợp lệ.");
 const query=ref.child("results");
 db.results=owner?(await query.orderByKey().startAt(owner+"_").endAt(owner+"_\uf8ff").once("value")).val()||{}:await value(query)||{};
 }
 if(action==="gradingQueue")db.results=await value(ref.child("results"))||{};
 if(action==="gradingPaper"){
  if(!safeKey(b.attempt))deny(404,"Mã bài không hợp lệ.");
  const r=await value(ref.child("results/"+b.attempt));if(r){db.results[b.attempt]=r;db.items=await byItem(ref,r.id)}
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
 return submissionReceipt(write.snapshot.val(),id);
}
module.exports={reads,scoped};
