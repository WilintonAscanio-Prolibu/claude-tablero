const { test } = require("node:test");
const assert = require("node:assert");
const { agregar, humanizar, EN_USO_S } = require("../agregacion.js");

const AHORA = "2026-08-11T18:00:00Z";

function estadoDemo() {
  return {
    version: 1,
    maquinas: {
      Mini: { cuenta: "Gamma", ultima_actividad: { hace: "2026-08-11T17:58:00Z", proyecto: "front-v2" }, reportado: "2026-08-11T17:59:00Z" },
      Air: { cuenta: "Alpha", ultima_actividad: null, reportado: "2026-08-11T17:58:00Z" },
      Pro: { cuenta: null, ultima_actividad: { hace: "2026-08-11T15:00:00Z", proyecto: "siteforge" }, reportado: "2026-08-11T17:57:00Z" },
    },
    cuentas: {
      Gamma: { cinco_horas: { pct: 62, resetea: "2026-08-11T20:00:00Z" }, semanal: { pct: 31, resetea: "2026-08-14T13:00:00Z" }, medido: "2026-08-11T17:59:00Z", por: "Mini" },
      Alpha: { cinco_horas: { pct: 15, resetea: "2026-08-11T19:00:00Z" }, semanal: { pct: 48, resetea: "2026-08-13T10:00:00Z" }, medido: "2026-08-11T17:58:00Z", por: "Air" },
      Beta: { cinco_horas: { pct: 91, resetea: "2026-08-11T18:30:00Z" }, semanal: { pct: 22, resetea: "2026-08-12T09:00:00Z" }, medido: "2026-08-11T17:00:00Z", por: "Pro" },
    },
  };
}

test("recomendada fresca de menor score", () => {
  const agg = agregar(estadoDemo(), AHORA);
  assert.equal(agg.recomendada.alias, "Alpha");
  assert.equal(agg.recomendada.dato_de_hace_s, 0);
});

test("semaforos y orden", () => {
  const agg = agregar(estadoDemo(), AHORA);
  const por = Object.fromEntries(agg.cuentas.map(c => [c.alias, c]));
  assert.equal(por.Alpha.semaforo, "verde");
  assert.equal(por.Gamma.semaforo, "amarillo");
  assert.equal(por.Beta.semaforo, "rojo");
  assert.deepEqual(agg.cuentas.map(c => c.alias), ["Alpha", "Gamma", "Beta"]);
});

test("beta no fresca pero visible, Pro sin sesion", () => {
  const agg = agregar(estadoDemo(), AHORA);
  const beta = agg.cuentas.find(c => c.alias === "Beta");
  assert.equal(beta.fresco, false);
  assert.deepEqual(beta.maquinas, []);
  assert.deepEqual(agg.sin_sesion.map(m => m.clave), ["Pro"]);
});

test("fallback todas viejas", () => {
  const e = estadoDemo();
  for (const c of Object.values(e.cuentas)) c.medido = "2026-08-11T08:00:00Z";
  const agg = agregar(e, AHORA);
  assert.equal(agg.recomendada.alias, "Alpha");
  assert.ok(agg.recomendada.dato_de_hace_s > 900);
});

test("sin ningun cupo", () => {
  const e = estadoDemo();
  e.cuentas = {};
  const agg = agregar(e, AHORA);
  assert.equal(agg.recomendada, null);
  assert.equal(agg.cuentas.length, 2);
});

test("cuenta sin cupo va al final", () => {
  const e = estadoDemo();
  delete e.cuentas.Alpha;
  const agg = agregar(e, AHORA);
  assert.equal(agg.cuentas[agg.cuentas.length - 1].alias, "Alpha");
  assert.equal(agg.cuentas[agg.cuentas.length - 1].semaforo, null);
});

test("maquina sin reportar hace mas de un dia no se muestra", () => {
  const e = estadoDemo();
  e.maquinas.Fantasma = { cuenta: "Gamma", ultima_actividad: null, reportado: "2026-08-09T18:00:00Z" };
  e.maquinas.Pro.reportado = "2026-08-10T17:59:59Z"; // 1 d + 1 s → fuera
  const agg = agregar(e, AHORA);
  assert.deepEqual(agg.cuentas.find(c => c.alias === "Gamma").maquinas.map(m => m.clave), ["Mini"]);
  assert.deepEqual(agg.sin_sesion, []);
});

test("el borde del dia sigue adentro", () => {
  const e = estadoDemo();
  e.maquinas.Mini.reportado = "2026-08-10T18:00:00Z"; // exactamente EN_USO_S
  assert.equal(EN_USO_S, 86400);
  const agg = agregar(e, AHORA);
  assert.deepEqual(agg.cuentas.find(c => c.alias === "Gamma").maquinas.map(m => m.clave), ["Mini"]);
});

test("cuenta que solo existia por una maquina fantasma desaparece", () => {
  const e = estadoDemo();
  e.maquinas.Viejo = { cuenta: "Zeta", ultima_actividad: null, reportado: "2026-07-20T18:00:00Z" };
  const agg = agregar(e, AHORA);
  assert.ok(!agg.cuentas.some(c => c.alias === "Zeta"));
});

test("cuenta con cupo sobrevive aunque su maquina sea fantasma", () => {
  const e = estadoDemo();
  e.maquinas.Air.reportado = "2026-07-20T18:00:00Z";
  const alpha = agregar(e, AHORA).cuentas.find(c => c.alias === "Alpha");
  assert.deepEqual(alpha.maquinas, []);
  assert.equal(alpha.cupo.cinco_horas.pct, 15); // el cupo se sigue viendo: es lo que decide qué usar
});

test("reportado ilegible queda fuera en vez de romper el render", () => {
  const e = estadoDemo();
  e.maquinas.Mini.reportado = "no es fecha";
  const agg = agregar(e, AHORA);
  assert.deepEqual(agg.cuentas.find(c => c.alias === "Gamma").maquinas, []);
});

test("humanizar", () => {
  assert.equal(humanizar(30), "hace un momento");
  assert.equal(humanizar(240), "hace 4 min");
  assert.equal(humanizar(3600 * 3 + 100), "hace 3 h");
  assert.equal(humanizar(86400 * 2 + 100), "hace 2 d");
});

test("orden por codepoint con mayúsculas y tildes", () => {
  const ahora = "2026-08-11T18:00:00Z";
  const estado = {
    version: 1,
    maquinas: {},
    cuentas: {
      delta: { cinco_horas: { pct: 50, resetea: "2026-08-11T19:00:00Z" }, semanal: { pct: 40, resetea: "2026-08-12T10:00:00Z" }, medido: "2026-08-11T17:59:00Z", por: undefined },
      Gamma: { cinco_horas: { pct: 50, resetea: "2026-08-11T19:00:00Z" }, semanal: { pct: 40, resetea: "2026-08-12T10:00:00Z" }, medido: "2026-08-11T17:59:00Z", por: undefined },
      Ángela: { cinco_horas: { pct: 50, resetea: "2026-08-11T19:00:00Z" }, semanal: { pct: 40, resetea: "2026-08-12T10:00:00Z" }, medido: "2026-08-11T17:59:00Z", por: undefined },
      zulu: { cinco_horas: { pct: 50, resetea: "2026-08-11T19:00:00Z" }, semanal: { pct: 40, resetea: "2026-08-12T10:00:00Z" }, medido: "2026-08-11T17:59:00Z", por: undefined },
    },
  };
  const agg = agregar(estado, ahora);
  const orden = agg.cuentas.map(c => c.alias);
  assert.deepEqual(orden, ["Gamma", "delta", "zulu", "Ángela"]);
});
