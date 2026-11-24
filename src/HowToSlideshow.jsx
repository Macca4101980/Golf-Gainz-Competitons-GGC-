import React,{useRef,useState}from'react';

const tours={
 player:[
  {eyebrow:'Player tour',title:'Play and score with GGC',copy:'Join your golf Group, enter competitions and keep your scorecard up to date from your phone.',caption:'This tour shows what a golfer sees when playing in GGC.'},
  {eyebrow:'Step 1 of 6',title:'Join your golf Group',copy:'Accept an invite link or enter the joining code supplied by your Group Owner.',caption:'Your Group contains the golfers and competitions you play with.'},
  {eyebrow:'Step 2 of 6',title:'Enter a competition',copy:'Open a live competition from Home and accept the invitation or choose to enter.',caption:'The competition page shows the format, course, tees and start time.'},
  {eyebrow:'Step 3 of 6',title:'Join the playing group',copy:'The first golfer starts the round and selects the players. Everyone else joins that same live card.',caption:'One golfer can score for the group, or each player can update their own card.'},
  {eyebrow:'Step 4 of 6',title:'Score hole by hole',copy:'Enter gross strokes. GGC applies the competition rules, handicap shots and points automatically.',caption:'If the signal drops, keep scoring — saved changes are sent when you reconnect.'},
  {eyebrow:'Step 5 of 6',title:'Follow the leaderboard',copy:'See the leaders, holes played and whether the displayed result is provisional.',caption:'Some competitions deliberately hide later holes or scores until a release time.'},
  {eyebrow:'Step 6 of 6',title:'See your result',copy:'When the competition closes, open Results to view the final table, cards, 2s and league standings.',caption:'Your completed rounds remain available in the Group history.'},
  {eyebrow:'All done',title:'You’re ready to play',copy:'Join your Group, enter the competition and let GGC calculate the rest.',caption:'Reopen this guide from Home whenever you need it.'}
 ],
 admin:[
  {eyebrow:'Owner & admin tour',title:'Run golf with GGC',copy:'Create a Group, invite golfers and manage competitions, scoring and results from your phone.',caption:'This tour shows the controls available to Group Owners and Administrators.'},
  {eyebrow:'Step 1 of 6',title:'Create a Group',copy:'A Group keeps your members, competitions, leagues and history together.',caption:'The person who creates the Group becomes its Owner and can appoint Administrators.'},
  {eyebrow:'Step 2 of 6',title:'Invite your golfers',copy:'Share one invitation by WhatsApp, text or email. New golfers can register from the link.',caption:'Temporary golfers can be added first and claim their profile later without losing history.'},
  {eyebrow:'Step 3 of 6',title:'Build the competition',copy:'Choose the format, course, tees, players, handicap allowance and scoring window.',caption:'Create a one-off competition or schedule several rounds inside a league.'},
  {eyebrow:'Step 4 of 6',title:'Manage live scoring',copy:'Golfers enter their gross scores and GGC applies the selected rules and handicap calculations.',caption:'Owners and Admins can monitor cards and correct genuine mistakes when required.'},
  {eyebrow:'Step 5 of 6',title:'Share the leaderboard',copy:'Follow progress live and share a read-only leaderboard with people outside the Group.',caption:'Provisional displays, hidden holes and release times follow the competition settings.'},
  {eyebrow:'Step 6 of 6',title:'Results and prizes',copy:'Finalise the competition, review the result and track winners, 2s and payouts.',caption:'Results and league standings remain together for the full season history.'},
  {eyebrow:'All done',title:'You’re ready to organise',copy:'Create your Group, invite the golfers and let GGC run the competition.',caption:'Reopen this guide from Home whenever you need it.'}
 ]
};

function Demo({index,role,setRole,go,onClose}){
 if(index===0)return <><div className="howtoDemoHead"><b>Choose your point of view</b><span>2 MIN TOUR</span></div><RoleChoice icon="♙" title="Player" text="Joining, playing, scoring and viewing results" selected={role==='player'} onClick={()=>setRole('player')}/><RoleChoice icon="⚙" title="Administrator / Group Owner" text="Creating Groups, competitions and managing results" selected={role==='admin'} onClick={()=>setRole('admin')}/><button className="primary howtoAction" disabled={!role} onClick={()=>role&&go(1)}>{role?`START ${role==='admin'?'ADMIN':'PLAYER'} WALKTHROUGH`:'CHOOSE A VIEWPOINT'}</button></>;
 if(role==='player')return <PlayerDemo index={index} go={go} onClose={onClose}/>;
 return <AdminDemo index={index} go={go} onClose={onClose}/>;
}

function PlayerDemo({index,go,onClose}){
 if(index===1)return <PlayerGroupsDemo/>;
 if(index===2)return <PlayerCompetitionDemo/>;
 if(index===3)return <PlayerStartGroupDemo/>;
 if(index===4)return <PlayerScorecardDemo/>;
 if(index===5)return <PlayerLeaderboardDemo/>;
 if(index===6)return <PlayerResultsDemo/>;
 return <Finish role="player" go={go} onClose={onClose}/>;
}

function PlayerGroupsDemo(){return <div className="playerAppMock playerGroupsMock"><div className="playerMockTitle"><b>Groups</b><small>Manage the golfers you play with.</small></div><PlayerGroup name="Weekend Golf Group" members="8 members"/><PlayerGroup name="Society Golf Group" members="16 members"/><button className="playerMockPrimary">＋&nbsp;&nbsp; CREATE / JOIN GROUP</button></div>}
function PlayerGroup({name,members}){return <div className="playerGroupTile"><span><b>{name}</b><small>{members}</small></span><strong>›</strong></div>}
function PlayerCompetitionDemo(){return <div className="playerAppMock playerCompetitionMock"><div className="playerMockBack">‹ <span><b>Saturday Competition</b><small>Example Golf Club · Yellow</small></span></div><div className="playerCompCard"><span className="playerFlag">⚑</span><div><small>INDIVIDUAL STABLEFORD</small><b>Saturday Competition</b><p>18 holes · Starts 08:00</p></div><em>LIVE</em></div><div className="playerCompInfo"><span><small>COURSE</small><b>Example Golf Club</b></span><span><small>TEES</small><b>Yellow</b></span></div><button className="playerMockPrimary">ACCEPT &amp; ENTER</button></div>}
function PlayerStartGroupDemo(){return <div className="playerLightMock playerStartMock"><b>WHO ARE YOU SCORING FOR?</b><p>Choose 1–4 golfers. Anyone in this group can later open the same live round and score for the group.</p><PlayerSelect label="Golfer 1" value="Golfer A"/><PlayerSelect label="Golfer 2" value="Golfer B"/><PlayerSelect label="Golfer 3" value="No golfer"/><PlayerSelect label="Golfer 4" value="No golfer"/><button className="playerMockPrimary">START GROUP SCORECARD</button></div>}
function PlayerSelect({label,value}){return <label className="playerSelect"><small>{label}</small><span>{value}<b>⌄</b></span></label>}
function PlayerScorecardDemo(){return <div className="playerAppMock playerScorecardMock"><button className="playerLeaderboardToggle">♜&nbsp;&nbsp; VIEW LIVE LEADERBOARD</button><PlayerScoreTable/><div className="playerScoreActions"><span>SCORECARD LIST</span><span>CHANGE GROUP</span></div></div>}
function PlayerScoreTable(){return <div className="playerScoreTable"><div className="playerScoreHeader"><span>HOLE</span><b>GOLFER A<small>HI 12.0 · PH 11</small></b></div><PlayerHole hole="1" par="4" si="6" score="5" net="4" points="2" dots="•"/><PlayerHole hole="2" par="3" si="8" score="4" net="4" points="1"/><PlayerHole hole="3" par="5" si="12" score="6" net="6" points="1"/></div>}
function PlayerHole({hole,par,si,score,net,points,dots=''}){return <div className="playerHoleRow"><span><b>{hole}</b><small>P{par}<br/>SI {si}</small></span><div><i>{dots}</i><strong>{score}</strong><small>({net}) <b>{points} pts</b></small><em><button>−</button><button>＋</button></em></div></div>}
function PlayerLeaderboardDemo(){return <div className="playerAppMock playerLeaderboardMock"><button className="playerLeaderboardToggle">♜&nbsp;&nbsp; HIDE LIVE LEADERBOARD</button><div className="playerLiveCard"><b>LIVE LEADERBOARD</b><PlayerLiveRow place="1" name="Golfer A" holes="18/18 holes" points="36 pts"/><PlayerLiveRow place="2" name="Golfer B" holes="16/18 holes" points="33 pts"/><PlayerLiveRow place="3" name="Golfer C" holes="15/18 holes" points="31 pts"/></div><div className="playerLeaderboardHint">Scores update as each card is saved.</div></div>}
function PlayerLiveRow({place,name,holes,points}){return <div className="playerLiveRow"><strong>{place}</strong><span><b>{name}</b><small>{holes}</small></span><em>{points}</em></div>}
function PlayerResultsDemo(){return <div className="playerLightMock playerResultsMock"><div className="playerWeekHead"><strong>W1</strong><span><b>Week 1</b><small>Final result · 18 holes</small></span><em>⌄</em></div><div className="playerResultList"><PlayerResult place="1" name="Team One" cut="Cut 2.0" points="42 pts" winner/><PlayerResult place="2" name="Team Two" cut="Cut 1.5" points="40 pts"/><PlayerResult place="3" name="Team Three" cut="Cut 1.0" points="38 pts"/><PlayerResult place="4" name="Team Four" cut="No cut" points="36 pts"/></div></div>}
function PlayerResult({place,name,cut,points,winner=false}){return <div className={`playerResultRow${winner?' winner':''}`}><strong>{place}</strong><i>⛳</i><span><b>{name}</b><small>{cut}</small></span><em>{points}</em></div>}

function AdminDemo({index,go,onClose}){
 if(index===1)return <AdminCreateGroupDemo/>;
 if(index===2)return <AdminGolferDemo/>;
 if(index===3)return <AdminCompetitionDemo/>;
 if(index===4)return <><ScoreDemo/><Tip title="ADMIN">Open a submitted card from the leaderboard if an authorised correction is needed.</Tip></>;
 if(index===5)return <><div className="howtoDemoHead"><b>Live leaderboard</b><span>THRU 15</span></div><div className="howtoLeaders"><Leader pos="1" name="Team One" score="38" provisional/><Leader pos="2" name="Team Two" score="36"/><Leader pos="3" name="Team Three" score="35"/></div><button className="secondary howtoAction">SHARE READ-ONLY LEADERBOARD</button></>;
 if(index===6)return <><div className="howtoDemoHead"><b>Competition Results</b><span>FINAL</span></div><div className="howtoStats"><Stat value="£10" label="Winner each"/><Stat value="£4" label="Each 2"/></div><DemoRow icon="🏆" title="Competition winners" text="Team One · 38 points"/><DemoRow icon="②" title="2s Club" text="Golfer A · Golfer B"/></>;
 return <Finish role="admin" go={go} onClose={onClose}/>;
}

function AdminCreateGroupDemo(){return <div className="playerAppMock adminCreateMock"><div className="adminMockHead"><b>Groups</b><span>×</span></div><h4>Create a group</h4><label><b>Group name</b><span>e.g. Weekend Golf Group</span></label><small>Choose a name that identifies this group’s competitions.</small><button className="playerMockPrimary">＋&nbsp;&nbsp; CREATE GROUP</button><em>OR</em><h4>Join a group</h4><label><b>Private join code</b><span>Enter the code from your organiser</span></label></div>}
function AdminGolferDemo(){return <div className="playerAppMock adminGolferMock"><div className="adminSectionTitle"><b>ADD NEW GOLFER</b><small>TEMPORARY / UNCLAIMED</small></div><div className="adminLightForm"><AdminInput label="Name" value="Golfer name"/><AdminInput label="Handicap Index" value="e.g. 14.6"/><AdminInput label="Email (optional)" value="golfer@example.com"/><button className="playerMockPrimary">ADD GOLFER</button></div><div className="adminInviteRow"><span><b>Golfer A</b><small>HI 12.0</small></span><button>INVITE</button></div></div>}
function AdminInput({label,value}){return <label className="adminInput"><b>{label}</b><span>{value}</span></label>}
function AdminCompetitionDemo(){return <div className="playerAppMock adminCompetitionMock"><div className="adminMockHead"><b>Edit competition</b><span>×</span></div><AdminSelect label="Group" value="Weekend Golf Group"/><AdminSelect label="League" value="None"/><AdminSelect label="Competition name" value="Saturday Competition"/><div className="adminFormatRow"><AdminSelect label="Format" value="Stableford"/><button>ⓘ</button></div><div className="adminCompGrid"><AdminSelect label="Allowance" value="95%"/><AdminSelect label="Course" value="Example Golf Club"/></div></div>}
function AdminSelect({label,value}){return <label className="adminSelect"><b>{label}</b><span>{value}<em>⌄</em></span></label>}

function ScoreDemo(){return <><div className="howtoDemoHead"><b>Hole 7 · Par 4 · SI 3</b><span className="howtoSaved">CLOUD SAVED</span></div><div className="howtoScore"><strong>7</strong><div><i>••</i><b>5</b></div><span><b>2</b><small>points</small></span></div><DemoRow icon="☁" title="Scores save as you go" text="Gross score, handicap strokes and points stay together."/><button className="primary howtoAction">NEXT HOLE</button></>}
function Finish({role,go,onClose}){return <><div className="howtoDemoHead"><b>GGC keeps it together</b><span>READY</span></div><div className="howtoFinish"><Stat value="👥" label="Groups"/><Stat value="⛳" label="Competitions"/><Stat value="☁" label="Live scoring"/><Stat value="🏆" label="Results"/></div><button className="primary howtoAction" onClick={onClose}>START USING GGC</button><button className="secondary howtoAction" onClick={()=>go(0)}>CHOOSE ANOTHER VIEW</button><small className="howtoRoleLabel">Completed: {role==='admin'?'Administrator / Group Owner':'Player'} walkthrough</small></>}
function RoleChoice({icon,title,text,selected,onClick}){return <button type="button" className={`howtoRoleChoice${selected?' selected':''}`} aria-pressed={selected} onClick={onClick}><strong>{icon}</strong><span><b>{title}</b><small>{text}</small></span><em>{selected?'✓':'›'}</em></button>}
function DemoRow({icon,title,text,active=false}){return <div className={`howtoDemoRow${active?' active':''}`}><strong>{icon}</strong><span><b>{title}</b><small>{text}</small></span><em>›</em></div>}
function DemoField({label,value,active=false}){return <div className={`howtoDemoField${active?' active':''}`}><b>{label}</b><small>{value}</small></div>}
function Tip({title,children}){return <div className="howtoTip"><b>{title}</b><span>{children}</span></div>}
function Stat({value,label}){return <div className="howtoStat"><strong>{value}</strong><small>{label}</small></div>}
function Leader({pos,name,score,provisional=false}){return <div><span>{pos}</span><b>{name}{provisional&&<small> PROV</small>}</b><strong>{score}</strong></div>}

export default function HowToSlideshow({onClose}){
 const[index,setIndex]=useState(0),[role,setRoleState]=useState(null),touchStart=useRef(null),slides=role?tours[role]:tours.player,slide=index===0?{eyebrow:'Welcome',title:'Choose your GGC walkthrough',copy:'Select the view that matches how you use GGC. You can return and view the other guide at any time.',caption:'Choose Player or Administrator / Group Owner to begin.'}:slides[index];
 const go=value=>setIndex(Math.max(0,Math.min(slides.length-1,value)));
 const setRole=value=>{setRoleState(value);setIndex(0)};
 const finishTouch=e=>{if(touchStart.current===null)return;const distance=e.changedTouches[0].clientX-touchStart.current;touchStart.current=null;if(Math.abs(distance)>55&&role)go(index+(distance<0?1:-1))};
 return <div className="howtoSlides" onTouchStart={e=>{touchStart.current=e.touches[0].clientX}} onTouchEnd={finishTouch}>
  <div className="howtoProgress" aria-hidden="true"><i style={{width:`${((index+1)/slides.length)*100}%`}}/></div>
  <div className="howtoSlide" aria-live="polite">
   <div className="howtoEyebrow">{slide.eyebrow}</div><h3>{slide.title}</h3><p>{slide.copy}</p>
   <div className="howtoDemo"><Demo index={index} role={role} setRole={setRole} go={go} onClose={onClose}/></div>
   <div className="howtoCaption"><b>✓</b><span>{slide.caption}</span></div>
  </div>
  <div className="howtoNav"><button className="secondary" disabled={index===0} onClick={()=>go(index-1)}>BACK</button><div className="howtoDots">{slides.map((_,i)=><button key={i} className={i===index?'active':''} disabled={!role&&i>0} aria-label={`Go to slide ${i+1}`} onClick={()=>role&&go(i)}/>)}</div><button className="primary" disabled={index===0&&!role} onClick={()=>index===slides.length-1?onClose():go(index+1)}>{index===slides.length-1?'DONE':'NEXT'}</button></div>
 </div>
}
