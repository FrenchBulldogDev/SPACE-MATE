# Requisitos de SPACE-MATE

Fecha de referencia: 15 de noviembre de 2026.

Este documento reúne los requisitos funcionales, científicos y técnicos del proyecto. Las dependencias instalables se definen en `package.json` y sus versiones resueltas en `package-lock.json`.

## 1. Objetivo y alcance

La aplicación debe permitir explorar el sistema Tierra–Luna en 3D, seleccionar un sitio de lanzamiento y consultar posibles sitios de aterrizaje para un mes y un día UTC. Debe mostrar datos calculados con procedencia y distinguir las estimaciones educativas de las ventanas operativas de una misión.

**Restricción principal: las mejoras de rendimiento no deben sacrificar precisión matemática ni física dentro del modelo existente.** Deben conservar las ecuaciones, resoluciones, tolerancias, criterios de aceptación y tratamiento de datos desconocidos. Esto no elimina las limitaciones físicas del modelo, que deben seguir siendo explícitas.

## 2. Entorno de ejecución

| Requisito | Especificación |
| --- | --- |
| Runtime | Node.js 22 o superior y npm compatible. |
| Navegador | JavaScript y WebGL disponibles; soporte para controles de ratón, teclado y pantalla táctil. |
| Backend | Servidor Node con las APIs del proyecto en el mismo origen que la interfaz. Un hosting exclusivamente estático no cubre las funciones científicas. |
| Red | Acceso HTTPS saliente a NASA/JPL Horizons y NASA Moon Trek cuando los datos requeridos no estén disponibles en caché. Las fuentes polares adicionales están documentadas en `SCIENCE_LAYERS.md`. |
| Almacenamiento | Permisos de lectura para los assets y de escritura para las cachés científicas en `data/`. |
| Assets | Conservar modelos, texturas, imágenes, iconos, preguntas y fuentes locales con los nombres utilizados por el código. |
| Hardware | Dispositivo capaz de ejecutar el visor WebGL. No se establece una cifra mínima de RAM o GPU sin mediciones que la justifiquen. |

### Dependencias principales declaradas

| Paquete | Versión declarada | Uso |
| --- | --- | --- |
| `react`, `react-dom` | `^19.0.0` | Interfaz. |
| `three` | `^0.180.0` | Escena 3D. |
| `three-mesh-bvh` | `^0.9.18` | Búsqueda de intersecciones con el terreno. |
| `geotiff` | `^3.0.5` | Lectura de elevaciones y rasters científicos. |
| `lucide-react` | `^0.468.0` | Iconos de interfaz. |
| `typescript` | `^5.7.3` | Tipado y comprobación del código. |
| `vite` | `^6.1.0` | Desarrollo y compilación. |
| `@vitejs/plugin-react` | `^4.3.4` | Integración de React con Vite. |
| `tsx` | `^4.19.2` | Ejecución del servidor, scripts y pruebas TypeScript. |

Las definiciones de tipos adicionales están en `devDependencies`. La instalación reproducible debe utilizar el archivo de bloqueo existente.

### Comandos

```sh
# Instalar las dependencias fijadas por el archivo de bloqueo
npm ci

# Desarrollo: http://127.0.0.1:5173
npm run dev

# Validación
npm test
npm run build

# Servir la compilación con sus APIs: http://127.0.0.1:4173
npm start
```

`npm start` requiere una compilación previa y el runtime `tsx` disponible. El servidor permite configurar `HOST` y `PORT`. La publicación debe utilizar HTTPS y las cabeceras de seguridad del proyecto.

## 3. Requisitos funcionales

| ID | Requisito |
| --- | --- |
| RF-01 | Conservar la portada, identidad SPACE-MATE, contenido del equipo y lema `ad astra per aspera`. |
| RF-02 | Ofrecer los modos Público general y Público especializado. La compresión visual del primero no debe modificar los cálculos físicos. |
| RF-03 | Permitir orbitar, desplazar y acercar la cámara; centrar Tierra, Luna o sistema; pausar, reanudar, cambiar velocidad y mostrar u ocultar la órbita. El arrastre no debe rotar manualmente los astros. |
| RF-04 | Seleccionar un centro del catálogo o introducir coordenadas terrestres y altura válidas. Admitir los formatos decimales y DMS soportados por el parser. |
| RF-05 | Seleccionar aterrizaje mediante año, mes y día UTC, entre febrero de 1962 y diciembre de 2100. Mantener año y mes disponibles durante la carga. |
| RF-06 | Calcular el mes elegido, mostrar progreso y distinguir los estados de carga, error, finalización y ausencia de candidatos. |
| RF-07 | Habilitar únicamente los días con candidatos aceptados; los huecos entre días válidos deben permanecer bloqueados. |
| RF-08 | Cancelar o liberar el trabajo anterior al cambiar de período o abandonar la sesión, sin borrar los datos fuente conservados en disco. |
| RF-09 | Avisar mediante un pop-up cuando termine el informe mensual. El aviso debe invitar a elegir una fecha, permitir cerrarlo y enfocar el selector de días al solicitarlo. Un informe vacío debe explicar que no hay sitios aceptados. |
| RF-10 | Representar la unión mensual de coordenadas calculadas con pequeños puntos celestes, sin crear una imagen Spacey por sitio. |
| RF-11 | Al elegir un día, mostrar `Assets/Spacy with flag.png` en sus sitios calculados. Agrupar solamente las coordenadas exactamente iguales; conservar los refinamientos cercanos como sitios distintos. |
| RF-12 | Al pulsar un sitio, seleccionar su llegada, pausar y centrar el visor y abrir una ficha conectada visualmente con su coordenada lunar. |
| RF-13 | La ficha debe seguir la proyección del sitio, ocultarse detrás de la Luna o fuera de una vista útil, adaptarse a pantallas estrechas y permitir cierre con Escape y recuperación del foco. |
| RF-14 | Mostrar en la ficha potencial solar, visibilidad terrestre directa, separación geométrica, tiempos de vuelo y llegada, ventana conjunta, incertidumbres y fuente del terreno. Un dato ausente debe indicarse como no disponible. |
| RF-15 | Usar `Assets/Bolt.png` para energía, `Assets/Earth visibility.png` para visibilidad y `Assets/Travel distance.png` para distancia. Conservar la procedencia de los iconos generados. |
| RF-16 | Mantener en el lateral el progreso, resumen e informe descargable, sin duplicar allí las fichas individuales de los sitios calculados. |
| RF-17 | Ocultar Spacey y la nube celeste al activar la capa de potencial de energía, dejando sus marcas cuantitativas de color visibles. Pulsar una marca debe abrir la llegada que produjo su valor. |
| RF-18 | Conservar las banderas, selector y fichas de los sitios históricos, diferenciando los datos históricos de las condiciones calculadas para el instante elegido. |
| RF-19 | Ofrecer capas de potencial solar y madurez óptica OMAT. Reservar las capas térmica y de polvo para el modo especializado y datos importados válidos. |
| RF-20 | Permitir minimizar las capas sin perder selección, opacidad ni datos, y conservar el asistente Spacey local con sus respuestas y controles traducidos. |
| RF-21 | Mantener el quiz de 23 preguntas e imágenes durante la espera, con corrección, puntuación y avance de sesión, sin detener el análisis. |
| RF-22 | Ofrecer español, inglés, francés, portugués e italiano. Cambiar idioma debe conservar la configuración de la misión. |
| RF-23 | Permitir descargar el informe completo en JSON, conservando valores numéricos, unidades, fuentes y limitaciones. |

## 4. Requisitos científicos

| ID | Requisito |
| --- | --- |
| RC-01 | Utilizar efemérides reales NASA/JPL Horizons. La trayectoria lunar debe referirse al centro terrestre `500@399`, con estados geométricos en ICRF y conversión consistente a unidades SI. |
| RC-02 | Compartir entre cálculos y visor los marcos terrestres y lunares derivados de JPL. No inventar una orientación cuando falten los datos necesarios. |
| RC-03 | Conservar la interpolación con posiciones y velocidades, la búsqueda continua de mínimos geométricos y sus tolerancias numéricas. No reemplazarlas por una órbita sintética o una selección de muestras más dispersas para ganar velocidad. |
| RC-04 | Cubrir el mes civil completo y los diez días previos de salidas, verificando que el margen sea suficiente. Aceptar llegadas desde el inicio del mes inclusive hasta el inicio del siguiente exclusivo. |
| RC-05 | Mantener el barrido global de 10° con refinamientos locales. Presentarlo como muestreo de sitios, no como certificación exhaustiva de la superficie lunar. |
| RC-06 | Utilizar el DEM numérico LOLA local de aproximadamente 237 m y las envolventes del relieve global existentes. Conservar los estados despejado, bloqueado y desconocido; la cobertura no resuelta nunca debe contar como despejada. |
| RC-07 | Conservar el muestreo de visibilidad de 30 minutos, el umbral conservador solar y los eclipses. Mantener el criterio de aceptación de más de 24,5 horas iniciales conjuntas en la implementación actual. |
| RC-08 | Evaluar cada llegada durante un mes sinódico medio completo de 29,530589 días. No sustituirlo por el mes sidéreo para acortar el cálculo. |
| RC-09 | Integrar el potencial solar mediante incidencia y distancia al Sol, con límites separados para muestras desconocidas. Las horas solares equivalentes no deben presentarse como kWh eléctricos ni como energía garantizada de un equipo. |
| RC-10 | Identificar el tiempo de vuelo como estimación empírica histórica. `travelDistanceMeters` debe representar la separación geométrica usada por ese modelo, no una longitud de trayectoria de transferencia resuelta. |
| RC-11 | Mantener la procedencia e integridad de los productos OMAT y separar las escalas de calibración ecuatorial y polar. No rellenar regiones sin datos ni confundir madurez óptica con edad absoluta. |
| RC-12 | Exigir mediciones y calibraciones con procedencia para las capas térmica y de polvo. Rechazar entradas inválidas y evitar parámetros o mediciones ficticias. |
| RC-13 | Declarar los límites del modelo: visibilidad geométrica sin presupuesto de enlace, oportunidad solar sin balance eléctrico y ausencia de certificación operativa de aterrizaje. |

## 5. Rendimiento y recursos

- Optimizar mediante reutilización, cachés, estructuras de búsqueda y evaluación diferida, conservando la semántica científica.
- Verificar la equivalencia de candidatos y valores científicos con datos de entrada idénticos. Documentar por separado cualquier ampliación del esquema del informe.
- Representar los puntos mensuales con una geometría y un único objeto `Points`, compartiendo una textura circular pequeña. El tamaño actual es 3,5 px.
- Limitar la carga adelantada de terreno a tres solicitudes y respetar su orden de evaluación, cancelación y tratamiento individual de errores.
- Liberar geometrías, materiales, texturas, observadores y solicitudes al cambiar o desmontar la escena.
- Mantener el visor y las consultas de progreso utilizables durante el análisis.
- Medir las mejoras con condiciones comparables, separando inicialización, red y cálculo. Los resultados de un ensayo reducido no deben generalizarse al barrido global.
- No fijar un tiempo máximo universal de cálculo sin un entorno y un volumen de datos de referencia.

## 6. Datos, privacidad y seguridad

- Servir assets y fuentes desde el propio origen; no añadir analítica, publicidad ni rastreo.
- Guardar la preferencia de idioma sólo tras una elección explícita, con caducidad de 180 días y borrado independiente de otros datos del navegador.
- Mantener el asistente y las respuestas del quiz en la sesión, sin transmitirlos ni persistirlos.
- No enviar las coordenadas terrestres personalizadas a NASA/JPL. Su uso en el backend y la posible aparición en logs deben explicarse en la información de privacidad.
- Mantener temporales los datasets e informes mensuales del explorador. Conservar los DEM y las fuentes previamente guardadas; las descargas y los diagnósticos explícitos son operaciones separadas.
- Conservar consultas, metadatos y huellas de los productos científicos persistentes para permitir su trazabilidad.
- Invalidar las claves de caché cuando cambie el modelo o cuando sea necesario regenerar campos requeridos de los informes; manejar de forma explícita los datos ausentes en informes anteriores.
- Validar parámetros de API y archivos importados. Las rutas científicas no deben convertirse en un proxy abierto.
- Aplicar CSP y las demás cabeceras de `config/securityHeaders.ts`, con las excepciones de desarrollo limitadas a ese entorno.

## 7. Criterios de aceptación

| Comprobación | Resultado esperado |
| --- | --- |
| `npm test` | Todas las pruebas aplicables aprobadas. |
| `npm run build` | TypeScript y compilación de producción completados. |
| Regresión científica | Mismos candidatos y valores científicos al optimizar con entradas idénticas; cualquier cambio de modelo se documenta y valida de forma independiente. |
| Vista mensual | Cero imágenes Spacey por sitio; puntos celestes en coordenadas calculadas reales. |
| Finalización | Aviso una vez por informe, acceso al selector de fechas y mensaje específico si no hay candidatos. |
| Día seleccionado | Marcadores únicamente de ese día UTC y conservación de coordenadas distintas. |
| Selección de sitio | Ficha conectada al marcador con sus datos reales y tres iconos; cierre por teclado y comportamiento correcto al mover la cámara. |
| Capa de energía | Spacey oculto y correspondencia entre el punto coloreado y el candidato mostrado en la ficha. |
| Interfaz adaptable | Ficha utilizable en escritorio y pantalla estrecha, sin desbordamiento horizontal. |
| Fallos y cancelación | Sin resultados sintéticos, sin promoción de datos desconocidos y sin reutilización de resultados de otro mes o sitio. |

## 8. Fuera del alcance actual

No se exige un solucionador de trayectorias de transferencia, diseño de vehículo, cálculo de combustible, disponibilidad real de plataformas, red de repetidores, presupuesto de enlace o certificación del balance eléctrico. Tampoco una certificación de seguridad de alunizaje, conformidad legal o accesibilidad integral. Estas capacidades requieren modelos, datos y validaciones adicionales.

## 9. Referencias del repositorio

- [README.md](README.md): instalación, funcionamiento y alcance general.
- [SCIENCE_LAYERS.md](SCIENCE_LAYERS.md): ecuaciones, fuentes, unidades, calibraciones y límites de las capas científicas.
- [PRIVACY_REVIEW.md](PRIVACY_REVIEW.md): revisión técnica de privacidad y pendientes de publicación.
- [package.json](package.json) y [package-lock.json](package-lock.json): dependencias y comandos reproducibles.
- [Procedencia de iconos](Assets/landing-icons.provenance.json): herramienta y prompts utilizados para los nuevos iconos.

Cuando las notas históricas de la documentación difieran de los cambios actuales, deben contrastarse con el código y las pruebas antes de utilizarlas como referencia.
