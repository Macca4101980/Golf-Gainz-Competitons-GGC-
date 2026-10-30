/** One management destination per competition; orphaned league links remain editable. */
export function competitionManagementSections(state, societyId) {
 const competitions=(state.comps||[]).filter(c=>c.societyId===societyId&&c.status!=='deleted'&&!(state.deletedCompIds||[]).includes(c.id));
 const leagues=(state.leagues||[]).filter(l=>l.societyId===societyId&&!(state.deletedLeagueIds||[]).includes(l.id));
 const leagueIds=new Set(leagues.map(l=>l.id));
 return {
  standalone:competitions.filter(c=>!leagueIds.has(c.leagueId)),
  leagues:leagues.map(league=>({league,competitions:competitions.filter(c=>c.leagueId===league.id)}))
 };
}
