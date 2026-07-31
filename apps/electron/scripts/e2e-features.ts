import path from "node:path";

const electronRoot = path.resolve(import.meta.dirname, "..");
const repositoryRoot = path.resolve(electronRoot, "../..");
const featureIdPattern = /@[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+/g;

type Scenario = {
  id: string;
  title: string;
  file: string;
  body: string;
};

function files(pattern: string): string[] {
  return [...new Bun.Glob(pattern).scanSync({ cwd: electronRoot })].sort();
}

function featureIds(source: string): string[] {
  return source.match(featureIdPattern)?.map((id) => id.slice(1)) ?? [];
}

async function sources(pattern: string): Promise<Array<[string, string]>> {
  return Promise.all(
    files(pattern).map(async (file) => [
      file,
      await Bun.file(path.join(electronRoot, file)).text(),
    ]),
  );
}

function duplicates(ids: string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) repeated.add(id);
    seen.add(id);
  }
  return [...repeated].sort();
}

function difference(left: string[], right: string[]): string[] {
  const rightSet = new Set(right);
  return [...new Set(left.filter((id) => !rightSet.has(id)))].sort();
}

async function check(): Promise<void> {
  const featureSources = await sources("e2e/acceptance/**/*.feature");
  const acceptanceSources = await sources("e2e/acceptance/**/*.spec.ts");
  const regressionSources = await sources("e2e/regression/**/*.spec.ts");

  const declaredIds = featureSources.flatMap(([, source]) => featureIds(source));
  const implementedIds: string[] = [];
  const acceptanceWithoutId: string[] = [];

  for (const [file, source] of acceptanceSources) {
    for (const match of source.matchAll(/\btest\(\s*["'`]([^"'`]+)["'`]/g)) {
      const id = match[1].match(/^@([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+)\b/)?.[1];
      if (id) implementedIds.push(id);
      else acceptanceWithoutId.push(`${file}: ${match[1]}`);
    }
  }

  const regressionIds = regressionSources.flatMap(([file, source]) =>
    featureIds(source).map((id) => `${file}: ${id}`),
  );
  const misplacedFeatures = featureSources
    .map(([file]) => file)
    .filter((file) => !file.startsWith("e2e/acceptance/feature/"));
  const misplacedAcceptanceSpecs = acceptanceSources
    .map(([file]) => file)
    .filter((file) => !file.startsWith("e2e/acceptance/spec/"));
  const problems = [
    ...misplacedFeatures.map(
      (file) => `Feature 文件必须放在 e2e/acceptance/feature/<module>/: ${file}`,
    ),
    ...misplacedAcceptanceSpecs.map(
      (file) => `Acceptance spec 必须放在 e2e/acceptance/spec/<module>/: ${file}`,
    ),
    ...duplicates(declaredIds).map((id) => `Feature ID 重复声明: ${id}`),
    ...difference(declaredIds, implementedIds).map((id) => `Feature 缺少 acceptance 实现: ${id}`),
    ...difference(implementedIds, declaredIds).map((id) => `Acceptance 没有对应 Feature: ${id}`),
    ...acceptanceWithoutId.map((test) => `Acceptance test 缺少 Feature ID: ${test}`),
    ...regressionIds.map((entry) => `Regression test 不应包含 Feature ID: ${entry}`),
  ];

  if (problems.length > 0) {
    console.error(problems.map((problem) => `- ${problem}`).join("\n"));
    process.exit(1);
  }

  console.log(
    `Feature coverage OK: ${declaredIds.length} scenarios, ${implementedIds.length} acceptance tests, ${regressionSources.length} regression specs.`,
  );
}

function runGit(args: string[]): string {
  const result = Bun.spawnSync(["git", ...args], { cwd: repositoryRoot });
  if (result.exitCode !== 0) {
    throw new Error(new TextDecoder().decode(result.stderr).trim());
  }
  return new TextDecoder().decode(result.stdout);
}

function parseScenarios(file: string, source: string): Scenario[] {
  const lines = source.split(/\r?\n/);
  const positions: Array<{ scenario: number; tags: number }> = [];

  for (let index = 0; index < lines.length; index += 1) {
    if (!/^\s*(?:场景|Scenario)(?:大纲| Outline)?:/.test(lines[index])) continue;

    let tags = index - 1;
    while (tags >= 0 && lines[tags].trim() === "") tags -= 1;
    if (tags < 0 || !lines[tags].trim().startsWith("@")) continue;
    positions.push({ scenario: index, tags });
  }

  return positions.flatMap((position, index) => {
    const tagLine = lines[position.tags];
    const id = featureIds(tagLine)[0];
    if (!id) return [];

    const title = lines[position.scenario].replace(
      /^\s*(?:场景|Scenario)(?:大纲| Outline)?:\s*/,
      "",
    );
    const end = positions[index + 1]?.tags ?? lines.length;
    const body = lines.slice(position.tags, end).join("\n").trim();
    return [{ id, title, file, body }];
  });
}

async function currentScenarios(): Promise<Map<string, Scenario>> {
  const featureSources = await sources("e2e/acceptance/feature/**/*.feature");
  return new Map(
    featureSources
      .flatMap(([file, source]) => parseScenarios(file, source))
      .map((item) => [item.id, item]),
  );
}

function baseScenarios(ref: string): Map<string, Scenario> {
  const paths = runGit(["ls-tree", "-r", "--name-only", ref, "--", "apps/electron/e2e"])
    .split("\n")
    .filter((file) => file.endsWith(".feature"));
  const scenarios = paths.flatMap((file) => {
    const source = runGit(["show", `${ref}:${file}`]);
    return parseScenarios(path.relative("apps/electron", file), source);
  });
  return new Map(scenarios.map((item) => [item.id, item]));
}

function printGroup(heading: string, items: Scenario[], format: (item: Scenario) => string): void {
  if (items.length === 0) return;
  console.log(`\n${heading} (${items.length})`);
  for (const item of items.sort((a, b) => a.id.localeCompare(b.id))) {
    console.log(format(item));
  }
}

async function diff(ref: string): Promise<void> {
  const before = baseScenarios(ref);
  const after = await currentScenarios();
  const added = [...after.values()].filter((item) => !before.has(item.id));
  const removed = [...before.values()].filter((item) => !after.has(item.id));
  const changed = [...after.values()].filter((item) => {
    const previous = before.get(item.id);
    return previous && previous.body !== item.body;
  });
  const moved = [...after.values()].filter((item) => {
    const previous = before.get(item.id);
    return previous && previous.body === item.body && previous.file !== item.file;
  });

  console.log(`Feature changes vs ${ref}`);
  printGroup("Added", added, (item) => `+ ${item.id} ${item.title} (${item.file})`);
  printGroup("Removed", removed, (item) => `- ${item.id} ${item.title} (${item.file})`);
  printGroup("Changed", changed, (item) => {
    const previous = before.get(item.id)!;
    const location = previous.file === item.file ? item.file : `${previous.file} -> ${item.file}`;
    return `~ ${item.id} ${previous.title} -> ${item.title} (${location})`;
  });
  printGroup("Moved", moved, (item) => {
    const previous = before.get(item.id)!;
    return `> ${item.id} ${item.title} (${previous.file} -> ${item.file})`;
  });

  if (added.length + removed.length + changed.length + moved.length === 0) {
    console.log("No Feature changes.");
  }
}

const [command = "check", argument = "origin/master"] = Bun.argv.slice(2);

if (command === "check") {
  await check();
} else if (command === "diff") {
  await diff(argument);
} else {
  console.error("Usage: bun run scripts/e2e-features.ts <check|diff> [base-ref]");
  process.exit(1);
}
