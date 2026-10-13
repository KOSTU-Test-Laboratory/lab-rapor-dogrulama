const $=s=>document.querySelector(s),L=[['Seri No','serial'],['Ürün adı','product'],['Marka / Model','brand_model'],['Ürün türü','category'],['Özet','summary'],['Ürün seri no','product_serial'],['Test tarihi','test_date'],['Müşteri','customer'],['Test sorumlusu','officer'],['PDF SHA-256','sha256']];
const E=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};
async function show(u,ref){const r=$('#r');r.replaceChildren();let d;
 try{d=await(await fetch(u)).json()}catch{d={error:'Bağlantı hatası'}}
 if(d.error||!d.status)d={status:'invalid',reason:d.error||'Beklenmeyen yanıt'};
 const ok=d.status==='valid',c=E('div','card st '+(ok?'ok':'bad'));
 c.insertAdjacentHTML('beforeend',`<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="42"/><path d="${ok?'M30 52l14 14 27-30':'M33 33l34 34M67 33L33 67'}"/></svg>`);
 c.append(E('h2','',ok?'Belge geçerli':'Belge geçersiz'));
 if(ok){const dl=E('dl');L.forEach(([k,f],i)=>{const w=E('div');w.style.animationDelay=(.9+i*.12)+'s';w.append(E('dt','',k),E('dd','',d[f]||'—'));dl.append(w)});c.append(dl);extra(c,d,ref)}
 else{c.append(E('p','',d.reason||''));if(d.serial)c.append(E('p','',d.serial));if(d.new_serial)c.append(E('p','','Güncel sürüm: '+d.new_serial))}
 r.append(c)}
const m=location.pathname.match(/^\/v\/([\w.-]+)/);if(m)show('/api/verify/'+m[1],{token:m[1]});
$('#f').onsubmit=e=>{e.preventDefault();const v=$('#s').value;show('/api/lookup?serial='+encodeURIComponent(v),{serial:v})};

function extra(c,d,ref){
 if(d.signed)c.append(E('p','ok','✓ Kurum dijital imzası doğrulandı · Anahtar: '+d.fp.slice(0,12)));
 const s=E('div','acc');c.append(s);s.append(E('h3','','Orijinal belgeye eriş'));
 if(!d.can_dl){s.append(E('p','sub','Bu belge için çevrimiçi erişim tanımlı değil. Lütfen laboratuvarla iletişime geçin.'));return}
 const w=E('div','row'),v=E('button','','Görüntüle'),dn=E('button','s2','İndir'),m=E('p','bad'),bs=[v,dn];
 v.style.width=dn.style.width='auto';
 v.onclick=()=>getDoc(d,ref,bs,m,1);dn.onclick=()=>getDoc(d,ref,bs,m,0);
 s.append(E('p','sub','Seri no/QR içermeyen orijinal PDF’e buradan erişebilirsiniz.'),w,m);w.append(v,dn)}
async function getDoc(d,ref,bs,m,view){
 m.textContent='';
 const w=view?window.open('','_blank'):null;bs.forEach(b=>b.disabled=true);
 try{const r=await fetch('/api/download?'+new URLSearchParams(ref));
  if(!r.ok){if(w)w.close();m.textContent=(await r.json()).error||'Hata';return}
  const u=URL.createObjectURL(await r.blob());
  if(view&&w)w.location=u;else{const a=E('a');a.href=u;a.download=d.serial+'.pdf';a.click()}
  setTimeout(()=>URL.revokeObjectURL(u),6e4)
 }catch{if(w)w.close();m.textContent='Bağlantı hatası'}finally{bs.forEach(b=>b.disabled=false)}}
