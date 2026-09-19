import test from 'node:test';import assert from 'node:assert/strict';import {reportProblems} from '../scripts/verify-magnet-gate.mjs';
const H='exact-build';
const r=()=>({sha256:H,checks:[{status:'PASS'}],counts:{PASS:1,FAIL:0}});
test('MG25: old screenshots and stale browser build cannot pass',()=>assert.ok(reportProblems({...r(),sha256:'old'},H,'browser',1).length));
test('MG26: individual failure cannot hide behind passing count',()=>assert.ok(reportProblems({...r(),checks:[{status:'FAIL'}]},H,'browser',1).length));
test('MG27: ten minutes cannot satisfy thirty-minute contract',()=>assert.ok(reportProblems({sha256:H,status:'PASS',wallSeconds:610,iterations:250,records:[{}],pageErrors:[],final:{sources:0,previews:0}},H,'soak').length));
test('MG28: retained sources after stop fail soak',()=>assert.ok(reportProblems({sha256:H,status:'PASS',wallSeconds:1800,iterations:500,records:[{}],pageErrors:[],final:{sources:1,previews:0}},H,'soak').length));
test('MG29: valid engineering report does not require pretending native results',()=>assert.deepEqual(reportProblems(r(),H,'browser',1),[]));
test('MG30: missing audio comparison is still incomplete',()=>assert.ok(reportProblems({sha256:H,status:'PASS',counts:{presets:76,combinations:26}},H,'audio').length));
// The gate is pure; these boundary assertions do not claim device tests were executed.
