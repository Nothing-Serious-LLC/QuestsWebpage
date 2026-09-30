import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../js/monthly-event.js', import.meta.url), 'utf8');
function setup(now) {
  const listeners = {};
  const links = [0, 1].map(() => ({href: 'https://invite.thequestsapp.com/q/kqkHT9GV', textContent:'Join Sober October', getAttribute: () => '2026-10-29T00:00:00Z', addEventListener(name, fn) { this[name] = fn; }}));
  const notes = [{textContent:'October 1 to 31'}];
  const document = { hidden:false, querySelector:()=>null, querySelectorAll: selector => selector === '[data-event-invite]' ? links : notes, addEventListener:(name,fn)=>listeners[name]=fn };
  const clock = {parse:Date.parse, now:()=>Date.parse(now)};
  vm.runInNewContext(source,{document, window:{addEventListener:(name,fn)=>listeners[name]=fn}, Date:clock});
  return {links,notes,listeners,clock};
}
test('active campaign retains the exact invite destination',()=>{
  const {links}=setup('2026-10-28T23:59:59Z');
  assert.ok(links.every(a=>a.href==='https://invite.thequestsapp.com/q/kqkHT9GV'));
});
test('cutoff switches every primary CTA to permanent Quests discovery',()=>{
  const {links,notes}=setup('2026-10-29T00:00:00Z');
  assert.ok(links.every(a=>a.href==='/' && a.textContent==='Explore challenges on Quests'));
  assert.match(notes[0].textContent,/invitation has closed/);
});
test('an already-open page updates on return and before a stale invite click',()=>{
  const state=setup('2026-10-28T23:59:59Z');
  state.clock.now=()=>Date.parse('2026-10-29T00:00:01Z');
  state.listeners.pageshow();
  assert.ok(state.links.every(a=>a.href==='/'));
  const clickState=setup('2026-10-28T23:59:59Z');
  clickState.clock.now=()=>Date.parse('2026-10-29T00:00:01Z');
  clickState.links[0].click();
  assert.ok(clickState.links.every(a=>a.href==='/'));
});
