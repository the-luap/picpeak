/**
 * Sticky editor toolbar (#1289).
 *
 * On the CMS page the editor has no bounded height, so a long document
 * scrolls the whole admin content area and the toolbar scrolled away with
 * it — editing a 16-section privacy policy meant scrolling back up for every
 * heading. Two things make the toolbar stick to the page's scroller, and
 * both are easy to lose in a refactor: the toolbar block is `sticky` (from
 * md up, so a phone's wrapped toolbar does not eat the editing area), and
 * the rounded wrapper clips with `overflow-clip` rather than
 * `overflow-hidden`, because hidden turns the wrapper into a scroll
 * container and the toolbar would pin to that instead of to the page.
 *
 * jsdom does not lay out, so this pins the source.
 */
import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';

const source = fs.readFileSync(path.resolve(__dirname, '../CMSEditor.tsx'), 'utf8');

describe('CMS editor toolbar stays in reach on long pages', () => {
  it('sticks the toolbar block to the page scroller from md up', () => {
    expect(source).toMatch(/className="[^"]*\bmd:sticky md:top-0 md:z-10\b[^"]*"/);
  });

  it('keeps the link-entry row inside the sticky block', () => {
    const sticky = source.indexOf('md:sticky md:top-0 md:z-10');
    const linkRow = source.indexOf('{showLinkDialog && (');
    const contentArea = source.indexOf('{/* Editor Content Area */}');
    expect(sticky).toBeGreaterThan(-1);
    expect(linkRow).toBeGreaterThan(sticky);
    expect(linkRow).toBeLessThan(contentArea);
    // The block closes after the link row, not before it.
    const between = source.slice(linkRow, contentArea);
    expect((between.match(/^ {8}<\/div>$/m) || []).length).toBe(1);
  });

  it('scrolls the selection clear of the pinned toolbar, sized from the rendered block', () => {
    // The formatting row wraps at common desktop widths and the link row
    // comes and goes, so a constant offset would be wrong half the time.
    expect(source).toMatch(/ref=\{toolbarRef\}[^>]*md:sticky/);
    expect(source).toMatch(/new ResizeObserver\(apply\)/);
    expect(source).toMatch(/scrollMargin: \{ top: height \+ \d+/);
    expect(source).toMatch(/scrollThreshold: \{ top: height \+ \d+/);
    expect(source).toMatch(/matchMedia\('\(min-width: 768px\)'\)/);
  });

  it('clips the rounded wrapper without creating a scroll container', () => {
    const wrapper = source.match(/className="([^"]*\brounded-lg\b[^"]*\bh-full flex flex-col\b[^"]*)"/);
    expect(wrapper).not.toBeNull();
    expect(wrapper![1]).toContain('overflow-clip');
    expect(wrapper![1]).not.toContain('overflow-hidden');
  });
});
