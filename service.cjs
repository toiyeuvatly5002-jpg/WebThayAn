const crypto=require("node:crypto");
const {subjects,tracks,categories,kind}=require("./public/catalog");
const {grade}=require("./grade.cjs");
const fail=(status,message)=>{throw Object.assign(Error(message),{status})};
const {driveFile}=require("./public/drive-file.js");
const hash=s=>crypto.createHash("sha256").update(s).digest("hex");
const timed=require("./timed-attempt.cjs");
const adminActions=["setDuration","accounts","issue","publish","report","templateAdmin","setTemplate","gradingQueue","gradingPaper","approveGrade"];
function seed(admin,student){
 if(!/^\d{5}$/.test(admin)||student===admin)throw Error("Cần cấu hình mã admin 5 số riêng");
 const users={[admin]:{name:"Thầy An",role:"admin"}};
 if(student)users[student]={name:"Học sinh trải nghiệm",role:"student"};
 return {users,sessions:{},limits:{},results:{},items:[]};
}
function sharedArt(template={},legacy={}){
 const style=template.style||legacy;
 const visible=k=>!style.removed&&!template[k]?.removed && (style[k] || (style.source && template.imageNames?.[k] && style.source.includes(template.imageNames[k])) || false);
 const art={conan:visible("conan"),agasa:visible("agasa")};
 for(const k of ["conan","agasa"]){
 if(template[k]?.removed)art[k+"Hidden"]=true;
 else if(typeof template[k]==="string")art[k+"Image"]=template[k];
 else if(legacy[k+"Image"])art[k+"Image"]=legacy[k+"Image"];
 }
 return art;
}
function cleanItem(item){const {questions,answerSheet,prompts,art,solutions,pdfs,solutionUrl,...rest}=item;return {...rest,count:answerSheet?.length??questions?.length??(item.type==="original"?28:0)}}
function run(db,action,b,token,address){
 const now=Date.now(); db.items??=[];
 if(action==="login"){
 const ip=hash(address);const limit=db.limits[ip];
 if(limit?.until>now&&limit.n>=8)return {error:"Thử lại sau 15 phút.",status:429};
 const user=typeof b.code==="string"?db.users[b.code]:null;
 if(!/^\d{5}$/.test(b.code)||!user){db.limits[ip]={n:(limit?.until>now?limit.n:0)+1,until:limit?.until>now?limit.until:now+900000};return {status:401,error:"Mã đăng nhập chưa đúng."}}
 delete db.limits[ip];for(const [k,s] of Object.entries(db.sessions))if(s.until<=now)delete db.sessions[k];
 const secret=crypto.randomBytes(32).toString("hex");db.sessions[hash(secret)]={code:b.code,until:now+8*3600000,examKey:crypto.randomBytes(32).toString("hex")};return {secret,user:{...user,code:b.code}};
 }
 const session=db.sessions[hash(token||"")];if(!session||session.until<=now)fail(401,"Hãy đăng nhập lại.");
 const code=session.code,user=db.users[code];if(adminActions.includes(action)&&user.role!=="admin")fail(403,"Chỉ quản trị viên được truy cập.");
 if(action==="logout"){delete db.sessions[hash(token)];return {}}
 if(action==="catalog")return {user:{...user,code},items:db.items.map(cleanItem)};
 if(action==="templateAdmin")return {template:db.template||{},art:sharedArt(db.template)};
 if(action==="setTemplate"){
 const {slot,value}=b;
 if(!["style","conan","agasa"].includes(slot))fail(400,"Mục mẫu không hợp lệ.");
 const template=db.template||{};
 if(value===null)template[slot]={removed:true};
 else if(slot==="style"){
 if(typeof value?.source!=="string"||value.source.length>180000||!value.source.trim()||typeof value.name!=="string"||!value.name.toLowerCase().endsWith(".sty")||value.name.length>180||typeof value.conan!=="boolean"||typeof value.agasa!=="boolean")fail(400,"Tệp .sty không hợp lệ.");
 template.style={name:value.name,source:value.source,conan:value.conan,agasa:value.agasa};
 }else{
 if(typeof value!=="string"||value.length>100000||!/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(value))fail(400,"Ảnh PNG không hợp lệ.");
 const name=b.filename||slot+".png";
 if(!/^[\p{L}\p{N}_ .-]+\.png$/iu.test(name)||name.length>180)fail(400,"Tên ảnh PNG không hợp lệ.");
 template.imageNames??={};template.imageNames[slot]=name;template[slot]=value;
 }
 db.template=template;for(const item of db.items)delete item.art;return {saved:true};
 }
 if(action==="accounts")return {users:Object.entries(db.users).map(([code,u])=>({code,...u}))};
 if(action==="issue"){
 if(!["admin","student"].includes(b.role)||!String(b.name||"").trim()||b.name.length>100)fail(400,"Kiểm tra tên và vai trò.");
 if(Object.keys(db.users).length>=100000)fail(409,"Đã hết mã.");
 let id;do{id=String(crypto.randomInt(100000)).padStart(5,"0")}while(db.users[id]);
 db.users[id]={name:b.name.trim(),role:b.role};return {code:id};
 }
 if(action==="publish"){
 const {title,track,category,subject,grade:g,type,url,questions}=b;
 if(typeof title!=="string"||!title.trim()||title.length>160||!Number.isInteger(g)||g<1||g>12||!subjects(g).includes(subject)||!tracks.includes(track)||!categories(track).includes(category)||(track===tracks[1]&&g!==9)||(track===tracks[2]&&g!==12))fail(400,"Kiểm tra thông tin phân loại.");
 const item={id:crypto.randomUUID(),title:title.trim(),grade:g,track,subject,category,type};
 if(type==="drive")item.durationMinutes=timed.readMinutes(b.durationMinutes);
 if(type==="link"){if(typeof url!=="string"||!/^https:\/\//i.test(url)||url.length>2048)fail(400,"Cần liên kết HTTPS.");item.url=url}
 else if(["sheet","paired","drive"].includes(type)){
 if(type==="drive"){item.url=driveFile(url).view;item.solutionUrl=driveFile(b.solutionUrl).view}
 const list=b.answerSheet;
 if((type==="sheet"&&(typeof url!=="string"||!/^https:\/\//i.test(url)||url.length>2048))||!Array.isArray(list)||!list.length||list.some(v=>typeof v!=="string"||v.length>40||(v==="TL"?!["drive","paired"].includes(type):!/^([A-D]|[ĐS]{4}|[-+]?\d+(?:[.,]\d+)?)$/.test(v))))fail(400,"Kiểm tra liên kết PDF và bảng đáp án.");
 if(type==="paired"){
 if(!Array.isArray(b.prompts)||b.prompts.length!==list.length||b.prompts.some(s=>typeof s!=="string"||!s.trim()||s.length>240000))fail(400,"Nội dung câu không khớp đáp án.");
 if(b.pdfs!=null){
  if(!Array.isArray(b.pdfs)||b.pdfs.length!==2||b.pdfs.some(p=>typeof p!=="string"||!/^JVBERi0[A-Za-z0-9+/]+=*$/.test(p)))fail(400,"PDF đề hoặc lời giải không hợp lệ.");
  item.pdfs=b.pdfs;
 }
 item.prompts=b.prompts;
 }else if(type==="sheet")item.url=url;
 item.answerSheet=list;item.fields=list.map(v=>v==="TL"?"essay":/^[A-D]$/.test(v)?"mc":/^[ĐS]{4}$/.test(v)?"tf":"num");
 }
 else if(type==="quiz"&&Array.isArray(questions)&&questions.length){
 item.questions=questions.map(q=>{if(typeof q.text!=="string"||!q.text.trim()||q.text.length>4000||!Array.isArray(q.options)||q.options.length!==4||q.options.some(o=>typeof o!=="string"||!o.trim()||o.length>1000)||!Number.isInteger(q.key)||q.key<0||q.key>3)fail(400,"Cần 4 lựa chọn và đáp án hợp lệ.");return {text:q.text,options:q.options,key:q.key}})
 }else fail(400,"Chọn tài liệu hoặc đề trắc nghiệm.");
 if(b.solutions!=null){
 const count=item.questions?.length??item.answerSheet?.length;
 if(!Array.isArray(b.solutions)||b.solutions.length!==count||b.solutions.some(v=>typeof v!=="string"||!v.trim()||v.length>(type==="paired"?240000:30000)))fail(400,"Số lời giải phải khớp số câu.");
 item.solutions=b.solutions;
 }
 db.items.push(item);return {id:item.id};
 }
 if(action==="gradingQueue")return {rows:Object.entries(db.results).filter(([,r])=>r.status==="pending"&&!timed.isWorking(r,now)).map(([attempt,r])=>({attempt,title:r.title,code:r.code,name:r.name,date:r.date}))};
 if(action==="gradingPaper"||action==="approveGrade"){
  const r=db.results[b.attempt];
  if(!r||timed.isWorking(r,now)||r.status!=="pending")fail(409,"Bài đã được duyệt hoặc không còn chờ chấm.");
  const paper=db.items.find(item=>item.id===r.id);
  if(!paper)fail(404,"Không tìm thấy đề.");
  const essay=paper.fields.flatMap((type,i)=>type==="essay"?[i]:[]);
  const max=10/paper.fields.reduce((sum,t)=>sum+(t==="tf"?1:.25),0)*.25;
  if(action==="gradingPaper")return {title:r.title,name:r.name,code:r.code,art:sharedArt(db.template,paper.art),photos:r.photos,essay,max,paperUrl:paper.type==="drive"?paper.url:undefined,paperPdf:paper.pdfs?.[0],auto:r.points.reduce((a,b)=>a+b,0),prompts:paper.prompts};
  if(!Array.isArray(b.fractions)||b.fractions.length!==essay.length||b.fractions.some(n=>!Number.isFinite(n)||n<0||n>100))fail(400,"Điểm tự luận phải từ 0 đến 100%.");
  essay.forEach((i,j)=>r.points[i]=max*b.fractions[j]/100);
  r.total=+r.points.reduce((a,b)=>a+b,0).toFixed(2);
  r.status="approved";r.gradedBy=code;r.gradedAt=now;delete r.photos;
  return {total:r.total};
 }
 if(action==="report"||action==="history"){
 let rows=Object.entries(db.results).map(([attempt,r])=>({...r,attempt})).filter(r=>action==="report"?(!b.code||r.code===b.code):r.code===code);
 rows=rows.filter(r=>!timed.isWorking(r,now)).filter(r=>b.group?r.group===b.group:r.group!=="periodic");
 return {rows:rows.map(({answers,keys,points,photos,code:owner,...summary})=>({...summary,code:owner})).sort((a,b)=>b.date-a.date)}
 }
 if(action==="review"){
 const r=db.results[b.attempt];
 if(!r||r.code!==code||timed.isWorking(r,now))fail(404,"Không tìm thấy lượt làm của bạn.");
 if(r.status==="pending")fail(409,"Bài đang chờ giáo viên duyệt điểm.");
 const paper=db.items.find(x=>x.id===r.id);
 return {title:r.title,art:sharedArt(db.template,paper?.art),score:r.total,solutionUrl:paper?.solutionUrl,solutionPdf:paper?.pdfs?.[1],answers:r.answers,keys:r.keys,points:r.points,solutions:paper?.solutions||(paper?.type==="original"?require("./legacy-solutions.json"):[]),prompts:paper?.prompts||paper?.questions?.map(q=>q.text)||[]};
 }
 const item=db.items.find(it=>it.id===b.id);if(!item)fail(404,"Không tìm thấy bài.");

 if(action==="setDuration"){
  if(item.type!=="drive")fail(400,"Chọn một đề PDF.");
  item.durationMinutes=timed.readMinutes(b.durationMinutes);
  return {durationMinutes:item.durationMinutes};
 }
 if(item.type==="drive" && ["open","saveTimed","finishTimed","submit"].includes(action)){
  const owner=code+"_"+item.id;
  let slot=db.timedLatest?.[owner];
  if(action==="open"){
   const previous=slot && db.results[owner+"_"+slot.attemptId];
   const retake=previous && !timed.isWorking(previous,now) && b.retakeAfter===slot.attemptId;
   if(!slot || retake){
    if(!item.durationMinutes){
     session.examKey??=crypto.randomBytes(32).toString("hex");
     return {...itemView(item,db.template),freeAttemptId:timed.freeTicket(session,item.id)};
    }
    slot=timed.newSlot(item.durationMinutes,now);
    (db.timedLatest??={})[owner]=slot;
   }
  }
  if(action==="saveTimed" || action==="finishTimed"){
   if(!validAttempt(b.attemptId))fail(400,"Mã lượt làm chưa hợp lệ.");
   const prior=db.results[owner+"_"+b.attemptId];
   if(!prior?.timed)fail(409,"Hãy mở lại đề để tiếp tục.");
   slot={attemptId:b.attemptId,deadline:prior.deadline};
  }
  if(slot && action!=="submit"){
   const key=owner+"_"+slot.attemptId;
   const row=timed.updateRow(db.results[key],slot,item,code,user,action,b,scoreSubmission,now);
   db.results[key]=row;
   return action==="open"?timed.openReply(row,key,slot,submissionReceipt,itemView(item,db.template)):timed.timedReply(row,key,slot,submissionReceipt);
  }
  if(action==="submit" && !timed.validFreeTicket(session,item.id,b.attemptId) && (item.durationMinutes || (slot && timed.isWorking(db.results[owner+"_"+slot.attemptId],now))))fail(409,"Hãy mở lại đề để dùng lượt làm có đồng hồ.");
 }
 if(action==="open")return itemView(item,db.template);
 if(action==="submit"){
  if(!validAttempt(b.attemptId))fail(400,"Mã lượt làm chưa hợp lệ.");
  const id=code+"_"+item.id+"_"+b.attemptId;
  if(db.results[id])return submissionReceipt(db.results[id],id);
  db.results[id]=scoreSubmission(item,b,code,user,now,false);
  return submissionReceipt(db.results[id],id);
 }
 fail(404,"Không có thao tác này.");
}
function validAttempt(id){return typeof id==="string" && /^[\w-]{12,80}$/.test(id)}
function itemView(item,template){return {...cleanItem(item),paperPdf:item.pdfs?.[0],art:sharedArt(template,item.art),prompts:item.prompts,questions:item.questions?.map(({key,...q})=>q)}}
function scoreSubmission(item,b,code,user,now,allowBlankEssay){
 if(!Array.isArray(b.answers)||b.answers.some(x=>typeof x!=="string"||x.length>80))fail(400,"Bài làm không hợp lệ.");
 let result;
 if(item.type==="original")result=grade(b.answers);
 else if(["sheet","paired","drive"].includes(item.type)&&item.answerSheet.length===b.answers.length){
 const keys=item.answerSheet, weights=item.fields.map(t=>t==="tf"?1:.25),max=weights.reduce((a,x)=>a+x,0);
 const points=keys.map((k,i)=>{const v=b.answers[i].trim();
 if(item.fields[i]==="essay")return 0;
 if(item.fields[i]==="tf")return [0,.1,.25,.5,1][Array.from(k).filter((x,j)=>v[j]===x).length]*10/max;
 const correct=item.fields[i]==="num"?/^[-+]?\d+(?:[.,]\d+)?$/.test(v)&&Number(v.replace(",","."))===Number(k.replace(",",".")):v===k;
 return correct?weights[i]*10/max:0});
 result={keys,points,total:+points.reduce((a,x)=>a+x,0).toFixed(2)};
 }
 else if(item.type==="quiz"&&item.questions.length===b.answers.length){
 const keys=item.questions.map(q=>"ABCD"[q.key]),points=keys.map((k,i)=>b.answers[i]===k?10/keys.length:0);
 result={keys,points,total:+points.reduce((a,b)=>a+b,0).toFixed(2)}
 }else fail(400,"Bài làm không hợp lệ.");
 if(item.fields?.includes("essay")){
  const photos={};
  for(const [i,t] of item.fields.entries()){
   if(t!=="essay")continue;
   const pages=b.photos?.[i];
   if(allowBlankEssay && !pages?.length)continue;
   if(!Array.isArray(pages)||!pages.length||pages.some(p=>typeof p!=="string"||!/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]+=*$/.test(p)))fail(400,"Thiếu ảnh JPEG hợp lệ ở câu "+(i+1)+".");
   photos[i]=pages;
  }
  Object.assign(result,{photos,status:"pending"});delete result.total;
 }
 return {...result,...(item.solutionUrl?{solutionUrl:item.solutionUrl}:{}),code,name:user.name,title:item.title,id:item.id,date:now,group:kind(item.track,item.category),answers:b.answers};
}
function submissionReceipt(r,attempt){
 const result=r.status==="pending"?{status:"pending",attempt,...(r.solutionUrl?{solutionUrl:r.solutionUrl}:{})}:{...r,attempt};
 if(r.timed)result.autoSubmitted=!r.finishedEarly;
 return result;
}
module.exports={run,seed,submissionReceipt,scoreSubmission,itemView,validAttempt};







