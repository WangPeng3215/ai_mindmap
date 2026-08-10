import { describe, expect, it } from 'vitest';
import { parseCommand } from './cli-args.mjs';

describe('mind-map CLI arguments', () => {
  it('parses file and request commands', () => {
    expect(parseCommand(['apply', 'map.json'])).toEqual({ command: 'apply', file: 'map.json' });
    expect(parseCommand(['read', 'branch-1'])).toEqual({ command: 'read', nodeId: 'branch-1' });
    expect(parseCommand(['read', '--compact'])).toEqual({ command: 'read', compact: true });
    expect(parseCommand(['read', 'branch-1', '--compact'])).toEqual({ command: 'read', nodeId: 'branch-1', compact: true });
    expect(parseCommand(['canvases'])).toEqual({ command: 'canvases' });
    expect(parseCommand(['start'])).toEqual({ command: 'start' });
    expect(parseCommand(['create', '产品', '规划'])).toEqual({ command: 'create', title: '产品 规划' });
    expect(parseCommand(['switch', 'canvas-1'])).toEqual({ command: 'switch', canvasId: 'canvas-1' });
    expect(parseCommand(['propose', 'proposal.json'])).toEqual({ command: 'propose', file: 'proposal.json' });
    expect(parseCommand(['apply-safe', 'proposal.json'])).toEqual({ command: 'apply-safe', file: 'proposal.json' });
    expect(parseCommand(['propose-outline', 'map.txt'])).toEqual({ command: 'propose-outline', file: 'map.txt' });
    expect(parseCommand(['apply-outline', 'map.txt', '--layout=architecture'])).toEqual({
      command: 'apply-outline', file: 'map.txt', layoutMode: 'architecture',
    });
    expect(parseCommand(['complete', 'request-1', 'reply.json'])).toEqual({
      command: 'complete',
      requestId: 'request-1',
      file: 'reply.json',
    });
    expect(parseCommand(['apply-request', 'request-1'])).toEqual({
      command: 'apply-request',
      requestId: 'request-1',
    });
  });

  it('joins free-form request text', () => {
    expect(parseCommand(['request', '规划', '一个', '产品'])).toEqual({
      command: 'request',
      message: '规划 一个 产品',
    });
  });

  it('rejects missing required arguments', () => {
    expect(() => parseCommand(['apply'])).toThrow('JSON 文件');
    expect(() => parseCommand(['complete', 'request-1'])).toThrow('结果文件');
    expect(() => parseCommand(['create'])).toThrow('画布名称');
    expect(() => parseCommand(['propose-outline'])).toThrow('大纲文件');
  });
});
