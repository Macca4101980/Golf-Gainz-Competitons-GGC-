import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const slideshow=fs.readFileSync(new URL('../src/HowToSlideshow.jsx',import.meta.url),'utf8');

test('Admin guide explains the complete temporary golfer claim flow',()=>{
 assert.match(slideshow,/added as temporary golfers/);
 assert.match(slideshow,/teams and competitions straight away/);
 assert.match(slideshow,/send their invite by WhatsApp, text or email/);
 assert.match(slideshow,/automatically links the placeholder to their new GGC ID/);
 assert.match(slideshow,/keeping their teams, scores and history/);
});
