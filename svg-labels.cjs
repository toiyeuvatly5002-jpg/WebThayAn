// TikZJax writes DVI character codes in its bundled BaKoMa fonts. An SVG
// loaded via <img> cannot fetch an external stylesheet with these fonts.
const {JSDOM}=require("jsdom");
const {loadSync}=require("opentype.js");
const path=require("node:path");
const fs=require("node:fs");
const fontFolder=path.resolve(path.dirname(require.resolve("node-tikzjax")),"../css/bakoma/ttf");
const fonts=new Map();

function outlineLabels(svg){
 if(!svg.includes("<text"))return svg;
 const dom=new JSDOM(svg,{contentType:"image/svg+xml"});
 try{
  const doc=dom.window.document;
  for(const label of doc.querySelectorAll("text")){
   if(label.children.length)continue;
   const family=label.closest("[font-family]")?.getAttribute("font-family");
   const size=Number(label.closest("[font-size]")?.getAttribute("font-size"));
   if(!family||!/^[a-z]+[0-9]+$/i.test(family)||!size)continue;
   const file=path.join(fontFolder,family+".ttf");
   if(!fs.existsSync(file))continue;
   if(!fonts.has(family))fonts.set(family,loadSync(file));
   const x=Number(label.getAttribute("x")),y=Number(label.getAttribute("y"));
   if(!Number.isFinite(x)||!Number.isFinite(y))continue;
   const shape=doc.createElementNS(label.namespaceURI,"path");
   const outline=fonts.get(family).getPath(label.textContent,x,y,size,{kerning:false,features:{liga:false,rlig:false}});
   for(const attr of label.attributes){
    if(!["x","y","font-size","font-family"].includes(attr.name))shape.setAttribute(attr.name,attr.value);
   }
   shape.setAttribute("d",outline.toPathData(3));
   label.replaceWith(shape);
  }
  return doc.documentElement.outerHTML;
 }finally{dom.window.close()}
}
module.exports={outlineLabels};
