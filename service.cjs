const crypto=require("node:crypto");
const {subjects,tracks,categories,kind}=require("./public/catalog");
const {grade}=require("./grade.cjs");
const fail=(status,message)=>{throw Object.assign(Error(message),{status})};
const hash=s=>crypto.createHash("sha256").update(s).digest("hex");
const adminActions=["accounts","issue","publish","report","templateAdmin","setTemplate"];
function seed(admin,student){
 if(!/^\d{5}$/.test(admin)||student===admin)throw Error("Cần cấu hình mã admin 5 số riêng");
 const users={[admin]:{name:"Thầy An",role:"admin"}};
 if(student)users[student]={name:"Học sinh trải nghiệm",role:"student"};
 return {users,sessions:{},limits:{},results:{},items:[]};
}
function sharedArt(template={},legacy={}){
 const style=template.style||legacy;
 const visible=k=>!style.removed&&!template[k]?.removed&&(style[k]??true);
 const art={conan:visible("conan"),agasa:visible("agasa")};
 for(const k of ["conan","agasa"]){
 if(template[k]?.removed)art[k+"Hidden"]=true;
 else if(typeof template[k]==="string")art[k+"Image"]=template[k];
 else if(legacy[k+"Image"])art[k+"Image"]=legacy[k+"Image"];
 }
 return art;
}
function cleanItem(item){const {questions,answerSheet,prompts,art,solutions,...rest}=item;return {...rest,count:answerSheet?.length??questions?.length??(item.type==="original"?28:0)}}
function run(db,action,b,token,address){
 const now=Date.now(); db.items??=[];
 if(action==="login"){
 const ip=hash(address);const limit=db.limits[ip];
 if(limit?.until>now&&limit.n>=8)return {error:"Thử lại sau 15 phút.",status:429};
 const user=typeof b.code==="string"?db.users[b.code]:null;
 if(!/^\d{5}$/.test(b.code)||!user){db.limits[ip]={n:(limit?.until>now?limit.n:0)+1,until:limit?.until>now?limit.until:now+900000};return {status:401,error:"Mã đăng nhập chưa đúng."}}
 delete db.limits[ip];for(const [k,s] of Object.entries(db.sessions))if(s.until<=now)delete db.sessions[k];
 const secret=crypto.randomBytes(32).toString("hex");db.sessions[hash(secret)]={code:b.code,until:now+8*3600000};return {secret,user:{...user,code:b.code}};
 }
 const session=db.sessions[hash(token||"")];if(!session||session.until<=now)fail(401,"Hãy đăng nhập lại.");
 const code=session.code,user=db.users[code];if(adminActions.includes(action)&&user.role!=="admin")fail(403,"Chỉ quản trị viên được truy cập.");
 if(action==="logout"){delete db.sessions[hash(token)];return {}}
 if(action==="catalog")return {user:{...user,code},items:db.items.map(cleanItem)};
 if(action==="templateAdmin")return {template:db.template||{}};
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
 template[slot]=value;
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
 if(type==="link"){if(typeof url!=="string"||!/^https:\/\//i.test(url)||url.length>2048)fail(400,"Cần liên kết HTTPS.");item.url=url}
 else if(type==="sheet"||type==="paired"){
 const list=b.answerSheet;
 if((type==="sheet"&&(typeof url!=="string"||!/^https:\/\//i.test(url)||url.length>2048))||!Array.isArray(list)||!list.length||list.length>100||list.some(v=>typeof v!=="string"||v.length>40||!/^([A-D]|[ĐS]{4}|[-+]?\d+(?:[.,]\d+)?)$/.test(v)))fail(400,"Kiểm tra liên kết PDF và bảng đáp án.");
 if(type==="paired"){
 if(!Array.isArray(b.prompts)||b.prompts.length!==list.length||b.prompts.some(s=>typeof s!=="string"||!s.trim()||s.length>240000))fail(400,"Nội dung câu không khớp đáp án.");
 item.prompts=b.prompts;
 }else item.url=url;
 item.answerSheet=list;item.fields=list.map(v=>/^[A-D]$/.test(v)?"mc":/^[ĐS]{4}$/.test(v)?"tf":"num");
 }
 else if(type==="quiz"&&Array.isArray(questions)&&questions.length&&questions.length<=100){
 item.questions=questions.map(q=>{if(typeof q.text!=="string"||!q.text.trim()||q.text.length>4000||!Array.isArray(q.options)||q.options.length!==4||q.options.some(o=>typeof o!=="string"||!o.trim()||o.length>1000)||!Number.isInteger(q.key)||q.key<0||q.key>3)fail(400,"Cần 4 lựa chọn và đáp án hợp lệ.");return {text:q.text,options:q.options,key:q.key}})
 }else fail(400,"Chọn tài liệu hoặc đề trắc nghiệm.");
 if(b.solutions!=null){
 const count=item.questions?.length??item.answerSheet?.length;
 if(!Array.isArray(b.solutions)||b.solutions.length!==count||b.solutions.some(v=>typeof v!=="string"||!v.trim()||v.length>30000))fail(400,"Số lời giải phải khớp số câu.");
 item.solutions=b.solutions;
 }
 db.items.push(item);return {id:item.id};
 }
 if(action==="report"||action==="history"){
 let rows=Object.entries(db.results).map(([attempt,r])=>({...r,attempt})).filter(r=>action==="report"?(!b.code||r.code===b.code):r.code===code);
 rows=rows.filter(r=>b.group?r.group===b.group:r.group!=="periodic");
 return {rows:rows.map(({answers,keys,points,code:owner,...summary})=>({...summary,code:owner})).sort((a,b)=>b.date-a.date)}
 }
 if(action==="review"){
 const r=db.results[b.attempt];
 if(!r||r.code!==code)fail(404,"Không tìm thấy lượt làm của bạn.");
 const paper=db.items.find(x=>x.id===r.id);
 return {title:r.title,score:r.total,answers:r.answers,keys:r.keys,points:r.points,solutions:paper?.solutions||(paper?.type==="original"?require("./legacy-solutions.json"):[]),prompts:paper?.prompts||paper?.questions?.map(q=>q.text)||[]};
 }
 const item=db.items.find(it=>it.id===b.id);if(!item)fail(404,"Không tìm thấy bài.");
 if(action==="open")return {...cleanItem(item),art:sharedArt(db.template,item.art),prompts:item.prompts,questions:item.questions?.map(({key,...q})=>q)};
 if(action==="submit"){
 if(!/^[\w-]{12,80}$/.test(b.attemptId))fail(400,"Mã lượt làm chưa hợp lệ.");
 const id=code+"_"+item.id+"_"+b.attemptId;if(db.results[id])return {...db.results[id],attempt:id};
 if(!Array.isArray(b.answers)||b.answers.some(x=>typeof x!=="string"||x.length>80))fail(400,"Bài làm không hợp lệ.");
 let result;
 if(item.type==="original")result=grade(b.answers);
 else if(["sheet","paired"].includes(item.type)&&item.answerSheet.length===b.answers.length){
 const keys=item.answerSheet, weights=item.fields.map(t=>t==="tf"?1:.25),max=weights.reduce((a,x)=>a+x,0);
 const points=keys.map((k,i)=>{const v=b.answers[i].trim();
 if(item.fields[i]==="tf")return [0,.1,.25,.5,1][Array.from(k).filter((x,j)=>v[j]===x).length]*10/max;
 const correct=item.fields[i]==="num"?/^[-+]?\d+(?:[.,]\d+)?$/.test(v)&&Number(v.replace(",","."))===Number(k.replace(",",".")):v===k;
 return correct?weights[i]*10/max:0});
 result={keys,points,total:+points.reduce((a,x)=>a+x,0).toFixed(2)};
 }
 else if(item.type==="quiz"&&item.questions.length===b.answers.length){
 const keys=item.questions.map(q=>"ABCD"[q.key]),points=keys.map((k,i)=>b.answers[i]===k?10/keys.length:0);
 result={keys,points,total:+points.reduce((a,b)=>a+b,0).toFixed(2)}
 }else fail(400,"Bài làm không hợp lệ.");
 db.results[id]={...result,code,name:user.name,title:item.title,id:item.id,date:now,group:kind(item.track,item.category),answers:b.answers}; return {...db.results[id],attempt:id};
 }
 fail(404,"Không có thao tác này.");
}
module.exports={run,seed};







