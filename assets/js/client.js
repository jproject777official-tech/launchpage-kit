(() => {
  const $=s=>document.querySelector(s),notice=$("#notice");
  let sites=[],current=null,domains=[];
  function show(message,error=false){notice.textContent=message;notice.hidden=false;notice.classList.toggle("error",error)}
  async function api(path,options={}){const response=await fetch("/api/"+path,{credentials:"same-origin",...options,headers:{"Content-Type":"application/json",...(options.headers||{})}});const data=await response.json().catch(()=>({}));if(response.status===401){location.href="/login/";throw new Error("Silakan login kembali.");}if(!response.ok)throw new Error(data.error||"Permintaan gagal.");return data;}
  function node(tag,text,cls){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el}
  function table(rows){if(!rows.length)return node("div","Belum ada domain yang dicatat.","console-empty");const t=node("table",undefined,"console-table"),thead=node("thead"),hr=node("tr");["Domain","Website","Status","Kedaluwarsa"].forEach(v=>hr.append(node("th",v)));thead.append(hr);t.append(thead);const tb=node("tbody");rows.forEach(d=>{const tr=node("tr");[d.hostname,d.site_name,d.status,d.expires_on||"Belum dicatat"].forEach(v=>tr.append(node("td",v)));tb.append(tr);});t.append(tb);return t}
  function fill(form,content){for(const key of ["title","subtitle","description","phone","email","address","primaryColor","ctaText"])form.elements[key].value=content?.[key]||"";}
  async function loadSite(id){const result=await api("sites/"+id);current=result.site;fill($("#content-form"),current.content);$("#site-meta").textContent="Status: "+current.status+" · Paket: "+current.planName+" · Diperbarui: "+current.updatedAt;$("#preview-link").href="/p/"+encodeURIComponent(current.slug);}
  async function load(){
    try{
      const session=await api("session");if(!session.user){location.href="/login/";return;}if(session.user.role!=="client"){location.href="/admin/";return;}
      $("#whoami").textContent=session.user.fullName;
      const dash=await api("dashboard");
      if(dash.mustChangePassword){$("#password-panel").hidden=false;$("#client-content").hidden=true;return;}
      $("#password-panel").hidden=true;$("#client-content").hidden=false;
      sites=dash.sites||[];domains=dash.domains||[];
      const select=$("#site-select"),domainSelect=$("#domain-site-select");select.replaceChildren();domainSelect.replaceChildren();
      sites.forEach(s=>{select.add(new Option(s.name+" · "+s.status,s.id));domainSelect.add(new Option(s.name,s.id));});
      if(!sites.length){$("#site-meta").textContent="Belum ada website yang ditautkan ke akun ini. Hubungi admin RuangWeb.";$("#content-form").hidden=true;show("Akun aktif, tetapi website belum dibuat oleh admin RuangWeb.");}
      else{ $("#content-form").hidden=false;await loadSite(sites[0].id); }
      $("#domains-table").replaceChildren(table(domains));
    }catch(e){show(e.message||"Gagal memuat panel.",true);}
  }
  $("#site-select").addEventListener("change",async e=>{try{await loadSite(e.target.value);}catch(err){show(err.message,true);}});
  $("#content-form").addEventListener("submit",async e=>{e.preventDefault();if(!current)return;const f=e.currentTarget,b=f.querySelector("button[type=submit]");b.disabled=true;try{const data=Object.fromEntries(new FormData(f));const result=await api("sites/"+current.id,{method:"PATCH",body:JSON.stringify({content:data})});show(current.status==="published"?"Perubahan berhasil disimpan dan tampil pada website yang sudah terbit.":"Perubahan berhasil disimpan. Website masih draft dan perlu diterbitkan oleh admin RuangWeb.");fill(f,result.content);await loadSite(current.id);}catch(err){show(err.message,true);}finally{b.disabled=false;}});
  $("#domain-form").addEventListener("submit",async e=>{e.preventDefault();const f=e.currentTarget,b=f.querySelector("button");b.disabled=true;try{const data=Object.fromEntries(new FormData(f));const result=await api("domains",{method:"POST",body:JSON.stringify(data)});show("Domain tercatat sebagai permintaan. DNS dan SSL belum otomatis berubah; admin RuangWeb akan menindaklanjuti.");f.reset();await load();}catch(err){show(err.message,true);}finally{b.disabled=false;}});
  $("#password-form").addEventListener("submit",async e=>{e.preventDefault();try{await api("change-password",{method:"POST",body:JSON.stringify({password:e.currentTarget.password.value})});show("Kata sandi berhasil diganti.");await load();}catch(err){show(err.message,true);}});
  $("#logout").addEventListener("click",async()=>{try{await api("logout",{method:"POST",body:"{}"});}finally{location.href="/login/";}});
  load();
})();
