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

  it('preserves the global theme in SVG exports', () => {
    const document = sampleDocument();
    document.theme = {
      background: '#101412',
      fontFamily: 'Georgia, serif',
      branchStrategy: 'rainbow',
      palette: ['#ff3366', '#22aa88'],
      defaultNodeStyle: { fill: '#202824', border: '#4b5a52', textColor: '#f5f7f6', radius: 4 },
    };

    const svg = documentToSvg(document);

    expect(svg).toContain('fill="#101412"');
    expect(svg).toContain('stroke="#ff3366"');
    expect(svg).toContain('fill="#202824"');
    expect(svg).toContain('font-family="Georgia, serif"');
  });});

describe('relationship expression exports', () => {
  it('includes relationship lines, boundaries and summaries in SVG exports', () => {
    const document = sampleDocument();
    document.relationships.push({ id: 'rel-1', sourceId: 'first', targetId: 'second', label: '依赖', arrow: true });
    document.boundaries.push({ id: 'box-1', nodeIds: ['first', 'second'], label: '阶段范围' });
    document.summaries.push({ id: 'sum-1', nodeIds: ['first', 'second'], text: '两步完成' });
    const svg = documentToSvg(document);
    expect(svg).toContain('data-kind="relationship"');
    expect(svg).toContain('依赖');
    expect(svg).toContain('data-kind="boundary"');
    expect(svg).toContain('阶段范围');
    expect(svg).toContain('data-kind="summary"');
    expect(svg).toContain('两步完成');
  });
});
