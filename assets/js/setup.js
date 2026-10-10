(() => {
  const form=document.querySelector("#setup-form"),notice=document.querySelector("#notice");
  function show(message,error=false){notice.textContent=message;notice.hidden=false;notice.classList.toggle("error",error)}
  form.addEventListener("submit",async event=>{
    event.preventDefault();const button=form.querySelector("button");button.disabled=true;
    try{
      const response=await fetch("/api/setup",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({secret:form.secret.value,fullName:form.fullName.value,email:form.email.value,password:form.password.value})});
      const data=await response.json();if(!response.ok)throw new Error(data.error||"Setup gagal.");
      location.href="/admin/";
    }catch(error){show(error.message||"Tidak dapat menghubungi server.",true);}
    finally{button.disabled=false;}
  });
})();
