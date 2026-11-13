# Musicala Practice · Acompañamientos y Progresiones para Guitarra

Versión renovada del material de acompañamientos y progresiones.

## Qué incluye
- 37 ejercicios extraídos del Excel original.
- 37 imágenes de acompañamiento/tablatura preservadas fielmente.
- Búsqueda por acorde, género y número.
- Filtros por estado, favoritos, género y disponibilidad de video.
- Vista de práctica por ejercicio.
- Diagramas de acordes SVG generados por la app.
- Escucha sintetizada de acordes al tocarlos.
- Metrónomo configurable entre 45 y 180 BPM.
- Videos cargados solo bajo demanda.
- Progreso y favoritos guardados en localStorage.
- Tema oscuro/claro.
- PWA/offline al publicarlo por HTTPS (por ejemplo GitHub Pages).
- Responsive para celular, tablet y computador.

## Ejecutar
Puedes abrir `index.html` directamente. Para probar también el modo PWA/offline, levanta un servidor local:

```bash
python -m http.server 8000
```

Luego abre `http://localhost:8000`.

## Publicar en GitHub Pages
Reemplaza el contenido del repositorio actual por el contenido de esta carpeta. No necesita compilación ni dependencias.

## Auditoría del archivo fuente
- Ejercicios encontrados: 37.
- Numeración ausente en el original: [30].
- Progresión vacía en el original: [38].
- Ejercicios con video: 11.
- Ver `data/source-audit.json` para el detalle.

## Estructura
```
index.html
styles.css
js/data.js
js/app.js
assets/exercises/
data/source-audit.json
manifest.webmanifest
sw.js
```

## Actividad de bajo

- [Las mañanitas en bajo](./las-mananitas-bajo/index.html)
