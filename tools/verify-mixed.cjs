const assert=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const {seed,run}=require("../service.cjs");
const ctx=vm.createContext({});
for(const file of ["tex","paired","management","frame-art"])vm.runInContext(fs.readFileSync(path.join(__dirname,"../public",file+".js"),"utf8"),ctx);
async function verify(){
 const db=seed("12345");
 const call=(action,b,token)=>run(db,action,b,token,"test");
 const login=code=>call("login",{code}).secret;
 const admin=login("12345");
 const student=login(call("issue",{name:"Học sinh A",role:"student"},admin).code);
 const other=login(call("issue",{name:"Học sinh B",role:"student"},admin).code);
 const mc=String.raw`\begin{cauhoi}\noidung{Một cộng một?}\begin{phuongan}\task Một\task Hai\task Ba\task Bốn\end{phuongan}\end{cauhoi}`;
 const essay=String.raw`\begin{cauhoi}\noidung{Giải thích cách tính.}\end{cauhoi}`;
 for(const n of [30,50,125]){
  const src=mc.repeat(n), sol=(mc+String.raw`\hdg\khung{\textbf{Chọn B}}`).repeat(n);
  const data=await ctx.pairedPaper(src,ctx.keysFromSolutions(src,sol));assert.equal(data.prompts.length,n);
 }
 const worked=mc+String.raw`\hdg\khung{\textbf{Chọn B}}`+essay+String.raw`\hdg\khung{Cộng hai số.}`;
 const data=await ctx.pairedPaper(mc+essay,ctx.keysFromSolutions(mc+essay,worked));
 assert.equal(data.keys.join(","),"B,TL");
 const paper={title:"Bài hỗn hợp",grade:1,subject:"Toán",track:"Theo chương trình",category:"Bài tập luyện tập",type:"paired",prompts:data.prompts,answerSheet:data.keys};
 const {id}=call("publish",paper,admin);
 const submission={id,answers:["B",""],attemptId:"mixed-test-1234"};
 assert.throws(()=>call("submit",submission,student));
 submission.photos={1:["data:image/jpeg;base64,/9j/2Q=="]};
 const pending=call("submit",submission,student);
 assert.deepEqual(pending,call("submit",submission,student));assert.equal(pending.status,"pending");assert.ok(!("total" in pending));
 const attempt=pending.attempt;
 assert.throws(()=>call("review",{attempt},student));
 assert.throws(()=>call("gradingPaper",{attempt},other));
 assert.throws(()=>call("approveGrade",{attempt,fractions:[100]},student));
 const queue=call("gradingQueue",{},admin);assert.equal(queue.rows.length,1);
 assert.equal(call("gradingPaper",{attempt},admin).max,5);
 assert.throws(()=>call("approveGrade",{attempt,fractions:[101]},admin));
 assert.equal(call("approveGrade",{attempt,fractions:[60]},admin).total,8);
 assert.throws(()=>call("approveGrade",{attempt,fractions:[100]},admin));
 assert.equal(call("gradingQueue",{},admin).rows.length,0);
 assert.equal(call("history",{},student).rows[0].total,8);
 assert.equal(call("history",{},other).rows.length,0);
 console.log("PASS 30, 50, 125 questions; essays, pending, permissions, approval and history.");
}
verify().catch(e=>{console.error(e);process.exitCode=1});
