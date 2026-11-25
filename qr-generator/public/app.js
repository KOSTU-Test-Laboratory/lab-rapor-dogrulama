const $=s=>document.querySelector(s),headers={'X-Requested-With':'kostu-qr'};
async function request(url,options){return fetch(url,{...options,headers:{...headers,...options.headers}})}
function showPanel(){ $('#login-card').hidden=true;$('#panel').hidden=false }
$('#login').onsubmit=async e=>{
 e.preventDefault();const button=e.submitter;button.disabled=true;$('#login-error').textContent='';
 try{const r=await request('api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:$('#password').value})});
  if(!r.ok)throw new Error((await r.json()).error||'Giriş başarısız');
  $('#password').value='';showPanel()
 }catch(x){$('#login-error').textContent=x.message}finally{button.disabled=false}
};
request('api/session').then(r=>{if(r.ok)showPanel()}).catch(()=>{});
$('#generate').onsubmit=async e=>{
 e.preventDefault();const button=$('#generate-button');button.disabled=true;$('#error').textContent='';$('#result').hidden=true;
 try{const r=await request('api/qr',{method:'POST',body:new FormData(e.target)}),d=await r.json();
  if(!r.ok)throw new Error(d.error||'QR oluşturulamadı');
  $('#token').textContent=d.token;$('#qr').src=d.image;$('#download').href=d.image;$('#result').hidden=false
 }catch(x){$('#error').textContent=x.message}finally{button.disabled=false}
};
$('#copy').onclick=async()=>{try{await navigator.clipboard.writeText($('#token').textContent)}catch{$('#error').textContent='Token kopyalanamadı; metni elle kopyalayın.'}};
$('#logout').onclick=async()=>{await request('api/logout',{method:'POST'});location.reload()};
