/**
 * T5-2: NFR-3(総ノード200・エッジ300規模で、解析+全レベルレイアウト再計算が1秒以内)の計測。
 *
 * 実装指示書T5-2「計測時はレイアウトの遅延生成に任せず、L1〜L4の4レイアウトを明示的に強制計算して
 * 合計時間を測ること」に従い、`main.ts`のbuildLevelDataと同じ手順(project→layout→toExcalidraw)を
 * 4レベル全てについて明示的に呼び出し、キャッシュや遅延評価を一切挟まない。
 *
 * 計測結果は `console.info` で出力する(実行ログがPROGRESS.mdへの記録の一次証跡になる)。
 * このテスト自体は「本物のパーサ→モデル→レイアウトのパイプラインが200ノード/300エッジ規模で
 * クラッシュせず妥当な時間で完走すること」を担保する回帰防止用の緩い上限(10秒。実行環境差を
 * 吸収するための桁違いの安全マージンで、NFR-3の1秒という基準そのものの合否判定ではない)のみを
 * assertする。NFR-3の1秒基準に対する実測値の合否判定はPROGRESS.mdに人手で記録する
 * (指示書T5-2「未達なら原因1行と対策提案のみ、勝手に大改造しない」)。
 */
import { describe, expect, it } from 'vitest';
import { layout } from '../../src/layout/layout';
import { buildModel } from '../../src/model/build';
import { project } from '../../src/model/project';
import type { Level } from '../../src/model/types';
import { toExcalidraw } from '../../src/render/toExcalidraw';
import { generateLoadSample } from './generateLoadSample';

const ALL_LEVELS: readonly Level[] = [1, 2, 3, 4];
/** 回帰防止用の緩い上限。NFR-3本体の1000ms判定ではない(ファイル先頭コメント参照)。 */
const REGRESSION_GUARD_MS = 10_000;

describe('perf: NFR-3(200ノード/300エッジ規模、解析+全レベルレイアウト再計算)', () => {
  it('generateLoadSample produces the documented ~200 node / ~300 edge scale via the real parser pipeline', () => {
    const { source, expectedNodeCount, expectedEdgeCount } = generateLoadSample();
    const { model, issues } = buildModel(source);

    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(model.byAlias.size).toBe(expectedNodeCount);
    expect(model.edges.length).toBe(expectedEdgeCount);
  });

  it('measures parse(buildModel) + forced L1-L4 project/layout/toExcalidraw wall-clock time', async () => {
    const { source, expectedNodeCount, expectedEdgeCount } = generateLoadSample();

    const parseStart = performance.now();
    const { model, issues } = buildModel(source);
    const parseMs = performance.now() - parseStart;
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);

    const layoutStart = performance.now();
    for (const level of ALL_LEVELS) {
      const projected = project(model, level);
      const layoutResult = await layout(model, projected);
      // toExcalidrawも強制評価する(main.tsのbuildLevelDataが実際に毎回行う変換。elements配列を
      // 参照だけしてTree-shaking等で計算が飛ばされないようにする)。
      const elements = toExcalidraw(layoutResult);
      expect(elements.length).toBeGreaterThan(0);
    }
    const layoutMs = performance.now() - layoutStart;

    const totalMs = parseMs + layoutMs;

    // 実行ログ(PROGRESS.mdの一次証跡): 実測値は`npm test`の出力に残る。
    console.info(
      `[NFR-3計測] node=${String(expectedNodeCount)} edge=${String(expectedEdgeCount)} ` +
        `parse(buildModel)=${parseMs.toFixed(1)}ms layout(L1-L4 project+layout+toExcalidraw合計)=${layoutMs.toFixed(1)}ms ` +
        `total=${totalMs.toFixed(1)}ms (NFR-3基準: 1000ms以内)`,
    );

    expect(totalMs).toBeLessThan(REGRESSION_GUARD_MS);
  });
});
