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
- `src/App.tsx`: nombre, logo provisional y texto de quienes somos.
- `src/scene/math.ts`: órbita elíptica ilustrativa y conversiones.
- `src/scene/assets.ts`: carga, aislamiento y UV de assets.

Los assets están excluidos de Git por la configuración original. Deben permanecer en `Assets` con sus nombres actuales al compilar; Vite los empaqueta en la compilación.

## Alcance científico

La órbita es aproximada y las distancias están comprimidas. La relación de radios Tierra/Luna es proporcional. La fecha ajusta la fase de esta órbita; no proporciona efemérides exactas. La Tierra queda fija al inspeccionar un sitio seleccionado, mientras la Luna continúa orbitando. Limpiar el sitio restablece la rotación automática.

El catálogo es de referencia y no representa lanzamientos del día. La integración con una API y el backend científico/SPICE queda para la siguiente etapa.

El STL lunar suministrado contiene dos objetos separados. El cargador filtra el componente lejano en memoria, manteniendo intactos los archivos originales. Como STL no incluye UV, el cargador genera UV esféricos (Greenwich/lunar 0° en el centro de las texturas) y corrige la costura.
