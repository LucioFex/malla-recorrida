/* Motor de recorrida de Malla, pieza compartida.

   Este archivo es identico en malla-recorrida y en malla-tablero. Si se toca uno hay
   que tocar el otro, porque las dos maquetas tienen que dar el mismo numero. Antes no
   era asi: la hoja de ruta pagaba el viaje real y el tablero suponia un traslado fijo,
   y ademas la hoja de ruta le mostraba al criterio actual solo los tramos mas criticos,
   que es justamente lo que el criterio actual no sabe mirar. De ahi salian dos
   respuestas distintas para la misma pregunta.

   El criterio unico, que es el que sostiene el numero del acta de proyecto:

   - Universo, la red completa de la ciudad para los dos criterios.
   - Costo, viaje real punto a punto mas el tiempo de inspeccion del tramo.
   - Presupuesto, jornadas de cuadrilla de ocho horas, cada una sale de la base y
     vuelve a la base.
   - Malla elige por criticidad sobre costo y despues acomoda la ruta con dos opt.
   - El criterio actual recorre la lista de calles en orden alfabetico, sin rutear,
     que es lo que se hace hoy.

   Una jornada de cuadrilla es una cuadrilla trabajando ocho horas. Diez jornadas son
   dos cuadrillas durante cinco dias o diez cuadrillas en un dia: el presupuesto de
   horas es el mismo, y por eso la curva del tablero y la hoja de ruta del dia leen el
   mismo eje. El punto de dos jornadas de la curva es, tramo por tramo, la recorrida
   que dibuja la hoja de ruta con dos cuadrillas. */

(function (global) {
  "use strict";

  var VELOCIDAD = 21;      // km/h medios en calle urbana con trafico
  var TRAZADO = 1.32;      // las calles no van en linea recta
  var JORNADA = 480;       // minutos de una jornada de ocho horas
  var VUELTAS_2OPT = 24;

  function km(a, b) {
    var lat = (a.lat + b.lat) / 2 * Math.PI / 180;
    var dx = (b.lon - a.lon) * 111.32 * Math.cos(lat);
    var dy = (b.lat - a.lat) * 110.54;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function viaje(a, b) { return km(a, b) / VELOCIDAD * 60 * TRAZADO; }

  function servicio(t) { return 11 + t.largo / 100 * 1.6; }   // minutos de inspeccion

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

    while (cambio && vueltas < VUELTAS_2OPT) {
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

  /* La cuadrilla nunca llega a todo, asi que no hay que visitar todos los nodos sino
     elegir el mejor subconjunto que entra en la jornada. Eso es un problema de
     orientacion, y aca se resuelve con una heuristica golosa mas dos opt. */
  function rutaPorCriticidad(libres, base, presupuesto) {
    var ruta = [];
    var aqui = base;
    var usado = 0;

    while (libres.length) {
      var mejor = -1, mejorValor = 0, mejorCosto = 0;

      for (var i = 0; i < libres.length; i++) {
        var t = libres[i];
        var ida = viaje(aqui, t);
        var serv = servicio(t);
        if (usado + ida + serv + viaje(t, base) > presupuesto) continue;

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

  function relojDeLaRuta(ruta, base, cuadrilla) {
    var reloj = 0, aqui = base, paradas = [];
    for (var i = 0; i < ruta.length; i++) {
      var t = ruta[i];
      var v = viaje(aqui, t);
      reloj += v;
      var inicio = reloj;
      reloj += servicio(t);
      paradas.push({ tramo: t, viaje: v, inicio: inicio, fin: reloj, cuadrilla: cuadrilla });
      aqui = t;
    }
    return { paradas: paradas, regreso: reloj + viaje(aqui, base) };
  }

  function sumar(tramos, campo) {
    var s = 0;
    for (var i = 0; i < tramos.length; i++) s += tramos[i][campo];
    return s;
  }

  /* Devuelve una cuadrilla por jornada asignada. Como cada jornada solo agrega tramos
     y nunca cambia lo que hicieron las anteriores, la misma corrida sirve para la hoja
     de ruta de hoy y para la curva entera del tablero. */
  function porCriticidad(tramos, base, jornadas, presupuesto) {
    var libres = tramos.slice();
    var equipos = [];

    for (var q = 0; q < jornadas; q++) {
      var ruta = rutaPorCriticidad(libres, base, presupuesto);
      equipos.push(relojDeLaRuta(ruta, base, q));
    }
    return equipos;
  }

  /* El criterio de hoy: la lista de calles en orden alfabetico, recorrida de arriba
     hacia abajo hasta que se acaba la jornada. La lista se reparte entre las jornadas
     disponibles, que es la unica forma de que las dos comparaciones gasten las mismas
     horas de cuadrilla. */
  function porCalle(tramos, base, jornadas, presupuesto) {
    var lista = tramos.slice().sort(function (a, b) {
      return a.nombre.localeCompare(b.nombre, "es");
    });

    var equipos = [];
    var i = 0;

    for (var q = 0; q < jornadas; q++) {
      var ruta = [], aqui = base, usado = 0;

      while (i < lista.length) {
        var t = lista[i];
        var costo = viaje(aqui, t) + servicio(t);
        if (usado + costo + viaje(t, base) > presupuesto) {
          /* Un tramo que no entra ni en una jornada entera se saltea, si no la lista
             se traba en el y ninguna cuadrilla avanza. */
          if (!ruta.length) { i++; continue; }
          break;
        }
        usado += costo;
        ruta.push(t);
        aqui = t;
        i++;
      }
      equipos.push(relojDeLaRuta(ruta, base, q));
    }
    return equipos;
  }

  function resumir(equipos) {
    var tramos = [];
    var acumulado = [];
    var corrido = 0;

    for (var q = 0; q < equipos.length; q++) {
      var propios = equipos[q].paradas.map(function (p) { return p.tramo; });
      corrido += sumar(propios, "crit");
      acumulado.push(corrido);
      tramos = tramos.concat(propios);
    }

    return {
      equipos: equipos,
      tramos: tramos,
      acumulado: acumulado,
      riesgo: corrido,
      hogares: sumar(tramos, "hogares"),
      paradas: tramos.length
    };
  }

  /* Punto de entrada unico de las dos maquetas.
     jornadas es la cantidad de jornadas de cuadrilla de ocho horas asignadas. */
  function planificar(ciudad, jornadas, horas) {
    var base = { lat: ciudad.centro[0], lon: ciudad.centro[1], nombre: "Base operativa" };
    var presupuesto = (horas || 8) * 60;

    return {
      base: base,
      presupuesto: presupuesto,
      riesgoTotal: sumar(ciudad.tramos, "crit"),
      hogaresTotal: sumar(ciudad.tramos, "hogares"),
      malla: resumir(porCriticidad(ciudad.tramos, base, jornadas, presupuesto)),
      actual: resumir(porCalle(ciudad.tramos, base, jornadas, presupuesto))
    };
  }

  global.MALLA_MOTOR = {
    JORNADA: JORNADA,
    VELOCIDAD: VELOCIDAD,
    km: km,
    viaje: viaje,
    servicio: servicio,
    planificar: planificar
  };

})(typeof window !== "undefined" ? window : globalThis);
