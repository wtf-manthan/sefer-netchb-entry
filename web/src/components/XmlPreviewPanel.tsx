import React, { useState } from 'react';
import { Copy, Download, Check, AlertCircle, CheckCircle2 } from 'lucide-react';

interface XmlPreviewPanelProps {
  xml: string;
  schemaValid: boolean | null;
  schemaErrors: string[];
  readyToTransmit:boolean;blockersCount:number;disabled:boolean;onExport:(kind:'ready'|'draft'|'review')=>void;
}

export const XmlPreviewPanel: React.FC<XmlPreviewPanelProps> = ({
  xml,
  schemaValid,
  schemaErrors,
  readyToTransmit,blockersCount,disabled,onExport,
}) => {
  const [copied, setCopied] = useState(false);
  const [copyError,setCopyError]=useState('');

  const handleCopy = async () => {
    try {
      setCopyError('');await navigator.clipboard.writeText(xml);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setCopyError('Clipboard unavailable. Download the draft XML instead.');
    }
  };

  return (
    <div className="xml-preview-container">
      <div className="section-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>NetCHB uploadEntry XML</h2>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Deterministically generated XML validated against NetCHB schema definitions.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="btn btn-secondary"
            onClick={handleCopy}
            disabled={disabled||!xml}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
          >
            {copied ? <Check size={16} color="var(--primary)" /> : <Copy size={16} />}
            <span>{copied ? 'Copied!' : 'Copy XML'}</span>
          </button>
          <button
            className="btn btn-primary"
            onClick={()=>onExport('draft')}
            disabled={disabled||!xml}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
          >
            <Download size={16} />
            <span>Download draft .xml</span>
          </button>
          <button className="btn btn-primary" disabled={disabled||!readyToTransmit} onClick={()=>onExport('ready')}>Download checked XML</button>
          <button className="btn btn-secondary" disabled={disabled} onClick={()=>onExport('review')}>Download open-items report</button>
        </div>
      </div>

      {copyError&&<p role="alert">{copyError}</p>}
      <p>{readyToTransmit?'Local filing checks complete.':`${blockersCount} open blockers. Draft XML is for review and may omit required fields. Reasons appear in draft comments and the open-items report.`} Schema validity and local readiness do not prove NetCHB or CBP acceptance.</p>

      {/* SCHEMA VALIDATION BANNER */}
      <div
        style={{
          padding: '0.75rem 1rem',
          borderRadius: '6px',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          background: schemaValid ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${schemaValid ? '#bbf7d0' : '#fecaca'}`,
          color: schemaValid ? '#166534' : '#991b1b',
        }}
      >
        {schemaValid ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
        <div style={{ flex: 1, fontSize: '0.875rem' }}>
          <strong>Schema Validation: {schemaValid === null ? 'NOT GENERATED' : schemaValid ? 'PASSED (0 errors against entry.xsd)' : 'FAILED'}</strong>
          {!schemaValid && schemaErrors.length > 0 && (
            <div style={{ marginTop: '0.25rem', fontSize: '0.8rem' }}>
              {schemaErrors.map((err, idx) => (
                <div key={idx}>• {err}</div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* XML MONOSPACE CODE DISPLAY */}
      <div
        className="card"
        style={{
          background: '#0f172a',
          color: '#f8fafc',
          padding: '1rem',
          borderRadius: '6px',
          overflow: 'auto',
          maxHeight: '600px',
        }}
      >
        <pre style={{ margin: 0, fontFamily: 'Consolas, Monaco, monospace', fontSize: '0.825rem', lineHeight: '1.4' }}>
          <code>{xml || '<!-- No XML generated yet. Please process shipment documents. -->'}</code>
        </pre>
      </div>
    </div>
  );
};
