export const LANGUAGE_TEMPLATES: Record<
  'python' | 'node' | 'binary',
  { language: string; filename: string; source: string }
> = {
  python: {
    language: 'python',
    filename: 'bot.py',
    source: `# Sort bot — read newline-separated integers from stdin,
# write them sorted ascending, one per line, to stdout.
import sys

def main() -> None:
    data = [int(x) for x in sys.stdin.read().split() if x]
    data.sort()
    sys.stdout.write('\\n'.join(str(x) for x in data))

if __name__ == '__main__':
    main()
`,
  },
  node: {
    language: 'javascript',
    filename: 'bot.js',
    source: `// Sort bot — read newline-separated integers from stdin,
// write them sorted ascending, one per line, to stdout.
const fs = require('fs');
const input = fs.readFileSync(0, 'utf8');
const out = input
  .trim()
  .split(/\\s+/)
  .map(Number)
  .sort((a, b) => a - b)
  .join('\\n');
process.stdout.write(out);
`,
  },
  binary: {
    language: 'plaintext',
    filename: 'bot.bin',
    source: `# Compiled binary bots: upload the binary instead. The /submit
# page accepts a binary upload directly. The editor preview is for
# Python / Node / Go.
`,
  },
};
