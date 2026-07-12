// @ts-expect-error Bun test runtime types are not included in the production tsconfig.
import { describe, expect, test } from 'bun:test';

const read = (path: string) => Bun.file(new URL(path, import.meta.url)).text();

const selectorBlock = (source: string, selector: string, nested = false): string => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(
    new RegExp(`${nested ? '^\\s+' : '^'}${escaped.replace(/\\ /g, '\\s+')}\\s*\\{`, 'm')
  );
  if (!match || match.index === undefined) return '';
  const open = source.indexOf('{', match.index);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(open + 1, index);
  }
  return '';
};

const expect44pxTarget = (block: string) => {
  expect(block).toMatch(/(?:min-)?height:\s*44px/);
};

describe('retained management module pointer targets', () => {
  test('keeps each Config tab, search, icon navigation, and floating action at 44px', async () => {
    const styles = await read('../src/pages/ConfigPage.module.scss');

    expect44pxTarget(selectorBlock(styles, '.tabItem'));
    expect44pxTarget(selectorBlock(styles, '.searchInput'));
    expect(selectorBlock(styles, '.searchButton')).toContain('width: 44px');
    expect44pxTarget(selectorBlock(styles, '.searchButton'));
    expect(selectorBlock(selectorBlock(styles, '.searchActions'), 'button', true)).toContain(
      'min-width: 44px'
    );
    expect44pxTarget(selectorBlock(selectorBlock(styles, '.searchActions'), 'button', true));
    expect(selectorBlock(styles, '.floatingActionButton')).toContain('width: 44px');
    expect44pxTarget(selectorBlock(styles, '.floatingActionButton'));
  });

  test('keeps Provider header, panel, toolbar, and row actions at 44px', async () => {
    const [header, panel, toolbar, table] = await Promise.all(
      [
        '../src/features/providers/components/ProviderHeaderCard.module.scss',
        '../src/features/providers/components/ProviderResourcePanel.module.scss',
        '../src/features/providers/components/ProviderResourceToolbar.module.scss',
        '../src/features/providers/components/ProviderResourceTable.module.scss',
      ].map(read)
    );

    expect44pxTarget(selectorBlock(header, '.btn'));
    expect44pxTarget(selectorBlock(panel, '.titleLink'));
    expect44pxTarget(selectorBlock(panel, '.sponsorLink'));
    expect44pxTarget(selectorBlock(panel, '.searchInput'));
    expect44pxTarget(selectorBlock(panel, '.emptyActionButton'));
    expect44pxTarget(selectorBlock(toolbar, '.dirBtn'));
    expect44pxTarget(selectorBlock(toolbar, '.filterTrigger'));
    expect44pxTarget(selectorBlock(toolbar, '.filterToolbarBtn'));
    expect44pxTarget(selectorBlock(table, '.iconBtn'));
  });

  test('does not clip the entire application shell', async () => {
    const layout = await read('../src/styles/layout.scss');
    const appShell = selectorBlock(layout, '.app-shell');

    expect(appShell).not.toMatch(/overflow:\s*hidden/);
    expect(appShell).toContain('overflow: visible');
    expect(appShell).toContain('min-width: 0');
  });
});
