import React from 'react';

export const Modal: React.FC<{ open: boolean; children: React.ReactNode; onClose?: () => void }> = ({ open, children, onClose }) => {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        pointerEvents: 'auto',
      }}
    >
      <div
        className="card"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(900px, 96vw)', maxHeight: '90vh', overflow: 'auto', pointerEvents: 'auto' }}
      >
        {children}
      </div>
    </div>
  );
};
