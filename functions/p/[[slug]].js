function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[char]));
}
function safeColor(value) { return /^#[0-9a-fA-F]{6}$/.test(value || "") ? value : "#173b2c"; }
function page(title, description, color, body) {
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${escapeHtml(description)}"><meta name="theme-color" content="${safeColor(color)}"><title>${escapeHtml(title)}</title><style>*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#202a26;background:#f6f8f6;line-height:1.65}.wrap{max-width:980px;margin:auto;padding:28px 22px}.nav{display:flex;justify-content:space-between;gap:16px;align-items:center}.brand{font-weight:800;font-size:18px;color:${safeColor(color)}}.hero{margin-top:45px;padding:clamp(28px,7vw,72px);background:white;border-radius:24px;border:1px solid #e2e9e4}.eyebrow{text-transform:uppercase;font-size:12px;letter-spacing:.12em;font-weight:700;color:${safeColor(color)}}h1{font-size:clamp(36px,7vw,68px);line-height:1.06;letter-spacing:-.045em;margin:12px 0 18px}.lead{font-size:18px;color:#64716a;max-width:680px}.button{display:inline-block;background:${safeColor(color)};color:white;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:700;margin-top:16px}.details{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-top:18px}.card{background:white;border:1px solid #e2e9e4;border-radius:16px;padding:24px}.card h2{font-size:18px}.muted{color:#66736c;font-size:14px}footer{padding:28px 0;color:#6b756f;font-size:12px}@media(max-width:600px){.nav{align-items:flex-start;flex-direction:column}.hero{margin-top:24px}}</style></head><body><div class="wrap"><nav class="nav"><div class="brand">${escapeHtml(title)}</div><div class="muted">Website resmi</div></nav>${body}<footer>Website dikelola oleh pemiliknya. Informasi di halaman ini disediakan oleh pemilik website.</footer></div></body></html>`;
}
export async function onRequest(context) {
  const { request, env, params } = context;
  if (!env.DB) return new Response("Website belum dikonfigurasi.",{status:503});
  const host = new URL(request.url).hostname.toLowerCase();
  const pathSlug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  let site = null;
  if (pathSlug) {
    site = await env.DB.prepare("SELECT s.*,c.business_name FROM sites s JOIN clients c ON c.id=s.client_id WHERE s.slug=? AND s.status='published' LIMIT 1").bind(String(pathSlug).toLowerCase()).first();
  } else {
    const domain = await env.DB.prepare("SELECT site_id FROM domains WHERE hostname=? AND status='active' LIMIT 1").bind(host).first();
    if (domain) site = await env.DB.prepare("SELECT s.*,c.business_name FROM sites s JOIN clients c ON c.id=s.client_id WHERE s.id=? AND s.status='published' LIMIT 1").bind(domain.site_id).first();
  }
  if (!site) return new Response("Website tidak ditemukan atau belum dipublikasikan.",{status:404,headers:{"Content-Type":"text/plain; charset=utf-8","X-Content-Type-Options":"nosniff"}});
  let content={}; try { content=JSON.parse(site.content_json||"{}"); } catch {}
  const title=content.title||site.name||site.business_name;
  const subtitle=content.subtitle||"Selamat datang di website kami.";
  const description=content.description||"Informasi resmi usaha atau sekolah Anda.";
  const color=safeColor(content.primaryColor);
  const phone=String(content.phone||"").replace(/[^0-9+]/g,"");
  const email=String(content.email||"");
  const address=String(content.address||"");
  const contact=phone ? `<a class="button" href="https://wa.me/${escapeHtml(phone.replace(/\D/g,""))}">Hubungi melalui WhatsApp</a>` : (email ? `<a class="button" href="mailto:${escapeHtml(email)}">Hubungi kami</a>` : "");
  const body=`<main><section class="hero"><div class="eyebrow">${escapeHtml(site.template_key.replace(/-/g," "))}</div><h1>${escapeHtml(subtitle)}</h1><p class="lead">${escapeHtml(description)}</p>${contact}</section><section class="details"><article class="card"><h2>Tentang kami</h2><p class="muted">${escapeHtml(content.about||description)}</p></article><article class="card"><h2>Informasi kontak</h2><p class="muted">${phone ? "Telepon/WhatsApp: "+escapeHtml(content.phone) : ""}</p><p class="muted">${email ? "Email: "+escapeHtml(email) : ""}</p><p class="muted">${address ? escapeHtml(address) : "Informasi alamat belum ditambahkan."}</p></article></section></main>`;
  return new Response(page(title,description,color,body),{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"strict-origin-when-cross-origin"}});
}
