const express=require('express'),helmet=require('helmet'),rl=require('express-rate-limit'),multer=require('multer'),QR=require('qrcode'),bcrypt=require('bcryptjs'),jwt=require('jsonwebtoken'),crypto=require('crypto'),fs=require('fs'),path=require('path');
const {isPlaceholderSecret}=require('../lib/secret-validation');
const {ADMIN_PASSWORD,JWT_SECRET,BASE_URL='http://localhost:3000',QR_ID_SECRET}=process.env;
if(!ADMIN_PASSWORD||ADMIN_PASSWORD.length<12||!JWT_SECRET||JWT_SECRET.length<32||!QR_ID_SECRET||QR_ID_SECRET.length<32||JWT_SECRET===QR_ID_SECRET||[ADMIN_PASSWORD,JWT_SECRET,QR_ID_SECRET].some(isPlaceholderSecret)){console.error('Güvensiz ayar: ADMIN_PASSWORD, JWT_SECRET ve QR_ID_SECRET gerekli; JWT_SECRET ile QR_ID_SECRET farklı olmalı');process.exit(1)}
if(BASE_URL.startsWith('https://')&&process.env.COOKIE_SECURE!=='1'){console.error('https için COOKIE_SECURE=1 gerekli');process.exit(1)}

const app=express(),hash=bcrypt.hashSync(ADMIN_PASSWORD,12),sessions=new Set();
app.disable('x-powered-by');app.set('trust proxy',process.env.TRUST_PROXY==='1'?1:false);
app.use(helmet({referrerPolicy:{policy:'no-referrer'},contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'"],imgSrc:["'self'","data:"],objectSrc:["'none'"],frameAncestors:["'none'"],baseUri:["'self'"],formAction:["'self'"],upgradeInsecureRequests:BASE_URL.startsWith('https://')?[]:null}}}));
app.use((q,s,n)=>{if(q.path.startsWith('/api'))s.set('Cache-Control','no-store');n()});
app.use(express.json({limit:'10kb'}));

const secure=process.env.COOKIE_SECURE==='1',cookieName=secure?'__Host-qr-sid':'qr-sid';
const cookie=q=>(q.headers.cookie||'').match(new RegExp('(?:^|; )'+cookieName+'=([^;]+)'))?.[1]||'';
const auth=(q,s,n)=>{try{
 const p=jwt.verify(cookie(q),JWT_SECRET,{algorithms:['HS256'],issuer:'kostu-qr'});
 if(!sessions.has(p.jti))throw 0;
 if(q.method!=='GET'){const o=q.headers.origin;if(q.headers['x-requested-with']!=='kostu-qr'||(o&&new URL(o).host!==q.headers.host))return s.sendStatus(403)}
 n()
}catch{s.status(401).json({error:'Yetkisiz'})}};
const loginLimit=rl({windowMs:9e5,max:5,skipSuccessfulRequests:true,message:{error:'Çok fazla deneme, 15 dk sonra tekrar deneyin'}});
app.post('/api/login',loginLimit,async(q,s)=>{
 const ok=typeof q.body.password==='string'&&q.body.password.length<200&&await bcrypt.compare(q.body.password,hash);
 if(!ok)return s.status(401).json({error:'Hatalı parola'});
 const jti=crypto.randomUUID();sessions.add(jti);
 s.cookie(cookieName,jwt.sign({jti},JWT_SECRET,{algorithm:'HS256',expiresIn:'8h',issuer:'kostu-qr'}),{httpOnly:true,sameSite:'strict',secure,path:'/',maxAge:288e5});
 s.json({ok:1})
});
app.get('/api/session',auth,(q,s)=>s.json({ok:1}));
app.post('/api/logout',auth,(q,s)=>{try{sessions.delete(jwt.decode(cookie(q)).jti)}catch{}s.clearCookie(cookieName,{path:'/'});s.json({ok:1})});

const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:25e6,files:1}});
const makeQr=rl({windowMs:6e4,max:10,message:{error:'Çok fazla QR isteği, bir dakika bekleyin'}});
app.post('/api/qr',auth,makeQr,upload.single('pdf'),async(q,s,n)=>{
 try{
  if(!q.file)return s.status(400).json({error:'PDF dosyası gerekli'});
  if(q.file.buffer.subarray(0,5).toString()!=='%PDF-')return s.status(400).json({error:'Geçerli bir PDF gerekli'});
  const sourceHash=crypto.createHash('sha256').update(q.file.buffer).digest('hex');
  const token='v2.'+crypto.createHmac('sha256',QR_ID_SECRET).update(sourceHash).digest('base64url');
  const url=`${BASE_URL.replace(/\/$/,'')}/v/${token}`;
  const png=await QR.toBuffer(url,{width:800,margin:2,errorCorrectionLevel:'H',color:{dark:'#0F3B57'}});
  s.json({token,image:'data:image/png;base64,'+png.toString('base64')})
 }catch(e){n(e)}
});

app.get('/health',(q,s)=>s.send('ok'));
app.get('/logo.png',(q,s)=>s.sendFile(path.join(__dirname,'..','public','logo.png')));
app.use(express.static(path.join(__dirname,'public')));
app.get('/',(q,s)=>s.sendFile(path.join(__dirname,'public/index.html')));
app.use((e,q,s,n)=>{console.error(e.message);s.status(e.status||(e.name==='MulterError'?400:500)).json({error:'İstek işlenemedi'})});
app.listen(3001,()=>console.log('QR üretici :3001'));
