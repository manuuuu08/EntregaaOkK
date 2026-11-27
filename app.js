(() => {
  const STORAGE_KEY = "entregas_retiros_v15_operativa";

  function todayISO() {
    const d = new Date();
    const off = d.getTimezoneOffset();
    const local = new Date(d.getTime() - off * 60000);
    return local.toISOString().slice(0, 10);
  }

  function formatDateAR(iso) {
    if (!iso) return "";
    const parts = iso.split("-");
    if (parts.length !== 3) return iso;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {}
    }
    const initial = {
      clientas: [
        { id: "c-1", nombre: "Tienda Central", whatsapp: "1122334455", zona: "Once" }
      ],
      entregas: [],
      retiros: []
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }

  let state = loadState();

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    updateStats();
    refreshClientasDatalist();
  }

  // Normaliza teléfonos para wa.me (Argentina si empieza con 11 o sin código de país)
  function cleanPhoneForWA(raw) {
    const digits = (raw || "").replace(/\D/g, "");
    if (!digits) return "";
    if (digits.startsWith("54")) return digits;
    if (digits.startsWith("0")) return "549" + digits.slice(1);
    return "549" + digits;
  }

  // Aprende o actualiza automáticamente una clienta cuando se guarda una entrega o retiro
  function learnClienta(nombre, whatsapp, zona = "") {
    const cleanName = (nombre || "").trim();
    const cleanPhone = (whatsapp || "").trim();
    if (!cleanName || !cleanPhone) return;

    const existing = state.clientas.find(
      c => c.nombre.toLowerCase() === cleanName.toLowerCase()
    );
    if (existing) {
      existing.whatsapp = cleanPhone;
      if (zona && !existing.zona) existing.zona = zona.trim();
    } else {
      state.clientas.unshift({
        id: "cli-" + Date.now(),
        nombre: cleanName,
        whatsapp: cleanPhone,
        zona: (zona || "").trim()
      });
    }
  }

  // Autocompletado inteligente de WhatsApp al escribir o elegir clienta (tanto en Entrega como en Retiro)
  function bindClientaAutocomplete(nameInputId, phoneInputId, hintId, zonaInputId = null) {
    const nameEl = document.getElementById(nameInputId);
    const phoneEl = document.getElementById(phoneInputId);
    const hintEl = document.getElementById(hintId);
    const zonaEl = zonaInputId ? document.getElementById(zonaInputId) : null;

    function syncMatch() {
      const val = nameEl.value.trim().toLowerCase();
      if (!val) {
        hintEl.classList.add("hidden");
        return;
      }
      const exact = state.clientas.find(c => c.nombre.toLowerCase() === val);
      const partial = exact || state.clientas.find(c => c.nombre.toLowerCase().startsWith(val));

      if (exact) {
        phoneEl.value = exact.whatsapp;
        if (zonaEl && !zonaEl.value && exact.zona) zonaEl.value = exact.zona;
        hintEl.textContent = `✓ WhatsApp cargado: ${exact.whatsapp}`;
        hintEl.classList.remove("hidden");
      } else if (partial) {
        hintEl.textContent = `Sugerencia: ${partial.nombre} (${partial.whatsapp})`;
        hintEl.classList.remove("hidden");
      } else {
        hintEl.textContent = phoneEl.value.trim()
          ? "Nueva clienta: se guardará su WhatsApp al confirmar"
          : "Nueva clienta: agregá su WhatsApp para guardarla";
        hintEl.classList.remove("hidden");
      }
    }

    nameEl.addEventListener("input", syncMatch);
    nameEl.addEventListener("change", syncMatch);
    phoneEl.addEventListener("input", () => {
      if (nameEl.value.trim() && phoneEl.value.trim()) {
        const exists = state.clientas.some(
          c => c.nombre.toLowerCase() === nameEl.value.trim().toLowerCase()
        );
        if (!exists) {
          hintEl.textContent = "Se aprenderá este número para la próxima vez";
          hintEl.classList.remove("hidden");
        }
      }
    });
  }

  bindClientaAutocomplete("ent-clienta", "ent-whatsapp", "ent-clienta-hint", "ent-zona");
  bindClientaAutocomplete("ret-clienta", "ret-whatsapp", "ret-clienta-hint", "ret-lugar");

  function refreshClientasDatalist() {
    const dl = document.getElementById("datalist-clientas");
    dl.innerHTML = state.clientas
      .map(c => `<option value="${c.nombre}">${c.whatsapp}${c.zona ? " · " + c.zona : ""}</option>`)
      .join("");
  }

  function updateStats() {
    document.getElementById("count-entregas").textContent = state.entregas.length;
    document.getElementById("count-retiros").textContent = state.retiros.length;
    document.getElementById("count-clientas").textContent = state.clientas.length;
  }

  // Navegación de pestañas
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".panel-view").forEach(p => p.classList.add("hidden"));
      btn.classList.add("active");
      document.getElementById("panel-" + btn.dataset.tab).classList.remove("hidden");
    });
  });

  // Apertura y cierre de modales
  document.getElementById("open-entrega-modal").addEventListener("click", () => {
    document.getElementById("ent-fecha").value = todayISO();
    document.getElementById("ent-clienta-hint").classList.add("hidden");
    document.getElementById("modal-entrega").classList.remove("hidden");
  });

  document.getElementById("open-retiro-modal").addEventListener("click", () => {
    document.getElementById("ret-fecha").value = todayISO();
    document.getElementById("ret-clienta-hint").classList.add("hidden");
    resetRetiroNombres([""]);
    document.getElementById("modal-retiro").classList.remove("hidden");
  });

  document.querySelectorAll("[data-close-modal]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.getElementById(btn.dataset.closeModal).classList.add("hidden");
    });
  });

  // Lista dinámica de nombres en Retiros (+ Nombre)
  const nombresContainer = document.getElementById("ret-nombres-container");

  function addNombreInput(value = "") {
    const row = document.createElement("div");
    row.className = "name-chip-row";
    row.innerHTML = `
      <input type="text" class="ret-nombre-item" placeholder="Ej: Jesús" value="${value}" />
      <button type="button" class="btn-remove-name" title="Quitar nombre">✕</button>
    `;
    row.querySelector(".btn-remove-name").addEventListener("click", () => {
      if (nombresContainer.children.length > 1) {
        row.remove();
      } else {
        row.querySelector("input").value = "";
      }
    });
    nombresContainer.appendChild(row);
  }

  function resetRetiroNombres(list = [""]) {
    nombresContainer.innerHTML = "";
    list.forEach(n => addNombreInput(n));
  }

  document.getElementById("btn-add-nombre-retiro").addEventListener("click", () => {
    addNombreInput("");
  });

  // Guardar Entrega
  document.getElementById("form-entrega").addEventListener("submit", (e) => {
    e.preventDefault();
    const clienta = document.getElementById("ent-clienta").value.trim();
    const whatsapp = document.getElementById("ent-whatsapp").value.trim();
    const zona = document.getElementById("ent-zona").value.trim();

    learnClienta(clienta, whatsapp, zona);

    state.entregas.unshift({
      id: "ent-" + Date.now(),
      clienta,
      whatsapp,
      zona,
      origen: document.getElementById("ent-origen").value.trim(),
      monto: Number(document.getElementById("ent-monto").value || 0),
      pago: document.getElementById("ent-pago").value,
      fecha: document.getElementById("ent-fecha").value,
      horario: document.getElementById("ent-horario").value.trim(),
      repartidor: document.getElementById("ent-repartidor").value,
      cantidad: document.getElementById("ent-cantidad").value.trim(),
      notas: document.getElementById("ent-notas").value.trim(),
      estado: "pendiente"
    });

    saveState();
    e.target.reset();
    document.getElementById("modal-entrega").classList.add("hidden");
    renderAll();
  });

  // Guardar Retiro
  document.getElementById("form-retiro").addEventListener("submit", (e) => {
    e.preventDefault();
    const clienta = document.getElementById("ret-clienta").value.trim();
    const whatsapp = document.getElementById("ret-whatsapp").value.trim();
    const lugar = document.getElementById("ret-lugar").value.trim();

    learnClienta(clienta, whatsapp, lugar);

    const nombres = Array.from(document.querySelectorAll(".ret-nombre-item"))
      .map(inp => inp.value.trim())
      .filter(Boolean);

    state.retiros.unshift({
      id: "ret-" + Date.now(),
      clienta,
      whatsapp,
      lugar,
      destino: document.getElementById("ret-destino").value.trim(),
      nombres,
      fecha: document.getElementById("ret-fecha").value,
      horario: document.getElementById("ret-horario").value.trim(),
      persona: document.getElementById("ret-persona").value,
      cantidad: document.getElementById("ret-cantidad").value.trim(),
      notas: document.getElementById("ret-notas").value.trim(),
      estado: "pendiente"
    });

    saveState();
    e.target.reset();
    document.getElementById("modal-retiro").classList.add("hidden");
    renderAll();
  });

  // Generar mensaje de WhatsApp para Entrega
  function openWhatsAppEntrega(item) {
    const lines = [
      `📦 *ENTREGA AGENDADA*`,
      `• *Clienta:* ${item.clienta}`,
      `• *Entrega en:* ${item.zona}`,
      item.origen ? `• *Retira desde:* ${item.origen}` : "",
      `• *Fecha:* ${formatDateAR(item.fecha)}${item.horario ? " (" + item.horario + ")" : ""}`,
      `• *Cantidad:* ${item.cantidad || "1 paq"}`,
      item.monto > 0 ? `• *Cobro:* $${item.monto.toLocaleString("es-AR")} (${item.pago})` : `• *Pago:* ${item.pago}`,
      `• *Repartidor:* ${item.repartidor}`,
      item.notas ? `• *Referencia:* ${item.notas}` : ""
    ].filter(Boolean);

    const text = encodeURIComponent(lines.join("\n"));
    const phone = cleanPhoneForWA(item.whatsapp);
    const url = phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, "_blank");
  }

  // Generar mensaje de WhatsApp para Retiro (con nombres con guion bajo _Nombre)
  function openWhatsAppRetiro(item) {
    const nombresFormateados = (item.nombres && item.nombres.length)
      ? item.nombres.map(n => `• _${n}_`).join("\n")
      : "• _Sin nombres cargados_";

    const lines = [
      `📥 *RETIRO AGENDADO*`,
      `• *Clienta / Despacha:* ${item.clienta}`,
      `• *Retirar en:* ${item.lugar}`,
      `• *Entrega a (Zona):* ${item.destino}`,
      `*Nombres para entregar:*`,
      nombresFormateados,
      `• *Fecha:* ${formatDateAR(item.fecha)}${item.horario ? " (" + item.horario + ")" : ""}`,
      `• *Retira:* ${item.persona} · ${item.cantidad || "1 paq"}`,
      item.notas ? `• *Referencia:* ${item.notas}` : ""
    ].filter(Boolean);

    const text = encodeURIComponent(lines.join("\n"));
    const phone = cleanPhoneForWA(item.whatsapp);
    const url = phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, "_blank");
  }

  // Render de Entregas
  function renderEntregas() {
    const container = document.getElementById("list-entregas");
    const q = document.getElementById("search-input").value.trim().toLowerCase();
    const est = document.getElementById("filter-estado").value;
    const rep = document.getElementById("filter-repartidor").value;

    const filtered = state.entregas.filter(item => {
      if (est !== "todos" && item.estado !== est) return false;
      if (rep !== "todos" && item.repartidor !== rep) return false;
      if (q) {
        const blob = `${item.clienta} ${item.whatsapp} ${item.zona} ${item.origen} ${item.notas}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      container.innerHTML = `<div class="card-dark muted">No hay entregas cargadas con estos filtros. Tocá <strong>+ Agendar Entrega</strong> para empezar.</div>`;
      return;
    }

    container.innerHTML = filtered.map(item => `
      <article class="item-card stack">
        <div class="row space-between">
          <div>
            <strong>${item.clienta}</strong>
            ${item.whatsapp ? `<span class="muted small"> · 📱 ${item.whatsapp}</span>` : ""}
          </div>
          <span class="status-badge st-${item.estado}">${item.estado.replace("_", " ")}</span>
        </div>

        <div class="small">
          📍 <strong>Entrega en:</strong> ${item.zona}
          ${item.origen ? ` · <span class="muted">Desde: ${item.origen}</span>` : ""}
        </div>

        <div class="muted small">
          📅 ${formatDateAR(item.fecha)} ${item.horario ? `(${item.horario})` : ""} · 🚚 ${item.repartidor} · 📦 ${item.cantidad}
          ${item.monto > 0 ? ` · 💵 $${item.monto.toLocaleString("es-AR")} (${item.pago})` : ""}
        </div>

        ${item.notas ? `<div class="small muted">📝 ${item.notas}</div>` : ""}

        <div class="row space-between">
          <div class="row">
            <button type="button" class="btn-whatsapp" data-wa-entrega="${item.id}">📲 Mandar WhatsApp</button>
            <select class="small-btn" style="width:auto" data-st-entrega="${item.id}">
              <option value="pendiente" ${item.estado === "pendiente" ? "selected" : ""}>Pendiente</option>
              <option value="en_camino" ${item.estado === "en_camino" ? "selected" : ""}>En camino</option>
              <option value="completado" ${item.estado === "completado" ? "selected" : ""}>Entregado</option>
              <option value="cancelado" ${item.estado === "cancelado" ? "selected" : ""}>Cancelado</option>
            </select>
          </div>
          <button type="button" class="btn-danger-soft" data-del-entrega="${item.id}">Eliminar</button>
        </div>
      </article>
    `).join("");

    container.querySelectorAll("[data-wa-entrega]").forEach(btn => {
      btn.addEventListener("click", () => {
        const item = state.entregas.find(x => x.id === btn.dataset.waEntrega);
        if (item) openWhatsAppEntrega(item);
      });
    });

    container.querySelectorAll("[data-st-entrega]").forEach(sel => {
      sel.addEventListener("change", () => {
        const item = state.entregas.find(x => x.id === sel.dataset.stEntrega);
        if (item) {
          item.estado = sel.value;
          saveState();
          renderEntregas();
        }
      });
    });

    container.querySelectorAll("[data-del-entrega]").forEach(btn => {
      btn.addEventListener("click", () => {
        if (!confirm("¿Eliminar esta entrega?")) return;
        state.entregas = state.entregas.filter(x => x.id !== btn.dataset.delEntrega);
        saveState();
        renderEntregas();
      });
    });
  }

  // Render de Retiros
  function renderRetiros() {
    const container = document.getElementById("list-retiros");
    const q = document.getElementById("search-input").value.trim().toLowerCase();
    const est = document.getElementById("filter-estado").value;
    const rep = document.getElementById("filter-repartidor").value;

    const filtered = state.retiros.filter(item => {
      if (est !== "todos" && item.estado !== est) return false;
      if (rep !== "todos" && item.persona !== rep) return false;
      if (q) {
        const namesStr = (item.nombres || []).join(" ");
        const blob = `${item.clienta} ${item.whatsapp} ${item.lugar} ${item.destino} ${namesStr} ${item.notas}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      container.innerHTML = `<div class="card-dark muted">No hay retiros cargados con estos filtros. Tocá <strong>+ Agendar Retiro</strong> para empezar.</div>`;
      return;
    }

    container.innerHTML = filtered.map(item => `
      <article class="item-card is-retiro stack">
        <div class="row space-between">
          <div>
            <strong>${item.clienta}</strong>
            ${item.whatsapp ? `<span class="muted small"> · 📱 ${item.whatsapp}</span>` : ""}
          </div>
          <span class="status-badge st-${item.estado}">${item.estado.replace("_", " ")}</span>
        </div>

        <div class="small">
          📥 <strong>Retirar en:</strong> ${item.lugar} → 📍 <strong>Entrega a:</strong> ${item.destino}
        </div>

        ${item.nombres && item.nombres.length ? `
          <div class="names-tags">
            ${item.nombres.map(n => `<span class="name-tag">_${n}</span>`).join("")}
          </div>
        ` : ""}

        <div class="muted small">
          📅 ${formatDateAR(item.fecha)} ${item.horario ? `(${item.horario})` : ""} · 👤 ${item.persona} · 📦 ${item.cantidad}
        </div>

        ${item.notas ? `<div class="small muted">📝 ${item.notas}</div>` : ""}

        <div class="row space-between">
          <div class="row">
            <button type="button" class="btn-whatsapp" data-wa-retiro="${item.id}">📲 Mandar WhatsApp</button>
            <select class="small-btn" style="width:auto" data-st-retiro="${item.id}">
              <option value="pendiente" ${item.estado === "pendiente" ? "selected" : ""}>Pendiente</option>
              <option value="en_camino" ${item.estado === "en_camino" ? "selected" : ""}>En camino</option>
              <option value="completado" ${item.estado === "completado" ? "selected" : ""}>Retirado</option>
              <option value="cancelado" ${item.estado === "cancelado" ? "selected" : ""}>Cancelado</option>
            </select>
          </div>
          <button type="button" class="btn-danger-soft" data-del-retiro="${item.id}">Eliminar</button>
        </div>
      </article>
    `).join("");

    container.querySelectorAll("[data-wa-retiro]").forEach(btn => {
      btn.addEventListener("click", () => {
        const item = state.retiros.find(x => x.id === btn.dataset.waRetiro);
        if (item) openWhatsAppRetiro(item);
      });
    });

    container.querySelectorAll("[data-st-retiro]").forEach(sel => {
      sel.addEventListener("change", () => {
        const item = state.retiros.find(x => x.id === sel.dataset.stRetiro);
        if (item) {
          item.estado = sel.value;
          saveState();
          renderRetiros();
        }
      });
    });

    container.querySelectorAll("[data-del-retiro]").forEach(btn => {
      btn.addEventListener("click", () => {
        if (!confirm("¿Eliminar este retiro?")) return;
        state.retiros = state.retiros.filter(x => x.id !== btn.dataset.delRetiro);
        saveState();
        renderRetiros();
      });
    });
  }

  // Agenda de Clientas WhatsApp
  document.getElementById("form-add-clienta").addEventListener("submit", (e) => {
    e.preventDefault();
    learnClienta(
      document.getElementById("cli-nombre").value,
      document.getElementById("cli-whatsapp").value,
      document.getElementById("cli-zona").value
    );
    saveState();
    e.target.reset();
    renderClientas();
  });

  function renderClientas() {
    const container = document.getElementById("list-clientas");
    if (state.clientas.length === 0) {
      container.innerHTML = `<p class="muted small">Todavía no hay clientas guardadas.</p>`;
      return;
    }
    container.innerHTML = state.clientas.map(c => `
      <div class="item-card row space-between">
        <div>
          <strong>${c.nombre}</strong>
          <div class="muted small">📱 ${c.whatsapp}${c.zona ? ` · 📍 ${c.zona}` : ""}</div>
        </div>
        <div class="row">
          <a class="btn-whatsapp" style="text-decoration:none" target="_blank" href="https://wa.me/${cleanPhoneForWA(c.whatsapp)}">Chat</a>
          <button type="button" class="btn-danger-soft" data-del-cli="${c.id}">Borrar</button>
        </div>
      </div>
    `).join("");

    container.querySelectorAll("[data-del-cli]").forEach(btn => {
      btn.addEventListener("click", () => {
        state.clientas = state.clientas.filter(x => x.id !== btn.dataset.delCli);
        saveState();
        renderClientas();
      });
    });
  }

  // Filtros en tiempo real
  ["search-input", "filter-estado", "filter-repartidor"].forEach(id => {
    document.getElementById(id).addEventListener("input", renderAll);
    document.getElementById(id).addEventListener("change", renderAll);
  });

  // Respaldo JSON
  document.getElementById("btn-export-json").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `respaldo-entregas-retiros-v15-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  function renderAll() {
    updateStats();
    refreshClientasDatalist();
    renderEntregas();
    renderRetiros();
    renderClientas();
  }

  renderAll();
})();
