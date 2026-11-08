import React from 'react';
import {leaderboardPayoutLines} from './leaderboardPayouts.js';

export default function LeaderboardPayoutSummary({c,state}) {
 const lines = leaderboardPayoutLines(c,state);
 return lines.length ? <div className="leaderboardPayoutSummary" aria-label="Competition payouts">{lines.map(line=><p key={line}>{line}</p>)}</div> : null;
}
