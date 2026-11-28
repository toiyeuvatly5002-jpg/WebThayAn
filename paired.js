function keysFromSolutions(paper, worked) {
 if(!worked.trim())return keysInPaper(paper);
 const questions = splitPaper(paper);
 const answers = splitPaper(worked);
 const solutions = parseSolutions(worked, questions.length);
 if (!solutions || answers.length !== questions.length) throw Error("Kiểm tra số câu trong đề và tệp lời giải.");
 return questions.map((question, i) => {
   const fail = () => { throw Error("Kiểm tra câu "+(i+1)+" trong tệp lời giải."); };
   const stem = block => (block.src.includes("\\noidung")?latexArgs(block.src.split(/\\noidung\s*/)[1],1)[0]:block.src).replace(/\\begin\{figure\}[\s\S]*?\\end\{figure\}|\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}/g,"").replace(/\s+/g," ").trim();
   if (question.type !== answers[i].type || stem(question) !== stem(answers[i])) fail();
   if (isEssay(question)) return "TL";
   const solution = solutions[i];
   if (/\\phatbieuDS\b/.test(question.src)) {
     const parts = [...solution.matchAll(/([abcd])\)\s*\\textbf\{(Đúng|Sai)[.!]?\}/gi)];
     if (parts.map(x=>x[1].toLowerCase()).join("") !== "abcd") fail();
     return parts.map(x=>x[2].toLowerCase()==="đúng"?"Đ":"S").join("");
   }
   const pattern = question.type === "cautlngan" ? /(?:Trả lời ngắn|Đáp án(?: đúng)?)\s*[:：]\s*([-+]?\d+(?:[.,]\d+)?)[ \t]*[.]?[ \t]*(?=\}|$)/gmi : /(?:Chọn\s+|Đáp án(?: đúng)?\s*[:：]\s*)([A-D])[ \t]*[.!]?[ \t]*(?=\}|$)/gmi;
   const matches = [...solution.matchAll(pattern)];
   if (matches.length !== 1) fail();
   return matches[0][1].toUpperCase();
 }).join("\n");
}
function keysInPaper(source){
 // Keep answer comments for extraction. The student-facing parser drops comments.
 const blocks=splitPaper(source.replace(/^[ \t]*%+[ \t]*(?=Đáp án(?: đúng)?\s*[:：])/gmi,""));
 if(!blocks.length)throw Error("Dán TeX đề trước khi đọc đáp án.");
 return blocks.map((block,i)=>{
  if(isEssay(block))return "TL";
  const after=blocks[i+1]?.gap??source.slice(source.lastIndexOf("\\end{"+block.type+"}")+("\\end{"+block.type+"}").length);
  const extra=after.match(/^\s*%?\s*(Đáp án(?: đúng)?\s*[:：][^\r\n]+)/i)?.[1]||"";
  const keys=new Set([...((block.src+"\n"+extra).matchAll(/^[ \t]*Đáp án(?: đúng)?\s*[:：][ \t]*(TL|[ĐS]{4}|[A-D]|[-+]?\d+(?:[.,]\d+)?)[ \t]*\.?[ \t]*$/gmi))].map(m=>m[1].toUpperCase()));
  if(/\\choice\b|\\begin\{phuongan\}/.test(block.src)){
   const options=block.src.includes("\\choice")?latexArgs(block.src.split(/\\choice\b/)[1],4):block.src.split("\\begin{phuongan}")[1].split("\\end{phuongan}")[0].split(/\\task\b/).slice(1);
   options.forEach((option,j)=>{if(/\\True\b/.test(option))keys.add("ABCD"[j])});
  }
  if(keys.size!==1)throw Error("Câu "+(i+1)+(keys.size?" có đáp án mâu thuẫn.":" chưa có đáp án. Dán thêm TeX lời giải hoặc bảng đáp án."));
  return [...keys][0];
 }).join("\n");
}
function isEssay(block) {
 return block.type==="tuluan" || (block.type==="cauhoi" && !/\\(?:begin\{phuongan\}|choice\b|phatbieuDS\b)/.test(block.src));
}
function splitPaper(source){
 const body=source.replace(/\r/g,"").replace(/(?<!\\)%[^\n]*/g,"");
 const blocks=[...body.matchAll(/\\begin\{(cauhoi|cautlngan|tuluan|ex)\}(?:\[\d+\])?([\s\S]*?)\\end\{\1\}/g)];
 if(blocks.length)return blocks.map((m,i)=>({src:m[2],type:m[1],gap:body.slice(i?blocks[i-1].index+blocks[i-1][0].length:0,m.index)}));
 return body.trim().split(/(?=^Câu\s+\d+\s*[.:)])/gmi).filter(s=>s.trim()).map(src=>({src,type:"plain",gap:""}))
}
function tikzLibrariesFrom(...sources) {
 const names = new Set();
 for (const source of sources) {
  const code = source.replace(/(?<!\\)%[^\n]*/g, "");
  for (const declaration of code.matchAll(/\\usetikzlibrary\s*\{([^{}]*)\}/g)) {
   for (const name of declaration[1].split(",").map(value => value.trim()).filter(Boolean)) {
    if (!/^[\w.-]+$/.test(name)) throw Error("Tên thư viện TikZ cần được khai báo trực tiếp: "+name);
    names.add(name);
   }
  }
 }
 return [...names].join(",");
}
async function compileFigures(text, libraries, renderFigure, location) {
 const pattern=/\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}/g;
 const tokens=[];
 let result="",last=0;
 for(const match of text.matchAll(pattern)){
  const source=match[0];
  const names=new Set(libraries.split(",").filter(Boolean));
  if(/\bdecoration\s*=\s*\{\s*(?:coil|zigzag|snake|random steps)\b/.test(source))names.add("decorations.pathmorphing");
  if(/\bdecoration\s*=\s*\{\s*markings\b/.test(source))names.add("decorations.markings");
  if(/(?:[>=]\s*|\{)(?:Latex|Stealth)\b/.test(source))names.add("arrows.meta");
  try{
   const {data}=await renderFigure({source,libraries:[...names].join(",")});
   const token="[[diagram:"+data+"]]";
   tokens.push(token);
   result+=text.slice(last,match.index)+token;
   last=match.index+source.length;
  }catch(e){throw Error(location+", hình "+(tokens.length+1)+": "+e.message)}
 }
 return {text:result+text.slice(last),tokens};
}
async function pairedPaper(source,answerText,template={},renderFigure=body=>api("tikz",body)){
 const keys=sheetKeys(answerText),blocks=splitPaper(markTemplateImages(source,template.imageNames));
 if(keys.length!==blocks.length)throw Error("Đề có "+blocks.length+" câu, bảng có "+keys.length+" đáp án.");
 const libraries=tikzLibrariesFrom(source,template.style?.source||"");
 const prompts=[];let context="",remaining=0;
 for(const [i,{src:raw,type,gap}] of blocks.entries()){
 const common=gap.match(/\\noindent\s*\\textbf\{Sử dụng[^}\n]*?câu\s+(\d+)\s+và\s+câu\s+(\d+)[^}]*\}([^\n]+)/i);
 if(common){context=common[3].replace(/\\\\\[[^\]]*\]/g,"").trim();remaining=Number(common[2])-Number(common[1])+1}
 const prefix=remaining>0?(remaining--,context+"\n\n"):"";
 let text,format;
 const figure=await compileFigures(raw,libraries,renderFigure,"Câu "+(i+1));
 const tokens=figure.tokens;
 let src=figure.text.replace(/\\begin\{figure\}(?:\[[^\]]*\])?|\\end\{figure\}|\\centering\b/g,"");
 if(isEssay({type,src})){
 const body=src.split(/\\noidung\s*/)[1];
 text=prefix+(body?latexArgs(body,1)[0]:src.trim());format="essay";
 }else if(type==="cautlngan"||/\\phatbieuDS\b/.test(src)){
 text=prefix+latexArgs(src.split(/\\noidung\s*/)[1]||"",1)[0];format=type==="cautlngan"?"num":"tf";
 if(format==="tf"){const bits=[...src.matchAll(/\\phatbieuDS\s*/g)].map(m=>latexArgs(src.slice(m.index+m[0].length),3));if(bits.length!==4)throw Error("Câu "+(i+1)+" cần 4 phát biểu.");text+="\n"+bits.map(([label,v])=>label+") "+v).join("\n")}
 }else{
 const wrapped=type==="plain"?src:"\\begin{"+type+"}"+src+"\\end{"+type+"}";
 const [q]=parseQuizTex(wrapped+"\nĐáp án đúng: "+keys[i]);
 text=prefix+q.text+"\n"+q.options.map((v,j)=>"ABCD"[j]+". "+v).join("\n");format="mc";
 }
 const expected=keys[i]==="TL"?"essay":/^[A-D]$/.test(keys[i])?"mc":/^[ĐS]{4}$/.test(keys[i])?"tf":"num";
 if(expected!==format)throw Error("Sai dạng đáp án ở câu "+(i+1)+".");
 for(const t of tokens)if(!text.includes(t))text+="\n"+t;
 prompts.push(text);
 }
 return {keys,prompts};
}
function pairedPrompt(text,art){
 return displayDiagrams(inlineArt(mathText(text),art)).replace(/\[\[paper-image:(\d+)\]\]/g,"Hình cũ cần được giáo viên nhập lại từ TeX.");
}
function displayDiagrams(html){
 return html.replace(/\[\[diagram:([A-Za-z0-9+/=]+)\]\]/g,(_,data)=>'<img style="max-width:100%;height:auto" alt="Hình TikZ" src="data:image/svg+xml;base64,'+data+'">');
}
function pairedEditor(onRead){
 content.innerHTML='<section class="importer">'+field("TeX đề",'<textarea id="pairPaper" rows="8" placeholder="Dán nội dung đề tại đây"></textarea>')+field("TeX đáp án (bỏ trống để lấy từ tệp lời giải bên dưới)",'<textarea id="pairKeys" rows="5" placeholder="Dán bảng DapAn…tex hoặc mỗi đáp án một dòng"></textarea>')+'<button type="button" id="pairCheck">Đọc và kiểm tra</button><div id="pairPreview" role="status"></div></section>';
 let version=0;
 let generatedKeys=null;
 const figures=new Map();
 const paper=document.querySelector("#pairPaper"), keysInput=document.querySelector("#pairKeys");
 const preview=document.querySelector("#pairPreview"), worked=document.querySelector("#solutionSource");
 const check=document.querySelector("#pairCheck");
 function reset(){
  version++;
  onRead(null);
  delete worked.compiledSolutions;
  preview.replaceChildren();
  if(generatedKeys!==null && keysInput.value===generatedKeys)keysInput.value="";
  generatedKeys=null;
 }
 compilerControls(onRead,reset);
 paper.oninput=()=>{figures.clear();reset()};
 keysInput.oninput=()=>{generatedKeys=null;reset()};
 worked.addEventListener("input",()=>{if(paper.isConnected)reset()});
 check.onclick=async()=>{
  reset();
  const id=version, source=paper.value;
  const status=document.createElement("p");
  status.setAttribute("role","status");preview.append(status);
  try{
   const supplied=keysInput.value.trim();
   const solutionSource=worked.value;
   const answers=sheetKeys(supplied || keysFromSolutions(source,solutionSource));
   if(answers.length!==splitPaper(source).length)throw Error("Số đáp án và số câu trong đề chưa khớp.");
   if(!supplied){generatedKeys=answers.join("\n");keysInput.value=generatedKeys}
   status.textContent="Đã đọc "+answers.length+" đáp án. Đang kiểm tra nội dung và dựng hình…";
   const {template,art}=await api("templateAdmin");
   const renderFigure=async body=>{
    if(id!==version||!paper.isConnected)throw Error("Nội dung đã thay đổi.");
    const key=JSON.stringify(body);
    if(!figures.has(key)){
     const result=await api("tikz",body);
     if(id===version)figures.set(key,result);
     return result;
    }
    return figures.get(key);
   };
   const data=await pairedPaper(source,answers.join("\n"),template,renderFigure);
   const solutions=parseSolutions(solutionSource,answers.length);
   if(solutions){
    const libraries=tikzLibrariesFrom(solutionSource,source,template.style?.source||"");
    data.solutions=[];
    for(const [index,solution] of solutions.entries()){
     const figure=await compileFigures(solution,libraries,renderFigure,"Lời giải câu "+(index+1));
     data.solutions.push(figure.text);
    }
   }
   if(id!==version||!paper.isConnected)return;
   worked.compiledSolutions=data.solutions;
   preview.innerHTML="<p>Đã kiểm tra "+answers.length+" câu.</p>"+data.keys.map((k,i)=>'<details class="keyChip"><summary>Câu '+(i+1)+' · '+h(k)+'</summary>'+pairedPrompt(data.prompts[i],art)+'</details>').join("");
   onRead(data);
  }catch(e){
   if(id===version&&paper.isConnected)status.textContent=e.message+(generatedKeys?" Các đáp án đã đọc đang hiện trong ô TeX đáp án.":"");
  }
 };
}
