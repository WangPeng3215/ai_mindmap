import { describe, expect, it } from 'vitest';
import { parseCommand } from './cli-args.mjs';

describe('mind-map CLI arguments', () => {
  it('parses file and request commands', () => {
    expect(parseCommand(['apply', 'map.json'])).toEqual({ command: 'apply', file: 'map.json' });
    expect(parseCommand(['complete', 'request-1', 'reply.json'])).toEqual({
      command: 'complete',
      requestId: 'request-1',
      file: 'reply.json',
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
  });
});
