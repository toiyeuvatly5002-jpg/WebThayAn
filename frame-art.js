// The web equivalents of the two illustrated frames in the teacher's package.
const templateImages={conan:"assets/conan.png",agasa:"assets/agasa.png"};
const defaultStyle={name:"PackageForDayThemVatLy12.sty",conan:true,agasa:true};
function readFrameStyle(source,name){
 const sty=source.replace(/(?<!\\)%[^\n]*/g,"");
 const question=sty.split(/\\(?:re)?newcommand\s*\{\\khungcauhoi\}/)[1]?.split(/\\(?:re)?new(?:command|environment)\b/)[0]||"";
 const conan=/\\includegraphics(?:\[[^\]]*\])?\{(?:[^{}]*\/)?conan(?:\.png)?\}/i.test(question);
 const agasa=/\\(?:re)?newcommand\s*\{\\khungtlngan\}\s*\[5\]\s*\[(?:[^\]]*\/)?agasa(?:\.png)?\]/i.test(sty);
 if(!sty.trim())throw Error("Tệp .sty trống.");
 return {name,conan,agasa};
}
function markTemplateImages(source){
 return source.replace(/\\includegraphics\*?(?:\s*\[[^\]]*\])?\s*\{\s*(?:[^{}\n]*\/)?(conan|agasa)(?:\.png)?\s*\}/gi,(_,name)=>"[["+name.toLowerCase()+"]]");
}
function illustrated(frame,art,explicit=false){
 if(!art||art[frame+"Hidden"]||(!explicit&&!art[frame]))return "";
 const src=art[frame+"Image"]||templateImages[frame];
 return '<img class="frame-icon" src="'+h(src)+'" alt="'+(frame==="conan"?"Conan":"Agasa")+'">';
}
function inlineArt(text,art){return text.replace(/\[\[(conan|agasa)\]\]/g,(_,name)=>illustrated(name,art,true))}
async function smallImage(file){
 if(file.size>8e6)throw Error("Chọn ảnh PNG dưới 8 MB.");
 const signature=new Uint8Array(await file.slice(0,8).arrayBuffer());
 if(signature.join(",")!=="137,80,78,71,13,10,26,10")throw Error("Tệp ảnh cần ở định dạng PNG.");
 const url=URL.createObjectURL(file);
 try{
 const img=new Image(); img.src=url;await img.decode();
 const ratio=Math.min(1,128/Math.max(img.naturalWidth,img.naturalHeight));
 const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(img.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(img.naturalHeight*ratio));canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);
 return canvas.toDataURL("image/png");
 }finally{URL.revokeObjectURL(url)}
}


