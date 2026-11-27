import { fetchMyOtherItems, applyItemCategories } from './receiptDb';
import {
  planReassign,
  groupReview,
  categoryTableFingerprint,
  loadFingerprint,
  saveFingerprint,
  loadSkipIds,
  addSkipIds,
  addRun,
  markRunUndone,
} from './reassignOther';
import { prepareRecategorize } from './recategorize';

// 印の形の版。「その他」以外の見直し（utils/recategorize.js）を足したとき（11/27）に上げた → 全員、1 回だけ、調べ直す
const FP_VERSION = 'v2';

/**
 * 「その他」の商品を、増えたカテゴリへ、自動で移す（確実なものだけ。utils/reassignOther.js）
 *  ・カテゴリ表の商品の一覧が、前に調べたときから変わったときだけ動く（ふだんは、通信しない）
 *  ・移したものは、記録（通知に出す。「元に戻す」ができる）に残す
 *  ・「その他」以外で、移せそうな商品（utils/recategorize.js）は、移さずに、件数だけを記録に入れる（通知から、選んで直す）
 *  ・失敗があったときは、印を更新しない（次に開いたとき、残りをやり直す）
 * @returns {Promise<{ ran: boolean, moved: number, run?: object }>}
 */
export const runAutoReassign = async (userId) => {
  const fingerprint = `${FP_VERSION}:${categoryTableFingerprint()}`;
  if (!userId || loadFingerprint(userId) === fingerprint) return { ran: false, moved: 0 };

  const loaded = await fetchMyOtherItems();
  if (!loaded.success) return { ran: false, moved: 0 };

  const plan = planReassign(loaded.data, loadSkipIds(userId));
  let run = null;
  let failed = false;
  let moves = [];
  if (plan.auto.length > 0) {
    const result = await applyItemCategories(
      plan.auto.map((m) => ({ id: m.id, main: m.to.main, category: m.to.category, sub: m.to.sub, product: m.to.product }))
    );
    failed = !result.success;
    const done = new Set(result.doneIds.map(String));
    moves = plan.auto.filter((m) => done.has(String(m.id)));
  }
  // 「その他」以外で、新しいカテゴリに移せそうな商品（移さない。数だけ）
  const recat = await prepareRecategorize(userId);
  if (!recat) failed = true; // 読めなかった → 次に開いたとき、やり直す
  const recatCount = recat ? recat.reduce((n, g) => n + g.items.length, 0) : 0;
  if (moves.length > 0 || recatCount > 0) {
    run = {
      id: String(Date.now()),
      at: new Date().toISOString(),
      moves,
      reviewCount: groupReview(plan.review).length,
      recatCount,
      undone: false,
    };
    addRun(userId, run);
  }
  if (!failed) saveFingerprint(userId, fingerprint);
  return { ran: true, moved: run ? run.moves.length : 0, run };
};

/**
 * 自動で移したものを、元に戻す。戻したものは、二度と自動では移さない
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export const undoAutoReassign = async (userId, run) => {
  const result = await applyItemCategories(
    run.moves.map((m) => ({ id: m.id, main: m.from.main, category: m.from.category, sub: m.from.sub, product: m.from.product }))
  );
  addSkipIds(userId, result.doneIds);
  if (result.success) {
    markRunUndone(userId, run.id);
    return { success: true };
  }
  return { success: false, error: `${result.failedIds.length} 件を元に戻せませんでした。もう一度お試しください。` };
};
