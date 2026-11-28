const assert=require("node:assert/strict");
const {seed,run}=require("../service.cjs");
const {scoped}=require("../firebase-access.cjs");

function firebase(db,path=[]){
 const data=()=>path.reduce((v,k)=>v?.[k],db)??null;
 const write=value=>{const parent=path.slice(0,-1).reduce((v,k)=>v[k]??={},db);parent[path.at(-1)]=structuredClone(value)};
 const snap=()=>({val:()=>structuredClone(data()),forEach:fn=>Object.entries(data()||{}).some(([key,v])=>fn({key,val:()=>structuredClone(v)}))});
 return {child:key=>firebase(db,path.concat(key.split("/"))),get:async()=>snap(),set:async v=>write(v),
  transaction:async fn=>{write(fn(structuredClone(data())));return {snapshot:snap()}},
  orderByKey(){return this},startAt(){return this},endAt(){return this},once:async()=>snap()};
}
async function verify(cloud){
 const db=seed("12345","23456"),ip="test",ref=firebase(db);
 const sign=code=>run(db,"login",{code},null,ip).secret;
 const admin=sign("12345"),student=sign("23456"),other=sign(run(db,"issue",{name:"B",role:"student"},admin,ip).code);
 const mutate=(action,b)=>run(db,action,b,admin,ip);
 const call=async(action,b={},token=student)=>cloud?scoped(ref,action,b,token,ip):run(db,action,b,token,ip);
 const drive=id=>"https://drive.google.com/file/d/"+id+"/view";
 const paper={type:"drive",title:"Đề A",grade:12,track:"Theo chương trình",subject:"Vật lý",category:"Bài tập luyện tập",
  url:drive("paper12345"),solutionUrl:drive("solution1234"),answerKeyUrl:drive("secret12345"),answerSheet:["B","TL"],durationMinutes:1};
 const {id}=mutate("publish",paper);
 await assert.rejects(call("adminItem",{id}),e=>e.status===403);
 for(const a of ["updateItem","deleteItem"])assert.throws(()=>run(db,a,{id,revision:0},student,ip),e=>e.status===403);
 assert(!JSON.stringify(await call("catalog")).includes("secret12345"));
 const draft=await call("adminItem",{id},admin);
 assert.deepEqual(draft.answerSheet,paper.answerSheet);assert.equal(draft.answerKeyUrl,paper.answerKeyUrl);
 const open=await call("open",{id});assert(!JSON.stringify(open).includes("secret12345"));
 const params={id,attemptId:open.clock.attemptId};
 await call("saveTimed",{...params,changes:{0:"B"}});
 assert.throws(()=>mutate("updateItem",{...paper,id,revision:0,grade:6}),e=>e.status===400);
 assert.equal((await call("catalog")).items.length,1);
 mutate("setDuration",{id,durationMinutes:2});
 assert.throws(()=>mutate("updateItem",{...paper,id,revision:0}),e=>e.status===409);
 const next=mutate("updateItem",{...paper,id,revision:1,title:"Đề B",answerSheet:["D"],grade:9,subject:"Toán",durationMinutes:0,solutionUrl:drive("solution5678")});
 assert.deepEqual((await call("catalog")).items.map(x=>x.id),[next.id]);
 assert.throws(()=>mutate("deleteItem",{id,revision:1}),e=>e.status===409);
 assert.equal((await call("open",{id})).clock.attemptId,params.attemptId);
 await assert.rejects(call("open",{id},other),e=>e.status===404);
 const pending=await call("finishTimed",{...params,photos:{1:["data:image/jpeg;base64,/9j/2Q=="]}});
 const grade=await call("gradingPaper",{attempt:pending.receipt.attempt},admin);assert.deepEqual(grade.essay,[1]);
 mutate("approveGrade",{attempt:pending.receipt.attempt,fractions:[100]});
 const review=await call("review",{attempt:pending.receipt.attempt});assert.equal(review.score,10);assert.equal(review.solutionUrl,paper.solutionUrl);
 const free=await call("open",{id:next.id});
 mutate("deleteItem",{id:next.id,revision:0});
 assert.equal((await call("catalog")).items.length,0);
 await assert.rejects(call("open",{id:next.id}),e=>e.status===404);
 const score=await call("submit",{id:next.id,attemptId:free.freeAttemptId,answers:["D"]});
 assert.equal(score.total,10);assert.equal(score.seriesId,id);
 assert.equal((await call("review",{attempt:score.attempt})).solutionUrl,drive("solution5678"));
 assert.equal((await call("history")).rows.length,2);
 const link=mutate("publish",{...paper,type:"link"}).id;
 const edited=mutate("updateItem",{...paper,type:"link",id:link,revision:0,url:"https://example.org/updated"});
 assert.equal((await call("adminItem",edited,admin)).url,"https://example.org/updated");
 const legacy=mutate("publish",{...paper,type:"quiz",questions:[{text:"1+1?",options:["0","1","2","3"],key:2}]}).id;
 const moved=mutate("updateItem",{id:legacy,revision:0,type:"quiz",title:"Cộng",grade:1,subject:"Toán",track:paper.track,category:paper.category});
 assert.equal((await call("open",moved)).questions[0].text,"1+1?");
}
(async()=>{await verify(false);await verify(true);console.log("PASS exam library: edit, classification, removal, authorization, private keys, old attempts, pending grades and history.")})().catch(e=>{console.error(e);process.exitCode=1});
