# Moon Mission Browser

Interfaz web adaptativa en React, TypeScript y Three.js. Incluye portada con placeholders y un explorador 3D usando los STL y las texturas de `Assets`.

## Ejecutar

```sh
npm install
npm run dev
```

Abrir `http://127.0.0.1:5173`. `Start` abre el explorador. Se usa navegación hash (`#/explorer`) para funcionar también en hosting estático.

```sh
npm run build
npm run preview
npm test
```

## Interacciones

- Arrastrar un astro: gira sobre su eje. Arrastrar espacio vacío: orbita la cámara.
- Rueda: zoom al cuerpo debajo del cursor. En espacio vacío tiene prioridad el cuerpo más cercano a la cámara.
- Dos dedos: zoom. Botón derecho: desplazar cámara.
- Seleccionar sitio: marca la textura utilizando `Scripts/coordinates.ts`, coloca un pin y anima Tierra/cámara hacia el sitio.
- Coordenadas personalizadas: grados decimales o formato DMS compatible con el parser existente.
- Centrar Tierra, Luna o sistema; pausar, cambiar velocidad y alternar la órbita.
- Con el canvas enfocado: `+`/`-` para zoom, flechas para rotar y `Home` para vista general.

## Variables para editar

- `src/config.ts`: radios, distancia visual, inclinaciones, velocidades y catálogo inicial de sitios.
- `src/App.tsx`: estructura de las páginas y logo provisional.
- `src/i18n/translations.ts`: textos y placeholders en los seis idiomas.
- `public/earth-placeholder.svg`: imagen provisional del fondo de Inicio; puede sustituirse por tu imagen.
- `HOME_EARTH_IMAGE` en `src/config.ts`: ruta de la imagen de Inicio (para usar un JPG, PNG o WebP).
- `src/scene/math.ts`: órbita elíptica ilustrativa y conversiones.
- `src/scene/assets.ts`: carga, aislamiento y UV de assets.

Los assets están excluidos de Git por la configuración original. Deben permanecer en `Assets` con sus nombres actuales al compilar; Vite los empaqueta en la compilación.

## Idiomas

El selector del encabezado ofrece Español, Francés, Portugués, Italiano e Inglés, con los nombres de cada idioma en su propia lengua. La preferencia se guarda únicamente después de una selección explícita en `localStorage`, con la clave `moon-mission.language`, sin identificadores de usuario. Tiene una vigencia de 180 días; si caduca, se elimina en la siguiente visita. El panel «Privacidad y almacenamiento» permite borrarla conservando el idioma de la sesión actual. Si el almacenamiento no está disponible, la selección sigue funcionando durante la sesión. Cambiar de idioma no reinicia la escena ni borra la configuración de la misión.

## Privacidad y publicación

La fuente Public Sans se aloja en `public/fonts/`, junto con su licencia SIL OFL. No se utiliza Google Fonts desde el navegador. La aplicación actual no añade analítica, publicidad, cookies o integraciones externas. Sitios, coordenadas y fechas se mantienen solo en memoria.

`config/securityHeaders.ts` aplica CSP, Referrer-Policy, X-Content-Type-Options, X-Frame-Options y Permissions-Policy en Vite y en la vista previa. `public/_headers` contiene la política para proveedores compatibles; otros servidores necesitan configurar las mismas cabeceras. El servidor de desarrollo conserva las excepciones locales necesarias para HMR. No debe publicarse el servidor Vite de desarrollo.

El hosting definitivo requiere HTTPS, revisión de sus logs, cookies e integraciones, identificación del responsable y política de privacidad adaptada a su estado de EE. UU. y a sus públicos internacionales. La revisión técnica no constituye certificación legal ni conformidad completa WCAG. Consulta `PRIVACY_REVIEW.md`.

## Alcance científico

La órbita es aproximada y las distancias están comprimidas. La relación de radios Tierra/Luna es proporcional. La fecha ajusta la fase de esta órbita; no proporciona efemérides exactas. La Tierra queda fija al inspeccionar un sitio seleccionado, mientras la Luna continúa orbitando. Limpiar el sitio restablece la rotación automática.

El catálogo es de referencia y no representa lanzamientos del día. La integración con una API y el backend científico/SPICE queda para la siguiente etapa.

El STL lunar suministrado contiene dos objetos separados. El cargador filtra el componente lejano en memoria, manteniendo intactos los archivos originales. Como STL no incluye UV, el cargador genera UV esféricos (Greenwich/lunar 0° en el centro de las texturas) y corrige la costura.
