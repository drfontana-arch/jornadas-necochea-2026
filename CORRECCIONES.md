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

## Aplicadas (tanda 11)

16. **Fix: las pantallas de vista previa/revisión no se habían enterado del sorteo por persona.** La tanda anterior arregló el MOTOR de sorteo, pero tres pantallas seguían mostrando "0 equipos" para Ajedrez y compañía porque contaban solo `team_entries`, sin el fallback a personas sueltas:
    - "Revisar y sortear todo lo pendiente" (`/api/sorteo-global`): ahora cuenta personas inscriptas cuando la categoría no tiene equipos, así deja de aparecer en rojo.
    - Pantalla **Sorteo**: el conteo y el botón "Sortear" ahora también consideran las personas sueltas.
    - Pantalla **Antecedentes** (orden de cabezas de serie): ahora también se pueden ordenar las personas de estas categorías, no solo equipos.
    No hacía falta recargar el CSV -- los datos ya estaban bien, era una cuenta que faltaba actualizar en estas 3 pantallas.

## Aplicadas (tanda 12)

17. **Conflictos uno por uno en la pantalla de Sorteo.** Al apretar "Sortear"/"Volver a sortear" o "Generar llave de playoff", si el sorteo dejó superposiciones horarias o restricciones sin respetar, aparece una tarjeta roja debajo del botón con el detalle de cada una (quién, en qué partidos, qué día y hora) -- ya no hace falta ir a "Fixture y conflictos" a buscarlas. Se limpia al cambiar de categoría.

## Aplicadas (tanda 13)

18. **Nombre de archivo al exportar el póster a PDF.** El botón "Descargar SVG" ya guardaba con el nombre de disciplina y categoría; "Imprimir / exportar PDF" no, porque el navegador usa el título de la pestaña como nombre sugerido, y era siempre el mismo genérico. Ahora, al abrir el póster de una categoría, el título de la pestaña pasa a ser "Disciplina — Categoría" (y en el póster por día, "Cronograma — Día"), así el PDF ya se guarda con ese nombre por defecto, sin tener que renombrarlo a mano.

## Aplicadas (tanda 14)

19. **Casilleros sin definir en las llaves quedan en blanco, no "A definir".** En el dibujo de la llave (usado en el póster de cada categoría), un casillero sin equipo asignado todavía ya no imprime el texto "A definir" -- queda en blanco, para completar el nombre del ganador a mano en el póster impreso. El BYE sigue mostrando "BYE (pasa directo)", porque ahí no hay nada que completar. No toqué la tabla de Fixture ni el Excel exportado, que siguen mostrando "A definir vs A definir" (ahí es información de pantalla, no algo para escribir a mano).

## Aplicadas (tanda 15)

20. **Evitar que dos equipos (o personas) de la misma departamental se crucen en primera ronda de una llave**, cuando sea posible. Aplica a "Llave directa" y a la llave de playoff de "Grupos + playoff" (ambas usan el mismo armado de llave). Es un "si es posible": si sortea un intercambio que separa a los dos sin generar un cruce nuevo en otro lado, lo hace; si es matemáticamente inevitable (ej. más de la mitad de los anotados son de la misma departamental), deja el mínimo posible de cruces sin tocar nada más. No aplica a la fase de grupos (round robin), donde no hay "primera ronda" en el mismo sentido.
    - Probado: cruce forzado se resuelve a 0; con 4 de 8 del mismo departamento (evitable) da 0; con 5 de 8 (matemáticamente inevitable) da exactamente 1, el mínimo teórico; con 32 equipos resuelve en 1ms sin choques; funciona igual con nombres de persona (Ajedrez, Tenis Singles).

## Aplicadas (tanda 16)

21. **En las llaves de Ajedrez, Tenis Singles y Tenis de Mesa Singles, el casillero muestra la departamental (no el nombre de la persona), con una línea punteada debajo para completar el nombre a mano.** Si dos personas de la misma departamental están anotadas en la misma categoría, los dos casilleros dicen lo mismo ("Necochea"), sin numerar -- se distinguen recién al completar el nombre. El recuadro de la llave se agranda un poco para estas categorías, para que entre la línea de abajo. El BYE sigue mostrando "BYE (pasa directo)" sin tocar. Las llaves de equipo (Vóley, Básquet, etc.) no cambian en nada.

## Aplicadas (tanda 17)

22. **Cancha y horario ocultos en el póster de cada categoría (PDF y SVG), por ahora.** Ni la llave ni la tabla de grupos muestran día/hora/cancha mientras esos datos todavía no están confirmados. Es una bandera (`SHOW_SCHEDULE_IN_POSTER` en `lib/bracketLayout.js`) que se puede volver a activar apenas estén listos, sin tener que rehacer nada. No toqué el póster por día (el de "Cronograma"), porque ese documento es justamente el horario -- ocultarlo ahí lo dejaría vacío.

## Aplicadas (tanda 18)

23. **Fix: la primera ronda de la llave quedaba fuera de la hoja cuando había muchos equipos.** El póster tenía un ancho fijo (1400px); con muchas rondas (16+ equipos) la llave necesitaba más ancho que eso, y al centrarla la ronda 1 quedaba en una posición negativa -- literalmente fuera del dibujo, ilegible (afectaba tanto al PDF como al SVG, y también se veía así en pantalla). Ahora el ancho del póster crece para siempre poder contener la llave completa. Para categorías chicas (hasta 16 equipos aprox.) el póster queda exactamente igual que antes.
    - Probado con 8/16/32/64 equipos: antes, 32 equipos ya rompía (ronda 1 en x=-50); ahora entra siempre con margen (x=80 con 32 equipos, x=80 con 64), y 8/16 equipos no cambian ni un píxel.

## Aplicadas (tanda 19)

24. **Logo oficial incrustado en el póster de cada categoría (PDF y SVG).** Aparece como marca de agua grande y tenue (6% de opacidad) detrás de todo, y chico a color normal arriba a la izquierda del encabezado, junto al título. El logo queda soldado dentro del propio archivo (no es una imagen enlazada aparte), así que el SVG descargado sigue sirviendo para imprenta sin depender de internet ni de que el archivo original esté al lado.
    - Verificado renderizado real en el navegador (no solo que compile): el logo se ve completo y sin roturas, tanto la marca de agua como la versión chica del encabezado, junto con la ronda 1 ya visible del fix anterior.
25. **El Excel del Fixture ahora sirve para cargar resultados.** La hoja "Listado" separa "Equipo A"/"Equipo B" (antes era una sola columna "Partido") y suma "Resultado" y "Ganador" en blanco, listas para completar a mano y después cargar en la página pública del evento. Ya se podía filtrar por disciplina y categoría antes de descargar (para bajar "por disciplina y actividad"); ahora, si hay un filtro activo, el nombre del archivo también sale con ese nombre (ej. "voley-fem.xlsx") en vez del genérico, para no pisar descargas de distintas categorías.

## Aplicadas (tanda 20)

26. **Solo el isologo (el escudo, sin texto) en el encabezado y la marca de agua del póster.** Antes iba el logo completo (escudo + "Jornadas Deportivas Interdepartamentales" + "Necochea"), redundante con el texto que el póster ya trae en su propio encabezado. Ahora: el escudo solo, a cada lado del encabezado (izquierda y derecha), y el escudo solo como marca de agua. Se recortó del archivo original midiendo el recuadro real con el navegador (no a ojo), y queda igual de autocontenido que antes -- sirve para imprenta sin depender de nada externo.
    - Verificado renderizado real: las tres copias (header izquierda, header derecha, marca de agua) muestran la misma forma completa del escudo, sin roturas ni recortes.

## Aplicadas (tanda 21)

27. **El cabeza de serie queda en la zona de 4, no en la de 3.** Cuando el armado de zonas da tamaños mixtos (ej. 3 zonas de 4 y 1 de 3), antes el algoritmo de reparto podía mandar al primero de la siembra justo a la zona chica -- ahora las zonas grandes se llenan primero, así el cabeza de serie siempre cae en una de esas.
    - Probado con 7 combinaciones de cantidad de equipos/tamaño de zona (incluyendo casos borde): el cabeza de serie siempre termina en la zona más grande, y los totales cierran bien.
28. **Nueva forma de dividir Copa Oro/Plata: según la siembra de Antecedentes**, no según el resultado de este año. Los equipos que están cargados como cabezas de serie (ej. los 6 preclasificados del año anterior) van a Copa de Oro; el resto de los inscriptos, a Copa de Plata. Aparece como botón nuevo "Dividir según siembra (Antecedentes)" en Inscripciones, al lado del botón manual existente (que sigue disponible para cuando la Comisión decide a criterio). Trabaja por equipo puntual, no por toda la departamental, por si alguna vez hay más de un equipo de la misma departamental y solo uno está en la siembra.
29. **Se puede cargar hasta el 3er puesto de cada grupo** en las disciplinas alcanzadas por Copa Oro/Plata (Fútbol 11, Fútbol Reducido, Básquet, Vóley, Hockey), aunque la modalidad no tenga playoff o el playoff solo clasifique a los 2 primeros. Antes solo se podía cargar hasta donde llegaba "Clasifican por grupo".
30. **Espacio para escribir los dos nombres en las llaves de pareja** (Tenis/Tenis de Mesa Dobles, Truco/Canasta/Generala/Burako Parejas). El casillero de la llave se agranda y agrega dos líneas punteadas por lado, para completar a mano los nombres de los dos integrantes de la pareja -- antes solo había lugar para una línea con el nombre de la departamental. Se detecta por el nombre de la categoría (si dice "Pareja" o "Dobles"); no toca las llaves de equipo completo (Vóley, Básquet, etc.) ni las individuales (Ajedrez, Singles).
    - Verificado renderizado real en el navegador: se ve "Necochea 1"/"Tandil 1" con dos líneas en blanco cada uno, con espacio claro para escribir.

## Aplicadas (tanda 22)

31. **La semifinal/final del playoff ya no queda con BYE cuando los clasificados directos no cierran en 4/8/16.** Caso típico: 3 grupos con 1 clasificado cada uno son 3 equipos, no alcanza para una semifinal completa. Ahora, en Sorteo, cuando pasa esto aparece un panel "Completar la llave" con los candidatos del puesto siguiente (ej. los segundos de cada grupo) que ya tengan ese puesto cargado -- se eligen a mano tantos como falten (ej. "el mejor segundo"), y recién con esa elección completa se puede generar la llave de playoff. El botón queda deshabilitado hasta que la cantidad elegida sea exactamente la necesaria.
    - Probado: 3 grupos/1 clasificado necesita exactamente 1 extra; con esa elección la semifinal sale con 2 partidos completos, cero BYE; validación de "faltan"/"sobran" elegidos correcta; casos que ya cerraban en potencia de 2 no piden nada extra.

## Aplicadas (tanda 23)

32. **La llave del playoff sale completa desde el sorteo inicial, con "Mejor 2do puesto" en vez de BYE.** El BYE salía de un segundo lugar donde también se arma el playoff (al sortear los grupos, con códigos "1A"/"1B"/"1C", antes de cargar resultados) que la corrección anterior no cubría. Ahora, si los clasificados directos no cierran en una llave completa, el/los lugar(es) que faltan se completan con un comodín de texto ("Mejor 2do puesto", o "Mejor 2do puesto #1"/"#2" si hace falta más de uno) -- mismo espíritu que "1A"/"1B", una llave completa y legible desde el principio. En Sorteo, el panel "Completar la llave" deja elegir quién es realmente ese comodín (entre los candidatos que ya tengan ese puesto cargado), y al tildarlo se reemplaza solo en la llave, sin tocar el día/hora/cancha ya asignados -- mismo mecanismo que ya resuelve "1A" al cargar el 1er puesto de un grupo.
    - Si ya tenías una llave con BYE de este tipo (como la de la captura), hay que volver a sortear esa categoría puntual (o resetearla) para que salga con el comodín en vez del BYE viejo.
    - Límite conocido: si destildás un comodín ya reemplazado y elegís otro distinto, puede no reemplazarse solo (el texto viejo ya no está para buscarlo) -- en ese caso reprogramá ese partido a mano desde "Fixture y conflictos".

## Aplicadas (tanda 24)

33. **En TODAS las disciplinas, dos equipos/parejas/singles de la misma departamental quedan en mitades OPUESTAS de la llave**, para que lo más pronto que puedan cruzarse sea la final -- reemplaza a la regla anterior (que solo evitaba el cruce directo en ronda 1) como único criterio, ya no hace falta distinguir por disciplina. Aplica a la llave directa y a la llave de playoff (inicial y al regenerarla). Si es posible, se hace bien (probado en 20 sorteos con orden aleatorio, todos separados); con 3+ entradas de la misma departamental en un espacio para 2 por mitad, hace lo mejor que puede.

## Aplicadas (tanda 25)

34. **Excepción para dividir en Copa Oro/Plata sin llegar a 12 equipos.** El mínimo del reglamento sigue disparando el aviso automático igual que antes (Fútbol 11 ya estaba en la lista de disciplinas alcanzadas, junto con Fútbol Reducido, Básquet, Vóley y Hockey -- no hacía falta agregarlo). Ahora, para una categoría de esas disciplinas que todavía no llegó al mínimo, aparece un link chico "¿Dividir igual, como excepción?" que abre los mismos dos métodos (por siembra o a mano) sin el mínimo de por medio -- para cuando la Comisión decide hacer una excepción puntual.

## Aplicadas (tanda 26)

35. **Fix de fondo a "mitades opuestas de la llave" (tanda 24): seguía fallando en algunos casos.** El método anterior armaba la llave con el orden de siembra de siempre y después iba corrigiendo a los empujones (intercambiando de a una entrada) cada vez que encontraba dos de la misma departamental juntas en una mitad -- el problema es que arreglar una departamental podía desacomodar a otra que ya estaba bien corregida, y quedar yendo y viniendo sin terminar de resolverse (pasaba más seguido cuantas más departamentales tenían exactamente 2 equipos/parejas cada una, sin ningún "comodín" suelto con el que intercambiar sin romper nada). Se reemplazó por un método que arma las dos mitades directo: a cada departamental se le reparte la mitad de sus entradas a la izquierda y la mitad a la derecha desde el vamos (sin intercambios ni correcciones posteriores), así no hay con qué desacomodarse. Dentro de cada mitad se mantiene el orden de siembra original, para no perder el resto del armado de cabezas de serie.
    - Probado con 10.000 sorteos aleatorios (incluyendo a propósito el peor caso: todas las departamentales con exactamente 2 entradas y cero comodines, que es el que rompía el método anterior) sobre la función real del sistema: cero fallas.
    - **Las categorías que ya se sortearon con el método viejo (tanda 24) pueden tener quedado mal separadas** -- hay que resetear y volver a sortear esas categorías puntuales para que se arme con el método nuevo.

## Aplicadas (tanda 27)

36. **Fix al fix de la tanda 26: dos BYE quedaban enfrentados entre sí.** Al armar las dos mitades de la llave directo (en vez de a los empujones), los huecos vacíos (BYE, cuando sobran lugares en la llave respecto a la cantidad de equipos) se amontonaban todos juntos al final de cada mitad, en vez de repartirse de a uno por llave -- eso podía dejar una llave "BYE contra BYE" sin nadie que pase a la ronda siguiente, y esa ronda 2 quedaba vacía para siempre. Ahora, dentro de cada mitad, se llenan primero las llaves con 2 equipos reales y recién las que sobran (porque no alcanzan los equipos) se arman de a "1 equipo real + BYE" -- nunca dos BYE juntos, salvo el caso extremo e inevitable de que haya más huecos que llaves en toda la mitad.
    - Probado con 8.000 sorteos aleatorios sobre la función real del sistema (variando cantidad de departamentales y de entradas por departamental, con y sin BYE): cero llaves "BYE contra BYE" evitables, y la separación de departamentales en mitades opuestas (tanda 26) se sigue cumpliendo igual.
    - **Las categorías que ya se sortearon con el método de la tanda 26 (el de ayer) pueden tener quedado con este problema** -- hay que resetear y volver a sortear esas categorías puntuales.

## Aplicadas (tanda 28)

37. **Nuevo botón "Resortear horarios"** en Sorteo, al lado de "Volver a sortear" (aparece solo si la categoría ya está sorteada). A diferencia de "Volver a sortear" -- que rehace todo desde cero (grupos, llave y horarios) -- este mantiene los grupos y la llave de playoff tal cual quedaron armados, y solo vuelve a decidir día/hora/cancha de los partidos. En las categorías con fase de grupos, además rebaraja al azar el orden de enfrentamientos DENTRO de cada grupo (quién juega primero contra quién en la "ronda 1", "ronda 2", etc.), sin mover a nadie de grupo ni tocar la llave de playoff (los cruces "1A"/"2B" no dependen del orden interno del grupo, así que esa llave sigue siendo la misma, solo se le recalculan los horarios).
    - Se bloquea (con aviso) si la categoría todavía no fue sorteada, o si ya tiene algún resultado cargado -- rebarajar el orden del grupo después de cargar resultados dejaría esos resultados sin el partido real al que correspondían.
    - No aplica a disciplinas individuales/cronometradas (no tienen partido con horario propio) ni a Póker (arma sus mesas en una sola tanda, sin variación de horario que resortear).

## Aplicadas (tanda 29)

38. **Se puede modificar o asignar día/hora/cancha a mano desde el Fixture general**, no solo en los partidos marcados como conflicto. Cada fila de la lista de partidos (Fixture y conflictos) tiene ahora su propio botón "Reprogramar este partido".
39. **Los partidos que el sorteo no pudo programar (quedaban invisibles) ahora aparecen.** Si al sortear no queda ningún horario libre para un partido (por ejemplo, falta configurar sedes/ventanas horarias de esa disciplina), antes ese partido no aparecía en ningún lado del Fixture -- no había forma de verlo ni de asignarle un horario. Ahora aparece arriba de todo en "Fixture y conflictos", en un panel aparte ("Partidos sin horario asignado"), con un botón para asignarle día/hora/cancha por primera vez.

## Aplicadas (tanda 30)

40. **Aviso de superposición ANTES de guardar al reprogramar un partido a mano.** El control "Reprogramar este partido" ahora chequea en el momento (sin guardar nada todavía) si el día/hora/cancha elegido pisa otro partido -- por departamental/persona compartida, por restricción horaria cargada, o por dos partidos de la misma disciplina usando la misma cancha al mismo tiempo. Si hay algún problema, aparece un ícono de alerta con la cantidad; al tocarlo se despliega el detalle (con quién se pisa y por qué) y un botón para editar ESE OTRO partido ahí mismo, sin salir de la pantalla. "Guardar" igual deja confirmar el cambio -- si hay superposiciones, antes pide confirmar con el resumen de qué se está por generar.
41. **Golf, Tiro, Maratón, Natación y Patín de Carrera ya no marcan superposición por toda la departamental, solo por persona.** Antes, cualquier partido de un deporte de equipo se marcaba como "en conflicto" si alguien de la MISMA departamental (sin importar quién) estaba anotado en una de estas disciplinas individuales a la misma hora -- daba muchos falsos positivos (quien juega al básquet no tiene nada que ver con que otro vecino suyo esté corriendo la maratón). Ahora se compara por las personas realmente anotadas en cada cosa; si no se puede saber con certeza, no se marca un conflicto que puede no ser real. Travesía 4x4 y Pesca siguen totalmente excluidas de cualquier chequeo de superposición (sin cambios ahí).

## Aplicadas (tanda 31)

42. **Los conflictos/restricciones/partidos sin horario aparecen plegados por defecto.** En "Fixture y conflictos", cada fila de los tres paneles (partidos sin horario, restricciones violadas, superposiciones) ahora muestra solo un renglón resumen; al tocarlo se despliega el detalle completo y los botones de acción (Reprogramar, Autoresolver, Seguir igual). Antes todo aparecía siempre expandido, y con muchos conflictos la pantalla era una pared de texto.
43. **Imprimir / exportar a PDF el Fixture general, con o sin horario.** Dos botones nuevos ("Con horario" / "Sin horario") al lado de "Descargar Excel" abren el diálogo de impresión del navegador (desde ahí, "Guardar como PDF", mismo mecanismo que ya usan los pósters) con la lista de partidos ya filtrada tal como está en pantalla. "Sin horario" oculta las columnas de día/hora/cancha -- para repartir el cruce de partidos sin revelar todavía el horario.

## Aplicadas (tanda 32)

44. **Cada partido ahora guarda su propia sede, no la adivina por el día.** Hasta ahora, la columna "Sede" del Fixture/Excel/pósters no estaba guardada en el partido -- se adivinaba mirando la PRIMERA sede configurada para esa disciplina en ese día. Si una disciplina usa dos sedes el mismo día (ej. Rivadavia a la mañana y Nacional al mediodía), todos los partidos de ese día mostraban la misma sede, aunque la mitad se jugaran en la otra. Ahora cada partido guarda la sede real que le tocó al sortear (o reprogramar), así que el Fixture, el Excel y los pósters muestran la sede correcta de cada uno. Los partidos ya sorteados ANTES de este cambio siguen mostrando la sede "adivinada" (de respaldo) hasta que se vuelvan a sortear o reprogramar.
    - El control "Reprogramar este partido" (en Fixture y conflictos) ahora tiene también un campo "Lugar/sede" para editarlo a mano.
    - **Requiere un cambio chico en la base de datos** -- ver instrucción SQL más abajo.

## Aplicadas (tanda 33)

45. **"Resortear horarios" ahora deja elegir si rebaraja el orden interno del grupo o no.** Checkbox nuevo "Rebarajar también el orden dentro de los grupos" (tildado por default, mismo comportamiento de antes) al lado del botón, visible en categorías con fase de grupos. Destildado, reutiliza los partidos de grupo EXACTAMENTE como están (mismo enfrentamiento, mismo orden) y solo les recalcula día/hora/cancha/sede -- para cuando ese orden también quedó acordado con los delegados, no solo los grupos.

## Aplicadas (tanda 34)

46. **El póster de cada categoría (PDF y SVG) vuelve a mostrar día/hora/cancha/sede.** Se había ocultado a propósito en la tanda 22 porque en ese momento el sorteo todavía no asignaba horarios reales (era la bandera `SHOW_SCHEDULE_IN_POSTER`, pensada justamente para reactivarse sin tener que rehacer nada apenas estuviera listo). Ahora que el sorteo ya arma el horario completo (y, desde la tanda 32, también la sede real de cada partido), se reactivó: la tabla de grupos y las llaves del póster muestran día/hora/cancha, y ahora también la sede cuando está cargada (ej. "1 - Rivadavia").
    - Verificado con datos de prueba renderizados en el navegador: la tabla de grupos y la llave de playoff muestran día/hora/cancha/sede correctamente, sin superposición de textos.

## Aplicadas (tanda 35)

47. **Nuevo selector "Reservar día solo para semifinal/final"** en Sorteo, para categorías "Grupos + playoff". Al elegir un día, la fase de grupos queda prohibida de usarlo (ni al sortear ni al "Resortear horarios") -- los partidos de zona se reparten solo entre los demás días, y el playoff (semifinal/final) sigue pudiendo usar cualquier día, incluido el reservado. Pensado para el caso real: 2 zonas de 4 equipos jugando viernes/sábado, con el domingo reservado para semifinal y final -- antes, si faltaba una sede configurada algún día, el sorteo podía terminar metiendo partidos de zona el domingo (o dejando la última ronda sin horario) sin avisar bien por qué.
    - Si después de reservar el día, la fase de grupos no entra en los días que quedan (por ejemplo, porque falta configurar una sede en alguno de ellos), esos partidos van a aparecer en el panel "Partidos sin horario asignado" (Fixture y conflictos) en vez de colarse en el día reservado -- es la señal de que falta ampliar las sedes/horarios de los días permitidos, no de que el sistema esté fallando.
    - Verificado con un test de la función real: con el día reservado, la fase de grupos nunca usa ese día (en el caso probado, usa el único otro día configurado hasta agotar su capacidad y deja el resto sin asignar, en vez de invadir el día reservado).
    - **Requiere un cambio chico en la base de datos** -- ver instrucción SQL más abajo.

## Aplicadas (tanda 36)

48. **Fix: con "Reservar día solo para semifinal/final", la semifinal se seguía jugando otro día.** La corrección anterior solo evitaba que la fase de GRUPOS usara ese día; el playoff seguía usando cualquier día disponible y, si sobraba lugar antes del día reservado (ej. el sábado a la noche, apenas termina la fase de grupos), la semifinal arrancaba ahí en vez de esperar al día reservado. Ahora el playoff (semifinal Y final) queda obligado a programarse SOLO en el día reservado -- si ese día no alcanza para todas las rondas del playoff, los partidos que no entran quedan sin horario asignado (visibles en el panel correspondiente) en vez de usar otro día.
    - Aplica tanto al sorteo normal como a "Resortear horarios" y a la regeneración de la llave al cargar posiciones de grupo ("Completar la llave").
    - Verificado con la función real: semifinales y final quedan las tres en el día reservado, nunca antes.
    - **Las categorías que ya tenían esto mal programado** (semifinal en otro día) necesitan volver a sortear su playoff -- desde Sorteo, "Resortear horarios" (si los grupos ya están consolidados) o regenerar el playoff.

## Notas / limitaciones conocidas

- Las restricciones **individuales por persona** se guardan bien, pero todavía **no se aplican solas** al sortear ni al autoresolver (solo las de departamental y equipo). Pendiente de decidir si se construye.
- Las restricciones de **equipo** ahora se eligen por equipo Y categoría (el desplegable agrupa por categoría) y valen solo para esa categoría. Se guardan como `Nombre::idCategoria` en `team_label`. Las que se cargaron antes (solo nombre) siguen valiendo para ese nombre en cualquier categoría.
- El botón manual **"Reprogramar este partido"** no valida el orden de las rondas: quien reprograma a mano decide el horario.
