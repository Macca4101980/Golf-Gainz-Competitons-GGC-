import React,{useRef,useState}from'react';

const slides=[
 {eyebrow:'Welcome',title:'Your quick tour of GGC',copy:'Set up a Group, run a competition and follow the live scores — all from your phone.',caption:'You can reopen this guide at any time from the front screen.'},
 {eyebrow:'Step 1 of 7',title:'Create or join a Group',copy:'A Group keeps your golfers, competitions and league history together.',caption:'Groups are the starting point for regular societies, leagues and mates.'},
 {eyebrow:'Step 2 of 7',title:'Invite your golfers',copy:'Send one invite link by WhatsApp, text or email. New golfers can create an account from the link.',caption:'GGC links a claimed account to the existing golfer, keeping their history.'},
 {eyebrow:'Step 3 of 7',title:'Build the competition',copy:'Pick the Group, course, tees and scoring format. GGC applies the competition settings and handicap allowance.',caption:'Use a one-off competition or build a full league with scheduled weeks.'},
 {eyebrow:'Step 4 of 7',title:'Start the round together',copy:'The first player starts the round and selects the playing group. Everyone else joins the same live round.',caption:'If the signal drops, keep scoring — saved changes are sent when you reconnect.'},
 {eyebrow:'Step 5 of 7',title:'Score hole by hole',copy:'Enter gross scores. GGC shows handicap shots, nett score and Stableford points automatically.',caption:'Use zero for No Return. Provisional leaderboards update when permitted.'},
 {eyebrow:'Step 6 of 7',title:'Follow the live leaderboard',copy:'See who is leading, how many holes they have played and whether a result is provisional.',caption:'Managers can share a read-only leaderboard link with anyone.'},
 {eyebrow:'Step 7 of 7',title:'Results, prizes and history',copy:'When the competition closes, GGC confirms the result and keeps the full record in one place.',caption:'Open Results for weekly tables, overall standings, cards, 2s and payouts.'},
 {eyebrow:'All done',title:'You’re ready to play',copy:'Create a Group, invite your golfers and let GGC take care of the competition.',caption:'The guide is short enough to use, but detailed enough to answer the first questions.'}
];

function Demo({index,go,onClose}){
 if(index===0)return <><div className="howtoDemoHead"><b>What would you like to do?</b><span>2 MIN TOUR</span></div><DemoRow icon="＋" title="Create a competition" text="Choose the players, course and format" active/><DemoRow icon="♙" title="Join your golf Group" text="Accept an invite or enter a joining code"/><button className="primary howtoAction" onClick={()=>go(1)}>START THE WALKTHROUGH</button></>;
 if(index===1)return <><div className="howtoDemoHead"><b>My Groups</b><span>GROUPS</span></div><DemoRow icon="🏆" title="Winter League 26/27" text="28 golfers · 18 teams · Live" active/><div className="howtoSplit"><button className="primary">＋ CREATE</button><button className="secondary">JOIN CODE</button></div><Tip title="TIP">The person creating the Group becomes its manager and controls membership.</Tip></>;
 if(index===2)return <><div className="howtoDemoHead"><b>Winter League 26/27</b><span>MANAGER</span></div><DemoRow icon="👥" title="28 golfers" text="Everyone in the Group can be selected for competitions"/><button className="primary howtoAction">SHARE INVITE LINK</button><DemoRow icon="✓" title="Temporary golfers are supported" text="Add them now; they can claim their profile later."/></>;
 if(index===3)return <><div className="howtoDemoHead"><b>New Competition</b><span>SETUP</span></div><DemoField label="Format" value="Pairs Stableford · Better Ball"/><DemoField label="Course & tees" value="Northampton GC · Green tees · 18 holes"/><div className="howtoStats"><Stat value="90%" label="Allowance"/><Stat value="28" label="Players"/></div><button className="primary howtoAction">CREATE COMPETITION</button></>;
 if(index===4)return <><div className="howtoDemoHead"><b>Week 5 · Ready to play</b><span>TODAY</span></div><DemoField label="Your playing group" value="Hooky · Woolgrove · Clarkson · Everton-Watts" active/><button className="primary howtoAction">START ROUND</button><Tip title="GOOD TO KNOW">One person can enter all four cards, or each golfer can update their own.</Tip></>;
 if(index===5)return <><div className="howtoDemoHead"><b>Hole 7 · Par 4 · SI 3</b><span className="howtoSaved">CLOUD SAVED</span></div><div className="howtoScore"><strong>7</strong><div><i>••</i><b>5</b></div><span><b>2</b><small>points</small></span></div><DemoRow icon="☁" title="Scores save as you go" text="Each golfer’s card remains separate and protected."/><button className="primary howtoAction">NEXT HOLE</button></>;
 if(index===6)return <><div className="howtoDemoHead"><b>Live leaderboard</b><span>THRU 15</span></div><div className="howtoLeaders"><Leader pos="1" name="Very Little Helps" score="38" provisional/><Leader pos="2" name="Power Strangers" score="36"/><Leader pos="3" name="Flintstones" score="35"/></div><Tip title="LIVE">Hidden holes and release times are handled automatically by the competition settings.</Tip></>;
 if(index===7)return <><div className="howtoDemoHead"><b>Week 5 Results</b><span>FINAL</span></div><div className="howtoStats"><Stat value="£10" label="Winner each"/><Stat value="£3.43" label="Each 2"/></div><DemoRow icon="🏆" title="Competition winners" text="Very Little Helps · 38 points"/><DemoRow icon="②" title="2s Club" text="Dan · Wooly · Clarkson · Darren"/></>;
 return <><div className="howtoDemoHead"><b>GGC keeps it together</b><span>READY</span></div><div className="howtoFinish"><Stat value="👥" label="Groups"/><Stat value="⛳" label="Competitions"/><Stat value="☁" label="Live scoring"/><Stat value="🏆" label="Results"/></div><button className="primary howtoAction" onClick={onClose}>START USING GGC</button><button className="secondary howtoAction" onClick={()=>go(0)}>REPLAY TOUR</button></>;
}

function DemoRow({icon,title,text,active=false}){return <div className={`howtoDemoRow${active?' active':''}`}><strong>{icon}</strong><span><b>{title}</b><small>{text}</small></span><em>›</em></div>}
function DemoField({label,value,active=false}){return <div className={`howtoDemoField${active?' active':''}`}><b>{label}</b><small>{value}</small></div>}
function Tip({title,children}){return <div className="howtoTip"><b>{title}</b><span>{children}</span></div>}
function Stat({value,label}){return <div className="howtoStat"><strong>{value}</strong><small>{label}</small></div>}
function Leader({pos,name,score,provisional=false}){return <div><span>{pos}</span><b>{name}{provisional&&<small> PROV</small>}</b><strong>{score}</strong></div>}

export default function HowToSlideshow({onClose}){
 const[index,setIndex]=useState(0),touchStart=useRef(null),slide=slides[index];
 const go=value=>setIndex(Math.max(0,Math.min(slides.length-1,value)));
 const finishTouch=e=>{if(touchStart.current===null)return;const distance=e.changedTouches[0].clientX-touchStart.current;touchStart.current=null;if(Math.abs(distance)>55)go(index+(distance<0?1:-1))};
 return <div className="howtoSlides" onTouchStart={e=>{touchStart.current=e.touches[0].clientX}} onTouchEnd={finishTouch}>
  <div className="howtoProgress" aria-hidden="true"><i style={{width:`${((index+1)/slides.length)*100}%`}}/></div>
  <div className="howtoSlide" aria-live="polite">
   <div className="howtoEyebrow">{slide.eyebrow}</div><h3>{slide.title}</h3><p>{slide.copy}</p>
   <div className="howtoDemo"><Demo index={index} go={go} onClose={onClose}/></div>
   <div className="howtoCaption"><b>✓</b><span>{slide.caption}</span></div>
  </div>
  <div className="howtoNav"><button className="secondary" disabled={index===0} onClick={()=>go(index-1)}>BACK</button><div className="howtoDots">{slides.map((_,i)=><button key={i} className={i===index?'active':''} aria-label={`Go to slide ${i+1}`} onClick={()=>go(i)}/>)}</div><button className="primary" onClick={()=>index===slides.length-1?onClose():go(index+1)}>{index===slides.length-1?'DONE':'NEXT'}</button></div>
 </div>
}
