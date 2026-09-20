/* Malla Recorrida, variante B.
   Reemplaza la lista de papel que hoy se recorre de arriba hacia abajo.
   La ruta no es un problema del viajante: la cuadrilla nunca llega a todo, asi que
   se elige el mejor subconjunto de tramos que entra en la jornada. Eso es un problema
   de orientacion, y aca se resuelve con una heuristica golosa mas dos opt.

   El calculo esta en motor.js, que es identico en el tablero. Las dos maquetas miden
   lo mismo de la misma manera, y por eso dan el mismo numero. */

(function () {
  "use strict";

  var D = window.MALLA;
  var MOTOR = window.MALLA_MOTOR;

  var COLOR_CUADRILLA = ["#7b1e2b", "#3d5a5f", "#8a6d2f"];

  var estado = {
    ciudad: "bahia_blanca",
    jornada: 8,
    cuadrillas: 2,
    activa: null,
    /* resultado de la inspeccion por tramo: "ok" o "hallazgo". Es lo que cierra el
       circuito, porque el dato vuelve por el mismo lugar por donde salio la hoja de ruta. */
    cierres: {}
  };

  var mapa, capaFondo, capaRuta, capaMarcas, marcadores = {};
  var plan = null;

  function num(n) { return Math.round(n).toLocaleString("es-AR"); }

  function hhmm(min) {
    var t = 8 * 60 + min;
    var h = Math.floor(t / 60), m = Math.round(t % 60);
    return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
  }

  /* El calculo vive en motor.js, que es la misma pieza que usa el tablero. Aca solo se
     le pide el plan y se lo dibuja. */

  function calcular() {
    var c = D.ciudades[estado.ciudad];
    var p = MOTOR.planificar(c, estado.cuadrillas, estado.jornada);

    plan = {
      base: p.base,
      equipos: p.malla.equipos,
      visitados: p.malla.tramos,
      riesgoTotal: p.riesgoTotal,
      riesgoMalla: p.malla.riesgo,
      riesgoActual: p.actual.riesgo,
      hogaresMalla: p.malla.hogares,
      hogaresActual: p.actual.hogares,
      paradasActual: p.actual.paradas
    };
  }

  /* ---------- mapa ---------- */

  function iniciarMapa() {
    mapa = L.map("mapa", { preferCanvas: true });

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      className: "base-neutra",
      attribution: 'Base y capas de red &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, ODbL. Reclamos: ENARGAS, CC BY 4.0.'
    }).addTo(mapa);

    capaFondo = L.layerGroup().addTo(mapa);
    capaRuta = L.layerGroup().addTo(mapa);
    capaMarcas = L.layerGroup().addTo(mapa);
  }

  function pintarMapa() {
    var c = D.ciudades[estado.ciudad];
    capaFondo.clearLayers();
    capaRuta.clearLayers();
    capaMarcas.clearLayers();
    marcadores = {};

    // la red de fondo, apagada, para que la ruta del dia sea lo unico que se lee
    c.tramos.slice(0, 900).forEach(function (t) {
      L.polyline(t.geo.map(function (p) { return [p[1], p[0]]; }), {
        color: "#b6ada0", weight: 1.2, opacity: .5, interactive: false
      }).addTo(capaFondo);
    });

    plan.equipos.forEach(function (e, q) {
      var color = COLOR_CUADRILLA[q % 3];
      var puntos = [[plan.base.lat, plan.base.lon]];
      e.paradas.forEach(function (p) { puntos.push([p.tramo.lat, p.tramo.lon]); });
      puntos.push([plan.base.lat, plan.base.lon]);

      L.polyline(puntos, {
        color: color, weight: 2.4, opacity: .55, dashArray: "6 5", lineCap: "round", interactive: false
      }).addTo(capaRuta);

      e.paradas.forEach(function (p, i) {
        L.polyline(p.tramo.geo.map(function (g) { return [g[1], g[0]]; }), {
          color: color, weight: 5.5, opacity: .95, lineCap: "round"
        }).addTo(capaRuta);

        var cierre = estado.cierres[p.tramo.id];
        var marca = cierre === "hallazgo" ? " con-hallazgo" : cierre === "ok" ? " cerrada" : "";

        var m = L.marker([p.tramo.lat, p.tramo.lon], {
          icon: L.divIcon({
            className: "",
            html: '<div class="marcador-parada' + (q && !marca ? " cuadrilla-" + (q + 1) : "") +
              marca + '">' + (i + 1) + "</div>",
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          }),
          keyboard: false
        });

        m.bindTooltip(
          "<b>" + p.tramo.nombre + "</b> <i>" + hhmm(p.inicio) + "</i>",
          { className: "tooltip-tramo", direction: "top", offset: [0, -14] }
        );
        m.on("click", function () { enfocar(p.tramo.id); });
        m.addTo(capaMarcas);
        marcadores[p.tramo.id] = m;
      });
    });

    L.marker([plan.base.lat, plan.base.lon], {
      icon: L.divIcon({ className: "", html: '<div class="marcador-base"></div>', iconSize: [15, 15], iconAnchor: [7, 7] }),
      keyboard: false
    }).bindTooltip("<b>Base operativa</b>", { className: "tooltip-tramo", direction: "top", offset: [0, -10] })
      .addTo(capaMarcas);
  }

  /* ---------- panel ---------- */

  function pintarComparacion() {
    var pa = plan.riesgoActual / plan.riesgoTotal * 100;
    var pm = plan.riesgoMalla / plan.riesgoTotal * 100;

    document.getElementById("barra-actual").style.transform = "scaleX(" + (pa / pm).toFixed(3) + ")";
    document.getElementById("barra-malla").style.transform = "scaleX(1)";
    document.getElementById("valor-actual").textContent = pa.toFixed(1).replace(".", ",") + " %";
    document.getElementById("valor-malla").textContent = pm.toFixed(1).replace(".", ",") + " %";

    var veces = plan.riesgoActual > 0 ? plan.riesgoMalla / plan.riesgoActual : 0;
    var jornadas = estado.cuadrillas * (estado.jornada / 8);

    document.getElementById("compara-pie").innerHTML =
      "Con las mismas horas de cuadrilla, la recorrida de Malla cubre <b>" +
      veces.toFixed(1).replace(".", ",") + " veces</b> el riesgo que cubre la lista por calle, y alcanza a <b>" +
      num(plan.hogaresMalla) + " hogares</b> en lugar de " + num(plan.hogaresActual) + ". " +
      "Los dos criterios miran la red completa y gastan las mismas horas, y los dos pagan el " +
      "viaje entre tramo y tramo. Es el punto de <b>" +
      jornadas.toFixed(1).replace(".", ",").replace(",0", "") +
      "</b> en la curva de jornadas del tablero.";
  }

  function pintarParadas() {
    var html = "";
    var total = 0;

    plan.equipos.forEach(function (e, q) {
      if (estado.cuadrillas > 1) {
        html += '<div class="parada-corte">Cuadrilla ' + (q + 1) + ", regreso " + hhmm(e.regreso) + "</div>";
      }

      if (!e.paradas.length) {
        html += '<div class="fuera">No entra ninguna parada con esta jornada.</div>';
        return;
      }

      e.paradas.forEach(function (p, i) {
        total++;
        var t = p.tramo;
        html += '<li class="parada-item"><button class="parada" type="button" data-id="' + t.id + '" ' +
          'aria-current="' + (estado.activa === t.id ? "true" : "false") + '">' +
          '<span class="parada-orden' + (q ? " cuadrilla-" + (q + 1) : "") + '">' + (i + 1) + "</span>" +
          '<span class="parada-calle">' + t.nombre + "</span>" +
          '<span class="parada-hora">' + hhmm(p.inicio) + " a " + hhmm(p.fin) + "</span>" +
          '<span class="parada-detalle">' +
            '<span class="chip-critico">criticidad ' + t.indice.toFixed(0) + '</span>' +
            "<span>" + num(t.hogares) + " hogares</span>" +
            '<span class="punto-sep">/</span>' +
            "<span>" + num(t.largo) + " m</span>" +
            '<span class="punto-sep">/</span>' +
            "<span>" + Math.round(p.viaje) + " min de viaje</span>" +
            (t.receptores.length ? '<span class="punto-sep">/</span><span>' + t.receptores.length + " receptor" + (t.receptores.length > 1 ? "es" : "") + " sensible" + (t.receptores.length > 1 ? "s" : "") + "</span>" : "") +
          "</span>" +
          "</button>" + cierrePara(t) + "</li>";
      });
    });

    document.getElementById("paradas").innerHTML = html;
    document.getElementById("conteo-paradas").textContent = total + " paradas";

    Array.prototype.forEach.call(document.querySelectorAll("[data-id]"), function (el) {
      el.addEventListener("click", function () { enfocar(el.dataset.id, true); });
    });

    Array.prototype.forEach.call(document.querySelectorAll("[data-cierre]"), function (el) {
      el.addEventListener("click", function () {
        var id = el.dataset.cierre;
        var valor = el.dataset.valor;
        if (valor) estado.cierres[id] = valor;
        else delete estado.cierres[id];
        pintarMapa();
        pintarParadas();
        pintarAvance();
      });
    });
  }

  /* El resultado de la inspeccion vuelve por el mismo lugar por donde salio la hoja de
     ruta. Sin esto la recorrida es una salida y no un ciclo. */
  function cierrePara(t) {
    var r = estado.cierres[t.id];

    if (!r) {
      return '<div class="parada-cierre">' +
        '<button class="cierre-boton" type="button" data-cierre="' + t.id + '" data-valor="ok">Sin novedad</button>' +
        '<button class="cierre-boton" type="button" data-cierre="' + t.id + '" data-valor="hallazgo">Con hallazgo</button>' +
        "</div>";
    }

    var hallazgo = r === "hallazgo";
    return '<div class="parada-cierre">' +
      '<span class="cierre-estado' + (hallazgo ? " hallazgo" : "") + '">' +
        '<i class="cierre-punto' + (hallazgo ? " hallazgo" : "") + '"></i>' +
        (hallazgo ? "Informado <b>con hallazgo</b>" : "Informado <b>sin novedad</b>") +
      "</span>" +
      '<button class="cierre-deshacer" type="button" data-cierre="' + t.id + '" data-valor="">deshacer</button>' +
      "</div>";
  }

  function pintarAvance() {
    var total = plan.visitados.length;
    var cerradas = 0, hallazgos = 0;

    plan.visitados.forEach(function (t) {
      var r = estado.cierres[t.id];
      if (!r) return;
      cerradas++;
      if (r === "hallazgo") hallazgos++;
    });

    document.getElementById("avance-valor").textContent = cerradas;
    document.getElementById("avance-total").textContent =
      "de " + total + " paradas informadas";
    document.getElementById("avance-barra").style.transform =
      "scaleX(" + (total ? cerradas / total : 0).toFixed(3) + ")";

    var pie;
    if (!cerradas) {
      pie = "Cada parada se informa desde la misma pantalla. El resultado vuelve al sistema " +
        "y actualiza la fecha de última inspección del tramo.";
    } else {
      pie = "<b>" + hallazgos + "</b> " + (hallazgos === 1 ? "hallazgo" : "hallazgos") +
        " sobre " + cerradas + " " + (cerradas === 1 ? "parada informada" : "paradas informadas") + ". ";
      pie += hallazgos
        ? "Los tramos con hallazgo entran al próximo recálculo con probabilidad de falla corregida hacia arriba."
        : "Los tramos informados quedan con fecha de inspección de hoy y bajan en la cola.";
    }
    document.getElementById("avance-pie").innerHTML = pie;
  }

  function enfocar(id, centrar) {
    estado.activa = id;
    var c = D.ciudades[estado.ciudad];
    var t = null;
    for (var i = 0; i < c.tramos.length; i++) if (c.tramos[i].id === id) { t = c.tramos[i]; break; }
    if (!t) return;

    Object.keys(marcadores).forEach(function (k) {
      var el = marcadores[k].getElement();
      if (el && el.firstChild) el.firstChild.classList.toggle("activo", k === id);
    });

    Array.prototype.forEach.call(document.querySelectorAll(".parada"), function (el) {
      el.setAttribute("aria-current", el.dataset.id === id ? "true" : "false");
    });

    if (centrar) mapa.setView([t.lat, t.lon], Math.max(mapa.getZoom(), 16));
    else marcadores[id] && marcadores[id].openTooltip();
  }

  /* ---------- arranque ---------- */

  function refrescar(reencuadrar) {
    calcular();
    pintarMapa();
    pintarComparacion();
    pintarParadas();
    pintarAvance();
    if (reencuadrar) encuadrar();
  }

  function encuadrar() {
    var puntos = [[plan.base.lat, plan.base.lon]];
    plan.visitados.forEach(function (t) { puntos.push([t.lat, t.lon]); });
    if (puntos.length > 1) mapa.fitBounds(L.latLngBounds(puntos).pad(0.12));
    else mapa.setView(D.ciudades[estado.ciudad].centro, 13);
  }

  function fechaLarga() {
    var d = new Date(2026, 8, 22);
    var dias = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
    var meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
                 "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    return dias[d.getDay()] + " " + d.getDate() + " de " + meses[d.getMonth()] +
      ", salida 08:00 desde la base";
  }

  function iniciar() {
    document.getElementById("fecha").textContent = fechaLarga();

    var sel = document.getElementById("ciudad");
    Object.keys(D.ciudades).forEach(function (k) {
      var o = document.createElement("option");
      o.value = k;
      o.textContent = D.ciudades[k].nombre;
      sel.appendChild(o);
    });
    sel.value = estado.ciudad;
    sel.addEventListener("change", function () {
      estado.ciudad = sel.value;
      estado.activa = null;
      estado.cierres = {};
      refrescar(true);
    });

    var cua = document.getElementById("cuadrillas");
    cua.addEventListener("change", function () {
      estado.cuadrillas = +cua.value;
      refrescar(false);
    });

    var jor = document.getElementById("jornada");
    jor.addEventListener("input", function () {
      estado.jornada = +jor.value;
      document.getElementById("jornada-valor").textContent = estado.jornada;
      refrescar(false);
    });

    document.getElementById("aviso-cerrar").addEventListener("click", function () {
      document.getElementById("aviso").style.display = "none";
    });
    document.getElementById("btn-procedencia").addEventListener("click", function () {
      var a = document.getElementById("aviso");
      a.style.display = a.style.display === "none" ? "block" : "none";
    });

    var exportar = document.getElementById("btn-exportar");
    exportar.addEventListener("click", function () {
      var original = exportar.innerHTML;
      exportar.disabled = true;
      exportar.innerHTML = "Enviado a " + estado.cuadrillas + " cuadrilla" + (estado.cuadrillas > 1 ? "s" : "");
      setTimeout(function () {
        exportar.innerHTML = original;
        exportar.disabled = false;
      }, 2200);
    });

    iniciarMapa();
    refrescar(true);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
