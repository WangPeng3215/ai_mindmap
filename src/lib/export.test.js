import { describe, expect, it } from 'vitest';
import { createDocumentFromTree } from '../domain/mindmap.js';
import { documentToMarkdown, documentToSvg, safeExportName } from './export.js';

function sampleDocument() {
  return createDocumentFromTree({
    id: 'root',
    text: '项目 <计划>',
    children: [
      { id: 'first', text: '第一阶段', children: [{ id: 'hidden', text: '隐藏细节' }] },
      { id: 'second', text: '第二阶段' },
    ],
  }, { title: '导出测试' });
}

describe('mind map exports', () => {
  it('renders a complete SVG with escaped labels and edges', () => {
    const svg = documentToSvg(sampleDocument());
    expect(svg.startsWith('<?xml version="1.0"')).toBe(true);
    expect(svg).toContain('项目 &lt;计划&gt;');
    expect(svg).toContain('第一阶段');
    expect(svg).toContain('隐藏细节');
    expect(svg).toContain('<path');
    expect(svg).toContain('viewBox="0 0 ');
  });

  it('omits collapsed descendants from visual and markdown exports', () => {
    const document = sampleDocument();
    document.nodes.first.collapsed = true;
    expect(documentToSvg(document)).not.toContain('隐藏细节');
    expect(documentToMarkdown(document)).not.toContain('隐藏细节');
  });

  it('creates safe filenames', () => {
    expect(safeExportName('需求/方案: v1', 'svg')).toBe('需求-方案- v1.svg');
    expect(safeExportName('', 'md')).toBe('mindmap.md');
  });
});
