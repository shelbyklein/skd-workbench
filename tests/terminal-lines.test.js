import test from 'node:test';
import assert from 'node:assert/strict';
import {createLineCollector} from '../lib/terminal-lines.js';

test('typed lines, backspace and clear keys rebuild the submitted text', () => {
 const c=createLineCollector();
 assert.deepEqual(c.feed('hello'),[]);assert.deepEqual(c.feed(' wor\x7fld\r'),['hello wold']);
 assert.deepEqual(c.feed('drop me\x15kept\r'),['kept']);
 assert.deepEqual(c.feed('gone\x03\r'),[],'Ctrl-C clears the line; an empty Enter records nothing.');
 assert.deepEqual(c.feed('y\r'),['y'],'Prompt answers are copied too.');
 assert.deepEqual(c.feed('a\rb\r'),['a','b']);
});

test('bracketed pastes keep their newlines, even split across chunks', () => {
 const c=createLineCollector();
 assert.deepEqual(c.feed('\x1b[200~line one\r\nline two\x1b[201~\r'),['line one\nline two']);
 assert.deepEqual(c.feed('\x1b[20'),[]);assert.deepEqual(c.feed('0~split\x1b[2'),[]);assert.deepEqual(c.feed('01~ paste\r'),['split paste']);
});

test('lines edited with arrow keys or history are dropped, not recorded wrong', () => {
 const c=createLineCollector();
 assert.deepEqual(c.feed('fix it\x1b[D\x1b[Dx\r'),[]);
 assert.deepEqual(c.feed('\x1b[A\r'),[],'History recall is not visible to the server.');
 assert.deepEqual(c.feed('\x1b'),[]);assert.deepEqual(c.feed('[Bnext\r'),[],'A split arrow key still marks the line.');
 assert.deepEqual(c.feed('clean\r'),['clean'],'The next line starts fresh.');
});
