const STORAGE_KEY = "pedidos_entregas_retiros_v17";

function obtenerFechaHoyISO() {
  const d = new Date();
  const año = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${año}-${mes}-${dia}`;
}

const pedidosIniciales = [
  {
    id: "demo-1",
    tipo: "Entrega",
    cliente: "Milagros zapas",
    whatsapp: "",
    facebookId: "",
    lugar: "Morón",
    fecha: obtenerFechaHoyISO(),
    horario: "14hs",
    repartidor: "Persona 1",
    tamano: "1 paq M",
    notas: "",
    pendiente: true
  },
  {
    id: "demo-2",
    tipo: "Entrega",
    cliente: "Anto vallejo",
    whatsapp: "1155667788",
    facebookId: "antovallejo.ok",
    lugar: "Morón",
    fecha: obtenerFechaHoyISO(),
    horario: "14hs",
    repartidor: "Persona 1",
    tamano: "1 paq S",
    notas: "",
    pendiente: true
  },
  {
    id: "demo-3",
    tipo: "Entrega",
    cliente: "Alaska showroom",
    whatsapp: "",
    facebookId: "",
    lugar: "Paracone",
    fecha: obtenerFechaHoyISO(),
    horario: "14hs",
    repartidor: "Persona 2",
    tamano: "2 paq M",
    notas: "",
    pendiente: true
  }
];

let pedidos = cargarPedidos();

function cargarPedidos() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pedidosIniciales));
      return [...pedidosIniciales];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [...pedidosIniciales];
  } catch (e) {
    return [...pedidosIniciales];
  }
}

function guardarPedidosEnStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pedidos));
}

function normalizarFacebookId(valor) {
  return (valor || "").trim().replace(/^@+/, "");
}

// Autocompletar datos de cliente si ya existe en pedidos anteriores
function actualizarSugerenciasClientes() {
  const datalist = document.getElementById("sugerenciasClientes");
  if (!datalist) return;
  datalist.innerHTML = "";
  const unicos = new Map();
  pedidos.forEach((p) => {
    if (p.cliente && !unicos.has(p.cliente.toLowerCase())) {
      unicos.set(p.cliente.toLowerCase(), p);
    }
  });
  unicos.forEach((p) => {
    const option = document.createElement("option");
    option.value = p.cliente;
    datalist.appendChild(option);
  });
}

function autocompletarContactoCliente(nombreInputId, whatsappInputId, fbInputId) {
  const nombre = document.getElementById(nombreInputId).value.trim().toLowerCase();
  if (!nombre) return;
  const existente = pedidos.find((p) => p.cliente && p.cliente.toLowerCase() === nombre);
  if (existente) {
    const waEl = document.getElementById(whatsappInputId);
    const fbEl = document.getElementById(fbInputId);
    if (waEl && !waEl.value.trim() && existente.whatsapp) {
      waEl.value = existente.whatsapp;
    }
    if (fbEl && !fbEl.value.trim() && existente.facebookId) {
      fbEl.value = existente.facebookId;
    }
  }
}

// Genera opciones de horarios cada 30 minutos (00:00 a 23:30)
function poblarSelectoresHorarios() {
  const selectDesde = document.getElementById("fbHoraDesde");
  const selectHasta = document.getElementById("fbHoraHasta");
  selectDesde.innerHTML = "";
  selectHasta.innerHTML = "";

  for (let totalMin = 0; totalMin < 24 * 60; totalMin += 30) {
    const h24 = Math.floor(totalMin / 60);
    const min = totalMin % 60;
    const hhmm = `${String(h24).padStart(2, "0")}:${String(min).padStart(2, "0")}`;

    const periodo = h24 >= 12 ? "p.m." : "a.m.";
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    const etiqueta = `${h12}:${String(min).padStart(2, "0")} ${periodo}`;

    const optDesde = document.createElement("option");
    optDesde.value = hhmm;
    optDesde.textContent = etiqueta;

    const optHasta = document.createElement("option");
    optHasta.value = hhmm;
    optHasta.textContent = etiqueta;

    selectDesde.appendChild(optDesde);
    selectHasta.appendChild(optHasta);
  }
}

// Redondea la hora actual hacia arriba al próximo bloque de 30 min
// Ejemplo: 12:34 -> Desde 13:00, Hasta 15:00
function configurarHorariosSugeridos() {
  const ahora = new Date();
  let horas = ahora.getHours();
  let minutos = ahora.getMinutes();

  if (minutos > 30) {
    horas += 1;
    minutos = 0;
  } else if (minutos > 0) {
    minutos = 30;
  }

  const inicioTotalMin = ((horas * 60 + minutos) + (24 * 60)) % (24 * 60);
  const finTotalMin = (inicioTotalMin + 120) % (24 * 60); // +2 horas por defecto

  const formatoHHMM = (totalMin) => {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  document.getElementById("fbHoraDesde").value = formatoHHMM(inicioTotalMin);
  document.getElementById("fbHoraHasta").value = formatoHHMM(finTotalMin);
}

function formatearEtiquetaHora(hhmm) {
  if (!hhmm || !hhmm.includes(":")) return hhmm || "";
  const [hStr, mStr] = hhmm.split(":");
  const h24 = parseInt(hStr, 10);
  const min = parseInt(mStr, 10);
  const periodo = h24 >= 12 ? "p.m." : "a.m.";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(min).padStart(2, "0")} ${periodo}`;
}

function parsearHoraPedidoAMinutos(horarioTexto) {
  if (!horarioTexto) return null;
  const limpio = horarioTexto.toLowerCase().trim();
  const match = limpio.match(/(\d{1,2})(?::(\d{2}))?/);
  if (!match) return null;
  let horas = parseInt(match[1], 10);
  const minutos = match[2] ? parseInt(match[2], 10) : 0;
  if (limpio.includes("pm") || limpio.includes("p.m") || (horas >= 1 && horas <= 7 && limpio.includes("hs"))) {
    if (horas < 12) horas += 12;
  }
  return horas * 60 + minutos;
}

function hhmmAMinutos(hhmm) {
  if (!hhmm || !hhmm.includes(":")) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function obtenerMencionFacebook(pedido) {
  if (pedido.facebookId) {
    return `@${normalizarFacebookId(pedido.facebookId)}`;
  }
  return `@${pedido.cliente}`;
}

function renderizarPedidosGuardados() {
  const contenedor = document.getElementById("listaPedidosGuardados");
  contenedor.innerHTML = "";

  if (pedidos.length === 0) {
    contenedor.innerHTML = `<p style="color: var(--text-muted); font-size: 0.88rem;">Todavía no hay retiros ni entregas cargados.</p>`;
    return;
  }

  pedidos.forEach((pedido) => {
    const card = document.createElement("div");
    card.className = "order-card";

    const badgeClase = pedido.tipo === "Retiro" ? "type-retiro" : "type-entrega";
    const contactoPartes = [];
    if (pedido.whatsapp) contactoPartes.push(`📱 WA: ${pedido.whatsapp}`);
    if (pedido.facebookId) contactoPartes.push(`📘 FB: @${normalizarFacebookId(pedido.facebookId)}`);

    card.innerHTML = `
      <div class="order-top">
        <strong>${pedido.cliente}</strong>
        <span class="order-type ${badgeClase}">${pedido.tipo}</span>
      </div>
      <div style="font-size: 0.85rem; color: #cbd5e1;">
        📍 ${pedido.lugar || "Sin lugar"} ${pedido.horario ? `• 🕒 ${pedido.horario}` : ""} • 👤 ${pedido.repartidor || "Todo el equipo"}
      </div>
      ${contactoPartes.length > 0 ? `<div style="font-size: 0.8rem; color: #6ee7b7;">${contactoPartes.join("  |  ")}</div>` : `<div style="font-size: 0.78rem; color: var(--text-muted);">Sin WhatsApp ni ID Facebook cargados</div>`}
    `;
    contenedor.appendChild(card);
  });

  actualizarSugerenciasClientes();
}

function actualizarAvisoFacebook() {
  const fechaSeleccionada = document.getElementById("fbFecha").value;
  const repartidorSeleccionado = document.getElementById("fbRepartidor").value;
  const lugarInput = document.getElementById("fbLugarEncuentro").value.trim();
  const horaDesde = document.getElementById("fbHoraDesde").value;
  const horaHasta = document.getElementById("fbHoraHasta").value;
  const filtrarFranja = document.getElementById("fbFiltrarFranja").checked;
  const soloPendientes = document.getElementById("fbSoloPendientes").checked;

  const minDesde = hhmmAMinutos(horaDesde);
  const minHasta = hhmmAMinutos(horaHasta);

  const filtrados = pedidos.filter((p) => {
    if (fechaSeleccionada && p.fecha && p.fecha !== fechaSeleccionada) return false;
    if (repartidorSeleccionado && repartidorSeleccionado !== "Todo el equipo" && p.repartidor !== repartidorSeleccionado) return false;
    if (soloPendientes && p.pendiente === false) return false;

    if (filtrarFranja && minDesde !== null && minHasta !== null) {
      const minPedido = parsearHoraPedidoAMinutos(p.horario);
      if (minPedido !== null) {
        if (minDesde <= minHasta) {
          if (minPedido < minDesde || minPedido > minHasta) return false;
        } else {
          if (minPedido < minDesde && minPedido > minHasta) return false;
        }
      }
    }
    return true;
  });

  document.getElementById("fbContadorPersonas").textContent = filtrados.length;
  const listaPersonas = document.getElementById("fbListaPersonas");
  listaPersonas.innerHTML = "";

  filtrados.forEach((pedido) => {
    const item = document.createElement("div");
    item.className = "detected-item";

    const mencion = obtenerMencionFacebook(pedido);
    const estadoFb = pedido.facebookId
      ? `<span class="fb-loaded-badge">✓ ID FB cargado</span>`
      : `<button type="button" class="chip-btn" data-id="${pedido.id}">+ @FB</button>`;

    item.innerHTML = `
      <div>
        <div><strong>${mencion}</strong> <span style="font-size: 0.75rem; color: #93c5fd;">${pedido.tipo}</span></div>
        <div class="detected-meta">${pedido.horario ? `Horario pedido: ${pedido.horario}` : "Sin horario"} ${pedido.lugar ? `• ${pedido.lugar}` : ""}</div>
      </div>
      ${estadoFb}
    `;

    const btnAddFb = item.querySelector("button[data-id]");
    if (btnAddFb) {
      btnAddFb.addEventListener("click", () => {
        const nuevoId = prompt(`Ingresá el ID o usuario de Facebook para ${pedido.cliente}:`, "");
        if (nuevoId && nuevoId.trim()) {
          pedido.facebookId = normalizarFacebookId(nuevoId);
          guardarPedidosEnStorage();
          renderizarPedidosGuardados();
          actualizarAvisoFacebook();
        }
      });
    }

    listaPersonas.appendChild(item);
  });

  const textoLugar = lugarInput ? ` en ${lugarInput}` : "";
  const textoDesde = formatearEtiquetaHora(horaDesde);
  const textoHasta = formatearEtiquetaHora(horaHasta);
  const etiquetaDia = fechaSeleccionada === obtenerFechaHoyISO() ? "hoy" : `el ${fechaSeleccionada}`;

  const mencionesLineas = filtrados.map((p) => obtenerMencionFacebook(p)).join("\n");
  const textoFinal = `Buenas chicas, las menciono a todas a quienes tengo que entregarles y retirarles los pedidos ${etiquetaDia} de ${textoDesde} hasta las ${textoHasta}${textoLugar}:\n\n${mencionesLineas}`;

  document.getElementById("fbTextoSalida").value = textoFinal;
}

// Eventos de formularios (Retiro y Entrega)
document.getElementById("formRetiro").addEventListener("submit", (e) => {
  e.preventDefault();
  const nuevoRetiro = {
    id: "ret-" + Date.now(),
    tipo: "Retiro",
    cliente: document.getElementById("retiroQuienDespacha").value.trim(),
    whatsapp: document.getElementById("retiroWhatsapp").value.trim(),
    facebookId: normalizarFacebookId(document.getElementById("retiroFacebookId").value),
    lugar: document.getElementById("retiroLugar").value.trim(),
    fecha: document.getElementById("retiroFecha").value || obtenerFechaHoyISO(),
    horario: document.getElementById("retiroHorario").value.trim(),
    repartidor: document.getElementById("retiroRepartidor").value,
    tamano: document.getElementById("retiroTamano").value.trim(),
    notas: document.getElementById("retiroNotas").value.trim(),
    pendiente: true
  };

  pedidos.unshift(nuevoRetiro);
  guardarPedidosEnStorage();
  e.target.reset();
  document.getElementById("retiroFecha").value = obtenerFechaHoyISO();
  renderizarPedidosGuardados();
  actualizarAvisoFacebook();
});

document.getElementById("formEntrega").addEventListener("submit", (e) => {
  e.preventDefault();
  const nuevaEntrega = {
    id: "ent-" + Date.now(),
    tipo: "Entrega",
    cliente: document.getElementById("entregaCliente").value.trim(),
    whatsapp: document.getElementById("entregaWhatsapp").value.trim(),
    facebookId: normalizarFacebookId(document.getElementById("entregaFacebookId").value),
    lugar: document.getElementById("entregaLugar").value.trim(),
    fecha: document.getElementById("entregaFecha").value || obtenerFechaHoyISO(),
    horario: document.getElementById("entregaHorario").value.trim(),
    repartidor: document.getElementById("entregaRepartidor").value,
    tamano: document.getElementById("entregaTamano").value.trim(),
    notas: document.getElementById("entregaNotas").value.trim(),
    pendiente: true
  };

  pedidos.unshift(nuevaEntrega);
  guardarPedidosEnStorage();
  e.target.reset();
  document.getElementById("entregaFecha").value = obtenerFechaHoyISO();
  renderizarPedidosGuardados();
  actualizarAvisoFacebook();
});

// Autocompletar contacto al escribir un cliente conocido
document.getElementById("retiroQuienDespacha").addEventListener("change", () => {
  autocompletarContactoCliente("retiroQuienDespacha", "retiroWhatsapp", "retiroFacebookId");
});

document.getElementById("entregaCliente").addEventListener("change", () => {
  autocompletarContactoCliente("entregaCliente", "entregaWhatsapp", "entregaFacebookId");
});

// Botones de navegación rápida
document.getElementById("btnAbrirRetiro").addEventListener("click", () => {
  document.getElementById("seccionRetiro").classList.remove("hidden");
  document.getElementById("seccionRetiro").scrollIntoView({ behavior: "smooth" });
});

document.getElementById("btnAbrirEntrega").addEventListener("click", () => {
  document.getElementById("seccionEntrega").classList.remove("hidden");
  document.getElementById("seccionEntrega").scrollIntoView({ behavior: "smooth" });
});

document.getElementById("btnAbrirAvisoFb").addEventListener("click", () => {
  document.getElementById("fbLugarEncuentro").value = "";
  configurarHorariosSugeridos();
  actualizarAvisoFacebook();
  document.getElementById("seccionAvisoFb").scrollIntoView({ behavior: "smooth" });
});

document.getElementById("btnToggleRetiro").addEventListener("click", () => {
  document.getElementById("seccionRetiro").classList.toggle("hidden");
});

document.getElementById("btnToggleEntrega").addEventListener("click", () => {
  document.getElementById("seccionEntrega").classList.toggle("hidden");
});

document.getElementById("btnRefrescarHorarios").addEventListener("click", () => {
  configurarHorariosSugeridos();
  actualizarAvisoFacebook();
});

document.getElementById("btnLimpiarLugarFb").addEventListener("click", () => {
  document.getElementById("fbLugarEncuentro").value = "";
  actualizarAvisoFacebook();
});

document.querySelectorAll("#sugerenciasLugar .chip-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.getElementById("fbLugarEncuentro").value = btn.dataset.lugar;
    actualizarAvisoFacebook();
  });
});

document.getElementById("btnCopiarAvisoFb").addEventListener("click", async () => {
  const texto = document.getElementById("fbTextoSalida").value;
  try {
    await navigator.clipboard.writeText(texto);
    alert("Publicación copiada al portapapeles.");
  } catch (e) {
    const area = document.getElementById("fbTextoSalida");
    area.select();
    document.execCommand("copy");
    alert("Publicación copiada.");
  }
});

document.getElementById("btnExportarJson").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(pedidos, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pedidos-v17-${obtenerFechaHoyISO()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

["fbFecha", "fbRepartidor", "fbLugarEncuentro", "fbHoraDesde", "fbHoraHasta", "fbFiltrarFranja", "fbSoloPendientes"].forEach((id) => {
  document.getElementById(id).addEventListener("input", actualizarAvisoFacebook);
  document.getElementById(id).addEventListener("change", actualizarAvisoFacebook);
});

// Inicialización
(function init() {
  const hoy = obtenerFechaHoyISO();
  document.getElementById("retiroFecha").value = hoy;
  document.getElementById("entregaFecha").value = hoy;
  document.getElementById("fbFecha").value = hoy;
  document.getElementById("fbLugarEncuentro").value = "";

  poblarSelectoresHorarios();
  configurarHorariosSugeridos();
  renderizarPedidosGuardados();
  actualizarAvisoFacebook();
})();
