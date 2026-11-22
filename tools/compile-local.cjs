const fs=require("node:fs");
const path=require("node:path");
const os=require("node:os");
const http=require("node:http");
const crypto=require("node:crypto");
const {execFile}=require("node:child_process");
const {promisify}=require("node:util");
const execute=promisify(execFile);
const assets=path.join(__dirname,"..","public","assets");

async function compilePair(paper,worked,template) {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"phonghoc-tex-"));
 try {
  fs.mkdirSync(path.join(dir,"HinhAnh"));
  for(const image of ["conan","agasa"]){
   if(template?.[image]?.removed)continue;
   const value=template?.[image];
   const bytes=typeof value==="string"?Buffer.from(value.split(",")[1],"base64"):fs.readFileSync(path.join(assets,image+".png"));
   fs.writeFileSync(path.join(dir,"HinhAnh",image+".png"),bytes);
   fs.writeFileSync(path.join(dir,image+".png"),bytes);
  }
  const style=template?.style;
  const name=style?.name||"PackageForDayThemVatLy12.sty";
  if(!/^[\w.-]+\.sty$/i.test(name))throw Error("Tên mẫu .sty không hợp lệ.");
  if(!style?.removed)fs.writeFileSync(path.join(dir,name),style?.source??fs.readFileSync(path.join(assets,name)));
  const pdfs=[];
  for(const [idx,tex] of [paper,worked].entries()){
   const stem=idx?"loigiai":"de";
   fs.writeFileSync(path.join(dir,stem+".tex"),tex);
   try{
    for(let pass=0;pass<2;pass++)await execute("pdflatex",["-no-shell-escape","-interaction=nonstopmode","-halt-on-error",stem+".tex"],{cwd:dir,timeout:120000,windowsHide:true,maxBuffer:3000000});
   }catch(e){const log=String(e.stdout||e.message);throw Error(stem+".tex — "+(log.match(/^!.*(?:\r?\n[^\n]*){0,4}/m)?.[0]||log.slice(-500)))}
   pdfs.push(fs.readFileSync(path.join(dir,stem+".pdf")).toString("base64"));
  }
  return pdfs;
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
}
if(require.main===module){
 const secret=crypto.randomBytes(32).toString("hex");
 const page='<!doctype html><meta charset=utf-8><title>Biên dịch đề</title><h1>Biên dịch trên máy giáo viên</h1><p>Chọn tệp nguồn vừa xuất từ trang tạo đề. Cần cài pdfLaTeX cùng các gói dùng trong mẫu.</p><input type=file accept=".json"><button>Biên dịch và tải đề</button><p id="status"></p><script>document.querySelector("button").onclick=async function(){this.disabled=true;const msg=document.querySelector("#status");try{const file=document.querySelector("input").files[0];if(!file)throw Error("Chọn tệp nguồn trước.");msg.textContent="Đang biên dịch đề và lời giải…";const r=await fetch("/compile",{method:"POST",headers:{"X-Local-Key":"'+secret+'"},body:await file.text()});if(!r.ok)throw Error(await r.text());const a=document.createElement("a");a.href=URL.createObjectURL(await r.blob());a.download="de-da-bien-dich.json";a.click();msg.textContent="Đưa tệp vừa tải vào trang tạo đề."}catch(e){msg.textContent=e.message}finally{this.disabled=false}}</script>';
 const site="https://webthayan.netlify.app";
 const server=http.createServer(async(req,res)=>{
  if(req.headers.host!=="127.0.0.1:"+server.address().port){res.writeHead(403);return res.end()}
  if(req.url==="/"&&req.method==="GET"){res.writeHead(200,{"Content-Type":"text/html;charset=utf-8","Cache-Control":"no-store"});return res.end(page.replace("<h1>",'<a href="'+site+'/#compiler='+server.address().port+'.'+secret+'">Mở web Thầy An để dán đề và biên dịch trực tiếp</a><h1>'))}
  if(req.headers.origin===site){
   res.setHeader("Access-Control-Allow-Origin",site);
   if(req.method==="OPTIONS"){res.writeHead(204,{"Access-Control-Allow-Methods":"POST","Access-Control-Allow-Headers":"Content-Type, X-Local-Key","Access-Control-Allow-Private-Network":"true"});return res.end()}
  }
  if(req.method!=="POST"||req.url!=="/compile"||req.headers["x-local-key"]!==secret){res.writeHead(403);return res.end()}
  try{const chunks=[];let size=0;for await(const part of req){size+=part.length;if(size>4500000)throw Error("Tệp quá lớn.");chunks.push(part)}
   const {paper,worked,template}=JSON.parse(Buffer.concat(chunks));const pdfs=await compilePair(paper,worked,template);res.setHeader("Content-Type","application/json");res.end(JSON.stringify({paper,worked,pdfs}));
  }catch(e){res.writeHead(400,{"Content-Type":"text/plain;charset=utf-8"});res.end(e.message)}
 }).listen(0,"127.0.0.1",()=>{const url="http://127.0.0.1:"+server.address().port;console.log(url);if(process.platform==="win32")execFile("rundll32",["url.dll,FileProtocolHandler",url])});
}
module.exports={compilePair};
