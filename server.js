import express from "express";
import session from "express-session";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server } from "socket.io";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

const PORT = process.env.PORT || 3000;
const PERMANENT_SESSION_MS = 1000 * 60 * 60 * 24 * 365 * 10; // 10 years (effectively permanent)
// IMPORTANT: site data lives OUTSIDE the server/project folder.
// Replacing this entire project folder therefore does not replace accounts,
// sessions, chat history, friendships, settings, or uploaded memories.
const DEFAULT_DATA_ROOT = path.join(process.env.USERPROFILE || process.env.HOME || __dirname, "ShibaFactionData");
const DATA = path.resolve(process.env.SHIBA_DATA_DIR || DEFAULT_DATA_ROOT);
const UPLOADS = path.join(DATA, "uploads");
fs.mkdirSync(DATA, { recursive: true });
fs.mkdirSync(UPLOADS, { recursive: true });

const dbFile = path.join(DATA, "db.json");
const sessionsFile = path.join(DATA, "sessions.json");

// One-time migration from older versions where data was stored inside the project.
// Existing persistent data always wins; nothing is overwritten.
const legacyData = path.join(__dirname, "data");
const legacyUploads = path.join(__dirname, "uploads");
function copyIfMissing(src, dest) {
  if (fs.existsSync(src) && !fs.existsSync(dest)) {
    fs.copyFileSync(src, dest);
    console.log(`[DATA] Migrated: ${src} -> ${dest}`);
  }
}
copyIfMissing(path.join(legacyData, "db.json"), dbFile);
copyIfMissing(path.join(legacyData, "sessions.json"), sessionsFile);
if (fs.existsSync(legacyUploads)) {
  for (const name of fs.readdirSync(legacyUploads)) {
    const src = path.join(legacyUploads, name);
    const dest = path.join(UPLOADS, name);
    if (fs.statSync(src).isFile()) copyIfMissing(src, dest);
  }
}
const defaultDb = {
  settings: { factionName: "시바견 생존신고방", accent: "#5865f2" },
  users: [],
  friendships: [],
  messages: [],
  memories: [],
  bans: []
};
if (!fs.existsSync(dbFile)) fs.writeFileSync(dbFile, JSON.stringify(defaultDb, null, 2));
if (!fs.existsSync(sessionsFile)) fs.writeFileSync(sessionsFile, JSON.stringify({}, null, 2));

function readDb() { return JSON.parse(fs.readFileSync(dbFile, "utf8")); }
function writeDb(db) { fs.writeFileSync(dbFile, JSON.stringify(db, null, 2)); }

class JsonSessionStore extends session.Store {
  constructor(file) { super(); this.file=file; }
  read() { try { return JSON.parse(fs.readFileSync(this.file, "utf8")); } catch { return {}; } }
  write(data) { fs.writeFileSync(this.file, JSON.stringify(data, null, 2)); }
  get(sid, cb) { const all=this.read(); const row=all[sid]; if(!row) return cb(null,null); if(row.cookie?.expires && new Date(row.cookie.expires) < new Date()){ delete all[sid]; this.write(all); return cb(null,null); } cb(null,row); }
  set(sid, sess, cb) { const all=this.read(); all[sid]=sess; this.write(all); cb?.(null); }
  destroy(sid, cb) { const all=this.read(); delete all[sid]; this.write(all); cb?.(null); }
  touch(sid, sess, cb) { const all=this.read(); if(all[sid]) { all[sid].cookie=sess.cookie; this.write(all); } cb?.(null); }
}
function id() { return crypto.randomBytes(9).toString("hex"); }
function hash(p) { return crypto.createHash("sha256").update(p).digest("hex"); }
function safeUser(u) {
  return { id: u.id, username: u.username, nickname: u.nickname, avatar: u.avatar || "", role: u.role, createdAt: u.createdAt };
}
function auth(req,res,next) {
  if (!req.session.userId) return res.status(401).json({error:"로그인이 필요합니다."});
  const db=readDb(), u=db.users.find(x=>x.id===req.session.userId);
  if(!u) return res.status(401).json({error:"세션이 만료되었습니다."});
  req.user=u; next();
}
function admin(req,res,next) {
  if(req.user.role!=="admin") return res.status(403).json({error:"관리자 권한이 필요합니다."});
  next();
}

app.use(express.json({limit:"2mb"}));
app.use(express.urlencoded({extended:true}));
app.use(session({
  secret: process.env.SESSION_SECRET || "shiba-faction-change-this-secret",
  store:new JsonSessionStore(sessionsFile),
  resave:false, saveUninitialized:false,
  cookie:{httpOnly:true, sameSite:"lax", maxAge:1000*60*60*24*30}
}));
app.use(express.static(path.join(__dirname,"public")));
app.use("/uploads", express.static(UPLOADS));

const storage=multer.diskStorage({
  destination:(_,__,cb)=>cb(null,UPLOADS),
  filename:(_,file,cb)=>cb(null, Date.now()+"-"+crypto.randomBytes(5).toString("hex")+path.extname(file.originalname))
});
const upload=multer({storage, limits:{fileSize:8*1024*1024}, fileFilter:(_,file,cb)=>{
  cb(null, /^image\/(jpeg|png|gif|webp)$/.test(file.mimetype));
}});

app.get("/api/config",(req,res)=>res.json(readDb().settings));
app.get("/api/me",(req,res)=>{
  if(!req.session.userId) return res.json({user:null});
  const db=readDb(), u=db.users.find(x=>x.id===req.session.userId);
  if(!u) return res.json({user:null});
  // Upgrade existing sessions to the permanent login policy.
  req.session.cookie.maxAge = PERMANENT_SESSION_MS;
  req.session.save(()=>res.json({user:safeUser(u)}));
});

app.post("/api/register",(req,res)=>{
  const {username,password,nickname}=req.body;
  if(!username||!password||!nickname) return res.status(400).json({error:"아이디, 비밀번호, 닉네임을 입력하세요."});
  if(!/^[A-Za-z0-9_]{3,24}$/.test(username)) return res.status(400).json({error:"아이디는 영문/숫자/_ 3~24자로 입력하세요."});
  const db=readDb();
  if(db.users.some(u=>u.username.toLowerCase()===username.toLowerCase())) return res.status(409).json({error:"이미 사용 중인 아이디입니다."});
  const u={id:id(),username,password:hash(password),nickname:nickname.slice(0,30),avatar:"",role:db.users.length===0?"admin":"user",createdAt:new Date().toISOString()};
  db.users.push(u); writeDb(db);
  req.session.userId=u.id;
  req.session.cookie.maxAge=PERMANENT_SESSION_MS;
  req.session.save(()=>res.json({user:safeUser(u)}));
});

app.post("/api/login",(req,res)=>{
  const {username,password}=req.body; const db=readDb();
  const u=db.users.find(x=>x.username.toLowerCase()===String(username||"").toLowerCase());
  if(!u||u.password!==hash(String(password||""))) return res.status(401).json({error:"아이디 또는 비밀번호가 올바르지 않습니다."});
  if(db.bans.some(b=>b.userId===u.id)) return res.status(403).json({error:"차단된 계정입니다."});
  req.session.userId=u.id;
  // Login is always persistent. Closing the browser or restarting the server
  // will not log the user out. The session store is backed by data/sessions.json.
  req.session.cookie.maxAge=PERMANENT_SESSION_MS;
  req.session.save(()=>res.json({user:safeUser(u)}));
});
app.post("/api/logout",(req,res)=>{
  if(!req.session) return res.json({ok:true});
  req.session.destroy(()=>{
    res.clearCookie("connect.sid",{httpOnly:true,sameSite:"lax"});
    res.json({ok:true});
  });
});

app.put("/api/profile",auth,(req,res)=>{
  const {nickname,avatar}=req.body; const db=readDb();
  const u=db.users.find(x=>x.id===req.user.id);
  if(nickname) u.nickname=String(nickname).slice(0,30);
  if(avatar!==undefined) u.avatar=String(avatar).slice(0,500);
  writeDb(db); res.json({user:safeUser(u)});
});

app.get("/api/users",auth,(req,res)=>{
  const db=readDb();
  res.json(db.users.map(safeUser).filter(u=>u.id!==req.user.id));
});

app.get("/api/friends",auth,(req,res)=>{
  const db=readDb(), uid=req.user.id;
  const rows=db.friendships.filter(f=>f.from===uid||f.to===uid);
  res.json(rows.map(f=>({...f, user:safeUser(db.users.find(u=>u.id===(f.from===uid?f.to:f.from)))})));
});
app.post("/api/friends/:userId",auth,(req,res)=>{
  const db=readDb(), uid=req.user.id, other=req.params.userId;
  if(uid===other||!db.users.some(u=>u.id===other)) return res.status(400).json({error:"잘못된 사용자입니다."});
  const existing=db.friendships.find(f=>(f.from===uid&&f.to===other)||(f.from===other&&f.to===uid));
  if(existing) return res.status(409).json({error:"이미 친구 요청/친구 관계가 있습니다."});
  db.friendships.push({id:id(),from:uid,to:other,status:"pending",createdAt:new Date().toISOString()});
  writeDb(db); res.json({ok:true});
});
app.post("/api/friends/:friendshipId/accept",auth,(req,res)=>{
  const db=readDb(), f=db.friendships.find(x=>x.id===req.params.friendshipId);
  if(!f||f.to!==req.user.id) return res.status(404).json({error:"요청을 찾을 수 없습니다."});
  f.status="accepted"; writeDb(db); res.json({ok:true});
});
app.delete("/api/friends/:friendshipId",auth,(req,res)=>{
  const db=readDb(); const i=db.friendships.findIndex(x=>x.id===req.params.friendshipId&&(x.from===req.user.id||x.to===req.user.id));
  if(i<0)return res.status(404).json({error:"친구 관계를 찾을 수 없습니다."});
  db.friendships.splice(i,1); writeDb(db); res.json({ok:true});
});

app.get("/api/messages",auth,(req,res)=>{
  const db=readDb(); res.json(db.messages.slice(-5000));
});

app.post("/api/memories",auth,upload.single("image"),(req,res)=>{
  if(!req.file)return res.status(400).json({error:"이미지를 선택하세요."});
  const db=readDb();
  const m={id:id(),userId:req.user.id,nickname:req.user.nickname,image:"/uploads/"+req.file.filename,caption:String(req.body.caption||"").slice(0,200),createdAt:new Date().toISOString()};
  db.memories.unshift(m); writeDb(db); res.json(m);
});
app.get("/api/memories",auth,(req,res)=>{
  const db=readDb();
  res.json(db.memories.map(m=>({...m,user:safeUser(db.users.find(u=>u.id===m.userId)||{id:"",username:"",nickname:"삭제된 사용자",role:"user"})})));
});
app.delete("/api/memories/:id",auth,(req,res)=>{
  const db=readDb(); const i=db.memories.findIndex(m=>m.id===req.params.id);
  if(i<0)return res.status(404).json({error:"사진을 찾을 수 없습니다."});
  const m=db.memories[i];
  if(m.userId!==req.user.id&&req.user.role!=="admin")return res.status(403).json({error:"삭제 권한이 없습니다."});
  const fp=path.join(UPLOADS,path.basename(m.image));
  if(fs.existsSync(fp)) fs.unlinkSync(fp);
  db.memories.splice(i,1); writeDb(db); res.json({ok:true});
});

app.get("/api/admin/users",auth,admin,(req,res)=>{
  const db=readDb(); res.json(db.users.map(safeUser));
});
app.get("/api/admin/bans",auth,admin,(req,res)=>{
  const db=readDb(); res.json(db.bans.map(b=>({...b,user:safeUser(db.users.find(u=>u.id===b.userId)||{id:"",username:"",nickname:"삭제된 사용자",role:"user"})})));
});
app.post("/api/admin/kick/:userId",auth,admin,(req,res)=>{
  io.to("user:"+req.params.userId).emit("forceLogout","관리자에 의해 킥되었습니다.");
  res.json({ok:true});
});
app.post("/api/admin/ban/:userId",auth,admin,(req,res)=>{
  const db=readDb(); if(req.params.userId===req.user.id)return res.status(400).json({error:"자기 자신은 차단할 수 없습니다."});
  if(!db.bans.some(b=>b.userId===req.params.userId)) db.bans.push({id:id(),userId:req.params.userId,reason:String(req.body.reason||"관리자 차단"),createdAt:new Date().toISOString()});
  writeDb(db); io.to("user:"+req.params.userId).emit("forceLogout","관리자에 의해 차단되었습니다."); res.json({ok:true});
});
app.delete("/api/admin/ban/:userId",auth,admin,(req,res)=>{
  const db=readDb(); db.bans=db.bans.filter(b=>b.userId!==req.params.userId); writeDb(db); res.json({ok:true});
});
app.post("/api/admin/promote/:userId",auth,admin,(req,res)=>{
  const db=readDb(),u=db.users.find(x=>x.id===req.params.userId); if(!u)return res.status(404).json({error:"사용자 없음"});
  u.role="admin"; writeDb(db); res.json({ok:true});
});
app.post("/api/admin/demote/:userId",auth,admin,(req,res)=>{
  const db=readDb(),u=db.users.find(x=>x.id===req.params.userId); if(!u)return res.status(404).json({error:"사용자 없음"});
  if(u.id===req.user.id)return res.status(400).json({error:"자기 자신의 관리자 권한은 여기서 삭제할 수 없습니다."});
  u.role="user"; writeDb(db); res.json({ok:true});
});
app.put("/api/admin/settings",auth,admin,(req,res)=>{
  const db=readDb(); if(req.body.factionName)db.settings.factionName=String(req.body.factionName).slice(0,50);
  if(req.body.accent)db.settings.accent=String(req.body.accent).slice(0,20);
  writeDb(db); res.json(db.settings);
});

io.use((socket,next)=>{
  const cookie=socket.handshake.headers.cookie||"";
  const match=cookie.match(/connect\.sid=([^;]+)/);
  if(!match)return next(new Error("unauthorized"));
  // Session parsing is intentionally omitted for this simple starter.
  next();
});
io.on("connection",socket=>{
  socket.on("joinUser",uid=>socket.join("user:"+uid));
  socket.on("chatMessage",data=>{
    const db=readDb();
    const u=db.users.find(x=>x.id===data.userId);
    if(!u)return;
    if(db.bans.some(b=>b.userId===u.id))return;
    const msg={id:id(),userId:u.id,nickname:u.nickname,avatar:u.avatar||"",text:String(data.text||"").slice(0,500),createdAt:new Date().toISOString()};
    db.messages.push(msg); db.messages=db.messages.slice(-5000); writeDb(db); io.emit("chatMessage",msg);
  });
});

app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
httpServer.listen(PORT, "0.0.0.0", ()=>console.log(`Server listening on port ${PORT}`));