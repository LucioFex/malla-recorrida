/* Malla Recorrida, variante B.
   Reemplaza la lista de papel que hoy se recorre de arriba hacia abajo.
   La ruta no es un problema del viajante: la cuadrilla nunca llega a todo, asi que
   se elige el mejor subconjunto de tramos que entra en la jornada. Eso es un problema
   de orientacion, y aca se resuelve con una heuristica golosa mas dos opt. */

(function () {
  "use strict";

  var D = window.MALLA;

  var VELOCIDAD = 21;        // km/h medios en calle urbana con trafico
  var CANDIDATOS = 320;      // universo que mira el optimizador
  var COLOR_CUADRILLA = ["#7b1e2b", "#3d5a5f", "#8a6d2f"];

  var estado = {
    ciudad: "bahia_blanca",
    jornada: 8,
    cuadrillas: 2,
    activa: null
  };

  var mapa, capaFondo, capaRuta, capaMarcas, marcadores = {};
  var plan = null;

  function num(n) { return Math.round(n).toLocaleString("es-AR"); }

  function hhmm(min) {
    var t = 8 * 60 + min;
    var h = Math.floor(t / 60), m = Math.round(t % 60);
    return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
  }

  function km(a, b) {
    var lat = (a.lat + b.lat) / 2 * Math.PI / 180;
    var dx = (b.lon - a.lon) * 111.32 * Math.cos(lat);
    var dy = (b.lat - a.lat) * 110.54;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function viaje(a, b) { return km(a, b) / VELOCIDAD * 60 * 1.32; }   // 1.32 por el trazado de calles

  function servicio(t) { return 11 + t.largo / 100 * 1.6; }           // minutos de inspeccion del tramo

  /* ---------- optimizacion ---------- */

  function resolver(candidatos, base, presupuesto) {
    var libres = candidatos.slice();
    var ruta = [];
    var aqui = base;
    var usado = 0;

    while (libres.length) {
      var mejor = -1, mejorValor = 0, mejorCosto = 0;

      for (var i = 0; i < libres.length; i++) {
        var t = libres[i];
        var ida = viaje(aqui, t);
        var serv = servicio(t);
        var vuelta = viaje(t, base);
        if (usado + ida + serv + vuelta > presupuesto) continue;

        var valor = t.crit / (ida + serv);
        if (valor > mejorValor) { mejorValor = valor; mejor = i; mejorCosto = ida + serv; }
      }

      if (mejor < 0) break;
      var elegido = libres.splice(mejor, 1)[0];
      usado += mejorCosto;
      ruta.push(elegido);
      aqui = elegido;
    }

    return dosOpt(ruta, base);
  }

  function largoRuta(ruta, base) {
    var total = 0, aqui = base;
    for (var i = 0; i < ruta.length; i++) { total += viaje(aqui, ruta[i]); aqui = ruta[i]; }
    return total + viaje(aqui, base);
  }

  function dosOpt(ruta, base) {
    if (ruta.length < 4) return ruta;
    var mejor = ruta.slice();
    var mejorLargo = largoRuta(mejor, base);
    var cambio = true;
    var vueltas = 0;

    while (cambio && vueltas < 24) {
      cambio = false;
      vueltas++;
      for (var i = 0; i < mejor.length - 1; i++) {
        for (var j = i + 2; j < mejor.length; j++) {
          var prueba = mejor.slice(0, i + 1)
            .concat(mejor.slice(i + 1, j + 1).reverse())
            .concat(mejor.slice(j + 1));
          var l = largoRuta(prueba, base);
          if (l < mejorLargo - 0.01) { mejor = prueba; mejorLargo = l; cambio = true; }
        }
      }
    }
    return mejor;
  }

  /* El criterio actual: la lista de calles en orden alfabetico, recorrida de arriba
     hacia abajo hasta que se acaba la jornada. Es lo que describio Luciano en la
     reunion del 8 de septiembre. */
  function criterioActual(candidatos, base, presupuesto) {
    var lista = candidatos.slice().sort(function (a, b) {
      return a.nombre.localeCompare(b.nombre, "es");
    });

    var ruta = [], aqui = base, usado = 0;
    for (var i = 0; i < lista.length; i++) {
      var t = lista[i];
      var costo = viaje(aqui, t) + servicio(t);
      if (usado + costo + viaje(t, base) > presupuesto) break;
      usado += costo;
      ruta.push(t);
      aqui = t;
    }
    return ruta;
  }

  function calcular() {
    var c = D.ciudades[estado.ciudad];
    var base = { lat: c.centro[0], lon: c.centro[1], nombre: "Base operativa" };
    var presupuesto = estado.jornada * 60;

    var candidatos = c.tramos.slice(0, CANDIDATOS);
    var riesgoTotal = 0;
    c.tramos.forEach(function (t) { riesgoTotal += t.crit; });

    var libres = candidatos.slice();
    var equipos = [];

    for (var q = 0; q < estado.cuadrillas; q++) {
      var ruta = resolver(libres, base, presupuesto);
      var vistos = {};
      ruta.forEach(function (t) { vistos[t.id] = true; });
      libres = libres.filter(function (t) { return !vistos[t.id]; });

      var reloj = 0, aqui = base, paradas = [];
      ruta.forEach(function (t) {
        var v = viaje(aqui, t);
        reloj += v;
        var inicio = reloj;
        var s = servicio(t);
        reloj += s;
        paradas.push({ tramo: t, viaje: v, inicio: inicio, fin: reloj, cuadrilla: q });
        aqui = t;
      });

      equipos.push({ paradas: paradas, regreso: reloj + viaje(aqui, base) });
    }

    var visitados = [];
    equipos.forEach(function (e) { e.paradas.forEach(function (p) { visitados.push(p.tramo); }); });

    var actual = criterioActual(candidatos, base, presupuesto * estado.cuadrillas);

    function suma(lista, campo) {
      var s = 0;
      lista.forEach(function (t) { s += t[campo]; });
      return s;
    }

    plan = {
      base: base,
      equipos: equipos,
      visitados: visitados,
      riesgoTotal: riesgoTotal,
      riesgoMalla: suma(visitados, "crit"),
      riesgoActual: suma(actual, "crit"),
      hogaresMalla: suma(visitados, "hogares"),
      hogaresActual: suma(actual, "hogares"),
      paradasActual: actual.length
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

        var m = L.marker([p.tramo.lat, p.tramo.lon], {
          icon: L.divIcon({
            className: "",
            html: '<div class="marcador-parada' + (q ? " cuadrilla-" + (q + 1) : "") + '">' + (i + 1) + "</div>",
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
    document.getElementById("valor-actual").textContent = pa.toFixed(1) + " %";
    document.getElementById("valor-malla").textContent = pm.toFixed(1) + " %";

    var veces = plan.riesgoActual > 0 ? plan.riesgoMalla / plan.riesgoActual : 0;
    document.getElementById("compara-pie").innerHTML =
      "Con las mismas horas de cuadrilla, la recorrida de Malla cubre <b>" +
      veces.toFixed(1) + " veces</b> el riesgo que cubre la lista por calle, y alcanza a <b>" +
      num(plan.hogaresMalla) + " hogares</b> en lugar de " + num(plan.hogaresActual) + ".";
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
        html += '<li><button class="parada" type="button" data-id="' + t.id + '" ' +
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
          "</button></li>";
      });
    });

    document.getElementById("paradas").innerHTML = html;
    document.getElementById("conteo-paradas").textContent = total + " paradas";

    Array.prototype.forEach.call(document.querySelectorAll("[data-id]"), function (el) {
      el.addEventListener("click", function () { enfocar(el.dataset.id, true); });
    });
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
