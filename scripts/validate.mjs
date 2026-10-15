#!/usr/bin/env node
// Static-bundle validator: schema conformance (ajv) + ref-integrity + counts.
// Run: npm i -g ajv-cli js-yaml  (or) npx -y ajv-cli validate ... ; node scripts/validate.mjs
import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import yaml from "js-yaml";
import Ajv from "ajv";

const root = new URL("../config/", import.meta.url).pathname;
const ajv = new Ajv({ allErrors: true, strict: false });
const load = (p) => yaml.load(readFileSync(p, "utf8"));
const ids = (dir) => readdirSync(join(root, dir)).filter(f => f.endsWith(".yaml")).map(f => f.replace(/\.yaml$/, ""));
const errors = [];
const checkSchema = (schemaPath, data, label) => {
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
  const valid = ajv.compile(schema)(data);
  if (!valid) errors.push(`${label}: ${JSON.stringify(ajv.errors)}`);
};

// counts
const expect = { ancestries: 12, backgrounds: 30, expertise: 18, "vision-types": 4 };
for (const [dir, n] of Object.entries(expect)) {
  const got = ids(dir).length;
  if (got !== n) errors.push(`count ${dir}: expected ${n}, got ${got}`);
}
const classCount = ids("classes").length;
if (classCount < 31) errors.push(`count classes: expected >=31, got ${classCount}`);

// ref integrity: ancestry languages/vision/passives
const langs = new Set(ids("languages")), visions = new Set(ids("vision-types")), passives = new Set(ids("passives"));
for (const a of ids("ancestries")) {
  const d = load(join(root, "ancestries", a + ".yaml"));
  for (const l of (d.languages || [])) if (!langs.has(l)) errors.push(`${a}: unknown language ${l}`);
  if (d.vision && !visions.has(d.vision)) errors.push(`${a}: unknown vision ${d.vision}`);
  for (const p of [...(d.passives ? Object.values(d.passives).flat() : []), ...(d.passives || [])].flat())
    if (typeof p === "string" && !passives.has(p)) errors.push(`${a}: unknown passive ${p}`);
  if (existsSync(join(root, "ancestries", "_ancestry-schema.json")))
    checkSchema(join(root, "ancestries", "_ancestry-schema.json"), d, `ancestry/${a}`);
}
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log("OK: counts + ancestry refs resolve.");
