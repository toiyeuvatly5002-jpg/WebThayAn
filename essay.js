async function essayPhotos(form) {
 const photos = {};
 let size = 0;
 for (const input of form.querySelectorAll("[data-essay]")) {
  const pages = [];
  for (const file of input.files) {
   const image = new Image();
   const url = URL.createObjectURL(file);
   try {
    image.src = url;
    await image.decode();
    const ratio = Math.min(1, 1800 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * ratio));
    canvas.height = Math.max(1, Math.round(image.height * ratio));
    const context = canvas.getContext("2d");
    context.fillStyle = "white";
    context.fillRect(0,0,canvas.width,canvas.height);
    context.drawImage(image,0,0,canvas.width,canvas.height);
    pages.push(canvas.toDataURL("image/jpeg",0.76));
   } catch { throw Error("Không đọc được ảnh "+file.name+". Hãy chọn ảnh JPEG hoặc PNG."); }
   finally { URL.revokeObjectURL(url); }
   size += pages[pages.length-1].length;
   if(size>4200000)throw Error("Tổng ảnh vượt dung lượng một lần nộp. Hãy cắt phần nền hoặc chọn ảnh nhỏ hơn.");
  }
  photos[input.dataset.essay] = pages;
 }
 return photos;
}
async function gradingQueue() {
 try {
  const {rows}=await api("gradingQueue");
  panel.innerHTML="<h2>Bài tự luận chờ chấm</h2>"+(rows.length?rows.map(r=>'<article class="box"><strong>'+h(r.title)+'</strong><p>'+h(r.name)+' · '+h(r.code)+'</p><button data-grade="'+h(r.attempt)+'">Mở bài chấm</button></article>').join(""):"<p>Đã chấm hết các bài đã nộp.</p>");
  panel.querySelectorAll("[data-grade]").forEach(el=>el.onclick=()=>gradePaper(el.dataset.grade));
 }catch(e){notifyError(e)}
}
async function gradePaper(attempt) {
 try {
  const r=await api("gradingPaper",{attempt});
  panel.innerHTML='<h2>'+h(r.title)+'</h2><p>'+h(r.name)+' · '+h(r.code)+' · Điểm tự động: '+r.auto.toFixed(2)+'/10</p>'+pdfButton(r.paperPdf,"Mở đề PDF")+'<form id="markPaper">'+r.essay.map(i=>'<fieldset class="box"><legend>Câu '+(i+1)+'</legend>'+pairedPrompt(r.prompts[i],defaultStyle)+r.photos[i].map(src=>'<img alt="Bài làm câu '+(i+1)+'" style="display:block;max-width:100%" src="'+h(src)+'">').join("")+field('Mức đạt (%) · tối đa '+r.max.toFixed(2)+' điểm','<input type="number" min="0" max="100" step="any" required>')+'</fieldset>').join("")+'<button class="primary">Duyệt và trả điểm</button></form>';
  panel.querySelector("form").onsubmit=async e=>{
   e.preventDefault();
   const fractions=Array.from(e.target.querySelectorAll("input"),input=>input.valueAsNumber);
   try{const result=await api("approveGrade",{attempt,fractions});await gradingQueue();message.textContent="Đã trả "+result.total+" điểm cho "+r.name+"."}catch(err){notifyError(err)}
  };
 }catch(e){notifyError(e)}
}
function pdfButton(data,label) {
 if(!data)return "";
 const raw=atob(data),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
 const url=URL.createObjectURL(new Blob([bytes],{type:"application/pdf"}));
 return '<a class="link" target="_blank" rel="noopener" href="'+url+'">'+label+'</a>';
}
const compilerLink=location.hash.match(/^#compiler=(\d{1,5})\.([a-f0-9]{64})$/);
if(compilerLink)history.replaceState(null,"",location.pathname+location.search);
function compilerControls(onRead,reset) {
 const controls=document.createElement("details");
 controls.innerHTML='<summary>Biên dịch toàn bộ bằng pdfLaTeX trên máy giáo viên</summary><p>Dán hai tài liệu hoàn chỉnh. Tải nguồn, mở Bien-dich-de.cmd trên máy có MiKTeX, rồi chọn bản đã biên dịch bên dưới.</p><button type="button">Tải nguồn biên dịch</button><label>Nhập bản đã biên dịch <input type="file" accept=".json"></label>';
 content.append(controls);
 if(compilerLink){
  controls.open=true;
  const direct=document.createElement("button");direct.type="button";direct.className="primary";direct.textContent="Biên dịch hai ô bằng MiKTeX";
  controls.prepend(direct);
  direct.onclick=async()=>{
   const paper=pairPaper.value,worked=solutionSource.value;
   reset();direct.disabled=true;pairPreview.textContent="Đang biên dịch bằng MiKTeX…";
   try{
    const keys=sheetKeys(keysFromSolutions(paper,worked));
    const {template}=await api("templateAdmin");
    const response=await fetch("http://127.0.0.1:"+compilerLink[1]+"/compile",{method:"POST",headers:{"X-Local-Key":compilerLink[2]},body:JSON.stringify({paper,worked,template}),referrerPolicy:"no-referrer"});
    if(!response.ok)throw Error(await response.text());
    const {pdfs}=await response.json();
    if(!direct.isConnected||paper!==pairPaper.value||worked!==solutionSource.value)return;
    const prompts=keys.map((_,i)=>"Câu "+(i+1)+" trong bản đề PDF");
    onRead({keys,prompts,pdfs});
    pairPreview.innerHTML=pdfButton(pdfs[0],"Xem đề PDF")+" "+pdfButton(pdfs[1],"Xem lời giải PDF")+keys.map((v,i)=>'<p class="keyChip">Câu '+(i+1)+' · '+h(v)+'</p>').join("");
   }catch(err){pairPreview.textContent=err.message}finally{direct.disabled=false}
  };
 }
 controls.querySelector("button:not(.primary)").onclick=async()=>{
  try {
   const paper=pairPaper.value,worked=solutionSource.value;
   keysFromSolutions(paper,worked);
   const {template}=await api("templateAdmin");
   const link=document.createElement("a");
   link.href=URL.createObjectURL(new Blob([JSON.stringify({paper,worked,template})],{type:"application/json"}));
   link.download="nguon-de.json"; link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);
  }catch(e){pairPreview.textContent=e.message}
 };
 controls.querySelector("input").onchange=async e=>{
  reset();
  try{
   const file=e.target.files[0];if(!file)return;
   const {paper,worked,pdfs}=JSON.parse(await file.text());
   if(!Array.isArray(pdfs)||pdfs.length!==2||pdfs.some(p=>typeof p!=="string"||!p.startsWith("JVBERi0")))throw Error("Tệp thiếu PDF đề hoặc lời giải.");
   const keys=sheetKeys(keysFromSolutions(paper,worked));
   pairPaper.value=paper;solutionSource.value=worked;pairKeys.value="";
   const prompts=keys.map((_,i)=>"Câu "+(i+1)+" trong bản đề PDF");
   onRead({keys,prompts,pdfs});
   pairPreview.innerHTML=pdfButton(pdfs[0],"Xem bản đề")+" "+pdfButton(pdfs[1],"Xem bản giải")+keys.map((v,i)=>'<p class="keyChip">Câu '+(i+1)+' · '+h(v)+'</p>').join("");
  }catch(err){pairPreview.textContent=err.message}
 };
}
