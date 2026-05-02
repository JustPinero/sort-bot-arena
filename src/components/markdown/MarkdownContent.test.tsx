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
      <MarkdownContent>{"**Hi** <script>alert(1)</script>"}</MarkdownContent>,
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
});
