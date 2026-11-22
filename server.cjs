const http=require("node:http"), fs=require("node:fs"), path=require("node:path");
const {grade}=require("./grade.cjs");
const root=path.join(__dirname,"public");
http.createServer(async(req,res)=>{
 try{
  if(req.url==="/.netlify/functions/school"){
   let body="";for await(const chunk of req){body+=chunk;if(body.length>4500000)throw Error()}
   const result=await require("./api.cjs").handle({httpMethod:req.method,headers:req.headers,body},true);
   res.writeHead(result.statusCode,result.headers);return res.end(result.body);
  }  const url=new URL(req.url,"http://localhost");
  const file=path.resolve(root,"."+decodeURIComponent(url.pathname==="/"?"/index.html":url.pathname));
  if(!file.startsWith(root+path.sep)||!fs.statSync(file).isFile())throw Error();
  const types={".js":"text/javascript",".css":"text/css",".html":"text/html; charset=utf-8",".png":"image/png",".otf":"font/otf",".pdf":"application/pdf"};
  res.setHeader("Content-Type",types[path.extname(file)]||"application/octet-stream");fs.createReadStream(file).pipe(res)
 }catch{res.writeHead(404);res.end()}
}).listen(4209,"127.0.0.1",()=>console.log("http://127.0.0.1:4209"));


