function requireArg(value, message) {
  if (!value) throw new Error(message);
  return value;
}

export function parseCommand(args) {
  const [command = 'help', ...rest] = args;
  switch (command) {
    case 'status':
    case 'start':
    case 'canvases':
    case 'pending':
    case 'help':
      return { command };
    case 'create':
      return { command, title: requireArg(rest.join(' ').trim(), 'create 需要画布名称') };
    case 'switch':
      return { command, canvasId: requireArg(rest[0], 'switch 需要画布 ID') };
    case 'read': {
      const compact = rest.includes('--compact');
      const nodeId = rest.find((value) => value !== '--compact');
      return { command, ...(nodeId ? { nodeId } : {}), ...(compact ? { compact: true } : {}) };
    }
    case 'apply':
    case 'ops':
    case 'propose':
    case 'apply-safe':
      return { command, file: requireArg(rest[0], `${command} 需要一个 JSON 文件`) };
    case 'propose-outline':
    case 'apply-outline': {
      const file = requireArg(rest.find((value) => !value.startsWith('--layout=')), `${command} 需要一个大纲文件`);
      const layoutOption = rest.find((value) => value.startsWith('--layout='));
      return {
        command,
        file,
        ...(layoutOption ? { layoutMode: requireArg(layoutOption.slice('--layout='.length), '--layout 不能为空') } : {}),
      };
    }
    case 'request':
      return { command, message: requireArg(rest.join(' ').trim(), 'request 需要请求内容') };
    case 'complete':
      return {
        command,
        requestId: requireArg(rest[0], 'complete 需要请求 ID'),
        file: requireArg(rest[1], 'complete 需要结果文件'),
      };
    case 'apply-request':
    case 'reject-request':
      return {
        command,
        requestId: requireArg(rest[0], `${command} 需要请求 ID`),
      };
    default:
      throw new Error(`未知命令: ${command}`);
  }
}
