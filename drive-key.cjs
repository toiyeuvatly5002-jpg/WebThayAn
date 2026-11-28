const {driveFile}=require("./public/drive-file.js");
const fail=message=>Object.assign(Error(message),{status:422});
async function readKey(url,request=fetch){
 const {id,resource}=driveFile(url);
 const download=new URL("https://drive.usercontent.google.com/download");
 download.search=new URLSearchParams({id,export:"download",confirm:"t",...(resource?{resourcekey:resource}:{})});
 let response,target=download;
 const signal=AbortSignal.timeout(15000);
 try {
  for(let hop=0;hop<5;hop++){
   response=await request(target,{signal,redirect:"manual"});
   if(![301,302,303,307,308].includes(response.status))break;
   const next=new URL(response.headers.get("location"),target);
   await response.body?.cancel();
   if(next.protocol!=="https:"||next.port||next.username||next.password||!(["drive.google.com","drive.usercontent.google.com"].includes(next.hostname)||next.hostname.endsWith(".googleusercontent.com")))throw Error();
   target=next;
  }
 }
 catch {throw fail("Drive chưa trả tệp đáp án. Kiểm tra quyền xem, tải xuống và thử lại.")}
 if(!response.ok || (response.headers.get("content-type")||"").includes("text/html"))throw fail("Drive chưa cho tải tệp đáp án. Chọn Bất kỳ ai có đường liên kết và cho phép tải xuống.");
 let size=0;const chunks=[];
 for await(const chunk of response.body){size+=chunk.length;if(size>3_000_000)throw fail("Tệp đáp án vượt 3 MB.");chunks.push(chunk)}
 const bytes=Buffer.concat(chunks);
 if(bytes.subarray(0,5).toString()==="%PDF-")return {pdf:bytes.toString("base64")};
 const text=bytes.toString("utf8").trim();
 if(!text||text.includes("\0")||text.includes("\ufffd")||text.startsWith("<"))throw fail("Chọn PDF có văn bản hoặc TXT/CSV UTF-8.");
 return {text};
}
module.exports={readKey};
