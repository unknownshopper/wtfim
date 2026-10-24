# WTFIM — Seguimiento de cobros

App web sin servidor para llevar el control de cobros a clientes
(PCT, JADERSVP, Pata Negra, CLC, Portofino…).

## Modelo

- **Clientes** → cada uno puede tener varios **servicios mensuales**
  (ej. "Iguala", "Manejo de redes" $3,000, "Evaluación 16 sucursales" $19,800),
  cada uno con su monto, día de pago y mes de inicio.
- **Cargos únicos** → proyectos o deudas puntuales
  (ej. "Desarrollo sitio web" $10,000 de Portofino).
- Las mensualidades esperadas se generan solas: si un mes pasado no tiene
  registro, aparece como pendiente/vencido automáticamente.

## Uso

Abre `index.html` directamente en el navegador, o levanta un servidor local:

```bash
python3 -m http.server 8000
# http://localhost:8000
```

Los datos se guardan en `localStorage` del navegador **y en Supabase** si
está configurado (ver abajo). Usa **Exportar** para respaldo JSON e
**Importar** para restaurarlo.

## Sincronización con Supabase

1. Crea un proyecto gratis en [supabase.com](https://supabase.com).
2. En el **SQL Editor** del proyecto, ejecuta:

```sql
create table wtfim_state (
  id int primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table wtfim_state enable row level security;

create policy "wtfim allow all" on wtfim_state
  for all using (true) with check (true);
```

3. En **Settings → API**, copia la **Project URL** y la llave **anon public**
   en `config.js`:

```js
window.WTFIM_CFG = {
  url: "https://xxxx.supabase.co",
  key: "eyJ...",
};
```

4. Recarga la app — el indicador de la barra debe decir **nube ✓**.

### Cómo funciona

- El estado completo se guarda como JSON en una sola fila (`id = 1`).
- Cada cambio se sube a Supabase (con medio segundo de debounce).
- Al abrir la app, gana la copia más reciente (local vs. nube), así
  puedes usarla en varios dispositivos.
- Sin configuración válida, la app sigue funcionando solo con `localStorage`.

### Nota de seguridad

La anon key va en el frontend por diseño. La política `allow all` significa
que cualquiera con la URL+key podría leer/escribir esa tabla — para datos
personales está bien, pero no subas ahí nada sensible. Si quieres blindarlo,
la vía correcta es Supabase Auth (login por correo) + políticas por usuario.

## Secciones

- **Mensualidades** (pantalla principal): matriz servicio × trimestre.
  Navega con `‹ ›` en el encabezado de meses (cruza años) o con los
  botones de año. Clic en celda: `pagado ↔ pendiente`. Doble clic:
  editar / eliminar. Los cargos únicos aparecen como filas propias.
- **Clientes**: alta de clientes y administración de sus servicios
  mensuales (también hay un botón `+ Cliente` en la matriz).

## Notas

- Un cobro `pendiente` cuyo periodo ya pasó se muestra automáticamente como **vencido**.
- Para registrar una deuda o proyecto usa `+ Nuevo cobro` → tipo **Cargo único**.
# wtfim
