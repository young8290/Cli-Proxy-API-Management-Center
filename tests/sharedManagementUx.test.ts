// @ts-expect-error Bun test runtime types are not included in the production tsconfig.
import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Button } from '../src/components/ui/Button';
import { EmptyState } from '../src/components/ui/EmptyState';

const componentsStyles = await Bun.file(
  new URL('../src/styles/components.scss', import.meta.url)
).text();
const globalStyles = await Bun.file(new URL('../src/styles/global.scss', import.meta.url)).text();
const mixins = await Bun.file(new URL('../src/styles/mixins.scss', import.meta.url)).text();
const themes = await Bun.file(new URL('../src/styles/themes.scss', import.meta.url)).text();
const layoutStyles = await Bun.file(new URL('../src/styles/layout.scss', import.meta.url)).text();

describe('shared management controls', () => {
  test('exposes loading state while preventing repeated button activation', () => {
    const markup = renderToStaticMarkup(
      createElement(Button, { loading: true }, 'Refresh management data')
    );

    expect(markup).toContain('disabled=""');
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('Refresh management data');
  });

  test('announces an empty state without placing its action inside the live region', () => {
    const markup = renderToStaticMarkup(
      createElement(EmptyState, {
        title: 'No providers',
        description: 'Add a provider to continue.',
        action: createElement('button', null, 'Add provider'),
      })
    );

    expect(markup).toContain('class="empty-content" role="status"');
    expect(markup.indexOf('role="status"')).toBeLessThan(markup.indexOf('Add a provider'));
    expect(markup.indexOf('Add provider')).toBeGreaterThan(markup.indexOf('role="status"'));
  });

  test('keeps shared controls at a 44px pointer target with keyboard-only focus rings', () => {
    expect(componentsStyles).toContain('min-height: 44px');
    expect(componentsStyles).toContain('&:focus-visible');
    expect(mixins).toContain('&:focus-visible');
    expect(mixins).not.toContain('&:focus {');
  });

  test('wraps management feedback and honors reduced motion preferences', () => {
    expect(componentsStyles).toContain('overflow-wrap: anywhere');
    expect(globalStyles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(globalStyles).toContain('animation-duration: 0.01ms');
  });

  test('uses semantic contrast tokens and tabular management counts', () => {
    expect(themes).toContain('--danger-contrast: #ffffff');
    expect(themes).toContain('--danger-hover:');
    expect(componentsStyles).toContain('font-variant-numeric: tabular-nums');
    expect(layoutStyles).toContain('--floating-control-size: 44px');
    expect(layoutStyles).not.toContain('overflow-x: hidden');
  });
});
