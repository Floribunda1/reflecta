export function getRuntimeArg(name: string): string | undefined {
  const flag = `--${name}`;
  const prefix = `${flag}=`;

  for (let index = 0; index < process.argv.length; index++) {
    const arg = process.argv[index];
    if (arg === flag) return process.argv[index + 1];
    if (arg.startsWith(prefix)) return arg.slice(prefix.length);
  }

  return undefined;
}
