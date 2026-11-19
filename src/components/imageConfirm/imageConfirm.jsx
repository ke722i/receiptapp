import { useState, useEffect, useRef } from 'react';
import './imageConfirm.css';
import { compressImage } from "../../utils/imageUtils";
import { parseReceiptImage } from "../../utils/receiptParser";
import ConfirmDialog from '../confirmDialog/confirmDialog';
import ScanSteps from '../scanSteps/scanSteps';
import Icon from '../icon/icon';

// 読み取り中に、何をしているかを、順に出す（時間がたつと、次の文に変える）
const ANALYZE_STAGES = [
  { at: 0, text: '画像を軽くしています' },
  { at: 1500, text: 'レシートの文字を読み取っています' },
  { at: 6000, text: '商品ごとに、カテゴリを分けています' },
  { at: 15000, text: 'もう少しで終わります（長いレシートは、時間がかかります）' },
];

/**
 * 画像の確認と、AI の解析
 * @param {Function} [onManualEntry] 解析できなかったとき（AI の混雑・1 日の上限・読み取り失敗）に、
 *   「手動で入力する」を押すと呼ぶ。{ compressedImage }（軽くした画像。作れなかったときは null）
 */
export default function ImageConfirm({ imageSrc, onCancel, onNavigateToCrop, onAnalysisComplete, onManualEntry }) {
  const [isAnalyzing, setIsAnalyzing] = useState(false); // 分析中ローディング状態
  const [stage, setStage] = useState(0); // 読み取りの、今の段階（ANALYZE_STAGES）
  const runRef = useRef(0); // 読み取りの回数。キャンセルしたら増やして、前の結果を使わない

  // 読み取り中は、時間に合わせて、文を進める
  useEffect(() => {
    if (!isAnalyzing) return undefined;
    const timers = ANALYZE_STAGES.slice(1).map((s, i) => setTimeout(() => setStage(i + 1), s.at));
    return () => timers.forEach(clearTimeout);
  }, [isAnalyzing]);
  // 解析できなかったときのポップアップ（null = 出さない）。{ message, compressedImage }
  const [failure, setFailure] = useState(null);

  // 解析できなかったとき: 「閉じる」（もう一度試せる）か「手動で入力する」を選んでもらう
  const showFailure = (message, compressedImage) => {
    if (onManualEntry) {
      setFailure({ message, compressedImage });
    } else {
      alert(message);
    }
  };

  const handleManualEntry = async () => {
    let compressedImage = failure?.compressedImage || null;
    setFailure(null);
    if (!compressedImage && imageSrc) {
      try {
        compressedImage = await compressImage(imageSrc, 1280, 1280, 0.85);
      } catch {
        compressedImage = null; // 画像が軽くできなくても、手動の入力はできる（元の画像を使う）
      }
    }
    onManualEntry({ compressedImage });
  };

  // 「分析する」クリック時の実際のAI解析フロー
  const handleStartAnalysis = async () => {
    if (!imageSrc) return;
    const run = ++runRef.current;
    setStage(0);
    setIsAnalyzing(true);
    let compressedForManual = null;

    try {
      // 1. 画像の軽量化・リサイズ処理を自動実行
      const compressedBase64 = await compressImage(imageSrc, 1280, 1280, 0.85);
      compressedForManual = compressedBase64;

      // 2. Gemini API で高速かつ正確に解析（店舗名正規化・JSON化も内部で適用済み）
      const parseResult = await parseReceiptImage(compressedBase64);
      if (run !== runRef.current) return; // キャンセルした（結果は使わない）

      setIsAnalyzing(false);

      if (!parseResult.success) {
        showFailure(parseResult.error, compressedBase64);
        return;
      }

      if (onAnalysisComplete) {
        // 解析結果と圧縮済み画像を渡して次の画面へ遷移
        onAnalysisComplete({
          parsedData: parseResult.data,
          compressedImage: compressedBase64,
        });
      }
    } catch (error) {
      console.error('レシート解析中にエラーが発生しました:', error);
      if (run !== runRef.current) return;
      setIsAnalyzing(false);
      showFailure('レシートの解析に失敗しました。もう一度お試しください。', compressedForManual);
    }
  };

  // 分析キャンセル処理
  //  （送った画像の読み取りは止められないが、結果は使わず、この画面に戻る）
  const handleCancelAnalysis = () => {
    runRef.current += 1;
    setIsAnalyzing(false);
  };

  // --- 1. 分析中（ローディング）画面の表示 ---
  if (isAnalyzing) {
    return (
      <div className="loading-container">
        <ScanSteps current={2} />
        <main className="loading-main">
          <div className="loading-spinner-wrapper">
            <div className="loading-spinner"></div>
            <p className="loading-text">{ANALYZE_STAGES[stage].text}</p>
            <ol className="loading-stage-list" aria-hidden="true">
              {ANALYZE_STAGES.slice(0, 3).map((s, i) => (
                <li key={s.text} className={i < stage ? 'is-done' : i === stage ? 'is-current' : ''}>
                  <span className="loading-stage-dot">{i < stage ? <Icon name="check" size={12} strokeWidth={3} /> : null}</span>
                  {s.text}
                </li>
              ))}
            </ol>
          </div>
        </main>

        <footer className="loading-footer">
          <div className="loading-notice-box">
            <p className="notice-title"><Icon name="alert" size={16} strokeWidth={2.2} /> 読み取り中は、この画面のままお待ちください</p>
            <p className="notice-text">• 通信の良い所で、お待ちください。</p>
            <p className="notice-text">• 数十秒かかることがあります。</p>
          </div>

          <button
            type="button"
            className="loading-cancel-button"
            onClick={handleCancelAnalysis}
          >
            キャンセル
          </button>
        </footer>
      </div>
    );
  }

  // --- 2. 通常の画像確認画面 ---
  return (
    <div className="image-confirm-container">
      {/* 1. ヘッダー */}
      <header className="image-confirm-header">
        <h1 className="header-title">画像確認</h1>
      </header>
      <ScanSteps current={1} />

      {/* メインエリア */}
      <main className="image-confirm-main">
        <div className="image-preview-wrapper">
          {imageSrc ? (
            <img src={imageSrc} alt="選択されたレシート写真" className="preview-image" />
          ) : (
            <div className="image-placeholder">画像が選択されていません</div>
          )}

          <button
            type="button"
            className="crop-button"
            onClick={onNavigateToCrop}
          >
            <span className="crop-icon"><Icon name="scissors" size={18} /></span>
            <span>トリミング</span>
          </button>
        </div>
      </main>

      {/* 下部ボタン操作バー（トリミング画面と同じ配置: 左キャンセル / 右 実行） */}
      <div className="bottom-action-bar">
        <button
          type="button"
          className="confirm-cancel-button"
          onClick={onCancel}
        >
          キャンセル
        </button>
        <button
          type="button"
          className="analyze-button"
          onClick={handleStartAnalysis}
        >
          <span>読み取る</span>
          <span className="analyze-icon"><Icon name="chevronRight" size={20} strokeWidth={2.4} /></span>
        </button>
      </div>

      {/* 解析できなかったとき（AI の混雑・1 日の上限など）。手で入力して登録することもできる */}
      {failure && (
        <ConfirmDialog
          title="解析できませんでした"
          message={
            <>
              {failure.message}
              <br />
              <br />
              商品を手で入力して、登録することもできます。
            </>
          }
          cancelLabel="閉じる"
          confirmLabel="手動で入力する"
          onCancel={() => setFailure(null)}
          onConfirm={handleManualEntry}
        />
      )}
    </div>
  );
}