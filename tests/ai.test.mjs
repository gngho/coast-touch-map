import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeAiWidget} from '../public/ai.js';

// Minimal bubbling DOM fixture for input ordering; not a Safari emulator.
function fixture(onTouch=()=>{}) {
  class Element {
    constructor(parent = null, dataset = {}) {
      this.parent = parent;
      this.dataset = dataset;
      this.attributes = {};
      this.handlers = new Map();
    }
    contains(node) {
      while (node) { if (node === this) return true; node = node.parent; }
      return false;
    }
    removeAttribute(key) { delete this.attributes[key]; }
    closest() { return area; }
    getBoundingClientRect() { return {left:0,top:0,right:340,bottom:746}; }
    setAttribute(key, value) { this.attributes[key] = value; }
    addEventListener(type, handler) {
      const handlers = this.handlers.get(type) || [];
      handlers.push(handler); this.handlers.set(type, handlers);
    }
    focus() {
      if (doc.activeElement === this) return;
      doc.activeElement?.emit('focusout', {relatedTarget: this});
      doc.activeElement = this;
      this.emit('focusin');
    }
    emit(type, details = {}) {
      const event = {target: this, preventDefault() {}, stopPropagation() {this.stopped = true;}, ...details};
      for (let node = this; node && !event.stopped; node = node.parent) {
        for (const handler of node.handlers.get(type) || []) handler(event);
      }
    }
  }
  const doc = new Element();
  const area = new Element(doc);
  const widget = new Element(area, {state: 'idle'});
  const toggle = new Element(widget);
  const panel = new Element(widget);
  panel.hidden = true;
  const label = new Element(toggle);
  const close = new Element(panel);
  const choices = ['idle', 'listening', 'thinking', 'speaking'].map(aiState => new Element(panel, {aiState}));
  panel.querySelectorAll = () => choices;
  const elements = {'ai-widget': widget, 'ai-toggle': toggle, 'ai-panel': panel, 'ai-state-label': label, 'ai-close': close};
  doc.getElementById = id => elements[id];
  const previous = globalThis.document;
  globalThis.document = doc;
  const api=initializeAiWidget({onTouch});
  return {api,area,heading:new Element(area),offer:new Element(widget),widget, toggle, panel, choices, doc, outside: new Element(doc), restore() {globalThis.document = previous;}};
}

test('a touch-induced blur with no next focus does not discard a state selection', () => {
  const f = fixture();
  try {
    for (const choice of f.choices) {
      f.toggle.emit('click');
      choice.emit('pointerdown', {pointerType: 'touch'});
      f.doc.activeElement.emit('focusout', {relatedTarget: null});
      assert.equal(f.panel.hidden, false, 'panel must remain available until the tap becomes a click');
      choice.emit('click');
      assert.equal(f.widget.dataset.state, choice.dataset.aiState);
      assert.equal(choice.attributes['aria-pressed'], 'true');
      assert.equal(f.panel.hidden, true);
    }
  } finally { f.restore(); }
});

test('internal focus stays open; external focus, outside tap and Escape dismiss', () => {
  const f = fixture();
  try {
    f.toggle.emit('click');
    f.choices[1].focus();
    assert.equal(f.panel.hidden, false);
    f.outside.focus();
    assert.equal(f.panel.hidden, true);
    f.toggle.emit('click');
    f.outside.emit('pointerdown', {pointerType: 'touch'});
    assert.equal(f.panel.hidden, true);
    f.toggle.emit('click');
    f.choices[0].emit('keydown', {key: 'Escape'});
    assert.equal(f.panel.hidden, true);
    assert.equal(f.doc.activeElement, f.toggle);
  } finally { f.restore(); }
});


test('experiment requires a trusted press and release after arming; clicks and stale gestures cannot activate',()=>{
  let touches=0;const f=fixture(()=>touches++);
  try{
    f.api.setMode(true);f.api.setTouchEnabled(false);
    const pointer={pointerId:1,button:0,isPrimary:true,isTrusted:true,clientX:10,clientY:10};
    f.toggle.emit('pointerdown',pointer);f.api.setTouchEnabled(true);f.toggle.emit('pointerup',pointer);
    f.toggle.emit('click');f.toggle.emit('click',{isTrusted:true,detail:0});assert.equal(touches,0);
    f.toggle.emit('pointerdown',{...pointer,isTrusted:false});f.toggle.emit('pointerup',pointer);assert.equal(touches,0);
    f.toggle.emit('pointerdown',pointer);f.toggle.emit('pointerup',{...pointer,clientX:60});assert.equal(touches,0);
    f.toggle.emit('pointerdown',pointer);f.toggle.emit('pointercancel');f.toggle.emit('pointerup',pointer);assert.equal(touches,0);
    f.toggle.emit('pointerdown',pointer);f.api.setTouchEnabled(true);f.toggle.emit('pointerup',pointer);f.toggle.emit('click',{isTrusted:true});assert.equal(touches,1);
    f.toggle.emit('pointerup',pointer);assert.equal(touches,1);
  }finally{f.restore();}
});

test('the entire AI panel accepts armed taps, but disarming, leaving and setup prevent activation',()=>{
  let touches=0;const f=fixture(()=>touches++);
  const pointer={pointerId:1,button:0,isPrimary:true,isTrusted:true,clientX:10,clientY:10};
  const tap=node=>{node.emit('pointerdown',pointer);node.emit('pointerup',pointer);};
  try{
    f.api.setMode(true);f.api.setTouchEnabled(true);
    for(const node of [f.area,f.heading,f.offer,f.toggle])tap(node);
    assert.equal(touches,4,'each panel target activates exactly once');
    f.api.setTouchEnabled(false);tap(f.area);assert.equal(touches,4);
    f.api.setTouchEnabled(true);tap(f.outside);assert.equal(touches,4);
    f.area.emit('pointerdown',pointer);f.area.emit('pointerleave');f.area.emit('pointerup',pointer);assert.equal(touches,4);
    f.area.emit('pointerdown',pointer);f.area.emit('pointerup',{...pointer,clientX:-1});assert.equal(touches,4);
    f.area.emit('pointerdown',pointer);f.api.setMode(false);f.api.setMode(true);f.area.emit('pointerup',pointer);assert.equal(touches,4);
    f.api.setMode(false);tap(f.area);assert.equal(touches,4);
  }finally{f.restore();}
});
