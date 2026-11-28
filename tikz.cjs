// Outlines for Vietnamese letters missing in the embedded TeX font repertoire.
// Extracted from the four Latin Modern Roman 10 faces in public/assets (GUST Font License).
const glyphs=require("./vietnamese-glyphs.json");

function glyphDrawing([width,commands]){
 const em=n=>(n/1000)+"em";
 const point=(x,y)=>"\\pgfpoint{"+em(x)+"}{"+em(y)+"}";
 const paths=commands.map(([kind,...v])=>{
  if(kind==="Z")return "\\pgfpathclose";
  if(kind==="C")return "\\pgfpathcurveto{"+point(v[0],v[1])+"}{"+point(v[2],v[3])+"}{"+point(v[4],v[5])+"}";
  return (kind==="M"?"\\pgfpathmoveto":"\\pgfpathlineto")+"{"+point(v[0],v[1])+"}";
 }).join("%\n");
 return "\\leavevmode\\hbox to "+em(width)+"{\\begin{pgfpicture}\\pgfsetbaseline{0pt}\\pgfpathmoveto{\\pgfpointorigin}\\pgfpathlineto{"+point(width,0)+"}\\pgfusepath{use as bounding box}"+paths+"\\pgfusepath{fill}\\end{pgfpicture}\\hss}";
}
function glyphPreamble(used){
 if(!used.size)return "";
 const definitions=[String.raw`\makeatletter
\def\vnlabelglyph#1{\begingroup%
\def\vnface{regular}\def\vnb{b}\def\vnbx{bx}%
\ifx\f@series\vnb\def\vnface{bold}\fi%
\ifx\f@series\vnbx\def\vnface{bold}\fi%
\ifdim\fontdimen1\font>0pt \def\vnr{regular}\ifx\vnface\vnr\def\vnface{italic}\else\def\vnface{bolditalic}\fi\fi%
\csname vnglyph#1\vnface\endcsname\endgroup}`];
 for(const letter of used){
  for(const [face,shape] of Object.entries(glyphs[letter])){
   definitions.push("\\expandafter\\def\\csname vnglyph"+letter.codePointAt(0)+face+"\\endcsname{"+glyphDrawing(shape)+"}");
  }
 }
 return definitions.join("\n")+"\n\\makeatother";
}
function encodeTextAccents(picture, used) {
 const accents = new Map([
  ["\u0300", "\\`"], ["\u0301", "\\'"], ["\u0302", "\\^"],
  ["\u0303", "\\~"], ["\u0306", "\\u"], ["\u0323", "\\d"]
 ]);
 return picture.normalize("NFC").replace(/[\u00C0-\u024F\u1EA0-\u1EF9]/g, letter => {
  if(Object.hasOwn(glyphs,letter)){
   used.add(letter);
   return "{\\vnlabelglyph{"+letter.codePointAt(0)+"}}";
  }
  const [base, ...marks] = letter.normalize("NFD");
  if (!marks.length || !marks.every(mark => accents.has(mark))) return letter;
  const glyph = base === "i" && marks.some(mark => mark !== "\u0323") ? "\\i" : base;
  return "{"+marks.reduce((text, mark) => accents.get(mark)+"{"+text+"}", glyph)+"}";
 });
}
let queue=Promise.resolve();
async function render(source,libraries){
 if(typeof source!=="string"||source.length>50000||!source.trim().startsWith("\\begin{tikzpicture}")||!source.trim().endsWith("\\end{tikzpicture}")||typeof libraries!=="string"||libraries.length>500||!/^[\w., -]*$/.test(libraries))throw Object.assign(Error("Khối TikZ hoặc danh sách thư viện không hợp lệ."),{status:400});
 const job=queue.then(async()=>{
  const mod=require("node-tikzjax"),compile=mod.default||mod;
  let svg;
  const used=new Set();
  const picture=encodeTextAccents(source,used);
  const options={addToPreamble:glyphPreamble(used),tikzLibraries:libraries,texPackages:{amsmath:""},showConsole:false};
  const documentFor=picture=>"\\begin{document}\n"+picture+"\n\\end{document}";
  try {
   svg=await compile(documentFor(picture),options);
  } catch (error) {
   console.error("TikZ figure:",String(error?.message||error).slice(0,800));
   try {
    await compile(documentFor("\\begin{tikzpicture}\\draw (0,0) circle (1cm);\\end{tikzpicture}"),{showConsole:false});
   } catch (probeError) {
    console.error("TikZ runtime:",String(probeError?.message||probeError).slice(0,800));
    throw Object.assign(Error("Máy chủ cũng không dựng được hình tròn kiểm tra. Xem nhật ký Function school, dòng TikZ runtime."),{status:422});
   }
   throw Object.assign(Error("Máy chủ dựng được hình tròn kiểm tra nhưng lỗi ở hình của đề. Xem nhật ký Function school, dòng TikZ figure."),{status:422});
  }
  if(!/<svg\b/.test(svg)||!/<(?:path|circle|rect|line|text|use|polygon|ellipse|polyline)\b/.test(svg))throw Object.assign(Error("Trình biên dịch trả về hình trống."),{status:422});
  const data=Buffer.from(require("./svg-labels.cjs").outlineLabels(svg)).toString("base64");
  if(data.length>180000)throw Object.assign(Error("Hình vượt dung lượng cho phép. Hãy đơn giản hóa hình."),{status:413});
  return {data};
 });
 queue=job.catch(()=>{});return job;
}
module.exports={render};
