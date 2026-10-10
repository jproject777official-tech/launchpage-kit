const COOKIE_NAME = "rw_session";
const SESSION_SECONDS = 60 * 60 * 24 * 7;
const PBKDF2_ITERATIONS = 310000;
const encoder = new TextEncoder();

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers }
  });
}
function fail(message, status = 400) { return json({ error: message }, status); }
function uuid() { return crypto.randomUUID(); }
function randomToken(bytes = 32) {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, "0")).join("");
}
async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}
async function hashPassword(password, saltHex = randomToken(16)) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: Uint8Array.from(saltHex.match(/.{2}/g), b => parseInt(b, 16)), iterations: PBKDF2_ITERATIONS, hash: "SHA-256" }, key, 256);
  return { salt: saltHex, hash: Array.from(new Uint8Array(bits), b => b.toString(16).padStart(2, "0")).join("") };
}
async function verifyPassword(password, salt, expected) {
  const actual = await hashPassword(password, salt);
  return actual.hash === expected;
}
function cookie(value, maxAge) {
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
function clearCookie() { return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`; }
function getCookie(request, name) {
  const raw = request.headers.get("Cookie") || "";
  const item = raw.split(";").map(v => v.trim()).find(v => v.startsWith(name + "="));
  return item ? item.slice(name.length + 1) : "";
}
function safeOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}
async function body(request) {
  try { return await request.json(); } catch { return null; }
}
function validEmail(email) { return typeof email === "string" && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
function validPassword(pw) { return typeof pw === "string" && pw.length >= 12 && pw.length <= 200; }
function cleanText(value, max = 160) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function validSlug(value) { return /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/.test(value || ""); }
function validHostname(value) {
  if (typeof value !== "string" || value.length > 253) return false;
  const host = value.toLowerCase().replace(/\.$/, "");
  if (host.includes("://") || host.includes("/") || host.includes("@") || host.includes(":")) return false;
  return host.includes(".") && host.split(".").every(part => part.length > 0 && part.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(part));
}
async function log(db, actor, action, entityType, entityId, details = {}) {
  await db.prepare("INSERT INTO audit_logs (id,actor_user_id,action,entity_type,entity_id,details_json) VALUES (?,?,?,?,?,?)")
    .bind(uuid(), actor || null, action, entityType, entityId || null, JSON.stringify(details)).run();
}
async function getUser(request, env) {
  const token = getCookie(request, COOKIE_NAME);
  if (!token) return null;
  const tokenHash = await sha256(token);
  const row = await env.DB.prepare("SELECT u.id,u.email,u.full_name,u.role,u.status,u.must_change_password,s.id AS session_id FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? LIMIT 1")
    .bind(tokenHash, Math.floor(Date.now() / 1000)).first();
  if (!row || row.status !== "active") return null;
  return row;
}
function publicUser(user) {
  return { id: user.id, email: user.email, fullName: user.full_name, role: user.role, mustChangePassword: Boolean(user.must_change_password) };
}
async function requireUser(request, env) {
  const user = await getUser(request, env);
  return user ? { user } : { response: fail("Silakan login kembali.", 401) };
}
async function requireAdmin(request, env) {
  const result = await requireUser(request, env);
  if (result.response) return result;
  if (result.user.role !== "admin") return { response: fail("Akses admin utama diperlukan.", 403) };
  if (result.user.must_change_password) return { response: fail("Ganti kata sandi sebelum melanjutkan.", 403) };
  return result;
}
async function ownedSite(db, user, siteId) {
  if (user.role === "admin") return db.prepare("SELECT s.*,c.business_name,c.id AS owner_client_id FROM sites s JOIN clients c ON c.id=s.client_id WHERE s.id=?").bind(siteId).first();
  return db.prepare("SELECT s.*,c.business_name,c.id AS owner_client_id FROM sites s JOIN clients c ON c.id=s.client_id WHERE s.id=? AND c.user_id=?").bind(siteId, user.id).first();
}
function parsePath(url) {
  return url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
}
async function issueSession(db, userId) {
  const token = randomToken(32);
  await db.prepare("INSERT INTO sessions (id,user_id,token_hash,expires_at) VALUES (?,?,?,?)")
    .bind(uuid(), userId, await sha256(token), Math.floor(Date.now() / 1000) + SESSION_SECONDS).run();
  return token;
}
async function api(request, env) {
  if (!env.DB) return fail("Database belum dikonfigurasi. Ikuti docs/PLATFORM_SETUP.md.", 503);
  const url = new URL(request.url);
  const parts = parsePath(url);
  const route = parts.join("/");
  const method = request.method.toUpperCase();

  if (method === "GET" && route === "health") return json({ ok: true, service: "RuangWeb API", databaseConfigured: true });
  if (["POST","PUT","PATCH","DELETE"].includes(method) && !safeOrigin(request)) return fail("Origin tidak valid.", 403);

  if (method === "POST" && route === "setup") {
    const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin'").first();
    if (Number(count?.n || 0) > 0) return fail("Setup admin utama sudah digunakan.", 409);
    if (!env.BOOTSTRAP_SECRET || env.BOOTSTRAP_SECRET.length < 32) return fail("Secret setup belum dikonfigurasi dengan benar.", 503);
    const data = await body(request);
    if (!data || typeof data.secret !== "string" || data.secret !== env.BOOTSTRAP_SECRET) return fail("Secret setup tidak valid.", 403);
    const email = cleanText(data.email, 254).toLowerCase();
    const fullName = cleanText(data.fullName, 100);
    if (!validEmail(email) || !fullName || !validPassword(data.password)) return fail("Isi nama, email valid, dan kata sandi minimal 12 karakter.");
    const pass = await hashPassword(data.password);
    const id = uuid();
    try {
      await env.DB.prepare("INSERT INTO users (id,email,full_name,role,password_hash,password_salt) VALUES (?,?,?,'admin',?,?)").bind(id,email,fullName,pass.hash,pass.salt).run();
    } catch { return fail("Admin gagal dibuat. Periksa apakah email sudah digunakan.", 409); }
    await log(env.DB,id,"admin_bootstrapped","user",id,{email});
    const token = await issueSession(env.DB,id);
    return json({ user: {id,email,fullName,role:"admin",mustChangePassword:false} }, 201, { "Set-Cookie": cookie(token, SESSION_SECONDS) });
  }

  if (method === "POST" && route === "login") {
    const data = await body(request);
    const email = cleanText(data?.email,254).toLowerCase();
    if (!validEmail(email) || typeof data?.password !== "string") return fail("Email atau kata sandi tidak valid.", 400);
    const user = await env.DB.prepare("SELECT * FROM users WHERE email=? LIMIT 1").bind(email).first();
    if (!user || user.status !== "active" || !(await verifyPassword(data.password,user.password_salt,user.password_hash))) {
      return fail("Email atau kata sandi salah.", 401);
    }
    await env.DB.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(Math.floor(Date.now()/1000)).run();
    const token = await issueSession(env.DB,user.id);
    await log(env.DB,user.id,"login","user",user.id);
    return json({ user: publicUser(user) },200,{"Set-Cookie":cookie(token,SESSION_SECONDS)});
  }

  if (method === "GET" && route === "session") {
    const user = await getUser(request,env);
    return user ? json({user:publicUser(user)}) : json({user:null},200,{"Set-Cookie":clearCookie()});
  }
  if (method === "POST" && route === "logout") {
    const token = getCookie(request,COOKIE_NAME);
    if (token) await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await sha256(token)).run();
    return json({ok:true},200,{"Set-Cookie":clearCookie()});
  }
  if (method === "POST" && route === "change-password") {
    const result = await requireUser(request,env);
    if (result.response) return result.response;
    const data = await body(request);
    if (!validPassword(data?.password)) return fail("Kata sandi baru minimal 12 karakter.");
    const pass = await hashPassword(data.password);
    await env.DB.prepare("UPDATE users SET password_hash=?,password_salt=?,must_change_password=0,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(pass.hash,pass.salt,result.user.id).run();
    await env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(result.user.id).run();
    const token = await issueSession(env.DB,result.user.id);
    await log(env.DB,result.user.id,"password_changed","user",result.user.id);
    return json({ok:true},200,{"Set-Cookie":cookie(token,SESSION_SECONDS)});
  }

  if (method === "GET" && route === "me") {
    const result = await requireUser(request,env);
    if (result.response) return result.response;
    return json({user:publicUser(result.user)});
  }

  if (method === "GET" && route === "dashboard") {
    const result = await requireUser(request,env);
    if (result.response) return result.response;
    if (result.user.must_change_password) return fail("Ganti kata sandi sebelum melanjutkan.",403);
    if (result.user.role === "admin") {
      const stats = await env.DB.prepare("SELECT (SELECT COUNT(*) FROM clients) AS clients,(SELECT COUNT(*) FROM sites) AS sites,(SELECT COUNT(*) FROM sites WHERE status='published') AS published,(SELECT COUNT(*) FROM domains WHERE status!='removed') AS domains,(SELECT COUNT(*) FROM domains WHERE status IN ('pending','verification_needed','dns_pending','ssl_pending')) AS domain_attention").first();
      const sites = await env.DB.prepare("SELECT s.id,s.name,s.slug,s.status,s.plan_name,s.template_key,s.updated_at,c.business_name,c.id AS client_id FROM sites s JOIN clients c ON c.id=s.client_id ORDER BY s.created_at DESC LIMIT 100").all();
      const domains = await env.DB.prepare("SELECT d.*,s.name AS site_name,c.business_name FROM domains d JOIN sites s ON s.id=d.site_id JOIN clients c ON c.id=s.client_id ORDER BY d.created_at DESC LIMIT 100").all();
      return json({user:publicUser(result.user),stats,sites:sites.results,domains:domains.results});
    }
    const client = await env.DB.prepare("SELECT * FROM clients WHERE user_id=?").bind(result.user.id).first();
    if (!client) return json({user:publicUser(result.user),client:null,sites:[],domains:[]});
    const sites = await env.DB.prepare("SELECT id,name,slug,status,plan_name,template_key,content_json,updated_at FROM sites WHERE client_id=? ORDER BY created_at DESC").bind(client.id).all();
    const domains = await env.DB.prepare("SELECT d.*,s.name AS site_name FROM domains d JOIN sites s ON s.id=d.site_id WHERE s.client_id=? ORDER BY d.created_at DESC").bind(client.id).all();
    return json({user:publicUser(result.user),client:{id:client.id,businessName:client.business_name,clientType:client.client_type,phone:client.phone},sites:sites.results.map(s=>({...s,content:parseJson(s.content_json)})),domains:domains.results});
  }

  if (method === "GET" && route === "clients") {
    const result = await requireAdmin(request,env); if (result.response) return result.response;
    const rows = await env.DB.prepare("SELECT c.*,u.email,u.full_name,u.status AS user_status,(SELECT COUNT(*) FROM sites s WHERE s.client_id=c.id) AS site_count FROM clients c JOIN users u ON u.id=c.user_id ORDER BY c.created_at DESC LIMIT 300").all();
    return json({clients:rows.results});
  }
  if (method === "POST" && route === "clients") {
    const result = await requireAdmin(request,env); if (result.response) return result.response;
    const data = await body(request);
    const email = cleanText(data?.email,254).toLowerCase();
    const fullName = cleanText(data?.fullName,100);
    const businessName = cleanText(data?.businessName,150);
    const clientType = ["umkm","school","other"].includes(data?.clientType) ? data.clientType : "umkm";
    if (!validEmail(email)||!fullName||!businessName) return fail("Nama, nama usaha/sekolah, dan email wajib diisi.");
    const temporaryPassword = randomToken(9) + "Aa1!";
    const pass = await hashPassword(temporaryPassword);
    const userId=uuid(),clientId=uuid();
    try {
      await env.DB.batch([
        env.DB.prepare("INSERT INTO users (id,email,full_name,role,password_hash,password_salt,must_change_password) VALUES (?,?,?,'client',?,?,1)").bind(userId,email,fullName,pass.hash,pass.salt),
        env.DB.prepare("INSERT INTO clients (id,user_id,business_name,client_type,phone,notes) VALUES (?,?,?,?,?,?)").bind(clientId,userId,businessName,clientType,cleanText(data?.phone,40)||null,cleanText(data?.notes,1000)||null)
      ]);
    } catch { return fail("Pelanggan gagal dibuat. Pastikan email belum digunakan.",409); }
    await log(env.DB,result.user.id,"client_created","client",clientId,{email,businessName});
    return json({client:{id:clientId,userId,email,fullName,businessName,clientType},temporaryPassword,notice:"Kata sandi sementara hanya ditampilkan pada respons ini. Kirimkan melalui saluran aman dan minta pelanggan segera menggantinya."},201);
  }

  if (method === "GET" && route === "sites") {
    const result = await requireUser(request,env); if (result.response) return result.response;
    if (result.user.role==="admin") {
      const rows=await env.DB.prepare("SELECT s.id,s.name,s.slug,s.status,s.plan_name,s.template_key,s.updated_at,c.business_name,c.id AS client_id FROM sites s JOIN clients c ON c.id=s.client_id ORDER BY s.created_at DESC LIMIT 300").all();
      return json({sites:rows.results});
    }
    const rows=await env.DB.prepare("SELECT s.id,s.name,s.slug,s.status,s.plan_name,s.template_key,s.content_json,s.updated_at FROM sites s JOIN clients c ON c.id=s.client_id WHERE c.user_id=? ORDER BY s.created_at DESC").bind(result.user.id).all();
    return json({sites:rows.results.map(s=>({...s,content:parseJson(s.content_json)}))});
  }
  if (method === "POST" && route === "sites") {
    const result = await requireAdmin(request,env); if (result.response) return result.response;
    const data=await body(request);
    const clientId=cleanText(data?.clientId,100), name=cleanText(data?.name,150), slug=cleanText(data?.slug,60).toLowerCase();
    const templateKey=["umkm-kuliner","umkm-jasa","umkm-profil","sekolah-paud","sekolah-profile"].includes(data?.templateKey)?data.templateKey:"umkm-kuliner";
    const planName=cleanText(data?.planName,80)||"Starter";
    const client=await env.DB.prepare("SELECT id FROM clients WHERE id=?").bind(clientId).first();
    if (!client||!name||!validSlug(slug)) return fail("Pilih pelanggan, isi nama website, dan gunakan slug huruf kecil/angka/tanda hubung.");
    const id=uuid();
    const defaultContent={title:name,subtitle:"Selamat datang di website kami.",description:"Informasi resmi usaha atau sekolah Anda.",phone:"",email:"",address:"",primaryColor:"#173b2c",sections:[]};
    try { await env.DB.prepare("INSERT INTO sites (id,client_id,slug,name,template_key,plan_name,content_json) VALUES (?,?,?,?,?,?,?)").bind(id,clientId,slug,name,templateKey,planName,JSON.stringify(defaultContent)).run(); }
    catch { return fail("Website gagal dibuat. Slug mungkin sudah digunakan.",409); }
    await log(env.DB,result.user.id,"site_created","site",id,{slug,templateKey,clientId});
    return json({site:{id,clientId,name,slug,templateKey,planName,status:"draft",content:defaultContent}},201);
  }

  if (parts[0] === "sites" && parts[1] && parts.length===2 && method==="GET") {
    const result=await requireUser(request,env); if(result.response) return result.response;
    const site=await ownedSite(env.DB,result.user,parts[1]); if(!site) return fail("Website tidak ditemukan atau akses ditolak.",404);
    return json({site:{id:site.id,clientId:site.client_id,name:site.name,slug:site.slug,templateKey:site.template_key,status:site.status,planName:site.plan_name,content:parseJson(site.content_json),updatedAt:site.updated_at}});
  }
  if (parts[0] === "sites" && parts[1] && parts.length===2 && method==="PATCH") {
    const result=await requireUser(request,env); if(result.response) return result.response;
    if(result.user.must_change_password) return fail("Ganti kata sandi sebelum melanjutkan.",403);
    const site=await ownedSite(env.DB,result.user,parts[1]); if(!site) return fail("Website tidak ditemukan atau akses ditolak.",404);
    const data=await body(request);
    if (!data || typeof data.content!=="object" || Array.isArray(data.content)) return fail("Konten tidak valid.");
    const allowed=["title","subtitle","description","phone","email","address","primaryColor","menuText","ctaText"];
    const content=parseJson(site.content_json);
    for (const key of allowed) if (data.content[key] !== undefined) content[key]=cleanText(data.content[key],key==="description"?1500:250);
    if (data.content.primaryColor && !/^#[0-9a-fA-F]{6}$/.test(data.content.primaryColor)) return fail("Warna utama harus berupa kode hex enam digit.");
    await env.DB.prepare("UPDATE sites SET content_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(JSON.stringify(content),site.id).run();
    await log(env.DB,result.user.id,"site_content_updated","site",site.id,{fields:Object.keys(data.content).filter(k=>allowed.includes(k))});
    return json({ok:true,content});
  }
  if (parts[0] === "sites" && parts[1] && parts[2]==="publish" && method==="POST") {
    const result=await requireAdmin(request,env); if(result.response) return result.response;
    const site=await ownedSite(env.DB,result.user,parts[1]); if(!site) return fail("Website tidak ditemukan.",404);
    const data=await body(request);
    const status=data?.status==="suspended"?"suspended":data?.status==="draft"?"draft":"published";
    await env.DB.prepare("UPDATE sites SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(status,site.id).run();
    await log(env.DB,result.user.id,"site_status_changed","site",site.id,{status});
    return json({ok:true,status});
  }

  if (method==="GET" && route==="domains") {
    const result=await requireUser(request,env); if(result.response) return result.response;
    if(result.user.role==="admin") {
      const rows=await env.DB.prepare("SELECT d.*,s.name AS site_name,s.slug,c.business_name FROM domains d JOIN sites s ON s.id=d.site_id JOIN clients c ON c.id=s.client_id ORDER BY d.created_at DESC LIMIT 300").all();
      return json({domains:rows.results});
    }
    const rows=await env.DB.prepare("SELECT d.*,s.name AS site_name,s.slug FROM domains d JOIN sites s ON s.id=d.site_id JOIN clients c ON c.id=s.client_id WHERE c.user_id=? ORDER BY d.created_at DESC").bind(result.user.id).all();
    return json({domains:rows.results});
  }
  if (method==="POST" && route==="domains") {
    const result=await requireUser(request,env); if(result.response) return result.response;
    const data=await body(request);
    const siteId=cleanText(data?.siteId,100), hostname=cleanText(data?.hostname,253).toLowerCase().replace(/\.$/,"");
    if(!validHostname(hostname)) return fail("Nama domain tidak valid. Masukkan domain saja, tanpa https:// atau path.");
    const site=await ownedSite(env.DB,result.user,siteId);
    if(!site) return fail("Website tidak ditemukan atau akses ditolak.",404);
    const id=uuid();
    try { await env.DB.prepare("INSERT INTO domains (id,site_id,hostname,registered_to_customer,registrar,expires_on,status,dns_notes,contract_notes) VALUES (?,?,?,1,?,?, 'pending',?,?)")
      .bind(id,siteId,hostname,cleanText(data?.registrar,120)||null,cleanText(data?.expiresOn,10)||null,cleanText(data?.dnsNotes,1000)||null,cleanText(data?.contractNotes,1000)||null).run(); }
    catch { return fail("Domain gagal ditambahkan. Domain mungkin sudah terdaftar di sistem.",409); }
    await log(env.DB,result.user.id,"domain_added","domain",id,{hostname,siteId});
    return json({domain:{id,siteId,hostname,registeredToCustomer:true,status:"pending"},notice:"Domain dicatat. DNS, kepemilikan, dan SSL belum otomatis diverifikasi atau dikonfigurasi."},201);
  }
  if(parts[0]==="domains" && parts[1] && method==="PATCH") {
    const result=await requireAdmin(request,env); if(result.response) return result.response;
    const data=await body(request);
    const allowedStatuses=["pending","verification_needed","dns_pending","ssl_pending","active","expired","suspended","removed"];
    const status=allowedStatuses.includes(data?.status)?data.status:null;
    const hostname= data?.hostname===undefined?null:cleanText(data.hostname,253).toLowerCase().replace(/\.$/,"");
    if(data?.hostname!==undefined&&!validHostname(hostname)) return fail("Nama domain tidak valid.");
    const existing=await env.DB.prepare("SELECT * FROM domains WHERE id=?").bind(parts[1]).first();
    if(!existing) return fail("Domain tidak ditemukan.",404);
    try {
      await env.DB.prepare("UPDATE domains SET status=COALESCE(?,status),hostname=COALESCE(?,hostname),registrar=COALESCE(?,registrar),expires_on=COALESCE(?,expires_on),dns_notes=COALESCE(?,dns_notes),contract_notes=COALESCE(?,contract_notes),ownership_verified_at=CASE WHEN ?=1 THEN CURRENT_TIMESTAMP ELSE ownership_verified_at END,updated_at=CURRENT_TIMESTAMP WHERE id=?")
      .bind(status,hostname,data?.registrar===undefined?null:cleanText(data.registrar,120),data?.expiresOn===undefined?null:cleanText(data.expiresOn,10),data?.dnsNotes===undefined?null:cleanText(data.dnsNotes,1000),data?.contractNotes===undefined?null:cleanText(data.contractNotes,1000),data?.verifyOwnership===true?1:0,parts[1]).run();
    } catch { return fail("Pembaruan domain gagal; periksa apakah domain duplikat.",409); }
    await log(env.DB,result.user.id,"domain_updated","domain",parts[1],{status,hostname,verifyOwnership:data?.verifyOwnership===true});
    return json({ok:true});
  }

  return fail("Endpoint tidak ditemukan.",404);
}
function parseJson(value) { try { return JSON.parse(value || "{}"); } catch { return {}; } }
export async function onRequest(context) {
  try { return await api(context.request,context.env); }
  catch (error) {
    console.error("RuangWeb API error", error?.message || "unknown");
    return json({error:"Terjadi kesalahan server. Periksa konfigurasi platform."},500);
  }
}
