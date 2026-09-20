# Malla Recorrida, la hoja de ruta del día

Variante B de tres maquetas navegables del proyecto **Malla**, trabajo final de grado de
Ingeniería en Informática, Universidad del CEMA.

**Ver la maqueta: https://luciofex.github.io/malla-recorrida/**

Las otras dos variantes:

- [malla-gis](https://github.com/LucioFex/malla-gis), el visor de capas
- [malla-tablero](https://github.com/LucioFex/malla-tablero), el tablero de gestión

## Qué problema resuelve

Hoy la cuadrilla recibe un listado por localidad y lo recorre de arriba hacia abajo. Esta
variante reemplaza ese listado, que es el proceso que el sistema viene a cambiar.

## Por qué no es un problema del viajante

La cuadrilla nunca llega a todo. No hay que visitar todos los nodos sino elegir el mejor
subconjunto que entra en la jornada, maximizando el riesgo cubierto. Eso es un **problema
de orientación**, o ruteo con premios, no un problema del viajante.

En la maqueta se resuelve con una heurística golosa más dos opt, que corre en el navegador
en milisegundos. En el sistema final se resuelve con OR-Tools.

```
premio de cada tramo  = su criticidad
costo                 = tiempo de viaje entre tramos + tiempo de inspección
restricción           = las horas de la jornada
```

## Qué hace esta variante

- Hoja de ruta ordenada, con horarios de llegada y salida por parada.
- Control de horas de jornada, de 4 a 10, que recalcula en vivo qué entra y qué queda
  afuera.
- De una a tres cuadrillas, cada una con su color y su recorrido.
- Mapa con la traza del día sobre la red apagada, para que la recorrida sea lo único que
  se lee.
- **Comparación contra el criterio actual.** Con las mismas horas de cuadrilla, se simula
  la lista alfabética recorrida de arriba hacia abajo y se mide cuánto riesgo cubre cada
  una. Ese número es el que sostiene todo el trabajo.
- Selector entre Bahía Blanca y Tandil.

## Qué dato es real y qué dato es de muestra

Esto está declarado también dentro de la maqueta, porque un tribunal va a preguntar.

**Real**

| Dato | Fuente | Licencia |
|---|---|---|
| Traza de calles | OpenStreetMap, vía Overpass | ODbL 1.0 |
| Receptores sensibles | OpenStreetMap | ODbL 1.0 |
| Reclamos resueltos 2018 a 2026 | ENARGAS, portal de transparencia | CC BY 4.0 |

**De muestra, generado de forma determinista**

- Hogares aguas abajo de cada tramo.
- Material, diámetro y antigüedad del caño.
- Fecha de última inspección.

**Supuestos del ruteo, declarados**

- Velocidad media en calle urbana de 21 km/h, con un factor de 1,32 sobre la distancia en
  línea recta para aproximar el trazado real.
- Tiempo de inspección de 11 minutos por tramo más 1,6 minutos por cada 100 metros.
- Salida y regreso a una base operativa única, ubicada en el centro de la ciudad.

En el sistema final los tiempos de viaje salen de la matriz de Google Maps Platform, no
de una estimación en línea recta.

## Cómo está hecho

Sin compilación y sin dependencias que haya que instalar.

```
index.html            estructura
estilo.css            sistema visual compartido por las tres variantes
recorrida.css         lo propio de esta variante
app.js                optimizador, comparación y hoja de ruta
datos/malla-datos.js  la capa de tramos ya calculada
```

Leaflet desde CDN para el mapa. El resto es JavaScript sin framework.

Para verlo en local alcanza con servir la carpeta:

```
python -m http.server 8777
```

## Créditos de datos

- Callejero y receptores sensibles: © colaboradores de OpenStreetMap, ODbL 1.0.
- Reclamos resueltos por distribuidora: ENARGAS, portal de transparencia, CC BY 4.0.
- Radios censales previstos para la etapa siguiente: INDEC, censo 2022.

## Licencia

Código bajo licencia MIT. Los datos conservan la licencia de su fuente.
