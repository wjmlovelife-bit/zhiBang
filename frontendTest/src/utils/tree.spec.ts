/**
 * utils/tree.ts 真实测试（覆盖 frontend/src/utils/tree.ts 的导出函数）
 *
 * 来源：`D:\github\xiangmutest\opencode\zhibang\frontend\src\utils\tree.ts`
 * 覆盖：
 *  - buildTree: 扁平列表 → 树（多种边界）
 *  - collectIds: 树 → id 列表（含子节点）
 *  - buildTree 嵌套级数
 *  - 自定义 idKey/parentKey
 *  - 孤儿节点处理
 *  - 空数组边界
 */
import { describe, it, expect } from 'vitest';
import { buildTree, collectIds } from '@/utils/tree';

describe('utils/tree - buildTree', () => {
  it('1. 空数组 → 返回空数组', () => {
    expect(buildTree([])).toEqual([]);
  });

  it('2. 单节点无 parent → 根节点', () => {
    const tree = buildTree([{ id: 1, name: 'A' }]);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe(1);
    expect(tree[0].children).toEqual([]);
  });

  it('3. 父子二级：parentId=1 的子节点正确归入 children', () => {
    const tree: any[] = buildTree([
      { id: 1, name: '父' },
      { id: 2, name: '子1', parentId: 1 },
      { id: 3, name: '子2', parentId: 1 },
    ]);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe(1);
    expect(tree[0].children).toHaveLength(2);
    expect(tree[0].children.map((c: any) => c.id).sort()).toEqual([2, 3]);
  });

  it('4. 三级嵌套：孙节点正确递归', () => {
    const tree: any[] = buildTree([
      { id: 1, name: '祖父' },
      { id: 2, name: '父', parentId: 1 },
      { id: 3, name: '子', parentId: 2 },
      { id: 4, name: '另一子', parentId: 2 },
    ]);
    expect(tree).toHaveLength(1);
    const grandparent = tree[0];
    expect(grandparent.children).toHaveLength(1);
    const parent = grandparent.children[0];
    expect(parent.children).toHaveLength(2);
    expect(parent.children.map((c: any) => c.id).sort()).toEqual([3, 4]);
  });

  it('5. 多个根节点（parentId=null 或缺）', () => {
    const tree: any[] = buildTree([
      { id: 1, name: '根1' },
      { id: 2, name: '根2' },
      { id: 3, name: '根1的子', parentId: 1 },
    ]);
    expect(tree).toHaveLength(2);
    const root1 = tree.find((n: any) => n.id === 1);
    expect(root1.children).toHaveLength(1);
  });

  it('6. 孤儿节点（parentId 指向不存在的 id）→ 当作根节点', () => {
    const tree: any[] = buildTree([
      { id: 1, name: '根' },
      { id: 99, name: '孤儿', parentId: 999 }, // 999 不存在
    ]);
    expect(tree).toHaveLength(2);
    expect(tree.map((n: any) => n.id).sort()).toEqual([1, 99]);
  });

  it('7. 自定义 idKey/parentKey', () => {
    const tree: any[] = buildTree(
      [
        { key: 'A', name: 'A' },
        { key: 'B', name: 'B', parent: 'A' },
      ],
      'key',
      'parent',
    );
    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].key).toBe('B');
  });

  it('8. children 是数组（含原节点其他字段）', () => {
    const tree: any[] = buildTree([
      { id: 1, name: 'A', code: 'A001' },
    ]);
    expect(tree[0].code).toBe('A001');
    expect(Array.isArray(tree[0].children)).toBe(true);
  });

  it('9. 不修改原数组（map 结构新对象）', () => {
    const orig = [{ id: 1 }, { id: 2, parentId: 1 }];
    const origJson = JSON.stringify(orig);
    buildTree(orig);
    expect(JSON.stringify(orig)).toBe(origJson);
  });
});

describe('utils/tree - collectIds', () => {
  it('10. 空数组 → 返回 []', () => {
    expect(collectIds([])).toEqual([]);
  });

  it('11. 单节点 → [id]', () => {
    expect(collectIds([{ id: 1, children: [] }])).toEqual([1]);
  });

  it('12. 嵌套树 → 含所有子节点 id（DFS 顺序）', () => {
    const ids = collectIds([
      {
        id: 1, children: [
          { id: 2, children: [] },
          { id: 3, children: [{ id: 4, children: [] }] },
        ],
      },
    ]);
    expect(ids).toEqual([1, 2, 3, 4]);
  });

  it('13. 累加到传入 acc 数组（行为记录：默认 []）', () => {
    const acc: number[] = [99];
    collectIds([{ id: 1, children: [] }], acc);
    expect(acc).toEqual([99, 1]);
  });

  it('14. 节点无 children 字段 → 不报错', () => {
    expect(collectIds([{ id: 1 }])).toEqual([1]);
  });

  it('15. 节点 children 是空数组 → 不递归', () => {
    expect(collectIds([{ id: 1, children: [] }, { id: 2, children: [] }])).toEqual([1, 2]);
  });
});

describe('utils/tree - 组合场景', () => {
  it('16. buildTree → collectIds 还原全部 id', () => {
    const list = [
      { id: 1 }, { id: 2, parentId: 1 },
      { id: 3, parentId: 1 }, { id: 4, parentId: 2 },
      { id: 5, parentId: 4 },
    ];
    const tree = buildTree(list);
    const ids = collectIds(tree);
    expect(ids.sort()).toEqual([1, 2, 3, 4, 5]);
  });
});