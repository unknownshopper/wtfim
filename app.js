/* WTFIM — seguimiento de cobros
   Modelo: clientes -> servicios mensuales (concepto + monto c/u)
           y cargos únicos (proyectos / deudas).
   Datos persistidos en localStorage bajo la llave "wtfim-v2". */

const LS_KEY = "wtfim-v2";
const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const PALETTE = ["#6c8cff","#34d399","#fbbf24","#f87171","#c084fc","#22d3ee","#fb923c","#a3e635","#f472b6","#94a3b8"];

/* ---------- Estado ---------- */

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function seedData() {
  const y = currentPeriod().slice(0, 4);
  const clients = [
    { id: "c-pct",       name: "PCT",        color: PALETTE[0], active: true, notes: "" },
    { id: "c-jadersvp",  name: "JADERSVP",   color: PALETTE[1], active: true, notes: "" },
    { id: "c-patanegra", name: "Pata Negra", color: PALETTE[2], active: true, notes: "Paga cada mes" },
    { id: "c-clc",       name: "CLC",        color: PALETTE[3], active: true, notes: "" },
    { id: "c-portofino", name: "Portofino",  color: PALETTE[4], active: true, notes: "" },
  ];
  const services = [
    { id: "s-pct",       clientId: "c-pct",       name: "Iguala",                   amount: 0,     payDay: 10, startPeriod: "2026-10",      active: true },
    { id: "s-jadersvp",  clientId: "c-jadersvp",  name: "Iguala",                   amount: 0,     payDay: 10, startPeriod: currentPeriod(), active: true },
    { id: "s-patanegra", clientId: "c-patanegra", name: "Iguala",                   amount: 0,     payDay: 10, startPeriod: currentPeriod(), active: true },
    { id: "s-clc",       clientId: "c-clc",       name: "Evaluación 16 sucursales", amount: 19800, payDay: 10, startPeriod: "2026-10",      active: true },
    { id: "s-portofino", clientId: "c-portofino", name: "Manejo de redes",          amount: 3000,  payDay: 10, startPeriod: "2026-10",      active: true },
  ];
  const charges = [
    // PCT ya pagó la iguala de oct, nov y dic
    ...["10", "11", "12"].map(m => ({
      id: uid(), clientId: "c-pct", serviceId: "s-pct", kind: "mensualidad",
      period: `${y}-${m}`, concept: `Iguala ${MONTHS[parseInt(m, 10) - 1]} ${y}`,
      amount: 0, status: "pagado", paidDate: `${y}-${m}-05`, notes: "", createdAt: Date.now(),
    })),
    // Portofino debe $10,000 del desarrollo del sitio
    { id: uid(), clientId: "c-portofino", serviceId: null, kind: "cargo",
      period: "2026-10", concept: "Desarrollo sitio web", amount: 10000,
      status: "pendiente", paidDate: "", notes: "", createdAt: Date.now() },
  ];
  return { clients, services, charges };
}

// Migra datos del modelo v1 (iguala única por cliente + payments)
function migrateV1(s) {
  const services = [];
  const svcFor = {};
  s.clients.forEach(c => {
    const sv = { id: uid(), clientId: c.id, name: "Iguala", amount: c.iguala || 0,
                 payDay: c.payDay || 10, startPeriod: null, active: true };
    services.push(sv);
    svcFor[c.id] = sv;
    delete c.iguala; delete c.payDay;
  });
  s.charges = (s.payments || []).map(p => ({
    id: p.id || uid(), clientId: p.clientId,
    serviceId: p.type === "iguala" ? (svcFor[p.clientId]?.id || null) : null,
    kind: p.type === "iguala" ? "mensualidad" : "cargo",
    concept: p.concept || "", period: p.period, amount: p.amount || 0,
    status: p.status === "pagado" ? "pagado" : "pendiente",
    paidDate: p.paidDate || "", notes: p.notes || "", createdAt: p.createdAt || Date.now(),
  }));
  services.forEach(sv => {
    const per = s.charges.filter(c => c.serviceId === sv.id).map(c => c.period).sort();
    sv.startPeriod = per[0] || currentPeriod();
  });
  delete s.payments;
  s.services = services;
  return s;
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && Array.isArray(s.clients) && Array.isArray(s.charges)) return s;
      if (s && Array.isArray(s.clients) && Array.isArray(s.payments)) return migrateV1(s);
    }
  } catch (e) { /* datos corruptos -> resembrar */ }
  // Semilla fresca: savedAt 0 y SIN push remoto, para que la nube siempre la reemplace
  const s = seedData();
  s.savedAt = 0;
  localStorage.setItem(LS_KEY, JSON.stringify(s));
  return s;
}

function save(s = state) {
  s.savedAt = Date.now();
  localStorage.setItem(LS_KEY, JSON.stringify(s));
  queueRemoteSave();
}

let state = load();
let ui = {
  tab: "mensualidades",
  qStart: quarterStart(),
};

/* ---------- Helpers ---------- */

const fmt = n => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n || 0);
const clientById = id => state.clients.find(c => c.id === id);
const monthOf = p => parseInt(p.slice(5, 7), 10);
const yearOf = p => parseInt(p.slice(0, 4), 10);
const periodLabel = p => `${MONTHS[monthOf(p) - 1]} ${yearOf(p)}`;

function effectiveStatus(p) {
  if (p.status === "pendiente" && p.period < currentPeriod()) return "vencido";
  return p.status;
}

const STATUS_LABEL = { pagado: "Pagado", pendiente: "Pendiente", vencido: "Vencido" };
const KIND_LABEL = { mensualidad: "Mensualidad", cargo: "Cargo único" };

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function clientTag(c) {
  return `<span class="client-tag" style="background:${esc(c.color)}">${esc(c.name)}</span>`;
}

const serviceById = id => state.services.find(s => s.id === id);

// 'YYYY-MM' + delta meses
function shiftPeriod(p, delta) {
  let [y, m] = p.split("-").map(Number);
  m += delta;
  while (m > 12) { m -= 12; y++; }
  while (m < 1) { m += 12; y--; }
  return `${y}-${String(m).padStart(2, "0")}`;
}

// Primer mes del trimestre que contiene `p` ('YYYY-MM')
function quarterStart(p = currentPeriod()) {
  const [y, m] = p.split("-").map(Number);
  return `${y}-${String(Math.floor((m - 1) / 3) * 3 + 1).padStart(2, "0")}`;
}

// Etiqueta "Oct–Dic 2026" para el trimestre que inicia en `s`
function quarterLabel(s) {
  return `${MONTHS[monthOf(s) - 1]}–${MONTHS[monthOf(shiftPeriod(s, 2)) - 1]} ${yearOf(s)}`;
}

// Itera periodos 'YYYY-MM' de `from` a `to` inclusive
function eachPeriod(from, to) {
  const out = [];
  let [y, m] = from.split("-").map(Number);
  const [ey, em] = to.split("-").map(Number);
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    if (++m > 12) { m = 1; y++; }
  }
  return out;
}

const mensualidadFor = (serviceId, period) =>
  state.charges.find(c => c.kind === "mensualidad" && c.serviceId === serviceId && c.period === period);

// Monto esperado para `period`: el último cobro registrado del servicio;
// si no hay ninguno, el monto base del servicio.
function expectedAmount(sv, period) {
  const prev = state.charges
    .filter(c => c.serviceId === sv.id && c.kind === "mensualidad" && c.period < period)
    .sort((a, b) => b.period.localeCompare(a.period))[0];
  return prev ? prev.amount : sv.amount;
}

// Mensualidades que "deberían" existir pero aún no se han registrado
function virtualPendings(toPeriod = currentPeriod()) {
  return state.services
    .filter(sv => sv.active && clientById(sv.clientId)?.active)
    .flatMap(sv => eachPeriod(sv.startPeriod, toPeriod)
      .filter(period => !mensualidadFor(sv.id, period))
      .map(period => ({
        id: null, virtual: true, clientId: sv.clientId, serviceId: sv.id,
        kind: "mensualidad", period,
        concept: `${sv.name} ${periodLabel(period)}`,
        amount: expectedAmount(sv, period), status: "pendiente", paidDate: "", notes: "",
      })));
}

/* ---------- Render raíz ---------- */

const view = document.getElementById("view");

function render() {
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === ui.tab));
  if (ui.tab === "clientes") renderClientes();
  else renderMensualidades();
}

/* ---------- Vista: Mensualidades (matriz servicio × mes) ---------- */

function renderMensualidades() {
  const now = currentPeriod();
  const qs = ui.qStart;
  const qEnd = shiftPeriod(qs, 2);
  const cols = [qs, shiftPeriod(qs, 1), qEnd];
  const colIndex = Object.fromEntries(cols.map((p, i) => [p, i]));

  const services = state.services.filter(sv => sv.active && clientById(sv.clientId)?.active);
  const cargosQ = state.charges.filter(p => p.kind === "cargo" && p.period >= qs && p.period <= qEnd)
    .sort((a, b) => a.period.localeCompare(b.period));

  const monthTotals = Array(3).fill(0);
  const monthPend = Array(3).fill(0);

  const rows = services.map(sv => {
    const c = clientById(sv.clientId);
    let rowTotal = 0;
    const cells = cols.map((period, i) => {
      if (period < sv.startPeriod) return `<td class="inactive">·</td>`;
      const ch = mensualidadFor(sv.id, period);
      if (ch) {
        const st = effectiveStatus(ch);
        if (st === "pagado") { monthTotals[i] += ch.amount; rowTotal += ch.amount; }
        else monthPend[i] += ch.amount;
        return `<td class="cell"><span class="matrix-cell ${st} clickable" data-cell="${sv.id}|${period}" title="${STATUS_LABEL[st]} · ${fmt(ch.amount)}">${fmt(ch.amount)}</span></td>`;
      }
      const exp = expectedAmount(sv, period);
      monthPend[i] += exp;
      const cls = period <= now ? "pendiente" : "pendiente futura";
      return `<td class="cell"><span class="matrix-cell ${cls} clickable" data-cell="${sv.id}|${period}" title="Esperada · clic para registrar como pagado">${fmt(exp)}</span></td>`;
    }).join("");
    return `<tr><td class="client-col">${c ? clientTag(c) : ""} <strong>${esc(sv.name)}</strong></td>
      <td class="qarrow"></td>${cells}<td class="qarrow"></td><td class="num"><strong>${fmt(rowTotal)}</strong></td></tr>`;
  }).join("");

  // Tarjetas del trimestre en vista
  const esperado = state.charges.concat(virtualPendings(qEnd));
  const inQ = p => colIndex[p.period] !== undefined;
  const cobradoQ = state.charges.filter(p => inQ(p) && p.status === "pagado").reduce((s, p) => s + p.amount, 0);
  const porCobrarQ = esperado.filter(p => inQ(p) && p.status === "pendiente").reduce((s, p) => s + p.amount, 0);
  const adeudos = esperado.filter(p => p.status === "pendiente" && p.period < qs);
  const adeudosTot = adeudos.reduce((s, p) => s + p.amount, 0);

  // Filas de cargos únicos del trimestre: monto en la columna de su mes
  const cargoRows = cargosQ.map(p => {
    const c = clientById(p.clientId);
    const st = effectiveStatus(p);
    const i = colIndex[p.period];
    if (st === "pagado") monthTotals[i] += p.amount; else monthPend[i] += p.amount;
    const cells = cols.map(period => period !== p.period ? `<td class="inactive">·</td>`
      : `<td class="cell"><span class="matrix-cell ${st} clickable" data-cargo-cell="${p.id}" title="${STATUS_LABEL[st]} · ${fmt(p.amount)}">${fmt(p.amount)}</span></td>`).join("");
    return `<tr><td class="client-col">${c ? clientTag(c) : ""} <strong>${esc(p.concept || "Cargo único")}</strong>
      <div class="muted" style="font-size:11px">cargo único</div></td>
      <td class="qarrow"></td>${cells}<td class="qarrow"></td><td class="num"><strong>${st === "pagado" ? fmt(p.amount) : "$0"}</strong></td></tr>`;
  }).join("");

  view.innerHTML = `
    <div class="toolbar">
      <button class="btn btn-ghost btn-small" id="year-prev">← ${yearOf(qs) - 1}</button>
      <strong>${quarterLabel(qs)}</strong>
      <button class="btn btn-ghost btn-small" id="year-next">${yearOf(qs) + 1} →</button>
      ${qs !== quarterStart() ? `<button class="btn btn-ghost btn-small" id="q-today">Ir a ${quarterLabel(quarterStart())}</button>` : ""}
      <span class="spacer"></span>
      <span class="muted">Clic: pagado ↔ pendiente · <strong>Doble clic:</strong> editar / eliminar</span>
      <button class="btn btn-ghost btn-small" id="btn-new-client">+ Cliente</button>
      <button class="btn btn-primary btn-small" id="btn-new">+ Cobro</button>
    </div>
    <div class="cards">
      <div class="card green"><div class="label">Cobrado · ${quarterLabel(qs)}</div><div class="value">${fmt(cobradoQ)}</div></div>
      <div class="card amber"><div class="label">Por cobrar · ${quarterLabel(qs)}</div><div class="value">${fmt(porCobrarQ)}</div></div>
      <div class="card red"><div class="label">Adeudos anteriores</div><div class="value">${fmt(adeudosTot)}</div><div class="hint">${adeudos.length} adeudo(s) arrastrado(s)</div></div>
    </div>
    <div class="table-wrap"><table class="matrix">
      <thead><tr><th class="client-col">Servicio / cargo</th><th class="qnav"><button class="btn btn-ghost q-arrow" id="q-prev" title="Trimestre anterior">‹</button></th>${cols.map(p => `<th style="text-align:center">${MONTHS[monthOf(p) - 1]}</th>`).join("")}<th class="qnav"><button class="btn btn-ghost q-arrow" id="q-next" title="Siguiente trimestre">›</button></th><th class="num">Cobrado</th></tr></thead>
      <tbody>${rows + cargoRows || `<tr><td colspan="7" class="empty-state">Sin servicios ni cargos.</td></tr>`}</tbody>
      <tfoot>
        <tr><td class="client-col"><strong>Cobrado</strong></td><td class="qarrow"></td>${monthTotals.map(t => `<td class="cell muted">${t ? fmt(t) : ""}</td>`).join("")}<td class="qarrow"></td><td class="num"><strong>${fmt(monthTotals.reduce((a, b) => a + b, 0))}</strong></td></tr>
        <tr><td class="client-col"><strong>Por cobrar</strong></td><td class="qarrow"></td>${monthPend.map(t => `<td class="cell muted">${t ? fmt(t) : ""}</td>`).join("")}<td class="qarrow"></td><td class="num" style="color:var(--amber)"><strong>${fmt(monthPend.reduce((a, b) => a + b, 0))}</strong></td></tr>
      </tfoot>
    </table></div>
  `;

  document.getElementById("q-prev").onclick = () => { ui.qStart = shiftPeriod(qs, -3); render(); };
  document.getElementById("q-next").onclick = () => { ui.qStart = shiftPeriod(qs, 3); render(); };
  document.getElementById("year-prev").onclick = () => { ui.qStart = shiftPeriod(qs, -12); render(); };
  document.getElementById("year-next").onclick = () => { ui.qStart = shiftPeriod(qs, 12); render(); };
  document.getElementById("q-today")?.addEventListener("click", () => { ui.qStart = quarterStart(); render(); });
  document.getElementById("btn-new").onclick = () => openPaymentModal(null, {});
  document.getElementById("btn-new-client").onclick = openClientModal;

  let clickTimer = null;
  view.querySelectorAll("[data-cell]").forEach(el => {
    el.onclick = () => {
      const [sid, period] = el.dataset.cell.split("|");
      clearTimeout(clickTimer);
      clickTimer = setTimeout(() => cycleMensualidad(sid, period), 260);
    };
    el.ondblclick = () => {
      clearTimeout(clickTimer);
      const [sid, period] = el.dataset.cell.split("|");
      editMensualidad(sid, period);
    };
  });
  view.querySelectorAll("[data-cargo-cell]").forEach(el => {
    const find = () => state.charges.find(x => x.id === el.dataset.cargoCell);
    el.onclick = () => {
      clearTimeout(clickTimer);
      clickTimer = setTimeout(() => {
        const ch = find();
        if (ch) { toggleStatus(ch); save(); render(); }
      }, 260);
    };
    el.ondblclick = () => {
      clearTimeout(clickTimer);
      const ch = find();
      if (ch) openPaymentModal(ch);
    };
  });
}

function editMensualidad(serviceId, period) {
  const sv = serviceById(serviceId);
  if (!sv) return;
  const ch = mensualidadFor(serviceId, period);
  if (ch) openPaymentModal(ch);
  else openPaymentModal(null, { clientId: sv.clientId, serviceId, period, kind: "mensualidad", amount: expectedAmount(sv, period) });
}

function cycleMensualidad(serviceId, period) {
  const sv = serviceById(serviceId);
  if (!sv) return;
  const existing = mensualidadFor(serviceId, period);
  if (!existing) {
    state.charges.push({
      id: uid(), clientId: sv.clientId, serviceId, kind: "mensualidad", period,
      concept: `${sv.name} ${periodLabel(period)}`,
      amount: expectedAmount(sv, period),
      status: "pagado",
      paidDate: new Date().toISOString().slice(0, 10),
      notes: "", createdAt: Date.now(),
    });
  } else {
    // Alterna pagado <-> pendiente conservando el monto registrado.
    // Para vaciar la celda: doble clic -> Eliminar.
    toggleStatus(existing);
  }
  save();
  render();
}

function toggleStatus(p) {
  p.status = p.status === "pagado" ? "pendiente" : "pagado";
  p.paidDate = p.status === "pagado"
    ? (p.paidDate || new Date().toISOString().slice(0, 10))
    : "";
}

/* ---------- Vista: Clientes ---------- */

function renderClientes() {
  view.innerHTML = `
    <div class="toolbar"><strong>Alta de cliente</strong></div>
    <form id="client-form" class="toolbar" style="align-items:flex-end">
      <label class="muted" style="font-size:12px">Nombre<br><input type="text" id="c-name" required placeholder="Nombre del cliente"></label>
      <label class="muted" style="font-size:12px">Notas<br><input type="text" id="c-notes" placeholder="Opcional" style="width:220px"></label>
      <button type="submit" class="btn btn-primary">Agregar</button>
    </form>

    <div class="section-title">Clientes y sus servicios mensuales</div>
    ${state.clients.map(c => {
      const svcs = state.services.filter(s => s.clientId === c.id);
      const pendiente = state.charges.filter(p => p.clientId === c.id && p.status === "pendiente").reduce((s, p) => s + p.amount, 0);
      return `<div class="panel">
        <div class="panel-head">
          ${clientTag(c)}
          <input type="text" value="${esc(c.notes || "")}" data-client-field="notes" data-cid="${c.id}" placeholder="Notas…" style="flex:1;min-width:160px">
          <span class="muted">Por cobrar: <strong>${fmt(pendiente)}</strong></span>
          <label class="muted" style="display:flex;align-items:center;gap:6px">Activo <input type="checkbox" ${c.active ? "checked" : ""} data-client-field="active" data-cid="${c.id}"></label>
          <button class="btn btn-danger btn-small" data-del-client="${c.id}">Eliminar</button>
        </div>
        <table>
          <thead><tr><th>Servicio mensual</th><th>Monto</th><th>Día de pago</th><th>Desde</th><th>Activo</th><th></th></tr></thead>
          <tbody>
            ${svcs.map(sv => `<tr>
              <td><input type="text" value="${esc(sv.name)}" data-svc-field="name" data-sid="${sv.id}" style="width:220px"></td>
              <td><input type="number" min="0" step="0.01" value="${sv.amount}" data-svc-field="amount" data-sid="${sv.id}" style="width:110px"></td>
              <td><input type="number" min="1" max="31" value="${sv.payDay || ""}" data-svc-field="payDay" data-sid="${sv.id}" style="width:64px"></td>
              <td><input type="month" value="${sv.startPeriod}" data-svc-field="startPeriod" data-sid="${sv.id}"></td>
              <td><input type="checkbox" ${sv.active ? "checked" : ""} data-svc-field="active" data-sid="${sv.id}"></td>
              <td><button class="btn btn-danger btn-small" data-del-svc="${sv.id}">Quitar</button></td>
            </tr>`).join("")}
            <tr>
              <td><input type="text" id="ns-name-${c.id}" placeholder="+ nuevo servicio (ej. Manejo de redes)" style="width:220px"></td>
              <td><input type="number" id="ns-amount-${c.id}" min="0" step="0.01" placeholder="0" style="width:110px"></td>
              <td><input type="number" id="ns-day-${c.id}" min="1" max="31" placeholder="10" style="width:64px"></td>
              <td><input type="month" id="ns-start-${c.id}" value="${currentPeriod()}"></td>
              <td colspan="2"><button class="btn btn-ghost btn-small" data-add-svc="${c.id}">Agregar servicio</button></td>
            </tr>
          </tbody>
        </table>
      </div>`;
    }).join("")}
  `;

  document.getElementById("client-form").onsubmit = e => {
    e.preventDefault();
    const name = document.getElementById("c-name").value.trim();
    if (!name) return;
    state.clients.push({
      id: uid(), name,
      color: PALETTE[state.clients.length % PALETTE.length],
      notes: document.getElementById("c-notes").value.trim(),
      active: true,
    });
    save(); render();
  };

  view.querySelectorAll("[data-client-field]").forEach(el => {
    el.onchange = () => {
      const c = clientById(el.dataset.cid);
      if (!c) return;
      const f = el.dataset.clientField;
      if (f === "active") c.active = el.checked;
      else c[f] = el.value;
      save(); render();
    };
  });

  view.querySelectorAll("[data-svc-field]").forEach(el => {
    el.onchange = () => {
      const sv = serviceById(el.dataset.sid);
      if (!sv) return;
      const f = el.dataset.svcField;
      if (f === "active") sv.active = el.checked;
      else if (f === "amount") sv.amount = parseFloat(el.value) || 0;
      else if (f === "payDay") sv.payDay = parseInt(el.value, 10) || null;
      else sv[f] = el.value;
      save(); render();
    };
  });

  view.querySelectorAll("[data-add-svc]").forEach(el => {
    el.onclick = () => {
      const cid = el.dataset.addSvc;
      const nameEl = document.getElementById(`ns-name-${cid}`);
      const name = nameEl.value.trim();
      if (!name) { nameEl.focus(); return; }
      state.services.push({
        id: uid(), clientId: cid, name,
        amount: parseFloat(document.getElementById(`ns-amount-${cid}`).value) || 0,
        payDay: parseInt(document.getElementById(`ns-day-${cid}`).value, 10) || null,
        startPeriod: document.getElementById(`ns-start-${cid}`).value || currentPeriod(),
        active: true,
      });
      save(); render();
    };
  });

  view.querySelectorAll("[data-del-svc]").forEach(el => {
    el.onclick = () => {
      const sv = serviceById(el.dataset.delSvc);
      if (!sv) return;
      const n = state.charges.filter(p => p.serviceId === sv.id).length;
      if (!confirm(`¿Quitar "${sv.name}"${n ? ` y sus ${n} cobro(s)` : ""}?`)) return;
      state.services = state.services.filter(s => s.id !== sv.id);
      state.charges = state.charges.filter(p => p.serviceId !== sv.id);
      save(); render();
    };
  });

  view.querySelectorAll("[data-del-client]").forEach(el => {
    el.onclick = () => {
      const c = clientById(el.dataset.delClient);
      if (!c) return;
      const n = state.charges.filter(p => p.clientId === c.id).length;
      if (!confirm(`¿Eliminar a ${c.name}, sus servicios y ${n} cobro(s)?`)) return;
      state.clients = state.clients.filter(x => x.id !== c.id);
      state.services = state.services.filter(s => s.clientId !== c.id);
      state.charges = state.charges.filter(p => p.clientId !== c.id);
      save(); render();
    };
  });
}

/* ---------- Modal de pago ---------- */

const backdrop = document.getElementById("modal-backdrop");
const form = document.getElementById("payment-form");

function openPaymentModal(charge, defaults = {}) {
  const cSel = document.getElementById("f-client");
  cSel.innerHTML = state.clients.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("");

  document.getElementById("modal-title").textContent = charge ? "Editar cobro" : "Nuevo cobro";
  document.getElementById("btn-delete-payment").hidden = !charge;

  document.getElementById("f-id").value = charge?.id || "";
  cSel.value = charge?.clientId || defaults.clientId || state.clients[0]?.id;
  document.getElementById("f-type").value = charge?.kind || defaults.kind || "mensualidad";
  document.getElementById("f-period").value = charge?.period || defaults.period || currentPeriod();
  document.getElementById("f-amount").value = charge?.amount ?? defaults.amount ?? "";
  document.getElementById("f-status").value = charge?.status || "pendiente";
  document.getElementById("f-paiddate").value = charge?.paidDate || "";
  document.getElementById("f-concept").value = charge?.concept || "";
  populateServices(charge?.serviceId || defaults.serviceId || "");
  toggleServiceRow();

  backdrop.hidden = false;
}

function populateServices(selectedId = "") {
  const cid = document.getElementById("f-client").value;
  const sel = document.getElementById("f-service");
  sel.innerHTML = `<option value="">— sin servicio —</option>` +
    state.services.filter(s => s.clientId === cid)
      .map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join("");
  sel.value = selectedId;
}

function toggleServiceRow() {
  document.getElementById("row-service").hidden = document.getElementById("f-type").value !== "mensualidad";
}

function closeModal() { backdrop.hidden = true; }

form.onsubmit = e => {
  e.preventDefault();
  const id = document.getElementById("f-id").value;
  const kind = document.getElementById("f-type").value;
  const serviceId = kind === "mensualidad" ? (document.getElementById("f-service").value || null) : null;
  const sv = serviceId ? serviceById(serviceId) : null;
  const period = document.getElementById("f-period").value;
  const data = {
    clientId: document.getElementById("f-client").value,
    serviceId, kind, period,
    amount: parseFloat(document.getElementById("f-amount").value) || 0,
    status: document.getElementById("f-status").value,
    paidDate: document.getElementById("f-paiddate").value,
    concept: document.getElementById("f-concept").value.trim() || (sv ? `${sv.name} ${periodLabel(period)}` : ""),
  };
  if (data.status === "pagado" && !data.paidDate) data.paidDate = new Date().toISOString().slice(0, 10);
  if (id) {
    const p = state.charges.find(x => x.id === id);
    if (p) Object.assign(p, data);
  } else {
    state.charges.push({ id: uid(), createdAt: Date.now(), notes: "", ...data });
  }
  save(); closeModal(); render();
};

document.getElementById("btn-delete-payment").onclick = () => {
  const id = document.getElementById("f-id").value;
  if (!id || !confirm("¿Eliminar este cobro?")) return;
  state.charges = state.charges.filter(p => p.id !== id);
  save(); closeModal(); render();
};

document.getElementById("btn-cancel").onclick = closeModal;
document.getElementById("modal-close").onclick = closeModal;
backdrop.onclick = e => { if (e.target === backdrop) closeModal(); };
document.addEventListener("keydown", e => { if (e.key === "Escape") { closeModal(); closeClientModal(); } });

/* ---------- Modal: alta rápida de cliente ---------- */

const cBackdrop = document.getElementById("client-modal-backdrop");
const cForm = document.getElementById("client-form-modal");

function openClientModal() {
  cForm.reset();
  document.getElementById("cm-start").value = currentPeriod();
  cBackdrop.hidden = false;
}

function closeClientModal() { cBackdrop.hidden = true; }

cForm.onsubmit = e => {
  e.preventDefault();
  const name = document.getElementById("cm-name").value.trim();
  if (!name) return;
  const cid = uid();
  state.clients.push({
    id: cid, name,
    color: PALETTE[state.clients.length % PALETTE.length],
    notes: "", active: true,
  });
  const svcName = document.getElementById("cm-svc").value.trim();
  if (svcName) {
    state.services.push({
      id: uid(), clientId: cid, name: svcName,
      amount: parseFloat(document.getElementById("cm-amount").value) || 0,
      payDay: parseInt(document.getElementById("cm-day").value, 10) || null,
      startPeriod: document.getElementById("cm-start").value || currentPeriod(),
      active: true,
    });
  }
  save(); closeClientModal(); render();
};

document.getElementById("cm-cancel").onclick = closeClientModal;
document.getElementById("cm-close").onclick = closeClientModal;
cBackdrop.onclick = e => { if (e.target === cBackdrop) closeClientModal(); };

// Al cambiar cliente/tipo/servicio: repoblar servicios y prellenar monto
document.getElementById("f-type").onchange = () => { toggleServiceRow(); prefillAmount(); };
document.getElementById("f-client").onchange = () => { populateServices(); prefillAmount(); };
document.getElementById("f-service").onchange = prefillAmount;
function prefillAmount() {
  const amountEl = document.getElementById("f-amount");
  if (amountEl.value) return;
  if (document.getElementById("f-type").value !== "mensualidad") return;
  const sv = serviceById(document.getElementById("f-service").value);
  if (sv?.amount) amountEl.value = sv.amount;
}

/* ---------- Delegación: clic para editar pagos ---------- */

view.addEventListener("click", e => {
  const payBtn = e.target.closest("[data-pay]");
  if (payBtn) {
    const key = payBtn.dataset.pay;
    const today = new Date().toISOString().slice(0, 10);
    if (key.startsWith("V:")) {
      // Mensualidad esperada sin registro: se crea ya pagada
      const [clientId, serviceId, period] = key.slice(2).split("|");
      const sv = serviceById(serviceId);
      if (!sv) return;
      state.charges.push({
        id: uid(), clientId, serviceId, kind: "mensualidad", period,
        concept: `${sv.name} ${periodLabel(period)}`, amount: expectedAmount(sv, period),
        status: "pagado", paidDate: today, notes: "", createdAt: Date.now(),
      });
    } else {
      const p = state.charges.find(x => x.id === key);
      if (!p) return;
      p.status = "pagado";
      if (!p.paidDate) p.paidDate = today;
    }
    save(); render();
    return;
  }
  const nRow = e.target.closest("[data-new]");
  if (nRow) {
    const [clientId, serviceId, period] = nRow.dataset.new.split("|");
    openPaymentModal(null, { clientId, serviceId, period, kind: "mensualidad" });
    return;
  }
  const row = e.target.closest("[data-edit]");
  if (!row) return;
  const p = state.charges.find(x => x.id === row.dataset.edit);
  if (p) openPaymentModal(p);
});

/* ---------- Tabs ---------- */

document.querySelectorAll(".tab").forEach(t => {
  t.onclick = () => { ui.tab = t.dataset.tab; render(); };
});

/* ---------- Exportar / Importar ---------- */

document.getElementById("btn-export").onclick = () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `wtfim-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
};

document.getElementById("import-file").onchange = e => {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      let s = JSON.parse(r.result);
      if (!Array.isArray(s.clients) || (!Array.isArray(s.charges) && !Array.isArray(s.payments)))
        throw new Error("formato inválido");
      if (!confirm("Esto reemplazará todos los datos actuales. ¿Continuar?")) return;
      if (!Array.isArray(s.charges)) s = migrateV1(s);
      if (!Array.isArray(s.services)) s.services = [];
      state = s;
      save(); render();
    } catch (err) {
      alert("Archivo inválido: " + err.message);
    }
    e.target.value = "";
  };
  r.readAsText(f);
};

/* ---------- Sync con Supabase ---------- */

const CFG = window.WTFIM_CFG || {};
const syncEnabled = () => Boolean(CFG.url && CFG.key && !CFG.url.includes("TU-PROYECTO"));

function setSync(status) {
  const el = document.getElementById("sync-status");
  if (!el) return;
  if (!syncEnabled()) {
    el.textContent = "· local";
    el.style.color = "var(--muted)";
    el.title = "Sin Supabase: los datos solo viven en este navegador";
    return;
  }
  const map = { busy: ["nube…", "var(--amber)"], ok: ["nube ✓", "var(--green)"], err: ["nube ✕", "var(--red)"] };
  const [txt, color] = map[status] || map.ok;
  el.textContent = txt;
  el.style.color = color;
  el.title = "Sincronizado con Supabase";
}

const sbHeaders = () => ({
  apikey: CFG.key,
  Authorization: `Bearer ${CFG.key}`,
  "Content-Type": "application/json",
});

async function remoteLoad() {
  const res = await fetch(`${CFG.url}/rest/v1/wtfim_state?id=eq.1&select=data`, { headers: sbHeaders() });
  if (!res.ok) throw new Error("remoteLoad " + res.status);
  const rows = await res.json();
  return rows[0]?.data || null;
}

async function remoteSave(data) {
  const res = await fetch(`${CFG.url}/rest/v1/wtfim_state`, {
    method: "POST",
    headers: { ...sbHeaders(), Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{ id: 1, data }]),
  });
  if (!res.ok) throw new Error("remoteSave " + res.status);
}

let saveTimer = null;
function queueRemoteSave() {
  if (!syncEnabled()) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    setSync("busy");
    try { await remoteSave(state); setSync("ok"); }
    catch (e) { console.error("sync:", e); setSync("err"); }
  }, 400);
}

// Al arrancar: jala la nube si es mas reciente; si la nube esta vacia, sube lo local
async function bootSync() {
  setSync("busy");
  if (!syncEnabled()) { setSync(); return; }
  try {
    let remote = await remoteLoad();
    if (remote && Array.isArray(remote.payments)) remote = migrateV1(remote);
    if (!remote) {
      await remoteSave(state);
    } else if ((remote.savedAt || 0) >= (state.savedAt || 0)) {
      // Remoto gana en empate: semillas y estados viejos (sin savedAt) ceden
      state = remote;
      localStorage.setItem(LS_KEY, JSON.stringify(state));
      render();
    }
    setSync("ok");
  } catch (e) {
    console.error("sync:", e);
    setSync("err");
  }
}

/* ---------- Init ---------- */

render();
bootSync();
