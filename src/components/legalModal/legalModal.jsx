import './legalModal.css';
import { formatPurchaseDate } from '../../utils/purchaseDate';

/**
 * 利用規約・プライバシーポリシーを全文表示する（新規登録・設定画面から開く）
 * @param {{ title: string, version: string, sections: { heading: string, body: string[] }[] }} doc
 */
export default function LegalModal({ doc, onClose }) {
  if (!doc) return null;

  return (
    <div className="legal-overlay" onClick={onClose}>
      <div
        className="legal-card"
        role="dialog"
        aria-modal="true"
        aria-label={doc.title}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="legal-header">
          <h2 className="legal-title">{doc.title}</h2>
          <span className="legal-version">制定日：{formatPurchaseDate(doc.version)}</span>
        </header>

        <div className="legal-body">
          {doc.sections.map((section, sectionIndex) => (
            <section key={sectionIndex} className="legal-section">
              {/* 前文のように、見出しのない部分もある */}
              {section.heading && <h3 className="legal-heading">{section.heading}</h3>}
              {section.body.map((text, textIndex) => (
                <p key={textIndex} className="legal-text">{text}</p>
              ))}
            </section>
          ))}
        </div>

        <footer className="legal-footer">
          <button type="button" className="legal-close-button" onClick={onClose}>
            閉じる
          </button>
        </footer>
      </div>
    </div>
  );
}
