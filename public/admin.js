const $=s=>document.querySelector(s),J={'Content-Type':'application/json'};
const api=(u,o={})=>fetch(u,{...o,headers:{'X-Requested-With':'kostu',...o.headers}});
const E=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};
const msg=(t,err)=>{const m=$('#m');m.textContent=t||'';m.className='sub '+(err?'bad':'ok');if(t)m.scrollIntoView({block:'center',behavior:'smooth'})};
const cell=(r,...n)=>{const c=r.insertCell();c.append(...n);return c};
const btn=(x,c,f)=>{const e=E('button','s '+c,x);e.onclick=f;return e};
const S={sort:'created',dir:'desc',page:1,per:25};
const COLS=[['Seri no','serial'],['Ürün','product'],['Ürün seri no','pserial'],['Gönderim no','ship'],['Müşteri','customer'],['Test tarihi','date'],['Durum','status'],['İşlem',null]];
const FIELDS=['product','brand_model','category','summary','product_serial','test_date','customer','officer','ship_no'];
const FILTERS=[['q','fq'],['ship','fs'],['customer','fc'],['category','fk'],['status','fd'],['from','ff'],['to','ft']];
let tm;
function qs(){const p=new URLSearchParams({sort:S.sort,dir:S.dir,page:S.page,per:S.per});FILTERS.forEach(([k,i])=>{const v=$('#'+i).value.trim();if(v)p.set(k,v)});return p}
async function load(withCust){
 const r=await api('/api/admin/docs?'+qs());
 if(r.status===401){$('#login').hidden=false;$('#panel').hidden=true;return}
 $('#login').hidden=true;$('#panel').hidden=false;if(withCust)cust();
 const D=await r.json();S.page=D.page;
 const k=$('#fk'),cur=k.value;
 if(k.options.length-1!==D.categories.length){k.replaceChildren(new Option('Tüm türler',''),...D.categories.map(c=>new Option(c,c)));k.value=cur}
 $('#fi').textContent=`${D.total} kayıt`;
 const t=$('#t');t.replaceChildren();const h=t.insertRow();
 COLS.forEach(([n,c])=>{const th=E('th','',n+(c&&S.sort===c?(S.dir==='asc'?' ▲':' ▼'):''));
  if(c){th.style.cursor='pointer';th.title='Sırala';th.onclick=()=>{S.dir=S.sort===c&&S.dir==='desc'?'asc':'desc';S.sort=c;S.page=1;load()}}h.append(th)});
 if(!D.rows.length)cell(t.insertRow(),'Kayıt bulunamadı').colSpan=COLS.length;
 D.rows.forEach(d=>{const w=t.insertRow(),v=d.status==='valid';
  cell(w,E('code','',d.serial));
  cell(w,E('b','',d.product),E('br'),`${d.brand_model} · ${d.category}`);
  cell(w,d.product_serial);cell(w,d.ship_no||'—');cell(w,d.customer);cell(w,d.test_date);
  cell(w,E('span','tag'+(v?'':' bad'),v?'Geçerli':'Geçersiz: '+(d.reason||'')));
  const a=cell(w);
  if(v){const q=E('a','s','QR indir');q.href=`/api/admin/docs/${d.id}/qr.png`;a.append(q,
   btn('Yeni sürüm','',()=>{const f=$('#nf');f.dataset.replace=d.id;FIELDS.forEach(k=>f[k].value=d[k]);$('#sb').textContent='Yeni sürümü yükle ('+d.serial+')';msg('Yeni sürüm modu: PDF seçip gönderin.');scrollTo(0,0)}),
   btn('Geçersiz kıl','r',async()=>{const reason=prompt('Geçersizlik nedeni?');if(reason===null)return;await api(`/api/admin/docs/${d.id}/invalidate`,{method:'POST',headers:J,body:JSON.stringify({reason})});load()}))}
  a.append(btn('Sil','r',async()=>{if(confirm('Silinsin mi? QR geçersiz sayfasına düşer.')){await api('/api/admin/docs/'+d.id,{method:'DELETE'});load()}}))});
 const pg=$('#pg');pg.replaceChildren();
 const mk=(x,p)=>{const b=btn(x,'',()=>{S.page=p;load()});b.disabled=p<1||p>D.pages;return b};
 pg.append(mk('‹ Önceki',D.page-1),E('span','',`Sayfa ${D.page} / ${D.pages}`),mk('Sonraki ›',D.page+1))}
['fq','fs','fc'].forEach(i=>$('#'+i).oninput=()=>{clearTimeout(tm);tm=setTimeout(()=>{S.page=1;load()},300)});
['fk','fd','ff','ft'].forEach(i=>$('#'+i).onchange=()=>{S.page=1;load()});
$('#fr').onclick=()=>{FILTERS.forEach(([k,i])=>$('#'+i).value='');S.sort='created';S.dir='desc';S.page=1;load()};
$('#lf').onsubmit=async e=>{e.preventDefault();const r=await api('/api/login',{method:'POST',headers:J,body:JSON.stringify({password:$('#pw').value})});$('#pw').value='';if(r.ok){msg();load(true)}else msg((await r.json()).error,1)};
$('#nf').onsubmit=async e=>{e.preventDefault();const f=e.target,id=f.dataset.replace,b=$('#sb'),t0=b.textContent;
 b.disabled=true;b.textContent='Yükleniyor…';msg('');
 try{const r=await api(id?`/api/admin/docs/${id}/replace`:'/api/admin/docs',{method:'POST',body:new FormData(f)});
  let d;try{d=await r.json()}catch{d={error:'Beklenmeyen sunucu yanıtı'}}
  if(r.ok){msg(`Oluşturuldu: ${d.serial}`+(d.password?` · Yeni müşteri parolası: ${d.password} (yalnızca şimdi görünür; müşteriye iletin)`:' · Müşterinin mevcut parolası geçerli'));
   f.reset();delete f.dataset.replace;b.textContent='Yükle ve QR oluştur';load(true)}
  else{b.textContent=t0;if(r.status===401){msg('Oturum süresi doldu, yeniden giriş yapın.',1);load()}else msg(`Hata (${r.status}): ${d.error||'bilinmeyen hata'}`,1)}
 }catch(x){b.textContent=t0;msg('Bağlantı hatası: '+x.message,1)}finally{b.disabled=false}};
load(true);
async function cust(){
 const r=await api('/api/admin/customers');if(!r.ok)return;const l=await r.json(),t=$('#ct');t.replaceChildren();
 $('#cu').replaceChildren(...l.map(c=>{const o=E('option');o.value=c.name;return o}));
 const h=t.insertRow();['Müşteri','Belge','Parola','İşlem'].forEach(x=>h.append(E('th','',x)));
 l.forEach(c=>{const w=t.insertRow();cell(w,c.name);cell(w,String(c.n));pwCell(w,c);
  cell(w,btn('Parolayı yenile','r',async()=>{if(!confirm(c.name+' için yeni parola üretilsin? Eskisi geçersiz olur.'))return;
   const r=await api(`/api/admin/customers/${c.id}/reset`,{method:'POST'}),d=await r.json();
   msg(r.ok?`${c.name} yeni parola: ${d.password} (yalnızca şimdi görünür)`:d.error)}))})}
function pwCell(w,c){const sp=E('code','','••••');sp.style.marginRight='8px';
 const b=btn('Göster','',async()=>{
  if(sp.dataset.v){sp.textContent='••••';delete sp.dataset.v;b.textContent='Göster';return}
  const r=await api(`/api/admin/customers/${c.id}/password`),d=await r.json();
  if(!d.password){sp.textContent='Kayıtlı değil, yenileyin';return}
  sp.textContent=d.password;sp.dataset.v=1;b.textContent='Gizle'});
 cell(w,sp,b)}
