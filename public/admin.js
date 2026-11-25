const $=s=>document.querySelector(s),J={'Content-Type':'application/json'};
const api=(u,o={})=>fetch(u,{...o,headers:{'X-Requested-With':'kostu',...o.headers}});
async function jsonApi(u,o){const r=await api(u,o);let d={};try{d=await r.json()}catch{}if(!r.ok){const e=new Error(d.error||`İstek başarısız (${r.status})`);e.status=r.status;throw e}return d}
const qrLink=$('#qr-link');
if(qrLink){const host=location.hostname;qrLink.href=['localhost','127.0.0.1','::1','[::1]'].includes(host)?`${location.protocol}//${host}:3001/`:'/qr/'}
const E=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};
const msg=(t,err)=>{const m=$('#m');m.textContent=t||'';m.className='sub '+(err?'bad':'ok');if(t)m.scrollIntoView({block:'center',behavior:'smooth'})};
async function perform(url,options){try{await jsonApi(url,options);await load()}catch(e){if(e.status===401){await load();$('#lm').textContent='Oturum süresi doldu; yeniden giriş yapın.'}else msg(e.message,1)}}
const cell=(r,...n)=>{const c=r.insertCell();c.append(...n);return c};
const btn=(x,c,f)=>{const e=E('button','s '+c,x);e.onclick=f;return e};
const S={sort:'created',dir:'desc',page:1,per:25};
const COLS=[['Seri no','serial'],['Ürün','product'],['Ürün seri no','pserial'],['Müşteri','customer'],['Test tarihi','date'],['Durum','status'],['İşlem',null]];
const FIELDS=['product','brand_model','category','summary','product_serial','test_date','customer','officer'];
const FILTERS=[['q','fq'],['customer','fc'],['category','fk'],['status','fd'],['from','ff'],['to','ft']];
let tm;
function qs(){const p=new URLSearchParams({sort:S.sort,dir:S.dir,page:S.page,per:S.per});FILTERS.forEach(([k,i])=>{const v=$('#'+i).value.trim();if(v)p.set(k,v)});return p}
async function load(){
 try{
 const r=await api('/api/admin/docs?'+qs());
 if(r.status===401){$('#login').hidden=false;$('#panel').hidden=true;$('#lm').textContent='';return}
 if(!r.ok)throw new Error(`Kayıtlar yüklenemedi (${r.status})`);
 $('#login').hidden=true;$('#panel').hidden=false;$('#lm').textContent='';
 const D=await r.json();S.page=D.page;
 const k=$('#fk'),cur=k.value;
 if(k.options.length-1!==D.categories.length){k.replaceChildren(new Option('Tüm türler',''),...D.categories.map(c=>new Option(c,c)));k.value=cur}
 $('#fi').textContent=`${D.total} kayıt`;
 const t=$('#t');t.replaceChildren();t.append(E('caption','sr-only','Test raporları'));const h=t.insertRow();
 COLS.forEach(([n,c])=>{const th=E('th');th.scope='col';
  if(c){th.setAttribute('aria-sort',S.sort===c?(S.dir==='asc'?'ascending':'descending'):'none');
   const sort=E('button','sort-button',n+(S.sort===c?(S.dir==='asc'?' ▲':' ▼'):''));sort.type='button';
   sort.onclick=()=>{S.dir=S.sort===c&&S.dir==='desc'?'asc':'desc';S.sort=c;S.page=1;load()};th.append(sort)
  }else th.textContent=n;
  h.append(th)});
 if(!D.rows.length)cell(t.insertRow(),'Kayıt bulunamadı').colSpan=COLS.length;
 D.rows.forEach(d=>{const w=t.insertRow(),v=d.status==='valid';
  cell(w,E('code','',d.serial));
  cell(w,E('b','',d.product),E('br'),`${d.brand_model} · ${d.category}`);
  cell(w,d.product_serial);cell(w,d.customer);cell(w,d.test_date);
  cell(w,E('span','tag'+(v?'':' bad'),v?'Geçerli':'Geçersiz: '+(d.reason||'')));
  const a=cell(w);
  if(v){a.append(
   btn('Yeni sürüm','',()=>{const f=$('#nf');f.dataset.replace=d.id;FIELDS.forEach(k=>f[k].value=d[k]);f.qr_token.value='';$('#sb').textContent='Yeni sürümü yükle ('+d.serial+')';msg('Yeni sürüm modu: QR üreticisinden yeni QR alıp rapora ekleyin.');scrollTo(0,0)}),
   btn('Geçersiz kıl','r',async()=>{const reason=prompt('Geçersizlik nedeni?');if(reason===null)return;await perform(`/api/admin/docs/${d.id}/invalidate`,{method:'POST',headers:J,body:JSON.stringify({reason})})}))}
  a.append(btn('Sil','r',async()=>{if(confirm('Silinsin mi? QR geçersiz sayfasına düşer.'))await perform('/api/admin/docs/'+d.id,{method:'DELETE'})}))});
 const pg=$('#pg');pg.replaceChildren();
 const mk=(x,p)=>{const b=btn(x,'',()=>{S.page=p;load()});b.disabled=p<1||p>D.pages;return b};
 pg.append(mk('‹ Önceki',D.page-1),E('span','',`Sayfa ${D.page} / ${D.pages}`),mk('Sonraki ›',D.page+1))
 }catch(e){if(!$('#panel').hidden)$('#fi').textContent='Kayıtlar yüklenemedi: '+e.message;else $('#lm').textContent='Kayıtlar yüklenemedi: '+e.message}
}
['fq','fc'].forEach(i=>$('#'+i).oninput=()=>{clearTimeout(tm);tm=setTimeout(()=>{S.page=1;load()},300)});
['fk','fd','ff','ft'].forEach(i=>$('#'+i).onchange=()=>{S.page=1;load()});
$('#fr').onclick=()=>{FILTERS.forEach(([k,i])=>$('#'+i).value='');S.sort='created';S.dir='desc';S.page=1;load()};
$('#lf').onsubmit=async e=>{e.preventDefault();const b=$('#lf button');b.disabled=true;$('#lm').textContent='';
 try{await jsonApi('/api/login',{method:'POST',headers:J,body:JSON.stringify({password:$('#pw').value})});$('#pw').value='';msg();await load()}
 catch(x){$('#lm').textContent=x.message}finally{b.disabled=false}};
$('#nf').onsubmit=async e=>{e.preventDefault();const f=e.target,id=f.dataset.replace,b=$('#sb'),t0=b.textContent;
 b.disabled=true;b.textContent='Yükleniyor…';msg('');
 try{const r=await api(id?`/api/admin/docs/${id}/replace`:'/api/admin/docs',{method:'POST',body:new FormData(f)});
  let d;try{d=await r.json()}catch{d={error:'Beklenmeyen sunucu yanıtı'}}
  if(r.ok){msg(`Oluşturuldu: ${d.serial}`);
   f.reset();delete f.dataset.replace;b.textContent='Yükle ve seri no oluştur';load()}
  else{b.textContent=t0;if(r.status===401){await load();$('#lm').textContent='Oturum süresi doldu; yeniden giriş yapın.'}else msg(`Hata (${r.status}): ${d.error||'bilinmeyen hata'}`,1)}
 }catch(x){b.textContent=t0;msg('Bağlantı hatası: '+x.message,1)}finally{b.disabled=false}};
$('#lo').onclick=async()=>{try{await jsonApi('/api/logout',{method:'POST'});location.reload()}catch(e){msg(e.message,1)}};
load();
