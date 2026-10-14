// 由扁平列表构建树
export function buildTree(list: any[], idKey = 'id', parentKey = 'parentId') {
  const map = new Map();
  list.forEach((m) => map.set(m[idKey], { ...m, children: [] }));
  const roots: any[] = [];
  map.forEach((node) => {
    const pid = node[parentKey];
    if (pid != null && map.has(pid)) map.get(pid).children.push(node);
    else roots.push(node);
  });
  return roots;
}

// 收集树中所有节点 id（含子节点）
export function collectIds(nodes: any[], acc: number[] = []) {
  nodes.forEach((n) => {
    acc.push(n.id);
    if (n.children && n.children.length) collectIds(n.children, acc);
  });
  return acc;
}
