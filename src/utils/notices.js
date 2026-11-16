// アプリ内の通知（結果が出たカテゴリの提案: 承認・見送り）。DB は変えず、自分の提案（status = approved / rejected）を読み、
// 「読んだ」は、端末に覚える

const storageKey = (userId) => `receipt_app_read_notices_${userId}`;

// 11/11 に、以前の形式（商品名の提案）の承認待ちを、自動で見送りにしたときのメモ（DB の移行の SQL と同じ文）。この行は通知に出さない
export const LEGACY_AUTO_REJECT_NOTE =
  '提案の対象が「カテゴリ（中分類・小分類）」に変わりました。お手数ですが、もう一度提案してください。';

/** 結果が出た提案（承認・見送り）を、通知として、新しい順（確認した日時 → 提案した日時）に並べる。承認待ちと、以前の形式の自動の見送りは除く */
export const decidedNotices = (proposals) =>
  (proposals || [])
    .filter((p) => (p.status === 'approved' || p.status === 'rejected') && p.admin_note !== LEGACY_AUTO_REJECT_NOTE)
    .sort((a, b) => String(b.reviewed_at || b.created_at || '').localeCompare(String(a.reviewed_at || a.created_at || '')));

/** 提案の場所の表示（例: 常温 > 菓子 > ゼリー） */
export const noticePlace = (p) => [p.main_category, p.category, p.sub_category, p.product_name].filter(Boolean).join(' > ');

export const loadReadIds = (userId) => {
  try {
    const list = JSON.parse(localStorage.getItem(storageKey(userId)) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

export const saveReadIds = (userId, ids) => {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(ids));
  } catch {
    // 保存できなくても、この画面では読んだことにする
  }
};

/**
 * 通知の画面に並べるもの（新しい順）
 *  ・提案の結果: key は提案の id（数。以前から端末に覚えている「読んだ」と同じ）
 *  ・お知らせの小・中: key は「a:id:更新日時」（直すと、もう一度未読になる）。中は、ホームに出るので、未読に数えない（noRead）
 */
export const buildNoticeItems = (proposals, announcements) => {
  const items = [
    ...(proposals || []).map((p) => ({ ...p, kind: 'proposal', key: p.id, sortAt: p.reviewed_at || p.created_at || '' })),
    ...(announcements || [])
      .filter((a) => a.level === 'low' || a.level === 'mid')
      .map((a) => ({ ...a, kind: 'announcement', key: `a:${a.id}:${a.updated_at}`, sortAt: a.updated_at || '', noRead: a.level === 'mid' })),
  ];
  return items.sort((x, y) => String(y.sortAt).localeCompare(String(x.sortAt)));
};

/** まだ読んでいない通知（key の配列。中のお知らせは数えない） */
export const unreadIds = (items, readIds) => items.filter((n) => !n.noRead && !readIds.includes(n.key)).map((n) => n.key);
