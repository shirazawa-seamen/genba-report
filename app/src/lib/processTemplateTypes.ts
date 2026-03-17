/**
 * 工程テンプレートの型定義とクライアント/サーバー共通ユーティリティ。
 * サーバー専用のインポートを含まないため、Client Component からも安全に使用可能。
 */

export interface ProcessTemplateRecord {
  id: string;
  phaseKey: "A" | "B" | "C" | "D";
  processCode: string;
  category: string;
  name: string;
  parallelGroup: number | null;
  sortOrder: number;
  parentTemplateId: string | null;
}

export interface ProcessTemplateTreeNode extends ProcessTemplateRecord {
  children: ProcessTemplateTreeNode[];
}

/**
 * フラットなテンプレートリストをツリー構造に変換する。
 * parentTemplateId が null のものがルートノードとなる。
 */
export function buildTemplateTree(
  templates: ProcessTemplateRecord[]
): ProcessTemplateTreeNode[] {
  const nodeMap = new Map<string, ProcessTemplateTreeNode>();
  const roots: ProcessTemplateTreeNode[] = [];

  // まず全ノードを作成
  for (const t of templates) {
    nodeMap.set(t.id, { ...t, children: [] });
  }

  // 親子関係を構築
  for (const t of templates) {
    const node = nodeMap.get(t.id)!;
    if (t.parentTemplateId && nodeMap.has(t.parentTemplateId)) {
      nodeMap.get(t.parentTemplateId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}
