const $=s=>document.querySelector(s),J={'Content-Type':'application/json'};
const api=(u,o={})=>fetch(u,{...o,headers:{'X-Requested-With':'kostu',...o.headers}});
const E=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};
const msg=t=>$('#m').textContent=t||'';
const cell=(r,...n)=>{const c=r.insertCell();c.append(...n);return c};
const btn=(x,c,f)=>{const e=E('button','s '+c,x);e.onclick=f;return e};
async function load(){
 const r=await api('/api/admin/docs');
 if(r.status===401){$('#login').hidden=false;$('#panel').hidden=true;return}
 $('#login').hidden=true;$('#panel').hidden=false;const t=$('#t');t.replaceChildren();
 const h=t.insertRow();['Seri no','Ürün','Müşteri','Durum','İşlem'].forEach(x=>h.append(E('th','',x)));
 (await r.json()).forEach(d=>{const w=t.insertRow(),v=d.status==='valid';
  cell(w,d.serial);cell(w,`${d.product} ${d.brand_model}`);cell(w,d.customer);
  cell(w,E('span','tag'+(v?'':' bad'),v?'Geçerli':'Geçersiz: '+(d.reason||'')));
  const a=cell(w);
  if(v){const q=E('a','s','QR indir');q.href=`/api/admin/docs/${d.id}/qr.png`;a.append(q,
   btn('Yeni sürüm','',()=>{const f=$('#nf');f.dataset.replace=d.id;['product','brand_model','category','summary','product_serial','test_date','customer','officer'].forEach(k=>f[k].value=d[k]);$('#sb').textContent='Yeni sürümü yükle ('+d.serial+')';msg('Yeni sürüm modu: PDF seçip gönderin.');scrollTo(0,0)}),
   btn('Geçersiz kıl','r',async()=>{const reason=prompt('Geçersizlik nedeni?');if(reason===null)return;await api(`/api/admin/docs/${d.id}/invalidate`,{method:'POST',headers:J,body:JSON.stringify({reason})});load()}))}
  a.append(btn('Sil','r',async()=>{if(confirm('Silinsin mi? QR geçersiz sayfasına düşer.')){await api('/api/admin/docs/'+d.id,{method:'DELETE'});load()}}))})}
$('#lf').onsubmit=async e=>{e.preventDefault();const r=await api('/api/login',{method:'POST',headers:J,body:JSON.stringify({password:$('#pw').value})});$('#pw').value='';if(r.ok){msg();load()}else msg((await r.json()).error)};
$('#nf').onsubmit=async e=>{e.preventDefault();const f=e.target,id=f.dataset.replace;
 const r=await api(id?`/api/admin/docs/${id}/replace`:'/api/admin/docs',{method:'POST',body:new FormData(f)}),d=await r.json();
 msg(r.ok?`Oluşturuldu: ${d.serial}`:d.error);if(r.ok){f.reset();delete f.dataset.replace;$('#sb').textContent='Yükle ve QR oluştur';load()}};
load();
