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

Los datos se guardan en `localStorage` del navegador. Usa **Exportar** para
descargar un respaldo JSON e **Importar** para restaurarlo (útil si cambias
de navegador o computadora).

## Secciones

- **Resumen**: cobrado/pendiente del mes, vencidos y próximos cobros
  (incluye mensualidades esperadas aunque no estén registradas).
- **Mensualidades**: matriz servicio × mes. Clic en una celda cicla
  `pagado → pendiente → vacío`.
- **Pagos**: todos los cobros registrados, filtrables. Clic para editar.
- **Clientes**: alta de clientes y administración de sus servicios mensuales.

## Notas

- Un cobro `pendiente` cuyo periodo ya pasó se muestra automáticamente como **vencido**.
- Para registrar una deuda o proyecto usa `+ Nuevo cobro` → tipo **Cargo único**.
# wtfim
