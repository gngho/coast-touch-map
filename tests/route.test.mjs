import test from 'node:test';
import assert from 'node:assert/strict';
import {routeLengths,routePose} from '../public/route.js';
test('route marker interpolates on segments and clamps at endpoints',()=>{
 const points=[[0,0],[0,.001],[.001,.001]],lengths=routeLengths(points);
 assert.deepEqual(routePose(points,lengths,0).position,points[0]);
 assert.deepEqual(routePose(points,lengths,1e6).position,points[2]);
 assert.ok(Math.abs(routePose(points,lengths,lengths[1]/2).position[1]-.0005)<1e-9);
 assert.equal(routePose(points,lengths,lengths[1]/2).heading,0);
 assert.ok(Math.abs(routePose(points,lengths,(lengths[1]+lengths[2])/2).heading-90)<1e-6);
});
