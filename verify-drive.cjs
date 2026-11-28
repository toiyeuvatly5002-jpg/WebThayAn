const assert=require("node:assert/strict");
const {seed,run}=require("../service.cjs");
const {parseDriveAnswers}=require("../public/drive-answers.js");
const {readKey}=require("../drive-key.cjs");
const {driveFile}=require("../public/drive-file.js");
async function verify(){
 const url="https://drive.google.com/file/d/test_123456/view?resourcekey=abc",solutionUrl=url.replace("test_","solution_");
 const db=seed("14567","23456");
 const login=code=>run(db,"login",{code},null,"test").secret;
 const admin=login("14567"),student=login("23456");
 const other=login(run(db,"issue",{name:"B",role:"student"},admin,"test").code);
 const call=(action,b,token=student)=>run(db,action,b,token,"test");
 const read=await readKey(url,async endpoint=>{assert.equal(endpoint.searchParams.get("resourcekey"),"abc");return new Response("Câu 1. A\nCâu 2. TL")});
 assert.deepEqual(parseDriveAnswers(read.text),["A","TL"]);
 assert.throws(()=>driveFile("https://example.org/file/d/test_123456"));
 assert.throws(()=>parseDriveAnswers("Câu 1. A\nCâu 3. C"));
 for(const keys of [["B","ĐSSĐ","6,6"],["B","TL"],["TL","TL"]]){
  const {id}=call("publish",{title:"Đề PDF",track:"Theo chương trình",category:"Bài tập luyện tập",grade:12,subject:"Vật lý",type:"drive",url,solutionUrl,answerSheet:keys},admin);
  const item=call("open",{id});
  assert.equal(item.count,keys.length);assert(!item.solutionUrl&&!item.answerSheet);
  assert(!JSON.stringify(call("catalog",{})).includes("solution_"));
  const b={id,attemptId:"verify-drive-12345",answers:keys.map(k=>k==="TL"?"":k)};
  if(keys.includes("TL")){
   assert.throws(()=>call("submit",b));
   b.photos=Object.fromEntries(keys.flatMap((k,i)=>k==="TL"?[[i,["data:image/jpeg;base64,/9j/2Q=="]]]:[]));
  }
  const out=call("submit",b);assert.equal(out.solutionUrl,solutionUrl);
  if(keys.includes("TL")){
   assert.equal(out.total,undefined);assert.equal(out.status,"pending");
   const g=call("gradingPaper",{attempt:out.attempt},admin);assert.equal(g.paperUrl,url);
   call("approveGrade",{attempt:out.attempt,fractions:g.essay.map(()=>100)},admin);
  }else assert.equal(out.total,10);
  assert.equal(call("review",{attempt:out.attempt}).score,10);
  assert.throws(()=>call("review",{attempt:out.attempt},other));
  assert(call("history",{}).rows.some(r=>r.attempt===out.attempt&&r.total===10));
 }
 console.log("PASS Drive keys, automatic scoring, pending photo submissions, approval, private history and solutions.");
}
verify().catch(e=>{console.error(e);process.exitCode=1});
