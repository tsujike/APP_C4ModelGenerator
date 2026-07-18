import { describe, expect, it } from 'vitest';
import { buildModel } from '../../src/model/build';
import { project } from '../../src/model/project';
import { internetBankingSample } from '../../src/samples/internet-banking';
import type { Level } from '../../src/model/types';

/**
 * internet-banking サンプル(4レベルフル構成)を使った project() の統合テスト。
 * 個々の射影規則は project.test.ts の小規模ケースで検証済みのため、ここでは
 * 「サンプル全体を通して壊れていないか」をスナップショットで、かつ実装指示書 T2-1 の
 * 完了条件(「L1表示時に api→email 等のエッジが ibs→email に集約される」)を明示的に確認する。
 */
describe('project: internet-banking サンプル統合テスト', () => {
  const { model, issues } = buildModel(internetBankingSample);

  it('produces zero errors when parsing the sample', () => {
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
  });

  it.each([1, 2, 3, 4] as const)('produces a stable projected graph at level %d', (level) => {
    const graph = project(model, level);
    expect(graph.level).toBe(level);
    expect(graph.edges).toMatchSnapshot();
  });

  it('never leaves a self-loop (from === to) after projection, at any level', () => {
    for (const level of [1, 2, 3, 4] as const satisfies readonly Level[]) {
      const graph = project(model, level);
      expect(graph.edges.every((e) => e.from !== e.to)).toBe(true);
    }
  });

  it('aggregates api->email and notification->email (and the L1 ibs->email edge) into a single ibs->email edge at L1 (T2-1完了条件)', () => {
    const graph = project(model, 1);

    // api/notification は L2/L3 の要素なので、L1では折りたたまれてibs内部に消え、
    // 端点として一切現れない(境界に折りたたまれた=射影先ではなくなる)。
    expect(graph.edges.some((e) => e.from === 'api' || e.to === 'api')).toBe(false);
    expect(graph.edges.some((e) => e.from === 'notification' || e.to === 'notification')).toBe(
      false,
    );

    const ibsToEmail = graph.edges.find((e) => e.from === 'ibs' && e.to === 'email');
    expect(ibsToEmail).toBeDefined();
    // 元エッジ3本(Context: ibs->email, Container: api->email, Component: notification->email)が集約される。
    expect(ibsToEmail?.mergedCount).toBe(3);
    expect(ibsToEmail?.label).toBe('通知を依頼 (+2)');
  });

  it('aggregates spa->signin/spa->transferSvc into spa->api, and accounts->db/transferSvc->db into api->db, at L2', () => {
    const graph = project(model, 2);

    const spaToApi = graph.edges.find((e) => e.from === 'spa' && e.to === 'api');
    expect(spaToApi?.mergedCount).toBe(3);
    expect(spaToApi?.label).toBe('呼び出す (+2)');

    const apiToDb = graph.edges.find((e) => e.from === 'api' && e.to === 'db');
    expect(apiToDb?.mergedCount).toBe(3);
    expect(apiToDb?.label).toBe('読み書き (+2)');

    // transferSvc->notification は同じComponent境界(api)内部の関係になるため自己ループとして消える。
    expect(graph.edges.some((e) => e.from === 'api' && e.to === 'api')).toBe(false);
  });

  it('leaves every edge unaggregated at L3 (no two raw edges share a projected endpoint pair)', () => {
    const graph = project(model, 3);

    // L3ではまだComponent同士が可視のため、L2までのような集約は発生しない
    // (classDiagramのエッジ2本のみが、それぞれのComponent内部への自己ループとして消える)。
    expect(graph.edges.every((e) => e.mergedCount === 1)).toBe(true);
    expect(graph.edges).toHaveLength(14);
  });

  it('projects every raw edge as-is at L4 (full detail, no aggregation, no drops other than none)', () => {
    const graph = project(model, 4);

    expect(graph.edges).toHaveLength(model.edges.length);
    expect(graph.edges.every((e) => e.mergedCount === 1)).toBe(true);
  });
});
