function encodeTextAccents(picture) {
 const accents = new Map([
  ["\u0300", "\\`"], ["\u0301", "\\'"], ["\u0302", "\\^"],
  ["\u0303", "\\~"], ["\u0306", "\\u"], ["\u0323", "\\d"]
 ]);
 return picture.normalize("NFC").replace(/[\u00C0-\u024F\u1EA0-\u1EF9]/g, letter => {
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
  const options={tikzLibraries:libraries,texPackages:{amsmath:""},showConsole:false};
  const documentFor=picture=>"\\begin{document}\n"+picture+"\n\\end{document}";
  try {
   svg=await compile(documentFor(encodeTextAccents(source)),options);
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
  const data=Buffer.from(svg).toString("base64");
  if(data.length>180000)throw Object.assign(Error("Hình vượt dung lượng cho phép. Hãy đơn giản hóa hình."),{status:413});
  return {data};
 });
 queue=job.catch(()=>{});return job;
}
module.exports={render};
