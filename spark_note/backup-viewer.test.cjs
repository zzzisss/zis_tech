const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const demoPath = path.resolve(__dirname, '../../../workspace-mobile/docs/app-store/spark-note-screenshot-demo-backup.json');
const fallbackDemo = {
  kind: 'spark-note-backup',
  version: 1,
  exportedAt: 1780185600000,
  boxes: ['ideas', 'daily', 'writing', 'reading', 'observe'].map((id) => ({ id: `box-${id}`, name: id })),
  notes: [
    '今天捷運上突然想到：不是沒有靈感，而是沒有留白。',
    '下雨天在咖啡店靠窗。',
    '傍晚市場的顏色很好看。',
    '想做的 app 不一定要很大，它只要能接住一個人的日常就很有價值。',
    '晚餐後散步。',
    '煮麵時想到首頁。',
    '重看一本書。',
    '今天有件小事。',
    '留給之後的一句話。',
    '週末想畫地圖。',
    '這是一則保留在垃圾桶裡的示範筆記。',
  ].map((text, index) => ({
    id: `note-${index}`,
    text,
    createdAt: 1780171200000 + index * 60000,
    updatedAt: 1780171200000 + index * 60000,
    isFavorite: [0, 3, 8].includes(index),
    boxId: index === 9 ? undefined : `box-${['ideas', 'writing', 'observe', 'ideas', 'daily', 'ideas', 'reading', 'daily', 'writing', '', 'daily'][index]}`,
    ...(index === 10 ? { deletedAt: 1780191000000 } : {}),
  })),
};
const demo = fs.existsSync(demoPath) ? JSON.parse(fs.readFileSync(demoPath, 'utf8')) : fallbackDemo;

function setup() {
  class Element {
    constructor() {
      this.children = [];
      this.listeners = {};
      this.value = '';
      this.textContent = '';
      this.hidden = false;
      this.files = [];
      this.scrollHeight = 0;
      this.clientHeight = 0;
      this.attributes = {};
      const classes = new Set();
      this.classList = {
        add: (name) => classes.add(name),
        toggle: (name, force) => force ? classes.add(name) : classes.delete(name),
        contains: (name) => classes.has(name),
      };
    }

    addEventListener(type, handler) { this.listeners[type] = handler; }
    setAttribute(name, value) { this.attributes[name] = value; }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children.flatMap((child) => child.isFragment ? child.children : [child]); }
    add(option) { this.children.push(option); }
    async fire(type) { await this.listeners[type](); }
  }

  const ids = Object.fromEntries([
    'backup-file', 'file-status', 'viewer-content', 'backup-name', 'backup-meta',
    'backup-count', 'export-pdf', 'print-note-times', 'print-selection', 'box-filter', 'note-search',
    'result-count', 'note-list', 'empty-results',
  ].map((id) => [id, new Element()]));
  const radios = ['all', 'favorite', 'trash'].map((value) => Object.assign(new Element(), { value, checked: value === 'all' }));
  const window = new Element();
  window.printCount = 0;
  window.print = () => { window.printCount += 1; };
  const document = {
    querySelector(selector) {
      if (selector.startsWith('#')) return ids[selector.slice(1)];
      if (selector.includes(':checked')) return radios.find((radio) => radio.checked);
      if (selector.includes('[value="all"]')) return radios[0];
      throw new Error(`Unknown selector: ${selector}`);
    },
    querySelectorAll() { return radios; },
    createElement() { return new Element(); },
    createDocumentFragment() { return Object.assign(new Element(), { isFragment: true }); },
  };
  const source = fs.readFileSync(path.join(__dirname, 'backup-viewer.js'), 'utf8');
  vm.runInNewContext(source, { document, window, Intl, Option: class { constructor(text, value) { this.text = text; this.value = value; } } });

  async function open(data, name = 'backup.json') {
    ids['backup-file'].files = [{ name, text: async () => data }];
    await ids['backup-file'].fire('change');
  }

  function noteTexts() {
    return ids['note-list'].children.map((article) => article.children[0].textContent);
  }

  return { ids, radios, window, open, noteTexts };
}

test('reads the demo backup and keeps trash separate from active notes', async () => {
  const view = setup();
  await view.open(JSON.stringify(demo));
  assert.equal(view.ids['viewer-content'].hidden, false);
  assert.equal(view.noteTexts().length, 10);
  assert.match(view.ids['backup-count'].textContent, /10 則筆記 · 1 則垃圾桶筆記 · 5 個分類箱/);
  view.radios.forEach((radio) => { radio.checked = radio.value === 'trash'; });
  await view.radios[2].fire('change');
  assert.deepEqual(view.noteTexts(), ['這是一則保留在垃圾桶裡的示範筆記。']);
});

test('filters favorites, boxes, and search text', async () => {
  const view = setup();
  await view.open(JSON.stringify(demo));
  view.radios.forEach((radio) => { radio.checked = radio.value === 'favorite'; });
  await view.radios[1].fire('change');
  assert.equal(view.noteTexts().length, 3);
  view.ids['box-filter'].value = 'box-ideas';
  await view.ids['box-filter'].fire('change');
  assert.equal(view.noteTexts().length, 2);
  view.ids['note-search'].value = 'app';
  await view.ids['note-search'].fire('input');
  assert.deepEqual(view.noteTexts(), ['想做的 app 不一定要很大，它只要能接住一個人的日常就很有價值。']);
});

test('reports invalid JSON and wrong backup versions without showing old notes', async () => {
  const view = setup();
  await view.open(JSON.stringify(demo));
  await view.open('{');
  assert.equal(view.ids['viewer-content'].hidden, true);
  assert.equal(view.noteTexts().length, 0);
  assert.match(view.ids['file-status'].textContent, /無法讀取 JSON/);
  await view.open(JSON.stringify({ ...demo, version: 2 }));
  assert.match(view.ids['file-status'].textContent, /不是有效的 Spark Note/);
});

test('treats note text as text and tolerates invalid timestamps', async () => {
  const view = setup();
  const text = '<img src=x onerror=alert(1)>';
  await view.open(JSON.stringify({ ...demo, notes: [{ ...demo.notes[0], text, createdAt: 1e100 }] }));
  assert.equal(view.noteTexts()[0], text);
  assert.match(view.ids['note-list'].children[0].children[2].children[1].textContent, /時間不詳/);
});

test('shows a toggle only when note text exceeds six lines', async () => {
  const view = setup();
  await view.open(JSON.stringify({ ...demo, notes: [demo.notes[0]] }));
  const [text, button] = view.ids['note-list'].children[0].children;
  assert.equal(button.hidden, true);
  text.scrollHeight = 200;
  text.clientHeight = 153;
  await view.window.fire('resize');
  assert.equal(button.hidden, false);
  assert.equal(button.textContent, '展開全文');
  await button.fire('click');
  assert.equal(button.textContent, '收起');
  assert.equal(button.attributes['aria-expanded'], 'true');
  await button.fire('click');
  assert.equal(button.textContent, '展開全文');
});

test('PDF action uses the current visible filters and disables on empty results', async () => {
  const view = setup();
  await view.open(JSON.stringify(demo));
  view.ids['print-note-times'].checked = true;
  await view.ids['print-note-times'].fire('change');
  assert.equal(view.ids['viewer-content'].classList.contains('hide-print-times'), false);
  view.ids['print-note-times'].checked = false;
  await view.ids['print-note-times'].fire('change');
  assert.equal(view.ids['viewer-content'].classList.contains('hide-print-times'), true);
  await view.ids['export-pdf'].fire('click');
  assert.equal(view.window.printCount, 1);
  view.ids['box-filter'].value = 'box-ideas';
  await view.ids['box-filter'].fire('change');
  view.ids['note-search'].value = 'app';
  await view.ids['note-search'].fire('input');
  assert.equal(view.noteTexts().length, 1);
  assert.match(view.ids['print-selection'].textContent, /box|靈感/);
  assert.match(view.ids['print-selection'].textContent, /搜尋「app」 · 1 則筆記/);
  await view.ids['export-pdf'].fire('click');
  assert.equal(view.window.printCount, 2);
  view.ids['note-search'].value = 'no matching note';
  await view.ids['note-search'].fire('input');
  assert.equal(view.ids['export-pdf'].disabled, true);
  await view.ids['export-pdf'].fire('click');
  assert.equal(view.window.printCount, 2);
});
