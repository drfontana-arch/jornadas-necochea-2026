# Correcciones

Se anotan acá y se aplican de a varias juntas (un solo build, un solo push, un solo reset del sorteo).

## Pendientes

_(vacío)_

## Aplicadas (tanda 1)

1. **Excepciones en Departamentales: elegir de una lista.** Al elegir "equipo/pareja" o "persona puntual", se abre un desplegable con los equipos/personas realmente inscriptos de esa departamental (con su categoría), en vez de tipear. Ya no hay errores de tipeo. (`/api/restricciones/opciones`, `listRestrictionOptions` en `lib/db.js`).
2. **Autoresolver respeta el orden de las rondas.** Un partido reprogramado no puede quedar antes de que termine la ronda anterior (ni antes de que termine la fase de grupos, si es playoff) ni después del comienzo de la ronda siguiente (ni del playoff, si es de grupos). Elige el horario válido más cercano al original en vez de mandarlo al final. También se corrigió que no aplicaba los cortes horarios por tipo de disciplina (le faltaba el id de disciplina).
3. **Fixture: filtros por categoría y por equipo**, y orden por día/hora, disciplina o categoría.
4. **Fixture: vistas de grilla** (por cancha con días en columnas; agenda con horas en vertical y días en horizontal), sobre todos los partidos filtrados o solo los seleccionados, con casillero de color por categoría, número de cancha, y descarga a **Excel (.xlsx)** que abre también en Google Sheets.

## Aplicadas (tanda 2)

5. **Botón "Resetear sorteo"** en Fixture y conflictos. Permite elegir el alcance (una categoría, una disciplina completa, o todo el sorteo) y borra SOLO el fixture de partidos de ese alcance (y los resultados ya cargados sobre esos partidos), dejando las categorías "sin sortear" para volver a correr el sorteo. NO toca la modalidad/tamaño de grupo/clasificados de cada categoría, ni las sedes/canchas, ni las inscripciones (equipos/personas). Antes de confirmar, muestra cuántos partidos y categorías se van a borrar.
6. **Aviso de incompatibilidades antes de resetear.** Si el alcance elegido tiene ahora mismo superposiciones horarias o restricciones sin respetar, el panel las lista con el detalle (quién, en qué partidos, qué día y hora), para decidir si conviene resetear o resolverlas a mano sin perder el resto del fixture ya sorteado.

## Aplicadas (tanda 3)

7. **Pantalla nueva "Base de datos"** (nuevo tab en el menú). Permite subir el CSV de inscriptos (`participante_id, nombre, apellido, departamental, disciplina, categoria, equipo, equipo_nro`) y hacer un **reemplazo total**: borra TODAS las personas, equipos (team_entries) e inscripciones (registrations) actuales y las reconstruye desde cero con lo que dice el CSV. Las departamentales que falten se crean solas por nombre. Una disciplina o categoría que el sistema todavía no tenga configurada NO se crea sola -- esas filas quedan afuera y se listan aparte, con cuántas inscripciones afecta y algunos nombres de ejemplo, para configurarla primero en "Disciplinas y sedes". No toca sedes/canchas, la modalidad/tamaño de grupo/clasificados de cada categoría, ni los partidos ya sorteados.
   - Primero muestra una vista previa (cuánto se va a cargar, qué se va a crear, qué queda afuera y por qué) y recién después pide confirmar. No se aplica nada hasta que confirmás.
   - Detecta filas repetidas (misma persona, misma categoría, dos veces) y filas con datos incompletos, y las lista por separado sin frenar el resto de la carga.

## Aplicadas (tanda 4)

8. **El matcheo del CSV ahora ignora también la puntuación** (guiones, puntos, paréntesis, "+"), no solo acentos/mayúsculas/espacios. Antes, "Avellaneda-Lanús" en la base y "AVELLANEDA LANUS" en el CSV se consideraban distintos y se ofrecía crear una departamental duplicada; ahora matchean. Mismo criterio para disciplinas y categorías (ej. "Senior (+42)" matchea con "Senior 42").

## Notas / limitaciones conocidas

- Las restricciones **individuales por persona** se guardan bien, pero todavía **no se aplican solas** al sortear ni al autoresolver (solo las de departamental y equipo). Pendiente de decidir si se construye.
- Las restricciones de **equipo** ahora se eligen por equipo Y categoría (el desplegable agrupa por categoría) y valen solo para esa categoría. Se guardan como `Nombre::idCategoria` en `team_label`. Las que se cargaron antes (solo nombre) siguen valiendo para ese nombre en cualquier categoría.
- El botón manual **"Reprogramar este partido"** no valida el orden de las rondas: quien reprograma a mano decide el horario.
