export interface StructuredFinding {
  id: string; code: string; severity: 'BLOCKER'|'NEEDS_DECISION'|'VERIFY'|'INFO';
  status: 'open'|'resolved'; blocking: boolean; message: string;
  invoiceId?: string; lineId?: string; entityId?: string;
  evidence: string[]; candidates?: Record<string,string|number>; resolution?: string;
}
export interface FindingsSummary { total: number; blockers: number; needsDecision: number; verify: number; info: number }
