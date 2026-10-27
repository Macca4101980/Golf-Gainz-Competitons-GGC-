export function declineCompetitionInvite(state, competitionId, playerId, now = new Date().toISOString()) {
  return {
    ...state,
    comps: (state.comps || []).map(comp => comp.id === competitionId ? {
      ...comp,
      invites: (comp.invites || []).filter(id => id !== playerId),
      declinedInvites: [...new Set([...(comp.declinedInvites || []), playerId])],
      updatedAt: now,
    } : comp),
  };
}

export function groupCodeError(code) {
  return String(code || '').trim()
    ? 'That Group code is invalid or has expired. Check the code with the organiser and try again.'
    : 'Enter a Group code to continue.';
}

export function scoreGroupStartError(format, playerIds) {
  const count = [...new Set((playerIds || []).filter(Boolean))].length;
  if (!count) return 'Choose at least one golfer.';
  if (format === '4bbb-match' && count !== 4) return 'Pairs Matchplay needs four golfers.';
  if (count > 1 && count % 2 !== 0) return 'Pairs competitions need an even number of golfers.';
  return null;
}
