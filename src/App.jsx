import React, { useState, useEffect, useCallback } from "react";

const SUPABASE_URL   = "https://juqsrwtfwujnievhftgi.supabase.co";
const SUPABASE_ANON  = "sb_publishable_8sFebEhMSp0askniYLBRSg_PtyWGvXB";
const WHATSAPP_NUMBER = "5511988670054";
const ADMIN_EMAIL    = "barbarossuplementossp@gmail.com";
const ADMIN_SENHA    = "D04m007aA*";
const ADMIN_DEVICE_KEY = "supp_auth_device_v2";
const ADMIN_TOKEN    = "tk_" + btoa(ADMIN_EMAIL + ":" + ADMIN_SENHA).slice(0, 24);

const db = {
  async select(table, query = "") {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}&order=created_at.desc`, {
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` }
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
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error(await r.text());
    return true;
  },
  async delete(table, id) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: "DELETE",
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` }
    });
    if (!r.ok) throw new Error(await r.text());
  }
};

const CATEGORIES = ["Whey / Proteína","Creatina","Pré-treino","Vitaminas/Minerais","Aminoácidos","Hipercalórico","Outros"];
const UNITS      = ["un","kg","g","L","ml"];
const PAGAMENTOS = ["Dinheiro","Pix","Débito","Crédito"];

function daysUntil(d) { return Math.ceil((new Date(d) - new Date()) / 86400000); }
function getSession() { try { return JSON.parse(localStorage.getItem("supp_session") || "null"); } catch { return null; } }
function saveSession(s) { localStorage.setItem("supp_session", JSON.stringify(s)); }
function isAdminDevice() { return localStorage.getItem(ADMIN_DEVICE_KEY) === ADMIN_TOKEN; }
function authorizeDevice() { localStorage.setItem(ADMIN_DEVICE_KEY, ADMIN_TOKEN); }
function isAdminRoute() { return window.location.search.includes("admin"); }
function useIsDesktop() {
  const [desk, setDesk] = useState(window.innerWidth >= 900);
  useEffect(() => {
    const fn = () => setDesk(window.innerWidth >= 900);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return desk;
}

const inpS  = (err) => ({ display:"block",width:"100%",padding:"11px 14px",borderRadius:10,border:err?"2px solid #ef4444":"1px solid #e2e8f0",fontSize:15,marginTop:5,boxSizing:"border-box",outline:"none",background:"#fff" });
const lblS  = { fontSize:13,fontWeight:600,color:"#475569",display:"block",marginTop:12 };
const shBot = { position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:100,display:"flex",alignItems:"flex-end",justifyContent:"center" };
const shBox = { background:"#fff",borderRadius:"20px 20px 0 0",padding:24,width:"100%",maxWidth:600,maxHeight:"85vh",overflowY:"auto" };

function Spinner() {
  return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:40}}>
      <div style={{width:32,height:32,border:"3px solid #e2e8f0",borderTop:"3px solid #3b82f6",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ── FIELD ────────────────────────────────────────────────────
function Field({ value, onChange, onEnter, label, type="text", placeholder, error }) {
  const ref = React.useRef(null);
  // Keep cursor position when value changes externally
  React.useLayoutEffect(() => {
    if (ref.current && document.activeElement !== ref.current) {
      ref.current.value = value;
    }
  }, [value]);
  return (
    <div>
      <label style={lblS}>{label}</label>
      <input
        ref={ref}
        type={type}
        placeholder={placeholder}
        defaultValue={value}
        onChange={onChange}
        onKeyDown={e=>{ if(e.key==="Enter"&&onEnter) onEnter(); }}
        style={inpS(error)}
      />
      {error && <div style={{color:"#ef4444",fontSize:12,marginTop:3,fontWeight:600}}>{error}</div>}
    </div>
  );
}

// ── AUTH MODAL ───────────────────────────────────────────────
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
      const existing = await db.select("usuarios",`email=eq.${encodeURIComponent(form.email.toLowerCase())}&select=id`);
      if (existing.length) { setErrors({email:"E-mail já cadastrado"}); return; }
      const [user] = await db.insert("usuarios",{nome:form.nome.trim(),telefone:form.telefone.replace(/\D/g,""),email:form.email.toLowerCase(),senha:form.senha,role:"cliente"});
      saveSession(user); onLogin(user);
    } catch { setGlobalErr("Erro ao cadastrar. Tente novamente."); }
    finally { setLoading(false); }
  }

  async function handleLogin() {
    const e = validate(["email","senha"]);
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    try {
      const users = await db.select("usuarios",`email=eq.${encodeURIComponent(form.email.toLowerCase())}&senha=eq.${encodeURIComponent(form.senha)}`);
      if (!users.length) { setGlobalErr("E-mail ou senha incorretos"); return; }
      saveSession(users[0]); onLogin(users[0]);
    } catch { setGlobalErr("Erro ao conectar."); }
    finally { setLoading(false); }
  }

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={onClose}>
      <div style={{background:"#fff",borderRadius:20,padding:28,width:"100%",maxWidth:380,boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}} onClick={e=>e.stopPropagation()}>
        {mode==="escolha" && (<>
          <div style={{textAlign:"center",marginBottom:24}}>
            <div style={{fontSize:36}}>💪</div>
            <div style={{fontWeight:800,fontSize:20,marginTop:8}}>Bem-vindo!</div>
            <div style={{color:"#64748b",fontSize:14,marginTop:4}}>Entre ou crie sua conta para fazer seu pedido</div>
          </div>
          <button onClick={()=>setMode("login")} style={{width:"100%",padding:14,borderRadius:12,border:"none",background:"#0f172a",color:"#fff",fontWeight:700,fontSize:16,cursor:"pointer",marginBottom:10}}>Entrar</button>
          <button onClick={()=>setMode("cadastro")} style={{width:"100%",padding:14,borderRadius:12,border:"2px solid #e2e8f0",background:"#fff",color:"#0f172a",fontWeight:700,fontSize:16,cursor:"pointer"}}>Criar conta</button>
        </>)}
        {mode==="cadastro" && (<>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
            <button onClick={()=>{setMode("escolha");setErrors({});}} style={{background:"#f1f5f9",border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:15}}>←</button>
            <div style={{fontWeight:800,fontSize:18}}>Criar conta</div>
          </div>
          <Field value={form.nome} onChange={e=>set("nome",e.target.value)} onEnter={handleCadastro} label="Nome completo" placeholder="Seu nome" error={errors.nome}/>
          <Field value={form.telefone} onChange={e=>set("telefone",e.target.value)} onEnter={handleCadastro} label="Telefone (WhatsApp)" type="tel" placeholder="(11) 99999-9999" error={errors.telefone}/>
          <Field value={form.email} onChange={e=>set("email",e.target.value)} onEnter={handleCadastro} label="E-mail" type="email" placeholder="seu@email.com" error={errors.email}/>
          <Field value={form.senha} onChange={e=>set("senha",e.target.value)} onEnter={handleCadastro} label="Senha" type="password" placeholder="Mínimo 4 caracteres" error={errors.senha}/>
          {globalErr && <div style={{color:"#ef4444",fontSize:13,marginTop:10,fontWeight:600}}>{globalErr}</div>}
          <button onClick={handleCadastro} disabled={loading} style={{width:"100%",padding:14,borderRadius:12,border:"none",background:"#0f172a",color:"#fff",fontWeight:700,fontSize:16,cursor:"pointer",marginTop:20,opacity:loading?0.7:1}}>
            {loading?"Cadastrando...":"Cadastrar"}
          </button>
        </>)}
        {mode==="login" && (<>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
            <button onClick={()=>{setMode("escolha");setErrors({});setGlobalErr("");}} style={{background:"#f1f5f9",border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:15}}>←</button>
            <div style={{fontWeight:800,fontSize:18}}>Entrar</div>
          </div>
          <Field value={form.email} onChange={e=>set("email",e.target.value)} onEnter={handleLogin} label="E-mail" type="email" placeholder="seu@email.com" error={errors.email}/>
          <Field value={form.senha} onChange={e=>set("senha",e.target.value)} onEnter={handleLogin} label="Senha" type="password" placeholder="Sua senha" error={errors.senha}/>
          {globalErr && <div style={{color:"#ef4444",fontSize:13,marginTop:10,fontWeight:600}}>{globalErr}</div>}
          <button onClick={handleLogin} disabled={loading} style={{width:"100%",padding:14,borderRadius:12,border:"none",background:"#0f172a",color:"#fff",fontWeight:700,fontSize:16,cursor:"pointer",marginTop:20,opacity:loading?0.7:1}}>
            {loading?"Entrando...":"Entrar"}
          </button>
          <button onClick={()=>{setMode("cadastro");setErrors({});setGlobalErr("");}} style={{width:"100%",padding:10,border:"none",background:"transparent",color:"#6366f1",fontSize:14,fontWeight:600,cursor:"pointer",marginTop:8}}>
            Não tenho conta → Criar conta
          </button>
        </>)}
      </div>
    </div>
  );
}

// ── VITRINE ──────────────────────────────────────────────────
function Vitrine({ products, loading, user, onLogout, onShowAuth, config }) {
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
      const [venda] = await db.insert("vendas",{usuario_id:user.id,cliente:user.nome,total:+cartTotal.toFixed(2),pagamento,status:"pendente"});
      await db.insert("venda_itens",cart.map(i=>({venda_id:venda.id,produto_id:i.productId,product_name:i.productName,flavor:i.flavor,qty:i.qty,price:i.price})));
      setPedidoFeito({cart:[...cart],total:cartTotal,pagamento});
      setCart([]); setPagamento(""); setShowCart(false);
    } catch { showToast("Erro ao registrar pedido.","error"); }
    finally { setSubmitting(false); }
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
      <div style={{fontSize:22,fontWeight:800,marginTop:16,textAlign:"center"}}>Pedido enviado!</div>
      <div style={{color:"#64748b",marginTop:6,textAlign:"center",fontSize:15}}>Envie no WhatsApp para confirmar</div>
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
        <div style={{textAlign:"center",marginTop:6,background:"#fef3c7",borderRadius:8,padding:"6px 10px",fontSize:12,color:"#92400e",fontWeight:600}}>⏳ Aguardando confirmação</div>
      </div>
      <button onClick={abrirWhatsApp} style={{marginTop:24,width:"100%",maxWidth:360,padding:"16px 0",borderRadius:14,border:"none",background:"#25d366",color:"#fff",fontWeight:800,fontSize:17,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10,boxShadow:"0 8px 24px rgba(37,211,102,0.4)"}}>
        <span style={{fontSize:22}}>📲</span> Enviar no WhatsApp
      </button>
      <button onClick={()=>setPedidoFeito(null)} style={{marginTop:12,padding:"10px 24px",borderRadius:10,border:"none",background:"transparent",color:"#94a3b8",fontSize:14,cursor:"pointer"}}>Novo pedido</button>
    </div>
  );

  return (
    <div style={{fontFamily:"'Inter',sans-serif",background:"#f1f5f9",minHeight:"100vh",maxWidth:600,margin:"0 auto",paddingBottom:90}}>
      <div style={{background:`linear-gradient(135deg,${config?.header_color1||"#0f172a"} 0%,${config?.header_color2||"#1e3a5f"} 100%)`,padding:"20px 20px 16px",color:"#fff"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            {config?.logo_url ? <img src={config.logo_url} alt="logo" style={{width:44,height:44,borderRadius:10,objectFit:"cover"}}/> : <span style={{fontSize:28}}>💪</span>}
            <div>
              {(config?.subtitulo||"")!=="" && <div style={{fontSize:11,fontWeight:600,letterSpacing:2,color:"rgba(255,255,255,0.5)",textTransform:"uppercase"}}>{config?.subtitulo||"Loja de"}</div>}
              <div style={{fontSize:20,fontWeight:800}}>{config?.nome_loja||"Suplementos"}</div>
            </div>
          </div>
          {user ? (
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
              <div style={{fontSize:13,fontWeight:700}}>Olá, {user.nome.split(" ")[0]}!</div>
              <button onClick={onLogout} style={{background:"rgba(255,255,255,0.1)",border:"none",borderRadius:16,padding:"4px 12px",color:"#94a3b8",fontSize:12,cursor:"pointer"}}>Sair</button>
            </div>
          ) : (
            <button onClick={onShowAuth} style={{background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:20,padding:"8px 16px",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>Login / Cadastro</button>
          )}
        </div>
        {!user && <div style={{background:"rgba(99,102,241,0.25)",borderRadius:10,padding:"8px 12px",marginTop:12,fontSize:13,color:"#a5b4fc"}}>👆 Entre ou cadastre-se para fazer seu pedido</div>}
      </div>
      <div style={{padding:16}}>
        <input placeholder="🔍 Buscar..." value={search} onChange={e=>setSearch(e.target.value)} style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1px solid #e2e8f0",fontSize:14,outline:"none",background:"#fff",boxSizing:"border-box",marginBottom:12}}/>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
          {["Todos",...CATEGORIES].map(c=>(<button key={c} onClick={()=>setFilterCat(c)} style={{padding:"5px 11px",borderRadius:20,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,background:filterCat===c?"#0f172a":"#e2e8f0",color:filterCat===c?"#fff":"#475569"}}>{c}</button>))}
        </div>
        {loading ? <Spinner /> : (
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:12}}>
            {filtered.map(p=>{
              const inCart=cartQty(p.id),available=p.qty-inCart,sold_out=p.qty===0,maxed=inCart>=p.qty;
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
        <div style={shBot} onClick={()=>setShowCart(false)}>
          <div style={shBox} onClick={e=>e.stopPropagation()}>
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
                {PAGAMENTOS.map(pg=>(<button key={pg} onClick={()=>setPagamento(pg)} style={{padding:"12px 0",borderRadius:10,border:"none",fontWeight:700,fontSize:14,cursor:"pointer",background:pagamento===pg?"#0f172a":"#f1f5f9",color:pagamento===pg?"#fff":"#475569"}}>{pg}</button>))}
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

// ── PRODUCT FORM (shared mobile+desktop) ─────────────────────
function ProductForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState({name:initial?.name||"",category:initial?.category||CATEGORIES[0],flavor:initial?.flavor||"",qty:initial?.qty??1,minQty:initial?.minQty??2,unit:initial?.unit||"un",validity:initial?.validity||"",price:initial?.price??"",costPrice:initial?.costPrice??0});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const fi={display:"block",width:"100%",padding:"10px 12px",borderRadius:10,border:"1px solid #e2e8f0",fontSize:15,marginTop:5,boxSizing:"border-box",background:"#fff",outline:"none"};
  const lb={fontSize:13,fontWeight:600,color:"#475569",display:"block"};
  const margin = form.price>0&&form.costPrice>0 ? (((form.price-form.costPrice)/form.costPrice)*100).toFixed(0) : null;
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={onClose}>
      <div style={{background:"#fff",borderRadius:20,padding:24,width:"100%",maxWidth:500,maxHeight:"90vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
        <div style={{fontWeight:800,fontSize:18,marginBottom:16}}>{initial?"Editar produto":"Novo produto"}</div>
        <div style={{marginBottom:12}}><label style={lb}>Nome</label><input style={fi} value={form.name} onChange={e=>set("name",e.target.value)} placeholder="Ex: Whey Adaptogen"/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
          <div><label style={lb}>Categoria</label><select style={fi} value={form.category} onChange={e=>set("category",e.target.value)}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></div>
          <div><label style={lb}>Sabor</label><input style={fi} value={form.flavor} onChange={e=>set("flavor",e.target.value)} placeholder="Ex: Morango"/></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:12}}>
          <div><label style={lb}>Qtd.</label><input style={fi} type="number" value={form.qty} onChange={e=>set("qty",+e.target.value)} min={0}/></div>
          <div><label style={lb}>Mínimo</label><input style={fi} type="number" value={form.minQty} onChange={e=>set("minQty",+e.target.value)} min={1}/></div>
          <div><label style={lb}>Unidade</label><select style={fi} value={form.unit} onChange={e=>set("unit",e.target.value)}>{UNITS.map(u=><option key={u}>{u}</option>)}</select></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
          <div><label style={lb}>Preço de venda</label><input style={fi} type="number" value={form.price} onChange={e=>set("price",+e.target.value)}/></div>
          <div><label style={lb}>Preço de custo</label><input style={fi} type="number" value={form.costPrice} onChange={e=>set("costPrice",+e.target.value)}/></div>
        </div>
        {margin && <div style={{background:"#d1fae5",borderRadius:10,padding:"8px 14px",fontSize:13,fontWeight:700,color:"#065f46",marginBottom:12}}>Margem de lucro: {margin}%</div>}
        <div style={{marginBottom:20}}><label style={lb}>Validade</label><input style={fi} type="date" value={form.validity} onChange={e=>set("validity",e.target.value)}/></div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onClose} style={{flex:1,padding:12,borderRadius:10,border:"1px solid #e2e8f0",background:"#fff",cursor:"pointer",fontWeight:600}}>Cancelar</button>
          <button onClick={()=>{if(!form.name)return alert("Informe o nome");onSave(form);}} style={{flex:2,padding:12,borderRadius:10,border:"none",background:"#3b82f6",color:"#fff",fontWeight:800,fontSize:16,cursor:"pointer"}}>{initial?"Salvar":"Adicionar"}</button>
        </div>
      </div>
    </div>
  );
}

// ── ADMIN MOBILE ─────────────────────────────────────────────
function AdminMobile({ data, actions }) {
  const { products, pedidos, rejeitados, sales, usuarios, config, loadingP, loadingPedidos, loadingS, alertDays, alerts, totalValue, monthRevenue, monthlySales } = data;
  const { confirmarPedido, rejeitarPedido, handleSaveProduct, handleDelete, saveConfig, setConfig, showAddProduct, setShowAddProduct, editProduct, setEditProduct, toast } = actions;
  const [tab, setTab] = useState("pedidos");
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("Todos");

  const filtered = products.filter(p=>{
    const m=(p.name+p.flavor).toLowerCase().includes(search.toLowerCase());
    const c=filterCat==="Todos"||p.category===filterCat;
    return m&&c;
  });

  return (
    <div style={{fontFamily:"'Inter',sans-serif",background:"#f1f5f9",minHeight:"100vh",maxWidth:600,margin:"0 auto",paddingBottom:90}}>
      <div style={{background:"linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%)",padding:"20px 20px 0",color:"#fff"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {config?.logo_url ? <img src={config.logo_url} alt="logo" style={{width:36,height:36,borderRadius:8,objectFit:"cover"}}/> : <span style={{fontSize:22}}>💪</span>}
            <div>
              {(config?.subtitulo||"")!=="" && <div style={{fontSize:10,fontWeight:600,letterSpacing:2,color:"#94a3b8",textTransform:"uppercase"}}>{config?.subtitulo}</div>}
              <div style={{fontSize:18,fontWeight:800}}>{config?.nome_loja||"Suplementos"}</div>
            </div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {alerts.length>0&&<div style={{background:"#ef4444",borderRadius:20,padding:"4px 12px",fontSize:13,fontWeight:700,cursor:"pointer"}} onClick={()=>setTab("alertas")}>⚠ {alerts.length}</div>}
            <button onClick={actions.onLogout} style={{background:"rgba(255,255,255,0.1)",border:"none",borderRadius:16,padding:"6px 12px",color:"#94a3b8",fontSize:12,cursor:"pointer"}}>Sair</button>
          </div>
        </div>
        <div style={{background:"rgba(59,130,246,0.2)",borderRadius:8,padding:"5px 12px",marginBottom:12,display:"inline-flex"}}>
          <span style={{fontSize:12,color:"#93c5fd",fontWeight:700}}>🔐 Admin</span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:0}}>
          {[{label:"Produtos",value:products.length},{label:"Estoque",value:`R$${totalValue.toFixed(0)}`},{label:"Mês",value:`R$${monthRevenue.toFixed(0)}`}].map(s=>(
            <div key={s.label} style={{background:"rgba(255,255,255,0.08)",borderRadius:10,padding:"8px",textAlign:"center"}}>
              <div style={{fontSize:16,fontWeight:800}}>{s.value}</div>
              <div style={{fontSize:10,color:"#94a3b8",textTransform:"uppercase"}}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{display:"flex",marginTop:16,overflowX:"auto"}}>
          {[["pedidos",`🛒${pedidos.length>0?` (${pedidos.length})`:""}`],["estoque","📦"],["vendas","💰"],["clientes","👥"],["alertas","⚠"],["config","⚙️"]].map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id)} style={{flex:1,padding:"10px 4px",border:"none",cursor:"pointer",fontSize:11,fontWeight:600,background:"transparent",color:tab===id?"#fff":"#64748b",borderBottom:tab===id?"2px solid #3b82f6":"2px solid transparent",whiteSpace:"nowrap"}}>{label}</button>
          ))}
        </div>
      </div>
      <div style={{padding:16}}>
        {tab==="pedidos" && <PedidosView pedidos={pedidos} rejeitados={rejeitados} loading={loadingPedidos} onConfirm={confirmarPedido} onReject={rejeitarPedido}/>}
        {tab==="estoque" && (
          <>
            <div style={{display:"flex",gap:8,marginBottom:12}}>
              <input placeholder="🔍 Buscar..." value={search} onChange={e=>setSearch(e.target.value)} style={{flex:1,padding:"10px 12px",borderRadius:10,border:"1px solid #e2e8f0",fontSize:14,outline:"none",background:"#fff"}}/>
              <button onClick={()=>{setEditProduct(null);setShowAddProduct(true);}} style={{background:"#3b82f6",color:"#fff",border:"none",borderRadius:10,padding:"0 16px",fontSize:22,cursor:"pointer",fontWeight:700}}>+</button>
            </div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
              {["Todos",...CATEGORIES].map(c=>(<button key={c} onClick={()=>setFilterCat(c)} style={{padding:"5px 10px",borderRadius:20,border:"none",cursor:"pointer",fontSize:11,fontWeight:600,background:filterCat===c?"#0f172a":"#e2e8f0",color:filterCat===c?"#fff":"#475569"}}>{c}</button>))}
            </div>
            {loadingP ? <Spinner/> : filtered.map(p=>{
              const days=p.validity?daysUntil(p.validity):999;
              const margin=p.cost_price>0?(((Number(p.price)-Number(p.cost_price))/Number(p.cost_price))*100).toFixed(0):null;
              return (
                <div key={p.id} style={{background:"#fff",borderRadius:14,padding:14,marginBottom:10,boxShadow:"0 1px 4px rgba(0,0,0,0.07)"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:15}}>{p.name}</div>
                      <div style={{color:"#64748b",fontSize:13}}>{p.category} · <span style={{color:"#6366f1",fontWeight:600}}>{p.flavor}</span></div>
                    </div>
                    <span style={{background:p.qty===0?"#fee2e2":p.qty<=p.min_qty?"#fef3c7":"#d1fae5",color:p.qty===0?"#dc2626":p.qty<=p.min_qty?"#b45309":"#065f46",borderRadius:6,padding:"2px 10px",fontSize:13,fontWeight:800}}>
                      {p.qty<=p.min_qty&&p.qty>0?"⚠ ":""}{p.qty} {p.unit}
                    </span>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginTop:8,flexWrap:"wrap"}}>
                    {p.validity&&<span style={{background:days<0?"#fee2e2":days<=alertDays?"#fef3c7":"#d1fae5",color:days<0?"#dc2626":days<=alertDays?"#d97706":"#059669",borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:600}}>{days<0?"Vencido":days<=alertDays?`⚠ ${new Date(p.validity+"T12:00").toLocaleDateString("pt-BR")}`:new Date(p.validity+"T12:00").toLocaleDateString("pt-BR")}</span>}
                    <span style={{fontSize:12,color:"#64748b"}}>Mín:{p.min_qty}</span>
                    <div style={{marginLeft:"auto",textAlign:"right"}}>
                      <div style={{fontSize:13,fontWeight:700}}>R$ {Number(p.price).toFixed(2)}</div>
                      {margin&&<div style={{fontSize:11,color:"#16a34a",fontWeight:600}}>Lucro: {margin}%</div>}
                    </div>
                  </div>
                  <div style={{display:"flex",gap:8,marginTop:10}}>
                    <button onClick={()=>{setEditProduct({...p,minQty:p.min_qty,costPrice:p.cost_price});setShowAddProduct(true);}} style={{flex:1,background:"#f1f5f9",border:"none",borderRadius:8,padding:"8px 0",cursor:"pointer",fontSize:13,fontWeight:600}}>✏️ Editar</button>
                    <button onClick={()=>handleDelete(p.id)} style={{background:"#fff0f0",border:"none",borderRadius:8,padding:"8px 14px",cursor:"pointer"}}>🗑</button>
                  </div>
                </div>
              );
            })}
          </>
        )}
        {tab==="vendas" && <VendasView sales={sales} loading={loadingS} monthRevenue={monthRevenue} monthlySales={monthlySales} products={products}/>}
        {tab==="clientes" && <ClientesView sales={sales} loadingS={loadingS} usuarios={usuarios}/>}
        {tab==="alertas" && <AlertasView alerts={alerts} alertDays={alertDays} onEdit={p=>{setEditProduct({...p,minQty:p.min_qty,costPrice:p.cost_price});setShowAddProduct(true);}}/>}
        {tab==="config" && <ConfigView config={config} setConfig={setConfig} onSave={saveConfig} saving={savingConfig}/>}
      </div>
      {toast&&<div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:toast.type==="error"?"#ef4444":toast.type==="info"?"#64748b":"#22c55e",color:"#fff",padding:"12px 24px",borderRadius:12,fontWeight:700,fontSize:14,zIndex:300,maxWidth:"90vw",textAlign:"center"}}>{toast.msg}</div>}
    </div>
  );
}

// ── ADMIN DESKTOP ─────────────────────────────────────────────
function AdminDesktop({ data, actions }) {
  const { products, pedidos, rejeitados, sales, usuarios, config, loadingP, loadingPedidos, loadingS, alertDays, alerts, totalValue, monthRevenue, monthlySales } = data;
  const { confirmarPedido, rejeitarPedido, handleSaveProduct, handleDelete, saveConfig, setConfig, showAddProduct, setShowAddProduct, editProduct, setEditProduct, toast, savingConfig } = actions;
  const [tab, setTab] = useState("overview");
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("Todos");
  const [selectedProduct, setSelectedProduct] = useState(null);

  const filtered = products.filter(p=>{
    const m=(p.name+p.flavor).toLowerCase().includes(search.toLowerCase());
    const c=filterCat==="Todos"||p.category===filterCat;
    return m&&c;
  });

  const navItems = [
    { id:"overview",  icon:"🏠", label:"Visão Geral" },
    { id:"pedidos",   icon:"🛒", label:"Pedidos", badge: pedidos.length },
    { id:"estoque",   icon:"📦", label:"Estoque" },
    { id:"vendas",    icon:"💰", label:"Vendas" },
    { id:"clientes",  icon:"👥", label:"Clientes" },
    { id:"alertas",   icon:"⚠️",  label:"Alertas", badge: alerts.length, badgeColor:"#ef4444" },
    { id:"config",    icon:"⚙️",  label:"Config" },
  ];

  return (
    <div style={{fontFamily:"'Inter',sans-serif",display:"flex",minHeight:"100vh",background:"#f1f5f9"}}>
      {/* SIDEBAR */}
      <div style={{width:240,background:"linear-gradient(180deg,#0f172a 0%,#1e293b 100%)",display:"flex",flexDirection:"column",position:"fixed",top:0,left:0,bottom:0,zIndex:10}}>
        <div style={{padding:"28px 20px 20px"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            {config?.logo_url ? <img src={config.logo_url} alt="logo" style={{width:40,height:40,borderRadius:10,objectFit:"cover"}}/> : <span style={{fontSize:28}}>💪</span>}
            <div>
              {(config?.subtitulo||"")!=="" && <div style={{fontSize:10,fontWeight:700,letterSpacing:2,color:"#475569",textTransform:"uppercase"}}>{config?.subtitulo}</div>}
              <div style={{fontSize:18,fontWeight:800,color:"#fff"}}>{config?.nome_loja||"Suplementos"}</div>
            </div>
          </div>
          <div style={{background:"rgba(59,130,246,0.2)",borderRadius:6,padding:"4px 10px",display:"inline-flex"}}>
            <span style={{fontSize:11,color:"#93c5fd",fontWeight:700}}>🔐 Admin</span>
          </div>
        </div>

        {/* Stats sidebar */}
        <div style={{padding:"0 12px",marginBottom:20}}>
          {[{label:"Produtos",value:products.length},{label:"Estoque",value:`R$ ${totalValue.toFixed(0)}`},{label:"Vendas/mês",value:`R$ ${monthRevenue.toFixed(0)}`}].map(s=>(
            <div key={s.label} style={{background:"rgba(255,255,255,0.05)",borderRadius:10,padding:"10px 12px",marginBottom:8}}>
              <div style={{fontSize:16,fontWeight:800,color:"#fff"}}>{s.value}</div>
              <div style={{fontSize:10,color:"#64748b",textTransform:"uppercase",letterSpacing:1}}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Nav */}
        <nav style={{flex:1,padding:"0 10px"}}>
          {navItems.map(item=>(
            <button key={item.id} onClick={()=>setTab(item.id)} style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"11px 14px",borderRadius:10,border:"none",cursor:"pointer",marginBottom:4,background:tab===item.id?"rgba(59,130,246,0.2)":"transparent",color:tab===item.id?"#93c5fd":"#64748b",fontWeight:tab===item.id?700:500,fontSize:14,textAlign:"left",transition:"all .15s"}}>
              <span style={{fontSize:16}}>{item.icon}</span>
              <span style={{flex:1}}>{item.label}</span>
              {item.badge>0&&<span style={{background:item.badgeColor||"#3b82f6",color:"#fff",borderRadius:10,padding:"1px 7px",fontSize:11,fontWeight:700}}>{item.badge}</span>}
            </button>
          ))}
        </nav>

        <div style={{padding:"16px 12px"}}>
          <button onClick={actions.onLogout} style={{width:"100%",padding:"10px 0",borderRadius:10,border:"1px solid #334155",background:"transparent",color:"#64748b",fontSize:13,fontWeight:600,cursor:"pointer"}}>Sair</button>
        </div>
      </div>

      {/* MAIN */}
      <div style={{marginLeft:240,flex:1,padding:28,minHeight:"100vh"}}>

        {/* OVERVIEW */}
        {tab==="overview" && (
          <div>
            <div style={{fontSize:22,fontWeight:800,color:"#0f172a",marginBottom:6}}>Visão Geral</div>
            <div style={{color:"#64748b",fontSize:14,marginBottom:24}}>{new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"})}</div>

            {/* KPI cards */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,marginBottom:24}}>
              {[
                {label:"Pedidos pendentes",value:pedidos.length,color:"#f59e0b",bg:"#fef3c7"},
                {label:"Alertas ativos",value:alerts.length,color:"#ef4444",bg:"#fee2e2"},
                {label:"Produtos em estoque",value:products.reduce((s,p)=>s+p.qty,0),color:"#3b82f6",bg:"#dbeafe"},
                {label:"Faturamento do mês",value:`R$ ${monthRevenue.toFixed(2)}`,color:"#22c55e",bg:"#d1fae5"},
              ].map(k=>(
                <div key={k.label} style={{background:"#fff",borderRadius:16,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,0.07)"}}>
                  <div style={{fontSize:28,fontWeight:800,color:k.color}}>{k.value}</div>
                  <div style={{fontSize:13,color:"#64748b",marginTop:4}}>{k.label}</div>
                </div>
              ))}
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
              {/* Pedidos pendentes */}
              <div style={{background:"#fff",borderRadius:16,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,0.07)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                  <div style={{fontWeight:700,fontSize:16}}>🛒 Pedidos pendentes</div>
                  <button onClick={()=>setTab("pedidos")} style={{background:"#f1f5f9",border:"none",borderRadius:8,padding:"4px 12px",fontSize:12,cursor:"pointer",fontWeight:600}}>Ver todos</button>
                </div>
                {loadingPedidos ? <Spinner/> : pedidos.length===0 ? (
                  <div style={{textAlign:"center",color:"#94a3b8",padding:20}}>✅ Nenhum pedido pendente</div>
                ) : pedidos.slice(0,3).map(pedido=>(
                  <div key={pedido.id} style={{borderBottom:"1px solid #f1f5f9",paddingBottom:12,marginBottom:12}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div>
                        <div style={{fontWeight:700,fontSize:14}}>{pedido.cliente}</div>
                        <div style={{fontSize:12,color:"#94a3b8"}}>{new Date(pedido.created_at).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontWeight:800,color:"#0f172a"}}>R$ {Number(pedido.total).toFixed(2)}</div>
                        <div style={{fontSize:11,color:"#64748b"}}>{pedido.pagamento}</div>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:8,marginTop:8}}>
                      <button onClick={()=>rejeitarPedido(pedido)} style={{flex:1,padding:"6px 0",borderRadius:8,border:"none",background:"#fee2e2",color:"#dc2626",fontWeight:700,fontSize:12,cursor:"pointer"}}>✕ Rejeitar</button>
                      <button onClick={()=>confirmarPedido(pedido)} style={{flex:2,padding:"6px 0",borderRadius:8,border:"none",background:"#22c55e",color:"#fff",fontWeight:700,fontSize:12,cursor:"pointer"}}>✓ Confirmar</button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Alertas */}
              <div style={{background:"#fff",borderRadius:16,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,0.07)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                  <div style={{fontWeight:700,fontSize:16}}>⚠️ Alertas</div>
                  <button onClick={()=>setTab("alertas")} style={{background:"#f1f5f9",border:"none",borderRadius:8,padding:"4px 12px",fontSize:12,cursor:"pointer",fontWeight:600}}>Ver todos</button>
                </div>
                {alerts.length===0 ? (
                  <div style={{textAlign:"center",color:"#94a3b8",padding:20}}>✅ Nenhum alerta</div>
                ) : alerts.slice(0,5).map(p=>{
                  const days=p.validity?daysUntil(p.validity):999;
                  return (
                    <div key={p.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid #f1f5f9",paddingBottom:8,marginBottom:8}}>
                      <div>
                        <div style={{fontWeight:600,fontSize:13}}>{p.name} <span style={{color:"#6366f1"}}>({p.flavor})</span></div>
                        {p.qty<=p.min_qty&&<div style={{fontSize:11,color:"#ef4444",fontWeight:600}}>{p.qty===0?"Sem estoque":`Baixo: ${p.qty}`}</div>}
                        {p.validity&&days<=alertDays&&<div style={{fontSize:11,color:"#d97706",fontWeight:600}}>{days<0?"Vencido":`Vence em ${days}d`}</div>}
                      </div>
                      <button onClick={()=>{setEditProduct({...p,minQty:p.min_qty,costPrice:p.cost_price});setShowAddProduct(true);}} style={{background:"#f1f5f9",border:"none",borderRadius:6,padding:"4px 10px",fontSize:12,cursor:"pointer",fontWeight:600}}>Editar</button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* PEDIDOS */}
        {tab==="pedidos" && (
          <div>
            <div style={{fontSize:22,fontWeight:800,color:"#0f172a",marginBottom:20}}>🛒 Pedidos</div>
            <PedidosView pedidos={pedidos} rejeitados={rejeitados} loading={loadingPedidos} onConfirm={confirmarPedido} onReject={rejeitarPedido} desktop/>
          </div>
        )}

        {/* ESTOQUE */}
        {tab==="estoque" && (
          <div style={{display:"flex",gap:20}}>
            <div style={{flex:1}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
                <div style={{fontSize:22,fontWeight:800,color:"#0f172a"}}>📦 Estoque</div>
                <button onClick={()=>{setEditProduct(null);setShowAddProduct(true);}} style={{background:"#3b82f6",color:"#fff",border:"none",borderRadius:10,padding:"10px 20px",fontSize:14,fontWeight:700,cursor:"pointer"}}>+ Novo produto</button>
              </div>
              <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap"}}>
                <input placeholder="🔍 Buscar produto ou sabor..." value={search} onChange={e=>setSearch(e.target.value)} style={{flex:1,minWidth:200,padding:"10px 14px",borderRadius:10,border:"1px solid #e2e8f0",fontSize:14,outline:"none",background:"#fff"}}/>
                <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} style={{padding:"10px 14px",borderRadius:10,border:"1px solid #e2e8f0",fontSize:14,outline:"none",background:"#fff",cursor:"pointer"}}>
                  {["Todos",...CATEGORIES].map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
              {loadingP ? <Spinner/> : (
                <div style={{background:"#fff",borderRadius:16,boxShadow:"0 1px 4px rgba(0,0,0,0.07)",overflow:"hidden"}}>
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead>
                      <tr style={{background:"#f8fafc",borderBottom:"2px solid #e2e8f0"}}>
                        {["Produto","Sabor","Categoria","Qtd","Validade","Venda","Custo","Margem",""].map(h=>(
                          <th key={h} style={{textAlign:"left",padding:"12px 14px",fontSize:12,color:"#64748b",fontWeight:700,whiteSpace:"nowrap"}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(p=>{
                        const days=p.validity?daysUntil(p.validity):999;
                        const margin=p.cost_price>0?(((Number(p.price)-Number(p.cost_price))/Number(p.cost_price))*100).toFixed(0):"-";
                        const isSelected=selectedProduct?.id===p.id;
                        return (
                          <tr key={p.id} onClick={()=>setSelectedProduct(isSelected?null:p)} style={{borderBottom:"1px solid #f1f5f9",cursor:"pointer",background:isSelected?"#eff6ff":"#fff",transition:"background .1s"}}>
                            <td style={{padding:"12px 14px",fontWeight:700,fontSize:14}}>{p.name}</td>
                            <td style={{padding:"12px 14px",fontSize:13,color:"#6366f1",fontWeight:600}}>{p.flavor}</td>
                            <td style={{padding:"12px 14px",fontSize:12,color:"#64748b"}}>{p.category}</td>
                            <td style={{padding:"12px 14px"}}>
                              <span style={{background:p.qty===0?"#fee2e2":p.qty<=p.min_qty?"#fef3c7":"#d1fae5",color:p.qty===0?"#dc2626":p.qty<=p.min_qty?"#b45309":"#065f46",borderRadius:6,padding:"2px 8px",fontSize:13,fontWeight:800}}>{p.qty} {p.unit}</span>
                            </td>
                            <td style={{padding:"12px 14px"}}>
                              {p.validity ? <span style={{background:days<0?"#fee2e2":days<=alertDays?"#fef3c7":"transparent",color:days<0?"#dc2626":days<=alertDays?"#d97706":"#64748b",borderRadius:6,padding:"2px 6px",fontSize:12,fontWeight:days<=alertDays?700:400}}>
                                {days<0?"Vencido":days<=alertDays?`⚠ ${new Date(p.validity+"T12:00").toLocaleDateString("pt-BR")}`:new Date(p.validity+"T12:00").toLocaleDateString("pt-BR")}
                              </span> : <span style={{color:"#cbd5e1"}}>—</span>}
                            </td>
                            <td style={{padding:"12px 14px",fontWeight:700,fontSize:13}}>R$ {Number(p.price).toFixed(2)}</td>
                            <td style={{padding:"12px 14px",fontSize:13,color:"#64748b"}}>{p.cost_price>0?`R$ ${Number(p.cost_price).toFixed(2)}`:"—"}</td>
                            <td style={{padding:"12px 14px"}}>
                              {margin!=="-"?<span style={{color:"#16a34a",fontWeight:700,fontSize:13}}>{margin}%</span>:<span style={{color:"#cbd5e1"}}>—</span>}
                            </td>
                            <td style={{padding:"12px 14px"}}>
                              <button onClick={e=>{e.stopPropagation();handleDelete(p.id);}} style={{background:"#fff0f0",border:"none",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:13}}>🗑</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {filtered.length===0&&<div style={{textAlign:"center",color:"#94a3b8",padding:32}}>Nenhum produto encontrado</div>}
                </div>
              )}
            </div>

            {/* PAINEL LATERAL */}
            {selectedProduct && (
              <div style={{width:300,background:"#fff",borderRadius:16,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,0.07)",alignSelf:"flex-start",position:"sticky",top:20}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                  <div style={{fontWeight:800,fontSize:16}}>Detalhes</div>
                  <button onClick={()=>setSelectedProduct(null)} style={{background:"#f1f5f9",border:"none",borderRadius:8,padding:"4px 10px",cursor:"pointer",fontSize:14}}>✕</button>
                </div>
                <div style={{fontSize:18,fontWeight:800,color:"#0f172a",marginBottom:2}}>{selectedProduct.name}</div>
                <div style={{fontSize:14,color:"#6366f1",fontWeight:600,marginBottom:16}}>{selectedProduct.flavor}</div>
                {[
                  {label:"Categoria",value:selectedProduct.category},
                  {label:"Quantidade",value:`${selectedProduct.qty} ${selectedProduct.unit}`},
                  {label:"Estoque mínimo",value:`${selectedProduct.min_qty} ${selectedProduct.unit}`},
                  {label:"Validade",value:selectedProduct.validity?new Date(selectedProduct.validity+"T12:00").toLocaleDateString("pt-BR"):"—"},
                  {label:"Preço de venda",value:`R$ ${Number(selectedProduct.price).toFixed(2)}`},
                  {label:"Preço de custo",value:selectedProduct.cost_price>0?`R$ ${Number(selectedProduct.cost_price).toFixed(2)}`:"—"},
                  {label:"Margem de lucro",value:selectedProduct.cost_price>0?`${(((Number(selectedProduct.price)-Number(selectedProduct.cost_price))/Number(selectedProduct.cost_price))*100).toFixed(0)}%`:"—"},
                ].map(row=>(
                  <div key={row.label} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #f1f5f9"}}>
                    <span style={{fontSize:13,color:"#64748b"}}>{row.label}</span>
                    <span style={{fontSize:13,fontWeight:700,color:"#0f172a"}}>{row.value}</span>
                  </div>
                ))}
                <button onClick={()=>{setEditProduct({...selectedProduct,minQty:selectedProduct.min_qty,costPrice:selectedProduct.cost_price});setShowAddProduct(true);setSelectedProduct(null);}} style={{width:"100%",marginTop:16,padding:"11px 0",borderRadius:10,border:"none",background:"#3b82f6",color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer"}}>✏️ Editar produto</button>
              </div>
            )}
          </div>
        )}

        {/* VENDAS */}
        {tab==="vendas" && (
          <div>
            <div style={{fontSize:22,fontWeight:800,color:"#0f172a",marginBottom:20}}>💰 Vendas</div>
            <VendasView sales={sales} loading={loadingS} monthRevenue={monthRevenue} monthlySales={monthlySales} desktop products={products}/>
          </div>
        )}

        {/* ALERTAS */}
        {tab==="alertas" && (
          <div>
            <div style={{fontSize:22,fontWeight:800,color:"#0f172a",marginBottom:20}}>⚠️ Alertas</div>
            {alerts.length===0 ? (
              <div style={{background:"#fff",borderRadius:16,padding:48,textAlign:"center",color:"#22c55e",fontSize:16,fontWeight:600}}>✅ Tudo certo! Nenhum alerta.</div>
            ) : (
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:12}}>
                {alerts.map(p=>{
                  const days=p.validity?daysUntil(p.validity):999;
                  return (
                    <div key={p.id} style={{background:"#fff",borderRadius:14,padding:18,boxShadow:"0 1px 4px rgba(0,0,0,0.07)",borderLeft:`4px solid ${p.qty===0?"#ef4444":"#f59e0b"}`}}>
                      <div style={{fontWeight:700,fontSize:15}}>{p.name} <span style={{color:"#6366f1"}}>({p.flavor})</span></div>
                      {p.qty<=p.min_qty&&<div style={{color:p.qty===0?"#ef4444":"#d97706",fontSize:13,marginTop:4,fontWeight:600}}>{p.qty===0?"🚨 Sem estoque!":`⚠ Estoque baixo: ${p.qty} (mín. ${p.min_qty})`}</div>}
                      {p.validity&&days<=alertDays&&<div style={{color:days<0?"#ef4444":"#d97706",fontSize:13,marginTop:4,fontWeight:600}}>{days<0?"🚨 Produto vencido!":`⚠ Vence em ${days} dias — considere uma promoção!`}</div>}
                      <button onClick={()=>{setEditProduct({...p,minQty:p.min_qty,costPrice:p.cost_price});setShowAddProduct(true);}} style={{marginTop:12,background:"#f1f5f9",border:"none",borderRadius:8,padding:"7px 14px",fontSize:13,cursor:"pointer",fontWeight:600}}>Editar produto</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* CLIENTES */}
        {tab==="clientes" && (
          <ClientesView sales={sales} loadingS={loadingS} usuarios={usuarios}/>
        )}

        {/* CONFIG */}
        {tab==="config" && (
          <div>
            <ConfigView config={config} setConfig={setConfig} onSave={saveConfig} saving={savingConfig}/>
          </div>
        )}
      </div>

      {toast&&<div style={{position:"fixed",bottom:24,right:24,background:toast.type==="error"?"#ef4444":toast.type==="info"?"#64748b":"#22c55e",color:"#fff",padding:"14px 24px",borderRadius:12,fontWeight:700,fontSize:14,zIndex:300,boxShadow:"0 8px 24px rgba(0,0,0,0.2)"}}>{toast.msg}</div>}
    </div>
  );
}

// ── SHARED VIEWS ─────────────────────────────────────────────
function PedidosView({ pedidos, rejeitados, loading, onConfirm, onReject, desktop }) {
  const [subTab, setSubTab] = useState("pendentes");

  const SubTabs = () => (
    <div style={{display:"flex",gap:8,marginBottom:16}}>
      {[["pendentes",`⏳ Pendentes (${pedidos.length})`],["rejeitados",`✕ Rejeitados (${(rejeitados||[]).length})`]].map(([id,label])=>(
        <button key={id} onClick={()=>setSubTab(id)} style={{padding:"7px 16px",borderRadius:20,border:"none",cursor:"pointer",fontSize:13,fontWeight:600,background:subTab===id?(id==="rejeitados"?"#fee2e2":"#0f172a"):"#e2e8f0",color:subTab===id?(id==="rejeitados"?"#dc2626":"#fff"):"#475569"}}>
          {label}
        </button>
      ))}
    </div>
  );

  if (loading) return <><SubTabs/><Spinner/></>;

  if (subTab==="rejeitados") {
    const lista = rejeitados||[];
    return (
      <>
        <SubTabs/>
        {lista.length===0 ? (
          <div style={{textAlign:"center",color:"#94a3b8",padding:40}}><div style={{fontSize:40,marginBottom:8}}>✅</div><div style={{fontWeight:600}}>Nenhum pedido rejeitado</div></div>
        ) : lista.map(pedido=>(
          <div key={pedido.id} style={{background:"#fff",borderRadius:14,padding:desktop?20:14,marginBottom:12,boxShadow:"0 1px 4px rgba(0,0,0,0.07)",borderLeft:"4px solid #ef4444",opacity:0.85}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div>
                <div style={{fontWeight:700,fontSize:desktop?16:15}}>{pedido.cliente}</div>
                <div style={{fontSize:12,color:"#94a3b8"}}>{new Date(pedido.created_at).toLocaleDateString("pt-BR")} {new Date(pedido.created_at).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontWeight:800,fontSize:desktop?18:16,color:"#64748b"}}>R$ {Number(pedido.total).toFixed(2)}</div>
                <span style={{background:"#fee2e2",color:"#dc2626",borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700}}>Rejeitado</span>
              </div>
            </div>
            {desktop ? (
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{borderBottom:"2px solid #f1f5f9"}}>{["Produto","Sabor","Qtd","Valor"].map(h=><th key={h} style={{textAlign:"left",padding:"6px 8px",fontSize:12,color:"#94a3b8",fontWeight:600}}>{h}</th>)}</tr></thead>
                <tbody>{pedido.items.map((item,i)=>(
                  <tr key={i} style={{borderBottom:"1px solid #f8fafc"}}>
                    <td style={{padding:"8px",fontSize:14,fontWeight:600}}>{item.product_name}</td>
                    <td style={{padding:"8px",fontSize:13,color:"#6366f1",fontWeight:600}}>{item.flavor}</td>
                    <td style={{padding:"8px",fontSize:14}}>{item.qty}</td>
                    <td style={{padding:"8px",fontSize:14,fontWeight:700}}>R$ {(item.price*item.qty).toFixed(2)}</td>
                  </tr>
                ))}</tbody>
              </table>
            ) : pedido.items.map((item,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderTop:"1px solid #f1f5f9"}}>
                <div><div style={{fontWeight:600,fontSize:13}}>{item.product_name}</div><div style={{color:"#6366f1",fontSize:12}}>{item.flavor} × {item.qty}</div></div>
                <div style={{fontWeight:600,fontSize:13}}>R$ {(item.price*item.qty).toFixed(2)}</div>
              </div>
            ))}
          </div>
        ))}
      </>
    );
  }

  // Pendentes
  return (
    <>
      <SubTabs/>
      {pedidos.length===0 ? (
        <div style={{textAlign:"center",color:"#94a3b8",padding:40}}><div style={{fontSize:40,marginBottom:8}}>✅</div><div style={{fontWeight:600}}>Nenhum pedido pendente</div></div>
      ) : pedidos.map(pedido=>(
        <div key={pedido.id} style={{background:"#fff",borderRadius:desktop?16:14,padding:desktop?20:14,marginBottom:12,boxShadow:"0 1px 4px rgba(0,0,0,0.07)",borderLeft:"4px solid #f59e0b"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div>
              <div style={{fontWeight:700,fontSize:desktop?16:15}}>{pedido.cliente}</div>
              <div style={{fontSize:12,color:"#94a3b8"}}>{new Date(pedido.created_at).toLocaleDateString("pt-BR")} {new Date(pedido.created_at).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontWeight:800,fontSize:desktop?20:17}}>R$ {Number(pedido.total).toFixed(2)}</div>
              <span style={{background:"#fef3c7",color:"#92400e",borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700}}>{pedido.pagamento}</span>
            </div>
          </div>
          {desktop ? (
            <table style={{width:"100%",borderCollapse:"collapse",marginBottom:14}}>
              <thead><tr style={{borderBottom:"2px solid #f1f5f9"}}>{["Produto","Sabor","Qtd","Valor"].map(h=><th key={h} style={{textAlign:"left",padding:"6px 8px",fontSize:12,color:"#94a3b8",fontWeight:600}}>{h}</th>)}</tr></thead>
              <tbody>{pedido.items.map((item,i)=>(
                <tr key={i} style={{borderBottom:"1px solid #f8fafc"}}>
                  <td style={{padding:"8px",fontSize:14,fontWeight:600}}>{item.product_name}</td>
                  <td style={{padding:"8px",fontSize:13,color:"#6366f1",fontWeight:600}}>{item.flavor}</td>
                  <td style={{padding:"8px",fontSize:14}}>{item.qty}</td>
                  <td style={{padding:"8px",fontSize:14,fontWeight:700}}>R$ {(item.price*item.qty).toFixed(2)}</td>
                </tr>
              ))}</tbody>
            </table>
          ) : pedido.items.map((item,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderTop:"1px solid #f1f5f9"}}>
              <div><div style={{fontWeight:600,fontSize:13}}>{item.product_name}</div><div style={{color:"#6366f1",fontSize:12}}>{item.flavor} × {item.qty}</div></div>
              <div style={{fontWeight:600,fontSize:13}}>R$ {(item.price*item.qty).toFixed(2)}</div>
            </div>
          ))}
          <div style={{display:"flex",gap:8,marginTop:12}}>
            <button onClick={()=>onReject(pedido)} style={{flex:1,padding:"10px 0",borderRadius:10,border:"none",background:"#fee2e2",color:"#dc2626",fontWeight:700,fontSize:14,cursor:"pointer"}}>✕ Rejeitar</button>
            <button onClick={()=>onConfirm(pedido)} style={{flex:2,padding:"10px 0",borderRadius:10,border:"none",background:"linear-gradient(135deg,#22c55e,#16a34a)",color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer"}}>✓ Confirmar</button>
          </div>
        </div>
      ))}
    </>
  );
}

function VendasView({ sales, loading, monthRevenue, monthlySales, desktop, products }) {
  const [filtCliente, setFiltCliente] = useState("");
  const [filtPagamento, setFiltPagamento] = useState("Todos");
  const [filtProduto, setFiltProduto] = useState("");
  const [filtDataDe, setFiltDataDe] = useState("");
  const [filtDataAte, setFiltDataAte] = useState("");
  const [filtValMin, setFiltValMin] = useState("");
  const [filtValMax, setFiltValMax] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  if (loading) return <Spinner/>;

  // Apply filters
  const filtered = sales.filter(s=>{
    if (filtCliente && !s.cliente?.toLowerCase().includes(filtCliente.toLowerCase())) return false;
    if (filtPagamento!=="Todos" && s.pagamento!==filtPagamento) return false;
    if (filtDataDe && s.created_at < filtDataDe) return false;
    if (filtDataAte && s.created_at.slice(0,10) > filtDataAte) return false;
    if (filtValMin && Number(s.total) < Number(filtValMin)) return false;
    if (filtValMax && Number(s.total) > Number(filtValMax)) return false;
    if (filtProduto) {
      const match = (s.items||[]).some(i=>i.product_name?.toLowerCase().includes(filtProduto.toLowerCase())||i.flavor?.toLowerCase().includes(filtProduto.toLowerCase()));
      if (!match) return false;
    }
    return true;
  });

  const filtTotal = filtered.reduce((s,v)=>s+Number(v.total),0);
  const hasFilters = filtCliente||filtPagamento!=="Todos"||filtDataDe||filtDataAte||filtValMin||filtValMax||filtProduto;

  function clearFilters() { setFiltCliente(""); setFiltPagamento("Todos"); setFiltDataDe(""); setFiltDataAte(""); setFiltValMin(""); setFiltValMax(""); setFiltProduto(""); }

  // Product ranking
  const prodMap = {};
  filtered.forEach(s=>(s.items||[]).forEach(item=>{
    const k = `${item.product_name} (${item.flavor})`;
    if (!prodMap[k]) prodMap[k]={name:k,qty:0,total:0};
    prodMap[k].qty+=item.qty;
    prodMap[k].total+=item.price*item.qty;
  }));
  const ranking = Object.values(prodMap).sort((a,b)=>b.total-a.total);

  function gerarPDF() {
    const win = window.open("","_blank");
    const dataStr = filtDataDe||filtDataAte ? `${filtDataDe?new Date(filtDataDe+"T12:00").toLocaleDateString("pt-BR"):"início"} até ${filtDataAte?new Date(filtDataAte+"T12:00").toLocaleDateString("pt-BR"):"hoje"}` : "Todo o período";
    const rankingRows = ranking.map((p,i)=>{
      const prodName=p.name.split(" (")[0]; const prodFlavor=p.name.match(/\(([^)]+)\)/)?.[1]||"";
      const prodData=(products||[]).find(pr=>pr.name===prodName&&pr.flavor===prodFlavor);
      const costUnit=prodData?.cost_price?Number(prodData.cost_price):null;
      const saleUnit=p.total/p.qty;
      const totalCost=costUnit?costUnit*p.qty:null;
      const lucro=totalCost?p.total-totalCost:null;
      const margem=lucro?((lucro/p.total)*100).toFixed(1):null;
      return `<tr style="border-bottom:1px solid #e2e8f0">
        <td style="padding:8px">${p.name}</td>
        <td style="padding:8px;text-align:center">${p.qty} un</td>
        <td style="padding:8px;text-align:right">R$ ${saleUnit.toFixed(2)}</td>
        <td style="padding:8px;text-align:right;font-weight:700;color:#16a34a">R$ ${p.total.toFixed(2)}</td>
        <td style="padding:8px;text-align:right;color:#64748b">${costUnit?`R$ ${costUnit.toFixed(2)}`:"—"}</td>
        <td style="padding:8px;text-align:right;color:#64748b">${totalCost?`R$ ${totalCost.toFixed(2)}`:"—"}</td>
        <td style="padding:8px;text-align:right;font-weight:700;color:${lucro&&lucro>0?"#16a34a":"#ef4444"}">${lucro?`R$ ${lucro.toFixed(2)}`:"—"}</td>
        <td style="padding:8px;text-align:center"><span style="background:${margem&&Number(margem)>=30?"#d1fae5":margem&&Number(margem)>=15?"#fef3c7":"#fee2e2"};color:${margem&&Number(margem)>=30?"#065f46":margem&&Number(margem)>=15?"#92400e":"#dc2626"};padding:2px 8px;border-radius:4px;font-weight:700">${margem?margem+"%":"—"}</span></td>
      </tr>`;
    }).join("");
    const vendasRows = filtered.map(s=>`
      <tr style="border-bottom:1px solid #e2e8f0">
        <td style="padding:8px;font-size:12px;color:#64748b">${new Date(s.created_at).toLocaleDateString("pt-BR")}</td>
        <td style="padding:8px;font-weight:600">${s.cliente||"—"}</td>
        <td style="padding:8px;font-size:12px">${(s.items||[]).map(i=>`${i.product_name} (${i.flavor}) ×${i.qty}`).join(", ")}</td>
        <td style="padding:8px"><span style="background:#f1f5f9;border-radius:4px;padding:2px 6px;font-size:11px">${s.pagamento}</span></td>
        <td style="padding:8px;text-align:right;font-weight:700;color:#16a34a">R$ ${Number(s.total).toFixed(2)}</td>
      </tr>`).join("");
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Relatório de Vendas</title>
    <style>body{font-family:Arial,sans-serif;margin:32px;color:#0f172a}h1{font-size:24px;margin-bottom:4px}h2{font-size:16px;margin:24px 0 10px;color:#475569;border-bottom:2px solid #e2e8f0;padding-bottom:6px}table{width:100%;border-collapse:collapse}th{text-align:left;padding:10px 8px;background:#f8fafc;font-size:12px;color:#64748b;font-weight:700}.kpi{display:inline-block;background:#f8fafc;border-radius:10px;padding:14px 20px;margin:6px;text-align:center}.kpi-val{font-size:22px;font-weight:800;color:#0f172a}.kpi-label{font-size:11px;color:#94a3b8;margin-top:2px}@media print{button{display:none}}</style>
    </head><body>
    <h1>📊 Relatório de Vendas</h1>
    <p style="color:#64748b;margin-bottom:20px">Período: <b>${dataStr}</b>${hasFilters?" · Filtros aplicados":""}</p>
    <div>
      <div class="kpi"><div class="kpi-val">R$ ${filtTotal.toFixed(2)}</div><div class="kpi-label">Faturamento</div></div>
      <div class="kpi"><div class="kpi-val">${filtered.length}</div><div class="kpi-label">Vendas</div></div>
      <div class="kpi"><div class="kpi-val">R$ ${filtered.length>0?(filtTotal/filtered.length).toFixed(2):"0,00"}</div><div class="kpi-label">Ticket médio</div></div>
      <div class="kpi"><div class="kpi-val">${ranking.reduce((s,p)=>s+p.qty,0)}</div><div class="kpi-label">Itens vendidos</div></div>
    </div>
    <h2>💰 Lucratividade por Produto</h2>
    <table><thead><tr><th>Produto</th><th style="text-align:center">Qtd</th><th style="text-align:right">Vl.Venda Unit.</th><th style="text-align:right">Total Vendido</th><th style="text-align:right">Vl.Custo Unit.</th><th style="text-align:right">Total Custo</th><th style="text-align:right">Lucro Líquido</th><th style="text-align:center">Margem</th></tr></thead><tbody>${rankingRows}</tbody></table>
    <h2>📋 Detalhamento de Vendas</h2>
    <table><thead><tr><th>Data</th><th>Cliente</th><th>Itens</th><th>Pagamento</th><th style="text-align:right">Total</th></tr></thead><tbody>${vendasRows}</tbody></table>
    <p style="margin-top:32px;color:#94a3b8;font-size:12px">Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}</p>
    <script>window.onload=()=>window.print()</script>
    </body></html>`);
    win.document.close();
  }

  const inpFilt = {padding:"8px 12px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:13,outline:"none",background:"#fff",width:"100%",boxSizing:"border-box"};

  return (<>
    {/* Header */}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
      <div style={{background:"linear-gradient(135deg,#22c55e,#16a34a)",borderRadius:14,padding:"12px 20px",color:"#fff",flex:1,minWidth:200}}>
        <div style={{fontSize:11,fontWeight:600,opacity:.8}}>FATURAMENTO {hasFilters?"(FILTRADO)":"DO MÊS"}</div>
        <div style={{fontSize:26,fontWeight:800}}>R$ {hasFilters?filtTotal.toFixed(2):monthRevenue.toFixed(2)}</div>
        <div style={{fontSize:11,opacity:.8}}>{hasFilters?filtered.length:monthlySales.length} venda{(hasFilters?filtered.length:monthlySales.length)!==1?"s":""}</div>
      </div>
      <div style={{display:"flex",gap:8}}>
        <button onClick={()=>setShowFilters(f=>!f)} style={{padding:"10px 16px",borderRadius:10,border:"1px solid #e2e8f0",background:showFilters?"#0f172a":"#fff",color:showFilters?"#fff":"#475569",fontWeight:600,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
          🔍 Filtros {hasFilters&&<span style={{background:"#3b82f6",color:"#fff",borderRadius:10,padding:"1px 6px",fontSize:11}}>!</span>}
        </button>
        <button onClick={gerarPDF} style={{padding:"10px 16px",borderRadius:10,border:"none",background:"#6366f1",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"}}>
          📄 Exportar PDF
        </button>
      </div>
    </div>

    {/* Filters panel */}
    {showFilters && (
      <div style={{background:"#fff",borderRadius:14,padding:16,marginBottom:16,boxShadow:"0 1px 4px rgba(0,0,0,0.07)"}}>
        <div style={{display:"grid",gridTemplateColumns:desktop?"repeat(3,1fr)":"1fr 1fr",gap:10,marginBottom:10}}>
          <div><label style={{fontSize:11,fontWeight:600,color:"#64748b",display:"block",marginBottom:4}}>CLIENTE</label><input style={inpFilt} placeholder="Nome do cliente..." value={filtCliente} onChange={e=>setFiltCliente(e.target.value)}/></div>
          <div><label style={{fontSize:11,fontWeight:600,color:"#64748b",display:"block",marginBottom:4}}>PRODUTO</label><input style={inpFilt} placeholder="Nome ou sabor..." value={filtProduto} onChange={e=>setFiltProduto(e.target.value)}/></div>
          <div><label style={{fontSize:11,fontWeight:600,color:"#64748b",display:"block",marginBottom:4}}>PAGAMENTO</label>
            <select style={inpFilt} value={filtPagamento} onChange={e=>setFiltPagamento(e.target.value)}>
              {["Todos","Dinheiro","Pix","Débito","Crédito"].map(p=><option key={p}>{p}</option>)}
            </select>
          </div>
          <div><label style={{fontSize:11,fontWeight:600,color:"#64748b",display:"block",marginBottom:4}}>DATA DE</label><input style={inpFilt} type="date" value={filtDataDe} onChange={e=>setFiltDataDe(e.target.value)}/></div>
          <div><label style={{fontSize:11,fontWeight:600,color:"#64748b",display:"block",marginBottom:4}}>DATA ATÉ</label><input style={inpFilt} type="date" value={filtDataAte} onChange={e=>setFiltDataAte(e.target.value)}/></div>
          <div style={{display:"flex",gap:8}}>
            <div style={{flex:1}}><label style={{fontSize:11,fontWeight:600,color:"#64748b",display:"block",marginBottom:4}}>VALOR MÍN</label><input style={inpFilt} type="number" placeholder="R$ 0" value={filtValMin} onChange={e=>setFiltValMin(e.target.value)}/></div>
            <div style={{flex:1}}><label style={{fontSize:11,fontWeight:600,color:"#64748b",display:"block",marginBottom:4}}>VALOR MÁX</label><input style={inpFilt} type="number" placeholder="R$ 999" value={filtValMax} onChange={e=>setFiltValMax(e.target.value)}/></div>
          </div>
        </div>
        {hasFilters&&<button onClick={clearFilters} style={{padding:"6px 14px",borderRadius:8,border:"none",background:"#fee2e2",color:"#dc2626",fontWeight:600,fontSize:12,cursor:"pointer"}}>✕ Limpar filtros</button>}
      </div>
    )}

    {/* Ranking */}
    {ranking.length>0 && (
      <div style={{background:"#fff",borderRadius:14,padding:16,marginBottom:16,boxShadow:"0 1px 4px rgba(0,0,0,0.07)"}}>
        <div style={{fontWeight:700,fontSize:14,marginBottom:10}}>🏆 Ranking de produtos {hasFilters?"(filtrado)":""}</div>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {ranking.slice(0,5).map((p,i)=>(
            <div key={p.name} style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:13,fontWeight:800,color:i===0?"#f59e0b":i===1?"#94a3b8":i===2?"#b45309":"#cbd5e1",minWidth:20}}>{i+1}º</span>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,fontSize:13}}>{p.name}</div>
                <div style={{background:"#f1f5f9",borderRadius:4,height:4,marginTop:3}}>
                  <div style={{background:"#6366f1",borderRadius:4,height:4,width:`${(p.total/ranking[0].total*100).toFixed(0)}%`}}/>
                </div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontWeight:700,fontSize:13,color:"#16a34a"}}>R$ {p.total.toFixed(2)}</div>
                <div style={{fontSize:11,color:"#94a3b8"}}>{p.qty} un</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}

    {/* Lucratividade por produto */}
    {ranking.length>0 && (
      <div style={{background:"#fff",borderRadius:14,padding:16,marginBottom:16,boxShadow:"0 1px 4px rgba(0,0,0,0.07)"}}>
        <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>💰 Lucratividade por produto {hasFilters?"(filtrado)":""}</div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:600}}>
            <thead>
              <tr style={{background:"#f8fafc",borderBottom:"2px solid #e2e8f0"}}>
                {["Produto","Qtd","Vl. Venda Unit.","Total Vendido","Vl. Custo Unit.","Total Custo","Lucro Líquido","Margem"].map(h=>(
                  <th key={h} style={{textAlign:"left",padding:"10px 12px",fontSize:11,color:"#64748b",fontWeight:700,whiteSpace:"nowrap"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ranking.map(p=>{
                // Find product cost from products list
                const prodName = p.name.split(" (")[0];
                const prodFlavor = p.name.match(/\(([^)]+)\)/)?.[1]||"";
                const prodData = (products||[]).find(pr=>pr.name===prodName&&pr.flavor===prodFlavor);
                const costUnit = prodData?.cost_price ? Number(prodData.cost_price) : null;
                const saleUnit = p.total / p.qty;
                const totalCost = costUnit ? costUnit * p.qty : null;
                const lucro = totalCost ? p.total - totalCost : null;
                const margem = lucro ? ((lucro/p.total)*100).toFixed(1) : null;
                return (
                  <tr key={p.name} style={{borderBottom:"1px solid #f1f5f9"}}>
                    <td style={{padding:"10px 12px",fontWeight:600,fontSize:13}}>{p.name}</td>
                    <td style={{padding:"10px 12px",fontSize:13,textAlign:"center"}}>
                      <span style={{background:"#dbeafe",color:"#1d4ed8",borderRadius:6,padding:"2px 8px",fontWeight:700}}>{p.qty} un</span>
                    </td>
                    <td style={{padding:"10px 12px",fontSize:13,fontWeight:600}}>R$ {saleUnit.toFixed(2)}</td>
                    <td style={{padding:"10px 12px",fontSize:13,fontWeight:700,color:"#16a34a"}}>R$ {p.total.toFixed(2)}</td>
                    <td style={{padding:"10px 12px",fontSize:13,color:"#64748b"}}>{costUnit ? `R$ ${costUnit.toFixed(2)}` : <span style={{color:"#cbd5e1"}}>—</span>}</td>
                    <td style={{padding:"10px 12px",fontSize:13,color:"#64748b"}}>{totalCost ? `R$ ${totalCost.toFixed(2)}` : <span style={{color:"#cbd5e1"}}>—</span>}</td>
                    <td style={{padding:"10px 12px",fontWeight:700,fontSize:13,color:lucro>0?"#16a34a":"#ef4444"}}>{lucro ? `R$ ${lucro.toFixed(2)}` : <span style={{color:"#cbd5e1"}}>—</span>}</td>
                    <td style={{padding:"10px 12px"}}>
                      {margem ? (
                        <span style={{background:Number(margem)>=30?"#d1fae5":Number(margem)>=15?"#fef3c7":"#fee2e2",color:Number(margem)>=30?"#065f46":Number(margem)>=15?"#92400e":"#dc2626",borderRadius:6,padding:"3px 8px",fontSize:12,fontWeight:800}}>
                          {margem}%
                        </span>
                      ) : <span style={{color:"#cbd5e1",fontSize:12}}>Sem custo cadastrado</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{background:"#f8fafc",borderTop:"2px solid #e2e8f0"}}>
                <td style={{padding:"10px 12px",fontWeight:800,fontSize:13}}>TOTAL</td>
                <td style={{padding:"10px 12px",fontSize:13,textAlign:"center",fontWeight:700}}>{ranking.reduce((s,p)=>s+p.qty,0)} un</td>
                <td></td>
                <td style={{padding:"10px 12px",fontWeight:800,fontSize:13,color:"#16a34a"}}>R$ {filtTotal.toFixed(2)}</td>
                <td></td>
                <td style={{padding:"10px 12px",fontWeight:700,fontSize:13,color:"#64748b"}}>
                  {(() => {
                    const totalCusto = ranking.reduce((s,p)=>{
                      const prodName=p.name.split(" (")[0]; const prodFlavor=p.name.match(/\(([^)]+)\)/)?.[1]||"";
                      const prodData=(products||[]).find(pr=>pr.name===prodName&&pr.flavor===prodFlavor);
                      return prodData?.cost_price ? s + Number(prodData.cost_price)*p.qty : s;
                    },0);
                    return totalCusto>0 ? `R$ ${totalCusto.toFixed(2)}` : "—";
                  })()}
                </td>
                <td style={{padding:"10px 12px",fontWeight:800,fontSize:13}}>
                  {(() => {
                    const totalCusto = ranking.reduce((s,p)=>{
                      const prodName=p.name.split(" (")[0]; const prodFlavor=p.name.match(/\(([^)]+)\)/)?.[1]||"";
                      const prodData=(products||[]).find(pr=>pr.name===prodName&&pr.flavor===prodFlavor);
                      return prodData?.cost_price ? s + Number(prodData.cost_price)*p.qty : s;
                    },0);
                    const lucroTotal = totalCusto>0 ? filtTotal-totalCusto : null;
                    return lucroTotal ? <span style={{color:"#16a34a"}}>R$ {lucroTotal.toFixed(2)}</span> : "—";
                  })()}
                </td>
                <td style={{padding:"10px 12px"}}>
                  {(() => {
                    const totalCusto = ranking.reduce((s,p)=>{
                      const prodName=p.name.split(" (")[0]; const prodFlavor=p.name.match(/\(([^)]+)\)/)?.[1]||"";
                      const prodData=(products||[]).find(pr=>pr.name===prodName&&pr.flavor===prodFlavor);
                      return prodData?.cost_price ? s + Number(prodData.cost_price)*p.qty : s;
                    },0);
                    const lucroTotal = totalCusto>0 ? filtTotal-totalCusto : null;
                    const margemTotal = lucroTotal ? ((lucroTotal/filtTotal)*100).toFixed(1) : null;
                    return margemTotal ? <span style={{background:"#d1fae5",color:"#065f46",borderRadius:6,padding:"3px 8px",fontSize:12,fontWeight:800}}>{margemTotal}%</span> : "—";
                  })()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    )}

    {/* Sales list */}
    {filtered.length===0 ? (
      <div style={{textAlign:"center",color:"#94a3b8",padding:40}}>Nenhuma venda encontrada{hasFilters?" com estes filtros":""}.</div>
    ) : filtered.map(s=>(
      <div key={s.id} style={{background:"#fff",borderRadius:12,padding:14,marginBottom:10,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <div style={{fontSize:12,color:"#94a3b8"}}>{new Date(s.created_at).toLocaleDateString("pt-BR")}</div>
            {s.pagamento&&<span style={{background:"#f1f5f9",borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700,color:"#475569"}}>{s.pagamento}</span>}
            {s.cliente&&<span style={{fontSize:12,color:"#6366f1",fontWeight:600}}>{s.cliente}</span>}
          </div>
          <div style={{fontWeight:800,fontSize:17,color:"#16a34a"}}>R$ {Number(s.total).toFixed(2)}</div>
        </div>
        {(s.items||[]).map((item,i)=>(
          <div key={i} style={{display:"flex",justifyContent:"space-between",paddingTop:i>0?6:0,borderTop:i>0?"1px solid #f1f5f9":"none"}}>
            <div><div style={{fontWeight:700,fontSize:14}}>{item.product_name}</div><div style={{color:"#6366f1",fontSize:12,fontWeight:600}}>{item.flavor} · {item.qty} un</div></div>
            <div style={{color:"#475569",fontSize:13,fontWeight:600}}>R$ {(item.price*item.qty).toFixed(2)}</div>
          </div>
        ))}
      </div>
    ))}
  </>);
}

function AlertasView({ alerts, alertDays, onEdit }) {
  if (alerts.length===0) return <div style={{textAlign:"center",color:"#22c55e",padding:40,fontSize:16,fontWeight:600}}>✅ Tudo certo! Nenhum alerta.</div>;
  return alerts.map(p=>{
    const days=p.validity?daysUntil(p.validity):999;
    return (
      <div key={p.id} style={{background:"#fff",borderRadius:14,padding:14,marginBottom:10,borderLeft:`4px solid ${p.qty===0?"#ef4444":"#f59e0b"}`}}>
        <div style={{fontWeight:700,fontSize:15}}>{p.name} <span style={{color:"#6366f1"}}>({p.flavor})</span></div>
        {p.qty<=p.min_qty&&<div style={{color:p.qty===0?"#ef4444":"#d97706",fontSize:13,marginTop:4,fontWeight:600}}>{p.qty===0?"🚨 Sem estoque!":`⚠ Estoque baixo: ${p.qty} (mín. ${p.min_qty})`}</div>}
        {p.validity&&days<=alertDays&&<div style={{color:days<0?"#ef4444":"#d97706",fontSize:13,marginTop:4,fontWeight:600}}>{days<0?"🚨 Produto vencido!":`⚠ Vence em ${days} dias — considere uma promoção!`}</div>}
        <button onClick={()=>onEdit(p)} style={{marginTop:10,background:"#f1f5f9",border:"none",borderRadius:8,padding:"7px 14px",fontSize:13,cursor:"pointer",fontWeight:600}}>Editar produto</button>
      </div>
    );
  });
}

function ConfigView({ config, setConfig, onSave, saving }) {
  const fi = { display:"block",width:"100%",padding:"10px 12px",borderRadius:10,border:"1px solid #e2e8f0",fontSize:14,marginTop:5,boxSizing:"border-box",outline:"none",background:"#fff" };
  const lb = { fontSize:13,fontWeight:700,color:"#0f172a",display:"block",marginBottom:4 };
  const section = { background:"#fff",borderRadius:14,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,0.07)",marginBottom:16 };

  return (
    <div style={{maxWidth:600}}>
      <div style={{fontWeight:800,fontSize:17,marginBottom:16}}>⚙️ Configurações</div>

      {/* Identidade visual */}
      <div style={section}>
        <div style={{fontWeight:700,fontSize:15,marginBottom:16,color:"#0f172a"}}>🎨 Identidade Visual</div>

        <div style={{marginBottom:14}}>
          <label style={lb}>Nome da loja</label>
          <input style={fi} value={config.nome_loja||""} onChange={e=>setConfig(c=>({...c,nome_loja:e.target.value}))} placeholder="Ex: Bárbaros Suplementos"/>
          <div style={{fontSize:11,color:"#94a3b8",marginTop:4}}>Aparece no cabeçalho da vitrine e do painel admin</div>
        </div>

        <div style={{marginBottom:14}}>
          <label style={lb}>Subtítulo (linha acima do nome)</label>
          <input style={fi} value={config.subtitulo||""} onChange={e=>setConfig(c=>({...c,subtitulo:e.target.value}))} placeholder="Ex: Loja de, Distribuidora de, (deixe vazio para ocultar)"/>
          <div style={{fontSize:11,color:"#94a3b8",marginTop:4}}>Aparece em letras menores acima do nome. Deixe vazio para não mostrar nada.</div>
        </div>

        <div style={{marginBottom:14}}>
          <label style={lb}>URL da logo</label>
          <input style={fi} value={config.logo_url||""} onChange={e=>setConfig(c=>({...c,logo_url:e.target.value}))} placeholder="https://... (link de uma imagem)"/>
          <div style={{fontSize:11,color:"#94a3b8",marginTop:4}}>Cole o link de uma imagem (PNG, JPG). Substitui o emoji 💪. Use o site imgbb.com para hospedar grátis.</div>
          {config.logo_url && (
            <div style={{marginTop:8,display:"flex",alignItems:"center",gap:10}}>
              <img src={config.logo_url} alt="preview" style={{width:48,height:48,borderRadius:10,objectFit:"cover",border:"2px solid #e2e8f0"}} onError={e=>e.target.style.display="none"}/>
              <span style={{fontSize:12,color:"#64748b"}}>Preview da logo</span>
            </div>
          )}
        </div>

        <div style={{marginBottom:6}}>
          <label style={lb}>Cor do cabeçalho</label>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:6}}>
            <div>
              <div style={{fontSize:11,color:"#64748b",marginBottom:4}}>Cor inicial</div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <input type="color" value={config.header_color1||"#0f172a"} onChange={e=>setConfig(c=>({...c,header_color1:e.target.value}))}
                  style={{width:44,height:44,borderRadius:8,border:"1px solid #e2e8f0",cursor:"pointer",padding:2}}/>
                <input style={{...fi,marginTop:0,flex:1}} value={config.header_color1||"#0f172a"} onChange={e=>setConfig(c=>({...c,header_color1:e.target.value}))} placeholder="#0f172a"/>
              </div>
            </div>
            <div>
              <div style={{fontSize:11,color:"#64748b",marginBottom:4}}>Cor final (gradiente)</div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <input type="color" value={config.header_color2||"#1e3a5f"} onChange={e=>setConfig(c=>({...c,header_color2:e.target.value}))}
                  style={{width:44,height:44,borderRadius:8,border:"1px solid #e2e8f0",cursor:"pointer",padding:2}}/>
                <input style={{...fi,marginTop:0,flex:1}} value={config.header_color2||"#1e3a5f"} onChange={e=>setConfig(c=>({...c,header_color2:e.target.value}))} placeholder="#1e3a5f"/>
              </div>
            </div>
          </div>
          {/* Preview do header */}
          <div style={{marginTop:10,borderRadius:12,padding:"14px 16px",background:`linear-gradient(135deg,${config.header_color1||"#0f172a"} 0%,${config.header_color2||"#1e3a5f"} 100%)`,color:"#fff",display:"flex",alignItems:"center",gap:10}}>
            {config.logo_url ? <img src={config.logo_url} alt="logo" style={{width:36,height:36,borderRadius:8,objectFit:"cover"}} onError={e=>e.target.style.display="none"}/> : <span style={{fontSize:24}}>💪</span>}
            <div>
              {(config.subtitulo||"")!=="" && <div style={{fontSize:10,opacity:.6,textTransform:"uppercase",letterSpacing:2}}>{config.subtitulo||"Loja de"}</div>}
              <div style={{fontSize:16,fontWeight:800}}>{config.nome_loja||"Suplementos"}</div>
            </div>
          </div>
          <div style={{fontSize:11,color:"#94a3b8",marginTop:6}}>Preview em tempo real do cabeçalho</div>
        </div>
      </div>

      {/* Alertas */}
      <div style={section}>
        <div style={{fontWeight:700,fontSize:15,marginBottom:12,color:"#0f172a"}}>⚠️ Alertas de Estoque</div>
        <label style={lb}>Alertar vencimento com quantos dias de antecedência?</label>
        <div style={{display:"flex",alignItems:"center",gap:12,marginTop:6}}>
          <input type="number" min={7} max={365} value={config.alerta_vencimento_dias||60} onChange={e=>setConfig(c=>({...c,alerta_vencimento_dias:+e.target.value}))}
            style={{width:90,padding:"10px 12px",borderRadius:10,border:"1px solid #e2e8f0",fontSize:18,fontWeight:700,textAlign:"center",outline:"none"}}/>
          <span style={{color:"#64748b",fontSize:15}}>dias antes do vencimento</span>
        </div>
        <div style={{color:"#94a3b8",fontSize:13,marginTop:8}}>Produtos vencendo nos próximos <b>{config.alerta_vencimento_dias||60} dias</b> aparecerão nos alertas.</div>
      </div>

      <button onClick={onSave} disabled={saving} style={{width:"100%",padding:13,borderRadius:12,border:"none",background:"#0f172a",color:"#fff",fontWeight:700,fontSize:15,cursor:"pointer",opacity:saving?0.7:1}}>
        {saving?"Salvando...":"Salvar configurações"}
      </button>
    </div>
  );
}

// ── CLIENTES VIEW ────────────────────────────────────────────
const INATIVO_DIAS = 30;

function ClienteCard({ c, isSelected, onClick }) {
  const diasSemComprar = Math.floor((new Date() - new Date(c.ultimaCompra)) / 86400000);
  const inativo = diasSemComprar >= INATIVO_DIAS;
  return (
    <tr onClick={onClick} style={{borderBottom:"1px solid #f1f5f9",cursor:"pointer",background:isSelected?"#eff6ff":"#fff",transition:"background .1s"}}>
      <td style={{padding:"12px 14px"}}>
        <div style={{fontWeight:700,fontSize:14}}>{c.nome}</div>
        {inativo && <div style={{fontSize:11,color:"#f59e0b",fontWeight:600,marginTop:2}}>⚠ {diasSemComprar}d sem comprar</div>}
      </td>
      <td style={{padding:"12px 14px"}}>
        <span style={{background:"#dbeafe",color:"#1d4ed8",borderRadius:6,padding:"2px 8px",fontSize:13,fontWeight:700}}>{c.pedidos.length}</span>
      </td>
      <td style={{padding:"12px 14px",fontWeight:800,fontSize:14,color:"#16a34a"}}>R$ {c.total.toFixed(2)}</td>
      <td style={{padding:"12px 14px",fontSize:13,color:inativo?"#f59e0b":"#64748b",fontWeight:inativo?700:400}}>
        {new Date(c.ultimaCompra).toLocaleDateString("pt-BR")}
      </td>
    </tr>
  );
}

function ClienteSidePanel({ selected, onClose }) {
  const diasSemComprar = Math.floor((new Date() - new Date(selected.ultimaCompra)) / 86400000);
  const inativo = diasSemComprar >= INATIVO_DIAS;

  function abrirWhatsApp() {
    const tel = selected.telefone ? selected.telefone.replace(/\D/g,"") : "";
    if (!tel) { alert("Telefone não cadastrado para este cliente."); return; }
    const msg = `Olá ${selected.nome.split(" ")[0]}! 💪 Tudo bem? Passando para ver se precisa repor algum suplemento. Temos novidades no estoque!`;
    window.open(`https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`,"_blank");
  }

  return (
    <div style={{width:320,background:"#fff",borderRadius:16,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,0.07)",alignSelf:"flex-start",position:"sticky",top:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{fontWeight:800,fontSize:16}}>Perfil do cliente</div>
        <button onClick={onClose} style={{background:"#f1f5f9",border:"none",borderRadius:8,padding:"4px 10px",cursor:"pointer",fontSize:14}}>✕</button>
      </div>

      {/* Avatar + nome */}
      <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:16,padding:"14px 16px",background:"#f8fafc",borderRadius:12}}>
        <div style={{width:48,height:48,borderRadius:"50%",background:"linear-gradient(135deg,#6366f1,#3b82f6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,color:"#fff",fontWeight:800,flexShrink:0}}>
          {selected.nome.charAt(0).toUpperCase()}
        </div>
        <div>
          <div style={{fontWeight:800,fontSize:16,color:"#0f172a"}}>{selected.nome}</div>
          {selected.telefone && <div style={{fontSize:12,color:"#64748b",marginTop:2}}>📱 {selected.telefone}</div>}
          {selected.email && <div style={{fontSize:12,color:"#64748b"}}>✉️ {selected.email}</div>}
        </div>
      </div>

      {/* Alerta de inatividade */}
      {inativo && (
        <div style={{background:"#fef3c7",borderRadius:10,padding:"10px 14px",marginBottom:16,display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:18}}>⏰</span>
          <div>
            <div style={{fontWeight:700,fontSize:13,color:"#92400e"}}>{diasSemComprar} dias sem comprar</div>
            <div style={{fontSize:12,color:"#b45309"}}>Hora de entrar em contato!</div>
          </div>
        </div>
      )}

      {/* Botão WhatsApp */}
      {selected.telefone && (
        <button onClick={abrirWhatsApp} style={{width:"100%",padding:"11px 0",borderRadius:10,border:"none",background:"#25d366",color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",marginBottom:16,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          <span style={{fontSize:16}}>📲</span> Entrar em contato no WhatsApp
        </button>
      )}

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
        {[
          {label:"Total gasto",value:`R$ ${selected.total.toFixed(2)}`,color:"#16a34a"},
          {label:"Ticket médio",value:`R$ ${(selected.total/selected.pedidos.length).toFixed(2)}`,color:"#3b82f6"},
          {label:"Pedidos",value:selected.pedidos.length,color:"#6366f1"},
          {label:"Última compra",value:new Date(selected.ultimaCompra).toLocaleDateString("pt-BR"),color:inativo?"#f59e0b":"#0f172a"},
        ].map(s=>(
          <div key={s.label} style={{background:"#f8fafc",borderRadius:10,padding:"10px 12px",textAlign:"center"}}>
            <div style={{fontSize:15,fontWeight:800,color:s.color}}>{s.value}</div>
            <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Histórico */}
      <div style={{fontWeight:700,fontSize:14,color:"#0f172a",marginBottom:10}}>Histórico de pedidos</div>
      <div style={{maxHeight:280,overflowY:"auto",display:"flex",flexDirection:"column",gap:8}}>
        {selected.pedidos.map(p=>(
          <div key={p.id} style={{background:"#f8fafc",borderRadius:10,padding:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <div style={{fontSize:12,color:"#94a3b8"}}>{new Date(p.created_at).toLocaleDateString("pt-BR")}</div>
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                <span style={{background:"#f1f5f9",borderRadius:6,padding:"1px 7px",fontSize:11,fontWeight:700,color:"#475569"}}>{p.pagamento}</span>
                <span style={{fontWeight:800,fontSize:13,color:"#16a34a"}}>R$ {Number(p.total).toFixed(2)}</span>
              </div>
            </div>
            {(p.items||[]).map((item,i)=>(
              <div key={i} style={{fontSize:12,color:"#475569",paddingTop:i>0?4:0,borderTop:i>0?"1px solid #e2e8f0":"none"}}>
                {item.product_name} <span style={{color:"#6366f1"}}>({item.flavor})</span> × {item.qty}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function ClientesView({ sales, loadingS, usuarios }) {
  const [search, setSearch] = useState("");
  const [subTab, setSubTab] = useState("todos");
  const [selected, setSelected] = useState(null);

  // Build clients map
  const clientsMap = {};
  (sales || []).forEach(s => {
    if (!s.cliente) return;
    if (!clientsMap[s.cliente]) {
      // Try to find user data
      const u = (usuarios||[]).find(u=>u.nome===s.cliente);
      clientsMap[s.cliente] = {
        nome: s.cliente,
        telefone: u?.telefone||"",
        email: u?.email||"",
        pedidos: [],
        total: 0,
        ultimaCompra: s.created_at,
      };
    }
    clientsMap[s.cliente].pedidos.push(s);
    clientsMap[s.cliente].total += Number(s.total);
    if (s.created_at > clientsMap[s.cliente].ultimaCompra) clientsMap[s.cliente].ultimaCompra = s.created_at;
  });

  const allClients = Object.values(clientsMap).sort((a,b)=>b.total-a.total);
  const inativos = allClients.filter(c=>Math.floor((new Date()-new Date(c.ultimaCompra))/86400000)>=INATIVO_DIAS);
  const semCompra = (usuarios||[]).filter(u=>!clientsMap[u.nome]);
  const listBase = subTab==="inativos" ? inativos : allClients;
  const filtered = listBase.filter(c=>c.nome.toLowerCase().includes(search.toLowerCase()));
  const filteredSemCompra = semCompra.filter(u=>(u.nome||"").toLowerCase().includes(search.toLowerCase()));

  if (loadingS) return <Spinner/>;

  return (
    <div style={{display:"flex",gap:20}}>
      <div style={{flex:1}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontSize:22,fontWeight:800,color:"#0f172a"}}>👥 Clientes</div>
          {inativos.length>0 && (
            <div style={{background:"#fef3c7",borderRadius:10,padding:"6px 14px",fontSize:13,fontWeight:700,color:"#92400e"}}>
              ⏰ {inativos.length} cliente{inativos.length!==1?"s":""} sem comprar há +{INATIVO_DIAS}d
            </div>
          )}
        </div>

        {/* Sub-tabs */}
        <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
          {[
            ["todos",`Todos (${allClients.length})`],
            ["inativos",`⏰ +${INATIVO_DIAS}d sem comprar (${inativos.length})`],
            ["semcompra",`👤 Nunca compraram (${semCompra.length})`]
          ].map(([id,label])=>(
            <button key={id} onClick={()=>{setSubTab(id);setSelected(null);}} style={{padding:"7px 16px",borderRadius:20,border:"none",cursor:"pointer",fontSize:13,fontWeight:600,background:subTab===id?"#0f172a":"#e2e8f0",color:subTab===id?"#fff":"#475569"}}>
              {label}
            </button>
          ))}
        </div>

        <input placeholder="🔍 Buscar cliente..." value={search} onChange={e=>setSearch(e.target.value)}
          style={{width:"100%",padding:"10px 14px",borderRadius:10,border:"1px solid #e2e8f0",fontSize:14,outline:"none",background:"#fff",boxSizing:"border-box",marginBottom:14}}/>

        {subTab==="semcompra" ? (
          semCompra.length===0 ? (
            <div style={{background:"#fff",borderRadius:16,padding:48,textAlign:"center",color:"#94a3b8"}}>
              <div style={{fontSize:40,marginBottom:8}}>🎉</div>
              <div style={{fontWeight:600}}>Todos os cadastrados já compraram!</div>
            </div>
          ) : (
            <div style={{background:"#fff",borderRadius:16,boxShadow:"0 1px 4px rgba(0,0,0,0.07)",overflow:"hidden"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead>
                  <tr style={{background:"#f8fafc",borderBottom:"2px solid #e2e8f0"}}>
                    {["Cliente","Telefone","E-mail","Cadastro"].map(h=>(
                      <th key={h} style={{textAlign:"left",padding:"12px 14px",fontSize:12,color:"#64748b",fontWeight:700}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredSemCompra.map(u=>(
                    <tr key={u.id} style={{borderBottom:"1px solid #f1f5f9"}}>
                      <td style={{padding:"12px 14px",fontWeight:700,fontSize:14}}>{u.nome}</td>
                      <td style={{padding:"12px 14px",fontSize:13}}>
                        {u.telefone ? (
                          <a href={`https://wa.me/55${u.telefone.replace(/\D/g,"")}?text=${encodeURIComponent(`Olá ${u.nome.split(" ")[0]}! 💪 Vi que você se cadastrou mas ainda não fez nenhuma compra. Posso te ajudar a escolher algum suplemento?`)}`}
                            target="_blank" rel="noreferrer"
                            style={{color:"#25d366",fontWeight:700,textDecoration:"none",display:"flex",alignItems:"center",gap:4}}>
                            📲 {u.telefone}
                          </a>
                        ) : <span style={{color:"#cbd5e1"}}>—</span>}
                      </td>
                      <td style={{padding:"12px 14px",fontSize:13,color:"#64748b"}}>{u.email||"—"}</td>
                      <td style={{padding:"12px 14px",fontSize:13,color:"#94a3b8"}}>{u.created_at?new Date(u.created_at).toLocaleDateString("pt-BR"):"—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredSemCompra.length===0&&<div style={{textAlign:"center",color:"#94a3b8",padding:24}}>Nenhum cliente encontrado</div>}
            </div>
          )
        ) : allClients.length===0 ? (
          <div style={{background:"#fff",borderRadius:16,padding:48,textAlign:"center",color:"#94a3b8"}}>
            <div style={{fontSize:40,marginBottom:8}}>👥</div>
            <div style={{fontWeight:600}}>Nenhum cliente ainda</div>
            <div style={{fontSize:13,marginTop:4}}>Aparecem após pedidos confirmados</div>
          </div>
        ) : filtered.length===0 ? (
          <div style={{background:"#fff",borderRadius:16,padding:32,textAlign:"center",color:"#94a3b8"}}>Nenhum cliente encontrado</div>
        ) : (
          <div style={{background:"#fff",borderRadius:16,boxShadow:"0 1px 4px rgba(0,0,0,0.07)",overflow:"hidden"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr style={{background:"#f8fafc",borderBottom:"2px solid #e2e8f0"}}>
                  {["Cliente","Pedidos","Total gasto","Última compra"].map(h=>(
                    <th key={h} style={{textAlign:"left",padding:"12px 14px",fontSize:12,color:"#64748b",fontWeight:700}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c=>(
                  <ClienteCard key={c.nome} c={c} isSelected={selected?.nome===c.nome} onClick={()=>setSelected(selected?.nome===c.nome?null:c)}/>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && <ClienteSidePanel selected={selected} onClose={()=>setSelected(null)}/>}
    </div>
  );
}

// ── ADMIN PANEL (orquestrador) ────────────────────────────────
function AdminPanel({ onLogout }) {
  const isDesktop = useIsDesktop();
  const [products, setProducts] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [rejeitados, setRejeitados] = useState([]);
  const [sales, setSales] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [config, setConfig] = useState({ alerta_vencimento_dias:60, nome_loja:'Suplementos', subtitulo:'Loja de', logo_url:'', header_color1:'#0f172a', header_color2:'#1e3a5f' });
  const [loadingP, setLoadingP] = useState(true);
  const [loadingPedidos, setLoadingPedidos] = useState(true);
  const [loadingS, setLoadingS] = useState(true);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [toast, setToast] = useState(null);
  const [savingConfig, setSavingConfig] = useState(false);

  const showToast = (msg,type="success") => { setToast({msg,type}); setTimeout(()=>setToast(null),2500); };

  const loadProducts = useCallback(async()=>{
    setLoadingP(true);
    try { setProducts(await db.select("produtos","")); } catch { showToast("Erro ao carregar produtos","error"); } finally { setLoadingP(false); }
  },[]);
  const loadPedidos = useCallback(async()=>{
    setLoadingPedidos(true);
    try { const v=await db.select("vendas","select=*,venda_itens(*)&status=eq.pendente"); setPedidos(v.map(s=>({...s,items:s.venda_itens||[]}))); } catch { showToast("Erro ao carregar pedidos","error"); } finally { setLoadingPedidos(false); }
  },[]);
  const loadSales = useCallback(async()=>{
    setLoadingS(true);
    try { const v=await db.select("vendas","select=*,venda_itens(*)&status=eq.confirmado"); setSales(v.map(s=>({...s,items:s.venda_itens||[]}))); } catch {} finally { setLoadingS(false); }
  },[]);
  const loadRejeitados = useCallback(async()=>{
    try { const v=await db.select("vendas","select=*,venda_itens(*)&status=eq.rejeitado"); setRejeitados(v.map(s=>({...s,items:s.venda_itens||[]}))); } catch {}
  },[]);
  const loadUsuarios = useCallback(async()=>{
    try { setUsuarios(await db.select("usuarios","select=id,nome,telefone,email")); } catch {}
  },[]);
  const loadConfig = useCallback(async()=>{
    try { const c=await db.select("configuracoes","id=eq.default"); if(c.length) setConfig(c[0]); } catch {}
  },[]);

  useEffect(()=>{ loadProducts(); loadPedidos(); loadSales(); loadRejeitados(); loadUsuarios(); loadConfig(); },[loadProducts,loadPedidos,loadSales,loadRejeitados,loadUsuarios,loadConfig]);

  async function confirmarPedido(pedido) {
    try {
      for (const item of pedido.items) {
        const product=products.find(p=>p.id===item.produto_id);
        if (product) await db.update("produtos",item.produto_id,{qty:Math.max(0,product.qty-item.qty)});
      }
      await db.update("vendas",pedido.id,{status:"confirmado"});
      showToast("Pedido confirmado! ✅"); await loadProducts(); await loadPedidos(); await loadSales();
    } catch { showToast("Erro ao confirmar","error"); }
  }
  async function rejeitarPedido(pedido) {
    try { await db.update("vendas",pedido.id,{status:"rejeitado"}); showToast("Pedido rejeitado.","info"); await loadPedidos(); await loadRejeitados(); } catch { showToast("Erro ao rejeitar","error"); }
  }
  async function handleSaveProduct(data) {
    try {
      if (editProduct) { await db.update("produtos",editProduct.id,{name:data.name,category:data.category,flavor:data.flavor,qty:data.qty,min_qty:data.minQty,unit:data.unit,validity:data.validity||null,price:data.price,cost_price:data.costPrice}); showToast("Produto atualizado!"); }
      else { await db.insert("produtos",{name:data.name,category:data.category,flavor:data.flavor,qty:data.qty,min_qty:data.minQty,unit:data.unit,validity:data.validity||null,price:data.price,cost_price:data.costPrice}); showToast("Produto adicionado!"); }
      await loadProducts();
    } catch { showToast("Erro ao salvar","error"); }
    setShowAddProduct(false); setEditProduct(null);
  }
  async function handleDelete(id) {
    try { await db.delete("produtos",id); await loadProducts(); showToast("Removido.","info"); } catch { showToast("Erro","error"); }
  }
  async function saveConfig() {
    setSavingConfig(true);
    try { await db.update("configuracoes","default",{alerta_vencimento_dias:config.alerta_vencimento_dias,nome_loja:config.nome_loja,subtitulo:config.subtitulo,logo_url:config.logo_url,header_color1:config.header_color1,header_color2:config.header_color2}); showToast("Configuração salva!"); } catch { showToast("Erro ao salvar","error"); } finally { setSavingConfig(false); }
  }

  const alertDays = config.alerta_vencimento_dias;
  const alerts = products.filter(p=>p.qty<=p.min_qty||(p.validity&&daysUntil(p.validity)<=alertDays));
  const totalValue = products.reduce((s,p)=>s+p.qty*Number(p.price),0);
  const monthStr = new Date().toISOString().slice(0,7);
  const monthlySales = sales.filter(s=>s.created_at?.startsWith(monthStr));
  const monthRevenue = monthlySales.reduce((s,v)=>s+Number(v.total),0);

  const sharedData = { products,pedidos,rejeitados,sales,usuarios,config,loadingP,loadingPedidos,loadingS,alertDays,alerts,totalValue,monthRevenue,monthlySales };
  const sharedActions = { confirmarPedido,rejeitarPedido,handleSaveProduct,handleDelete,saveConfig,savingConfig,setConfig,showAddProduct,setShowAddProduct,editProduct,setEditProduct,toast,onLogout };

  return (
    <>
      {isDesktop ? <AdminDesktop data={sharedData} actions={sharedActions}/> : <AdminMobile data={sharedData} actions={sharedActions}/>}
      {showAddProduct && <ProductForm initial={editProduct} onSave={handleSaveProduct} onClose={()=>{setShowAddProduct(false);setEditProduct(null);}}/>}
    </>
  );
}

// ── ADMIN LOGIN ───────────────────────────────────────────────
function AdminLoginPage({ onSuccess }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [error, setError] = useState("");
  function handleSubmit() {
    if (email.toLowerCase()===ADMIN_EMAIL.toLowerCase()&&senha===ADMIN_SENHA) { authorizeDevice(); const admin={id:"admin",nome:"Admin",role:"admin"}; saveSession(admin); onSuccess(admin); }
    else setError("E-mail ou senha incorretos");
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
          <input type="email" value={email} onChange={e=>{setEmail(e.target.value);setError("");}} onKeyDown={e=>e.key==="Enter"&&handleSubmit()} placeholder="seu@email.com" autoFocus
            style={{width:"100%",padding:"12px 14px",borderRadius:10,border:"1px solid #334155",background:"#0f172a",color:"#fff",fontSize:15,boxSizing:"border-box",outline:"none"}}/>
        </div>
        <div style={{marginBottom:6}}>
          <label style={{fontSize:12,fontWeight:600,color:"#94a3b8",display:"block",marginBottom:5}}>SENHA</label>
          <input type="password" value={senha} onChange={e=>{setSenha(e.target.value);setError("");}} onKeyDown={e=>e.key==="Enter"&&handleSubmit()} placeholder="••••••••"
            style={{width:"100%",padding:"12px 14px",borderRadius:10,border:"1px solid #334155",background:"#0f172a",color:"#fff",fontSize:15,boxSizing:"border-box",outline:"none"}}/>
        </div>
        {error&&<div style={{color:"#ef4444",fontSize:13,fontWeight:600,marginTop:8}}>{error}</div>}
        <button onClick={handleSubmit} style={{width:"100%",padding:14,borderRadius:12,border:"none",background:"linear-gradient(135deg,#3b82f6,#6366f1)",color:"#fff",fontWeight:800,fontSize:16,cursor:"pointer",marginTop:20}}>Entrar</button>
      </div>
    </div>
  );
}

// ── ROOT ─────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(()=>getSession());
  const [showAuth, setShowAuth] = useState(false);
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  const [vitrineConfig, setVitrineConfig] = useState({ nome_loja:"Suplementos", subtitulo:"Loja de", logo_url:"", header_color1:"#0f172a", header_color2:"#1e3a5f" });
  useEffect(()=>{
    db.select("produtos","").then(data=>{ setProducts(data); setLoadingProducts(false); }).catch(()=>setLoadingProducts(false));
    db.select("configuracoes","id=eq.default").then(c=>{ if(c.length) setVitrineConfig(c[0]); }).catch(()=>{});
  },[]);

  function handleLogin(u) { setUser(u); setShowAuth(false); }
  function handleLogout() { saveSession(null); setUser(null); }

  if (isAdminRoute()) {
    if (isAdminDevice()&&user?.role==="admin") return <AdminPanel onLogout={handleLogout}/>;
    return <AdminLoginPage onSuccess={u=>setUser(u)}/>;
  }
  if (user?.role==="admin") return <AdminPanel onLogout={handleLogout}/>;

  return (
    <>
      <Vitrine products={products} loading={loadingProducts} user={user} onLogout={handleLogout} onShowAuth={()=>setShowAuth(true)} config={vitrineConfig}/>
      {showAuth&&<AuthModal onClose={()=>setShowAuth(false)} onLogin={handleLogin}/>}
    </>
  );
}
