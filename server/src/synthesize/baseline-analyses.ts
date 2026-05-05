// Pre-written scouting reports for the 10 baseline production bots.
// Used as a fallback by `GET /api/v1/bots/:id/analysis` when upstream
// returns empty or errors out (sandbox flakiness has been intermittent
// in production; this keeps the Scouting Report tab presentable). When
// upstream eventually generates real analysis content, that takes
// precedence — see `routes/bots.ts:/:id/analysis`.
//
// Format mirrors what `formatAnalysis()` produces from the upstream
// shape: a header block, bulleted strengths/weaknesses/use-cases/
// anti-patterns, and a closing reasoning paragraph. Markdown only;
// no raw HTML (sanitized by `MarkdownContent` regardless).

const BASELINE_ANALYSES: Record<string, string> = {
  // std-go — Heap Hydra, rank 1
  '679beb22e6a1d8e27b7539a51cebf8a5': `**Algorithm:** Go standard library \`sort.Sort\` (pdqsort hybrid)
**Time complexity:** O(n log n) average and worst case
**Space complexity:** O(log n) auxiliary

**Strengths**
- Hybrid pdqsort with insertion-sort cutoff for small partitions
- Excellent cache locality on contiguous slices
- Battle-hardened — backs every \`sort.Slice\` call in production Go code

**Weaknesses**
- Not stable; equal keys can reorder
- No specialized fast path for nearly-sorted input vs. timsort

Pdqsort's pivot heuristics + the insertion-sort cutoff make this the
most consistent performer across input distributions. Lacks the
adaptive runs detection of timsort but pays back in raw throughput.`,

  // merge-go — Bloom Bandit, rank 2
  '4b4fd56bc679f6410a67199b1fdfbd74': `**Algorithm:** Top-down recursive mergesort
**Time complexity:** O(n log n) every case
**Space complexity:** O(n) auxiliary

**Strengths**
- Strict O(n log n) — no worst-case degradation
- Stable; equal keys preserve insertion order
- Predictable behavior across input distributions

**Weaknesses**
- O(n) auxiliary memory hurts on large inputs
- Recursion depth on pathological cases can stress the stack
- Loses to in-place sorts on cache-bound benchmarks

A textbook divide-and-conquer implementation. The stability + worst-case
guarantee make it the right call when correctness matters more than
absolute throughput.`,

  // heap-go — Pointer Pete, rank 3
  '563f405f8a364a40624ad1ebf1650c25': `**Algorithm:** Iterative heapsort (binary max-heap)
**Time complexity:** O(n log n) every case
**Space complexity:** O(1) auxiliary

**Strengths**
- In-place; no auxiliary buffers
- Worst-case O(n log n) regardless of input
- Heap-up/heap-down loops vectorize cleanly on modern CPUs

**Weaknesses**
- Poor cache behavior — sift operations jump across the array
- Not stable
- Slower than mergesort on most real-world inputs by a constant factor

Useful when memory is constrained and you can't afford the O(n) buffer
mergesort needs. Pays for it in cache misses on every comparison.`,

  // timsort-py — Compare Cobra, rank 4
  '36ac87d2f29016cabe79add553a27306': `**Algorithm:** Python built-in \`list.sort\` (Timsort)
**Time complexity:** O(n log n) worst case, O(n) on already-sorted runs
**Space complexity:** O(n) auxiliary

**Strengths**
- Detects and exploits existing sorted runs (real-world input is rarely random)
- Stable; preserves insertion order on equal keys
- Used unmodified by Java, Android, Python, V8 — well-tested at scale

**Weaknesses**
- Python interpreter overhead — comparisons cost more than in compiled code
- O(n) auxiliary memory
- Beaten by pdqsort on uniformly random arrays

Timsort dominates on partially-sorted data, which describes most real
applications. Python's deferral to it for \`list.sort\` is a vote of
confidence — algorithm correctness matters more than the language tax.`,

  // counting-py — Branch Breaker, rank 5
  '6bc72d887d0087074be937fc2a399b6d': `**Algorithm:** Counting sort (non-comparison, integer)
**Time complexity:** O(n + k) where k is the value range
**Space complexity:** O(k) auxiliary

**Strengths**
- Linear time when k is bounded
- Stable when implemented with the prefix-sum technique
- No comparisons — sidesteps the O(n log n) lower bound

**Weaknesses**
- Memory cost grows with the value range, not just n
- Useless for large or unbounded keys
- Requires non-negative integer input or an offset shift

Niche but devastating when the input fits its constraints. Loses badly
when the value range explodes (millions of distinct keys, 32-bit ints,
strings, anything floating-point). Read your input distribution first.`,

  // quick-js — Linear Lord, rank 6
  e0272770f8ed065bae99ab1dcda6115a: `**Algorithm:** Lomuto-partition quicksort
**Time complexity:** O(n log n) average, O(n²) worst case
**Space complexity:** O(log n) recursion stack

**Strengths**
- Tight inner loop — partitions in a single pass
- Cache-friendly on contiguous arrays
- Iterative tail-call elimination keeps stack depth bounded

**Weaknesses**
- Worst-case O(n²) on sorted input or pathological pivots
- Not stable
- No insertion-sort cutoff — overhead on small partitions

A textbook quicksort, no median-of-three, no introspective fallback.
Fast when the pivot picks land right; brittle when they don't. The
production answer is pdqsort (std-go) — this is the simpler ancestor.`,

  // merge-js — Index Inferno, rank 7
  '8cc21f881a706d84b8afc61a83b30726': `**Algorithm:** Iterative bottom-up mergesort
**Time complexity:** O(n log n) every case
**Space complexity:** O(n) auxiliary

**Strengths**
- Iterative — no recursion stack overhead
- Stable; preserves equal-key order
- Worst-case guarantee with no input-distribution sensitivity

**Weaknesses**
- O(n) buffer allocation
- Loses to V8's built-in TimSort (\`Array.prototype.sort\`) on real-world inputs
- JS engine doesn't vectorize merge loops as aggressively as Go/C

A clean iterative implementation. Same algorithm class as merge-go but
running through V8's interpreter overhead — competitive on stable
inputs, slower on the cache-bound benchmarks.`,

  // quick-go — Pointer Pete, rank 8
  '483b35d7ac6c240ae370493031ae9ef5': `**Algorithm:** Hoare-partition quicksort with median-of-three pivot
**Time complexity:** O(n log n) average, O(n log n) worst case (with pivot heuristic)
**Space complexity:** O(log n) recursion stack

**Strengths**
- Median-of-three avoids the worst-case on already-sorted input
- Hoare partition has tighter inner loop than Lomuto
- In-place; no auxiliary memory

**Weaknesses**
- Not stable
- Heuristic only mitigates worst case — adversarial inputs can still trigger it
- Loses to pdqsort's introspective fallback on pathological distributions

A solid quicksort with the median-of-three guard rail. Faster than the
Lomuto version (quick-js) on average; still beaten by pdqsort
(std-go) on adversarial inputs.`,

  // builtin-js — Vector Vic, rank 9
  '512c418c07c36086e04f98a27b3d9a50': `**Algorithm:** V8's \`Array.prototype.sort\` (TimSort since V8 7.0)
**Time complexity:** O(n log n) worst case, O(n) on sorted runs
**Space complexity:** O(n) auxiliary

**Strengths**
- TimSort under the hood — same family as the Python built-in
- Stable as of ECMAScript 2019; older engines could reorder equal keys
- Adaptive to existing sorted runs in the input

**Weaknesses**
- JS engine overhead (string-to-number coercion, comparator dispatch)
- Stability formally guaranteed only since ES2019
- Loses to compiled-language sorts on raw throughput

The default for \`[...arr].sort((a,b)=>a-b)\` in modern JS. Identical
algorithm class to timsort-py — wins where TimSort wins (real-world
partially-sorted data) and pays the V8-overhead tax everywhere.`,

  // insertion-py — Speculative Sue, rank 10
  '73aa0f0a62014eaf33ec6ebad00fc5d7': `**Algorithm:** Insertion sort
**Time complexity:** O(n²) average and worst case, O(n) on already-sorted input
**Space complexity:** O(1) auxiliary

**Strengths**
- O(n) on sorted or nearly-sorted input
- Trivial implementation — six lines of Python
- Stable; preserves equal-key order
- Used internally by every hybrid sort (\`std-go\`, timsort, pdqsort) for small partitions

**Weaknesses**
- O(n²) on random or reverse-sorted input — catastrophic on large arrays
- Not competitive on any benchmark over ~50 elements
- The Python interpreter loop overhead amplifies the constant factor

The honest baseline. Best as a sub-routine inside a hybrid sort — not
the top-level algorithm anyone should reach for on inputs above ~32
elements. Educational value > production value.`,
};

/**
 * Look up a pre-written scouting report for a baseline production bot.
 * Returns null for any bot id outside the curated set; callers fall
 * back to whatever upstream returned (likely empty in that case).
 */
export function baselineAnalysisFor(botId: string): string | null {
  return BASELINE_ANALYSES[botId] ?? null;
}

/** Test helper — exposed so contract-drift / integration tests can
 * assert the fallback is keyed by exactly the production baseline ids. */
export function baselineAnalysisIds(): ReadonlyArray<string> {
  return Object.keys(BASELINE_ANALYSES);
}
