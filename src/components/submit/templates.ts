export const LANGUAGE_TEMPLATES: Record<
  'python' | 'node' | 'go' | 'binary',
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
  go: {
    language: 'go',
    filename: 'bot.go',
    source: `// Sort bot — read whitespace-separated integers from stdin,
// write them sorted ascending, one per line, to stdout.
package main

import (
\t"bufio"
\t"fmt"
\t"os"
\t"sort"
)

func main() {
\tvar nums []int
\tscanner := bufio.NewScanner(os.Stdin)
\tscanner.Buffer(make([]byte, 1<<20), 1<<24)
\tscanner.Split(bufio.ScanWords)
\tfor scanner.Scan() {
\t\tvar n int
\t\tfmt.Sscan(scanner.Text(), &n)
\t\tnums = append(nums, n)
\t}
\tsort.Ints(nums)
\twriter := bufio.NewWriter(os.Stdout)
\tdefer writer.Flush()
\tfor _, n := range nums {
\t\tfmt.Fprintln(writer, n)
\t}
}
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
