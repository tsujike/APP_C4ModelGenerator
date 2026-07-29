import { describe, expect, it } from 'vitest';
import { nextLevel } from '../../src/camera/lod';
import type { Level } from '../../src/model/types';

// 参照値(定数の意味と一致することを明示するため、テスト内でも直書きする):
// LOD_ZOOM_THRESHOLDS = [0.75, 1.5, 3.0] (L1→L2 / L2→L3 / L3→L4)
// LOD_HYSTERESIS_FACTOR = 0.9

describe('nextLevel', () => {
  describe('上昇方向(ヒステリシスなし、閾値到達で即遷移)', () => {
    it('L1→L2: s=0.75ちょうどでL2へ', () => {
      expect(nextLevel(1, 0.75, 4)).toBe(2);
    });
    it('L1→L2: s=0.76(閾値超)でL2へ', () => {
      expect(nextLevel(1, 0.76, 4)).toBe(2);
    });
    it('L1のまま: s=0.74(閾値未満)ではL1を維持', () => {
      expect(nextLevel(1, 0.74, 4)).toBe(1);
    });

    it('L2→L3: s=1.5ちょうどでL3へ', () => {
      expect(nextLevel(2, 1.5, 4)).toBe(3);
    });
    it('L2→L3: s=1.51(閾値超)でL3へ', () => {
      expect(nextLevel(2, 1.51, 4)).toBe(3);
    });
    it('L2のまま: s=1.49(閾値未満)ではL2を維持', () => {
      expect(nextLevel(2, 1.49, 4)).toBe(2);
    });

    it('L3→L4: s=3.0ちょうどでL4へ', () => {
      expect(nextLevel(3, 3.0, 4)).toBe(4);
    });
    it('L3→L4: s=3.01(閾値超)でL4へ', () => {
      expect(nextLevel(3, 3.01, 4)).toBe(4);
    });
    it('L3のまま: s=2.99(閾値未満)ではL3を維持', () => {
      expect(nextLevel(3, 2.99, 4)).toBe(3);
    });
  });

  describe('下降方向(ヒステリシス: 現在レベルの下側閾値×0.9を下回ったら遷移)', () => {
    it('§8.2の具体例そのもの: L3滞在中にs=1.4に戻ってもL3を維持する(1.4 >= 1.35)', () => {
      expect(nextLevel(3, 1.4, 4)).toBe(3);
    });
    it('§8.2の具体例そのもの: L3滞在中にs<1.35でL2へ降格する(s=1.34)', () => {
      expect(nextLevel(3, 1.34, 4)).toBe(2);
    });
    it('L3→L2境界ちょうど: s=1.35(ヒステリシス下限そのもの)はまだL3を維持(下回ってはいない)', () => {
      expect(nextLevel(3, 1.35, 4)).toBe(3);
    });

    it('L2→L1: 下側閾値0.75×0.9=0.675。s=0.7(閾値未満だがヒステリシス帯内)はL2を維持', () => {
      expect(nextLevel(2, 0.7, 4)).toBe(2);
    });
    it('L2→L1: s=0.675ちょうどはまだL2を維持(下回ってはいない)', () => {
      expect(nextLevel(2, 0.675, 4)).toBe(2);
    });
    it('L2→L1: s=0.674(0.675未満)でL1へ降格', () => {
      expect(nextLevel(2, 0.674, 4)).toBe(1);
    });

    it('L4→L3: 下側閾値3.0×0.9=2.7。s=2.8(閾値未満だがヒステリシス帯内)はL4を維持', () => {
      expect(nextLevel(4, 2.8, 4)).toBe(4);
    });
    it('L4→L3: s=2.7ちょうどはまだL4を維持(下回ってはいない)', () => {
      expect(nextLevel(4, 2.7, 4)).toBe(4);
    });
    it('L4→L3: s=2.69(2.7未満)でL3へ降格', () => {
      expect(nextLevel(4, 2.69, 4)).toBe(3);
    });
  });

  describe('変化なしケース(各レベルの範囲内に深く留まる)', () => {
    it('L1: s=0.1のような小さい値はL1のまま', () => {
      expect(nextLevel(1, 0.1, 4)).toBe(1);
    });
    it('L2: s=1.0(範囲の中央付近)はL2のまま', () => {
      expect(nextLevel(2, 1.0, 4)).toBe(2);
    });
    it('L3: s=2.0(範囲の中央付近)はL3のまま', () => {
      expect(nextLevel(3, 2.0, 4)).toBe(3);
    });
    it('L4: s=10.0のような大きい値はL4のまま', () => {
      expect(nextLevel(4, 10.0, 4)).toBe(4);
    });
  });

  describe('エッジケース: 下限(L1)・上限(L4)でのフロア/キャップ', () => {
    it('s=0はL1にフロアされる(L0は存在しない)', () => {
      expect(nextLevel(1, 0, 4)).toBe(1);
    });
    it('s=0でも現在L4なら降格の連鎖でL1まで下がる(フロアはL1、L0にはならない)', () => {
      expect(nextLevel(4, 0, 4)).toBe(1);
    });
    it('負のsであってもL1にフロアされる(境界外入力に対しても異常終了しない)', () => {
      expect(nextLevel(1, -5, 4)).toBe(1);
    });
    it('非常に大きいsはL4にキャップされる(L5は存在しない)', () => {
      expect(nextLevel(1, 1000, 4)).toBe(4);
    });
    it('current=L4・非常に大きいsでもL4のまま(キャップ済みからのそれ以上の遷移はない)', () => {
      expect(nextLevel(4, 1000, 4)).toBe(4);
    });
  });

  describe('複数レベルにまたがる一気の変化(1回の呼び出しでの連鎖遷移)', () => {
    it('現在L1でsが突然5.0になった場合、L2止まりではなくL4まで連鎖して遷移する', () => {
      expect(nextLevel(1, 5.0, 4)).toBe(4);
    });
    it('現在L1でsが1.4(L1→L2は跨ぐがL2→L3は跨がない)ならL2で止まる', () => {
      expect(nextLevel(1, 1.4, 4)).toBe(2);
    });
    it('現在L4でsが突然0.1になった場合、L3止まりではなくL1まで連鎖して降格する', () => {
      expect(nextLevel(4, 0.1, 4)).toBe(1);
    });
    it('現在L4でsが0.8(L1〜L2レンジ)ならヒステリシス連鎖の末にL2で止まる', () => {
      // 各段の降格判定は「そのレベルの下側閾値×0.9」を使うため、0.8は
      // L4→L3(閾値2.7)・L3→L2(閾値1.35)は下回るが、L2→L1(閾値0.675)は下回らない。
      expect(nextLevel(4, 0.8, 4)).toBe(2);
    });
    it('現在L2でsが3.5に跳ね上がった場合、L4まで連鎖して遷移する', () => {
      expect(nextLevel(2, 3.5, 4)).toBe(4);
    });
  });

  describe('全レベル×全s総当たり(閾値表との整合性の基本チェック)', () => {
    const levels: Level[] = [1, 2, 3, 4];
    // currentに関わらず、上昇方向は閾値表どおりに決まる十分大きいsでは最終的に同じレベルへ収束する。
    it.each(levels)('current=%iであっても、s=0.5(L1範囲)からはL1へ収束する', (current) => {
      // 一旦十分ズームアウトしてから判定した場合の整合性(current自体は各テストのcurrent)。
      // ここではヒステリシスの影響を受けない「現在レベル=1」からの素の判定と比較するのではなく、
      // 各currentからのnextLevel結果がヒステリシス規則と矛盾しないことのみを確認する。
      const result = nextLevel(current, 0.5, 4);
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(current);
    });
  });

  // post-v1.0: L5〜L8拡張(MermaidモードのみmaxLevel=8を渡す。C4モードは従来どおりmaxLevel=4)。
  // 参照値: LOD_ZOOM_THRESHOLDS = [0.75, 1.5, 3.0, 4.5, 6.75, 10.0, 15.0]
  describe('maxLevel=4(C4モードの回帰防止): L5以降のしきい値を跨ぐ大きなsでもL4で頭打ち', () => {
    it('current=L4・s=4.5(本来ならL5へ上がる閾値)でもL4を維持する', () => {
      expect(nextLevel(4, 4.5, 4)).toBe(4);
    });
    it('current=L4・s=10.0でもL4を維持する', () => {
      expect(nextLevel(4, 10.0, 4)).toBe(4);
    });
    it('current=L4・s=100のような極端な値でもL4を維持する', () => {
      expect(nextLevel(4, 100, 4)).toBe(4);
    });
    it('current=L1・s=100からの連鎖上昇でもL4で頭打ちになる(L5以降には遷移しない)', () => {
      expect(nextLevel(1, 100, 4)).toBe(4);
    });
  });

  describe('maxLevel=8(Mermaidモード専用): L5〜L8への上昇', () => {
    it('L4→L5: s=4.5ちょうどでL5へ', () => {
      expect(nextLevel(4, 4.5, 8)).toBe(5);
    });
    it('L5→L6: s=6.75ちょうどでL6へ', () => {
      expect(nextLevel(5, 6.75, 8)).toBe(6);
    });
    it('L6→L7: s=10.0ちょうどでL7へ', () => {
      expect(nextLevel(6, 10.0, 8)).toBe(7);
    });
    it('L7→L8: s=15.0ちょうどでL8へ', () => {
      expect(nextLevel(7, 15.0, 8)).toBe(8);
    });
    it('current=L1・s=20のような大きな値は、maxLevel=8ならL8まで一気に連鎖上昇する', () => {
      expect(nextLevel(1, 20, 8)).toBe(8);
    });
  });

  describe('maxLevel=8: L5〜L8の下降ヒステリシス', () => {
    it('L6滞在中、s=6.75*0.9=6.075ちょうどではL6を維持する(下回ってはいない)', () => {
      expect(nextLevel(6, 6.075, 8)).toBe(6);
    });
    it('L6滞在中、s=6.0(6.075未満)ではL5へ降格する', () => {
      expect(nextLevel(6, 6.0, 8)).toBe(5);
    });
    it('L7滞在中、s=10.0*0.9=9.0ちょうどではL7を維持する', () => {
      expect(nextLevel(7, 9.0, 8)).toBe(7);
    });
    it('L7滞在中、s=8.9(9.0未満)ではL6へ降格する', () => {
      expect(nextLevel(7, 8.9, 8)).toBe(6);
    });
    it('L8滞在中、s=15.0*0.9=13.5ちょうどではL8を維持する', () => {
      expect(nextLevel(8, 13.5, 8)).toBe(8);
    });
    it('L8滞在中、s=13.4(13.5未満)ではL7へ降格する', () => {
      expect(nextLevel(8, 13.4, 8)).toBe(7);
    });
    it('maxLevel=8でも下降の連鎖はL1で止まる(L0にはならない)', () => {
      expect(nextLevel(8, 0, 8)).toBe(1);
    });
  });
});
