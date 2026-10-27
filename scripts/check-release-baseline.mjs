import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const baseline=JSON.parse(readFileSync(new URL('../RELEASE-BASELINE.json',import.meta.url)));
const sha=process.env.PRODUCTION_COMMIT || baseline.productionCommit;
if(!/^[a-f0-9]{40}$/.test(sha))throw Error('Invalid production commit');
execFileSync('git',['merge-base','--is-ancestor',sha,'HEAD'],{stdio:'inherit'});
console.log('Production ancestry verified: '+sha);
