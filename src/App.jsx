import React, { useState, useEffect, useRef, useCallback } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import emailjs from "@emailjs/browser";
import jsQR from "jsqr";
import {
  Menu, X, MapPin, Phone, Instagram, Music2, Users, ShoppingCart,
  CheckCircle2, Circle, Lock, Plus, Minus, Search, Download,
  ChevronLeft, ChevronRight, Beef, Wine, UtensilsCrossed, Ticket,
  Image as ImageIcon, Flame, Trash2, Save, Unlock, Copy, Check
} from "lucide-react";
import fondoPenaMobile from "./imagenes/fondo/fondo-4-octubre.png";
import primeraPena from "./imagenes/fondo/primera-pena.jpeg";
import foto1 from "./imagenes/Fotos/foto1.jpeg";
import foto2 from "./imagenes/Fotos/foto2.jpeg";
import foto3 from "./imagenes/Fotos/foto3.jpeg";
import qrBreB from "./imagenes/llave nequi/qr-breb.jpeg";

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
  { nombre: "Los Manseros de Tarija", genero: "Cuarteto de folklore argentino" },
  { nombre: "Los Carabajal", genero: "Chacarera de Santiago" },
];

const GALERIA_INICIAL = [
  { url: foto1, caption: "Los de siempre, armando la previa" },
  { url: foto2, caption: "La barra completa" },
  { url: foto3, caption: "Así va a ser nuestra próxima peña" },
];

/* Acepta tanto un ID de playlist pelado como un link completo de
   YouTube o YouTube Music y devuelve solo el ID (parámetro ?list=) */
function extraerPlaylistId(input) {
  const v = (input || "").trim();
  if (!v) return "";
  try {
    const url = new URL(v);
    const list = url.searchParams.get("list");
    if (list) return list;
  } catch {
    // no era una URL, asumimos que ya es el ID
  }
  return v;
}

const ADMIN_PIN_DEFAULT = "1810";
const STAFF_PIN_DEFAULT = "2026";
const PRECIO_RESERVA = 50000;
const CURRENCY = (n) => "$" + n.toLocaleString("es-CO");
const uid = () => Math.random().toString(36).slice(2, 6).toUpperCase();
const ticketCode = () => uid() + uid();

/* Arma el texto de confirmación por WhatsApp según el estado de pago de la reserva */
function mensajeWhatsApp(r) {
  const nombre = r.nombre.split(" ")[0];
  const totalPersonas = r.personasTotal || 1;
  const personas = `${totalPersonas} persona${totalPersonas === 1 ? "" : "s"}`;
  if (r.pagado) {
    return `¡Hola ${nombre}! 🇦🇷🇨🇴 Somos de La Gran Peña Los 4 de Copas.

Te confirmamos tu reserva ✅
🎟️ Código: ${r.id}
👥 ${personas}
💰 Total: ${CURRENCY(r.total)} (saldo consumible en productos)
✅ Pago confirmado

Guardá tu código: lo vas a necesitar el día del evento para comprar productos con tu saldo. ¡Nos vemos en la peña! 🔥🥂`;
  }
  if (r.pagoReportado) {
    return `¡Hola ${nombre}! 👋 Somos de La Gran Peña Los 4 de Copas.

Recibimos tu comprobante de pago (ref. ${r.referenciaPago}) y lo estamos verificando ⏳
🎟️ Código: ${r.id}
👥 ${personas}
💰 Total: ${CURRENCY(r.total)}

Te avisamos apenas quede confirmado. ¡Gracias por tu paciencia! 🙌`;
  }
  return `¡Hola ${nombre}! 👋 Somos de La Gran Peña Los 4 de Copas.

Registramos tu reserva 📝
🎟️ Código: ${r.id}
👥 ${personas}
💰 Total: ${CURRENCY(r.total)}
⏳ Todavía no vemos tu pago confirmado

Para asegurar tu cupo, transferí usando el código ${r.id} como referencia y reportalo desde la web (o respondé este mensaje con el número de confirmación). ¡Cualquier duda, escribinos! 🙌`;
}

function linkWhatsApp(r) {
  const digits = (r.telefono || "").replace(/\D/g, "");
  const numero = digits.startsWith("57") ? digits : `57${digits}`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensajeWhatsApp(r))}`;
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

/* Envía un correo vía EmailJS (directo desde el navegador, sin backend propio).
   Si la config todavía no tiene las 3 claves de EmailJS, no hace nada. */
async function enviarEmail(config, { to_email, to_name, subject, message }) {
  if (!config.emailjsServiceId || !config.emailjsTemplateId || !config.emailjsPublicKey || !to_email) return false;
  try {
    await emailjs.send(
      config.emailjsServiceId,
      config.emailjsTemplateId,
      { to_email, to_name, subject, message },
      { publicKey: config.emailjsPublicKey }
    );
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
  const [config, setConfig] = useState({ nequiCuenta: "300 000 0000", nequiTitular: "Los 4 de Copas", wompiPublicKey: "", folklorePlaylistId: "PLbieyCp0yxpI", llaveBreB: "@NEQUIMIG29886", llaveTitular: "Miguel Rojas", staffEmail: "penalos4decopas@gmail.com", emailjsServiceId: "service_3gut3gq", emailjsTemplateId: "template_4tv7cqo", emailjsPublicKey: "SnbYUwrSp9PTDEPqs", comprasHabilitadas: true, adminPin: ADMIN_PIN_DEFAULT, staffPin: STAFF_PIN_DEFAULT });
  const [reservas, setReservas] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [compras, setCompras] = useState([]);
  const [offline, setOffline] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const [g, n, cfg, r, t, c] = await Promise.all([
        storageGet("pena4copas:gallery", null),
        storageGet("pena4copas:nosotros", null),
        storageGet("pena4copas:config", null),
        storageGet("pena4copas:reservations", null),
        storageGet("pena4copas:tickets", null),
        storageGet("pena4copas:compras", null),
      ]);
      if (g === undefined && n === undefined && cfg === undefined && r === undefined) setOffline(true);
      setGallery(g || GALERIA_INICIAL);
      setNosotros(
        n || {
          historia:
            "La Gran Peña Los 4 de Copas nació en Bogotá, no en Argentina — y ahí está toda la magia. Somos cuatro argentinos que la vida (y algún que otro vuelo de ida) trajo hasta Colombia hace ya varios años: un cordobés con la tonada más marcada del grupo y el As de copas porque siempre lo veras con una birrita en mano, un salteño que jamás sale de casa sin su mate y si su susuky 650, un rosarino canalla hasta los huesos y cantante lirico, y un patagónico que todavía extraña el viento del sur, el que dice que la fiesta no acaba hasta que salga el sol. Nos conocimos acá, lejos de casa, y lo que arrancó como juntadas para hablar de fútbol y extrañar el asado de la abuela terminó siendo una amistad de las de verdad. Con el tiempo entendimos que teníamos algo hermoso para compartir: nuestra cultura, nuestras tradiciones, nuestro folklore — y muchísimas ganas de decirle gracias a Colombia, este país hermoso que nos abrió las puertas, nos dio un hogar y nos regaló amigos que hoy son familia. La Gran Peña Los 4 de Copas es nuestra forma de devolver ese cariño: un pedacito de Argentina hecho con el corazón, para compartir con la tierra que nos adoptó.",
        }
      );
      setConfig(cfg || { nequiCuenta: "300 000 0000", nequiTitular: "Los 4 de Copas", wompiPublicKey: "", folklorePlaylistId: "PLbieyCp0yxpI", llaveBreB: "@NEQUIMIG29886", llaveTitular: "Miguel Rojas", staffEmail: "penalos4decopas@gmail.com", emailjsServiceId: "service_3gut3gq", emailjsTemplateId: "template_4tv7cqo", emailjsPublicKey: "SnbYUwrSp9PTDEPqs", comprasHabilitadas: true, adminPin: ADMIN_PIN_DEFAULT, staffPin: STAFF_PIN_DEFAULT });
      setReservas(r || []);
      setTickets(t || []);
      setCompras(c || []);
      setLoaded(true);
    })();
  }, []);

  const persistReservas = useCallback(async (next) => {
    setReservas(next);
    const ok = await storageSet("pena4copas:reservations", next);
    if (!ok) setOffline(true);
  }, []);
  const persistCompras = useCallback(async (next) => {
    setCompras(next);
    const ok = await storageSet("pena4copas:compras", next);
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
    { id: "comprar", label: "Comprar" },
    { id: "mi-reserva", label: "Mi reserva" },
    { id: "nosotros", label: "Nosotros" },
    { id: "folclore", label: "Folklore" },
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
      {(() => {
        const overlay = tab === "inicio" && !navOpen;
        return (
          <nav style={{
            position: overlay ? "absolute" : "sticky", top: 0, left: 0, right: 0, zIndex: 40,
            background: overlay ? "linear-gradient(to bottom, rgba(0,0,0,.5), transparent)" : C.rojoMasOsc,
            borderBottom: overlay ? "none" : `3px solid ${C.dorado}`,
            transition: "background .2s",
          }}>
            <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px" }}>
              <button onClick={() => setTab("inicio")} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                <FlagRibbon compact />
                <span style={{ color: C.crema, fontFamily: "'Alfa Slab One', serif", fontSize: 15, textShadow: overlay ? "0 1px 4px rgba(0,0,0,.8)" : "none" }}>LOS 4 DE COPAS</span>
              </button>
              <div style={{ display: "flex", gap: 4 }} className="desktop-nav">
                {NAV.map((n) => (
                  <button key={n.id} onClick={() => setTab(n.id)}
                    style={{
                      background: tab === n.id ? C.dorado : "transparent",
                      color: tab === n.id ? C.negro : C.crema,
                      border: "none", borderRadius: 5, padding: "8px 12px", fontWeight: 700, fontSize: 13, cursor: "pointer",
                      textShadow: overlay && tab !== n.id ? "0 1px 4px rgba(0,0,0,.8)" : "none",
                    }}>
                    {n.label}
                  </button>
                ))}
              </div>
              <button onClick={() => setNavOpen((v) => !v)} className="mobile-nav-btn" style={{ background: "none", border: "none", color: C.crema, display: "none", filter: overlay ? "drop-shadow(0 1px 4px rgba(0,0,0,.8))" : "none" }}>
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
        );
      })()}

      {tab === "inicio" && <Inicio setTab={setTab} gallery={gallery} />}
      {tab === "reservas" && (
        <Reservas reservas={reservas} persistReservas={persistReservas} config={config} />
      )}
      {tab === "comprar" && (
        <Comprar reservas={reservas} persistReservas={persistReservas} compras={compras} persistCompras={persistCompras} config={config} />
      )}
      {tab === "mi-reserva" && <MiReserva reservas={reservas} compras={compras} />}
      {tab === "nosotros" && <Nosotros nosotros={nosotros} gallery={gallery} />}
      {tab === "folclore" && <Folclore config={config} />}
      {tab === "admin" && (
        <AdminPanel
          reservas={reservas} persistReservas={persistReservas}
          compras={compras} persistCompras={persistCompras}
          gallery={gallery} persistGallery={persistGallery}
          nosotros={nosotros} persistNosotros={persistNosotros}
          config={config} persistConfig={persistConfig}
        />
      )}
      {tab === "staff" && (
        <StaffPanel compras={compras} persistCompras={persistCompras} config={config} />
      )}

      <Footer setTab={setTab} />
      <MusicPlayer />
    </div>
  );
}

/* ---------------------------------- INICIO ---------------------------------- */
const HERO_IMAGES = [fondoPenaMobile, primeraPena];

function HeroCarousel({ images }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (images.length < 2) return;
    const t = setInterval(() => setI((v) => (v + 1) % images.length), 5500);
    return () => clearInterval(t);
  }, [images.length]);

  return (
    <div style={{ position: "relative" }}>
      <img src={images[i]} alt="La Gran Peña Los 4 de Copas" className="hero-poster" />
      {images.length > 1 && (
        <>
          <button onClick={() => setI((v) => (v - 1 + images.length) % images.length)} style={navBtnStyle("left")}><ChevronLeft size={18} /></button>
          <button onClick={() => setI((v) => (v + 1) % images.length)} style={navBtnStyle("right")}><ChevronRight size={18} /></button>
          <div style={{ position: "absolute", bottom: 10, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 6 }}>
            {images.map((_, idx) => (
              <button key={idx} onClick={() => setI(idx)} style={{
                width: 8, height: 8, borderRadius: "50%", border: "none", padding: 0, cursor: "pointer",
                background: idx === i ? C.dorado : "rgba(255,255,255,.5)",
              }} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Inicio({ setTab, gallery }) {
  return (
    <div>
      <style>{`
        .hero-poster { display: block; width: 100%; height: auto; }
        @media (min-width: 761px) {
          .hero-poster { width: 480px; margin: 0 auto; }
        }
      `}</style>
      <div style={{ background: C.rojoMasOsc }}>
        <HeroCarousel images={HERO_IMAGES} />
      </div>

      <div style={{ background: `radial-gradient(circle at 50% 0%, ${C.rojo}, ${C.rojoMasOsc})`, padding: "26px 16px 44px", textAlign: "center" }}>
        <p style={{ color: C.doradoClaro, maxWidth: 480, margin: "0 auto", fontSize: 14, lineHeight: 1.6 }}>
          Asado al buen estilo argentino, fernet compartido y folklore de fondo. Una juntada para argentinos y para nuestros hermanos colombianos.
        </p>

        <style>{`
          .hero-cta { display: flex; gap: 12px; justify-content: center; margin-top: 22px; flex-wrap: wrap; }
          @media (max-width: 480px) {
            .hero-cta { flex-direction: column; align-items: stretch; padding-bottom: 60px; }
          }
        `}</style>
        <div className="hero-cta">
          <button onClick={() => setTab("reservas")} style={btnGold}>Realiza tu reserva</button>
          <button onClick={() => setTab("nosotros")} style={btnOutline}>Conocé la peña</button>
        </div>
      </div>
    </div>
  );
}

const btnGold = { background: C.dorado, color: C.negro, border: "none", borderRadius: 8, padding: "12px 22px", fontWeight: 800, cursor: "pointer", fontSize: 14 };
const btnOutline = { background: "transparent", color: C.doradoClaro, border: `2px solid ${C.doradoClaro}`, borderRadius: 8, padding: "12px 22px", fontWeight: 800, cursor: "pointer", fontSize: 14 };

/* ---------------------------------- RESERVAS ---------------------------------- */
/* Bloque de pago manual reutilizado por la Reserva y por la Compra de productos.
   `onReportar(ref)` debe persistir la referencia en quien lo use (reserva o compra). */
function BloquePagoManual({ config, codigo, pagado, pagoReportado, referenciaPago, onReportar }) {
  const [referencia, setReferencia] = useState("");
  const [reportando, setReportando] = useState(false);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent("nequi:" + config.nequiCuenta)}`;

  if (pagado) return null;

  const enviar = async () => {
    if (!referencia.trim()) return;
    setReportando(true);
    await onReportar(referencia.trim());
    setReportando(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ background: "#fff", border: `1.5px solid ${C.doradoClaro}`, borderRadius: 10, padding: "12px 14px", textAlign: "left" }}>
        <p style={{ fontSize: 12, fontWeight: 800, margin: "0 0 6px", color: C.rojoOsc }}>¿Cómo pagar?</p>
        <ol style={{ fontSize: 12, color: "#444", margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
          <li>Transferí el total por Nequi o con la llave Bre-B (abajo) usando <b>{codigo}</b> como referencia.</li>
          <li>Escribí el número de confirmación que te da tu banco y tocá "Ya transferí".</li>
          <li>Un organizador verifica el pago contra el movimiento bancario — no es instantáneo, puede tardar unas horas.</li>
        </ol>
      </div>

      <div style={{ background: C.crema, borderRadius: 10, padding: 16 }}>
        <p style={{ fontSize: 13, margin: 0, fontWeight: 700 }}>Transferí por Nequi a:</p>
        <p style={{ fontSize: 15, margin: "4px 0" }}>{config.nequiCuenta} — {config.nequiTitular}</p>
        <img src={qrUrl} alt="QR Nequi" style={{ width: 140, height: 140, margin: "8px auto 0" }} />
      </div>

      {config.llaveBreB && (
        <div style={{ background: C.crema, borderRadius: 10, padding: 16 }}>
          <p style={{ fontSize: 13, margin: 0, fontWeight: 700 }}>O con tu llave Bre-B a:</p>
          <p style={{ fontSize: 15, margin: "4px 0" }}>{config.llaveBreB} — {config.llaveTitular}</p>
          <img src={qrBreB} alt="QR Bre-B" style={{ width: 160, margin: "8px auto 0", display: "block", borderRadius: 6 }} />
          <p style={{ fontSize: 11, color: "#777", margin: "6px 0 0" }}>Desde cualquier banco, buscá "Bre-B" o "pagar con llave" en tu app.</p>
        </div>
      )}

      {!pagoReportado && (
        <div style={{ background: "#fff", border: `2px dashed ${C.dorado}`, borderRadius: 10, padding: 14 }}>
          <p style={{ fontSize: 12, margin: "0 0 8px", fontWeight: 700 }}>Ya transferiste? Asegurá tu cupo:</p>
          <input
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
            placeholder="Número de referencia/confirmación de la transferencia"
            style={{ ...inputStyle, width: "100%", marginBottom: 8 }}
          />
          <button onClick={enviar} disabled={reportando || !referencia.trim()} style={{ ...btnGold, width: "100%", opacity: reportando || !referencia.trim() ? 0.6 : 1 }}>
            {reportando ? "Guardando…" : "Ya transferí"}
          </button>
        </div>
      )}
      {pagoReportado && (
        <p style={{ fontSize: 12, color: "#b8860b", textAlign: "center", margin: 0 }}>
          Referencia recibida ({referenciaPago}). Un organizador va a confirmar tu pago contra el movimiento bancario.
        </p>
      )}
    </div>
  );
}

function Reservas({ reservas, persistReservas, config }) {
  const [nombre, setNombre] = useState("");
  const [acompanantes, setAcompanantes] = useState(0);
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [confirmado, setConfirmado] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const [pagando, setPagando] = useState(false);
  const [pagoMsg, setPagoMsg] = useState(null);

  const personasTotal = 1 + Math.max(0, Number(acompanantes) || 0);

  const confirmar = async () => {
    if (!nombre.trim()) return;
    const code = uid();
    const nueva = {
      id: code, nombre: nombre.trim(), telefono: telefono.trim(), email: email.trim(),
      acompanantes: Math.max(0, Number(acompanantes) || 0), personasTotal,
      total: PRECIO_RESERVA, saldoConsumible: PRECIO_RESERVA, saldoUsado: 0,
      pagado: false, pagoReportado: false, referenciaPago: "", creado: new Date().toISOString(),
    };
    await persistReservas([...reservas, nueva]);
    setConfirmado(nueva);
    setNombre(""); setAcompanantes(0); setTelefono(""); setEmail("");
  };

  const pagarAhora = () => {
    setPagando(true); setPagoMsg(null);
    pagarConWompi(confirmado, config, (estado, txId) => {
      setPagando(false);
      if (estado === "aprobado") {
        const next = reservas.map((r) => (r.id === confirmado.id ? { ...r, pagado: true, wompiTransactionId: txId } : r));
        persistReservas(next.length ? next : reservas);
        setConfirmado((c) => ({ ...c, pagado: true }));
        setPagoMsg({ ok: true, texto: "¡Pago confirmado automáticamente!" });
      } else if (estado === "rechazado") {
        setPagoMsg({ ok: false, texto: "El pago no se aprobó. Podés reintentar o transferir manualmente por Nequi." });
      } else {
        setPagoMsg({ ok: false, texto: "No se pudo abrir el checkout de pagos. Usá la transferencia manual por Nequi." });
      }
    });
  };

  const reportarPago = async (ref) => {
    const actualizada = { ...confirmado, pagoReportado: true, referenciaPago: ref };
    const next = reservas.map((r) => (r.id === confirmado.id ? actualizada : r));
    await persistReservas(next);
    setConfirmado(actualizada);

    if (config.staffEmail) {
      enviarEmail(config, {
        to_email: config.staffEmail,
        to_name: "Staff",
        subject: `Nuevo pago reportado - ${actualizada.id}`,
        message: `${actualizada.nombre} (${actualizada.personasTotal} persona/s) reportó una transferencia para la reserva ${actualizada.id} (${CURRENCY(actualizada.total)}).\nReferencia: ${ref}\nVerificalo en el panel de Admin contra el movimiento bancario.`,
      });
    }
    if (actualizada.email) {
      enviarEmail(config, {
        to_email: actualizada.email,
        to_name: actualizada.nombre,
        subject: "¡Ya llegó tu comprobante! - La Gran Peña Los 4 de Copas",
        message: `¡Hola ${actualizada.nombre.split(" ")[0]}! 👋 Recibimos la referencia de tu transferencia (${ref}) para la reserva ${actualizada.id}. Un organizador la va a verificar contra el movimiento bancario y te avisamos por acá apenas quede confirmada — no falta nada, ya estás a un pasito del asado, el fernet y la buena joda. ¡Gracias por tu paciencia!`,
      });
    }
  };

  if (confirmado) {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "40px 16px" }}>
        <div style={{ background: "#fff", border: `3px solid ${C.verde}`, borderRadius: 12, padding: 24, textAlign: "center" }}>
          <CheckCircle2 color={C.verde} size={40} />
          <h2 style={{ fontFamily: "'Alfa Slab One', serif", color: C.rojoOsc, fontSize: 22, margin: "10px 0" }}>¡Reserva registrada!</h2>
          <p style={{ fontSize: 13, color: "#555" }}>Guardá este código: lo vas a necesitar para comprar productos el día del evento.</p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, margin: "14px 0" }}>
            <div style={{ fontFamily: "'Alfa Slab One', serif", fontSize: 30, letterSpacing: 4, background: C.crema, border: `2px dashed ${C.dorado}`, borderRadius: 8, padding: "8px 18px" }}>{confirmado.id}</div>
            <button onClick={() => { navigator.clipboard?.writeText(confirmado.id); setCopiado(true); setTimeout(() => setCopiado(false), 1500); }} style={{ background: C.dorado, border: "none", borderRadius: 8, padding: 10, cursor: "pointer" }}>
              {copiado ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
          <p style={{ fontSize: 13, color: "#555", margin: "0 0 10px" }}>{confirmado.personasTotal} persona(s) en total (vos + {confirmado.acompanantes} acompañante{confirmado.acompanantes === 1 ? "" : "s"})</p>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.rojoOsc, marginBottom: 10 }}>
            Total: {CURRENCY(confirmado.total)} — 100% consumible en productos el día del evento{" "}
            {confirmado.pagado ? (
              <span style={{ color: C.verde }}>· Pagado ✓</span>
            ) : confirmado.pagoReportado ? (
              <span style={{ color: "#b8860b" }}>· Pago reportado, verificando…</span>
            ) : null}
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

          <BloquePagoManual
            config={config} codigo={confirmado.id}
            pagado={confirmado.pagado} pagoReportado={confirmado.pagoReportado} referenciaPago={confirmado.referenciaPago}
            onReportar={reportarPago}
          />

          <button onClick={() => setConfirmado(null)} style={{ ...btnGold, marginTop: 18 }}>Hacer otra reserva</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "40px 16px 80px" }}>
      <SectionTitle icon={ShoppingCart}>Reservá tu lugar</SectionTitle>
      <div style={{ background: "#fff", border: `2px solid ${C.doradoClaro}`, borderRadius: 12, padding: 20 }}>
        <p style={{ fontSize: 13, color: "#555", textAlign: "center", marginTop: 0 }}>
          <b>{CURRENCY(PRECIO_RESERVA)}</b> por reserva, 100% consumible en productos el día del evento (asado, bebidas, etc.).
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input placeholder="Tu nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} style={{ ...inputStyle, width: "100%" }} />
          <div>
            <label style={{ fontSize: 12, color: "#777", display: "block", marginBottom: 4 }}>Acompañantes (además de vos)</label>
            <input type="number" min={0} placeholder="0" aria-label="Acompañantes" value={acompanantes} onChange={(e) => setAcompanantes(Math.max(0, Number(e.target.value) || 0))} style={{ ...inputStyle, width: "100%" }} />
          </div>
          <p style={{ fontSize: 12, color: C.rojoOsc, fontWeight: 700, margin: 0 }}>Van a ser {personasTotal} persona{personasTotal === 1 ? "" : "s"} en total.</p>
          <input placeholder="WhatsApp" value={telefono} onChange={(e) => setTelefono(e.target.value)} style={{ ...inputStyle, width: "100%" }} />
          <input placeholder="Correo (para avisarte del pago)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ ...inputStyle, width: "100%" }} />
          <button onClick={confirmar} disabled={!nombre.trim()} style={{ ...btnGold, width: "100%", opacity: !nombre.trim() ? 0.5 : 1 }}>
            Reservar — {CURRENCY(PRECIO_RESERVA)}
          </button>
        </div>
      </div>
    </div>
  );
}
const stepBtn = { width: 26, height: 26, borderRadius: "50%", border: `1px solid ${C.rojoOsc}`, background: C.crema, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };
const inputStyle = { border: `1.5px solid ${C.doradoClaro}`, borderRadius: 8, padding: "9px 10px", fontSize: 13, width: 140 };

/* ---------------------------------- COMPRAR PRODUCTOS (día del evento) ---------------------------------- */
function Comprar({ reservas, persistReservas, compras, persistCompras, config }) {
  const [codigo, setCodigo] = useState("");
  const [reserva, setReserva] = useState(null);
  const [error, setError] = useState("");
  const [cart, setCart] = useState({});
  const [confirmando, setConfirmando] = useState(false);
  const [confirmada, setConfirmada] = useState(null);

  if (config.comprasHabilitadas === false) {
    return (
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "60px 16px", textAlign: "center" }}>
        <SectionTitle icon={ShoppingCart}>Comprar productos</SectionTitle>
        <p style={{ fontSize: 14, color: "#555" }}>La compra de productos todavía no está habilitada. Volvé a intentarlo el día del evento.</p>
      </div>
    );
  }

  const buscar = () => {
    setError("");
    const code = codigo.trim().toUpperCase();
    const r = reservas.find((x) => x.id === code);
    if (!r) { setError("No encontramos ese código de reserva."); setReserva(null); return; }
    if (!r.pagado) { setError("Tu reserva todavía no está confirmada por el staff. Esperá la confirmación antes de comprar productos."); setReserva(null); return; }
    setReserva(r);
  };

  const setQty = (key, qty) => setCart((c) => ({ ...c, [key]: Math.max(0, qty) }));
  const totalProductos = Object.entries(cart).reduce((sum, [k, q]) => {
    const item = MENU.find((m) => m.key === k);
    return sum + (item ? item.precio * q : 0);
  }, 0);
  const itemsSeleccionados = Object.entries(cart).filter(([, q]) => q > 0);
  const categorias = [...new Set(MENU.map((m) => m.cat))];

  const saldoDisponible = reserva ? Math.max(0, (reserva.saldoConsumible || 0) - (reserva.saldoUsado || 0)) : 0;
  const saldoAplicado = Math.min(totalProductos, saldoDisponible);
  const montoAPagar = Math.max(0, totalProductos - saldoDisponible);

  const confirmarCompra = async () => {
    if (itemsSeleccionados.length === 0 || !reserva || confirmando) return;
    setConfirmando(true);
    const code = ticketCode();
    const nueva = {
      id: code, reservaId: reserva.id, nombre: reserva.nombre,
      items: itemsSeleccionados.map(([k, q]) => {
        const m = MENU.find((mm) => mm.key === k);
        return { key: k, nombre: m.nombre, precio: m.precio, cantidad: q };
      }),
      total: totalProductos, saldoAplicado, montoAPagar,
      pagado: montoAPagar === 0, pagoReportado: false, referenciaPago: "",
      entregado: false, creado: new Date().toISOString(),
    };
    await persistCompras([...compras, nueva]);
    const reservaActualizada = { ...reserva, saldoUsado: reserva.saldoUsado + saldoAplicado };
    await persistReservas(reservas.map((r) => (r.id === reserva.id ? reservaActualizada : r)));
    setConfirmada(nueva);
    setCart({});
    setConfirmando(false);
  };

  const reportarPago = async (ref) => {
    const actualizada = { ...confirmada, pagoReportado: true, referenciaPago: ref };
    const next = compras.map((c) => (c.id === confirmada.id ? actualizada : c));
    await persistCompras(next);
    setConfirmada(actualizada);
  };

  if (confirmada) {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "40px 16px" }}>
        <div style={{ background: "#fff", border: `3px solid ${C.verde}`, borderRadius: 12, padding: 24, textAlign: "center" }}>
          <CheckCircle2 color={C.verde} size={40} />
          <h2 style={{ fontFamily: "'Alfa Slab One', serif", color: C.rojoOsc, fontSize: 22, margin: "10px 0" }}>¡Pedido registrado!</h2>
          <p style={{ fontSize: 13, color: "#555" }}>Mostrale este código QR al staff en la barra o la parrilla para retirar tus productos.</p>
          <img src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${confirmada.id}`} alt="QR del pedido" style={{ width: 200, height: 200, margin: "10px auto" }} />
          <div style={{ fontFamily: "monospace", fontSize: 18, letterSpacing: 2, marginBottom: 14 }}>{confirmada.id}</div>

          <div style={{ textAlign: "left", background: C.crema, borderRadius: 10, padding: 14, marginBottom: 14 }}>
            {confirmada.items.map((it) => (
              <div key={it.key} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                <span>{it.cantidad}× {it.nombre}</span>
                <span style={{ fontWeight: 700 }}>{CURRENCY(it.precio * it.cantidad)}</span>
              </div>
            ))}
            <div style={{ borderTop: `1px solid ${C.doradoClaro}`, marginTop: 8, paddingTop: 8, fontSize: 13, display: "flex", justifyContent: "space-between", fontWeight: 800 }}>
              <span>Total</span><span>{CURRENCY(confirmada.total)}</span>
            </div>
            {confirmada.saldoAplicado > 0 && (
              <div style={{ fontSize: 12, color: C.verde, marginTop: 4 }}>Cubierto con tu saldo de reserva: {CURRENCY(confirmada.saldoAplicado)}</div>
            )}
          </div>

          {confirmada.montoAPagar > 0 ? (
            <>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.rojoOsc, marginBottom: 10 }}>
                A transferir: {CURRENCY(confirmada.montoAPagar)}{" "}
                {confirmada.pagado ? <span style={{ color: C.verde }}>· Pagado ✓</span> : confirmada.pagoReportado ? <span style={{ color: "#b8860b" }}>· reportado</span> : null}
              </div>
              <BloquePagoManual
                config={config} codigo={confirmada.id}
                pagado={confirmada.pagado} pagoReportado={confirmada.pagoReportado} referenciaPago={confirmada.referenciaPago}
                onReportar={reportarPago}
              />
            </>
          ) : (
            <p style={{ fontSize: 13, color: C.verde, fontWeight: 700 }}>Ya está todo cubierto con tu saldo — no tenés que transferir nada más.</p>
          )}

          <button onClick={() => { setConfirmada(null); setReserva(null); setCodigo(""); }} style={{ ...btnGold, marginTop: 18 }}>Hacer otra compra</button>
        </div>
      </div>
    );
  }

  if (!reserva) {
    return (
      <div style={{ maxWidth: 420, margin: "0 auto", padding: "60px 16px" }}>
        <SectionTitle icon={ShoppingCart}>Comprar productos</SectionTitle>
        <p style={{ fontSize: 13, color: "#555", textAlign: "center" }}>Ingresá tu código de reserva para comprar productos del evento.</p>
        <div style={{ display: "flex", gap: 8 }}>
          <input placeholder="Código de reserva" value={codigo} onChange={(e) => setCodigo(e.target.value)} style={{ ...inputStyle, flex: 1, width: "auto" }} />
          <button onClick={buscar} style={btnGold}>Buscar</button>
        </div>
        {error && <p style={{ fontSize: 12, color: "#a33", marginTop: 8, textAlign: "center" }}>{error}</p>}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "36px 16px 100px" }}>
      <SectionTitle icon={ShoppingCart}>Comprar productos</SectionTitle>
      <div style={{ background: "#fff", border: `2px solid ${C.doradoClaro}`, borderRadius: 10, padding: 14, marginBottom: 20, textAlign: "center" }}>
        <p style={{ fontSize: 13, margin: 0 }}>{reserva.nombre} · reserva {reserva.id}</p>
        <p style={{ fontSize: 14, fontWeight: 800, color: C.rojoOsc, margin: "4px 0 0" }}>Saldo disponible: {CURRENCY(saldoDisponible)}</p>
      </div>

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
            <div style={{ fontSize: 12, color: "#777" }}>{itemsSeleccionados.length} ítem(s) · Total {CURRENCY(totalProductos)}</div>
            {saldoAplicado > 0 && <div style={{ fontSize: 12, color: C.verde }}>Saldo aplicado: {CURRENCY(saldoAplicado)}</div>}
            <div style={{ fontFamily: "'Alfa Slab One', serif", fontSize: 22, color: C.rojoOsc }}>{montoAPagar > 0 ? `A pagar: ${CURRENCY(montoAPagar)}` : "Cubierto por tu saldo"}</div>
          </div>
          <button onClick={confirmarCompra} disabled={itemsSeleccionados.length === 0 || confirmando} style={{ ...btnGold, opacity: itemsSeleccionados.length === 0 || confirmando ? 0.5 : 1 }}>
            {confirmando ? "Confirmando…" : "Confirmar compra"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- MI RESERVA ---------------------------------- */
function MiReserva({ reservas, compras }) {
  const [code, setCode] = useState("");
  const found = reservas.find((r) => r.id === code.trim().toUpperCase());
  const misCompras = found ? compras.filter((c) => c.reservaId === found.id) : [];
  const saldoDisponible = found ? Math.max(0, (found.saldoConsumible || 0) - (found.saldoUsado || 0)) : 0;
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
          <div style={{ fontSize: 12, color: "#777", marginBottom: 10 }}>Código {found.id} · {found.personasTotal || 1} persona(s)</div>
          <div style={{ fontWeight: 800, marginTop: 6 }}>Total: {CURRENCY(found.total)}</div>
          <div style={{ display: "flex", gap: 14, marginTop: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <Estado ok label="Reservado" />
            <Estado ok={found.pagado} label="Pagado" />
          </div>
          {found.pagado && (
            <p style={{ fontSize: 13, fontWeight: 700, color: C.rojoOsc, marginBottom: 14 }}>Saldo disponible para productos: {CURRENCY(saldoDisponible)}</p>
          )}
          {misCompras.length > 0 && (
            <>
              <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Tus compras de productos:</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {misCompras.map((c) => (
                  <div key={c.id} style={{ background: C.crema, borderRadius: 8, padding: "8px 10px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace" }}>{c.id}</div>
                      <Estado ok={c.entregado} label={c.entregado ? "Entregado" : "Pendiente"} />
                    </div>
                    <div style={{ fontSize: 12, color: "#666" }}>{c.items.map((i) => `${i.cantidad}× ${i.nombre}`).join(", ")}</div>
                  </div>
                ))}
              </div>
            </>
          )}
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

      <div style={{ background: `linear-gradient(160deg, ${C.rojo}, ${C.rojoOsc})`, border: `2px solid ${C.dorado}`, borderRadius: 14, padding: "22px 20px", marginBottom: 30 }}>
        <div style={{ textAlign: "center", fontFamily: "'Alfa Slab One', serif", color: C.doradoClaro, fontSize: 18, marginBottom: 10 }}>
          ¿Qué es una peña?
        </div>
        <p style={{ fontSize: 14, lineHeight: 1.8, color: C.crema, textAlign: "center", margin: 0 }}>
          ¿Alguna vez te preguntaste qué es una peña, che? En Argentina no es una fiesta cualquiera: es la excusa perfecta
          para juntar amigos alrededor de un buen asado, con la guitarra sonando, el mate circulando de mano en mano y el
          folklore de fondo marcando el ritmo de la noche. Es esa mezcla única de música, comida y calidez humana que
          corre por las venas de todo argentino — el arte de convertir una mesa larga y un fueguito en una fiesta que se
          recuerda para toda la vida. ¡Preparate el apetito y las ganas de compartir, que esto recién empieza!
        </p>
      </div>

      <div style={{ textAlign: "center", fontFamily: "'Alfa Slab One', serif", color: C.rojoOsc, fontSize: 18, marginBottom: 10 }}>
        Nuestra historia
      </div>
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
function Folclore({ config }) {
  return (
    <div style={{ background: C.rojoMasOsc, padding: "40px 0 60px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 16px" }}>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, color: C.doradoClaro, fontFamily: "'Alfa Slab One', serif", fontSize: "clamp(22px,4vw,32px)" }}>
            <Music2 size={24} /> Folklore Argentino
          </div>
          <div style={{ width: 90, height: 3, background: C.dorado, margin: "10px auto 0" }} />
          <p style={{ color: C.crema, fontSize: 13, opacity: 0.85, maxWidth: 560, margin: "14px auto 0" }}>
            Para que nuestros hermanos colombianos se metan de lleno en el folklore argentino antes de la peña.
          </p>
        </div>
      </div>

      {config?.folklorePlaylistId ? (
        <div style={{ maxWidth: 700, margin: "0 auto 30px", padding: "0 16px" }}>
          <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", borderRadius: 12, overflow: "hidden", border: `3px solid ${C.dorado}`, boxShadow: "0 8px 20px rgba(0,0,0,.35)" }}>
            <iframe
              width="100%" height="100%"
              src={`https://www.youtube-nocookie.com/embed/videoseries?list=${config.folklorePlaylistId}`}
              title="Playlist de folklore argentino"
              style={{ border: "none", display: "block", position: "absolute", inset: 0 }}
              allow="autoplay; encrypted-media"
              allowFullScreen
            />
          </div>
        </div>
      ) : (
        <p style={{ textAlign: "center", color: C.doradoClaro, fontSize: 13, marginBottom: 30 }}>
          Todavía no se cargó una lista de reproducción — se agrega desde el panel de Caja.
        </p>
      )}

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
function AdminPanel({ reservas, persistReservas, compras, persistCompras, gallery, persistGallery, nosotros, persistNosotros, config, persistConfig }) {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [nuevaImg, setNuevaImg] = useState({ url: "", caption: "" });
  const [historiaEdit, setHistoriaEdit] = useState(nosotros.historia);
  const [cfgEdit, setCfgEdit] = useState(config);

  const ADMIN_PIN = config.adminPin || ADMIN_PIN_DEFAULT;

  if (!unlocked) {
    return (
      <div style={{ maxWidth: 380, margin: "0 auto", padding: "60px 16px" }}>
        <SectionTitle icon={Lock}>Acceso de administración</SectionTitle>
        <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="PIN de admin" style={{ ...inputStyle, width: "100%", textAlign: "center" }} />
        <button onClick={() => setUnlocked(pin === ADMIN_PIN)} style={{ ...btnGold, width: "100%", marginTop: 10 }}>
          <Unlock size={14} style={{ marginRight: 6, verticalAlign: -2 }} /> Ingresar
        </button>
        {pin && pin !== ADMIN_PIN && <p style={{ fontSize: 12, color: "#a33", marginTop: 8, textAlign: "center" }}>PIN incorrecto</p>}
      </div>
    );
  }

  const toggleReserva = (id, campo) => {
    const next = reservas.map((r) => (r.id === id ? { ...r, [campo]: !r[campo] } : r));
    persistReservas(next);
    if (campo === "pagado") {
      const r = next.find((x) => x.id === id);
      if (r && r.pagado && r.email) {
        const personas = `${r.personasTotal || 1} persona${(r.personasTotal || 1) === 1 ? "" : "s"}`;
        const primerNombre = r.nombre.split(" ")[0];
        enviarEmail(config, {
          to_email: r.email,
          to_name: r.nombre,
          subject: "¡Confirmadísima tu reserva! — La Gran Peña Los 4 de Copas 🇦🇷",
          message: `¡Aguante, ${primerNombre}! 🔥🇦🇷

Tu lugar en La Gran Peña Los 4 de Copas quedó CONFIRMADO — ya podés ir guardando apetito, porque se viene una junta como Dios manda.

🎟️ Código: ${r.id}
👥 ${personas}
💰 Saldo consumible: ${CURRENCY(r.total)} para gastar en productos el día del evento

Te esperamos con el asado a punto, la carne jugosa cayendo de la parrilla, el fernet bien cargado y un río de anécdotas para contar por años. Folklore de fondo, buena gente alrededor y esa previa que ya sabemos cómo termina: entre amigos, sin mirar el reloj.

Guardá bien tu código — lo vas a necesitar el día del evento para comprar tus productos con el saldo. ¡Nos vemos en la peña, que esta viene brava! 🥩🍷🎸`,
        });
      }
    }
  };

  const inventario = {};
  compras.forEach((c) => c.items.forEach((it) => {
    if (!inventario[it.nombre]) inventario[it.nombre] = { comprado: 0, pagado: 0, entregado: 0 };
    inventario[it.nombre].comprado += it.cantidad;
    if (c.pagado) inventario[it.nombre].pagado += it.cantidad;
    if (c.entregado) inventario[it.nombre].entregado += it.cantidad;
  }));

  const filtradas = reservas.filter((r) => (r.nombre + r.id).toLowerCase().includes(busqueda.toLowerCase()));
  const recaudadoReservas = reservas.filter((r) => r.pagado).reduce((s, r) => s + r.total, 0);
  const recaudadoCompras = compras.filter((c) => c.pagado).reduce((s, c) => s + c.montoAPagar, 0);

  const exportarCSV = () => {
    const rows = [["Código", "Nombre", "Teléfono", "Correo", "Personas", "Total", "Pagado"]];
    reservas.forEach((r) => rows.push([r.id, r.nombre, r.telefono, r.email, r.personasTotal, r.total, r.pagado ? "SI" : "NO"]));
    rows.push([]);
    rows.push(["Compras", "Reserva", "Items", "Total", "A pagar", "Pagado", "Entregado"]);
    compras.forEach((c) => rows.push([
      c.id, c.reservaId, c.items.map((i) => `${i.cantidad}x ${i.nombre}`).join(" | "),
      c.total, c.montoAPagar, c.pagado ? "SI" : "NO", c.entregado ? "SI" : "NO",
    ]));
    const csv = rows.map((row) => row.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "pena_4_de_copas_respaldo.csv";
    a.click();
  };

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "30px 16px 80px" }}>
      <SectionTitle icon={ShoppingCart}>Panel de administración</SectionTitle>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, marginBottom: 24 }}>
        <Stat label="Reservas" value={reservas.length} />
        <Stat label="Pagadas" value={reservas.filter((r) => r.pagado).length} />
        <Stat label="Compras entregadas" value={compras.filter((c) => c.entregado).length} />
        <Stat label="Recaudado" value={CURRENCY(recaudadoReservas + recaudadoCompras)} />
      </div>

      <div style={{ background: C.rojoMasOsc, borderRadius: 12, padding: 16, marginBottom: 26 }}>
        <div style={{ color: C.doradoClaro, fontFamily: "'Alfa Slab One', serif", fontSize: 15, marginBottom: 10 }}>Configuración general</div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, color: C.crema, fontSize: 13, marginBottom: 12 }}>
          <input type="checkbox" checked={cfgEdit.comprasHabilitadas !== false} onChange={(e) => { const next = { ...cfgEdit, comprasHabilitadas: e.target.checked }; setCfgEdit(next); persistConfig(next); }} />
          Compra de productos habilitada
        </label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input value={cfgEdit.adminPin || ""} onChange={(e) => setCfgEdit({ ...cfgEdit, adminPin: e.target.value })} style={inputStyle} placeholder="PIN de admin" />
          <input value={cfgEdit.staffPin || ""} onChange={(e) => setCfgEdit({ ...cfgEdit, staffPin: e.target.value })} style={inputStyle} placeholder="PIN de staff" />
          <button onClick={() => persistConfig(cfgEdit)} style={btnGold}><Save size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Guardar</button>
        </div>
      </div>

      <div style={{ fontFamily: "'Alfa Slab One', serif", color: C.rojoOsc, fontSize: 15, marginBottom: 8 }}>Inventario de productos (compras del día del evento)</div>
      <div style={{ overflowX: "auto", marginBottom: 26 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr style={{ background: C.crema }}>
            {["Producto", "Comprado", "Pagado", "Entregado"].map((h) => <th key={h} style={thStyle}>{h}</th>)}
          </tr></thead>
          <tbody>
            {Object.entries(inventario).map(([nombre, v]) => (
              <tr key={nombre}><td style={tdStyle}>{nombre}</td><td style={tdStyle}>{v.comprado}</td><td style={tdStyle}>{v.pagado}</td><td style={tdStyle}>{v.entregado}</td></tr>
            ))}
            {Object.keys(inventario).length === 0 && <tr><td style={tdStyle} colSpan={4}>Todavía no hay compras de productos.</td></tr>}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <input placeholder="Buscar por nombre o código" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 180 }} />
        <button onClick={exportarCSV} style={btnOutlineRojo}><Download size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Exportar respaldo</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 30 }}>
        {filtradas.map((r) => {
          const misCompras = compras.filter((c) => c.reservaId === r.id);
          const pendienteVerificar = r.pagoReportado && !r.pagado;
          return (
            <div key={r.id} style={{ background: pendienteVerificar ? "#fffbe8" : "#fff", border: `1.5px solid ${pendienteVerificar ? "#e0b400" : C.doradoClaro}`, borderRadius: 10, padding: 12, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 13 }}>{r.nombre} <span style={{ color: "#999", fontWeight: 500 }}>· {r.id}</span></div>
                <div style={{ fontSize: 12, color: "#666" }}>{r.personasTotal || 1} persona(s) · {CURRENCY(r.total)}{misCompras.length > 0 && ` · ${misCompras.length} compra(s) de productos`}</div>
                {pendienteVerificar && (
                  <div style={{ fontSize: 11, color: "#b8860b", marginTop: 4 }}>
                    ⏳ Reportó transferencia · ref. <b>{r.referenciaPago}</b>
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <button onClick={() => toggleReserva(r.id, "pagado")} style={pillBtn(r.pagado)}>Pagado</button>
                {r.telefono && (
                  <a href={linkWhatsApp(r)} target="_blank" rel="noopener noreferrer" title="Enviar confirmación por WhatsApp"
                    style={{ background: "#25D366", color: "#fff", border: "none", borderRadius: 20, padding: "6px 10px", display: "flex", alignItems: "center", textDecoration: "none" }}>
                    <Phone size={14} />
                  </a>
                )}
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

      <div style={{ fontFamily: "'Alfa Slab One', serif", color: C.rojoOsc, fontSize: 15, marginBottom: 8 }}>Playlist de folklore (YouTube)</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 26 }}>
        <input
          value={cfgEdit.folklorePlaylistId || ""}
          onChange={(e) => setCfgEdit({ ...cfgEdit, folklorePlaylistId: extraerPlaylistId(e.target.value) })}
          style={{ ...inputStyle, flex: 1, minWidth: 220 }}
          placeholder="Pegá el link de la playlist de YouTube o YouTube Music"
        />
        <button onClick={() => persistConfig(cfgEdit)} style={btnOutlineRojo}><Save size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Guardar</button>
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

      <div style={{ fontFamily: "'Alfa Slab One', serif", color: C.rojoOsc, fontSize: 15, marginBottom: 8 }}>Llave Bre-B (pago manual, cualquier banco)</div>
      <p style={{ fontSize: 12, color: "#777", marginBottom: 8 }}>
        La llave se crea gratis desde la app de tu banco (Bancolombia, Nequi, etc.) — sección Bre-B. Puede ser tu celular, NIT o una llave alfanumérica.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 26 }}>
        <input value={cfgEdit.llaveBreB || ""} onChange={(e) => setCfgEdit({ ...cfgEdit, llaveBreB: e.target.value })} style={inputStyle} placeholder="Llave Bre-B" />
        <input value={cfgEdit.llaveTitular || ""} onChange={(e) => setCfgEdit({ ...cfgEdit, llaveTitular: e.target.value })} style={inputStyle} placeholder="Titular" />
        <button onClick={() => persistConfig(cfgEdit)} style={btnOutlineRojo}><Save size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Guardar</button>
      </div>

      <div style={{ fontFamily: "'Alfa Slab One', serif", color: C.rojoOsc, fontSize: 15, marginBottom: 8 }}>Avisos por correo (EmailJS)</div>
      <p style={{ fontSize: 12, color: "#777", marginBottom: 8 }}>
        Se manda un correo al staff cuando alguien reporta una transferencia, y al cliente cuando reporta el pago y cuando se confirma. Creá una cuenta gratis en emailjs.com, conectá tu correo, armá una plantilla con las variables to_email, to_name, subject y message, y pegá acá los 3 códigos.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <input value={cfgEdit.staffEmail || ""} onChange={(e) => setCfgEdit({ ...cfgEdit, staffEmail: e.target.value })} style={inputStyle} placeholder="Correo del staff (recibe avisos de pago)" />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 26 }}>
        <input value={cfgEdit.emailjsServiceId || ""} onChange={(e) => setCfgEdit({ ...cfgEdit, emailjsServiceId: e.target.value })} style={inputStyle} placeholder="Service ID" />
        <input value={cfgEdit.emailjsTemplateId || ""} onChange={(e) => setCfgEdit({ ...cfgEdit, emailjsTemplateId: e.target.value })} style={inputStyle} placeholder="Template ID" />
        <input value={cfgEdit.emailjsPublicKey || ""} onChange={(e) => setCfgEdit({ ...cfgEdit, emailjsPublicKey: e.target.value })} style={inputStyle} placeholder="Public Key" />
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

/* ---------------------------------- ESCÁNER QR (cámara) ---------------------------------- */
function QrScanner({ onResult }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [activo, setActivo] = useState(false);
  const [errorCam, setErrorCam] = useState("");

  useEffect(() => {
    if (!activo) return;
    let raf; let stream;
    let cancelado = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (cancelado) { stream.getTracks().forEach((t) => t.stop()); return; }
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const tick = () => {
          if (cancelado) return;
          const v = videoRef.current;
          if (v && v.readyState === v.HAVE_ENOUGH_DATA) {
            const canvas = canvasRef.current;
            canvas.width = v.videoWidth; canvas.height = v.videoHeight;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            if (code && code.data) { onResult(code.data); setActivo(false); return; }
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch {
        setErrorCam("No se pudo acceder a la cámara. Revisá los permisos del navegador, o usá el código manual abajo.");
      }
    })();
    return () => {
      cancelado = true;
      if (raf) cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [activo]);

  return (
    <div style={{ marginBottom: 14 }}>
      {!activo && <button onClick={() => { setErrorCam(""); setActivo(true); }} style={{ ...btnGold, width: "100%" }}>📷 Escanear QR con la cámara</button>}
      {activo && (
        <div style={{ position: "relative" }}>
          <video ref={videoRef} playsInline muted style={{ width: "100%", borderRadius: 10, background: "#000" }} />
          <button onClick={() => setActivo(false)} style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,.6)", border: "none", borderRadius: "50%", width: 30, height: 30, color: "#fff", cursor: "pointer" }}>
            <X size={16} />
          </button>
        </div>
      )}
      <canvas ref={canvasRef} style={{ display: "none" }} />
      {errorCam && <p style={{ color: "#a33", fontSize: 12, marginTop: 6 }}>{errorCam}</p>}
    </div>
  );
}

/* ---------------------------------- PANEL DE STAFF ---------------------------------- */
function StaffPanel({ compras, persistCompras, config }) {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [codigo, setCodigo] = useState("");
  const [resultado, setResultado] = useState(null);

  const STAFF_PIN = config.staffPin || STAFF_PIN_DEFAULT;

  if (!unlocked) {
    return (
      <div style={{ maxWidth: 380, margin: "0 auto", padding: "60px 16px" }}>
        <SectionTitle icon={Lock}>Acceso de staff</SectionTitle>
        <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="PIN de staff" style={{ ...inputStyle, width: "100%", textAlign: "center" }} />
        <button onClick={() => setUnlocked(pin === STAFF_PIN)} style={{ ...btnGold, width: "100%", marginTop: 10 }}>
          <Unlock size={14} style={{ marginRight: 6, verticalAlign: -2 }} /> Ingresar
        </button>
        {pin && pin !== STAFF_PIN && <p style={{ fontSize: 12, color: "#a33", marginTop: 8, textAlign: "center" }}>PIN incorrecto</p>}
      </div>
    );
  }

  const buscar = (codeOverride) => {
    const code = (codeOverride ?? codigo).trim().toUpperCase();
    const c = compras.find((x) => x.id === code);
    if (!c) { setResultado({ tipo: "no-encontrado" }); return; }
    setResultado({ tipo: "encontrada", compra: c });
  };

  const marcar = async (campo) => {
    if (!resultado?.compra) return;
    const id = resultado.compra.id;
    const next = compras.map((c) => (c.id === id ? { ...c, [campo]: true, ...(campo === "entregado" ? { entregadoEn: new Date().toISOString() } : {}) } : c));
    await persistCompras(next);
    setResultado({ tipo: "encontrada", compra: next.find((c) => c.id === id) });
  };

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "30px 16px 80px" }}>
      <SectionTitle icon={Ticket}>Panel de staff</SectionTitle>

      <QrScanner onResult={(data) => { setCodigo(data); buscar(data); }} />

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={codigo}
          onChange={(e) => { setCodigo(e.target.value); setResultado(null); }}
          onKeyDown={(e) => e.key === "Enter" && buscar()}
          placeholder="Código del pedido"
          style={{ ...inputStyle, flex: 1, textTransform: "uppercase" }}
        />
        <button onClick={() => buscar()} style={btnGold}>Buscar</button>
      </div>

      {resultado?.tipo === "no-encontrado" && <p style={{ color: "#a33", fontSize: 13, marginTop: 12 }}>No encontramos ese código.</p>}

      {resultado?.tipo === "encontrada" && (
        <div style={{ background: "#fff", border: `2px solid ${C.doradoClaro}`, borderRadius: 12, padding: 16, marginTop: 16 }}>
          <div style={{ fontWeight: 800 }}>{resultado.compra.nombre}</div>
          <div style={{ fontSize: 12, color: "#777", marginBottom: 10 }}>Reserva {resultado.compra.reservaId} · Pedido {resultado.compra.id}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
            {resultado.compra.items.map((it) => (
              <div key={it.key} style={{ fontSize: 13 }}>{it.cantidad}× {it.nombre}</div>
            ))}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
            Total: {CURRENCY(resultado.compra.total)}{resultado.compra.montoAPagar > 0 && ` · a transferir ${CURRENCY(resultado.compra.montoAPagar)}`}
          </div>
          <div style={{ display: "flex", gap: 14, marginBottom: 14, flexWrap: "wrap" }}>
            <Estado ok={resultado.compra.pagado} label="Pagado" />
            <Estado ok={resultado.compra.entregado} label="Entregado" />
          </div>
          {!resultado.compra.pagado && (
            <button onClick={() => marcar("pagado")} style={{ ...btnOutlineRojo, width: "100%", marginBottom: 8 }}>Marcar pagado</button>
          )}
          {resultado.compra.entregado ? (
            <p style={{ fontSize: 12, color: "#a33", textAlign: "center" }}>⚠ Ya fue entregado el {new Date(resultado.compra.entregadoEn).toLocaleString("es-CO")}</p>
          ) : (
            <button onClick={() => marcar("entregado")} disabled={!resultado.compra.pagado} style={{ ...btnGold, width: "100%", opacity: resultado.compra.pagado ? 1 : 0.5 }}>
              Marcar entregado
            </button>
          )}
        </div>
      )}
    </div>
  );
}
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
function Footer({ setTab }) {
  return (
    <footer style={{ background: C.negro, color: C.crema, padding: "26px 16px", textAlign: "center", fontSize: 12 }}>
      <div style={{ display: "flex", gap: 18, justifyContent: "center", marginBottom: 10, flexWrap: "wrap" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><MapPin size={14} /> Ubicación a confirmar</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Phone size={14} /> WhatsApp por reservas</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Instagram size={14} /> @los4decopas</span>
      </div>
      <div style={{ opacity: 0.6 }}>La Gran Peña Los 4 de Copas — hecho con fileteado porteño y orgullo argentino</div>
      <div style={{ marginTop: 10, opacity: 0.35, fontSize: 10 }}>
        <button onClick={() => setTab("admin")} style={{ background: "none", border: "none", color: C.crema, cursor: "pointer", fontSize: 10, padding: 4 }}>admin</button>
        {" · "}
        <button onClick={() => setTab("staff")} style={{ background: "none", border: "none", color: C.crema, cursor: "pointer", fontSize: 10, padding: 4 }}>staff</button>
      </div>
    </footer>
  );
}
