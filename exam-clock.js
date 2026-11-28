function showExamReceipt(result, answers, retry) {
 const solution=result.solutionUrl?'<div class="drive-review">'+driveViewer(result.solutionUrl,"Lời giải PDF")+'</div>':"";
 if(result.status==="pending"){
  main.innerHTML='<h1>Đã nộp bài</h1><p>Chờ thầy chấm tự luận và duyệt điểm. Kết quả sẽ hiện trong Điểm của tôi.</p>'+solution+button("Điểm của tôi","historyView()");
 }else{
  const saved=result.answers||answers;
  main.innerHTML='<h1>Kết quả</h1><article class="box"><h2>'+h(result.title)+'</h2><p>'+result.total+' / 10 điểm</p>'+result.keys.map((k,i)=>'<p>Câu '+(i+1)+' · Đã chọn '+h(saved[i]||"—")+' · Đáp án '+h(k)+'</p>').join("")+'</article>'+(solution||reviewButton(result.attempt))+button("Về phòng học","home()");
  bindReviews();
 }
 if(result.autoSubmitted){
  const notice=document.createElement("p");
  notice.textContent="Đã hết giờ. Hệ thống đã tự nộp phần bài làm được lưu trước hạn.";
  main.querySelector("h1").after(notice);
 }
 if(retry){
  const again=document.createElement("button");
  again.textContent="Làm lại";again.onclick=retry;main.append(again);
 }
}

function rememberExam(value){
 try{if(value)sessionStorage.setItem("currentTimedExam",JSON.stringify(value));else sessionStorage.removeItem("currentTimedExam")}catch{}
}
function rememberedExam(){
 try{return JSON.parse(sessionStorage.getItem("currentTimedExam"))}catch{return null}
}

function startExamClock(form,item){
 const clock=item.clock, timer=form.querySelector('[role="timer"]'), note=form.querySelector(".save-note");
 const answers=quizAnswers;
 const changes=new Map(), photos=new Map(), photoJobs=new Map();
 let stamp=performance.now(), serverTime=clock.serverNow, wallTime=Date.now();
 let busy=false, finishing=false, closed=false, interval, retry;
 const remaining=()=>Math.max(0,clock.deadline-serverTime-Math.max(performance.now()-stamp,Date.now()-wallTime));
 const status=(text,error=false)=>{note.textContent=text;note.toggleAttribute("data-error",error)};
 const lock=on=>form.querySelectorAll("[data-index],[data-essay],button[type=submit]").forEach(input=>input.disabled=on);
 function photoMessage(i,text){
  const box=form.querySelector('[data-essay="'+i+'"]')?.closest("fieldset");
  if(!box)return;
  let label=box.querySelector(".photo-count");
  if(!label){label=document.createElement("p");label.className="photo-count";box.append(label)}
  label.textContent=text;
 }
 function photoCount(i,count){photoMessage(i,"Đã lưu "+count+" ảnh. Chọn ảnh mới để thay bộ ảnh của câu này.")}
 for(const el of form.querySelectorAll("[data-index]")){
  const value=answers[el.dataset.index]||"";
  if(el.type==="radio")el.checked=el.value===value;
  else if(el.dataset.bit!==undefined)el.value=["Đ","S"].includes(value[el.dataset.bit])?value[el.dataset.bit]:"";
  else el.value=value;
 }
 for(const [i,count] of Object.entries(clock.photoCounts))photoCount(i,count);
 const parameters={id:item.id,attemptId:clock.attemptId};
 rememberExam({id:item.id,code:me.code});
 function cleanup(){
  closed=true;clearInterval(interval);clearTimeout(retry);
  window.removeEventListener("online",wake);
  document.removeEventListener("visibilitychange",wake);
  observer.disconnect();
 }
 const observer=new MutationObserver(()=>{if(!form.isConnected)cleanup()});
 observer.observe(main,{childList:true});
 function finish(receipt){
  cleanup();
  if(!form.isConnected)return;
  rememberExam(null);
  showExamReceipt(receipt,answers,()=>openItem(item.id,clock.attemptId));
 }
 function tick(){
  if(closed)return;
  const sec=Math.ceil(remaining()/1000);
  timer.textContent=Math.floor(sec/60)+":"+String(sec%60).padStart(2,"0");
  timer.parentElement.classList.toggle("urgent",sec<=60);
  if(!sec){lock(true);if(!retry)flush()}
 }
 async function flush(){
  if(closed||busy)return;
  clearTimeout(retry);retry=null;
  const expired=remaining()===0;
  const edits=new Map(changes),images=new Map(photos);
  const finishNow=finishing && !photoJobs.size && !edits.size && !images.size && !expired;
  if(!expired&&!edits.size&&!images.size&&!finishNow)return;
  busy=true;
  status(expired?"Hết giờ · Đang lấy kết quả…":finishNow?"Đang nộp bài…":"Đang lưu bài…");
  let success=false;
  try{
   const payload=expired?parameters:{...parameters,changes:Object.fromEntries(edits),photos:Object.fromEntries(images)};
   const reply=await api(finishNow?"finishTimed":"saveTimed",payload);
   if(closed)return;
   if(reply.receipt){finish(reply.receipt);return}
   serverTime=reply.serverNow;stamp=performance.now();wallTime=Date.now();
   if(!expired){
    for(const [i,v] of edits)if(changes.get(i)===v)changes.delete(i);
    for(const [i,v] of images){
     if(photos.get(i)===v)photos.delete(i);
     photoCount(i,v.length);
    }
   }
   lock(finishing||remaining()===0);
   status("Đã lưu bài");success=true;
  }catch(error){
   if(closed)return;
   if(error.status>=400 && error.status<500 && error.status!==429){
    finishing=false;lock(remaining()===0);status(error.message,true);
    // The server enforces a total photo limit. Keep answer edits independently retryable.
    if(!finishNow && error.status!==401 && images.size){
     for(const [i,v] of images)if(photos.get(i)===v){
      photos.delete(i);photoMessage(i,"Ảnh mới chưa được lưu. "+error.message);
     }
     if(changes.size)queueMicrotask(flush);
    }
   }else{
    status(expired?"Hết giờ. Đang chờ kết nối để xem bài đã nộp.":"Chưa lưu được. Đang chờ kết nối để gửi lại.",true);
    retry=setTimeout(()=>{retry=null;flush()},3000);
   }
  }finally{
   busy=false;
   if(!closed&&success&&(changes.size||photos.size||finishing&&!photoJobs.size))queueMicrotask(flush);
  }
 }
 function changed(e){
  if(closed||remaining()===0){tick();return}
  const input=e.target,i=input.dataset.index;
  if(i===undefined)return;
  sheetInput(e);changes.set(i,answers[i]);status("Đang lưu bài…");
  flush();
 }
 form.oninput=changed;
 form.onchange=async e=>{
  const i=e.target.dataset.essay;
  if(i===undefined){if(e.target.type!=="radio"&&e.target.tagName!=="SELECT")changed(e);return}
  if(!e.target.files.length||!remaining())return;
  const job={};photoJobs.set(i,job);photoMessage(i,"Đang xử lý ảnh mới…");status("Đang xử lý ảnh…");
  try{
   const data=await essayPhotos(form,i);
   if(photoJobs.get(i)!==job||closed)return;
   if(remaining()>0)photos.set(i,data[i]);
  }catch(error){
   if(photoJobs.get(i)===job){finishing=false;lock(remaining()===0);photoMessage(i,error.message);status(error.message,true)}
  }finally{
   if(photoJobs.get(i)===job){photoJobs.delete(i);flush()}
  }
 };
 form.onsubmit=e=>{e.preventDefault();finishing=true;lock(true);flush()};
 function wake(){tick();flush()}
 document.addEventListener("visibilitychange",wake);window.addEventListener("online",wake);
 interval=setInterval(tick,400);tick();
}
