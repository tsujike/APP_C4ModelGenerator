/**
 * エラー/警告パネル(FR-2.2、設計書 docs/02_アーキテクチャ設計書.md §2の `ui/issuesPanel.ts`)。
 *
 * `ParseIssue[]` を severity + 行番号付きで一覧表示する。各項目はクリック可能で、クリックすると
 * `onJumpToLine` 経由で該当行への移動を依頼する(実際にエディタのカーソルを動かすのは
 * `EditorController.jumpToLine`の責務。本モジュールはDOM表示のみに専念し、CodeMirrorには
 * 一切依存しない)。
 *
 * 要件定義書§4「エラー/警告パネルはエディタ下部。0件時は折りたたみ。」への対応: `#issues-panel`
 * のCSS Gridの行(`grid-template-rows`)は `auto` サイズのため、0件時は最小限の1行だけを描画する
 * ことで自然に折りたたまれる(専用の開閉アニメーション等は実装しない。最単純解釈)。
 *
 * DOM操作は `excal/` と `ui/` のみに許される(実装指示書§4)。表示用の整形は純関数
 * (`formatIssue`)として切り出し、DOM非依存でテスト可能にする。
 */

import type { ParseIssue } from '../parser/types';

/** 整形後の1件分(純関数の出力。テスト可能)。 */
export interface FormattedIssue {
  readonly severityLabel: 'エラー' | '警告';
  readonly severityClass: 'issue-error' | 'issue-warning';
  /** `L<行番号>: <メッセージ>` 形式の表示テキスト。 */
  readonly text: string;
}

/** `ParseIssue` を表示用に整形する(severity→日本語ラベル/CSSクラス、行番号+メッセージの結合)。 */
export function formatIssue(issue: ParseIssue): FormattedIssue {
  const isError = issue.severity === 'error';
  return {
    severityLabel: isError ? 'エラー' : '警告',
    severityClass: isError ? 'issue-error' : 'issue-warning',
    text: `L${String(issue.line)}: ${issue.message}`,
  };
}

/** 0件時に表示する文言。 */
const EMPTY_MESSAGE = '問題なし';

export interface IssuesPanelController {
  /** 現在の issues 一覧で表示を更新する。呼ぶたびに全体を作り直す(差分更新はしない)。 */
  update(issues: readonly ParseIssue[]): void;
}

/**
 * `container` にissuesパネルを描画するコントローラを作る。
 * `onJumpToLine` はissue項目クリック時に該当行番号(1始まり)で呼ばれる。
 */
export function createIssuesPanel(
  container: HTMLElement,
  onJumpToLine: (line: number) => void,
): IssuesPanelController {
  return {
    update(issues) {
      container.replaceChildren();

      if (issues.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'issues-empty';
        empty.textContent = EMPTY_MESSAGE;
        container.appendChild(empty);
        return;
      }

      const list = document.createElement('ul');
      list.className = 'issues-list';
      for (const issue of issues) {
        const formatted = formatIssue(issue);
        const item = document.createElement('li');
        item.className = formatted.severityClass;

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'issue-item';
        button.textContent = `[${formatted.severityLabel}] ${formatted.text}`;
        button.addEventListener('click', () => {
          onJumpToLine(issue.line);
        });

        item.appendChild(button);
        list.appendChild(item);
      }
      container.appendChild(list);
    },
  };
}
