import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

export function render2Mkup(node: ReactNode): string {
  return renderToStaticMarkup(node);
}

export function render2Frag(node: ReactNode): DocumentFragment {
  const template = document.createElement('template');
  template.innerHTML = render2Mkup(node);
  return template.content.cloneNode(true) as DocumentFragment;
}

export function replaceChildrenWithReact(target: Element, node: ReactNode): void {
  target.replaceChildren(render2Frag(node));
}

export async function waitForDomPaint(cycles = 2): Promise<void> {
  for (let i = 0; i < cycles; i++) {
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  }
}
