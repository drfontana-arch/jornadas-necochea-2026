# Correcciones

Se anotan acá y se aplican de a varias juntas (un solo build, un solo push, un solo reset del sorteo).

## Pendientes

_(vacío)_

## Aplicadas (tanda 1)

1. **Excepciones en Departamentales: elegir de una lista.** Al elegir "equipo/pareja" o "persona puntual", se abre un desplegable con los equipos/personas realmente inscriptos de esa departamental (con su categoría), en vez de tipear. Ya no hay errores de tipeo. (`/api/restricciones/opciones`, `listRestrictionOptions` en `lib/db.js`).
2. **Autoresolver respeta el orden de las rondas.** Un partido reprogramado no puede quedar antes de que termine la ronda anterior (ni antes de que termine la fase de grupos, si es playoff) ni después del comienzo de la ronda siguiente (ni del playoff, si es de grupos). Elige el horario válido más cercano al original en vez de mandarlo al final. También se corrigió que no aplicaba los cortes horarios por tipo de disciplina (le faltaba el id de disciplina).
3. **Fixture: filtros por categoría y por equipo**, y orden por día/hora, disciplina o categoría.
4. **Fixture: vistas de grilla** (por cancha con días en columnas; agenda con horas en vertical y días en horizontal), sobre todos los partidos filtrados o solo los seleccionados, con casillero de color por categoría, número de cancha, y descarga a **Excel (.xlsx)** que abre también en Google Sheets.

## Notas / limitaciones conocidas

- Las restricciones **individuales por persona** se guardan bien, pero todavía **no se aplican solas** al sortear ni al autoresolver (solo las de departamental y equipo). Pendiente de decidir si se construye.
- Las restricciones de **equipo** ahora se eligen por equipo Y categoría (el desplegable agrupa por categoría) y valen solo para esa categoría. Se guardan como `Nombre::idCategoria` en `team_label`. Las que se cargaron antes (solo nombre) siguen valiendo para ese nombre en cualquier categoría.
- El botón manual **"Reprogramar este partido"** no valida el orden de las rondas: quien reprograma a mano decide el horario.
