import { useState, useEffect, useCallback } from "react";

// ============================================================
// ⚙️  CONFIGURAÇÕES — preencha após criar a conta no Supabase
// ============================================================
const SUPABASE_URL  = "https://juqsrwtfwujnievhftgi.supabase.co";
const SUPABASE_ANON = "sb_publishable_8sFebEhMSp0askniYLBRSg_PtyWGvXB";

const WHATSAPP_NUMBER = "5511988670054";
const ADMIN_EMAIL     = "barbarossuplementossp@gmail.com";   // ← troque
const ADMIN_SENHA     = "D04m007aA*";          // ← troque
const ADMIN_DEVICE_KEY = "supp_auth_device_v2";
const ADMIN_TOKEN     = "tk_" + btoa(ADMIN_EMAIL + ":" + ADMIN_SENHA).slice(0, 24);

// ============================================================
// 🔌  SUPABASE CLIENT (sem biblioteca — fetch puro)
// ============================================================
const db = {
  async select(table, query = "") {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}&order=created_at.desc`, {
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}`, "Content-Type": "application/json" }
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async insert(table, body) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async update(table, id, body) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: "PATCH",
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async delete(table, id) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: "DELETE",
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` }
    });
    if (!r.ok) throw new Error(await r.text());
  },
  async rpc(fn, params) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify(params)
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }
};

// ============================================================
// HELPERS
// ============================================================
const CATEGORIES = ["Whey / Proteína","Creatina","Pré-treino","Vitaminas/Minerais","Aminoácidos","Hipercalórico","Outros"];
const UNITS      = ["un","kg","g","L","ml"];
const PAGAMENTOS = ["Dinheiro","Pix","Débito","Crédito"];

function daysUntil(d) { return Math.ceil((new Date(d) - new Date()) / 86400000); }
function getSession() { try { return JSON.parse(localStorage.getItem("supp_session") || "null"); } catch { return null; } }
function saveSession(s) { localStorage.setItem("supp_session", JSON.stringify(s)); }
function isAdminDevice() { return localStorage.getItem(ADMIN_DEVICE_KEY) === ADMIN_TOKEN; }
function authorizeDevice() { localStorage.setItem(ADMIN_DEVICE_KEY, ADMIN_TOKEN); }
function isAdminRoute() { return window.location.search.includes("admin"); }

// ============================================================
// STYLES
// ============================================================
const overlay   = { position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:20 };
const cardStyle = { background:"#fff",borderRadius:20,padding:28,width:"100%",maxWidth:380,boxShadow:"0 20px 60px rgba(0,0,0,0.2)" };
const sheetBot  = { position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:100,display:"flex",alignItems:"flex-end",justifyContent:"center" };
const sheetBox  = { background:"#fff",borderRadius:"20px 20px 0 0",padding:24,width:"100%",maxWidth:600,maxHeight:"85vh",overflowY:"auto" };
const inpStyle  = (err) => ({ display:"block",width:"100%",padding:"11px 14px",borderRadius:10,border:err?"2px solid #ef4444":"1px solid #e2e8f0",fontSize:15,marginTop:5,boxSizing:"border-box",outline:"none",background:"#fff" });
const lblStyle  = { fontSize:13,fontWeight:600,color:"#475569",display:"block",marginTop:12 };

// ============================================================
// LOADING SPINNER
// ============================================================
function Spinner() {
  return (
    <div style={{ display:"flex",alignItems:"center",justifyContent:"center",padding:40 }}>
      <div style={{ width:32,height:32,border:"3px solid #e2e8f0",borderTop:"3px solid #3b82f6",borderRadius:"50%",animation:"spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ============================================================
// AUTH MODAL (clientes)
// ============================================================
function AuthModal({ onClose, onLogin }) {
  const [mode, setMode] = useState("escolha");
  const [form, setForm] = useState({ nome:"",telefone:"",email:"",senha:"" });
  const [errors, setErrors] = useState({});
  const [globalErr, setGlobalErr] = useState("");
  const [loading, setLoading] = useState(false);
  const set = (k,v) => { setForm(f=>({...f,[k]:v})); setErrors(e=>({...e,[k]:""})); setGlobalErr(""); };

  function validate(fields) {
    const e = {};
    if (fields.includes("nome")     && !form.nome.trim()) e.nome = "Informe seu nome completo";
    if (fields.includes("telefone") && !/^\d{10,11}$/.test(form.telefone.replace(/\D/g,""))) e.telefone = "Telefone inválido";
    if (fields.includes("email")    && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "E-mail inválido";
    if (fields.includes("senha")    && form.senha.length < 4) e.senha = "Mínimo 4 caracteres";
    return e;
  }

  async function handleCadastro() {
    const e = validate(["nome","telefone","email","senha"]);
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    try {
      // Check if email already exists
      const existing = await db.select("usuarios", `email=eq.${encodeURIComponent(form.email.toLowerCase())}&select=id`);
      if (existing.length > 0) { setErrors({ email:"E-mail já cadastrado" }); setLoading(false); return; }
      const [user] = await db.insert("usuarios", {
        nome: form.nome.trim(),
        telefone: form.telefone.replace(/\D/g,""),
        email: form.email.toLowerCase(),
        senha: form.senha,
        role: "cliente"
      });
      saveSession(user);
      onLogin(user);
    } catch (err) {
      setGlobalErr("Erro ao cadastrar. Tente novamente.");
    } finally { setLoading(false); }
  }

  async function handleLogin() {
    const e = validate(["email","senha"]);
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    try {
      const users = await db.select("usuarios", `email=eq.${encodeURIComponent(form.email.toLowerCase())}&senha=eq.${encodeURIComponent(form.senha)}`);
      if (!users.length) { setGlobalErr("E-mail ou senha incorretos"); setLoading(false); return; }
      saveSession(users[0]);
      onLogin(users[0]);
    } catch { setGlobalErr("Erro ao conectar. Verifique sua conexão."); }
    finally { setLoading(false); }
  }

  const Field = ({ k, label, type="text", placeholder }) => (
    <div>
      <label style={lblStyle}>{label}</label>
      <input type={type} placeholder={placeholder} value={form[k]} onChange={e=>set(k,e.target.value)}
        onKeyDown={e=>{ if(e.key==="Enter"){ if(mode==="cadastro") handleCadastro(); else handleLogin(); }}}
        style={inpStyle(errors[k])} />
      {errors[k] && <div style={{color:"#ef4444",fontSize:12,marginTop:3,fontWeight:600}}>{errors[k]}</div>}
    </div>
  );

  return (
    <div style={overlay} onClick={onClose}>
      <div style={cardStyle} onClick={e=>e.stopPropagation()}>
        {mode==="escolha" && (
          <>
            <div style={{textAlign:"center",marginBottom:24}}>
              <div style={{fontSize:36}}>💪</div>
              <div style={{fontWeight:800,fontSize:20,marginTop:8}}>Bem-vindo!</div>
              <div style={{color:"#64748b",fontSize:14,marginTop:4}}>Entre ou crie sua conta para fazer seu pedido</div>
            </div>
            <button onClick={()=>setMode("login")} style={{width:"100%",padding:14,borderRadius:12,border:"none",background:"#0f172a",color:"#fff",fontWeight:700,fontSize:16,cursor:"pointer",marginBottom:10}}>Entrar</button>
            <button onClick={()=>setMode("cadastro")} style={{width:"100%",padding:14,borderRadius:12,border:"2px solid #e2e8f0",background:"#fff",color:"#0f172a",fontWeight:700,fontSize:16,cursor:"pointer"}}>Criar conta</button>
          </>
        )}
        {mode==="cadastro" && (
          <>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
              <button onClick={()=>{setMode("escolha");setErrors({});}} style={{background:"#f1f5f9",border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:15}}>←</button>
              <div style={{fontWeight:800,fontSize:18}}>Criar conta</div>
            </div>
            <Field k="nome" label="Nome completo" placeholder="Seu nome" />
            <Field k="telefone" label="Telefone (WhatsApp)" type="tel" placeholder="(11) 99999-9999" />
            <Field k="email" label="E-mail" type="email" placeholder="seu@email.com" />
            <Field k="senha" label="Senha" type="password" placeholder="Mínimo 4 caracteres" />
            {globalErr && <div style={{color:"#ef4444",fontSize:13,marginTop:10,fontWeight:600}}>{globalErr}</div>}
            <button onClick={handleCadastro} disabled={loading} style={{width:"100%",padding:14,borderRadius:12,border:"none",background:"#0f172a",color:"#fff",fontWeight:700,fontSize:16,cursor:"pointer",marginTop:20,opacity:loading?0.7:1}}>
              {loading ? "Cadastrando..." : "Cadastrar"}
            </button>
          </>
        )}
        {mode==="login" && (
          <>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
              <button onClick={()=>{setMode("escolha");setErrors({});setGlobalErr("");}} style={{background:"#f1f5f9",border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:15}}>←</button>
              <div style={{fontWeight:800,fontSize:18}}>Entrar</div>
            </div>
            <Field k="email" label="E-mail" type="email" placeholder="seu@email.com" />
            <Field k="senha" label="Senha" type="password" placeholder="Sua senha" />
            {globalErr && <div style={{color:"#ef4444",fontSize:13,marginTop:10,fontWeight:600}}>{globalErr}</div>}
            <button onClick={handleLogin} disabled={loading} style={{width:"100%",padding:14,borderRadius:12,border:"none",background:"#0f172a",color:"#fff",fontWeight:700,fontSize:16,cursor:"pointer",marginTop:20,opacity:loading?0.7:1}}>
              {loading ? "Entrando..." : "Entrar"}
            </button>
            <button onClick={()=>{setMode("cadastro");setErrors({});setGlobalErr("");}} style={{width:"100%",padding:10,border:"none",background:"transparent",color:"#6366f1",fontSize:14,fontWeight:600,cursor:"pointer",marginTop:8}}>
              Não tenho conta → Criar conta
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// VITRINE (clientes)
// ============================================================
function Vitrine({ products, loading, user, onLogout, onShowAuth }) {
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("Todos");
  const [showCart, setShowCart] = useState(false);
  const [pagamento, setPagamento] = useState("");
  const [pedidoFeito, setPedidoFeito] = useState(null);
  const [toast, setToast] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const showToast = (msg,type="success") => { setToast({msg,type}); setTimeout(()=>setToast(null),2500); };
  const cartTotal = cart.reduce((s,i)=>s+i.price*i.qty,0);
  const cartCount = cart.reduce((s,i)=>s+i.qty,0);
  const cartQty   = (id) => cart.find(i=>i.productId===id)?.qty||0;

  function addToCart(p) {
    if (!user) { onShowAuth(); return; }
    if (cartQty(p.id)>=p.qty) return;
    setCart(prev=>{ const ex=prev.find(i=>i.productId===p.id); if(ex) return prev.map(i=>i.productId===p.id?{...i,qty:i.qty+1}:i); return [...prev,{productId:p.id,productName:p.name,flavor:p.flavor,price:p.price,qty:1}]; });
  }
  function removeFromCart(id) {
    setCart(prev=>{ const item=prev.find(i=>i.productId===id); if(!item) return prev; if(item.qty<=1) return prev.filter(i=>i.productId!==id); return prev.map(i=>i.productId===id?{...i,qty:i.qty-1}:i); });
  }

  async function finalizarPedido() {
    if (!pagamento) { showToast("Escolha a forma de pagamento","error"); return; }
    setSubmitting(true);
    try {
      // Insert venda
      const [venda] = await db.insert("vendas", {
        usuario_id: user.id,
        cliente: user.nome,
        total: +cartTotal.toFixed(2),
        pagamento
      });
      // Insert itens
      await db.insert("venda_itens", cart.map(i=>({
        venda_id: venda.id,
        produto_id: i.productId,
        product_name: i.productName,
        flavor: i.flavor,
        qty: i.qty,
        price: i.price
      })));
      // Update stock
      for (const item of cart) {
        const product = products.find(p=>p.id===item.productId);
        if (product) await db.update("produtos", item.productId, { qty: product.qty - item.qty });
      }
      setPedidoFeito({ cart:[...cart], total:cartTotal, pagamento });
      setCart([]); setPagamento(""); setShowCart(false);
    } catch (err) {
      showToast("Erro ao registrar pedido. Tente novamente.","error");
    } finally { setSubmitting(false); }
  }

  function abrirWhatsApp() {
    if (!pedidoFeito) return;
    const itens = pedidoFeito.cart.map(i=>`• ${i.productName} (${i.flavor}) x${i.qty} — R$ ${(i.price*i.qty).toFixed(2)}`).join("\n");
    const msg = `Olá! Gostaria de fazer um pedido 🛒\n\n*Cliente:* ${user.nome}\n*Telefone:* ${user.telefone||"-"}\n\n*Itens:*\n${itens}\n\n*Total:* R$ ${pedidoFeito.total.toFixed(2)}\n*Pagamento:* ${pedidoFeito.pagamento}`;
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`,"_blank");
  }

  const filtered = products.filter(p=>{
    const m=(p.name+p.flavor).toLowerCase().includes(search.toLowerCase());
    const c=filterCat==="Todos"||p.category===filterCat;
    return m&&c;
  });

  if (pedidoFeito) return (
    <div style={{fontFamily:"'Inter',sans-serif",background:"#f1f5f9",minHeight:"100vh",maxWidth:600,margin:"0 auto",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:28}}>
      <div style={{fontSize:64}}>🎉</div>
      <div style={{fontSize:22,fontWeight:800,marginTop:16,textAlign:"center"}}>Pedido pronto!</div>
      <div style={{color:"#64748b",marginTop:6,textAlign:"center",fontSize:15}}>Clique abaixo para enviar no WhatsApp</div>
      <div style={{background:"#fff",borderRadius:16,padding:20,marginTop:20,width:"100%",maxWidth:360}}>
        {pedidoFeito.cart.map((item,i)=>(
          <div key={i} style={{display:"flex",justifyContent:"space-between",paddingBottom:8,marginBottom:8,borderBottom:i<pedidoFeito.cart.length-1?"1px solid #f1f5f9":"none"}}>
            <div><div style={{fontWeight:700,fontSize:14}}>{item.productName}</div><div style={{color:"#6366f1",fontSize:12}}>{item.flavor} × {item.qty}</div></div>
            <div style={{fontWeight:700}}>R$ {(item.price*item.qty).toFixed(2)}</div>
          </div>
        ))}
        <div style={{display:"flex",justifyContent:"space-between",paddingTop:8,fontWeight:800,fontSize:16}}>
          <span>Total</span><span style={{color:"#16a34a"}}>R$ {pedidoFeito.total.toFixed(2)}</span>
        </div>
        <div style={{textAlign:"center",marginTop:6,color:"#64748b",fontSize:13}}>Pagamento: {pedidoFeito.pagamento}</div>
      </div>
      <button onClick={abrirWhatsApp} style={{marginTop:24,width:"100%",maxWidth:360,padding:"16px 0",borderRadius:14,border:"none",background:"#25d366",color:"#fff",fontWeight:800,fontSize:17,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10,boxShadow:"0 8px 24px rgba(37,211,102,0.4)"}}>
        <span style={{fontSize:22}}>📲</span> Enviar no WhatsApp
      </button>
      <button onClick={()=>setPedidoFeito(null)} style={{marginTop:12,padding:"10px 24px",borderRadius:10,border:"none",background:"transparent",color:"#94a3b8",fontSize:14,cursor:"pointer"}}>Novo pedido</button>
    </div>
  );

  return (
    <div style={{fontFamily:"'Inter',sans-serif",background:"#f1f5f9",minHeight:"100vh",maxWidth:600,margin:"0 auto",paddingBottom:90}}>
      <div style={{background:"linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%)",padding:"20px 20px 16px",color:"#fff"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:11,fontWeight:600,letterSpacing:2,color:"#94a3b8",textTransform:"uppercase"}}>Loja de</div>
            <div style={{fontSize:22,fontWeight:800}}>Suplementos 💪</div>
          </div>
          {user ? (
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
              <div style={{fontSize:13,fontWeight:700,color:"#fff"}}>Olá, {user.nome.split(" ")[0]}!</div>
              <button onClick={onLogout} style={{background:"rgba(255,255,255,0.1)",border:"none",borderRadius:16,padding:"4px 12px",color:"#94a3b8",fontSize:12,cursor:"pointer"}}>Sair</button>
            </div>
          ) : (
            <button onClick={onShowAuth} style={{background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:20,padding:"8px 16px",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>Login / Cadastro</button>
          )}
        </div>
        {!user && <div style={{background:"rgba(99,102,241,0.25)",borderRadius:10,padding:"8px 12px",marginTop:12,fontSize:13,color:"#a5b4fc"}}>👆 Entre ou cadastre-se para fazer seu pedido</div>}
      </div>

      <div style={{padding:16}}>
        <input placeholder="🔍 Buscar..." value={search} onChange={e=>setSearch(e.target.value)}
          style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1px solid #e2e8f0",fontSize:14,outline:"none",background:"#fff",boxSizing:"border-box",marginBottom:12}} />
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
          {["Todos",...CATEGORIES].map(c=>(
            <button key={c} onClick={()=>setFilterCat(c)} style={{padding:"5px 11px",borderRadius:20,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,background:filterCat===c?"#0f172a":"#e2e8f0",color:filterCat===c?"#fff":"#475569"}}>{c}</button>
          ))}
        </div>
        {loading ? <Spinner /> : (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {filtered.map(p=>{
              const inCart=cartQty(p.id); const available=p.qty-inCart; const sold_out=p.qty===0; const maxed=inCart>=p.qty;
              return (
                <div key={p.id} style={{background:sold_out?"#f8fafc":"#fff",borderRadius:14,boxShadow:"0 1px 4px rgba(0,0,0,0.08)",overflow:"hidden",opacity:sold_out?0.6:1,border:inCart>0?"2px solid #22c55e":"2px solid transparent"}}>
                  <div style={{padding:"14px 14px 10px"}}>
                    <div style={{fontSize:13,fontWeight:800,lineHeight:1.3,color:"#0f172a",marginBottom:3}}>{p.name}</div>
                    <div style={{fontSize:12,color:"#6366f1",fontWeight:600}}>{p.flavor}</div>
                    <div style={{fontSize:17,fontWeight:800,color:"#0f172a",marginTop:8}}>R$ {Number(p.price).toFixed(2).replace(".",",")}</div>
                    <div style={{fontSize:11,color:sold_out?"#ef4444":available<=2?"#d97706":"#64748b",marginTop:2,fontWeight:600}}>
                      {sold_out?"Indisponível":available<=2?`⚠ Só ${available} restante${available>1?"s":""}`:`${available} disponível${available>1?"is":""}`}
                    </div>
                  </div>
                  {inCart===0 ? (
                    <button disabled={sold_out} onClick={()=>addToCart(p)} style={{width:"100%",padding:"10px 0",border:"none",fontWeight:700,fontSize:13,cursor:sold_out?"not-allowed":"pointer",background:sold_out?"#e2e8f0":"#0f172a",color:sold_out?"#94a3b8":"#fff"}}>
                      {sold_out?"Indisponível":user?"Adicionar":"Entrar para comprar"}
                    </button>
                  ) : (
                    <div style={{display:"flex",alignItems:"center",background:"#f1f5f9"}}>
                      <button onClick={()=>removeFromCart(p.id)} style={{flex:1,padding:"10px 0",border:"none",background:"transparent",fontSize:18,fontWeight:800,cursor:"pointer",color:"#ef4444"}}>−</button>
                      <span style={{fontWeight:800,fontSize:15,color:"#0f172a",minWidth:24,textAlign:"center"}}>{inCart}</span>
                      <button onClick={()=>addToCart(p)} disabled={maxed} style={{flex:1,padding:"10px 0",border:"none",background:"transparent",fontSize:18,fontWeight:800,cursor:maxed?"not-allowed":"pointer",color:maxed?"#94a3b8":"#22c55e"}}>+</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {cartCount>0 && (
        <div style={{position:"fixed",bottom:16,left:"50%",transform:"translateX(-50%)",width:"calc(100% - 32px)",maxWidth:568,zIndex:50}}>
          <button onClick={()=>setShowCart(true)} style={{width:"100%",padding:"14px 20px",borderRadius:14,border:"none",background:"linear-gradient(135deg,#22c55e,#16a34a)",color:"#fff",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",boxShadow:"0 8px 24px rgba(34,197,94,0.4)"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{background:"rgba(255,255,255,0.25)",borderRadius:20,padding:"2px 10px",fontWeight:800,fontSize:14}}>{cartCount}</span>
              <span style={{fontWeight:700,fontSize:15}}>Ver carrinho</span>
            </div>
            <span style={{fontWeight:800,fontSize:16}}>R$ {cartTotal.toFixed(2)}</span>
          </button>
        </div>
      )}

      {showCart && (
        <div style={sheetBot} onClick={()=>setShowCart(false)}>
          <div style={sheetBox} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <div style={{fontWeight:800,fontSize:20}}>Carrinho 🛒</div>
              <button onClick={()=>setShowCart(false)} style={{background:"#f1f5f9",border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:16}}>✕</button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
              {cart.map(item=>{
                const product=products.find(p=>p.id===item.productId);
                return (
                  <div key={item.productId} style={{display:"flex",alignItems:"center",gap:12,background:"#f8fafc",borderRadius:12,padding:12}}>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:14}}>{item.productName}</div>
                      <div style={{color:"#6366f1",fontSize:12,fontWeight:600}}>{item.flavor}</div>
                      <div style={{color:"#64748b",fontSize:12,marginTop:2}}>R$ {Number(item.price).toFixed(2)} cada</div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <button onClick={()=>removeFromCart(item.productId)} style={{width:32,height:32,borderRadius:8,border:"1px solid #e2e8f0",background:"#fff",fontSize:16,cursor:"pointer",fontWeight:700,color:"#ef4444"}}>−</button>
                      <span style={{fontWeight:800,minWidth:20,textAlign:"center"}}>{item.qty}</span>
                      <button onClick={()=>{if(product)addToCart(product);}} disabled={!product||item.qty>=product?.qty} style={{width:32,height:32,borderRadius:8,border:"1px solid #e2e8f0",background:"#fff",fontSize:16,cursor:"pointer",fontWeight:700,color:"#22c55e"}}>+</button>
                    </div>
                    <div style={{fontWeight:800,fontSize:15,minWidth:70,textAlign:"right"}}>R$ {(item.price*item.qty).toFixed(2)}</div>
                  </div>
                );
              })}
            </div>
            <div style={{marginBottom:20}}>
              <div style={{fontWeight:700,fontSize:15,marginBottom:10}}>Forma de pagamento</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {PAGAMENTOS.map(pg=>(
                  <button key={pg} onClick={()=>setPagamento(pg)} style={{padding:"12px 0",borderRadius:10,border:"none",fontWeight:700,fontSize:14,cursor:"pointer",background:pagamento===pg?"#0f172a":"#f1f5f9",color:pagamento===pg?"#fff":"#475569"}}>{pg}</button>
                ))}
              </div>
            </div>
            <div style={{borderTop:"2px solid #f1f5f9",paddingTop:16,marginBottom:16}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{color:"#64748b",fontSize:15}}>Total</span>
                <span style={{fontWeight:800,fontSize:24,color:"#0f172a"}}>R$ {cartTotal.toFixed(2)}</span>
              </div>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>{setCart([]);setShowCart(false);setPagamento("");}} style={{flex:1,padding:13,borderRadius:12,border:"1px solid #e2e8f0",background:"#fff",cursor:"pointer",fontWeight:600,color:"#ef4444"}}>Limpar</button>
              <button onClick={finalizarPedido} disabled={!pagamento||submitting} style={{flex:2,padding:13,borderRadius:12,border:"none",background:pagamento?"linear-gradient(135deg,#22c55e,#16a34a)":"#e2e8f0",color:pagamento?"#fff":"#94a3b8",fontWeight:800,fontSize:16,cursor:pagamento?"pointer":"not-allowed",opacity:submitting?0.7:1}}>
                {submitting?"Registrando...":"Finalizar pedido"}
              </button>
            </div>
          </div>
        </div>
      )}
      {toast && <div style={{position:"fixed",bottom:88,left:"50%",transform:"translateX(-50%)",background:toast.type==="error"?"#ef4444":"#22c55e",color:"#fff",padding:"12px 24px",borderRadius:12,fontWeight:700,fontSize:14,zIndex:300,maxWidth:"90vw",textAlign:"center"}}>{toast.msg}</div>}
    </div>
  );
}

// ============================================================
// ADMIN PANEL
// ============================================================
function AdminPanel({ onLogout }) {
  const [tab, setTab] = useState("estoque");
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [loadingP, setLoadingP] = useState(true);
  const [loadingS, setLoadingS] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("Todos");
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg,type="success") => { setToast({msg,type}); setTimeout(()=>setToast(null),2500); };

  const loadProducts = useCallback(async () => {
    setLoadingP(true);
    try { setProducts(await db.select("produtos","")); } catch { showToast("Erro ao carregar produtos","error"); }
    finally { setLoadingP(false); }
  }, []);

  const loadSales = useCallback(async () => {
    setLoadingS(true);
    try {
      const v = await db.select("vendas","select=*,venda_itens(*)");
      setSales(v.map(s=>({...s, items: s.venda_itens||[]})));
    } catch { showToast("Erro ao carregar vendas","error"); }
    finally { setLoadingS(false); }
  }, []);

  useEffect(()=>{ loadProducts(); loadSales(); },[loadProducts,loadSales]);

  async function handleSaveProduct(data) {
    try {
      if (editProduct) {
        await db.update("produtos", editProduct.id, { name:data.name, category:data.category, flavor:data.flavor, qty:data.qty, min_qty:data.minQty, unit:data.unit, validity:data.validity||null, price:data.price });
        showToast("Produto atualizado!");
      } else {
        await db.insert("produtos", { name:data.name, category:data.category, flavor:data.flavor, qty:data.qty, min_qty:data.minQty, unit:data.unit, validity:data.validity||null, price:data.price });
        showToast("Produto adicionado!");
      }
      await loadProducts();
    } catch { showToast("Erro ao salvar produto","error"); }
    setShowAddProduct(false); setEditProduct(null);
  }

  async function handleDelete(id) {
    if (!window.confirm("Remover este produto?")) return;
    try { await db.delete("produtos",id); await loadProducts(); showToast("Produto removido.","info"); }
    catch { showToast("Erro ao remover","error"); }
  }

  const alerts = products.filter(p=>p.qty<=p.min_qty || (p.validity && daysUntil(p.validity)<=60));
  const totalValue = products.reduce((s,p)=>s+p.qty*Number(p.price),0);
  const monthStr = new Date().toISOString().slice(0,7);
  const monthlySales = sales.filter(s=>s.created_at?.startsWith(monthStr));
  const monthRevenue = monthlySales.reduce((s,v)=>s+Number(v.total),0);

  const filtered = products.filter(p=>{
    const m=(p.name+p.flavor).toLowerCase().includes(search.toLowerCase());
    const c=filterCat==="Todos"||p.category===filterCat;
    return m&&c;
  });

  return (
    <div style={{fontFamily:"'Inter',sans-serif",background:"#f1f5f9",minHeight:"100vh",maxWidth:600,margin:"0 auto",paddingBottom:90}}>
      <div style={{background:"linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%)",padding:"20px 20px 0",color:"#fff"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div>
            <div style={{fontSize:11,fontWeight:600,letterSpacing:2,color:"#94a3b8",textTransform:"uppercase"}}>Controle de</div>
            <div style={{fontSize:22,fontWeight:800}}>Suplementos 💪</div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {alerts.length>0 && <div style={{background:"#ef4444",borderRadius:20,padding:"4px 12px",fontSize:13,fontWeight:700,cursor:"pointer"}} onClick={()=>setTab("alertas")}>⚠ {alerts.length}</div>}
            <button onClick={onLogout} style={{background:"rgba(255,255,255,0.1)",border:"none",borderRadius:16,padding:"6px 12px",color:"#94a3b8",fontSize:12,cursor:"pointer"}}>Sair</button>
          </div>
        </div>
        <div style={{background:"rgba(59,130,246,0.2)",borderRadius:8,padding:"5px 12px",marginBottom:12,display:"inline-flex"}}>
          <span style={{fontSize:12,color:"#93c5fd",fontWeight:700}}>🔐 Modo Admin</span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:0}}>
          {[{label:"Produtos",value:products.length},{label:"Estoque R$",value:`R$ ${totalValue.toFixed(0)}`},{label:"Vendas/mês",value:`R$ ${monthRevenue.toFixed(0)}`}].map(s=>(
            <div key={s.label} style={{background:"rgba(255,255,255,0.08)",borderRadius:10,padding:"10px 12px",textAlign:"center"}}>
              <div style={{fontSize:18,fontWeight:800}}>{s.value}</div>
              <div style={{fontSize:10,color:"#94a3b8",textTransform:"uppercase",letterSpacing:1}}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{display:"flex",marginTop:16}}>
          {[["estoque","📦 Estoque"],["vendas","💰 Vendas"],["alertas","⚠ Alertas"]].map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id)} style={{flex:1,padding:"10px 0",border:"none",cursor:"pointer",fontSize:12,fontWeight:600,background:"transparent",color:tab===id?"#fff":"#64748b",borderBottom:tab===id?"2px solid #3b82f6":"2px solid transparent"}}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{padding:16}}>
        {tab==="estoque" && (
          <>
            <div style={{display:"flex",gap:8,marginBottom:12}}>
              <input placeholder="🔍 Buscar..." value={search} onChange={e=>setSearch(e.target.value)} style={{flex:1,padding:"10px 12px",borderRadius:10,border:"1px solid #e2e8f0",fontSize:14,outline:"none",background:"#fff"}} />
              <button onClick={()=>{setEditProduct(null);setShowAddProduct(true);}} style={{background:"#3b82f6",color:"#fff",border:"none",borderRadius:10,padding:"0 16px",fontSize:22,cursor:"pointer",fontWeight:700}}>+</button>
            </div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
              {["Todos",...CATEGORIES].map(c=>(
                <button key={c} onClick={()=>setFilterCat(c)} style={{padding:"5px 11px",borderRadius:20,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,background:filterCat===c?"#0f172a":"#e2e8f0",color:filterCat===c?"#fff":"#475569"}}>{c}</button>
              ))}
            </div>
            {loadingP ? <Spinner /> : filtered.length===0 ? <div style={{textAlign:"center",color:"#94a3b8",padding:40}}>Nenhum produto encontrado.</div> : (
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {filtered.map(p=>{
                  const days=p.validity?daysUntil(p.validity):999;
                  return (
                    <div key={p.id} style={{background:"#fff",borderRadius:14,padding:14,boxShadow:"0 1px 4px rgba(0,0,0,0.07)"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                        <div style={{flex:1}}>
                          <div style={{fontWeight:700,fontSize:15}}>{p.name}</div>
                          <div style={{color:"#64748b",fontSize:13,marginTop:1}}>{p.category} · <span style={{color:"#6366f1",fontWeight:600}}>{p.flavor}</span></div>
                        </div>
                        <span style={{background:p.qty===0?"#fee2e2":p.qty<=p.min_qty?"#fef3c7":"#d1fae5",color:p.qty===0?"#dc2626":p.qty<=p.min_qty?"#b45309":"#065f46",borderRadius:6,padding:"2px 10px",fontSize:13,fontWeight:800}}>
                          {p.qty<=p.min_qty&&p.qty>0?"⚠ ":""}{p.qty} {p.unit}
                        </span>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginTop:10,flexWrap:"wrap"}}>
                        {p.validity && <span style={{background:days<0?"#fee2e2":days<=60?"#fef3c7":"#d1fae5",color:days<0?"#dc2626":days<=60?"#d97706":"#059669",borderRadius:6,padding:"2px 8px",fontSize:12,fontWeight:600}}>
                          {days<0?"Vencido":days<=60?`⚠ ${new Date(p.validity+"T12:00").toLocaleDateString("pt-BR")}`:new Date(p.validity+"T12:00").toLocaleDateString("pt-BR")}
                        </span>}
                        <span style={{fontSize:12,color:"#64748b"}}>Mín: {p.min_qty}</span>
                        <span style={{fontSize:13,color:"#0f172a",fontWeight:700,marginLeft:"auto"}}>R$ {Number(p.price).toFixed(2)}</span>
                      </div>
                      <div style={{display:"flex",gap:8,marginTop:12}}>
                        <button onClick={()=>{setEditProduct({...p,minQty:p.min_qty});setShowAddProduct(true);}} style={{flex:1,background:"#f1f5f9",border:"none",borderRadius:8,padding:"9px 0",cursor:"pointer",fontSize:14,fontWeight:600}}>✏️ Editar</button>
                        <button onClick={()=>handleDelete(p.id)} style={{background:"#fff0f0",border:"none",borderRadius:8,padding:"9px 16px",cursor:"pointer",fontSize:15}}>🗑</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {tab==="vendas" && (
          <>
            <div style={{background:"linear-gradient(135deg,#22c55e,#16a34a)",borderRadius:14,padding:16,color:"#fff",marginBottom:16}}>
              <div style={{fontSize:12,fontWeight:600,opacity:.8}}>FATURAMENTO DO MÊS</div>
              <div style={{fontSize:32,fontWeight:800}}>R$ {monthRevenue.toFixed(2)}</div>
              <div style={{fontSize:12,opacity:.8}}>{monthlySales.length} venda{monthlySales.length!==1?"s":""} em {new Date().toLocaleDateString("pt-BR",{month:"long",year:"numeric"})}</div>
            </div>
            {loadingS ? <Spinner /> : sales.length===0 ? <div style={{textAlign:"center",color:"#94a3b8",padding:40}}>Nenhuma venda ainda.</div> : (
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {sales.map(s=>(
                  <div key={s.id} style={{background:"#fff",borderRadius:12,padding:14,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                        <div style={{fontSize:12,color:"#94a3b8"}}>{new Date(s.created_at).toLocaleDateString("pt-BR")}</div>
                        {s.pagamento && <span style={{background:"#f1f5f9",borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700,color:"#475569"}}>{s.pagamento}</span>}
                        {s.cliente && <span style={{fontSize:12,color:"#6366f1",fontWeight:600}}>{s.cliente}</span>}
                      </div>
                      <div style={{fontWeight:800,fontSize:17,color:"#16a34a"}}>R$ {Number(s.total).toFixed(2)}</div>
                    </div>
                    {(s.items||[]).map((item,i)=>(
                      <div key={i} style={{display:"flex",justifyContent:"space-between",paddingTop:i>0?6:0,borderTop:i>0?"1px solid #f1f5f9":"none"}}>
                        <div>
                          <div style={{fontWeight:700,fontSize:14}}>{item.product_name}</div>
                          <div style={{color:"#6366f1",fontSize:12,fontWeight:600}}>{item.flavor} · {item.qty} un</div>
                        </div>
                        <div style={{color:"#475569",fontSize:13,fontWeight:600}}>R$ {(item.price*item.qty).toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab==="alertas" && (
          alerts.length===0
            ? <div style={{textAlign:"center",color:"#22c55e",padding:40,fontSize:16,fontWeight:600}}>✅ Tudo certo! Nenhum alerta.</div>
            : alerts.map(p=>{
              const days=p.validity?daysUntil(p.validity):999;
              return (
                <div key={p.id} style={{background:"#fff",borderRadius:14,padding:14,marginBottom:10,borderLeft:`4px solid ${p.qty===0?"#ef4444":"#f59e0b"}`}}>
                  <div style={{fontWeight:700,fontSize:15}}>{p.name} <span style={{color:"#6366f1"}}>({p.flavor})</span></div>
                  {p.qty<=p.min_qty && <div style={{color:p.qty===0?"#ef4444":"#d97706",fontSize:13,marginTop:4,fontWeight:600}}>{p.qty===0?"🚨 Sem estoque!":`⚠ Estoque baixo: ${p.qty} (mín. ${p.min_qty})`}</div>}
                  {p.validity && days<=60 && <div style={{color:days<0?"#ef4444":"#d97706",fontSize:13,marginTop:4,fontWeight:600}}>{days<0?"🚨 Produto vencido!":`⚠ Vence em ${days} dias`}</div>}
                  <button onClick={()=>{setEditProduct({...p,minQty:p.min_qty});setShowAddProduct(true);setTab("estoque");}} style={{marginTop:10,background:"#f1f5f9",border:"none",borderRadius:8,padding:"7px 14px",fontSize:13,cursor:"pointer",fontWeight:600}}>Editar produto</button>
                </div>
              );
            })
        )}
      </div>

      {showAddProduct && <ProductForm initial={editProduct} onSave={handleSaveProduct} onClose={()=>{setShowAddProduct(false);setEditProduct(null);}} />}
      {toast && <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:toast.type==="error"?"#ef4444":toast.type==="info"?"#64748b":"#22c55e",color:"#fff",padding:"12px 24px",borderRadius:12,fontWeight:700,fontSize:14,zIndex:300,maxWidth:"90vw",textAlign:"center"}}>{toast.msg}</div>}
    </div>
  );
}

// ============================================================
// PRODUCT FORM
// ============================================================
function ProductForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState({ name:initial?.name||"", category:initial?.category||CATEGORIES[0], flavor:initial?.flavor||"", qty:initial?.qty??1, minQty:initial?.minQty??2, unit:initial?.unit||"un", validity:initial?.validity||"", price:initial?.price??"" });
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const fi={display:"block",width:"100%",padding:"10px 12px",borderRadius:10,border:"1px solid #e2e8f0",fontSize:15,marginTop:5,boxSizing:"border-box",background:"#fff",outline:"none"};
  const lb={fontSize:13,fontWeight:600,color:"#475569",display:"block"};
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={onClose}>
      <div style={{background:"#fff",borderRadius:"20px 20px 0 0",padding:24,width:"100%",maxWidth:600,maxHeight:"90vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
        <div style={{fontWeight:800,fontSize:18,marginBottom:16}}>{initial?"Editar produto":"Novo produto"}</div>
        <div style={{marginBottom:12}}><label style={lb}>Nome</label><input style={fi} value={form.name} onChange={e=>set("name",e.target.value)} placeholder="Ex: Whey Adaptogen" /></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
          <div><label style={lb}>Categoria</label><select style={fi} value={form.category} onChange={e=>set("category",e.target.value)}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></div>
          <div><label style={lb}>Sabor</label><input style={fi} value={form.flavor} onChange={e=>set("flavor",e.target.value)} placeholder="Ex: Morango" /></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:12}}>
          <div><label style={lb}>Qtd.</label><input style={fi} type="number" value={form.qty} onChange={e=>set("qty",+e.target.value)} min={0} /></div>
          <div><label style={lb}>Mínimo</label><input style={fi} type="number" value={form.minQty} onChange={e=>set("minQty",+e.target.value)} min={1} /></div>
          <div><label style={lb}>Unidade</label><select style={fi} value={form.unit} onChange={e=>set("unit",e.target.value)}>{UNITS.map(u=><option key={u}>{u}</option>)}</select></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
          <div><label style={lb}>Validade</label><input style={fi} type="date" value={form.validity} onChange={e=>set("validity",e.target.value)} /></div>
          <div><label style={lb}>Preço (R$)</label><input style={fi} type="number" value={form.price} onChange={e=>set("price",+e.target.value)} /></div>
        </div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onClose} style={{flex:1,padding:12,borderRadius:10,border:"1px solid #e2e8f0",background:"#fff",cursor:"pointer",fontWeight:600}}>Cancelar</button>
          <button onClick={()=>{if(!form.name)return alert("Informe o nome");onSave(form);}} style={{flex:2,padding:12,borderRadius:10,border:"none",background:"#3b82f6",color:"#fff",fontWeight:800,fontSize:16,cursor:"pointer"}}>{initial?"Salvar":"Adicionar"}</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ADMIN LOGIN PAGE
// ============================================================
function AdminLoginPage({ onSuccess }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [error, setError] = useState("");

  function handleSubmit() {
    if (email.toLowerCase()===ADMIN_EMAIL.toLowerCase() && senha===ADMIN_SENHA) {
      authorizeDevice();
      const admin={id:"admin",nome:"Admin",role:"admin"};
      saveSession(admin);
      onSuccess(admin);
    } else {
      setError("E-mail ou senha incorretos");
    }
  }

  return (
    <div style={{fontFamily:"'Inter',sans-serif",background:"#0f172a",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:"#1e293b",borderRadius:20,padding:32,width:"100%",maxWidth:360,boxShadow:"0 24px 64px rgba(0,0,0,0.4)"}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:36}}>🔐</div>
          <div style={{fontWeight:800,fontSize:20,color:"#fff",marginTop:10}}>Acesso Restrito</div>
          <div style={{color:"#64748b",fontSize:13,marginTop:4}}>Painel administrativo</div>
        </div>
        <div style={{marginBottom:14}}>
          <label style={{fontSize:12,fontWeight:600,color:"#94a3b8",display:"block",marginBottom:5}}>E-MAIL</label>
          <input type="email" value={email} onChange={e=>{setEmail(e.target.value);setError("");}} onKeyDown={e=>e.key==="Enter"&&handleSubmit()} placeholder="seu@email.com"
            style={{width:"100%",padding:"12px 14px",borderRadius:10,border:"1px solid #334155",background:"#0f172a",color:"#fff",fontSize:15,boxSizing:"border-box",outline:"none"}} />
        </div>
        <div style={{marginBottom:6}}>
          <label style={{fontSize:12,fontWeight:600,color:"#94a3b8",display:"block",marginBottom:5}}>SENHA</label>
          <input type="password" value={senha} onChange={e=>{setSenha(e.target.value);setError("");}} onKeyDown={e=>e.key==="Enter"&&handleSubmit()} placeholder="••••••••"
            style={{width:"100%",padding:"12px 14px",borderRadius:10,border:"1px solid #334155",background:"#0f172a",color:"#fff",fontSize:15,boxSizing:"border-box",outline:"none"}} />
        </div>
        {error && <div style={{color:"#ef4444",fontSize:13,fontWeight:600,marginTop:8}}>{error}</div>}
        <button onClick={handleSubmit} style={{width:"100%",padding:14,borderRadius:12,border:"none",background:"linear-gradient(135deg,#3b82f6,#6366f1)",color:"#fff",fontWeight:800,fontSize:16,cursor:"pointer",marginTop:20}}>Entrar</button>
      </div>
    </div>
  );
}

// ============================================================
// ROOT
// ============================================================
export default function App() {
  const [user, setUser] = useState(()=>getSession());
  const [showAuth, setShowAuth] = useState(false);
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Load products for vitrine
  useEffect(()=>{
    db.select("produtos","").then(data=>{ setProducts(data); setLoadingProducts(false); }).catch(()=>setLoadingProducts(false));
  },[]);

  function handleLogin(u) { setUser(u); setShowAuth(false); }
  function handleLogout() { saveSession(null); setUser(null); }

  const adminRoute = isAdminRoute();

  if (adminRoute) {
    if (isAdminDevice() && user?.role==="admin") return <AdminPanel onLogout={handleLogout} />;
    return <AdminLoginPage onSuccess={u=>setUser(u)} />;
  }

  if (user?.role==="admin") {
    return <AdminPanel onLogout={handleLogout} />;
  }

  return (
    <>
      <Vitrine products={products} loading={loadingProducts} user={user} onLogout={handleLogout} onShowAuth={()=>setShowAuth(true)} />
      {showAuth && <AuthModal onClose={()=>setShowAuth(false)} onLogin={handleLogin} />}
    </>
  );
}
