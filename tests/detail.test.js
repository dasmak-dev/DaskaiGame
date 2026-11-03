/* Ficha del daskai (Equipo): acciones compactas y atributos con desglose plegable. */
const { play, sleep, check } = require('./helpers');

module.exports = {
  name: 'Ficha del daskai',
  cases: [{
    name: 'Acciones en una barra y atributos compactos que caben, con el desglose al pulsar',
    views: ['desktop', 'mobile'],
    run: (browser, view) => play(browser, view, async (p) => {
      await p.evaluate(() => { DK.party.add(DK.daskai.create('brotin', 6)); const d = DK.party.active()[0]; DK.router.reset('team', { uid: d.uid }); });
      await sleep(800);
      const r = await p.evaluate(() => {
        const panel = document.querySelector('.daskai-panel'), pr = panel.getBoundingClientRect();
        const rows = [...panel.querySelectorAll('.st2-row')];
        const tabs = [...panel.querySelectorAll('.tabs .tab')].map((x) => x.getBoundingClientRect());
        return {
          tools: panel.querySelectorAll('.dp-tools .dp-tool').length, labelled: [...panel.querySelectorAll('.dp-tool')].every((b) => b.getAttribute('aria-label')),
          rows: rows.length, closed: rows.every((x) => !x.open), bars: panel.querySelectorAll('.st2-row .stat-bar').length,
          fit: [...panel.querySelectorAll('.st2-sum, .dp-actions')].every((x) => x.getBoundingClientRect().right <= pr.right + 1),
          tabsFit: tabs.every((x) => x.right <= pr.right + 1), rename: !!panel.querySelector('.dp-rename'),
        };
      });
      check(r.tools >= 3 && r.labelled, 'las acciones secundarias deberían ser iconos con nombre: ' + JSON.stringify(r));
      check(r.rows === 8 && r.closed && r.bars === 8, 'deberían verse los 8 atributos con su barra y el desglose plegado: ' + JSON.stringify(r));
      check(r.fit && r.tabsFit, 'la ficha se sale por la derecha: ' + JSON.stringify(r));
      check(r.rename, 'falta el lápiz para cambiar el apodo');
      await p.click('.st2-row.k-atk > summary'); await sleep(150);
      const one = await p.evaluate(() => ({ open: document.querySelector('.st2-row.k-atk').open, text: document.querySelector('.st2-row.k-atk .st2-more').textContent }));
      check(one.open && /base/.test(one.text), 'al pulsar un atributo debería verse su desglose: ' + JSON.stringify(one));
      await p.click('.st2-all'); await sleep(150);
      check(await p.evaluate(() => [...document.querySelectorAll('.st2-row')].every((x) => x.open)), '«Ver todo el desglose» debería abrirlos todos');
      await p.click('.dp-items'); await sleep(300);
      check(await p.evaluate(() => !!document.querySelector('.daskai-panel .inline-panel')), 'el botón de usar objeto no abre su panel');
    }),
  }, {
    name: 'Perfil: sin lema, cifras principales arriba y avance de la partida',
    views: ['desktop', 'mobile'],
    run: (browser, view) => play(browser, view, async (p) => {
      await p.evaluate(() => DK.router.reset('profile')); await sleep(600);
      const r = await p.evaluate(() => {
        const scr = document.querySelector('.profile-screen'), w = scr.getBoundingClientRect().right;
        return { motto: !!document.querySelector('.profile-motto'), head: document.querySelectorAll('.ph-stat').length, pp: document.querySelectorAll('.pp-row').length,
          pk: document.querySelectorAll('.pk').length, title: !!document.querySelector('.ph-title-select'), fit: [...scr.querySelectorAll('.ph, .pp, .pk')].every((e) => e.getBoundingClientRect().right <= w + 1) };
      });
      check(!r.motto, 'el lema debería haberse quitado');
      check(r.head === 4 && r.pp === 6 && r.pk === 8 && r.title, 'faltan datos en el perfil: ' + JSON.stringify(r));
      check(r.fit, 'el perfil se sale por la derecha');
    }),
  }],
};
