function importTools(mode,onRead){
 const section=document.createElement("section");section.className="importer";
 section.innerHTML=(mode==="sheet"?field("Link PDF đề trên Drive",'<input id="paperUrl" type="url" required placeholder="https://drive.google.com/file/d/…/view">'):"")+
 field(mode==="sheet"?"Bảng đáp án":"Mã TeX của đề",'<textarea id="sourceTex" rows="8" spellcheck="false" placeholder="'+(mode==="sheet"?"Mỗi đáp án một dòng, hoặc dán bảng DapAn…tex":"Dán các câu hỏi và dòng Đáp án đúng: B")+'"></textarea>')+
 '<div class="actions"><label class="filepick">Chọn tệp .tex<input id="texFile" type="file" accept=".tex,.txt,text/plain"></label><button type="button" id="sample">Điền ví dụ</button><button type="button" id="readTex" class="primary">Đọc và kiểm tra</button></div><p id="importMsg" role="status"></p><div id="previewTex"></div>';
 document.querySelector("#content").prepend(section);
 const source=section.querySelector("#sourceTex"),msg=section.querySelector("#importMsg"),preview=section.querySelector("#previewTex");
 function invalidate(){onRead(null);preview.innerHTML="";msg.textContent="Bấm Đọc và kiểm tra sau khi sửa."}
 source.oninput=invalidate;
 section.querySelector("#sample").onclick=()=>{source.value=mode==="sheet"?"B\nSĐĐS\n6,6":exampleTex;invalidate()};
 section.querySelector("#texFile").onchange=async e=>{const file=e.target.files[0];if(!file)return;invalidate();if(file.size>1000000){msg.textContent="Chọn tệp văn bản nhỏ hơn 1 MB.";return}try{source.value=await file.text()}catch{msg.textContent="Không đọc được tệp."}};
 section.querySelector("#readTex").onclick=()=>{try{
 const worked=document.querySelector("#solutionSource")?.value || "";
 if(mode==="tex" && /\\(?:hdg\s*\\khung|loigiai)\s*\{/.test(worked) && /\\begin\{(?:cauhoi|ex|cautlngan)\}/.test(source.value)){
   const paper=source.value;
   const format=document.querySelector("#format");
   format.value="paired";
   format.dispatchEvent(new Event("change"));
   document.querySelector("#pairPaper").value=paper;
   document.querySelector("#pairCheck").click();
   return;
 }
 const data=mode==="sheet"?sheetKeys(source.value):parseQuizTex(markTemplateImages(source.value));
 onRead(data);msg.textContent="Đã đọc "+data.length+" câu. Kiểm tra trước khi đăng.";
 if(mode==="sheet")preview.innerHTML=data.map((v,i)=>'<span class="keyChip">'+(i+1)+'. '+h(v)+'</span>').join("");
 }catch(e){onRead(null);preview.innerHTML="";msg.textContent=e.message;if(mode==="tex"&&e.message.includes("PDF Drive")){const switcher=document.createElement("button");switcher.type="button";switcher.textContent="Chuyển sang PDF Drive + phiếu trả lời";switcher.onclick=()=>{const format=document.querySelector("#format");format.value="sheet";format.dispatchEvent(new Event("change"));document.querySelector("#paperUrl").focus()};msg.append(document.createElement("br"),switcher)}}}
}
function sheetQuiz(item){
 const link='<a class="link" href="'+h(item.url)+'" target="_blank" rel="noopener">Mở PDF đề trong tab mới</a>';
 return (item.url?'<p>'+link+'</p>':'')+item.fields.map((t,i)=>'<fieldset class="box"><legend>'+illustrated("conan",item.art)+'Câu '+(i+1)+'</legend>'+(item.prompts?'<p>'+pairedPrompt(item.prompts[i],item.art)+'</p>':'')+
 (t==="tf"?Array.from("abcd",(c,j)=>field("Ý "+c,'<select data-index="'+i+'" data-bit="'+j+'"><option value="">Chưa chọn</option><option>Đ</option><option>S</option></select>')).join(""):
 t==="num"?field(illustrated("agasa",item.art)+"Đáp số",'<input data-index="'+i+'" maxlength="40" inputmode="decimal">'):
 Array.from("ABCD",c=>'<label class="choice"><input type="radio" name="q'+i+'" data-index="'+i+'" value="'+c+'"> '+c+'</label>').join(""))+'</fieldset>').join("")
}
function sheetInput(e){const el=e.target,i=Number(el.dataset.index);if(!Number.isInteger(i))return;
 if(el.dataset.bit!==undefined){const bits=(quizAnswers[i]||"----").split("");bits[+el.dataset.bit]=el.value||"-";quizAnswers[i]=bits.join("")}else quizAnswers[i]=el.value
}




