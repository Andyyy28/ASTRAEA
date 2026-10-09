import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const NotificationContext = createContext(null);
const TOAST_DURATION = 3000;

const flowerIcon = String.fromCodePoint(10047);
const heartIcon = String.fromCodePoint(9825);
const starIcon = String.fromCodePoint(10022);

const toastStyles = {
  success: {
    title: `Yay! ${heartIcon}`,
    icon: flowerIcon,
    iconBg: '#A8DFC9',
    border: 'border-[#A8DFC9]',
    borderLeft: 'border-l-[#A8DFC9]',
    shadow: 'shadow-[4px_4px_0px_#D5F0E8]',
    titleColor: '#2D7A5F',
  },
  error: {
    title: `Oops! ${starIcon}`,
    icon: '!',
    iconBg: '#F9A8C9',
    border: 'border-[#F9A8C9]',
    borderLeft: 'border-l-[#F9A8C9]',
    shadow: 'shadow-[4px_4px_0px_#FDDDE6]',
    titleColor: '#C4658A',
  },
  info: {
    title: `Hey there! ${flowerIcon}`,
    icon: heartIcon,
    iconBg: '#C9A8E8',
    border: 'border-[#C9A8E8]',
    borderLeft: 'border-l-[#C9A8E8]',
    shadow: 'shadow-[4px_4px_0px_#E8D5F5]',
    titleColor: '#7B4FA8',
  },
};

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const timersRef = useRef(new Map());
  const toastSequenceRef = useRef(0);
  const confirmRef = useRef(null);
  const dialogRef = useRef(null);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const showToast = useCallback(({ type = 'info', title, message }) => {
    const id = `toast-${toastSequenceRef.current++}`;
    setToasts(prev => [...prev, { id, type, title, message }]);
    const timer = window.setTimeout(() => removeToast(id), TOAST_DURATION);
    timersRef.current.set(id, timer);
    return id;
  }, [removeToast]);

  const showConfirm = useCallback(({ title, message, confirmText = 'Yes, go ahead', cancelText = `Never mind ${heartIcon}` }) =>
    new Promise((resolve) => {
      if (confirmRef.current?.resolve) confirmRef.current.resolve(false);
      const next = {
        title,
        message,
        confirmText,
        cancelText,
        resolve,
      };
      confirmRef.current = next;
      setConfirmState(next);
    }), []);

  const handleCloseConfirm = useCallback((result) => {
    if (confirmRef.current?.resolve) confirmRef.current.resolve(result);
    confirmRef.current = null;
    setConfirmState(null);
  }, []);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach(timer => window.clearTimeout(timer));
      timers.clear();
      if (confirmRef.current?.resolve) confirmRef.current.resolve(false);
      confirmRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!confirmState) return;
    const previous = document.activeElement;
    const dialog = dialogRef.current;
    dialog?.querySelector('button')?.focus();
    const keydown = event => {
      if (event.key === 'Escape') { event.preventDefault(); handleCloseConfirm(false); }
      if (event.key !== 'Tab') return;
      const buttons = dialog?.querySelectorAll('button:not([disabled])');
      if (!buttons?.length) return;
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); previous?.focus?.(); };
  }, [confirmState, handleCloseConfirm]);

  return (
    <NotificationContext.Provider value={{ showToast, showConfirm }}>
      {children}

      <div className="fixed top-4 right-4 left-4 sm:left-auto z-[70] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => {
          const style = toastStyles[toast.type] || toastStyles.info;
          return (
            <div
              role="status"
              aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
              key={toast.id}
              className={`pointer-events-auto w-full sm:w-[300px] max-w-[calc(100vw-2.5rem)] rounded-[16px] border-2 ${style.border} border-l-[5px] ${style.borderLeft} bg-white ${style.shadow} px-4 py-3 font-body text-[#3D2C35] animate-toast-in`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full text-white" style={{ backgroundColor: style.iconBg }}>
                  <span className="text-base font-bold">{style.icon}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="pr-8 font-heading text-base font-bold" style={{ color: style.titleColor }}>
                    {toast.title || style.title}
                  </div>
                  <p className="mt-1 text-sm leading-5">{toast.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeToast(toast.id)}
                  className="ml-2 text-lg leading-none text-[#6B5560] hover:text-[#3D2C35]"
                  aria-label="Dismiss notification"
                >
                  ×
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {confirmState && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[#3D2C35]/45 px-4 opacity-100 animate-confirm-fade"
          onClick={() => handleCloseConfirm(false)}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirmation-title"
            aria-describedby="confirmation-message"
            className="relative w-full max-w-[320px] rounded-[24px] border-2 border-dashed border-[#F4BFCF] bg-white px-6 py-8 shadow-[6px_6px_0px_#F9A8C9] animate-confirm-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute left-1/2 top-0 h-2 w-[calc(100%-2rem)] -translate-x-1/2 rounded-full bg-[#F9A8C9]" />
            <div className="mx-auto mb-4 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[#F9A8C9] text-2xl text-white">
              {starIcon}
            </div>
            <h3 id="confirmation-title" className="text-center font-heading text-[18px] font-bold text-[#3D2C35]">
              {confirmState.title}
            </h3>
            <p id="confirmation-message" className="mt-2 text-center text-sm text-[#6B5560]">
              {confirmState.message}
            </p>
            <div className="my-5 border-t border-dashed border-[#F4BFCF]" />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handleCloseConfirm(false)}
                className="kawaii-btn-outline flex-1 px-4 py-3 text-sm"
              >
                {confirmState.cancelText}
              </button>
              <button
                type="button"
                onClick={() => handleCloseConfirm(true)}
                className="kawaii-btn-primary flex-1 bg-[#F9A8C9] px-4 py-3 text-sm text-white"
              >
                {confirmState.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
};
