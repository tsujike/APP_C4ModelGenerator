import { describe, expect, it } from 'vitest';
import { formatIssue } from '../../src/ui/issuesPanel';

describe('formatIssue', () => {
  it('errorをissue-errorクラス+「エラー」ラベルに整形する', () => {
    const result = formatIssue({ severity: 'error', line: 12, message: 'alias重複' });
    expect(result.severityClass).toBe('issue-error');
    expect(result.severityLabel).toBe('エラー');
    expect(result.text).toBe('L12: alias重複');
  });

  it('warningをissue-warningクラス+「警告」ラベルに整形する', () => {
    const result = formatIssue({ severity: 'warning', line: 3, message: '未対応の文' });
    expect(result.severityClass).toBe('issue-warning');
    expect(result.severityLabel).toBe('警告');
    expect(result.text).toBe('L3: 未対応の文');
  });
});
