const main=document.querySelector("#main");
let view="";
function button(label,action,cls=""){return '<button class="'+cls+'" onclick="'+action+'">'+label+'</button>'}
function wave(){
 const c=document.querySelector("canvas"), ctx=c.getContext("2d");c.width=700;c.height=430;
 for(let k=0;k<46;k++){ctx.beginPath();ctx.strokeStyle="hsla("+ (195+k/2)+",65%,72%,.75)";
 for(let x=0;x<700;x+=3){const y=75+k*6+Math.sin(x/83+k/13)*62+Math.cos(x/58-k/17)*40; if(x===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)}ctx.stroke()}
}
function escapeText(s){const span=document.createElement("span");span.textContent=s;return span.innerHTML}