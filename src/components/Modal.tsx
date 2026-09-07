import { useEffect, type ReactNode } from "react";

export function Modal({ title, subtitle, children, footer, onClose, wide = false }: {
  title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode;
  onClose: () => void; wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="ovl" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal${wide ? " lg" : ""}`} role="dialog" aria-modal="true">
        <div className="mhead">
          <div>
            <div className="h2">{title}</div>
            {subtitle ? <div className="sub">{subtitle}</div> : null}
          </div>
          <div className="sp" />
          <button className="x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="mbody">{children}</div>
        {footer ? <div className="mfoot">{footer}</div> : null}
      </div>
    </div>
  );
}
