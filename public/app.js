const $=s=>document.querySelector(s);
let me=null, config=null, socket=null, current="home";
let seenMessageIds=new Set(), pendingMessages=[];

async function api(url,opt={}){const r=await fetch(url,{...opt,headers:opt.body instanceof FormData?opt.headers:{"Content-Type":"application/json",...(opt.headers||{})}});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"요청 실패");return d}
async function boot(){
  config=await api("/api/config"); document.documentElement.style.setProperty("--accent",config.accent||"#5865f2");
  const x=await fetch("/api/me"); const d=await x.json(); me=d.user;
  me?renderApp():renderAuth();
}
function renderAuth(){
$("#app").innerHTML=`<div class="auth"><div class="auth-card">
<div class="logo">${esc(config.factionName)}</div><div class="sub">시바시바</div>
<div id="authError"></div><div id="loginBox">${loginForm()}</div><div id="regBox" class="hidden">${registerForm()}</div>
<div class="tabs"><button id="loginTab" class="active">로그인</button><button id="regTab">회원가입</button></div>
</div></div>`;
$("#loginTab").onclick=()=>{$("#loginBox").classList.remove("hidden");$("#regBox").classList.add("hidden");$("#loginTab").classList.add("active");$("#regTab").classList.remove("active")}
$("#regTab").onclick=()=>{$("#regBox").classList.remove("hidden");$("#loginBox").classList.add("hidden");$("#regTab").classList.add("active");$("#loginTab").classList.remove("active")}
$("#loginForm").onsubmit=login;$("#registerForm").onsubmit=register;
}
function loginForm(){return `<form id="loginForm"><div class="field"><label>아이디</label><input id="liUser" required></div><div class="field"><label>비밀번호</label><input id="liPass" type="password" required></div><button class="btn" style="width:100%">로그인</button></form>`}
function registerForm(){return `<form id="registerForm"><div class="field"><label>사용할 아이디</label><input id="reUser" placeholder="영문/숫자/_ 3~24자" required></div><div class="field"><label>닉네임</label><input id="reNick" required></div><div class="field"><label>비밀번호</label><input id="rePass" type="password" minlength="6" required></div><button class="btn" style="width:100%">회원가입</button></form>`}
async function login(e){e.preventDefault();try{const d=await api("/api/login",{method:"POST",body:JSON.stringify({username:liUser.value,password:liPass.value})});me=d.user;renderApp()}catch(x){$("#authError").innerHTML=`<div class="notice">${esc(x.message)}</div>`}}
async function register(e){e.preventDefault();try{const d=await api("/api/register",{method:"POST",body:JSON.stringify({username:reUser.value,nickname:reNick.value,password:rePass.value})});me=d.user;renderApp()}catch(x){$("#authError").innerHTML=`<div class="notice">${esc(x.message)}</div>`}}

function renderApp(){
$("#app").innerHTML=`<div class="layout"><aside class="side"><div class="brand">${esc(config.factionName)}</div><div class="nav">
<button data-p="home">🏠 홈</button><button data-p="chat">💬 채팅방</button><button data-p="friends">👥 친구</button><button data-p="memories">📸 추억공유</button><button data-p="profile">👤 프로필</button>${me.role==="admin"?`<button data-p="admin">🛡 관리자</button>`:""}
</div></aside><main class="main"><div class="top"><h1 id="title"></h1><div class="user-mini"><div><b>${esc(me.nickname)}</b><div class="muted">@${esc(me.username)}</div></div><div class="avatar">${me.avatar?`<img class="avatar" src="${esc(me.avatar)}">`:esc(me.nickname[0]||"?")}</div><button id="logout" class="btn secondary small">로그아웃</button></div></div><section id="content"></section></main></div>`;
document.querySelectorAll(".nav button").forEach(b=>b.onclick=()=>go(b.dataset.p));$("#logout").onclick=async()=>{await api("/api/logout",{method:"POST"});location.reload()};go("home");
if(!socket){
  socket=io();
  socket.on("connect",()=>socket.emit("joinUser",me.id));
  socket.on("forceLogout",m=>{alert(m);location.reload()});
  socket.on("chatMessage",m=>handleIncomingMessage(m));
} else if(socket.connected){
  socket.emit("joinUser",me.id);
}
}
const titles={home:"홈",chat:"채팅방",friends:"친구",memories:"추억 공유방",profile:"프로필",admin:"관리자 패널"};
async function go(p){current=p;$("#title").textContent=titles[p];document.querySelectorAll(".nav button").forEach(b=>b.classList.toggle("active",b.dataset.p===p));({home:home,chat:chat,friends:friends,memories:memories,profile:profile,admin:admin}[p])()}
function home(){ $("#content").innerHTML=`<div class="grid"><div class="card"><h2>환영합니다, ${esc(me.nickname)}!</h2><p class="muted">FiveM 팩션원들의 채팅과 추억을 한곳에서 관리하세요.</p></div><div class="card"><h2>내 계정</h2><p>아이디 <b>@${esc(me.username)}</b></p><p>권한 <b>${me.role==="admin"?"관리자":"일반 사용자"}</b></p></div></div>`}
async function chat(){
  const msgs=await api("/api/messages");
  const combined=[...msgs,...pendingMessages];
  const unique=[]; const ids=new Set();
  for(const m of combined){if(!ids.has(m.id)){ids.add(m.id);unique.push(m);seenMessageIds.add(m.id)}}
  pendingMessages=[];
  $("#content").innerHTML=`<div class="card chat"><div id="messages" class="messages">${unique.map(messageHTMLWithId).join("")}</div><form id="chatForm" class="chat-input"><input id="chatText" maxlength="500" placeholder="메시지를 입력하세요..." autocomplete="off"><button class="btn">전송</button></form></div>`;
  $("#chatForm").onsubmit=e=>{e.preventDefault();const t=chatText.value.trim();if(t){socket.emit("chatMessage",{userId:me.id,text:t});chatText.value=""}};
  scrollChat();
}
function messageHTML(m){
  const avatar=m.avatar?`<img class="msg-avatar" src="${esc(m.avatar)}" alt="">`:`<div class="msg-avatar msg-avatar-fallback">${esc((m.nickname||"?")[0])}</div>`;
  return `<div class="msg"><div class="msg-avatar-wrap">${avatar}</div><div class="msg-body"><div class="msg-meta"><strong class="msg-name">${esc(m.nickname)}</strong></div><div class="msg-text">${esc(m.text)}</div></div></div>`;
}
function handleIncomingMessage(m){
  if(!m||!m.id||seenMessageIds.has(m.id))return;
  seenMessageIds.add(m.id);
  if(current==="chat"&&$("#messages")) appendMessage(m); else pendingMessages.push(m);
}
function appendMessage(m){
  if(!m||seenMessageIds.has(m.id)===false) seenMessageIds.add(m.id);
  const box=$("#messages");if(!box){pendingMessages.push(m);return;}
  if(box.querySelector(`[data-message-id="${CSS.escape(m.id)}"]`))return;
  box.insertAdjacentHTML("beforeend",messageHTMLWithId(m));scrollChat();
}
function messageHTMLWithId(m){
  const avatar=m.avatar?`<img class="msg-avatar" src="${esc(m.avatar)}" alt="">`:`<div class="msg-avatar msg-avatar-fallback">${esc((m.nickname||"?")[0])}</div>`;
  return `<div class="msg" data-message-id="${esc(m.id)}"><div class="msg-avatar-wrap">${avatar}</div><div class="msg-body"><div class="msg-meta"><strong class="msg-name">${esc(m.nickname)}</strong></div><div class="msg-text">${esc(m.text)}</div></div></div>`;
}
function scrollChat(){const b=$("#messages");if(b)b.scrollTop=b.scrollHeight}
async function friends(){
  const [fs,users]=await Promise.all([api("/api/friends"),api("/api/users")]);
  const accepted=fs.filter(x=>x.status==="accepted");
  const incoming=fs.filter(x=>x.status==="pending"&&x.to===me.id);
  const relationshipByUser=new Map();
  for(const f of fs){
    const otherId=f.from===me.id?f.to:f.from;
    relationshipByUser.set(otherId,f);
  }
  $("#content").innerHTML=`<div class="grid"><div class="card"><h2>친구 목록</h2><div class="users">${accepted.length?accepted.map(x=>friendRow(x,"friend")).join(""):`<p class="muted">친구가 없습니다.</p>`}</div></div><div class="card"><h2>받은 친구 요청</h2><div class="users">${incoming.length?incoming.map(x=>friendRow(x,"incoming")).join(""):`<p class="muted">받은 요청이 없습니다.</p>`}</div></div></div><div class="card" style="margin-top:18px"><h2>사용자 찾기 / 친구 추가</h2><div class="users">${users.map(u=>{
    const f=relationshipByUser.get(u.id);
    let label="친구 추가", disabled="";
    if(f?.status==="accepted" || (f?.status==="pending"&&f.from===me.id)){label="친구완료";disabled="disabled";}
    else if(f?.status==="pending"&&f.to===me.id){label="친구 요청 수신";disabled="disabled";}
    return `<div class="user-row"><div class="avatar">${u.avatar?`<img class="avatar" src="${esc(u.avatar)}">`:esc(u.nickname[0]||"?")}</div><div class="grow"><b>${esc(u.nickname)}</b><div class="muted">@${esc(u.username)}</div></div><button class="btn small ${disabled?"secondary":""}" ${disabled} onclick="addFriend('${u.id}')">${label}</button></div>`;
  }).join("")}</div></div>`;
}
function friendRow(x,type){return `<div class="user-row"><div class="avatar">${x.user.avatar?`<img class="avatar" src="${esc(x.user.avatar)}">`:esc(x.user.nickname[0]||"?")}</div><div class="grow"><b>${esc(x.user.nickname)}</b><div class="muted">@${esc(x.user.username)}</div></div>${type==="incoming"?`<button class="btn small" onclick="acceptFriend('${x.id}')">수락</button>`:""}<button class="btn danger small" onclick="removeFriend('${x.id}')">${type==="incoming"?"거절":"삭제"}</button></div>`}
async function addFriend(id){try{await api("/api/friends/"+id,{method:"POST"});alert("친구 요청을 보냈습니다.");friends()}catch(e){alert(e.message)}}
async function acceptFriend(id){await api("/api/friends/"+id+"/accept",{method:"POST"});friends()}
async function removeFriend(id){await api("/api/friends/"+id,{method:"DELETE"});friends()}

async function memories(){const ms=await api("/api/memories");$("#content").innerHTML=`<div class="card"><h2>추억 올리기</h2><form id="memoryForm"><div class="field"><input id="memFile" type="file" accept="image/*" required></div><div class="field"><input id="memCaption" placeholder="추억에 대한 한마디"></div><button class="btn">사진 업로드</button></form></div><div class="memory-grid" style="margin-top:18px">${ms.map(m=>`<article class="memory"><img src="${esc(m.image)}"><div class="memory-body"><b>${esc(m.user.nickname)}</b><p>${esc(m.caption||"")}</p>${m.userId===me.id||me.role==="admin"?`<button class="btn danger small" onclick="delMemory('${m.id}')">삭제</button>`:""}</div></article>`).join("")||`<div class="card"><p class="muted">아직 공유된 추억이 없습니다.</p></div>`}</div>`;$("#memoryForm").onsubmit=async e=>{e.preventDefault();const f=new FormData();f.append("image",memFile.files[0]);f.append("caption",memCaption.value);try{await api("/api/memories",{method:"POST",body:f});memories()}catch(x){alert(x.message)}}}
async function delMemory(id){if(confirm("사진을 삭제할까요?")){await api("/api/memories/"+id,{method:"DELETE"});memories()}}

function profile(){$("#content").innerHTML=`<div class="card" style="max-width:650px"><h2>프로필 수정</h2><div class="field"><label>아이디 (변경 불가)</label><input value="${esc(me.username)}" disabled></div><div class="field"><label>닉네임</label><input id="pNick" value="${esc(me.nickname)}" maxlength="30"></div><div class="field"><label>프로필 이미지 URL</label><input id="pAvatar" value="${esc(me.avatar||"")}" placeholder="https://..."></div><button class="btn" onclick="saveProfile()">저장</button></div>`}
async function saveProfile(){const d=await api("/api/profile",{method:"PUT",body:JSON.stringify({nickname:pNick.value,avatar:pAvatar.value})});me=d.user;alert("저장되었습니다.");renderApp()}

async function admin(){const [users,bans]=await Promise.all([api("/api/admin/users"),api("/api/admin/bans")]);$("#content").innerHTML=`<div class="grid"><div class="card"><h2>사이트 설정</h2><div class="field"><label>팩션 이름</label><input id="setName" value="${esc(config.factionName)}"></div><div class="field"><label>강조 색상</label><input id="setAccent" value="${esc(config.accent)}"></div><button class="btn" onclick="saveSettings()">설정 저장</button></div><div class="card"><h2>차단 사용자</h2><div class="users">${bans.length?bans.map(b=>`<div class="user-row"><div class="grow"><b>${esc(b.user.nickname)}</b><div class="muted">@${esc(b.user.username)} · ${esc(b.reason)}</div></div><button class="btn small" onclick="unban('${b.userId}')">차단 해제</button></div>`).join(""):`<p class="muted">차단된 사용자가 없습니다.</p>`}</div></div></div><div class="card" style="margin-top:18px"><h2>사용자 / 관리자 관리</h2><table class="table"><thead><tr><th>닉네임</th><th>아이디</th><th>권한</th><th>관리</th></tr></thead><tbody>${users.map(u=>`<tr><td>${esc(u.nickname)}</td><td>@${esc(u.username)}</td><td>${u.role}</td><td><div class="actions">${u.id!==me.id?`<button class="btn small" onclick="kick('${u.id}')">킥</button><button class="btn danger small" onclick="ban('${u.id}')">차단</button>${u.role==="admin"?`<button class="btn secondary small" onclick="demote('${u.id}')">관리자 해제</button>`:`<button class="btn secondary small" onclick="promote('${u.id}')">관리자 추가</button>`}`:"본인"}</div></td></tr>`).join("")}</tbody></table></div>`}
async function saveSettings(){const d=await api("/api/admin/settings",{method:"PUT",body:JSON.stringify({factionName:setName.value,accent:setAccent.value})});config=d;document.documentElement.style.setProperty("--accent",d.accent);alert("설정 저장 완료");admin()}
async function kick(id){if(confirm("이 사용자를 킥할까요?")){await api("/api/admin/kick/"+id,{method:"POST"});alert("킥했습니다.")}}
async function ban(id){const reason=prompt("차단 사유","관리자 차단");if(reason!==null){await api("/api/admin/ban/"+id,{method:"POST",body:JSON.stringify({reason})});admin()}}
async function unban(id){await api("/api/admin/ban/"+id,{method:"DELETE"});admin()}
async function promote(id){if(confirm("관리자로 추가할까요?")){await api("/api/admin/promote/"+id,{method:"POST"});admin()}}
async function demote(id){if(confirm("관리자 권한을 삭제할까요?")){await api("/api/admin/demote/"+id,{method:"POST"});admin()}}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
boot();