const specificHandicap = {
  'gross-stroke': 'No handicap allowance. Every golfer is ranked on gross strokes.',
  flag: '100% of Playing Handicap is added to the selected course par to create each golfer\'s stroke budget.',
  eclectic: 'Gross Eclectic uses no deduction in the final result. Nett Eclectic uses the Playing Handicap captured for the competition.',
  foursomes: '50% of the partners\' combined Course Handicaps.',
  'foursomes-match': '50% of the difference between the sides\' combined Course Handicaps.',
  greensomes: '60% of the lower Course Handicap plus 40% of the higher Course Handicap.',
  gruesomes: 'Uses the Greensomes allowance: 60% low plus 40% high Course Handicap.',
  pinehurst: '60% of the lower Course Handicap plus 40% of the higher Course Handicap.',
  scramble: 'Team allowance: 4 players use 25%/20%/15%/10% from lowest to highest Course Handicap; 3 players use 30%/20%/10%; 2 players use 35%/15%.',
  'scramble-standard': 'Team allowance: 4 players use 25%/20%/15%/10% from lowest to highest Course Handicap; 3 players use 30%/20%/10%; 2 players use 35%/15%.',
  'pairs-scramble': '35% of the lower Course Handicap plus 15% of the higher Course Handicap.',
  florida: 'Team allowance: 4 players use 25%/20%/15%/10% from lowest to highest Course Handicap; 3 players use 30%/20%/10%; 2 players use 35%/15%.',
};

const specificNotes = {
  eclectic: 'Every round stays in the audit history. The same course, tees and hole set are used throughout the series.',
  scramble: 'All golfers tee off. Choose the preferred ball, everybody plays from that position, and repeat until holed. Any minimum-drive rule is set by the organiser and followed on the course.',
  'scramble-standard': 'All golfers tee off. Choose the preferred ball, everybody plays from that position, and repeat until holed.',
  'pairs-scramble': 'Both partners play every shot from the selected position until the ball is holed.',
  florida: 'After a shot is selected, the golfer who played it sits out the next stroke. The other team members play from the selected position.',
  shamble: 'Everybody drives and the team selects one tee shot. From there, every golfer completes the hole with their own ball.',
};

export function formatInformation(format, rule, label, configuredAllowance) {
  const category = rule?.category || 'individual';
  const participants = category === 'pairs'
    ? 'Pairs. Each pair can use an optional team name; otherwise GGC displays both player names.'
    : category === 'group'
      ? 'Teams or playing groups. The required group size depends on the selected format.'
      : 'Individual golfers, except head-to-head formats that require the stated number of players.';
  const allowance = configuredAllowance ?? rule?.defaultAllowance ?? 100;
  const handicap = specificHandicap[format] || `${allowance}% Playing Handicap by default. The organiser can change the allowance during setup.`;
  return {
    title: label || format,
    participants,
    howItWorks: rule?.description || 'Competition format information is not available.',
    scoreEntry: rule?.entry || 'A dedicated score-entry workflow is required.',
    handicap,
    winner: rule?.result || 'The result calculation is not enabled.',
    note: specificNotes[format] || '',
  };
}
