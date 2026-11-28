async function essayPhotos(form, onlyIndex) {
 const photos = {};
 let size = 0;
 for (const input of form.querySelectorAll("[data-essay]")) {
  if (onlyIndex !== undefined && input.dataset.essay !== onlyIndex) continue;
  const pages = photos[input.dataset.essay] || [];
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
  panel.innerHTML='<h2>'+h(r.title)+'</h2><p>'+h(r.name)+' · '+h(r.code)+' · Điểm tự động: '+r.auto.toFixed(2)+'/10</p>'+(r.paperUrl?driveViewer(r.paperUrl,"Đề bài PDF"):"")+pdfButton(r.paperPdf,"Mở đề PDF")+'<form id="markPaper">'+r.essay.map(i=>'<fieldset class="box"><legend>Câu '+(i+1)+'</legend>'+pairedPrompt(r.prompts?.[i]||"",r.art)+(r.photos?.[i]?.length?r.photos[i].map(src=>'<img alt="Bài làm câu '+(i+1)+'" style="display:block;max-width:100%" src="'+h(src)+'">').join(""):"<p>Học sinh chưa gửi ảnh câu này.</p>")+field('Mức đạt (%) · tối đa '+r.max.toFixed(2)+' điểm','<input type="number" min="0" max="100" step="any" required>')+'</fieldset>').join("")+'<button class="primary">Duyệt và trả điểm</button></form>';
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
