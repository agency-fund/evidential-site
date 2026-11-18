/**
 * Adapts the live API's OpenAPI spec for the reference at /api. Run by `task docs:openapi`:
 *
 *   node scripts/polish-openapi.mjs <downloaded spec> <output spec>
 *
 * The edits are for presentation only; operations, parameters, and schemas are unchanged. Fix things here only when
 * they can't be fixed in the API's source (agency-fund/evidential-be), and prefer fixing them there.
 */
import { readFileSync, writeFileSync } from "node:fs";

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error("usage: polish-openapi.mjs <input> <output>");

/** The API home's introduction, rendered as Markdown. */
const OVERVIEW = new URL("../src/api/overview.md", import.meta.url);

/** Sections for the reference's navigation, replacing the API's single tag. Order is the sidebar's order. */
const TAGS = [
  {
    name: "Experiments",
    description: "Look up the experiments on a data source and their designs.",
    operations: ["list_experiments", "get_experiment"],
  },
  {
    name: "Assignments",
    description: "Get or create participants' arm assignments, and list or export an experiment's assignments.",
    operations: [
      "get_assignment",
      "get_assignment_filtered",
      "get_assignment_cmab",
      "get_experiment_assignments",
      "get_experiment_assignments_as_csv",
    ],
  },
  {
    name: "Outcomes",
    description: "Report the outcomes of bandit experiments that use push integration.",
    operations: ["update_bandit_arm_with_participant_outcome"],
  },
];

/** Parameter descriptions the API leaves empty, keyed by name. */
const PARAMETER_DESCRIPTIONS = {
  participant_id: "Your application's identifier for the participant.",
};

/**
 * Python's inspect.cleandoc: FastAPI publishes `description="""..."""` arguments as written, so every line after the
 * first keeps the source's indentation, which Markdown renders as a code block.
 */
function cleandoc(text) {
  const lines = text.replace(/\t/g, "    ").split("\n");
  const indents = lines
    .slice(1)
    .filter((line) => line.trim())
    .map((line) => line.length - line.trimStart().length);
  const margin = indents.length ? Math.min(...indents) : 0;
  const cleaned = [lines[0].trimStart(), ...lines.slice(1).map((line) => line.slice(margin))];
  return cleaned.join("\n").trim();
}

function cleanDescriptions(node) {
  if (Array.isArray(node)) return node.forEach(cleanDescriptions);
  if (!node || typeof node !== "object") return;
  for (const [key, value] of Object.entries(node)) {
    if (key === "description" && typeof value === "string") node[key] = cleandoc(value);
    else cleanDescriptions(value);
  }
}

const spec = JSON.parse(readFileSync(input, "utf8"));
cleanDescriptions(spec);

spec.info.description = readFileSync(OVERVIEW, "utf8").trim();
spec.tags = TAGS.map(({ name, description }) => ({ name, description }));

const operations = new Map();
for (const pathItem of Object.values(spec.paths)) {
  for (const operation of Object.values(pathItem)) {
    if (operation && typeof operation === "object" && operation.operationId) {
      operations.set(operation.operationId, operation);
    }
  }
}

for (const tag of TAGS) {
  tag.operations.forEach((id, index) => {
    const operation = operations.get(id);
    if (!operation) throw new Error(`polish-openapi: operation ${id} is no longer in the spec; update TAGS`);
    operation.tags = [tag.name];
    operation["x-nimbus-order"] = index + 1;
  });
}
const untagged = [...operations.keys()].filter((id) => !TAGS.some((tag) => tag.operations.includes(id)));
if (untagged.length) throw new Error(`polish-openapi: add new operations to TAGS: ${untagged.join(", ")}`);

for (const operation of operations.values()) {
  // Summaries are page titles and sidebar labels.
  if (operation.summary) operation.summary = operation.summary.replace(/\.$/, "");
  for (const parameter of operation.parameters ?? []) {
    if (!parameter.description && PARAMETER_DESCRIPTIONS[parameter.name]) {
      parameter.description = PARAMETER_DESCRIPTIONS[parameter.name];
    }
  }
}

writeFileSync(output, `${JSON.stringify(spec, null, 2)}\n`);
