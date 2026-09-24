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

## Aplicadas (tanda 5)

9. **Mapeo a mano en la carga del CSV**, para cuando el nombre real del CSV no coincide con el configurado en el sistema (ej. CSV dice "Hockey" y el sistema tiene "Hockey (Seven)"; o CSV dice "Senior (+42)" y el sistema tiene "Más 40"). En cada fila de "no se van a cargar" que sea por disciplina o categoría no configurada, aparece un desplegable para elegir a cuál disciplina/categoría YA EXISTENTE corresponde, y se reanaliza solo. El mapeo no renombra nada del sistema, solo hace que esas filas del CSV entren ahí. Si la disciplina/categoría todavía no existe ni con otro nombre, no aparece nada para mapear -- hay que crearla primero en "Disciplinas y sedes".
   - Probado con el escenario real reportado (Hockey → "Hockey (Seven)", Fútbol Reducido "Senior (+42)" → "Más 40"): sin mapeo se omiten 307 filas correctamente clasificadas por tipo; con el mapeo aplicado, las 3450 filas del CSV real quedan válidas.

## Aplicadas (tanda 6)

10. **Deshacer una división Copa Oro/Plata.** En "Inscripciones" aparece un panel arriba de todo, "Categorías ya divididas en Copa Oro/Plata", cuando hay alguna -- con un botón "Deshacer división" por cada una. Borra las dos categorías (Oro/Plata) con sus equipos, inscripciones y partidos si tenían, y reactiva la categoría única original (que hasta entonces queda oculta del selector, porque una categoría dividida se desactiva). Pensado para el caso real: se dividió con datos de prueba antes de tener el CSV real -- se deshace, se recarga el CSV sobre la categoría única, y recién con los números reales se vuelve a dividir.

## Aplicadas (tanda 7)

11. **Fix: `participants.id` es un uuid, no el número del CSV.** La carga fallaba con `invalid input syntax for type uuid: "2031"` porque se intentaba usar el `participante_id` del CSV (un número correlativo del padrón) directamente como id de la persona en la base. Ahora se genera un uuid propio para cada persona nueva y se usa ese id -- tanto al crearla como al vincular sus inscripciones -- sin depender de qué tipo de dato tenga esa columna.

## Aplicadas (tanda 8)

12. **Travesía 4x4 y Pesca ya no generan conflicto de horario.** Aunque una misma persona esté anotada en Travesía 4x4 o Pesca Y en otra disciplina al mismo tiempo, ya no aparece como superposición en "Fixture y conflictos" ni en el aviso de incompatibilidades al resetear el sorteo. Siguen apareciendo como filas normales en el Fixture. No cambia cómo el sorteo elige horarios (eso sigue evitando pisarlas); si también querés que el sorteo pueda asignar libremente encima de ellas, decímelo aparte.

## Aplicadas (tanda 9)

13. **Resetear sorteo: se manda en tandas chicas.** Con alcance "Todo el sorteo" (100+ categorías), antes se mandaba un solo pedido con todos los ids juntos -- se cambió a tandas de a 40/200 para no arriesgar el límite de largo de URL de Supabase. Mismo comportamiento, más robusto para alcances grandes.

## Aplicadas (tanda 10)

14. **Sorteo persona contra persona** (Ajedrez, Tenis Singles, Tenis de Mesa Singles -- 9 categorías en el CSV real). Antes, cualquier categoría sin equipos/parejas cargados daba "Menos de 2 equipos inscriptos" aunque hubiera gente anotada, porque el motor solo sabía sortear equipo vs equipo. Ahora, si una categoría no tiene ningún equipo cargado pero sí tiene personas inscriptas individualmente, arma la llave/grupos directamente con esas personas ("Juan Pérez (Necochea)" en vez de "Necochea"), con las mismas opciones de modalidad (llave directa/grupos/grupos+playoff) que ya se configuran hoy. El detector de conflictos también reconoce estos partidos por persona real (si alguien juega Ajedrez y además juega en un equipo a la misma hora, se detecta igual que antes). Las restricciones horarias de "toda la departamental" también aplican, porque `baseDept` ahora sabe extraer la departamental de una etiqueta de persona.
15. **Golf pasa a la lista de disciplinas individuales que no se sortean** (como Natación o Tiro): ocupa el horario de quien esté anotado, para el chequeo de conflictos, pero no arma partidos ni llave -- se juega por puntaje. Necesita tener sus sedes/horarios cargados en "Disciplinas y sedes" para aparecer en el Fixture.

## Notas / limitaciones conocidas

- Las restricciones **individuales por persona** se guardan bien, pero todavía **no se aplican solas** al sortear ni al autoresolver (solo las de departamental y equipo). Pendiente de decidir si se construye.
- Las restricciones de **equipo** ahora se eligen por equipo Y categoría (el desplegable agrupa por categoría) y valen solo para esa categoría. Se guardan como `Nombre::idCategoria` en `team_label`. Las que se cargaron antes (solo nombre) siguen valiendo para ese nombre en cualquier categoría.
- El botón manual **"Reprogramar este partido"** no valida el orden de las rondas: quien reprograma a mano decide el horario.
