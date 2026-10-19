export function teamBandLayout(playerCount) {
  const count = Math.max(0, Math.min(4, Number(playerCount) || 0));
  const teamASpan = Math.min(2, count);
  const teamBSpan = Math.max(0, count - teamASpan);
  return {
    teamA: `2 / span ${teamASpan}`,
    teamB: teamBSpan ? `${2 + teamASpan} / span ${teamBSpan}` : null,
  };
}
