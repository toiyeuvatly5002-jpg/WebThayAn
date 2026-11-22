
const main=document.querySelector("#main");
const labels=["Chọn một đáp án","Đúng / Sai","Trả lời ngắn"];
const section=i=>i<18?0:i<22?1:2;
const number=i=>i-[0,18,22][section(i)]+1;
let attempt=null,records=[];let view="",pending=false;
let originalId="de09";function originalDraftKey(){return "v2.original."+me.code+"."+originalId} function save(){localStorage.setItem(originalDraftKey(),JSON.stringify(attempt))}
function button(label,action,cls=""){return '<button class="'+cls+'" onclick="'+action+'">'+label+'</button>'}
function wave(){
 const c=document.querySelector("canvas"), ctx=c.getContext("2d");c.width=700;c.height=430;
 for(let k=0;k<46;k++){ctx.beginPath();ctx.strokeStyle="hsla("+ (195+k/2)+",65%,72%,.75)";
 for(let x=0;x<700;x+=3){const y=75+k*6+Math.sin(x/83+k/13)*62+Math.cos(x/58-k/17)*40; if(x===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)}ctx.stroke()}
}
function begin(timed){
 if(!attempt){attempt={attemptId:crypto.randomUUID(),i:0,answers:Array(28).fill(""),flags:{},deadline:timed?Date.now()+3000000:null};save()}
 exam()
}
function startExam(){begin(true)}
function startPractice(){if(attempt&&attempt.deadline&&!confirm("Tiếp tục bài thi đang làm?"))return;begin(false)}
function answer(v){if(pending||expired())return;attempt.answers[attempt.i]=v;save();exam()}
function typed(input){if(!expired()){attempt.answers[attempt.i]=input.value;save();navGrid()}}
function tf(j,v){const arr=(attempt.answers[attempt.i]||"----").split("");arr[j]=v;answer(arr.join(""))}
function jump(i){attempt.i=i;save();exam();window.scrollTo(0,0)}
function toggleFlag(){attempt.flags[attempt.i]=!attempt.flags[attempt.i];save();exam()}
function expired(){return attempt&&attempt.deadline&&Date.now()>=attempt.deadline}
function navGrid(){const g=document.querySelector("#grid");if(!g)return;g.innerHTML=questions.map((_,i)=>button(i+1,"jump("+i+")",[(attempt.i===i?"current":""),(attempt.answers[i]&&!attempt.answers[i].includes("-")?"answered":""),(attempt.flags[i]?"flag":"")].join(" "))).join("")}
function exam(){
 view="exam";const i=attempt.i,s=section(i),v=attempt.answers[i];let opts="";
 if(s===0)opts=[..."ABCD"].map(c=>button(c,"answer('"+c+"')",v===c?"chosen":"")).join(" ");
 if(s===1)opts=[..."abcd"].map((c,j)=>'<p>'+c+'. &nbsp;'+["Đ","S"].map(t=>button(t==="Đ"?"Đúng":"Sai","tf("+j+",'"+t+"')",v[j]===t?"chosen":"")).join(" ")+'</p>').join("");
 if(s===2)opts='<label>Đáp số <input id="numeric" inputmode="decimal" maxlength="24" oninput="typed(this)"></label>';
 main.innerHTML='<div class="row"><h2>Vật lý · Đề 09</h2><strong id="clock"></strong></div><div class="layout"><article class="box"><div class="row"><strong>Phần '+["I","II","III"][s]+' · Câu '+number(i)+'</strong>'+button(attempt.flags[i]?"Đã đánh dấu":"Đánh dấu","toggleFlag()")+'</div><p>'+labels[s]+'</p>'+questions[i].map((src,k)=>'<img class="paper" tabindex="0" role="button" onclick="showImage('+k+')" onkeydown="if(event.key===\'Enter\')this.click()" alt="Nội dung câu '+number(i)+', chạm để phóng to" src="'+src+'">').join("")+'<div class="opts">'+opts+'</div><div class="actions">'+(i?button("Câu trước","jump("+(i-1)+")"):"")+(i<27?button("Câu tiếp","jump("+(i+1)+")","primary"):button("Nộp bài","submitExam(false)","primary"))+'</div></article><aside class="box"><h3>Phiếu làm bài</h3><div class="grid" id="grid"></div><p class="muted">Xanh · Đã trả lời<br>Gạch cam · Đã đánh dấu</p>'+button("Nộp bài","submitExam(false)")+'<p id="status" role="status"></p></aside></div>';
 if(s===2)document.querySelector("#numeric").value=v;navGrid();clockTick()
}
function showImage(k){large.innerHTML='<img src="'+questions[attempt.i][k]+'" alt="Nội dung phóng to">';zoom.showModal()}
function clockTick(){if(view!=="exam"||!attempt)return;const el=document.querySelector("#clock");if(!attempt.deadline){el.textContent="Luyện tập tự do";return}const t=Math.max(0,Math.ceil((attempt.deadline-Date.now())/1000));el.textContent=Math.floor(t/60)+":"+String(t%60).padStart(2,"0");if(!t&&!pending&&Date.now()>retryAt)submitExam(true)}
let retryAt=0;
async function submitExam(auto){
 if(!attempt||pending||(!auto&&!confirm("Nộp bài và xem kết quả?")))return;
 pending=true;
 try{const result=await api("submit",{id:originalId,attemptId:attempt.attemptId,answers:attempt.answers});records=[result];attempt=null;save();resultView(0);bindReviews() }catch{retryAt=Date.now()+15000;const status=document.querySelector("#status");if(status)status.textContent="Chưa chấm được. Bài đã lưu trên máy, hãy thử lại."}finally{pending=false}
}
function escapeText(s){const span=document.createElement("span");span.textContent=s;return span.innerHTML}
function resultView(j){view="result";const r=records[j];main.innerHTML='<section class="hero"><small>KẾT QUẢ · VẬT LÝ 09</small><h1>'+r.total+' / 10</h1>'+reviewButton(r.attempt)+'</section><h2>Đối chiếu bài làm</h2>'+r.keys.map((k,i)=>'<details class="box"><summary>Phần '+["I","II","III"][section(i)]+' · Câu '+number(i)+' · '+r.points[i]+' điểm</summary>'+questions[i].map(src=>'<img class="paper" src="'+src+'">').join("")+'Bạn chọn <b>'+escapeText(r.answers[i]||"Bỏ trống")+'</b> · Đáp án <b>'+k+'</b></details>').join("")}
setInterval(clockTick,1000);






