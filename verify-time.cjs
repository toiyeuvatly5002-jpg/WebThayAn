const assert=require("node:assert/strict");
const {seed,run}=require("../service.cjs");
const {scoped}=require("../firebase-access.cjs");
const {isWorking}=require("../timed-attempt.cjs");

function refFor(db,keys=[]){
 const read=()=>keys.reduce((value,k)=>value?.[k],db)??null;
 const snapshot=()=>({val:()=>structuredClone(read())});
 const write=data=>{
  const parent=keys.slice(0,-1).reduce((node,k)=>node[k]??={},db);
  parent[keys.at(-1)]=structuredClone(data);
 };
 return {child:k=>refFor(db,keys.concat(k.split("/"))),get:async()=>snapshot(),
  transaction:async update=>{write(update(structuredClone(read())));return {snapshot:snapshot()}},
  orderByKey(){return this},startAt(){return this},endAt(){return this},once:async()=>snapshot()};
}

async function scenario(cloud){
 const db=seed("12121","23232"),ctx="test";
 const login=code=>run(db,"login",{code},null,ctx).secret;
 const admin=login("12121"),student=login("23232");
 const student2=login(run(db,"issue",{name:"Test B",role:"student"},admin,ctx).code);
 const ref=refFor(db);
 const call=async(a,b,t=student)=>cloud?scoped(ref,a,b,t,ctx):run(db,a,b,t,ctx);
 const paper={type:"drive",title:"PDF",grade:1,track:"Theo chương trình",subject:"Toán",category:"Bài tập luyện tập",
  url:"https://drive.google.com/file/d/exam_123456/view",solutionUrl:"https://drive.google.com/file/d/solution_123456/view",answerSheet:["B","TL","TL"],durationMinutes:1};
 for(const minutes of [-1,1.2,Number.MAX_SAFE_INTEGER,"1"])assert.throws(()=>run(db,"publish",{...paper,durationMinutes:minutes},admin,ctx));
 const {id}=run(db,"publish",paper,admin,ctx);db.itemLocations={[id]:"0"};
 const set=minutes=>run(db,"setDuration",{id,durationMinutes:minutes},admin,ctx);
 assert.throws(()=>run(db,"setDuration",{id,durationMinutes:1},student,ctx));
 const first=await call("open",{id}),{attemptId,deadline}=first.clock;
 assert.equal(deadline-now,60000);assert(!first.solutionUrl&&!first.answerSheet&&!first.clock.keys);
 const b={id,attemptId};
 const jpeg="data:image/jpeg;base64,/9j/2Q==";
 await call("saveTimed",{...b,changes:{0:"B"},photos:{2:[jpeg]}});
 const resumed=await call("open",{id,retakeAfter:attemptId});
 assert.equal(resumed.clock.attemptId,attemptId);assert.equal(resumed.clock.deadline,deadline);
 assert.deepEqual(resumed.clock.answers,["B","",""]);assert.deepEqual(resumed.clock.photoCounts,{"2":1});
 set(2);assert.equal((await call("open",{id})).clock.deadline,deadline);
 await assert.rejects(call("submit",{id,attemptId:"random-forged-attempt",answers:["B","",""]}));
 await assert.rejects(call("finishTimed",b));
 await assert.rejects(call("saveTimed",{...b,changes:{0:"A"}},student2));
 const key=Object.keys(db.results)[0];
 await assert.rejects(call("review",{attempt:key}));
 assert.equal((await call("history",{})).rows.length,0);
 assert.equal((await call("gradingQueue",{},admin)).rows.length,0);
 now=deadline; // No student request when the tab is closed.
 assert.equal((await call("history",{})).rows[0].status,"pending");
 assert.equal((await call("gradingQueue",{},admin)).rows[0].attempt,key);
 assert.equal((await call("gradingPaper",{attempt:key},admin)).photos[2][0],jpeg);
 assert.equal((await call("saveTimed",{...b,changes:{0:"A"}})).receipt.attempt,key);
 assert.equal(db.results[key].answers[0],"B");
 run(db,"approveGrade",{attempt:key,fractions:[0,100]},admin,ctx);
 assert.equal((await call("review",{attempt:key})).score,6.67);
 assert.equal((await call("history",{},student2)).rows.length,0);
 const second=await call("open",{id,retakeAfter:attemptId});
 assert.equal(second.clock.deadline-now,120000);assert.notEqual(second.clock.attemptId,attemptId);
 const twice=await call("open",{id,retakeAfter:attemptId});assert.equal(twice.clock.attemptId,second.clock.attemptId);
 await call("finishTimed",{id,attemptId:second.clock.attemptId,photos:{1:[jpeg],2:[jpeg]}});
 set(0);
 const free=await call("open",{id,retakeAfter:second.clock.attemptId});
 assert(!free.clock);set(1);
 const freeResult=await call("submit",{id,attemptId:free.freeAttemptId,answers:["B","",""],photos:{1:[jpeg],2:[jpeg]}});
 assert.equal(freeResult.status,"pending");
 const mc=run(db,"publish",{...paper,answerSheet:["C","3,2"]},admin,ctx).id;
 db.itemLocations[mc]="1";
 const take=await call("open",{id:mc});
 await call("saveTimed",{id:mc,attemptId:take.clock.attemptId,changes:{0:"C"}});
 now=take.clock.deadline+1;
 const done=await call("open",{id:mc});
 assert.equal(done.receipt.total,5);assert.equal(done.receipt.date,take.clock.deadline);
 assert(!isWorking(db.results[done.receipt.attempt]));
 assert.equal((await call("finishTimed",{id:mc,attemptId:take.clock.attemptId,changes:{1:"3.2"}})).receipt.total,5);
}
let now=1700000000000;
const real=Date.now;Date.now=()=>now;
(async()=>{await scenario(false);await scenario(true);console.log("PASS timed PDF: resume, deadlines, offline closure, partial essays, grading, isolation, retries and duration changes in local and Firebase paths.")})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>Date.now=real);
