import {useEffect} from 'react';

export function usePullToRefresh(refresh) {
  useEffect(() => {
    if (!refresh) return;
    let start = null;
    const atTop = () => window.scrollY <= 0;

    function onStart(event) {
      start = null;
      if (!atTop() || event.touches.length !== 1) return;
      for (let el = event.target; el instanceof Element; el = el.parentElement) {
        if (el.scrollTop > 0 || el.matches('input, textarea, select, [contenteditable], [role="dialog"]')) return;
      }
      const touch = event.touches[0];
      start = {x: touch.clientX, y: touch.clientY};
    }

    function onEnd(event) {
      const origin = start;
      start = null;
      if (!origin || !atTop() || event.touches.length) return;
      const touch = event.changedTouches[0];
      if (!touch) return;
      const down = touch.clientY - origin.y;
      if (down >= 90 && down > 2 * Math.abs(touch.clientX - origin.x)) void refresh();
    }

    function cancel() { start = null; }

    window.addEventListener('touchstart', onStart, {passive: true});
    window.addEventListener('touchend', onEnd, {passive: true});
    window.addEventListener('touchcancel', cancel, {passive: true});
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', cancel);
    };
  }, [refresh]);
}
