// ============================================================
// ToolProgressBar.tsx — Live tool execution progress indicator
// Shows which agent tools are running/done in real time
// ============================================================

import React from 'react';
import type { ToolProgressEvent } from '../../types';

interface ToolProgressBarProps {
  tools: ToolProgressEvent[];
}

const statusIcon = (status: ToolProgressEvent['status']) => {
  if (status === 'running') {
    return (
      <svg className="h-3.5 w-3.5 animate-spin text-teal-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    );
  }
  if (status === 'done') {
    return <span className="text-green-500 text-xs">✓</span>;
  }
  return <span className="text-red-400 text-xs">✕</span>;
};

export const ToolProgressBar: React.FC<ToolProgressBarProps> = ({ tools }) => {
  console.log('[ToolProgressBar] render', { toolCount: tools.length });

  if (tools.length === 0) return null;

  return (
    <div className="mx-4 mb-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Agent working…
      </p>
      <ul className="space-y-1">
        {tools.map((tool, i) => (
          <li key={`${tool.toolName}-${i}`} className="flex items-center gap-2 text-xs text-slate-600">
            {statusIcon(tool.status)}
            <span
              className={
                tool.status === 'done'
                  ? 'text-slate-400 line-through'
                  : tool.status === 'error'
                  ? 'text-red-500'
                  : 'text-slate-700'
              }
            >
              {tool.label}
            </span>
            {tool.durationMs !== undefined && (
              <span className="ml-auto text-slate-300">{tool.durationMs}ms</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};