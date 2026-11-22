let queue=Promise.resolve();
async function render(source,libraries){
 if(typeof source!=="string"||source.length>50000||!source.trim().startsWith("\\begin{tikzpicture}")||!source.trim().endsWith("\\end{tikzpicture}")||typeof libraries!=="string"||libraries.length>500||!/^[\w., -]*$/.test(libraries))throw Object.assign(Error("Khối TikZ hoặc danh sách thư viện không hợp lệ."),{status:400});
 const job=queue.then(async()=>{
  const mod=require("node-tikzjax"),compile=mod.default||mod;
  let svg;
  try{svg=await compile("\\begin{document}\n"+source+"\n\\end{document}",{tikzLibraries:libraries,texPackages:{amsmath:""},showConsole:false})}catch{throw Object.assign(Error("Trình biên dịch không dựng được hình. Kiểm tra lệnh, macro và thư viện TikZ của hình."),{status:422})}
  if(!/<svg\b/.test(svg)||!/<(?:path|circle|rect|line|text|use|polygon|ellipse|polyline)\b/.test(svg))throw Object.assign(Error("Trình biên dịch trả về hình trống."),{status:422});
  const data=Buffer.from(svg).toString("base64");
  if(data.length>180000)throw Object.assign(Error("Hình vượt dung lượng cho phép. Hãy đơn giản hóa hình."),{status:413});
  return {data};
 });
 queue=job.catch(()=>{});return job;
}
module.exports={render};
