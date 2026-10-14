// tests/unit/tree.spec.ts —— 工具函数：扁平列表构建树 / 收集 id
import { describe, it, expect } from 'vitest';
import { buildTree, collectIds } from '@/utils/tree';

describe('utils/tree', () => {
  describe('buildTree', () => {
    it('空列表返回空数组', () => {
      expect(buildTree([])).toEqual([]);
    });

    it('单层平铺（无 parentId）全为根', () => {
      const list = [
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
        { id: 3, name: 'C' },
      ];
      const roots = buildTree(list);
      expect(roots).toHaveLength(3);
      expect(roots.map((r) => r.id)).toEqual([1, 2, 3]);
      roots.forEach((r) => expect(r.children).toEqual([]));
    });

    it('典型多级：2 个根 + 各带子节点', () => {
      const list = [
        { id: 1, parentId: null, name: 'root1' },
        { id: 2, parentId: null, name: 'root2' },
        { id: 3, parentId: 1, name: 'child1.1' },
        { id: 4, parentId: 1, name: 'child1.2' },
        { id: 5, parentId: 2, name: 'child2.1' },
      ];
      const roots = buildTree(list);
      expect(roots).toHaveLength(2);
      const r1 = roots.find((r) => r.id === 1);
      expect(r1.children).toHaveLength(2);
      expect(r1.children.map((c: any) => c.id)).toEqual([3, 4]);
    });

    it('孤儿节点（parentId 指向不存在的 id）作为根返回', () => {
      const list = [
        { id: 1, parentId: 999, name: 'orphan' },
      ];
      const roots = buildTree(list);
      expect(roots).toHaveLength(1);
      expect(roots[0].id).toBe(1);
    });

    it('可自定义 id/parentKey', () => {
      const list = [
        { uuid: 'a', pid: null },
        { uuid: 'b', pid: 'a' },
      ];
      const roots = buildTree(list, 'uuid', 'pid');
      expect(roots).toHaveLength(1);
      expect(roots[0].children).toHaveLength(1);
    });
  });

  describe('collectIds', () => {
    it('空树返回空数组', () => {
      expect(collectIds([])).toEqual([]);
    });

    it('递归收集所有 id', () => {
      const tree = [
        { id: 1, children: [{ id: 2, children: [{ id: 3 }] }, { id: 4 }] },
        { id: 5 },
      ];
      expect(collectIds(tree)).toEqual([1, 2, 3, 4, 5]);
    });
  });
});
