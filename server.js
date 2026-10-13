const express=require('express'),helmet=require('helmet'),rl=require('express-rate-limit'),multer=require('multer'),QR=require('qrcode'),bcrypt=require('bcryptjs'),jwt=require('jsonwebtoken'),Db=require('better-sqlite3'),crypto=require('crypto'),fs=require('fs'),path=require('path');
const {ADMIN_PASSWORD,JWT_SECRET,BASE_URL='http://localhost:3000',DATA_DIR='./data',QR_SECRET}=process.env;
process.umask(0o077);
if(!ADMIN_PASSWORD||ADMIN_PASSWORD.length<12||!JWT_SECRET||JWT_SECRET.length<32||!QR_SECRET||QR_SECRET.length<32||JWT_SECRET===QR_SECRET||/degistir|ayri-en-az|en-az-32|changeme|password/i.test(ADMIN_PASSWORD+JWT_SECRET+QR_SECRET)){console.error('Güvensiz ayar: ADMIN_PASSWORD (en az 12), JWT_SECRET ve QR_SECRET (en az 32, birbirinden farklı, örnek değerler olmadan) gerekli');process.exit(1)}
if(BASE_URL.startsWith('https://')&&process.env.COOKIE_SECURE!=='1'){console.error('https için COOKIE_SECURE=1 gerekli');process.exit(1)}
fs.mkdirSync(DATA_DIR+'/pdfs',{recursive:true});
const db=new Db(DATA_DIR+'/app.db');
db.exec(`CREATE TABLE IF NOT EXISTS docs(id INTEGER PRIMARY KEY AUTOINCREMENT,serial TEXT UNIQUE,token TEXT UNIQUE NOT NULL,product,brand_model,category,summary,product_serial,test_date,customer,officer,file,sha256,status TEXT DEFAULT 'valid',reason,new_serial,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY AUTOINCREMENT,ts TEXT DEFAULT CURRENT_TIMESTAMP,ip,action,detail);`);
try{db.exec('ALTER TABLE docs ADD COLUMN sig TEXT')}catch{}
try{db.exec('ALTER TABLE audit ADD COLUMN hash TEXT')}catch{}
const ah=(p,ts,ip,a,d)=>crypto.createHash('sha256').update(`${p}|${ts}|${ip}|${a}|${d}`).digest('hex');
const log=(q,a,d='')=>{const l=db.prepare('SELECT hash FROM audit WHERE hash IS NOT NULL ORDER BY id DESC LIMIT 1').get(),ts=new Date().toISOString();
 db.prepare('INSERT INTO audit(ts,ip,action,detail,hash) VALUES(?,?,?,?,?)').run(ts,q.ip,a,String(d),ah(l?l.hash:'',ts,q.ip,a,String(d)))};
const hash=bcrypt.hashSync(ADMIN_PASSWORD,12);
// Kriptografi: QR_SECRET'tan HKDF ile ayrı alt anahtarlar (seri no, QR, dosya)
const sub=l=>Buffer.from(crypto.hkdfSync('sha256',QR_SECRET,'kostu-v1',l,32)),KS=sub('serial'),KQ=sub('qr'),KF=sub('file');
const mac=(k,d,n)=>crypto.createHmac('sha256',k).update(d).digest().subarray(0,n);
const AL='ABCDEFGHJKMNPQRSTUVWXYZ23456789',rnd=n=>Array.from({length:n},()=>AL[crypto.randomInt(AL.length)]).join('');
const chk=b=>[...mac(KS,b,4)].map(x=>AL[x%AL.length]).join('');
const mkSerial=()=>{const b=`${new Date().getFullYear()}-${rnd(10)}`;return `KTLAB-${b}-${chk(b)}`};
const okSerial=s=>{const m=/^KTLAB-(\d{4}-[A-Z2-9]{10})-([A-Z2-9]{4})$/.exec(s);return !!m&&m[2]===chk(m[1])};
// Kurum imzası (Ed25519): ilk çalıştırmada üretilir, özel anahtar QR_SECRET ile şifreli saklanır
const kd=DATA_DIR+'/keys',kf=kd+'/signing.pem',pf=kd+'/public.pem';fs.mkdirSync(kd,{recursive:true});
if(!fs.existsSync(kf)){const k=crypto.generateKeyPairSync('ed25519');
 fs.writeFileSync(kf,k.privateKey.export({type:'pkcs8',format:'pem',cipher:'aes-256-cbc',passphrase:QR_SECRET}),{mode:0o600});
 fs.writeFileSync(pf,k.publicKey.export({type:'spki',format:'pem'}))}
const PRIV=crypto.createPrivateKey({key:fs.readFileSync(kf),passphrase:QR_SECRET}),PUB=crypto.createPublicKey(fs.readFileSync(pf));
const PUBPEM=PUB.export({type:'spki',format:'pem'}),FP=crypto.createHash('sha256').update(PUB.export({type:'spki',format:'der'})).digest('hex').slice(0,32);
const payload=(sn,sha)=>Buffer.from(`KTLAB-IMZA-v1|${sn}|${sha}`);
const sign=(sn,sha)=>crypto.sign(null,payload(sn,sha),PRIV).toString('base64');
const sigOk=d=>!!d.sig&&crypto.verify(null,payload(d.serial,d.sha256),PUB,Buffer.from(d.sig,'base64'));
for(const d of db.prepare('SELECT id,serial,sha256 FROM docs WHERE sig IS NULL AND sha256 IS NOT NULL').all())db.prepare('UPDATE docs SET sig=? WHERE id=?').run(sign(d.serial,d.sha256),d.id);
const qrUrl=n=>`${BASE_URL}/v/${n}.${mac(KQ,n,12).toString('base64url')}`;
const app=express();app.disable('x-powered-by');app.set('trust proxy',process.env.TRUST_PROXY==='1'?1:false);
app.use(helmet({referrerPolicy:{policy:'no-referrer'},contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'"],imgSrc:["'self'","data:"],objectSrc:["'none'"],frameAncestors:["'none'"],baseUri:["'self'"],formAction:["'self'"],upgradeInsecureRequests:BASE_URL.startsWith('https://')?[]:null}}}));
app.use((q,s,n)=>{if(q.path.startsWith('/api')||q.path==='/admin')s.set('Cache-Control','no-store');n()});app.use(express.json({limit:'10kb'}));
const SEC=process.env.COOKIE_SECURE==='1',SID=SEC?'__Host-sid':'sid',sess=new Set();
const cookie=q=>(q.headers.cookie||'').match(new RegExp('(?:^|; )'+SID+'=([^;]+)'))?.[1]||'';
const auth=(q,s,n)=>{try{const p=jwt.verify(cookie(q),JWT_SECRET,{algorithms:['HS256'],issuer:'kostu'});if(!sess.has(p.jti))throw 0;
 if(q.method!=='GET'){const o=q.headers.origin;if(q.headers['x-requested-with']!=='kostu'||(o&&new URL(o).host!==q.headers.host))return s.sendStatus(403)}
 n()}catch{s.status(401).json({error:'Yetkisiz'})}};

app.post('/api/login',rl({windowMs:9e5,max:5,skipSuccessfulRequests:true,message:{error:'Çok fazla deneme, 15 dk sonra tekrar deneyin'}}),async(q,s)=>{
 const ok=typeof q.body.password==='string'&&q.body.password.length<200&&await bcrypt.compare(q.body.password,hash);log(q,ok?'login':'login_fail');
 if(!ok)return s.status(401).json({error:'Hatalı parola'});
 const jti=crypto.randomUUID();sess.add(jti);
 s.cookie(SID,jwt.sign({jti},JWT_SECRET,{algorithm:'HS256',expiresIn:'8h',issuer:'kostu'}),{httpOnly:true,sameSite:'strict',secure:SEC,path:'/',maxAge:288e5});s.json({ok:1})});
app.post('/api/logout',auth,(q,s)=>{try{sess.delete(jwt.decode(cookie(q)).jti)}catch{}s.clearCookie(SID,{path:'/'});s.json({ok:1})});

const up=multer({dest:DATA_DIR+'/tmp',limits:{fileSize:25e6,files:1}});
const F=['product','brand_model','category','product_serial','test_date','customer','officer'];
function create(q,s,old){
 const f=q.file;
 try{
  if(!f)return s.status(400).json({error:'PDF dosyası gerekli'});
  const buf=fs.readFileSync(f.path),cl=x=>String(x||'').replace(/[\u0000-\u001f\u007f]/g,'').trim(),b=F.map(k=>cl(q.body[k]).slice(0,200)),sm=cl(q.body.summary).slice(0,140);
  if(buf.subarray(0,5).toString()!=='%PDF-'||b.some(x=>!x)||!/^\d{4}-\d{2}-\d{2}$/.test(b[4]))return s.status(400).json({error:'Geçerli bir PDF ve zorunlu alanlar gerekli'});
  const name=crypto.randomUUID()+'.enc',sha=crypto.createHash('sha256').update(buf).digest('hex'),iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',KF,iv);
  fs.writeFileSync(`${DATA_DIR}/pdfs/${name}`,Buffer.concat([iv,c.update(buf),c.final(),c.getAuthTag()]));
  const sn=db.transaction(()=>{
   for(let i=0;;i++){const x=mkSerial();try{
   db.prepare('INSERT INTO docs(serial,token,product,brand_model,category,summary,product_serial,test_date,customer,officer,file,sha256,sig) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(x,crypto.randomBytes(16).toString('base64url'),b[0],b[1],b[2],sm,b[3],b[4],b[5],b[6],name,sha,sign(x,sha));
   if(old)db.prepare("UPDATE docs SET status='invalid',reason='Yeni sürüm yüklendi',new_serial=? WHERE id=?").run(x,old.id);return x}catch(e){if(i>4)throw e}}})();
  log(q,old?'replace':'create',sn);s.json({serial:sn});
 }finally{if(f)fs.rmSync(f.path,{force:true})}
}
app.post('/api/admin/docs',auth,up.single('pdf'),(q,s)=>create(q,s));
app.post('/api/admin/docs/:id/replace',auth,up.single('pdf'),(q,s)=>{const o=db.prepare("SELECT id FROM docs WHERE id=? AND status='valid'").get(q.params.id);o?create(q,s,o):s.status(404).json({error:'Geçerli belge bulunamadı'})});
app.get('/api/admin/docs',auth,(q,s)=>s.json(db.prepare('SELECT id,serial,product,brand_model,category,summary,product_serial,test_date,customer,officer,status,reason,new_serial FROM docs ORDER BY id DESC').all()));
app.get('/api/admin/docs/:id/qr.png',auth,(q,s,n)=>(async()=>{const d=db.prepare('SELECT token,serial FROM docs WHERE id=?').get(q.params.id);if(!d)return s.sendStatus(404);
 s.type('png').set('Content-Disposition',`attachment; filename="${d.serial}.png"`).send(await QR.toBuffer(qrUrl(d.token),{width:800,margin:2,errorCorrectionLevel:'H',color:{dark:'#0F3B57'}}))})().catch(n));
app.post('/api/admin/docs/:id/invalidate',auth,(q,s)=>{const r=String(q.body.reason||'Yönetici tarafından geçersiz kılındı').slice(0,200);
 s.json({n:db.prepare("UPDATE docs SET status='invalid',reason=? WHERE id=? AND status='valid'").run(r,q.params.id).changes});log(q,'invalidate',q.params.id)});
app.delete('/api/admin/docs/:id',auth,(q,s)=>{const d=db.prepare('SELECT file FROM docs WHERE id=?').get(q.params.id);if(!d)return s.sendStatus(404);
 if(d.file)fs.rmSync(`${DATA_DIR}/pdfs/${d.file}`,{force:true});
 db.prepare("UPDATE docs SET reason=CASE WHEN new_serial IS NULL THEN 'Belge silindi' ELSE reason END,status='invalid',file=NULL WHERE id=?").run(q.params.id);log(q,'delete',q.params.id);s.json({ok:1})});

const pub=rl({windowMs:6e4,max:30,message:{error:'Çok fazla sorgu, bir dakika bekleyin'}});
const mask=x=>String(x).split(/\s+/).map(w=>w[0]+'***').join(' ');
const view=d=>{
 if(!d)return{status:'invalid',reason:'Kayıt bulunamadı veya QR kodu geçersiz'};
 if(d.status!=='valid')return{status:'invalid',serial:d.serial,reason:d.reason,new_serial:d.new_serial};
 return{status:'valid',serial:d.serial,product:d.product,brand_model:d.brand_model,category:d.category,summary:d.summary,product_serial:'****'+d.product_serial.slice(-4),test_date:d.test_date,customer:mask(d.customer),officer:d.officer,sha256:d.sha256,signed:sigOk(d),fp:FP,can_dl:!!d.file}};
app.get('/api/verify/:t',pub,(q,s)=>{const[n,sg]=String(q.params.t).slice(0,60).split('.');let ok=false;
 try{const g=Buffer.from(sg||'','base64url');ok=g.length===12&&crypto.timingSafeEqual(mac(KQ,n,12),g)}catch{}
 const d=ok&&db.prepare('SELECT * FROM docs WHERE token=?').get(n);log(q,'verify',d?d.serial:ok?'miss':'forged');s.json(view(d||null))});
app.get('/api/lookup',pub,(q,s)=>{const sn=String(q.query.serial||'').trim().toUpperCase().slice(0,30);
 const d=okSerial(sn)&&db.prepare('SELECT * FROM docs WHERE serial=?').get(sn);log(q,'lookup',d?sn:'miss');s.json(view(d||null))});

const dlim=rl({windowMs:6e4,max:10,message:{error:'Çok fazla deneme, bir dakika bekleyin'}});
app.get('/api/download',dlim,(q,s)=>{
 let d;
 if(q.query.token){const[n,sg]=String(q.query.token).slice(0,60).split('.');let ok=false;
  try{const g=Buffer.from(sg||'','base64url');ok=g.length===12&&crypto.timingSafeEqual(mac(KQ,n,12),g)}catch{}
  d=ok&&db.prepare('SELECT * FROM docs WHERE token=?').get(n)}
 else{const sn=String(q.query.serial||'').trim().toUpperCase().slice(0,30);d=okSerial(sn)&&db.prepare('SELECT * FROM docs WHERE serial=?').get(sn)}
 if(!d||d.status!=='valid'||!d.file){log(q,'dl_miss');return s.status(404).json({error:'Belge bulunamadı veya erişim yok'})}
 try{const e=fs.readFileSync(`${DATA_DIR}/pdfs/${d.file}`),c=crypto.createDecipheriv('aes-256-gcm',KF,e.subarray(0,12));c.setAuthTag(e.subarray(e.length-16));
  const pdf=Buffer.concat([c.update(e.subarray(12,e.length-16)),c.final()]);
  if(crypto.createHash('sha256').update(pdf).digest('hex')!==d.sha256||!sigOk(d))throw 0;
  log(q,'download',d.serial);
  s.set({'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${d.serial}.pdf"`,'X-Kurum-Imza':d.sig,'Cache-Control':'no-store'}).send(pdf)
 }catch{log(q,'dl_integrity',d.serial);s.status(500).json({error:'Belge bütünlüğü doğrulanamadı'})}});
app.get('/api/public-key',(q,s)=>s.json({algorithm:'Ed25519',fingerprint:FP,pem:PUBPEM}));
app.get('/.well-known/kurum-imza.pem',(q,s)=>s.type('text/plain').send(PUBPEM));
app.get('/health',(q,s)=>s.send('ok'));
app.get('/api/admin/audit',auth,(q,s)=>{const rows=db.prepare('SELECT * FROM audit ORDER BY id').all();let p='',ok=true;
 for(const r of rows){if(!r.hash)continue;if(ah(p,r.ts,r.ip,r.action,r.detail)!==r.hash){ok=false;break}p=r.hash}
 s.json({chain_ok:ok,count:rows.length,last:rows.slice(-100).reverse().map(({id,ts,ip,action,detail})=>({id,ts,ip,action,detail}))})});
app.use(express.static(path.join(__dirname,'public')));
app.get('/v/:t',(q,s)=>s.sendFile(path.join(__dirname,'public/index.html')));
app.get('/admin',(q,s)=>s.sendFile(path.join(__dirname,'public/admin.html')));
app.use((e,q,s,n)=>{console.error(e.message);s.status(e.status||(e.name==='MulterError'?400:500)).json({error:'İstek işlenemedi'})});
process.on('unhandledRejection',e=>console.error(e));
app.listen(3000,()=>console.log('Doğrulama sistemi :3000'));
