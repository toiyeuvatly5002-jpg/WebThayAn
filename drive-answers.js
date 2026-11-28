function parseDriveAnswers(text, fromPdf=false) {
 const rows=[];
 let next=1;
 const token="(?:TL|TỰ LUẬN|[ĐS](?:\\s*[ĐS]){3}|[A-D]|[-+]?\\d+(?:[.,]\\d+)?)";
 const numbered=new RegExp("(?:Câu\\s*)?(\\d+)\\s*[.):;,]\\s*("+token+")(?=\\s|$)","giu");
 const csv=/^(?:Câu|STT)\s*[,;]\s*Đáp án$/imu.test(text);
 function add(raw,num){
  if(num!==undefined && Number(num)!==next)throw Error("Kiểm tra thứ tự đáp án ở câu "+next+".");
  rows.push(raw.toUpperCase().replace(/TỰ LUẬN/g,"TL").replace(/\s/g,""));next++;
 }
 for (const raw of text.normalize("NFC").split(/\r?\n/)) {
  const line=raw.trim();
  if(!line)continue;
  if(/^PHẦN\s+(?:[IVX]+|\d+)\b/i.test(line)){next=1;continue}
  if(/^(?:Câu|STT)\s*[,;]\s*Đáp án$|^Đáp án\s*:?$/iu.test(line))continue;
  const tf=line.match(/^(\d+)\s+([ĐS]\s*[ĐS]\s*[ĐS]\s*[ĐS])$/i);
  if(tf){add(tf[2],tf[1]);continue}
  if(!csv&&new RegExp("^"+token+"$","iu").test(line)){add(line);continue}
  const matches=[...line.matchAll(numbered)];
  if(matches.length && !line.replace(numbered,"").trim()){for(const m of matches)add(m[2],m[1]);continue}
  if(new RegExp("^"+token+"$","iu").test(line)){add(line);continue}
  if(/^(?:[A-D]\s+)+[A-D]$/i.test(line)){for(const k of line.split(/\s+/))add(k);continue}
  if(!fromPdf||/^(?:Câu\s*\d|\d+[.):;,]|\d+\s+[A-DĐST])|(?:\bCâu\s+\d+)/i.test(line))throw Error("Chưa đọc được dòng đáp án: "+line.slice(0,90));
 }
 if(!rows.length)throw Error("Chưa tìm thấy đáp án. Dùng PDF có lớp chữ hoặc TXT với mỗi đáp án một dòng.");
 return rows;
}
async function readDrivePdf(bytes,lib,worker){
 lib.GlobalWorkerOptions.workerSrc=worker;
 const doc=await lib.getDocument({data:bytes,isEvalSupported:false,useSystemFonts:true}).promise;
 const lines=[];
 try{
  for(let n=1;n<=doc.numPages;n++){
   const page=await doc.getPage(n), content=await page.getTextContent(), rows=[];
   for(const item of content.items.filter(x=>x.str?.trim()).sort((a,b)=>b.transform[5]-a.transform[5])){
    const y=item.transform[5];
    let row=rows.at(-1);
    if(!row||Math.abs(row.y-y)>2){row={y,cells:[]};rows.push(row)}
    row.cells.push(item);
   }
   for(const row of rows){
    const line=row.cells.sort((a,b)=>a.transform[4]-b.transform[4]).map(c=>c.str).join(" ").trim();
    if(/^\d+$/.test(line)&&row.y<page.view[1]+(page.view[3]-page.view[1])*.09)continue;
    lines.push(line);
   }
  }
  return parseDriveAnswers(lines.join("\n"),true);
 }finally{await doc.destroy()}
}
if(typeof module!=="undefined")module.exports={parseDriveAnswers,readDrivePdf};
