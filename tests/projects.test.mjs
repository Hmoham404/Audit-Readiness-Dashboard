import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { build } from 'esbuild';
import { readSheet } from 'read-excel-file/node';
import { PGlite } from '@electric-sql/pglite';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;
globalThis.sessionStorage = dom.window.sessionStorage;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} };
dom.window.HTMLDialogElement.prototype.showModal = function() { this.setAttribute('open', ''); };
dom.window.HTMLDialogElement.prototype.close = function() { this.removeAttribute('open'); };
const { createRoot } = await import('react-dom/client');
await build({ entryPoints: ['tests/entry.ts'], outfile: 'node_modules/.tmp/audit-tests.mjs', bundle: true, platform: 'node', format: 'esm', packages: 'external', jsx: 'automatic', define: { 'import.meta.env': '{}' } });
const { ProjectsApp, useProjects, initialProjects, LEGACY_ID, LEGACY_POINTS_KEY, LEGACY_DATES_KEY, PROJECTS_KEY, cloneChecklist, parseAuditRows, excelDate, projectRow } = await import('../node_modules/.tmp/audit-tests.mjs');
const files = (await fs.readdir('.')).filter(f => f.startsWith('MYCTN') && f.endsWith('.xlsx'));
const imports = {};
for (const audit of ['GMP', 'SMETA']) {
  const file = files.find(f => audit === 'GMP' ? f.includes('GMP') : !f.includes('GMP'));
  imports[audit] = { file, result: parseAuditRows(await readSheet(file, { sheet: 'Registre NC' }), audit, file, 'Registre NC', '') };
}
const mount = async component => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(component));
  return { container, async unmount() { await act(async () => root.unmount()); container.remove(); } };
};
const mountHook = async (database = null) => {
  let current;
  function Harness() { current = useProjects(database); return null; }
  const view = await mount(React.createElement(Harness));
  return { get store() { return current; }, ...view };
};
const click = async element => { assert.ok(element, 'Button exists'); await act(async () => element.click()); };
const input = async (element, value) => {
  const descriptor = Object.getOwnPropertyDescriptor(element instanceof dom.window.HTMLSelectElement ? dom.window.HTMLSelectElement.prototype : dom.window.HTMLInputElement.prototype, 'value');
  await act(async () => { descriptor.set.call(element, value); element.dispatchEvent(new dom.window.Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); });
};

test('extracts every corrective record, date, owner and closed status from the two supplied workbooks', () => {
  assert.equal(imports.GMP.result.points.length, 8);
  assert.equal(imports.SMETA.result.points.length, 7);
  assert.equal(imports.SMETA.result.points.filter(p => p.status === 1).length, 2);
  assert.equal(imports.GMP.result.points.filter(p => p.status === 1).length, 0);
  assert.equal(imports.GMP.result.points[0].due, '2026-11-20');
  assert.equal(imports.SMETA.result.points[0].owner, 'Saif');
  assert.equal(imports.SMETA.result.points[5].owner, 'Ghassen');
  assert.equal(imports.GMP.result.points[7].details.sourceRow, 15);
  assert.match(imports.GMP.result.points[0].details.correctiveAction, /GMP plan/);
  assert.equal(imports.GMP.result.points[0].details.verificationDate, '2026-11-14');
  assert.deepEqual(imports.GMP.result.warnings, []);
  assert.deepEqual(imports.SMETA.result.warnings, []);
});

test('recognizes both existing checklist formats as well as the corrective register', async () => {
  const originals = (await fs.readdir('.')).filter(f => f.endsWith('.xlsx') && !f.startsWith('MYCTN'));
  for (const file of originals) {
    const audit = file.includes('GMP') ? 'GMP' : 'SMETA';
    const result = parseAuditRows(await readSheet(file), audit, file, 'Checklist', '2026-12-01');
    assert.equal(result.points.length, audit === 'GMP' ? 54 : 53);
    assert.ok(result.points.every(p => p.audit === audit && p.title));
  }
});

test('reports unknown statuses and invalid/missing dates; rejects duplicates and unrelated sheets', () => {
  const result = parseAuditRows([['Num', 'Checklist', 'Responsable', 'Statut', 'Deadline'], [1, 'Point A', 'RH', 'Clôturée', '31/02/2026'], [2, 'Point B', 'DG', 'N/A', null], [3, 'Point C', 'DG', 'À confirmer', '21/11/2026']], 'GMP', 'test.xlsx', 'Checklist', '2026-12-01');
  assert.equal(result.points[0].status, 1);
  assert.equal(result.points[0].due, '2026-12-01');
  assert.equal(result.points[1].applicable, false);
  assert.equal(result.points[2].status, 0);
  assert.equal(result.warnings.length, 3);
  assert.equal(excelDate('21/11/2026'), '2026-11-21');
  assert.throws(() => parseAuditRows([['Num', 'Checklist'], [1, 'A'], [1, 'B']], 'GMP', '', '', ''), /double/);
  assert.throws(() => parseAuditRows([['Total NC', 7]], 'GMP', '', '', ''), /non reconnues/);
});

test('preserves the original browser data exactly and seeds the second project only once', () => {
  localStorage.clear();
  const original = { ...imports.GMP.result.points[0], owner: 'Responsable personnalisé', status: 1, comments: ['Note conservée'] };
  localStorage.setItem(LEGACY_POINTS_KEY, JSON.stringify([original]));
  localStorage.setItem(LEGACY_DATES_KEY, JSON.stringify({ GMP: '2027-01-01' }));
  let projects = initialProjects(localStorage, false);
  assert.deepEqual(projects[0].points, [original]);
  assert.equal(projects[0].deadlines.GMP, '2027-01-01');
  assert.equal(projects[1].points.length, 15);
  projects[1].points[0].status = 1;
  projects[1].points[0].owner = 'Nouveau responsable';
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects.slice(1)));
  projects = initialProjects(localStorage, false);
  assert.equal(projects.length, 2);
  assert.equal(projects[1].points[0].status, 1);
  assert.equal(projects[1].points[0].owner, 'Nouveau responsable');
});

test('copying a checklist clears completion, comments and verification without changing the source', () => {
  const points = structuredClone(imports.SMETA.result.points);
  points[0].comments = ['Ancienne discussion'];
  points[0].details.verification = 'Validée';
  const before = structuredClone(points);
  const copy = cloneChecklist(points);
  assert.ok(copy.every(p => p.status === 0 && p.comments.length === 0));
  assert.equal(copy[0].details.verification, '');
  assert.equal(copy[0].details.verificationDate, '');
  assert.deepEqual(points, before);
});

test('edits, dates, additions and deletions stay within their project and survive reload', async () => {
  localStorage.clear();
  let view = await mountHook();
  const first = structuredClone(view.store.projects[0]);
  const second = view.store.projects[1];
  await act(async () => assert.equal(await view.store.update(second.id, second.points[0].id, { status: 1, owner: 'Responsable B' }), true));
  await act(async () => assert.equal(await view.store.saveDeadline(second.id, 'GMP', '2027-02-01'), true));
  await act(async () => assert.equal(await view.store.add(second.id, { ...second.points[0], id: 998877, num: 9, title: 'Action indépendante' }), true));
  assert.deepEqual(view.store.projects[0], first);
  assert.equal(view.store.projects[1].points.length, 16);
  await act(async () => assert.equal(await view.store.remove(second.id, 998877), true));
  await view.unmount();
  view = await mountHook();
  assert.equal(view.store.projects[1].points[0].owner, 'Responsable B');
  assert.equal(view.store.projects[1].deadlines.GMP, '2027-02-01');
  assert.deepEqual(view.store.projects[0], first);
  await view.unmount();
});

test('a missing sharing migration keeps new projects local and never writes into the original table', async () => {
  localStorage.clear();
  const writes = [];
  const legacy = { ...imports.GMP.result.points[0], owner: 'Responsable partagé', status: 1 };
  const client = {
    from(table) {
      let write = false;
      const query = {
        select() { return query; }, order() { return query; }, eq() { return query; }, single() { return query; }, abortSignal() { return query; },
        update() { write = true; writes.push(table); return query; },
        then(resolve, reject) { return Promise.resolve(table === 'audit_points' && !write ? { data: [legacy], error: null } : table === 'audit_settings' ? { data: [], error: null } : { data: null, error: { message: 'Missing table' } }).then(resolve, reject); },
      };
      return query;
    },
    channel() { const channel = { on() { return channel; }, subscribe() { return channel; } }; return channel; },
    removeChannel() { return Promise.resolve(); },
  };
  const view = await mountHook(client);
  assert.equal(view.store.loading, false);
  assert.equal(view.store.projects[0].points[0].owner, 'Responsable partagé');
  assert.equal(view.store.projects[1].storage, 'local');
  assert.match(view.store.connectionError, /partage/);
  assert.deepEqual(writes, []);
  await act(async () => assert.equal(await view.store.update(LEGACY_ID, legacy.id, { status: 0 }), false));
  assert.equal(view.store.projects[0].points[0].status, 1, 'A failed cloud save does not pretend to succeed');
  await view.unmount();
});

test('missing legacy date table uses shared project metadata without hiding or resetting legacy points', async () => {
  localStorage.clear();
  const cachedDates = { GMP: '2026-12-09', SMETA: '2026-12-16' };
  localStorage.setItem(LEGACY_DATES_KEY, JSON.stringify(cachedDates));
  const legacyPoint = { ...imports.GMP.result.points[0], owner: 'Responsable conservé', status: 1 };
  const second = initialProjects(localStorage, false)[1];
  const headers = new Map([[second.id, { ...projectRow(second), audit_project_points: second.points }]]);
  const creations = [];
  const saves = [];
  const subscriptions = [];
  const client = {
    from(table) {
      let id;
      const query = {
        select() { return query; }, order() { return query; }, abortSignal() { return query; },
        eq(_column, value) { id = value; return query; }, single() { return query; },
        then(resolve, reject) {
          const result = table === 'audit_points' ? { data: [legacyPoint], error: null }
            : table === 'audit_settings' ? { data: null, error: { code: 'PGRST205' } }
            : { data: id ? headers.get(id) : [...headers.values()], error: null };
          return Promise.resolve(result).then(resolve, reject);
        },
      };
      return query;
    },
    rpc(name, parameters) {
      if (name === 'create_audit_project') {
        const project = parameters.p_project;
        creations.push(project);
        if (!headers.has(project.id)) headers.set(project.id, { ...project, audit_project_points: project.points });
      } else {
        saves.push(parameters);
        headers.get(parameters.p_project_id).deadlines = { ...headers.get(parameters.p_project_id).deadlines, [parameters.p_audit]: parameters.p_due };
      }
      return { abortSignal() { return Promise.resolve({ data: null, error: null }); } };
    },
    channel() { const channel = { on(_event, filter) { subscriptions.push(filter.table); return channel; }, subscribe() { return channel; } }; return channel; },
    removeChannel() { return Promise.resolve(); },
  };
  let view = await mountHook(client);
  assert.equal(view.store.connectionError, '');
  assert.equal(view.store.projects.length, 2, 'The metadata header does not duplicate the initial project');
  assert.deepEqual(view.store.projects[0].points, [legacyPoint]);
  assert.deepEqual(view.store.projects[0].deadlines, cachedDates);
  assert.equal(creations.length, 1);
  assert.equal(creations[0].id, LEGACY_ID);
  assert.deepEqual(creations[0].points, [], 'No legacy point is copied or re-seeded');
  assert.ok(subscriptions.includes('audit_projects'));
  await act(async () => assert.equal(await view.store.saveDeadline(LEGACY_ID, 'GMP', '2027-03-01'), true));
  assert.equal(saves[0].p_project_id, LEGACY_ID);
  await view.unmount();
  localStorage.setItem(LEGACY_DATES_KEY, JSON.stringify({ GMP: '2020-01-01' }));
  view = await mountHook(client);
  assert.equal(view.store.projects[0].deadlines.GMP, '2027-03-01', 'Shared dates win over another browser’s stale cache');
  assert.equal(view.store.projects[0].points[0].owner, 'Responsable conservé');
  assert.equal(view.store.connectionError, '');
  assert.equal(creations.length, 1, 'Reload never rewrites existing metadata');
  await view.unmount();
});

test('the interface creates an Excel project, opens it, and switches back to the original data', async () => {
  localStorage.clear();
  const view = await mount(React.createElement(ProjectsApp));
  assert.equal(view.container.querySelectorAll('.project-card').length, 2);
  assert.equal(view.container.querySelectorAll('.portfolio-stats strong')[1].textContent, '122');
  await click([...view.container.querySelectorAll('.project-filter-tabs button')].find(button => button.textContent.includes('Actions correctives')));
  assert.equal(view.container.querySelectorAll('.project-card').length, 1);
  assert.match(view.container.querySelector('.project-card h2').textContent, /Actions correctives/);
  await input(view.container.querySelector('.projects-search input'), 'projet inexistant');
  assert.ok(view.container.querySelector('.projects-empty'));
  await click(view.container.querySelector('.projects-empty button'));
  assert.equal(view.container.querySelectorAll('.project-card').length, 2);
  await input(view.container.querySelector('.projects-search input'), 'preparation');
  assert.equal(view.container.querySelectorAll('.project-card').length, 1, 'Search also matches accented names');
  await click(view.container.querySelector('[aria-label="Effacer la recherche"]'));
  assert.equal(view.container.querySelectorAll('.project-card').length, 2);
  await click([...view.container.querySelectorAll('button')].find(b => b.textContent.includes('Nouveau projet')));
  const dialog = view.container.querySelector('dialog');
  assert.ok(dialog.hasAttribute('open'));
  await input(dialog.querySelector('input[maxlength="120"]'), 'Troisième projet importé');
  await click(dialog.querySelector('input[value="excel"]'));
  const dates = dialog.querySelectorAll('input[type="date"]');
  await input(dates[0], '2027-01-19'); await input(dates[1], '2027-01-08');
  const uploads = dialog.querySelectorAll('input[type="file"]');
  for (const [index, audit] of ['GMP', 'SMETA'].entries()) {
    const file = new File([await fs.readFile(imports[audit].file)], imports[audit].file);
    await act(async () => { Object.defineProperty(uploads[index], 'files', { value: [file], configurable: true }); uploads[index].dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
  }
  for (let i = 0; i < 100 && dialog.textContent.includes('Lecture du fichier'); i++) await act(async () => new Promise(resolve => setTimeout(resolve, 10)));
  assert.equal(dialog.querySelectorAll('.import-preview').length, 2);
  assert.match(dialog.textContent, /8 points reconnus/);
  assert.match(dialog.textContent, /7 points reconnus/);
  await act(async () => dialog.querySelector('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })));
  assert.equal(view.container.querySelector('dialog'), null);
  const selector = view.container.querySelector('.project-toolbar select');
  assert.equal(selector.selectedOptions[0].textContent, 'Troisième projet importé');
  assert.equal(selector.options.length, 3);
  const metrics = view.container.querySelectorAll('.metric > strong');
  assert.deepEqual([...metrics].slice(0, 3).map(e => e.textContent), ['15', '2', '13']);
  await click([...view.container.querySelectorAll('.nav-item')].find(b => b.textContent === 'GMP'));
  assert.equal(view.container.querySelectorAll('.points-table tbody tr').length, 8);
  assert.equal(view.container.querySelector('.donut-label strong').textContent, '0%');
  assert.equal(view.container.querySelector('.mini-metrics'), null, 'The removed metric tiles stay removed');
  await click(view.container.querySelector('.points-table tbody tr'));
  assert.match(view.container.querySelector('.nc-details').textContent, /No documented GMP plan/);
  assert.match(view.container.querySelector('.nc-details').textContent, /Set up a GMP plan/);
  await click(view.container.querySelectorAll('.status-switch button')[1]);
  assert.equal(view.container.querySelector('.donut-label strong').textContent, '13%');
  await input(view.container.querySelector('.owner-edit input'), 'Pilote du nouveau projet');
  await click(view.container.querySelector('.owner-edit button'));
  assert.equal(view.container.querySelector('.detail-title small').textContent, 'Pilote du nouveau projet');
  await input(selector, LEGACY_ID);
  assert.equal(view.container.querySelector('.metric > strong').textContent, '107');
  await click([...view.container.querySelectorAll('button')].find(b => b.textContent === 'Mes projets'));
  assert.equal(view.container.querySelectorAll('.project-card').length, 3);
  await view.unmount();
});

test('SQL setup preserves old tables, creates projects atomically and isolates equal point IDs', async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create table audit_points(id integer primary key, status integer, owner text); insert into audit_points values(1,1,'Historique'); create table audit_settings(audit text primary key, due date); insert into audit_settings values('GMP','2026-10-09');");
    const original = (await db.query('select * from audit_points')).rows;
    await db.exec(await fs.readFile('supabase/projects.sql', 'utf8'));
    assert.deepEqual((await db.query('select * from audit_points')).rows, original);
    const seed = initialProjects(localStorage, false)[1];
    const p1 = { ...projectRow(seed), id: 'project-one', points: seed.points };
    const p2 = { ...p1, id: 'project-two' };
    await db.query('select create_audit_project($1::jsonb)', [JSON.stringify(p1)]);
    await db.query('select create_audit_project($1::jsonb)', [JSON.stringify(p2)]);
    assert.equal((await db.query('select count(*)::int as n from audit_project_points')).rows[0].n, 30);
    await db.query("update audit_project_points set status=1, owner='Modifié' where project_id='project-one' and id=1");
    await db.query('select create_audit_project($1::jsonb)', [JSON.stringify(p1)]);
    assert.equal((await db.query("select owner from audit_project_points where project_id='project-one' and id=1")).rows[0].owner, 'Modifié', 'An idempotent import never resets a live project');
    assert.notEqual((await db.query("select owner from audit_project_points where project_id='project-two' and id=1")).rows[0].owner, 'Modifié');
    await db.query("select set_audit_project_deadline('project-one','GMP','2027-01-01')");
    assert.equal((await db.query("select deadlines->>'GMP' as due from audit_projects where id='project-one'")).rows[0].due, '2027-01-01');
    assert.equal((await db.query("select deadlines->>'GMP' as due from audit_projects where id='project-two'")).rows[0].due, seed.deadlines.GMP);
    const invalid = { ...p1, id: 'invalid-import', points: [{ ...p1.points[0], status: 2 }] };
    await assert.rejects(db.query('select create_audit_project($1::jsonb)', [JSON.stringify(invalid)]));
    assert.equal((await db.query("select count(*)::int as n from audit_projects where id='invalid-import'")).rows[0].n, 0, 'A failed point rolls back the whole import');
    await db.exec('set role anon');
    assert.equal((await db.query('select count(*)::int as n from audit_projects')).rows[0].n, 2);
    await db.query("select set_audit_project_deadline('project-two','SMETA','2027-02-01')");
  } finally { await db.close(); }
});
