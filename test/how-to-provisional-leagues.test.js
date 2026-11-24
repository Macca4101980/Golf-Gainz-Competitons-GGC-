import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const slideshow=fs.readFileSync(new URL('../src/HowToSlideshow.jsx',import.meta.url),'utf8');

test('Player and Admin tours both explain provisional scoring and automatic release',()=>{
 assert.match(slideshow,/Understand provisional scoring/);
 assert.match(slideshow,/Control provisional scoring/);
 assert.match(slideshow,/Complete cards continue saving behind the provisional display/);
 assert.match(slideshow,/full-score release time/);
 assert.match(slideshow,/changes the competition status automatically/);
});

test('Walkthrough points golfers to the complete format library on Home',()=>{
 assert.match(slideshow,/complete list of included competition types and their rules is available from Competition Formats on Home/);
 assert.match(slideshow,/complete list of included competition types and their explanations is available from Competition Formats on Home/);
});

test('League guide covers scoring, field scaling and handicap choices',()=>{
 assert.match(slideshow,/cumulative Stableford/i);
 assert.match(slideshow,/nett stroke score versus par/i);
 assert.match(slideshow,/automatically scale(?:s)? (?:to|with) the number of entrants/i);
 assert.match(slideshow,/lock the starting Handicap Index/i);
 assert.match(slideshow,/follow the current profile HI/i);
 assert.match(slideshow,/team-performance or manual adjustments/i);
});
