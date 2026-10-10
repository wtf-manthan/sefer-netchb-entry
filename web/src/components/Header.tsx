import React from 'react';
import { CheckCircle2, AlertCircle, FileCheck, ShieldAlert } from 'lucide-react';

interface HeaderProps {
  schemaValid: boolean | null;
  schemaErrorCount: number;
  readyToTransmit: boolean | null;
  blockersCount: number;
  isProcessing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  schemaValid,
  schemaErrorCount,
  readyToTransmit,
  blockersCount,
  isProcessing,
}) => {
  return (
    <header className="header">
      <div className="header-brand">
        <FileCheck className="text-primary" size={28} />
        <div>
          <h1>NetCHB Entry XML & Customs Extraction</h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
            Document review and deterministic entry preparation
          </p>
        </div>
      </div>

      <div className="status-badges-group">
        {/* Status 1: Schema Validity Badge */}
        <div
          className={`status-pill ${
            schemaValid === true ? 'pass' : schemaValid === false ? 'fail' : 'warning'
          }`}
          title="Validation against spec/entry.xsd via xmllint-wasm"
        >
          {schemaValid ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>
            Schema Valid: {schemaValid === true ? 'PASS' : schemaValid === false ? `FAIL (${schemaErrorCount})` : 'PENDING'}
          </span>
        </div>

        {/* Status 2: CBP Legal Transmit Readiness Badge */}
        <div
          className={`status-pill ${
            readyToTransmit === true ? 'pass' : blockersCount > 0 ? 'fail' : 'warning'
          }`}
          title="Local checks for the supported entry profile; not confirmation of filing acceptance"
        >
          {readyToTransmit ? <CheckCircle2 size={16} /> : <ShieldAlert size={16} />}
          <span>
            Ready to Transmit: {isProcessing || readyToTransmit === null ? 'PENDING' : readyToTransmit ? 'READY' : `${blockersCount} BLOCKER${blockersCount !== 1 ? 'S' : ''}`}
          </span>
        </div>
      </div>
    </header>
  );
};
