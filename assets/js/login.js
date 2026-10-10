(() => {
  const form=document.querySelector("#login-form"), notice=document.querySelector("#notice");
  function show(message,error=false){notice.textContent=message;notice.hidden=false;notice.classList.toggle("error",error)}
  fetch("/api/session",{credentials:"same-origin"}).then(r=>r.json()).then(data=>{if(data.user) location.href=data.user.role==="admin"?"/admin/":"/client/";}).catch(()=>{});
  form.addEventListener("submit",async event=>{
    event.preventDefault();
    const button=form.querySelector("button");button.disabled=true;button.textContent="Memeriksa...";
    try{
      const response=await fetch("/api/login",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:form.email.value,password:form.password.value})});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Login gagal.");
      location.href=data.user.role==="admin"?"/admin/":"/client/";
    }catch(error){show(error.message||"Tidak dapat menghubungi server.",true);}
    finally{button.disabled=false;button.textContent="Masuk ke dashboard";}
  });
})();
