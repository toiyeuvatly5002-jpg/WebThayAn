const {render}=require("../tikz.cjs");
(async()=>{
 const source=String.raw`\begin{tikzpicture}\draw (0,0) circle (1cm);\end{tikzpicture}`;
 const result=await render(source,"");
 if(!Buffer.from(result.data,"base64").toString().includes("<svg"))throw Error("TikZ SVG missing");
 console.log("Verified live TikZ compiler");
})().catch(err=>{console.error(err.message);process.exitCode=1});
