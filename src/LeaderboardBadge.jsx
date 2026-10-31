import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './leaderboardBadge.css';

export default function LeaderboardBadge({ badgeImage, name = 'Team', memberLine = '', small = false }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef(null);
  const trigger = useRef(null);
  const initial = String(name || '?').trim().charAt(0).toUpperCase();
  useLayoutEffect(() => {
    if (!open) return;
    const element = dialog.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element.showModal();
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      trigger.current?.focus({ preventScroll: true });
    };
  }, [open]);

  return <>
    <button ref={trigger} type="button" className={`leaderboardBadgeTrigger${small ? ' small' : ''}`}
      aria-label={`View ${name} badge`} aria-haspopup="dialog"
      onClick={event => { event.preventDefault(); event.stopPropagation(); setOpen(true); }}>
      {badgeImage
        ? <img className={`wlResultBadge${small ? ' small' : ''}`} src={badgeImage} alt="" loading="lazy" />
        : <span className={`wlResultBadge empty${small ? ' small' : ''}`} aria-hidden="true">{initial}</span>}
    </button>
    {open && createPortal(
      <dialog ref={dialog} className="leaderboardBadgeViewer" aria-label={`${name} badge`}
        onClose={() => setOpen(false)}
        onClick={event => { event.stopPropagation(); if (event.target === event.currentTarget) setOpen(false); }}>
        <button type="button" className="leaderboardBadgeClose" aria-label="Close badge" autoFocus onClick={() => setOpen(false)}>×</button>
        <figure className="leaderboardBadgeFigure">
          {badgeImage
            ? <img className="leaderboardBadgeFullImage" src={badgeImage} alt={`${name} badge`} />
            : <span className="leaderboardBadgeFullImage leaderboardBadgeInitial" aria-hidden="true">{initial}</span>}
          <figcaption><h2>{name}</h2>{memberLine && <p>{memberLine}</p>}</figcaption>
        </figure>
      </dialog>, document.body)}
  </>;
}
