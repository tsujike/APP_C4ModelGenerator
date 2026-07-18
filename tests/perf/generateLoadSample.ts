/**
 * T5-2: NFR-3(総ノード200・エッジ300規模で、解析+全レベルレイアウト再計算が1秒以内)を
 * 計測するための負荷サンプル生成スクリプト。
 *
 * 実際にパーサ(splitBlocks/parseC4Block/parseClassBlock)を通す本物のDSLテキストを組み立てる
 * (モデルオブジェクトを直接組み立てるのではなく、`buildModel`の入力になるMermaid C4サブセット
 * テキストを生成する。実装指示書T5-2「解析+全レベルレイアウト再計算」を計測するには、解析
 * フェーズもパイプラインに含める必要があるため)。
 *
 * 生成する規模(設計書§5.2/§5.3の文法に厳密に従う。他のsamples/*.tsと同じDSL):
 *   - L1: Person 5 + System(internal) 15 + System_Ext 5 = 25ノード
 *   - L2: 各internal Systemに3 Containerずつ = 45ノード
 *   - L3: 各Containerに2 Componentずつ(全45コンテナに適用) = 90ノード
 *   - L4: 先頭20個のComponentにclassDiagram(2クラスずつ) = 40ノード
 *   合計200ノード。
 *
 *   - L1エッジ: Person→System(3本ずつ)15 + internalSystem→externalSystem 15 = 30本
 *   - L2エッジ: Container間チェーン30 + Person→先頭Container 15 + 末尾Container→外部System 15
 *     + 埋め合わせ用メッシュ(Container間、規模を300本に合わせるための追加分)100 = 160本
 *   - L3エッジ: Component間チェーン45 + Component→次Containerのメッシュ45 = 90本
 *   - L4エッジ: クラス間チェーン(classDiagramを持つ20コンポーネント分)20本
 *   合計300本。
 *
 * ノード数・エッジ数は生成ロジックから機械的に導出した値を `expectedNodeCount`/
 * `expectedEdgeCount` として返す(定数を後で変更しても計測側が追従できるようにするため。
 * ハードコードした数値との食い違いを防ぐ)。
 */

const PERSON_COUNT = 5;
const INTERNAL_SYSTEM_COUNT = 15;
const EXTERNAL_SYSTEM_COUNT = 5;
const CONTAINERS_PER_SYSTEM = 3;
const COMPONENTS_PER_CONTAINER = 2;
const COMPONENT_CLASS_TARGET_COUNT = 20;
const CLASSES_PER_COMPONENT = 2;
/** L2の基本エッジ(チェーン+person→先頭+末尾→外部)に加え、300エッジ規模に合わせるための埋め合わせ。 */
const L2_FILLER_EDGE_COUNT = 100;

export interface LoadSample {
  source: string;
  expectedNodeCount: number;
  expectedEdgeCount: number;
}

/** NFR-3計測用の負荷サンプル(約200ノード/300エッジ規模)を生成する。 */
export function generateLoadSample(): LoadSample {
  const personAliases: string[] = [];
  const internalSystemAliases: string[] = [];
  const externalSystemAliases: string[] = [];
  const allContainerAliases: string[] = [];
  const containersBySystem = new Map<string, string[]>();
  const allComponentAliases: string[] = [];
  const componentsByContainer = new Map<string, string[]>();

  let edgeCount = 0;

  // ---- L1: C4Context ----
  const contextLines: string[] = ['C4Context', '  title 負荷テスト用サンプル - Context'];
  for (let i = 0; i < PERSON_COUNT; i++) {
    const alias = `person${String(i)}`;
    personAliases.push(alias);
    contextLines.push(`  Person(${alias}, "利用者${String(i)}")`);
  }
  for (let i = 0; i < INTERNAL_SYSTEM_COUNT; i++) {
    const alias = `sys${String(i)}`;
    internalSystemAliases.push(alias);
    contextLines.push(`  System(${alias}, "内部システム${String(i)}")`);
  }
  for (let i = 0; i < EXTERNAL_SYSTEM_COUNT; i++) {
    const alias = `ext${String(i)}`;
    externalSystemAliases.push(alias);
    contextLines.push(`  System_Ext(${alias}, "外部システム${String(i)}")`);
  }
  for (let i = 0; i < PERSON_COUNT; i++) {
    for (let k = 0; k < 3; k++) {
      const sys = internalSystemAliases[(i * 3 + k) % internalSystemAliases.length];
      contextLines.push(`  Rel(${personAliases[i]!}, ${sys!}, "利用する")`);
      edgeCount++;
    }
  }
  for (let i = 0; i < internalSystemAliases.length; i++) {
    const ext = externalSystemAliases[i % externalSystemAliases.length];
    contextLines.push(`  Rel(${internalSystemAliases[i]!}, ${ext!}, "連携する")`);
    edgeCount++;
  }

  // ---- L2: C4Container ----
  const containerLines: string[] = ['C4Container'];
  for (const sysAlias of internalSystemAliases) {
    const containersForSys: string[] = [];
    containerLines.push(`  System_Boundary(${sysAlias}, "${sysAlias}境界") {`);
    for (let c = 0; c < CONTAINERS_PER_SYSTEM; c++) {
      const alias = `${sysAlias}_c${String(c)}`;
      containersForSys.push(alias);
      allContainerAliases.push(alias);
      containerLines.push(`    Container(${alias}, "コンテナ${alias}", "Tech")`);
    }
    containerLines.push('  }');
    containersBySystem.set(sysAlias, containersForSys);
  }
  for (const sysAlias of internalSystemAliases) {
    const containers = containersBySystem.get(sysAlias);
    if (containers === undefined) continue;
    for (let i = 0; i < containers.length - 1; i++) {
      containerLines.push(`  Rel(${containers[i]!}, ${containers[i + 1]!}, "呼び出す")`);
      edgeCount++;
    }
    containerLines.push(`  Rel(${personAliases[0]!}, ${containers[0]!}, "利用する")`);
    edgeCount++;
    const ext =
      externalSystemAliases[internalSystemAliases.indexOf(sysAlias) % externalSystemAliases.length];
    containerLines.push(`  Rel(${containers[containers.length - 1]!}, ${ext!}, "通知する")`);
    edgeCount++;
  }
  for (let i = 0; i < L2_FILLER_EDGE_COUNT; i++) {
    const a = allContainerAliases[i % allContainerAliases.length];
    const b = allContainerAliases[(i + 7) % allContainerAliases.length];
    if (a === undefined || b === undefined || a === b) continue;
    containerLines.push(`  Rel(${a}, ${b}, "連携${String(i)}")`);
    edgeCount++;
  }

  // ---- L3: C4Component ----
  const componentLines: string[] = ['C4Component'];
  for (const containerAlias of allContainerAliases) {
    const componentsForContainer: string[] = [];
    componentLines.push(`  Container_Boundary(${containerAlias}, "${containerAlias}境界") {`);
    for (let k = 0; k < COMPONENTS_PER_CONTAINER; k++) {
      const alias = `${containerAlias}_k${String(k)}`;
      componentsForContainer.push(alias);
      allComponentAliases.push(alias);
      componentLines.push(`    Component(${alias}, "コンポーネント${alias}", "Tech")`);
    }
    componentLines.push('  }');
    componentsByContainer.set(containerAlias, componentsForContainer);
  }
  for (const containerAlias of allContainerAliases) {
    const components = componentsByContainer.get(containerAlias);
    if (components === undefined) continue;
    for (let i = 0; i < components.length - 1; i++) {
      componentLines.push(`  Rel(${components[i]!}, ${components[i + 1]!}, "内部呼び出し")`);
      edgeCount++;
    }
  }
  for (let idx = 0; idx < allContainerAliases.length; idx++) {
    const containerAlias = allContainerAliases[idx];
    if (containerAlias === undefined) continue;
    const components = componentsByContainer.get(containerAlias);
    if (components === undefined || components.length < 2) continue;
    const target = allContainerAliases[(idx + 1) % allContainerAliases.length];
    componentLines.push(`  Rel(${components[1]!}, ${target!}, "読み書き")`);
    edgeCount++;
  }

  // ---- L4: classDiagram(先頭 COMPONENT_CLASS_TARGET_COUNT 個のComponentにのみ付与) ----
  const classLines: string[] = [];
  let componentsWithClasses = 0;
  for (const componentAlias of allComponentAliases) {
    if (componentsWithClasses >= COMPONENT_CLASS_TARGET_COUNT) break;
    componentsWithClasses++;
    const classAliases: string[] = [];
    classLines.push(`%% code-of: ${componentAlias}`);
    classLines.push('classDiagram');
    for (let c = 0; c < CLASSES_PER_COMPONENT; c++) {
      const clsName = `${componentAlias}_Cls${String(c)}`;
      classAliases.push(clsName);
      classLines.push(`  class ${clsName} {`);
      classLines.push(`    +method${String(c)}()`);
      classLines.push('  }');
    }
    for (let i = 0; i < classAliases.length - 1; i++) {
      classLines.push(`  ${classAliases[i]!} --> ${classAliases[i + 1]!}`);
      edgeCount++;
    }
    classLines.push('');
  }

  const source = [
    contextLines.join('\n'),
    containerLines.join('\n'),
    componentLines.join('\n'),
    classLines.join('\n'),
  ].join('\n\n');

  const nodeCount =
    PERSON_COUNT +
    INTERNAL_SYSTEM_COUNT +
    EXTERNAL_SYSTEM_COUNT +
    allContainerAliases.length +
    allComponentAliases.length +
    componentsWithClasses * CLASSES_PER_COMPONENT;

  return { source, expectedNodeCount: nodeCount, expectedEdgeCount: edgeCount };
}
