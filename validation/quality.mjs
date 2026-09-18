// Metricas de calidad de software del articulo (Tabla IV y parrafo de ESLint
// de la seccion VII-C), medidas sobre el arbol de fuentes en lugar de anotadas
// a mano. Sin este script las cifras de la Tabla IV son las unicas del articulo
// que no se pueden reproducir con `run_all.sh`, y se desactualizan en silencio
// cada vez que alguien toca el codigo.
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const FRONTEND = join(ROOT, "frontend");

/**
 * Regla de conteo del articulo para el frontend: todo `src/`, excluyendo los
 * componentes de shadcn/ui (codigo de terceros copiado, no escrito aqui) y los
 * ficheros de test, que se reportan aparte como numero de tests. El arbol de
 * rutas generado si cuenta, porque forma parte del artefacto desplegado.
 */
function countFrontendLoc(dir = join(FRONTEND, "src")) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "ui") continue;
      total += countFrontendLoc(path);
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name)) {
      total += countLines(path);
    }
  }
  return total;
}

/** Lineas al estilo de `wc -l`: numero de saltos de linea, que es la convencion con la que se midieron las cifras del articulo. */
const countLines = (path) => (readFileSync(path, "utf8").match(/\n/g) ?? []).length;
const depCount = (pkg) =>
  Object.keys(JSON.parse(readFileSync(join(ROOT, pkg, "package.json"), "utf8")).dependencies ?? {})
    .length;

const run = (cmd, args, cwd) => {
  try {
    return execFileSync(cmd, args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  } catch (error) {
    // vitest y eslint salen con codigo != 0 cuando hay fallos o hallazgos; la
    // salida sigue siendo la que necesitamos, asi que se analiza igualmente.
    return error.stdout ?? "";
  }
};

console.error("midiendo LOC y dependencias...");
const loc = {
  frontend: countFrontendLoc(),
  backend: countLines(join(ROOT, "backend/index.js")) +
    countLines(join(ROOT, "backend/scripts/init-db.js")),
};
const dependencies = { frontend: depCount("frontend"), backend: depCount("backend") };

console.error("ejecutando la suite de regresion con cobertura...");
const reportFile = join(FRONTEND, ".quality-tests.json");
run(
  "npx",
  [
    "vitest", "run",
    "--coverage",
    "--coverage.reporter=json-summary",
    "--reporter=json",
    `--outputFile=${reportFile}`,
  ],
  FRONTEND,
);
const report = JSON.parse(readFileSync(reportFile, "utf8"));
rmSync(reportFile, { force: true });
const summary = JSON.parse(
  readFileSync(join(FRONTEND, "coverage/coverage-summary.json"), "utf8"),
).total;

console.error("ejecutando ESLint...");
const eslint = JSON.parse(run("npx", ["eslint", ".", "--format", "json"], FRONTEND) || "[]");
const messages = eslint.flatMap((file) => file.messages);
// El articulo distingue los hallazgos de formato del resto porque son los que
// no pueden indicar un defecto funcional.
const formatting = messages.filter((m) => m.ruleId === "prettier/prettier").length;

const out = {
  loc,
  dependencies,
  tests: { total: report.numTotalTests, passed: report.numPassedTests, failed: report.numFailedTests },
  coverage: {
    statements: summary.statements.pct,
    branches: summary.branches.pct,
    functions: summary.functions.pct,
    lines: summary.lines.pct,
  },
  eslint: { findings: messages.length, formatting, other: messages.length - formatting },
};

mkdirSync(join(ROOT, "validation/results"), { recursive: true });
writeFileSync(join(ROOT, "validation/results/quality.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1));
