function driveViewer(url,title) {
 const file=driveFile(url);
 return '<section class="drive-view"><div class="drive-heading"><strong>'+h(title)+'</strong><a class="link" target="_blank" rel="noopener" href="'+h(file.view)+'">Mở riêng ↗</a></div><iframe title="'+h(title)+'" src="'+h(file.preview)+'" allowfullscreen></iframe></section>';
}
function driveWorkspace(item){
 const fields=sheetQuiz({...item,url:null,prompts:null});
 return '<div class="exam-tools">'+(item.clock?'<span class="exam-clock">Còn <b role="timer"></b></span><span class="save-note" role="status"></span>':'')+'<button type="button" class="wide-exam" aria-pressed="false">Xem ngang</button></div><div class="drive-work">'+driveViewer(item.url,"Đề bài PDF")+'<div class="drive-sheet" tabindex="0" aria-label="Phiếu trả lời"><h2>Phiếu trả lời</h2>'+fields+'<button class="primary" type="submit">Nộp bài</button></div></div>';
}
function bindExamLayout(form){
 const toggle=form.querySelector(".wide-exam");
 if(!toggle)return;
 const landscape=matchMedia("(orientation: landscape) and (max-height: 600px) and (pointer: coarse)");
 function show(active){
  form.classList.toggle("wide-active",active);
  toggle.setAttribute("aria-pressed",String(active));
  toggle.textContent=active?"Thoát xem ngang":"Xem ngang";
 }
 const rotate=()=>show(landscape.matches);
 rotate();
 toggle.onclick=()=>show(!form.classList.contains("wide-active"));
 landscape.addEventListener("change",rotate);
 const removed=new MutationObserver(()=>{
  if(form.isConnected)return;
  landscape.removeEventListener("change",rotate);
  removed.disconnect();
 });
 removed.observe(main,{childList:true});
}
function minutesField(value=""){
 return field("Thời gian làm bài (phút)",'<input name="durationMinutes" type="number" inputmode="numeric" min="1" step="1" value="'+h(value||"")+'" placeholder="Để trống nếu không giới hạn">');
}
function driveEditor(){
 const form=document.querySelector("#create");
 const content=form.querySelector("#content");
 content.innerHTML=field("PDF đề trên Google Drive",'<input type="url" name="paper" required>')+
 field("PDF lời giải trên Google Drive",'<input type="url" name="solution" required>')+minutesField()+
 field("Dạng đề",'<select name="kind"><option value="key">Trắc nghiệm hoặc đề hỗn hợp</option><option value="essay">Chỉ tự luận</option></select>')+
 '<div id="keySource">'+field("Tệp đáp án trên Google Drive",'<input name="keyUrl" type="url" required>')+'<p>PDF có lớp chữ hoặc TXT/CSV. Trong tệp văn bản, ghi mỗi đáp án một dòng. Ghi TL cho câu tự luận, ví dụ A, TL, B trên ba dòng.</p><button type="button" id="readDrive">Đọc đáp án</button></div>'+
 '<div id="essayCount" hidden>'+field("Số câu tự luận",'<input type="number" min="1" max="2000" name="count" value="1">')+'</div>'+
 '<div id="parsedKeys" hidden>'+field("Đáp án theo thứ tự câu · có thể sửa",'<textarea name="keys" rows="6"></textarea>')+'</div><p id="keyNotice" role="status"></p>';
 const f=form.elements,notice=content.querySelector("#keyNotice"),preview=content.querySelector("#parsedKeys");
 let revision=0;
 function clear(){revision++;preview.hidden=true;f.keys.value="";notice.textContent=""}
 f.kind.onchange=()=>{clear();const essay=f.kind.value==="essay";content.querySelector("#keySource").hidden=essay;content.querySelector("#essayCount").hidden=!essay;f.keyUrl.required=!essay;f.count.disabled=!essay};
 f.kind.onchange();f.keyUrl.oninput=clear;
 content.querySelector("#readDrive").onclick=async()=>{
  clear();const run=revision;
  try{
   driveFile(f.keyUrl.value);notice.textContent="Đang đọc tệp đáp án…";
   const result=await api("readDriveKey",{url:f.keyUrl.value});
   const keys=result.pdf?await readDrivePdf(Uint8Array.from(atob(result.pdf),c=>c.charCodeAt(0)),await import("./assets/pdfjs/pdf.min.mjs"),new URL("assets/pdfjs/pdf.worker.min.mjs",document.baseURI).href):parseDriveAnswers(result.text);
   if(run!==revision)return;
   f.keys.value=keys.join("\n");preview.hidden=false;notice.textContent="Đã đọc "+keys.length+" câu. Đối chiếu số câu và thứ tự trước khi đăng.";
  }catch(e){if(run===revision)notice.textContent=e.message}
 };
 return ()=>{
  const url=driveFile(f.paper.value).view,solutionUrl=driveFile(f.solution.value).view;
  if(f.kind.value!=="essay"&&preview.hidden)throw Error("Bấm Đọc đáp án trước khi đăng.");
  const keys=f.kind.value==="essay"?Array(Number(f.count.value)).fill("TL"):sheetKeys(f.keys.value);
  return {type:"drive",url,solutionUrl,answerSheet:keys,durationMinutes:Number(f.durationMinutes.value)};
 };
}
