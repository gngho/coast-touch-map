import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeAiWidget} from '../public/ai.js';

// Minimal bubbling DOM fixture for input ordering; not a Safari emulator.
function fixture() {
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
  const widget = new Element(doc, {state: 'idle'});
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
  initializeAiWidget();
  return {widget, toggle, panel, choices, doc, outside: new Element(doc), restore() {globalThis.document = previous;}};
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
