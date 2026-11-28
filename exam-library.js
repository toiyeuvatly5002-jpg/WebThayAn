const schoolLevels=[
 {name:"Tiểu học",grades:[1,2,3,4,5]},
 {name:"THCS",grades:[6,7,8,9]},
 {name:"THPT",grades:[10,11,12]}
];
const examFilters={level:"",grade:"",track:"",subject:"",category:"",search:""};
function levelOf(grade){return schoolLevels.find(level=>level.grades.includes(Number(grade)))}
function roomsFor(level){
 return tracks.filter(room=>(room!==tracks[1]||level.grades.includes(9))&&(room!==tracks[2]||level.grades.includes(12)));
}
function bindClassification(form,initial={}){
 const {level,track,year,subject,category}=form.elements;
 const chosen=initial.level||levelOf(initial.grade)?.name||"";
 level.innerHTML='<option value="">Chọn cấp học</option>'+options(schoolLevels.map(l=>l.name),chosen);
 level.value=chosen;
 function updateSubjects(preferred){subject.innerHTML=options(subjects(Number(year.value)),preferred)}
 function updateGrades(grade,sub,cat){
  const group=levelOfSelection();
  const grades=track.value===tracks[1]?[9]:track.value===tracks[2]?[12]:group.grades;
  year.innerHTML=options(grades,Number(grade));updateSubjects(sub);
  category.innerHTML=options(categories(track.value),cat);
 }
 function levelOfSelection(){return schoolLevels.find(l=>l.name===level.value)}
 function updateRooms(room,grade,sub,cat){
  const group=levelOfSelection();
  for(const select of [track,year,subject,category]){select.disabled=!group;if(!group)select.replaceChildren()}
  if(!group)return;
  track.innerHTML=options(roomsFor(group),room);
  updateGrades(grade,sub,cat);
 }
 updateRooms(initial.track,initial.grade,initial.subject,initial.category);
 level.onchange=()=>updateRooms(track.value,year.value,subject.value,category.value);
 track.onchange=()=>updateGrades(year.value,subject.value,category.value);
 year.onchange=()=>updateSubjects(subject.value);
}
function editor(existing=null,fromList=false){
 const host=document.querySelector("#panel");
 const legacy=existing&&!["drive","link"].includes(existing.type);
 host.innerHTML='<h2>'+(existing?"Chỉnh sửa đề / tài liệu":"Tạo đề và tài liệu")+'</h2><form id="create"><div class="filters">'+
  field("Cấp học",'<select id="level" name="level" required></select>')+field("Phòng",'<select id="track" name="track"></select>')+
  field("Lớp",'<select id="year" name="year"></select>')+field("Môn",'<select id="subject" name="subject"></select>')+
  field("Nội dung",'<select id="category" name="category"></select>')+'</div>'+
  field("Tên bài / tài liệu",'<input name="title" required maxlength="160">')+
  field("Định dạng",'<select id="format" name="format">'+(legacy?'<option value="legacy">Giữ nội dung đề hiện tại</option>':'')+'<option value="drive">Đề PDF trên Drive</option><option value="link">Tệp tài liệu qua liên kết</option></select>')+
  '<div id="content"></div><div class="actions"><button type="submit" class="primary">'+(existing?"Lưu thay đổi":"Đăng vào thư viện")+'</button>'+
  (fromList?'<button type="button" data-cancel>Quay lại danh sách</button>':'')+'</div></form>';
 const form=host.querySelector("form"),f=form.elements,content=form.querySelector("#content");
 bindClassification(form,existing||(fromList?examFilters:{}));
 if(existing){f.title.value=existing.title;f.format.value=legacy?"legacy":existing.type}
 let readPaper;
 function changeFormat(){
  if(f.format.value==="drive")readPaper=driveEditor(existing?.type==="drive"?existing:null);
  else if(f.format.value==="link"){
   content.innerHTML=field("Liên kết HTTPS",'<input name="resource" type="url" required>');
   if(existing?.type==="link")f.resource.value=existing.url;
   readPaper=()=>({type:"link",url:f.resource.value});
  }else{content.replaceChildren();readPaper=()=>({type:existing.type})}
 }
 changeFormat();f.format.onchange=changeFormat;
 if(fromList)form.querySelector("[data-cancel]").onclick=()=>examList();
 form.onsubmit=async e=>{
  e.preventDefault();
  const submit=form.querySelector('[type="submit"]');
  if(submit.disabled)return;
  submit.disabled=true;
  try{
   const payload={...readPaper(),title:f.title.value,grade:Number(f.year.value),subject:f.subject.value,track:f.track.value,category:f.category.value};
   if(existing)await api("updateItem",{...payload,id:existing.id,revision:existing.revision||0});
   else await api("publish",payload);
   if(!form.isConnected)return;
   if(fromList){
    Object.assign(examFilters,{level:f.level.value,grade:f.year.value,track:f.track.value,subject:f.subject.value,category:f.category.value,search:""});
    await examList(existing?"Đã lưu thay đổi.":"Đã đăng bài vào thư viện.");
   }else{
    items=(await api("catalog")).items;
    if(form.isConnected){editor();message.textContent="Đã đăng bài vào thư viện."}
   }
  }catch(error){if(form.isConnected)notifyError(error)}
  finally{submit.disabled=false}
 };
}

async function examList(notice=""){
 if(me?.role!=="admin")return;
 const host=document.querySelector("#panel");
 const section=document.createElement("section");host.replaceChildren(section);
 section.innerHTML='<h2>Danh sách đề đã tạo</h2><p role="status">Đang tải danh sách…</p>';
 try{
  const catalog=await api("catalog");
  if(!section.isConnected)return;
  items=catalog.items;
  section.innerHTML='<h2>Danh sách đề đã tạo</h2><div class="filters">'+
   [["level","Cấp học"],["grade","Lớp"],["track","Phòng"],["subject","Môn"],["category","Nội dung"]].map(([id,name])=>field(name,'<select data-filter="'+id+'"></select>')).join("")+
   field("Tìm tên đề",'<input type="search" data-search>')+'</div><button type="button" data-new>Tạo đề trong mục này</button><div data-rows></div>';
  const rows=section.querySelector("[data-rows]"),search=section.querySelector("[data-search]");
  search.value=examFilters.search;message.textContent=notice;
  section.querySelector("[data-new]").onclick=()=>editor(null,true);
  function draw(){
   let subset=items;
   for(const el of section.querySelectorAll("[data-filter]")){
    const key=el.dataset.filter;
    const valueOf=item=>key==="level"?levelOf(item.grade)?.name:String(item[key]);
    const choices=key==="level"?schoolLevels.map(l=>l.name):[...new Set(subset.map(valueOf))];
    if(key==="grade")choices.sort((a,b)=>Number(a)-Number(b));
    if(!choices.includes(examFilters[key]))examFilters[key]="";
    el.innerHTML='<option value="">Tất cả</option>'+options(choices,examFilters[key]);
    el.value=examFilters[key];
    if(el.value)subset=subset.filter(item=>valueOf(item)===el.value);
   }
   const term=search.value.trim().toLocaleLowerCase("vi");
   subset=subset.filter(item=>item.title.toLocaleLowerCase("vi").includes(term))
    .sort((a,b)=>a.grade-b.grade||a.title.localeCompare(b.title,"vi",{numeric:true}));
   rows.innerHTML=subset.length?schoolLevels.map(level=>{
    const group=subset.filter(item=>level.grades.includes(item.grade));
    if(!group.length)return "";
    return '<h3>'+level.name+' ('+group.length+')</h3>'+group.map(item=>'<article class="box row"><div><strong>'+h(item.title)+'</strong><p>Lớp '+item.grade+' · '+h(item.subject)+' · '+h(item.track)+' · '+h(item.category)+'</p></div><div class="actions"><button type="button" data-edit="'+h(item.id)+'">Sửa</button><button type="button" data-delete="'+h(item.id)+'">Xóa</button></div></article>').join("");
   }).join(""):'<p>Không có đề hoặc tài liệu phù hợp.</p>';
  }
  section.querySelectorAll("[data-filter]").forEach(el=>el.onchange=()=>{examFilters[el.dataset.filter]=el.value;draw()});
  search.oninput=()=>{examFilters.search=search.value;draw()};
  rows.onclick=async event=>{
   const btn=event.target.closest("button");if(!btn||btn.disabled)return;
   const id=btn.dataset.edit||btn.dataset.delete,item=items.find(it=>it.id===id);
   if(!item)return;
   if(btn.dataset.delete&&!confirm('Xóa “'+item.title+'” khỏi thư viện? Lịch sử điểm và bài đang chờ chấm sẽ được giữ lại.'))return;
   btn.disabled=true;
   try{
    if(btn.dataset.edit){const paper=await api("adminItem",{id});if(section.isConnected)editor(paper,true)}
    else{await api("deleteItem",{id,revision:item.revision||0});if(section.isConnected)await examList("Đã xóa đề khỏi thư viện.")}
   }catch(error){if(section.isConnected){await examList(error.message)}}
   finally{btn.disabled=false}
  };
  draw();
 }catch(error){if(section.isConnected)section.querySelector('[role="status"]').textContent=error.message}
}
