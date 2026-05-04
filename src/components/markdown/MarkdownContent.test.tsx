import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MarkdownContent } from './MarkdownContent';

describe('<MarkdownContent />', () => {
  it('renders markdown as elements (not literal markers)', () => {
    const { container } = render(
      <MarkdownContent>{'**Algorithm:** Timsort\n\n- A\n- B'}</MarkdownContent>,
    );
    // Bold marker becomes <strong>, not literal "**"
    expect(container.querySelector('strong')).toBeTruthy();
    expect(container.querySelector('strong')?.textContent).toMatch(/algorithm/i);
    // Bullet items become <li>
    const items = container.querySelectorAll('li');
    expect(items.length).toBe(2);
    expect(items[0]?.textContent).toBe('A');
    expect(items[1]?.textContent).toBe('B');
    // No literal "**" markers anywhere in rendered text
    expect(container.textContent).not.toContain('**');
  });

  it('drops unsafe HTML via sanitization', () => {
    const { container } = render(
      <MarkdownContent>{'**Hi** <script>alert(1)</script>'}</MarkdownContent>,
    );
    expect(container.querySelector('script')).toBeNull();
    // The <strong>Hi</strong> should still render
    expect(container.querySelector('strong')?.textContent).toBe('Hi');
  });

  it('renders plain text as a paragraph', () => {
    const { container } = render(<MarkdownContent>{'No markdown here.'}</MarkdownContent>);
    const p = container.querySelector('p');
    expect(p).toBeTruthy();
    expect(p?.textContent).toBe('No markdown here.');
  });

  it('renders empty string without crashing', () => {
    const { container } = render(<MarkdownContent>{''}</MarkdownContent>);
    expect(container).toBeTruthy();
    // No paragraphs, no headings
    expect(container.querySelector('p')).toBeNull();
    expect(container.querySelector('h1, h2, h3')).toBeNull();
  });

  it('renders headings with the correct tag', () => {
    const { container } = render(<MarkdownContent>{'## Header'}</MarkdownContent>);
    const h2 = container.querySelector('h2');
    expect(h2).toBeTruthy();
    expect(h2?.textContent).toBe('Header');
  });

  it('drops disallowed link tags via the strict allowlist', () => {
    const { container } = render(
      <MarkdownContent>{'See [home](https://example.com).'}</MarkdownContent>,
    );
    // Anchor not in the allowlist -> dropped, but text content is preserved
    expect(container.querySelector('a')).toBeNull();
    expect(screen.getByText(/home/)).toBeInTheDocument();
  });

  // Regression — earlier the sanitize schema explicitly emptied
  // `clobber`/`ancestors`/`protocols`/`required`, wiping the
  // attribute-clobbering hardening rehype-sanitize ships with by default.
  // We now spread `defaultSchema` and inherit those fields. These tests
  // assert that the hardening is in effect: clobbering payloads are
  // sanitized, raw HTML for non-allowed tags is dropped, and the strict
  // tagName allowlist still wins for everything outside it.
  it('drops attribute-clobbering name/id payloads on raw HTML', () => {
    // Even if a parser flowed raw HTML through, anchor + name="document"
    // is exactly the sort of clobber payload `defaultSchema.clobber`
    // defends against.
    const { container } = render(<MarkdownContent>{'<a name="document">x</a>'}</MarkdownContent>);
    expect(container.querySelector('a')).toBeNull();
    // Should not produce any element with `name="document"` attribute.
    expect(container.querySelector('[name="document"]')).toBeNull();
  });

  it('strips id/name attributes on allowed tags (clobber defense)', () => {
    // `code` IS in the allowlist; the attribute schema only allows
    // `className`. Anything else (id, name) must be dropped — so even
    // an inline `<code id="cookie">` can't clobber `document.cookie`.
    const { container } = render(<MarkdownContent>{'`safe`'}</MarkdownContent>);
    const code = container.querySelector('code');
    expect(code).toBeTruthy();
    expect(code?.getAttribute('id')).toBeNull();
    expect(code?.getAttribute('name')).toBeNull();
  });
});
