import React from 'react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: '1', desc: 'Switch to Forecast & Backtest mode' },
    { key: '2', desc: 'Switch to Model Leaderboard mode' },
    { key: '3', desc: 'Switch to Exploratory Analysis (EDA) mode' },
    { key: '4', desc: 'Switch to Residual Diagnostics mode' },
    { key: '?', desc: 'Toggle keyboard shortcuts cheatsheet' },
    { key: 'Esc', desc: 'Close open modals and dialogs' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <span className="text-xl">⌨️</span>
            <h3 className="text-lg font-bold text-white">Keyboard Shortcuts</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {shortcuts.map((s, idx) => (
            <div key={idx} className="flex items-center justify-between py-1.5 border-b border-slate-800/50">
              <span className="text-sm text-slate-300">{s.desc}</span>
              <kbd className="px-2.5 py-1 text-xs font-semibold text-sky-400 bg-slate-800 border border-slate-700 rounded-md shadow-sm">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors"
          >
            Got it (Esc)
          </button>
        </div>
      </div>
    </div>
  );
};
