const money = value => Math.round((Number(value) || 0) * 100) / 100;

/** Build the read-only weekly 2s ledger used by League Money. */
export function leagueTwosLedger({ league, weeks = [], players = [], cards = [], contributionPerPlayer = 0 }) {
  const playerById = new Map(players.map(player => [player.id, player]));
  const memberIds = new Set((league?.memberIds || []).filter(id => playerById.has(id)));
  const scheduledWeeks = Math.max(1, Number(league?.targetCompetitions) || weeks.length || 1);
  const weeklyContribution = money(memberIds.size * (Number(contributionPerPlayer) || 0) / scheduledWeeks);
  let carry = 0;
  const payouts = [];

  const ledger = weeks.map((week, index) => {
    const comp = week.comp || week;
    const status = week.status || comp.status || 'live';
    const completed = status === 'completed';
    const carryIn = carry;
    const pot = money(weeklyContribution + carryIn);
    const entries = Array.isArray(comp.entries) && comp.entries.length ? new Set(comp.entries) : memberIds;
    const eligibleIds = new Set([...entries].filter(id => memberIds.has(id)));
    const hits = [];

    for (const card of cards) {
      if (card.compId !== comp.id || !eligibleIds.has(card.playerId)) continue;
      (card.gross || []).forEach((gross, holeIndex) => {
        if (gross !== '' && gross !== null && gross !== undefined && Number(gross) === 2) {
          const player = playerById.get(card.playerId);
          if (player) hits.push({ playerId: card.playerId, name: player.name, hole: holeIndex + 1 });
        }
      });
    }

    let carryOut = carry;
    const byPlayer = new Map();
    if (completed && hits.length) {
      const totalCents = Math.round(pot * 100);
      const evenShareCents = Math.floor(totalCents / hits.length);
      const remainderCents = totalCents - evenShareCents * hits.length;
      for (const [index, hit] of hits.entries()) {
        const entry = byPlayer.get(hit.playerId) || { playerId: hit.playerId, name: hit.name, holes: [], amount: 0 };
        entry.holes.push(hit.hole);
        const hitCents = evenShareCents + (index < remainderCents ? 1 : 0);
        entry.amount = money(entry.amount + hitCents / 100);
        byPlayer.set(hit.playerId, entry);
      }
      for (const winner of byPlayer.values()) {
        payouts.push({
          key: `twos-${comp.id}-${winner.playerId}`,
          playerId: winner.playerId,
          name: winner.name,
          reason: `Week ${index + 1} 2s`,
          amount: winner.amount,
        });
      }
      carryOut = 0;
    } else if (completed) {
      carryOut = pot;
    }

    carry = money(carryOut);
    return {
      compId: comp.id,
      name: comp.name || `Week ${index + 1}`,
      status,
      completed,
      weeklyContribution,
      carryIn,
      pot,
      hits,
      winners: [...byPlayer.values()],
      carryOut: carry,
    };
  });

  return { weeklyContribution, carryForward: carry, weeks: ledger, payouts };
}
