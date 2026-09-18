# Jornadas Deportivas Necochea 2026 — Traspaso a Claude Code

**Repo**: github.com/drfontana-arch/jornadas-necochea-2026
**Producción**: https://jornadas-necochea-2026.vercel.app
**Stack**: Next.js 14.2.35 (App Router) + Supabase (Postgres) + Vercel (plan Hobby)

---

## 1) QUÉ HACER AHORA MISMO

Hay 3 archivos modificados en esta sesión que **todavía no están en el repo**. Bajalos de este chat y pegalos, reemplazando los que ya existen:

| Archivo descargado | Va en |
|---|---|
| `sorteoLogic.js` | `lib/sorteoLogic.js` |
| `sorteoRunner.js` | `lib/sorteoRunner.js` |
| `playoff-route.js` | `app/api/categorias/[id]/playoff/route.js` |

Después, desde GitBash en la carpeta del proyecto:

```bash
git add lib/sorteoLogic.js lib/sorteoRunner.js "app/api/categorias/[id]/playoff/route.js"
git commit -m "Fix: orden cronologico real entre dias (evita rondas antes de tiempo, prioriza llenar dias tempranos)"
git push origin main
```

Vercel redeploya solo al detectar el push. Después de eso:

1. Entrar a **Fixture y conflictos** → botón **"Revisar y sortear todo lo pendiente"** → revisar la config de cada categoría (modalidad/tamaño de grupo/clasificados) → **"Confirmar y sortear todo"**.
2. Si se corta antes de terminar (puede pasar con muchas categorías), simplemente volver a apretar el mismo botón — retoma solo, no rehace lo ya sorteado.

---

## 2) QUÉ ES ESTE PROYECTO

Sistema interno (con contraseña compartida, no es la web pública del evento) para que Enzo sortee y audite las Jornadas Deportivas Interdepartamentales — Necochea 2026 (torneo multideporte del Colegio de Magistrados y Funcionarios, Pcia. de Buenos Aires). Reemplaza una planilla manual: arma llaves/grupos, asigna día/hora/cancha evitando superposiciones reales, genera pósters imprimibles, y va a llevar auditoría de resultados/asistencia.

La web pública real del evento (jornadasdeportivasnecochea.com.ar, hecha por Gonzalo Coelho) es un sistema aparte; este es solo la herramienta interna de organización.

---

## 3) ARQUITECTURA

```
/lib/sorteoLogic.js     — lógica PURA (sin acceso a datos): armado de llaves, grupos,
                           pool de horarios, detección de conflictos, cortes horarios.
                           Reutilizable/testeable sin tocar la base.
/lib/sorteoRunner.js    — orquesta un sorteo completo por categoría (o en lote), usando
                           sorteoLogic + acceso a datos. Acá vive runSorteoForCategory().
/lib/db.js              — TODAS las consultas a Supabase (participantes, categorías,
                           partidos, restricciones, etc.)
/lib/supabase.js        — cliente de Supabase. OJO: tiene un fetch propio con
                           cache:"no-store" -- Next.js cachea fetch() por defecto del
                           lado del servidor y eso rompía todo silenciosamente (ver
                           sección de bugs resueltos, punto 7).
/lib/bracketLayout.js   — algoritmo de posicionamiento visual para dibujar llaves en SVG.
/components/AppShell.jsx        — header + nav de toda la app.
/components/BracketGroup.jsx    — dibuja una llave como <g> SVG reutilizable.
/components/BracketSVG.jsx      — wrapper standalone de BracketGroup.
/components/PosterSVG.jsx       — póster completo (header+grupos+llave) como un solo SVG.
/app/(app)/...          — todas las pantallas (Departamentales, Disciplinas y sedes,
                           Inscripciones, Antecedentes, Sorteo, Fixture y conflictos
                           [=Calendario], Auditor de jornadas).
/app/(app)/poster/[categoryId]/page.jsx  — póster imprimible por categoría (SVG,
                           descargable, botón imprimir con tamaño A1).
/app/(app)/poster/dia/[day]/page.jsx     — póster por día, todas las disciplinas.
/app/api/...            — todas las rutas de API. TODAS tienen
                           `export const dynamic = "force-dynamic"` (necesario, ver
                           bugs resueltos punto 5).
/app/login/page.jsx      — gate de contraseña compartida.
```

### Base de datos (Supabase, proyecto `jornadas-necochea-2026`, id `ifmmhvayfyokwmgxkrrp`)

Tablas clave: `departamentales`, `disciplines`, `venues`, `categories` (con `modality`,
`group_size`, `advance_per_group`, `groups` JSON, `group_standings` JSON, `drawn` bool,
`copa`/`parent_category_id`/`active` para Copa Oro-Plata), `team_entries` (equipo a
nivel departamental+número), `matches` (partidos con `stage`, `round`, `seq`, día/hora/
cancha), `participants` + `registrations` (personas reales, importadas del CSV real de
inscriptos — 585 personas, 1114 inscripciones, 12 departamentales activas de las 21
seedeadas originalmente), `schedule_restrictions`, `match_results`, `attendance`,
`incidents`.

**Enzo tiene acceso directo a Supabase** (cuenta `jornadasnecochea.sistema@gmail.com`) y a Vercel (cuenta `drfontana-arch`) — puede resetear/auditar la base él mismo si hace falta, usando el SQL Editor de Supabase.

---

## 4) FUNCIONALIDADES YA CONSTRUIDAS

- **Sorteo por categoría** y **sorteo global** ("Sortear todo lo pendiente" en Fixture y
  conflictos), con pantalla de revisión previa editable (modalidad/tamaño de
  grupo/clasificados por categoría) que bloquea categorías que armarían un grupo con
  menos de 2 equipos.
- **Conflictos por PERSONA real** (no por departamental): se arma el roster real de cada
  equipo a partir del CSV, y solo se marca superposición si de verdad comparten a
  alguien — así categorías Masculino/Femenino o actividades nocturnas del viernes no
  generan falsos positivos entre sí.
- **Cortes horarios por tipo de disciplina**: aire libre corta 18:00 (Fútbol 11,
  Reducido, Tenis, Golf, Rugby, Pelota a Paleta), bajo techo corta 20:00 (el resto,
  incluye Hockey por tener luz artificial, Pádel y Básquet), nocturnas sin corte y
  arrancan 21:00 (Truco, Generala, Póker, Tenis de Mesa).
- **Nunca reserva la misma cancha física dos veces** entre categorías de la misma
  disciplina (bug grave encontrado y corregido).
- **Progresión cronológica real entre rondas** (el fix de esta sesión, todavía sin
  pushear): una ronda nunca puede quedar programada antes de que termine la anterior, y
  el sistema llena un día antes de pasar al siguiente en vez de repartir parejo.
- **Copa de Oro / Copa de Plata**: se dispara el aviso solo cuando una categoría de
  Fútbol 11, Reducido, Básquet, Vóley u Hockey llega a 12+ equipos; la división la hace
  la Comisión a mano (no es automática, lo exige el reglamento), y el sistema arma dos
  categorías nuevas con fixture independiente.
- **Playoff con códigos de clasificado**: en modalidad "grupos + playoff", la llave de
  playoff se arma YA (con códigos "1A", "2B", etc.) y queda programada hasta la final
  desde el sorteo inicial, no hace falta esperar a cargar posiciones. Al cargar quién
  salió 1°/2° de cada grupo, el código se reemplaza por el nombre real sin tocar el
  horario ya asignado.
- **Disciplinas individuales/cronometradas** (Natación, Maratón, Patín Carrera,
  Travesía 4x4, Pesca, Tiro): NO se sortean (no hay equipo A vs B), pero sus horarios
  ocupan a los inscriptos para el chequeo de superposiciones, y aparecen como filas en
  el Fixture general.
- **Póker**: se juega en mesas de 8-9 personas simultáneas, no partidos de a pares — el
  sorteo arma esas mesas directamente.
- **Inscripciones**: muestra la lista real de personas por categoría (agrupadas por
  equipo/pareja o individualmente), no solo el nombre de la departamental.
- **Fixture general** (Calendario): filtros por día/disciplina/departamental, columna
  de Sede (ubicación real, para dejar claro que "Cancha 1" de una disciplina no es la
  misma cancha física que "Cancha 1" de otra), detección de conflictos y de violaciones
  de restricciones horarias, autoresolver (reprograma buscando el próximo horario
  libre), reprogramar manual.
- **Pósters imprimibles**: por categoría (llave SVG y/o tablas de grupos) y por día
  (todas las disciplinas), con la estética navy/blanco del sitio oficial, descargables
  como SVG real (para imprenta) y como PDF (tamaño A1) vía el botón de imprimir del
  navegador.
- **Auditor de jornadas**: resumen, carga de resultados, asistencia, incidencias
  (estructura base construida; falta profundizar carga real de resultados según el
  Anexo I de puntajes del reglamento).

---

## 5) PENDIENTE / PRÓXIMOS PASOS

- **Correr el sorteo global** con el fix de esta sesión ya pusheado, y hacer una
  auditoría completa de que todo quedó bien (yo no puedo tocar la base desde ahora en
  este flujo local — lo tenés que correr vos, o pedirle a Claude Code que audite por
  SQL si tiene el conector de Supabase disponible).
- **Auto-avance de ganadores real**: hoy, cuando se carga el resultado de un partido de
  llave/grupos vía el Auditor, el nombre del ganador NO se traslada solo a la ronda
  siguiente (solo funciona el reemplazo de código→nombre para el playoff de
  grupos+playoff, vía `resolveQualifierCode`). Si se quiere que una llave directa (sin
  grupos previos) también auto-complete la ronda siguiente al cargar resultados, hay
  que construir esa propagación.
- **Calculadora de puntaje según el Anexo I** del reglamento (100%/50%/25% por
  disciplina, 75% para Copa Plata, sanciones por ausencia/exceso de invitados, etc.) —
  no está construida todavía.
- **Agente 24/7** (GitHub Actions + Playwright comparando contra
  jornadasdeportivasnecochea.com.ar, alertas por Telegram/Gmail) — quedó en etapa de
  planificación, no arrancado.
- **Conflictos de disciplinas individuales** (Natación, Tiro, etc.) siguen chequeándose
  a nivel departamental, no por persona (a diferencia de los partidos normales, que ya
  son por persona real) — se puede afinar si genera falsos positivos.

---

## 6) FLUJO DE TRABAJO ACORDADO (a partir de ahora)

- Se trabaja **local**: Claude (acá o en Claude Code) edita archivos, Enzo hace
  `git add / commit / push` desde GitBash cuando está conforme.
- **No tocar Supabase ni Vercel en vivo** salvo que Enzo lo pida puntualmente y lo
  autorice cada vez (por ejemplo, para destrabar un error que solo se ve mirando la
  base real).
- Siempre correr `npx next build` (con env vars placeholder) antes de dar un archivo
  por terminado, para confirmar que compila.

---

## 7) BUGS GRAVES ENCONTRADOS Y CORREGIDOS ESTA SESIÓN (para no repetirlos)

1. **Import CSV real**: se reemplazaron las categorías placeholder por las reales del
   CSV de inscriptos (mucho más granulares, sobre todo Natación/Tenis).
2. **Next.js cachea las rutas de API como estáticas por defecto** → se agregó
   `export const dynamic = "force-dynamic"` a las 23+ rutas.
3. **Embeddings anidados de Supabase** (`select("*, categorias(disciplinas(...))")`)
   devolvían vacío/rompían consultas → se reemplazaron por fetch separado + merge en JS
   en TODO `lib/db.js`.
4. **Bracket con byes**: las rondas 2+ de una llave no se guardaban con horario (solo se
   programaba la ronda 1) → ahora se programan TODAS las rondas desde el sorteo,
   incluidas las que todavía no tienen equipo confirmado ("A definir").
5. **PostgREST schema cache** desactualizado tras varias migraciones → se mandó
   `NOTIFY pgrst, 'reload schema'`.
6. **Fetch cacheado por Next.js dentro del cliente de Supabase** (el bug más difícil de
   encontrar de toda la sesión — casi 2 horas de diagnóstico): aunque la ruta era
   `dynamic`, las llamadas HTTP internas de `@supabase/supabase-js` usaban el `fetch`
   global que Next.js parchea y cachea agresivamente del lado del servidor. Se le pasó
   un `fetch` propio con `cache: "no-store"` al cliente (`lib/supabase.js`).
7. **Doble reserva de cancha entre categorías** de la misma disciplina (cada sorteo de
   categoría no sabía qué canchas ya había ocupado otra categoría) → se agregó chequeo
   de cancha ocupada contra TODA la disciplina, no solo por departamental/persona.
8. **Timeout 504 en el sorteo global** (Vercel Hobby corta a los 10s por defecto) → se
   subió `maxDuration` a 60s Y se optimizó para reusar partidos/restricciones/sedes ya
   cargados entre categorías en vez de re-consultar la base en cada vuelta.
9. **Rondas sin progresión horaria real** (semifinales y hasta la Final programadas al
   mismo horario que la Ronda 1, o incluso el sábado antes que el "domingo" cuando en
   realidad el orden cronológico real era al revés): el sistema comparaba solo la hora
   del reloj, sin el día. Se agregó orden cronológico real (`absoluteMinutes`, día×1440
   + hora) en `buildSlotPool` y `scheduleRoundsProgressively` — este es el fix que
   todavía falta pushear (ver sección 1).
10. **Disciplinas individuales sorteándose como si fueran equipos** (Natación, Tiro,
    etc. generaban partidos cabeza-a-cabeza sin sentido) → se bloquean explícitamente
    en `runSorteoForCategory`.

---

## 8) CONTEXTO DE LA PLATAFORMA OFICIAL (para referencia)

- jornadasdeportivasnecochea.com.ar (desarrollada por Gonzalo Coelho) — reglamento
  completo en `/resultados/reglamento-general/`, Anexo I de puntajes ahí mismo.
- Reglas clave: walkover a los 15 min, sanción 25% por ausencia injustificada, 50% por
  exceso de invitados/edad, Categorías Oro/Plata desde 12 equipos (Fútbol Reducido,
  Básquet, Vóley, Hockey, y por confirmación de Enzo también Fútbol 11), Plata puntúa
  75% de Oro, ascensos/descensos entre ediciones (no implementado, necesita historial
  de la edición anterior que no tenemos).
