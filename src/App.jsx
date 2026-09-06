import React, { useState, useEffect, useRef, useCallback } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import {
  Menu, X, MapPin, Phone, Instagram, Music2, Users, ShoppingCart,
  CheckCircle2, Circle, Lock, Plus, Minus, Search, Download,
  ChevronLeft, ChevronRight, Beef, Wine, UtensilsCrossed, Ticket,
  Image as ImageIcon, Flame, Trash2, Save, Unlock, Copy, Check
} from "lucide-react";
import fondoPenaMobile from "./imagenes/fondo/fondo-4-octubre.png";
import foto1 from "./imagenes/Fotos/1.jpeg";
import foto2 from "./imagenes/Fotos/2.jpeg";
import foto3 from "./imagenes/Fotos/3.jpeg";
import foto4 from "./imagenes/Fotos/4.jpeg";
import foto5 from "./imagenes/Fotos/5.jpeg";
import foto6 from "./imagenes/Fotos/6.jpeg";

/* ---------------------------------- THEME ---------------------------------- */
const C = {
  rojo: "#B5182B",
  rojoOsc: "#7A0E1D",
  rojoMasOsc: "#4E0812",
  dorado: "#D4A017",
  doradoClaro: "#F0C75E",
  verde: "#1E6B3C",
  celeste: "#75AADB",
  crema: "#F6ECD2",
  cremaOsc: "#E9DAB0",
  negro: "#170F0A",
};

const FONT_IMPORT =
  "@import url('https://fonts.googleapis.com/css2?family=Alfa+Slab+One&family=Playball&family=Nunito+Sans:wght@400;600;700;800&display=swap');";

/* ---------------------------------- DATA ---------------------------------- */
const MENU = [
  { key: "entrada", nombre: "Entrada a la peña", desc: "Saldo 100% consumible en la carta durante el evento", precio: 100000, cat: "Entrada", Icon: Ticket },
  { key: "combo_asado", nombre: "Asado personal + cerveza o fernet", desc: "Combo individual", precio: 100000, cat: "Combos", Icon: Flame },
  { key: "combo_asado2", nombre: "Asado para dos", desc: "Para compartir en pareja o con un amigo", precio: 180000, cat: "Combos", Icon: Beef },
  { key: "empanada", nombre: "Empanada", desc: "Unidad, criolla al horno", precio: 8000, cat: "Platos", Icon: UtensilsCrossed },
  { key: "choripan", nombre: "Choripán", desc: "Chorizo criollo, pan y chimichurri", precio: 15000, cat: "Platos", Icon: UtensilsCrossed },
  { key: "fernet", nombre: "Fernet para compartir", desc: "Litro para compartir en la mesa", precio: 60000, cat: "Bebidas", Icon: Wine },
  { key: "cerveza", nombre: "Cerveza nacional", desc: "Unidad", precio: 6000, cat: "Bebidas", Icon: Wine },
];

const FOLKLORE = [
  { nombre: "Jorge Cafrune", genero: "Zamba y folklore norteño" },
  { nombre: "Mercedes Sosa", genero: "Voz mayor del folklore" },
  { nombre: "Peteco Carabajal", genero: "Chacarera santiagueña" },
  { nombre: "Soledad Pastorutti", genero: "Folklore y chamamé" },
  { nombre: "Los Nocheros", genero: "Folklore salteño" },
  { nombre: "Chaqueño Palavecino", genero: "Zamba y copla" },
  { nombre: "Los Manseros de Tarija", genero: "Cuarteto cordobés y folklore" },
  { nombre: "Los Carabajal", genero: "Chacarera de Santiago" },
];

const GALERIA_INICIAL = [foto1, foto2, foto3, foto4, foto5, foto6].map((url) => ({ url, caption: "" }));

const CAJA_PIN = "1810";
const CURRENCY = (n) => "$" + n.toLocaleString("es-CO");
const uid = () => Math.random().toString(36).slice(2, 6).toUpperCase();
const ticketCode = () => uid() + uid();

/* Genera un ticket individual y canjeable por cada UNIDAD reservada,
   así 3 asados = 3 tickets que se reclaman uno por uno */
function generarTickets(reserva) {
  const tickets = [];
  reserva.items.forEach((it) => {
    for (let n = 1; n <= it.cantidad; n++) {
      tickets.push({
        codigo: ticketCode(), reservaId: reserva.id, nombreCliente: reserva.nombre,
        itemKey: it.key, itemNombre: it.nombre, unidad: n, totalUnidades: it.cantidad,
        entregado: false, entregadoEn: null,
      });
    }
  });
  return tickets;
}

/* Carga el widget de Wompi bajo demanda (solo cuando hay llave pública configurada) */
function cargarScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src; s.onload = () => resolve(); s.onerror = reject;
    document.head.appendChild(s);
  });
}

/* Cobra con Wompi (Nequi, PSE o tarjeta) y verifica el estado de la transacción
   contra la API pública de Wompi antes de marcar la reserva como pagada,
   sin intervención humana. Requiere una llave pública real de una cuenta Wompi. */
async function pagarConWompi(reserva, config, onResultado) {
  try {
    await cargarScript("https://checkout.wompi.co/widget.js");
    const checkout = new window.WidgetCheckout({
      currency: "COP",
      amountInCents: reserva.total * 100,
      reference: reserva.id,
      publicKey: config.wompiPublicKey,
    });
    checkout.open(async (result) => {
      const tx = result && result.transaction;
      if (!tx || !tx.id) return onResultado("error", null);
      const base = config.wompiPublicKey.startsWith("pub_test_")
        ? "https://sandbox.wompi.co/v1" : "https://production.wompi.co/v1";
      try {
        const r = await fetch(`${base}/transactions/${tx.id}`);
        const data = await r.json();
        const status = data && data.data && data.data.status;
        onResultado(status === "APPROVED" ? "aprobado" : "rechazado", tx.id);
      } catch {
        onResultado(tx.status === "APPROVED" ? "aprobado" : "rechazado", tx.id);
      }
    });
  } catch {
    onResultado("sin-script", null);
  }
}

/* ---------------------------------- STORAGE HELPERS (Firestore) ---------------------------------- */
/* Si Firebase todavía no está configurado (o no hay red), Firestore reintenta
   la conexión en vez de fallar, así que sin este timeout la carga inicial se
   queda colgada para siempre en vez de pasar a modo sin conexión. */
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}
async function storageGet(key, fallback) {
  try {
    const snap = await withTimeout(getDoc(doc(db, "app", key)), 15000);
    return snap.exists() ? snap.data().value : fallback;
  } catch {
    // undefined marca "no se pudo conectar", distinto de "se conectó pero el
    // documento todavía no existe" (que devuelve fallback, típicamente null)
    return undefined;
  }
}
async function storageSet(key, value) {
  try {
    await withTimeout(setDoc(doc(db, "app", key), { value }), 15000);
    return true;
  } catch {
    return false;
  }
}

/* ---------------------------------- DECORATIVE SVGs ---------------------------------- */
function Scroll({ style, flip }) {
  return (
    <svg
      viewBox="0 0 100 100"
      style={{ position: "absolute", width: 90, height: 90, transform: flip ? "scaleX(-1)" : undefined, ...style }}
    >
      <path
        d="M5,70 C5,35 35,15 65,20 C50,25 40,45 45,60 C48,68 58,72 68,66 C60,80 35,88 18,80 C10,76 5,74 5,70 Z"
        fill="none" stroke={C.dorado} strokeWidth="3"
      />
      <circle cx="63" cy="22" r="3.5" fill={C.doradoClaro} />
      <circle cx="52" cy="14" r="2.5" fill={C.crema} />
      <circle cx="43" cy="10" r="2" fill={C.doradoClaro} />
    </svg>
  );
}

function FlagRibbon({ compact }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", width: compact ? 70 : 110, boxShadow: "0 2px 6px rgba(0,0,0,.4)", borderRadius: 3, overflow: "hidden" }}>
      <div style={{ height: compact ? 10 : 16, background: C.celeste }} />
      <div style={{ height: compact ? 10 : 16, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: compact ? 6 : 10, height: compact ? 6 : 10, borderRadius: "50%", background: C.dorado }} />
      </div>
      <div style={{ height: compact ? 10 : 16, background: C.celeste }} />
    </div>
  );
}

function Ribbon({ children, sub }) {
  return (
    <div style={{ position: "relative", display: "inline-block", maxWidth: "100%" }}>
      <div
        style={{
          background: `linear-gradient(180deg, ${C.rojoOsc}, ${C.rojoMasOsc})`,
          border: `2px solid ${C.dorado}`,
          borderRadius: 6,
          padding: "14px 34px",
          position: "relative",
        }}
      >
        <div
          aria-hidden
          style={{ position: "absolute", left: -16, top: "50%", transform: "translateY(-50%) rotate(45deg)", width: 26, height: 26, background: C.rojoMasOsc, border: `2px solid ${C.dorado}` }}
        />
        <div
          aria-hidden
          style={{ position: "absolute", right: -16, top: "50%", transform: "translateY(-50%) rotate(45deg)", width: 26, height: 26, background: C.rojoMasOsc, border: `2px solid ${C.dorado}` }}
        />
        <div style={{ fontFamily: "'Alfa Slab One', serif", color: C.crema, textShadow: `2px 2px 0 ${C.negro}`, fontSize: "clamp(22px,5vw,40px)", letterSpacing: 1, textAlign: "center", lineHeight: 1.1 }}>
          {children}
        </div>
        {sub && <div style={{ fontFamily: "'Playball', cursive", color: C.doradoClaro, textAlign: "center", fontSize: "clamp(16px,2.6vw,22px)", marginTop: 4 }}>{sub}</div>}
      </div>
    </div>
  );
}

function SectionTitle({ kids, icon: Icon }) {
  return (
    <div style={{ textAlign: "center", marginBottom: 30 }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 10, color: C.rojoOsc, fontFamily: "'Alfa Slab One', serif", fontSize: "clamp(24px,4vw,34px)" }}>
        {Icon && <Icon size={26} />} {kids}
      </div>
      <div style={{ width: 90, height: 3, background: C.dorado, margin: "10px auto 0" }} />
    </div>
  );
}

/* ---------------------------------- CAROUSEL ---------------------------------- */
function Carousel({ images }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (images.length < 2) return;
    const t = setInterval(() => setI((v) => (v + 1) % images.length), 4200);
    return () => clearInterval(t);
  }, [images.length]);

  if (images.length === 0) {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", background: `radial-gradient(circle, ${C.celeste}, #4a7ba8)`, color: "#fff", textAlign: "center", padding: 16 }}>
        <ImageIcon size={34} />
        <p style={{ fontFamily: "'Nunito Sans', sans-serif", fontSize: 13, marginTop: 8, maxWidth: 220 }}>
          Agregá fotos del lugar y de eventos pasados desde el panel de Caja
        </p>
      </div>
    );
  }
  const img = images[i % images.length];
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      <img src={img.url} alt={img.caption || "peña"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      {img.caption && (
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,.55)", color: C.crema, fontSize: 11, padding: "4px 8px", fontFamily: "'Nunito Sans', sans-serif" }}>
          {img.caption}
        </div>
      )}
      {images.length > 1 && (
        <>
          <button onClick={() => setI((v) => (v - 1 + images.length) % images.length)} style={navBtnStyle("left")}><ChevronLeft size={16} /></button>
          <button onClick={() => setI((v) => (v + 1) % images.length)} style={navBtnStyle("right")}><ChevronRight size={16} /></button>
        </>
      )}
    </div>
  );
}
const navBtnStyle = (side) => ({
  position: "absolute", top: "50%", [side]: 6, transform: "translateY(-50%)",
  background: "rgba(0,0,0,.45)", border: "none", color: "#fff", borderRadius: "50%",
  width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
});

/* ---------------------------------- APP ---------------------------------- */
export default function App() {
  const [tab, setTab] = useState("inicio");
  const [navOpen, setNavOpen] = useState(false);
  const [gallery, setGallery] = useState([]);
  const [nosotros, setNosotros] = useState({ historia: "", fotos: [] });
  const [config, setConfig] = useState({ nequiCuenta: "300 000 0000", nequiTitular: "Los 4 de Copas", wompiPublicKey: "" });
  const [reservas, setReservas] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [offline, setOffline] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const [g, n, cfg, r, t] = await Promise.all([
        storageGet("pena4copas:gallery", null),
        storageGet("pena4copas:nosotros", null),
        storageGet("pena4copas:config", null),
        storageGet("pena4copas:reservations", null),
        storageGet("pena4copas:tickets", null),
      ]);
      if (g === undefined && n === undefined && cfg === undefined && r === undefined) setOffline(true);
      setGallery(g || GALERIA_INICIAL);
      setNosotros(
        n || {
          historia:
            "La Gran Peña Los 4 de Copas nace de las ganas de juntar mesas largas, guitarras y asado como se hace en Córdoba: entre amigos, sin apuro y con el mate dando vueltas. Esta es nuestra primera gran peña, y el comienzo de un lugar de encuentro para la comunidad argentina.",
          fotos: [],
        }
      );
      setConfig(cfg || { nequiCuenta: "300 000 0000", nequiTitular: "Los 4 de Copas", wompiPublicKey: "" });
      setReservas(r || []);
      setTickets(t || []);
      setLoaded(true);
    })();
  }, []);

  const persistReservas = useCallback(async (next) => {
    setReservas(next);
    const ok = await storageSet("pena4copas:reservations", next);
    if (!ok) setOffline(true);
  }, []);
  const persistTickets = useCallback(async (next) => {
    setTickets(next);
    const ok = await storageSet("pena4copas:tickets", next);
    if (!ok) setOffline(true);
  }, []);
  const persistGallery = useCallback(async (next) => {
    setGallery(next);
    await storageSet("pena4copas:gallery", next);
  }, []);
  const persistNosotros = useCallback(async (next) => {
    setNosotros(next);
    await storageSet("pena4copas:nosotros", next);
  }, []);
  const persistConfig = useCallback(async (next) => {
    setConfig(next);
    await storageSet("pena4copas:config", next);
  }, []);

  const NAV = [
    { id: "inicio", label: "Inicio" },
    { id: "reservas", label: "Reservas" },
    { id: "mi-reserva", label: "Mi reserva" },
    { id: "nosotros", label: "Nosotros" },
    { id: "folclore", label: "Folclore" },
    { id: "caja", label: "Caja / Canje" },
  ];

  if (!loaded) {
    return (
      <div style={{ minHeight: "100vh", background: C.rojo, display: "flex", alignItems: "center", justifyContent: "center", color: C.crema, fontFamily: "'Alfa Slab One', serif" }}>
        <style>{FONT_IMPORT}</style>
        Cargando la peña…
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: C.crema, fontFamily: "'Nunito Sans', sans-serif" }}>
      <style>{FONT_IMPORT}
      {`::selection{background:${C.dorado};color:${C.negro}}
        button{font-family:'Nunito Sans',sans-serif}
        .scrollx::-webkit-scrollbar{height:8px}
        .scrollx::-webkit-scrollbar-thumb{background:${C.dorado};border-radius:4px}`}
      </style>

      {offline && (
        <div style={{ background: C.negro, color: C.doradoClaro, textAlign: "center", fontSize: 12, padding: "6px 10px" }}>
          Modo sin conexión: los datos se están guardando solo en este dispositivo. Usá "Exportar respaldo" en Caja cuando termine el evento.
        </div>
      )}

      {/* NAV */}
      <nav style={{ position: "sticky", top: 0, zIndex: 40, background: C.rojoMasOsc, borderBottom: `3px solid ${C.dorado}` }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px" }}>
          <button onClick={() => setTab("inicio")} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            <FlagRibbon compact />
            <span style={{ color: C.crema, fontFamily: "'Alfa Slab One', serif", fontSize: 15 }}>LOS 4 DE COPAS</span>
          </button>
          <div style={{ display: "none" }} className="md-flex">
          </div>
          <div style={{ display: "flex", gap: 4 }} className="desktop-nav">
            {NAV.map((n) => (
              <button key={n.id} onClick={() => setTab(n.id)}
                style={{
                  background: tab === n.id ? C.dorado : "transparent",
                  color: tab === n.id ? C.negro : C.crema,
                  border: "none", borderRadius: 5, padding: "8px 12px", fontWeight: 700, fontSize: 13, cursor: "pointer",
                }}>
                {n.label}
              </button>
            ))}
          </div>
          <button onClick={() => setNavOpen((v) => !v)} className="mobile-nav-btn" style={{ background: "none", border: "none", color: C.crema, display: "none" }}>
            {navOpen ? <X /> : <Menu />}
          </button>
        </div>
        <style>{`
          @media (max-width: 760px){
            .desktop-nav{display:none !important}
            .mobile-nav-btn{display:flex !important}
          }
        `}</style>
        {navOpen && (
          <div style={{ display: "flex", flexDirection: "column", background: C.rojoOsc, padding: 8 }}>
            {NAV.map((n) => (
              <button key={n.id} onClick={() => { setTab(n.id); setNavOpen(false); }}
                style={{ background: "none", border: "none", color: C.crema, textAlign: "left", padding: "10px 6px", fontWeight: 700, fontSize: 14 }}>
                {n.label}
              </button>
            ))}
          </div>
        )}
      </nav>

      {tab === "inicio" && <Inicio setTab={setTab} gallery={gallery} />}
      {tab === "reservas" && (
        <Reservas reservas={reservas} persistReservas={persistReservas} tickets={tickets} persistTickets={persistTickets} config={config} />
      )}
      {tab === "mi-reserva" && <MiReserva reservas={reservas} tickets={tickets} />}
      {tab === "nosotros" && <Nosotros nosotros={nosotros} gallery={gallery} />}
      {tab === "folclore" && <Folclore />}
      {tab === "caja" && (
        <Caja
          reservas={reservas} persistReservas={persistReservas}
          tickets={tickets} persistTickets={persistTickets}
          gallery={gallery} persistGallery={persistGallery}
          nosotros={nosotros} persistNosotros={persistNosotros}
          config={config} persistConfig={persistConfig}
        />
      )}

      <Footer />
      <MusicPlayer />
    </div>
  );
}

/* ---------------------------------- INICIO ---------------------------------- */
function Inicio({ setTab, gallery }) {
  return (
    <div>
      <div style={{ background: `radial-gradient(circle at 50% 20%, ${C.rojo}, ${C.rojoMasOsc})`, padding: "18px 16px" }}>
        <img
          src={fondoPenaMobile}
          alt="La Gran Peña Los 4 de Copas - 4 de Octubre"
          style={{ display: "block", width: "100%", maxWidth: 440, margin: "0 auto", borderRadius: 10, boxShadow: "0 10px 30px rgba(0,0,0,.5)" }}
        />
      </div>

      <div style={{ background: `radial-gradient(circle at 50% 0%, ${C.rojo}, ${C.rojoMasOsc})`, padding: "26px 16px 44px", textAlign: "center" }}>
        <p style={{ color: C.doradoClaro, maxWidth: 480, margin: "0 auto", fontSize: 14, lineHeight: 1.6 }}>
          Asado, guitarreada y fernet compartido. Reservá tu lugar y tu mesa para la primera gran peña argentina.
        </p>

        <style>{`
          .hero-cta { display: flex; gap: 12px; justify-content: center; margin-top: 22px; flex-wrap: wrap; }
          @media (max-width: 480px) {
            .hero-cta { flex-direction: column; align-items: stretch; padding-bottom: 60px; }
          }
        `}</style>
        <div className="hero-cta">
          <button onClick={() => setTab("reservas")} style={btnGold}>Reservar mi lugar</button>
          <button onClick={() => setTab("nosotros")} style={btnOutline}>Conocé la peña</button>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 16px" }}>
        <SectionTitle icon={Flame}>Qué te espera</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16 }}>
          {[
            { t: "Asado criollo", d: "Cortes a la parrilla, al mejor estilo cordobés.", Icon: Beef },
            { t: "Folclore en vivo", d: "Guitarreada, chacareras y zambas hasta la madrugada.", Icon: Music2 },
            { t: "Fernet y birra", d: "Para brindar toda la noche entre amigos.", Icon: Wine },
            { t: "Comunidad", d: "Un punto de encuentro para argentinos y amigos de Argentina.", Icon: Users },
          ].map((c) => (
            <div key={c.t} style={{ background: "#fff", border: `2px solid ${C.doradoClaro}`, borderRadius: 10, padding: 18, textAlign: "center" }}>
              <c.Icon color={C.rojoOsc} size={26} />
              <div style={{ fontFamily: "'Alfa Slab One', serif", color: C.rojoOsc, fontSize: 16, margin: "8px 0 4px" }}>{c.t}</div>
              <div style={{ fontSize: 13, color: "#555" }}>{c.d}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const btnGold = { background: C.dorado, color: C.negro, border: "none", borderRadius: 8, padding: "12px 22px", fontWeight: 800, cursor: "pointer", fontSize: 14 };
const btnOutline = { background: "transparent", color: C.doradoClaro, border: `2px solid ${C.doradoClaro}`, borderRadius: 8, padding: "12px 22px", fontWeight: 800, cursor: "pointer", fontSize: 14 };

/* ---------------------------------- RESERVAS ---------------------------------- */
function Reservas({ reservas, persistReservas, tickets, persistTickets, config }) {
  const [cart, setCart] = useState({});
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [confirmado, setConfirmado] = useState(null);
  const [misTickets, setMisTickets] = useState([]);
  const [copiado, setCopiado] = useState(false);
  const [pagando, setPagando] = useState(false);
  const [pagoMsg, setPagoMsg] = useState(null);

  const setQty = (key, qty) => setCart((c) => ({ ...c, [key]: Math.max(0, qty) }));
  const total = Object.entries(cart).reduce((sum, [k, q]) => {
    const item = MENU.find((m) => m.key === k);
    return sum + (item ? item.precio * q : 0);
  }, 0);
  const itemsSeleccionados = Object.entries(cart).filter(([, q]) => q > 0);

  const categorias = [...new Set(MENU.map((m) => m.cat))];

  const confirmar = async () => {
    if (itemsSeleccionados.length === 0 || !nombre.trim()) return;
    const code = uid();
    const nueva = {
      id: code, nombre: nombre.trim(), telefono: telefono.trim(),
      items: itemsSeleccionados.map(([k, q]) => {
        const m = MENU.find((mm) => mm.key === k);
        return { key: k, nombre: m.nombre, precio: m.precio, cantidad: q };
      }),
      total, pagado: false, entregado: false, creado: new Date().toISOString(),
    };
    const nuevosTickets = generarTickets(nueva);
    await persistReservas([...reservas, nueva]);
    await persistTickets([...tickets, ...nuevosTickets]);
    setConfirmado(nueva);
    setMisTickets(nuevosTickets);
    setCart({}); setNombre(""); setTelefono("");
  };

  const pagarAhora = () => {
    setPagando(true); setPagoMsg(null);
    pagarConWompi(confirmado, config, (estado, txId) => {
      setPagando(false);
      if (estado === "aprobado") {
        const next = reservas.map((r) => (r.id === confirmado.id ? { ...r, pagado: true, wompiTransactionId: txId } : r));
        persistReservas(next.length ? next : reservas);
        setConfirmado((c) => ({ ...c, pagado: true }));
        setPagoMsg({ ok: true, texto: "¡Pago confirmado automáticamente! Ya podés retirar tus productos con los códigos de abajo." });
      } else if (estado === "rechazado") {
        setPagoMsg({ ok: false, texto: "El pago no se aprobó. Podés reintentar o transferir manualmente por Nequi." });
      } else {
        setPagoMsg({ ok: false, texto: "No se pudo abrir el checkout de pagos. Usá la transferencia manual por Nequi." });
      }
    });
  };

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent("nequi:" + config.nequiCuenta)}`;

  if (confirmado) {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "40px 16px" }}>
        <div style={{ background: "#fff", border: `3px solid ${C.verde}`, borderRadius: 12, padding: 24, textAlign: "center" }}>
          <CheckCircle2 color={C.verde} size={40} />
          <h2 style={{ fontFamily: "'Alfa Slab One', serif", color: C.rojoOsc, fontSize: 22, margin: "10px 0" }}>¡Reserva registrada!</h2>
          <p style={{ fontSize: 13, color: "#555" }}>Guardá este código. Lo vas a necesitar en la puerta y en la caja del evento.</p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, margin: "14px 0" }}>
            <div style={{ fontFamily: "'Alfa Slab One', serif", fontSize: 30, letterSpacing: 4, background: C.crema, border: `2px dashed ${C.dorado}`, borderRadius: 8, padding: "8px 18px" }}>{confirmado.id}</div>
            <button onClick={() => { navigator.clipboard?.writeText(confirmado.id); setCopiado(true); setTimeout(() => setCopiado(false), 1500); }} style={{ background: C.dorado, border: "none", borderRadius: 8, padding: 10, cursor: "pointer" }}>
              {copiado ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.rojoOsc, marginBottom: 10 }}>
            Total: {CURRENCY(confirmado.total)} {confirmado.pagado && <span style={{ color: C.verde }}>· Pagado ✓</span>}
          </div>

          {!confirmado.pagado && config.wompiPublicKey && (
            <div style={{ marginBottom: 14 }}>
              <button onClick={pagarAhora} disabled={pagando} style={{ ...btnGold, width: "100%", opacity: pagando ? 0.6 : 1 }}>
                {pagando ? "Abriendo checkout…" : "Pagar ahora (Nequi, PSE o tarjeta)"}
              </button>
              {pagoMsg && <p style={{ fontSize: 12, marginTop: 6, color: pagoMsg.ok ? C.verde : "#a33" }}>{pagoMsg.texto}</p>}
              <p style={{ fontSize: 11, color: "#999", margin: "6px 0 0" }}>o transferí manualmente abajo</p>
            </div>
          )}

          {!confirmado.pagado && (
            <div style={{ background: C.crema, borderRadius: 10, padding: 16 }}>
              <p style={{ fontSize: 13, margin: 0, fontWeight: 700 }}>Transferí por Nequi a:</p>
              <p style={{ fontSize: 15, margin: "4px 0" }}>{config.nequiCuenta} — {config.nequiTitular}</p>
              <img src={qrUrl} alt="QR Nequi" style={{ width: 140, height: 140, margin: "8px auto 0" }} />
              <p style={{ fontSize: 11, color: "#777", marginTop: 6 }}>
                Poné tu código <b>{confirmado.id}</b> como referencia. Un organizador confirmará tu pago manualmente contra el número de operación.
              </p>
            </div>
          )}

          <div style={{ marginTop: 18, textAlign: "left" }}>
            <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Tus códigos de canje (uno por unidad, se reclaman por separado):</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 10 }}>
              {misTickets.map((t) => (
                <div key={t.codigo} style={{ border: `1.5px dashed ${C.dorado}`, borderRadius: 8, padding: 8, textAlign: "center" }}>
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${t.codigo}`} alt="QR" style={{ width: "100%" }} />
                  <div style={{ fontSize: 11, fontWeight: 700, marginTop: 2 }}>{t.itemNombre}</div>
                  <div style={{ fontSize: 10, color: "#777" }}>{t.unidad}/{t.totalUnidades}</div>
                  <div style={{ fontFamily: "monospace", fontSize: 12, letterSpacing: 1 }}>{t.codigo}</div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 11, color: "#999", marginTop: 8 }}>
              Sacale captura o guardalos: cada código se puede canjear una sola vez en la barra o la parrilla.
            </p>
          </div>

          <button onClick={() => setConfirmado(null)} style={{ ...btnGold, marginTop: 18 }}>Hacer otra reserva</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "36px 16px 100px" }}>
      <SectionTitle icon={ShoppingCart}>Reservá tu lugar y tu mesa</SectionTitle>
      {categorias.map((cat) => (
        <div key={cat} style={{ marginBottom: 26 }}>
          <div style={{ fontFamily: "'Alfa Slab One', serif", color: C.rojoOsc, fontSize: 16, borderBottom: `2px solid ${C.doradoClaro}`, paddingBottom: 4, marginBottom: 10 }}>{cat}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 12 }}>
            {MENU.filter((m) => m.cat === cat).map((m) => (
              <div key={m.key} style={{ background: "#fff", border: `2px solid ${C.doradoClaro}`, borderRadius: 10, padding: 14 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <m.Icon size={20} color={C.rojoOsc} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>{m.nombre}</div>
                    <div style={{ fontSize: 11, color: "#777" }}>{m.desc}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: C.rojoOsc, marginTop: 4 }}>{CURRENCY(m.precio)}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                  <button onClick={() => setQty(m.key, (cart[m.key] || 0) - 1)} style={stepBtn}><Minus size={14} /></button>
                  <span style={{ fontWeight: 800, minWidth: 18, textAlign: "center" }}>{cart[m.key] || 0}</span>
                  <button onClick={() => setQty(m.key, (cart[m.key] || 0) + 1)} style={stepBtn}><Plus size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div style={{ position: "sticky", bottom: 12, background: "#fff", border: `3px solid ${C.rojoOsc}`, borderRadius: 12, padding: 16, boxShadow: "0 6px 18px rgba(0,0,0,.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, color: "#777" }}>{itemsSeleccionados.length} ítem(s) seleccionados</div>
            <div style={{ fontFamily: "'Alfa Slab One', serif", fontSize: 22, color: C.rojoOsc }}>{CURRENCY(total)}</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input placeholder="Tu nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} style={inputStyle} />
            <input placeholder="WhatsApp" value={telefono} onChange={(e) => setTelefono(e.target.value)} style={inputStyle} />
            <button onClick={confirmar} disabled={itemsSeleccionados.length === 0 || !nombre.trim()} style={{ ...btnGold, opacity: itemsSeleccionados.length === 0 || !nombre.trim() ? 0.5 : 1 }}>
              Confirmar reserva
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
const stepBtn = { width: 26, height: 26, borderRadius: "50%", border: `1px solid ${C.rojoOsc}`, background: C.crema, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };
const inputStyle = { border: `1.5px solid ${C.doradoClaro}`, borderRadius: 8, padding: "9px 10px", fontSize: 13, width: 140 };

/* ---------------------------------- MI RESERVA ---------------------------------- */
function MiReserva({ reservas, tickets }) {
  const [code, setCode] = useState("");
  const found = reservas.find((r) => r.id === code.trim().toUpperCase());
  const misTickets = found ? tickets.filter((t) => t.reservaId === found.id) : [];
  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "40px 16px 80px" }}>
      <SectionTitle icon={Search}>Consultá tu reserva</SectionTitle>
      <div style={{ display: "flex", gap: 8 }}>
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Código, ej: A1B2" style={{ ...inputStyle, flex: 1, textTransform: "uppercase" }} />
      </div>
      {code && !found && <p style={{ color: "#a33", fontSize: 13, marginTop: 12 }}>No encontramos una reserva con ese código.</p>}
      {found && (
        <div style={{ background: "#fff", border: `2px solid ${C.doradoClaro}`, borderRadius: 12, padding: 18, marginTop: 16 }}>
          <div style={{ fontWeight: 800 }}>{found.nombre}</div>
          <div style={{ fontSize: 12, color: "#777", marginBottom: 10 }}>Código {found.id}</div>
          <div style={{ fontWeight: 800, marginTop: 6 }}>Total: {CURRENCY(found.total)}</div>
          <div style={{ display: "flex", gap: 14, marginTop: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <Estado ok label="Reservado" />
            <Estado ok={found.pagado} label="Pagado" />
          </div>
          <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Tus productos (canje individual):</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {misTickets.map((t) => (
              <div key={t.codigo} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: C.crema, borderRadius: 8, padding: "8px 10px" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{t.itemNombre} <span style={{ color: "#888", fontWeight: 500 }}>({t.unidad}/{t.totalUnidades})</span></div>
                  <div style={{ fontFamily: "monospace", fontSize: 12 }}>{t.codigo}</div>
                </div>
                <Estado ok={t.entregado} label={t.entregado ? "Entregado" : "Pendiente"} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
function Estado({ ok, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: ok ? C.verde : "#999" }}>
      {ok ? <CheckCircle2 size={16} /> : <Circle size={16} />} {label}
    </div>
  );
}

/* ---------------------------------- NOSOTROS ---------------------------------- */
function Nosotros({ nosotros, gallery }) {
  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 16px 80px" }}>
      <SectionTitle icon={Users}>Nosotros</SectionTitle>
      <p style={{ fontSize: 15, lineHeight: 1.8, color: "#333", textAlign: "center" }}>{nosotros.historia}</p>

      <div style={{ marginTop: 30 }}>
        <div style={{ textAlign: "center", fontFamily: "'Alfa Slab One', serif", color: C.rojoOsc, fontSize: 16, marginBottom: 12 }}>
          Nuestros eventos
        </div>
        <div style={{
          width: "100%", aspectRatio: "4 / 3", borderRadius: 12, overflow: "hidden",
          border: `4px solid ${C.dorado}`, boxShadow: "0 8px 20px rgba(0,0,0,.35)", background: C.negro,
        }}>
          <Carousel images={gallery} />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- FOLCLORE ---------------------------------- */
function Folclore() {
  return (
    <div style={{ background: C.rojoMasOsc, padding: "40px 0 60px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 16px" }}>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, color: C.doradoClaro, fontFamily: "'Alfa Slab One', serif", fontSize: "clamp(22px,4vw,32px)" }}>
            <Music2 size={24} /> Sonidos de la peña
          </div>
          <div style={{ width: 90, height: 3, background: C.dorado, margin: "10px auto 0" }} />
        </div>
      </div>
      <div className="scrollx" style={{ display: "flex", gap: 14, overflowX: "auto", padding: "6px 16px 20px" }}>
        {FOLKLORE.map((f) => (
          <div key={f.nombre} style={{ minWidth: 170, background: `linear-gradient(160deg, ${C.rojo}, ${C.rojoOsc})`, border: `2px solid ${C.dorado}`, borderRadius: 12, padding: 16, flexShrink: 0 }}>
            <Music2 color={C.doradoClaro} size={22} />
            <div style={{ color: C.crema, fontWeight: 800, marginTop: 10, fontSize: 14 }}>{f.nombre}</div>
            <div style={{ color: C.doradoClaro, fontSize: 12, marginTop: 2 }}>{f.genero}</div>
          </div>
        ))}
      </div>
      <p style={{ textAlign: "center", color: C.crema, fontSize: 12, opacity: 0.8 }}>Deslizá para ver más →</p>
    </div>
  );
}

/* ---------------------------------- CAJA ---------------------------------- */
function Caja({ reservas, persistReservas, tickets, persistTickets, gallery, persistGallery, nosotros, persistNosotros, config, persistConfig }) {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [nuevaImg, setNuevaImg] = useState({ url: "", caption: "" });
  const [historiaEdit, setHistoriaEdit] = useState(nosotros.historia);
  const [cfgEdit, setCfgEdit] = useState(config);
  const [codigoTicket, setCodigoTicket] = useState("");
  const [ticketResultado, setTicketResultado] = useState(null);

  if (!unlocked) {
    return (
      <div style={{ maxWidth: 380, margin: "0 auto", padding: "60px 16px" }}>
        <SectionTitle icon={Lock}>Acceso de caja</SectionTitle>
        <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="PIN del staff" style={{ ...inputStyle, width: "100%", textAlign: "center" }} />
        <button onClick={() => setUnlocked(pin === CAJA_PIN)} style={{ ...btnGold, width: "100%", marginTop: 10 }}>
          <Unlock size={14} style={{ marginRight: 6, verticalAlign: -2 }} /> Ingresar
        </button>
        {pin && pin !== CAJA_PIN && <p style={{ fontSize: 12, color: "#a33", marginTop: 8, textAlign: "center" }}>PIN incorrecto</p>}
      </div>
    );
  }

  const toggle = (id, campo) => {
    const next = reservas.map((r) => (r.id === id ? { ...r, [campo]: !r[campo] } : r));
    persistReservas(next);
  };

  const buscarTicket = () => {
    const codigo = codigoTicket.trim().toUpperCase();
    const idx = tickets.findIndex((t) => t.codigo === codigo);
    if (idx === -1) { setTicketResultado({ tipo: "no-encontrado" }); return; }
    setTicketResultado({ tipo: "encontrado", ticket: tickets[idx] });
  };
  const confirmarEntrega = () => {
    if (!ticketResultado || ticketResultado.tipo !== "encontrado") return;
    const codigo = ticketResultado.ticket.codigo;
    // Vuelve a chequear contra el estado más reciente para evitar doble entrega
    const actual = tickets.find((t) => t.codigo === codigo);
    if (actual.entregado) { setTicketResultado({ tipo: "ya-entregado", ticket: actual }); return; }
    const next = tickets.map((t) => (t.codigo === codigo ? { ...t, entregado: true, entregadoEn: new Date().toISOString() } : t));
    persistTickets(next);
    setTicketResultado({ tipo: "entregado-ahora", ticket: next.find((t) => t.codigo === codigo) });
    setCodigoTicket("");
  };

  const inventario = {};
  reservas.forEach((r) => r.items.forEach((it) => {
    if (!inventario[it.nombre]) inventario[it.nombre] = { reservado: 0, pagado: 0, entregado: 0 };
    inventario[it.nombre].reservado += it.cantidad;
    if (r.pagado) inventario[it.nombre].pagado += it.cantidad;
  }));
  tickets.forEach((t) => {
    if (t.entregado && inventario[t.itemNombre]) inventario[t.itemNombre].entregado += 1;
  });

  const filtradas = reservas.filter((r) => (r.nombre + r.id).toLowerCase().includes(busqueda.toLowerCase()));
  const totalRecaudado = reservas.filter((r) => r.pagado).reduce((s, r) => s + r.total, 0);

  const exportarCSV = () => {
    const rows = [["Código", "Nombre", "Teléfono", "Items", "Total", "Pagado", "Entregado"]];
    reservas.forEach((r) => rows.push([
      r.id, r.nombre, r.telefono,
      r.items.map((i) => `${i.cantidad}x ${i.nombre}`).join(" | "),
      r.total, r.pagado ? "SI" : "NO", r.entregado ? "SI" : "NO",
    ]));
    const csv = rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "reservas_4_de_copas.csv";
    a.click();
  };

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "30px 16px 80px" }}>
      <SectionTitle icon={ShoppingCart}>Panel de caja</SectionTitle>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, marginBottom: 24 }}>
        <Stat label="Reservas" value={reservas.length} />
        <Stat label="Pagadas" value={reservas.filter((r) => r.pagado).length} />
        <Stat label="Entregadas" value={reservas.filter((r) => r.entregado).length} />
        <Stat label="Recaudado" value={CURRENCY(totalRecaudado)} />
      </div>

      <div style={{ background: C.rojoMasOsc, borderRadius: 12, padding: 16, marginBottom: 26 }}>
        <div style={{ color: C.doradoClaro, fontFamily: "'Alfa Slab One', serif", fontSize: 15, marginBottom: 8 }}>Reclamar producto (barra / parrilla)</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            value={codigoTicket}
            onChange={(e) => { setCodigoTicket(e.target.value); setTicketResultado(null); }}
            onKeyDown={(e) => e.key === "Enter" && buscarTicket()}
            placeholder="Código del ticket (o pegá lo que escaneaste)"
            style={{ ...inputStyle, flex: 1, minWidth: 200, textTransform: "uppercase" }}
          />
          <button onClick={buscarTicket} style={btnGold}>Buscar</button>
        </div>

        {ticketResultado?.tipo === "no-encontrado" && (
          <p style={{ color: "#ffb4b4", fontSize: 13, marginTop: 10 }}>Ese código no existe. Revisalo con el cliente.</p>
        )}
        {ticketResultado?.tipo === "ya-entregado" && (
          <div style={{ background: "#5a1010", borderRadius: 8, padding: 10, marginTop: 10 }}>
            <p style={{ color: "#ffb4b4", fontSize: 13, fontWeight: 800, margin: 0 }}>⚠ Este ticket ya fue entregado</p>
            <p style={{ color: C.crema, fontSize: 12, margin: "4px 0 0" }}>
              {ticketResultado.ticket.itemNombre} — entregado el {new Date(ticketResultado.ticket.entregadoEn).toLocaleString("es-CO")}
            </p>
          </div>
        )}
        {ticketResultado?.tipo === "entregado-ahora" && (
          <div style={{ background: C.verde, borderRadius: 8, padding: 10, marginTop: 10 }}>
            <p style={{ color: "#fff", fontSize: 13, fontWeight: 800, margin: 0 }}>✓ Entrega confirmada</p>
            <p style={{ color: "#fff", fontSize: 12, margin: "4px 0 0" }}>{ticketResultado.ticket.itemNombre} ({ticketResultado.ticket.unidad}/{ticketResultado.ticket.totalUnidades}) — {ticketResultado.ticket.nombreCliente}</p>
          </div>
        )}
        {ticketResultado?.tipo === "encontrado" && (
          <div style={{ background: "#fff", borderRadius: 8, padding: 10, marginTop: 10 }}>
            <p style={{ fontSize: 13, fontWeight: 800, margin: 0 }}>{ticketResultado.ticket.itemNombre} ({ticketResultado.ticket.unidad}/{ticketResultado.ticket.totalUnidades})</p>
            <p style={{ fontSize: 12, color: "#666", margin: "2px 0 8px" }}>Cliente: {ticketResultado.ticket.nombreCliente}</p>
            <button onClick={confirmarEntrega} style={{ ...btnGold, width: "100%" }}>Confirmar entrega</button>
          </div>
        )}
        <p style={{ color: C.doradoClaro, fontSize: 11, marginTop: 10, opacity: 0.85 }}>
          Cada ticket solo puede entregarse una vez: si dos personas escanean el mismo código, la segunda ve el aviso de "ya entregado".
          Recomendación: usá un único punto de canje conectado a internet para evitar que dos cajas offline entreguen el mismo producto dos veces.
        </p>
      </div>

      <div style={{ fontFamily: "'Alfa Slab One', serif", color: C.rojoOsc, fontSize: 15, marginBottom: 8 }}>Inventario de venta</div>
      <div style={{ overflowX: "auto", marginBottom: 26 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr style={{ background: C.crema }}>
            {["Producto", "Reservado", "Pagado", "Entregado"].map((h) => <th key={h} style={thStyle}>{h}</th>)}
          </tr></thead>
          <tbody>
            {Object.entries(inventario).map(([nombre, v]) => (
              <tr key={nombre}><td style={tdStyle}>{nombre}</td><td style={tdStyle}>{v.reservado}</td><td style={tdStyle}>{v.pagado}</td><td style={tdStyle}>{v.entregado}</td></tr>
            ))}
            {Object.keys(inventario).length === 0 && <tr><td style={tdStyle} colSpan={4}>Aún no hay reservas.</td></tr>}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <input placeholder="Buscar por nombre o código" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 180 }} />
        <button onClick={exportarCSV} style={btnOutlineRojo}><Download size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Exportar respaldo</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 30 }}>
        {filtradas.map((r) => {
          const tks = tickets.filter((t) => t.reservaId === r.id);
          const entregados = tks.filter((t) => t.entregado).length;
          return (
            <div key={r.id} style={{ background: "#fff", border: `1.5px solid ${C.doradoClaro}`, borderRadius: 10, padding: 12, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 13 }}>{r.nombre} <span style={{ color: "#999", fontWeight: 500 }}>· {r.id}</span></div>
                <div style={{ fontSize: 12, color: "#666" }}>{r.items.map((i) => `${i.cantidad}× ${i.nombre}`).join(", ")}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.rojoOsc }}>{CURRENCY(r.total)}</div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <button onClick={() => toggle(r.id, "pagado")} style={pillBtn(r.pagado)}>Pagado</button>
                <span style={{ fontSize: 12, color: "#666" }}>{entregados}/{tks.length} entregados</span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ fontFamily: "'Alfa Slab One', serif", color: C.rojoOsc, fontSize: 15, marginBottom: 8 }}>Galería (carrusel + nosotros)</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <input placeholder="URL de la imagen" value={nuevaImg.url} onChange={(e) => setNuevaImg({ ...nuevaImg, url: e.target.value })} style={{ ...inputStyle, flex: 2, minWidth: 180 }} />
        <input placeholder="Descripción" value={nuevaImg.caption} onChange={(e) => setNuevaImg({ ...nuevaImg, caption: e.target.value })} style={{ ...inputStyle, flex: 1, minWidth: 140 }} />
        <button onClick={() => { if (nuevaImg.url) { persistGallery([...gallery, nuevaImg]); setNuevaImg({ url: "", caption: "" }); } }} style={btnGold}>Agregar</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(100px,1fr))", gap: 8, marginBottom: 26 }}>
        {gallery.map((g, i) => (
          <div key={i} style={{ position: "relative" }}>
            <img src={g.url} style={{ width: "100%", height: 70, objectFit: "cover", borderRadius: 6 }} />
            <button onClick={() => persistGallery(gallery.filter((_, idx) => idx !== i))} style={{ position: "absolute", top: 2, right: 2, background: "rgba(0,0,0,.6)", border: "none", borderRadius: "50%", width: 20, height: 20, color: "#fff", cursor: "pointer" }}>
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>

      <div style={{ fontFamily: "'Alfa Slab One', serif", color: C.rojoOsc, fontSize: 15, marginBottom: 8 }}>Historia (Nosotros)</div>
      <textarea value={historiaEdit} onChange={(e) => setHistoriaEdit(e.target.value)} rows={4} style={{ ...inputStyle, width: "100%", marginBottom: 8 }} />
      <button onClick={() => persistNosotros({ ...nosotros, historia: historiaEdit })} style={{ ...btnOutlineRojo, marginBottom: 26 }}><Save size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Guardar historia</button>

      <div style={{ fontFamily: "'Alfa Slab One', serif", color: C.rojoOsc, fontSize: 15, marginBottom: 8 }}>Cuenta Nequi (pago manual)</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        <input value={cfgEdit.nequiCuenta} onChange={(e) => setCfgEdit({ ...cfgEdit, nequiCuenta: e.target.value })} style={inputStyle} placeholder="Número Nequi" />
        <input value={cfgEdit.nequiTitular} onChange={(e) => setCfgEdit({ ...cfgEdit, nequiTitular: e.target.value })} style={inputStyle} placeholder="Titular" />
        <button onClick={() => persistConfig(cfgEdit)} style={btnOutlineRojo}><Save size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Guardar</button>
      </div>

      <div style={{ fontFamily: "'Alfa Slab One', serif", color: C.rojoOsc, fontSize: 15, marginBottom: 8 }}>Pago automático (Wompi)</div>
      <p style={{ fontSize: 12, color: "#777", marginBottom: 8 }}>
        Pegá acá la llave pública de tu cuenta Wompi (empieza con pub_test_ o pub_prod_) para habilitar el botón "Pagar ahora" con Nequi, PSE o tarjeta sin intervención humana.
        Se crea gratis en el panel de comercio de Wompi.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input value={cfgEdit.wompiPublicKey || ""} onChange={(e) => setCfgEdit({ ...cfgEdit, wompiPublicKey: e.target.value })} style={{ ...inputStyle, width: 260 }} placeholder="pub_prod_xxxxxxxx" />
        <button onClick={() => persistConfig(cfgEdit)} style={btnOutlineRojo}><Save size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Guardar</button>
      </div>
    </div>
  );
}
const thStyle = { textAlign: "left", padding: "8px 10px", borderBottom: `2px solid ${C.dorado}` };
const tdStyle = { padding: "8px 10px", borderBottom: "1px solid #eee" };
const btnOutlineRojo = { background: "#fff", color: C.rojoOsc, border: `2px solid ${C.rojoOsc}`, borderRadius: 8, padding: "9px 14px", fontWeight: 800, cursor: "pointer", fontSize: 13 };
const pillBtn = (on) => ({ background: on ? C.verde : "#eee", color: on ? "#fff" : "#666", border: "none", borderRadius: 20, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" });
function Stat({ label, value }) {
  return (
    <div style={{ background: "#fff", border: `2px solid ${C.doradoClaro}`, borderRadius: 10, padding: 14, textAlign: "center" }}>
      <div style={{ fontFamily: "'Alfa Slab One', serif", fontSize: 20, color: C.rojoOsc }}>{value}</div>
      <div style={{ fontSize: 11, color: "#777" }}>{label}</div>
    </div>
  );
}

/* ---------------------------------- MUSIC PLAYER ---------------------------------- */
/* Los navegadores bloquean el autoplay con sonido hasta que el usuario interactúa
   con la página, así que no hay forma confiable de que la música arranque sola al
   abrir. Este botón flotante queda visible desde que carga la página y con un solo
   clic arranca la canción — es el equivalente más cercano a "reproducir al abrir"
   que los navegadores permiten. */
const YOUTUBE_VIDEO_ID = "FzKfx6J6AdY";
function MusicPlayer() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "fixed", bottom: 18, right: 18, zIndex: 50, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
      {open && (
        <div style={{ background: C.negro, border: `2px solid ${C.dorado}`, borderRadius: 10, overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,.5)" }}>
          <iframe
            width="280" height="158"
            src={`https://www.youtube-nocookie.com/embed/${YOUTUBE_VIDEO_ID}?autoplay=1&loop=1&playlist=${YOUTUBE_VIDEO_ID}`}
            title="Música de la peña"
            style={{ display: "block", border: "none" }}
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        title={open ? "Ocultar música" : "Escuchar música"}
        style={{
          width: 52, height: 52, borderRadius: "50%", background: C.dorado, border: `2px solid ${C.doradoClaro}`,
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
          boxShadow: "0 4px 14px rgba(0,0,0,.5)",
        }}
      >
        <Music2 color={C.negro} size={22} />
      </button>
    </div>
  );
}

/* ---------------------------------- FOOTER ---------------------------------- */
function Footer() {
  return (
    <footer style={{ background: C.negro, color: C.crema, padding: "26px 16px", textAlign: "center", fontSize: 12 }}>
      <div style={{ display: "flex", gap: 18, justifyContent: "center", marginBottom: 10, flexWrap: "wrap" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><MapPin size={14} /> Ubicación a confirmar</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Phone size={14} /> WhatsApp por reservas</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Instagram size={14} /> @los4decopas</span>
      </div>
      <div style={{ opacity: 0.6 }}>La Gran Peña Los 4 de Copas — hecho con fileteado porteño y orgullo cordobés</div>
    </footer>
  );
}
