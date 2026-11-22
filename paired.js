function splitPaper(source){
 const body=source.replace(/\r/g,"").replace(/(?<!\\)%[^\n]*/g,"");
 const blocks=[...body.matchAll(/\\begin\{(cauhoi|cautlngan|ex)\}(?:\[\d+\])?([\s\S]*?)\\end\{\1\}/g)];
 if(blocks.length)return blocks.map((m,i)=>({src:m[2],type:m[1],gap:body.slice(i?blocks[i-1].index+blocks[i-1][0].length:0,m.index)}));
 return body.trim().split(/(?=^Câu\s+\d+\s*[.:)])/gmi).filter(s=>s.trim()).map(src=>({src,type:"plain",gap:""}))
}
async function pairedPaper(source,answerText){
 const keys=sheetKeys(answerText),blocks=splitPaper(markTemplateImages(source));
 if(keys.length!==blocks.length)throw Error("Đề có "+blocks.length+" câu, bảng có "+keys.length+" đáp án.");
 const prompts=[];let context="",remaining=0;
 for(const [i,{src:raw,type,gap}] of blocks.entries()){
 const common=gap.match(/\\noindent\s*\\textbf\{Sử dụng[^}\n]*?câu\s+(\d+)\s+và\s+câu\s+(\d+)[^}]*\}([^\n]+)/i);
 if(common){context=common[3].replace(/\\\\\[[^\]]*\]/g,"").trim();remaining=Number(common[2])-Number(common[1])+1}
 const prefix=remaining>0?(remaining--,context+"\n\n"):"";
 let text,format;
 const libraries=[...source.matchAll(/\\usetikzlibrary\s*\{([\w., -]+)\}/g)].map(m=>m[1]).join(",");
 let src=raw;const tokens=[];
 for(const match of raw.matchAll(/\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}/g)){
 try{const {data}=await api("tikz",{source:match[0],libraries});
 const token="[[diagram:"+data+"]]";tokens.push(token);src=src.replace(match[0],()=>token)
 }catch(e){throw Error("Câu "+(i+1)+", hình "+(tokens.length+1)+": "+e.message)}
 }
 src=src.replace(/\\begin\{figure\}(?:\[[^\]]*\])?|\\end\{figure\}|\\centering\b/g,"");
 if(type==="cautlngan"||/\\phatbieuDS\b/.test(src)){
 text=prefix+latexArgs(src.split(/\\noidung\s*/)[1]||"",1)[0];format=type==="cautlngan"?"num":"tf";
 if(format==="tf"){const bits=[...src.matchAll(/\\phatbieuDS\s*/g)].map(m=>latexArgs(src.slice(m.index+m[0].length),3));if(bits.length!==4)throw Error("Câu "+(i+1)+" cần 4 phát biểu.");text+="\n"+bits.map(([label,v])=>label+") "+v).join("\n")}
 }else{
 const wrapped=type==="plain"?src:"\\begin{"+type+"}"+src+"\\end{"+type+"}";
 const [q]=parseQuizTex(wrapped+"\nĐáp án đúng: "+keys[i]);
 text=prefix+q.text+"\n"+q.options.map((v,j)=>"ABCD"[j]+". "+v).join("\n");format="mc";
 }
 const expected=/^[A-D]$/.test(keys[i])?"mc":/^[ĐS]{4}$/.test(keys[i])?"tf":"num";
 if(expected!==format)throw Error("Sai dạng đáp án ở câu "+(i+1)+".");
 for(const t of tokens)if(!text.includes(t))text+="\n"+t;
 prompts.push(text);
 }
 return {keys,prompts};
}
function pairedPrompt(text,art){
 return inlineArt(mathText(text),art).replace(/\[\[diagram:([A-Za-z0-9+/=]+)\]\]/g,(_,data)=>'<img style="max-width:100%;height:auto" alt="Hình TikZ" src="data:image/svg+xml;base64,'+data+'">').replace(/\[\[paper-image:(\d+)\]\]/g,"Hình cũ cần được giáo viên nhập lại từ TeX.");
}
function pairedEditor(onRead){
 content.innerHTML='<section class="importer">'+field("TeX đề",'<textarea id="pairPaper" rows="8" placeholder="Dán nội dung đề tại đây"></textarea>')+field("TeX đáp án",'<textarea id="pairKeys" rows="5" placeholder="Dán bảng DapAn…tex hoặc mỗi đáp án một dòng"></textarea>')+'<button type="button" id="pairCheck">Đọc và kiểm tra</button><div id="pairPreview" role="status"></div></section>';
 let version=0;
 function reset(){version++;onRead(null);pairPreview.textContent="";}
 pairPaper.oninput=pairKeys.oninput=reset;
 pairCheck.onclick=async()=>{reset();const id=version;try{const data=await pairedPaper(pairPaper.value,pairKeys.value);if(id!==version)return;onRead(data);pairPreview.innerHTML=data.keys.map((k,i)=>'<details class="keyChip"><summary>Câu '+(i+1)+' · '+h(k)+'</summary>'+pairedPrompt(data.prompts[i],defaultStyle)+'</details>').join("")}catch(e){if(id===version)pairPreview.textContent=e.message}};
}


