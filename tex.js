const exampleTex = [
 "Câu 1. Một vật đi được $s=12\\,\\mathrm{m}$ trong $t=3\\,\\mathrm{s}$. Tốc độ trung bình bằng bao nhiêu?",
 "A. $2\\,\\mathrm{m/s}$","B. $4\\,\\mathrm{m/s}$","C. $6\\,\\mathrm{m/s}$","D. $9\\,\\mathrm{m/s}$","% Đáp án đúng: B"
].join("\n");
function latexArgs(str,n){
 const args=[];let pos=0;
 while(args.length<n){
 while(/\s/.test(str[pos]||"!"))pos++;
 if(str[pos]!=="{")throw Error("Thiếu nhóm {...} trong lệnh TeX.");
 const start=++pos;let depth=1;
 while(pos<str.length&&depth){const c=str[pos++];if(c==="\\"){pos++;continue}if(c==="{")depth++;if(c==="}")depth--}
 if(depth)throw Error("Thiếu dấu } trong mã TeX.");args.push(str.slice(start,pos-1))
 }return args;
}
function parseQuizTex(source){
 let text=source.replace(/\r/g,"").trim();
 if(/\\(?:begin\{(?:tikzpicture|cautlngan|bangdungsai|figure|tabular)\}|includegraphics|input\b|choiceTF|shortans)|\\noindent\s*\\textbf\{Sử dụng/i.test(text))throw Error("Đề có hình, dữ kiện chung hoặc nhiều dạng câu. Hãy dùng ‘PDF Drive + phiếu trả lời’ để giữ nguyên đề.");
 const blocks=[...text.matchAll(/\\begin\{(ex|cauhoi)\}(?:\[\d+\])?([\s\S]*?)\\end\{\1\}/g)];
 const chunks=blocks.length?blocks.map((m,i)=>m[2]+"\n"+(text.slice(m.index+m[0].length,blocks[i+1]?.index??text.length).match(/^\s*(%?\s*Đáp án(?: đúng)?\s*[:：][^\n]+)/i)?.[1]||"")):text.split(/(?=^\s*Câu\s+\d+\s*[.:)])/gmi).filter(s=>s.trim());
 if(!chunks.length||chunks.length>100)throw Error("Cần từ 1 đến 100 câu.");
 return chunks.map((chunk,i)=>{
 try{
 const markers=[...chunk.matchAll(/(?:^|\n)\s*%?\s*Đáp án(?: đúng)?\s*[:：]\s*([A-D])\s*\.?\s*(?=\n|$)/gi)].map(m=>m[1].toUpperCase());
 const body=chunk.replace(/^\s*%?\s*Đáp án(?: đúng)?\s*[:：].*$/gmi,"").replace(/(?<!\\)%[^\n]*/g,"").trim();
 let stem,choices;
 if(/\\choice\b/.test(body)){
 const split=body.split(/\\choice\b/);stem=split[0];choices=latexArgs(split[1],4);
 }else if(/\\begin\{phuongan\}/.test(body)){
 stem=latexArgs(body.split(/\\noidung\s*/)[1]||"",1)[0];
 choices=body.split(/\\begin\{phuongan\}(?:\[\d+\])?/)[1].split("\\end{phuongan}")[0].split(/\\task\b/).slice(1);
 }else{
 const parts=body.split(/^\s*([A-D])[.)]\s*/gm);
 if(parts.length!==9||[1,3,5,7].map(j=>parts[j]).join("")!=="ABCD")throw Error("Cần bốn dòng A. B. C. D.");
 stem=parts[0].replace(/^Câu\s+\d+\s*[.:)]\s*/i,"");choices=[2,4,6,8].map(j=>parts[j])
 }
 if(choices.length!==4)throw Error("Cần bốn phương án.");
 choices=choices.map((v,j)=>{if(/\\True\b/.test(v))markers.push("ABCD"[j]);return v.replace(/\\True\b/g,"").trim()});
 const unique=[...new Set(markers)];if(unique.length!==1)throw Error(unique.length?"Đáp án mâu thuẫn.":"Thiếu dòng Đáp án đúng: A/B/C/D hoặc dấu \\True.");
 if(!stem.trim()||choices.some(v=>!v))throw Error("Thiếu nội dung câu hoặc phương án.");
 return {text:stem.trim(),options:choices,key:"ABCD".indexOf(unique[0])}
 }catch(e){throw Error("Câu "+(i+1)+": "+e.message)}
 })
}
function sheetKeys(text){
 const rows=[];
 if(text.includes("\\begin{tabular}")){
 for(const m of text.matchAll(/Câu\s+(\d+)\.\s*([A-D]|[-+]?\d+(?:[.,]\d+)?)\s*(?=&|\\\\)|\\textbf\{(\d+)\}\s*&\s*([ĐS])\s*&\s*([ĐS])\s*&\s*([ĐS])\s*&\s*([ĐS])/g))rows.push(m[2]||m.slice(4,8).join(""));
  if(/PHẦN\s+III\b/i.test(text)&&/PHẦN\s+II\b/i.test(text)&&/PHẦN\s+I\b/i.test(text)){
 const expected=[...text.matchAll(/Câu\s+\d+\.|\\textbf\{\d+\}\s*&/g)].length;
 if(rows.length!==expected)throw Error("Một số ô đáp án trong bảng TeX không đọc được. Hãy kiểm tra bảng gốc.");
 }
 }else for(const raw of text.trim().split(/\n/)){
 const v=raw.trim().replace(/^(?:Câu\s*)?\d+\s*[.):]\s+/i,"").replace(/^(?:%\s*)?Đáp án(?: đúng)?\s*[:：]\s*/i,"").trim().toUpperCase();if(v)rows.push(v)
 }
 if(!rows.length||rows.length>100||rows.some(v=>!/^([A-D]|[ĐS]{4}|[-+]?\d+(?:[.,]\d+)?)$/.test(v)))throw Error("Nhập mỗi đáp án trên một dòng: B, SĐĐS hoặc 6,6; hoặc chọn bảng đáp án TeX của Thầy An.");
 return rows;
}
function mathText(value){
 return String(value).split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\])/g).map((v,i)=>{
 if(i%2===0)return h(v).replace(/\n/g,"<br>");
 const display=v.startsWith("$$")||v.startsWith("\\[");const d=v[0]==="$"&&!display?1:2;
 try{return katex.renderToString(v.slice(d,-d),{output:"mathml",displayMode:display,trust:false,throwOnError:true})}catch{return h(v)}
 }).join("")
}
if(typeof module!=="undefined")module.exports={parseQuizTex,sheetKeys,exampleTex};

