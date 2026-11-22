function parseSolutions(raw,count){
 const src=raw.replace(/\r/g,"").replace(/(?<!\\)%[^\n]*/g,"").trim();
 if(!src)return null;
 const blocks=[];
 const pattern=/\\hdg\s*\\khung\s*(?=\{)|\\loigiai\s*(?=\{)/g;
 let m;
 while((m=pattern.exec(src))){
 const [value]=latexArgs(src.slice(pattern.lastIndex),1);
 blocks.push(value.trim());pattern.lastIndex+=value.length+2;
 }
 if(!blocks.length){
 const lines=[...src.matchAll(/^[ \t]*Câu[ \t]+(\d+)[ \t]*[.):][ \t]*/gmi)];
 for(let i=0;i<lines.length;i++){
 if(+lines[i][1]!==i+1)throw Error("Kiểm tra số thứ tự ở lời giải "+(i+1)+".");
 blocks.push(src.slice(lines[i].index+lines[i][0].length,lines[i+1]?.index??src.length).trim());
 }
 }
 if((count>0&&blocks.length!==count)||!blocks.length||blocks.some(b=>!b))throw Error("Đã đọc "+blocks.length+" lời giải cho "+count+" câu. Kiểm tra thứ tự và số lượng trước khi đăng.");
 return blocks;
}
function solutionInput(){
 const el=document.createElement("fieldset");el.className="box";el.innerHTML='<legend>Lời giải theo câu (tùy chọn)</legend><label>Chọn tệp .tex <input type="file" accept=".tex,.txt"></label><label class="field">Hoặc dán TeX lời giải<textarea id="solutionSource" rows="6" placeholder="Câu 1: …&#10;Câu 2: …"></textarea></label><button type="button">Xem thử lời giải</button><div role="status"></div>';
 document.querySelector("#content").after(el);
 const input=el.querySelector("input"),source=el.querySelector("textarea"),out=el.querySelector("[role=status]");
 input.onchange=async()=>{try{if(!input.files[0])return;if(input.files[0].size>650000)throw Error("Tệp lời giải vượt 650 KB.");source.value=await input.files[0].text();source.dispatchEvent(new Event("input"));out.textContent="Đã đọc tệp. Bấm Xem thử để đối chiếu từng câu."}catch(e){out.textContent=e.message}};
 source.oninput=()=>out.textContent="";
 el.querySelector("button").onclick=()=>{try{const count=document.querySelectorAll(".question").length||document.querySelectorAll(".keyChip").length;const list=parseSolutions(source.value,count)||[];out.innerHTML=(count===0&&list.length?"<p>Đã đọc "+list.length+" lời giải. Nhập đề hoặc bảng đáp án để đối chiếu số câu trước khi đăng.</p>":"")+list.map((v,i)=>'<details><summary>Câu '+(i+1)+'</summary>'+solutionHTML(v)+'</details>').join("")}catch(e){out.textContent=e.message}};
 return el;
}
function solutionHTML(tex){
 const normalized=tex.replace(/\\\\\[\s*\d+(?:\.\d+)?(?:cm|mm|pt|em|ex)\s*\]/g,"\n").replace(/\\begin\{(align\*?|equation\*?)\}([\s\S]*?)\\end\{\1\}/g,(_,env,v)=>"\\["+ (env.startsWith("align")?"\\begin{aligned}"+v+"\\end{aligned}":v)+"\\]");
 const parts=normalized.split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\])/g);
 return parts.map((s,i)=>i%2?mathText(s):h(s).replace(/\\(?:textbf|textit)\{([^{}]*)\}/g,"<strong>$1</strong>").replace(/\\\\(?:\[[^\]]*\])?|\n/g,"<br>")).join("");
}
async function reviewMyAttempt(attempt){
 try{
 const r=await api("review",{attempt});main.innerHTML='<h1>'+h(r.title)+'</h1><p>'+r.score+' / 10 điểm</p>'+pdfButton(r.solutionPdf,"Mở lời giải PDF")+r.keys.map((key,i)=>'<details class="box"><summary>Câu '+(i+1)+' · '+Number(r.points[i].toFixed(2))+' điểm</summary>'+(r.prompts[i]?'<p>'+pairedPrompt(r.prompts[i],defaultStyle)+'</p>':'')+'<p>Đã chọn: '+(key==="TL"?"Đã nộp ảnh":h(r.answers[i]||"Bỏ trống"))+' · Đáp án: '+h(key)+'</p><div>'+(r.solutions[i]?solutionHTML(r.solutions[i]):"Chưa có lời giải cho câu này.")+'</div></details>').join("")+button("Điểm của tôi","historyView()");
 }catch(e){notifyError(e)}
}
async function templatePanel(){
 try{
 const {template:t}=await api("templateAdmin");
 panel.innerHTML='<h2>Mẫu dùng chung</h2><p>Mẫu áp dụng cho các đề khi học sinh mở bài. Chọn tệp mới để thay thế tệp hiện tại.</p>';
 for(const [slot,label] of [["style","Định dạng LaTeX (.sty)"],["conan","Ảnh đầu câu · Conan"],["agasa","Ảnh đáp số · Agasa"]]){
 const box=document.createElement("fieldset");
 box.className="box";
 box.innerHTML='<legend>'+label+'</legend><p class="current"></p><label>Thay bằng tệp mới <input type="file" accept="'+(slot==="style"?".sty":".png")+'"></label> <button type="button">Xóa</button><p role="status" aria-live="polite"></p>';
 panel.append(box);
 const input=box.querySelector("input"),del=box.querySelector("button"),msg=box.querySelector("[role=status]");
 let current=t[slot];
 function showCurrent(){
  const display=box.querySelector(".current");
  if(current?.removed){display.textContent="Đã xóa khỏi mẫu chung.";return}
  display.textContent=current?"Đang dùng bản đã tải lên · ":"Đang dùng bản mặc định · ";
  if(slot==="style"){display.append(current?.name||defaultStyle.name);return}
  const img=document.createElement("img");
  img.className="frame-icon";img.alt=slot;img.src=current||templateImages[slot];display.append(img);
 }
 showCurrent();del.disabled=!!current?.removed;
 async function save(remove){
  const file=input.files[0];if(!remove&&!file)return;
  input.disabled=del.disabled=true;msg.textContent=remove?"Đang xóa…":"Đang lưu "+file.name+"…";
  try{
   let value=null;
   if(!remove && slot==="style"){
    if(!/\.sty$/i.test(file.name)||file.size>180000)throw Error("Chọn tệp .sty tối đa 180 KB.");
    const source=await file.text();value={...readFrameStyle(source,file.name),source};
   }else if(!remove){value=await smallImage(file)}
   await api("setTemplate",{slot,value});
   current=remove?{removed:true}:value;
   showCurrent();msg.textContent=remove?"Đã xóa.":"Đã lưu "+file.name+" vào mẫu dùng chung.";
  }catch(e){msg.textContent="Chưa xác nhận lưu thành công. "+e.message}
  finally{input.disabled=false;del.disabled=!!current?.removed;if(remove||msg.textContent.startsWith("Chưa"))input.value=""}
 }
 input.onchange=()=>save(false);
 del.onclick=()=>{if(confirm("Xóa mục này khỏi mẫu chung?"))save(true)};
 }
 }catch(e){notifyError(e)}
}




