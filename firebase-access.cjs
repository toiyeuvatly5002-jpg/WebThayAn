const crypto=require("node:crypto");
const {run,submissionReceipt,scoreSubmission,itemView,validAttempt}=require("./service.cjs");
const timed=require("./timed-attempt.cjs");

const reads=new Set(["catalog","history","open","adminItem","accounts","report","templateAdmin","review","gradingQueue","gradingPaper"]);
const deny=(status,message)=>{throw Object.assign(Error(message),{status})};
const value=async ref=>(await ref.get()).val();
const safeKey=s=>typeof s==="string"&&/^[\w-]{1,180}$/.test(s);
async function timedRequest(ref,item,code,user,action,b,template,session,digest){
 const owner=code+"_"+item.id;
 const latest=ref.child("timedLatest/"+owner);
 const resultRef=id=>ref.child("results/"+owner+"_"+id);
 if(action==="submit"){
  if(timed.validFreeTicket(session,item.id,b.attemptId))return null;
  if(item.durationMinutes)deny(409,"Hãy mở lại đề để dùng lượt làm có đồng hồ.");
  const slot=await value(latest);
  if(slot && timed.isWorking(await value(resultRef(slot.attemptId))))deny(409,"Lượt làm đang có đồng hồ.");
  return null;
 }
 let slot,prior;
 if(action==="open"){
  slot=await value(latest);
  prior=slot && await value(resultRef(slot.attemptId));
  if(item.retired&&(!prior||b.retakeAfter))deny(404,"Đề đã được gỡ khỏi thư viện.");
  const retake=prior && !timed.isWorking(prior) && slot.attemptId===b.retakeAfter;
  if(!slot || retake){
   if(!item.durationMinutes){
    if(!session.examKey){
     const keyRef=ref.child("sessions/"+digest+"/examKey");
     const claim=await keyRef.transaction(key=>key||crypto.randomBytes(32).toString("hex"),undefined,false);
     session.examKey=claim.snapshot.val();
    }
    return {...itemView(item,template),freeAttemptId:timed.freeTicket(session,item.id)};
   }
   const expected=slot?.attemptId;
   const proposed=timed.newSlot(item.durationMinutes);
   const claim=await latest.transaction(current=>{
    if(!current || current.attemptId===expected)return proposed;
    return current;
   },undefined,false);
   slot=claim.snapshot.val();
   prior=await value(resultRef(slot.attemptId));
  }
 }else{
  if(!validAttempt(b.attemptId))deny(400,"Mã lượt làm chưa hợp lệ.");
  prior=await value(resultRef(b.attemptId));
  if(!prior?.timed)deny(409,"Hãy mở lại đề để tiếp tục.");
  slot={attemptId:b.attemptId,deadline:prior.deadline};
 }
 const target=resultRef(slot.attemptId);
 let row=prior;
 const editing=action==="finishTimed"||Object.keys(b.changes||{}).length||Object.keys(b.photos||{}).length;
 if(!row || (action!=="open" && editing && timed.isWorking(row))){
  const write=await target.transaction(current=>timed.updateRow(current||prior,slot,item,code,user,action,b,scoreSubmission),undefined,false);
  row=write.snapshot.val();
 }
 const key=owner+"_"+slot.attemptId;
 return action==="open"?timed.openReply(row,key,slot,submissionReceipt,itemView(item,template)):timed.timedReply(row,key,slot,submissionReceipt);
}
async function byItem(ref,id){
 if(!safeKey(id))deny(404,"Không tìm thấy bài.");
 const items=ref.child("items");
 const location=ref.child("itemLocations/"+id);
 const key=await value(location);
 if(safeKey(key)){
  const item=await value(items.child(key));
  if(item?.id===id)return [item];
 }
 const archived=await value(ref.child("pastItems/"+id));
 if(archived?.id===id)return [archived];
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
 if(["adminItem","accounts","report","templateAdmin","gradingQueue","gradingPaper"].includes(action)&&user.role!=="admin")deny(403,"Chỉ quản trị viên được truy cập.");
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
 if(["adminItem","open","submit","saveTimed","finishTimed"].includes(action)){
  db.items=await byItem(ref,b.id);
  if(action!=="adminItem" && db.items[0]?.type==="drive"){
   const reply=await timedRequest(ref,db.items[0],code,user,action,b,db.template,session,digest);
   if(reply)return reply;
  }
  if(action==="open" && db.items[0] && !session.examKey && !db.items[0].retired){
   const claim=await ref.child("sessions/"+digest+"/examKey").transaction(key=>key||crypto.randomBytes(32).toString("hex"),undefined,false);
   session.examKey=claim.snapshot.val();
  }
 }
 const result=run(db,action,b,token,address);
 if(action!=="submit")return result;
 const id=result.attempt;
 const write=await ref.child("results/"+id).transaction(existing=>existing||db.results[id],undefined,false);
 return submissionReceipt(write.snapshot.val(),id);
}
module.exports={reads,scoped};
