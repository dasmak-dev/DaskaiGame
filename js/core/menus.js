/* =============================================================
 * core/menus.js — Registro de menús.
 *
 * Cualquier archivo puede añadir una opción a un menú sin tocar
 * los demás. Menús existentes: 'main' (menú principal) y 'hub'
 * (campamento).
 *
 *   DK.menus.add('hub', {
 *     id: 'tienda',              // único dentro del menú
 *     icon: 'shop',
 *     label: () => DK.t('menu.shop'),     // texto o función
 *     desc:  () => DK.t('menu.shopDesc'),
 *     order: 35,                 // posición (menor = antes)
 *     screen: 'shop',            // pantalla a abrir...
 *     action: () => {},          // ...o una acción propia
 *     visible: () => true,       // ocultar según condición
 *     disabled: () => false,
 *     badge: () => '3',          // insignia de la esquina
 *     accent: '#22c55e',         // color de la tarjeta
 *   });
 * ============================================================= */
(function () {
  const menus = {};
  const val = (x) => (typeof x === 'function' ? x() : x);

  DK.menus = {
    /** Crea un menú vacío si no existe. */
    define(id) { menus[id] = menus[id] || []; return menus[id]; },

    /** Añade o sustituye (mismo id) una opción. */
    add(menuId, item) {
      const list = this.define(menuId);
      const i = list.findIndex((x) => x.id === item.id);
      if (i >= 0) list[i] = item; else list.push(item);
      return item;
    },

    /** Quita una opción. */
    remove(menuId, itemId) { menus[menuId] = (menus[menuId] || []).filter((x) => x.id !== itemId); },

    /** Opciones visibles ordenadas. */
    items(menuId) {
      return (menus[menuId] || []).filter((x) => !x.visible || x.visible()).sort((a, b) => (a.order || 0) - (b.order || 0));
    },

    /** Ejecuta una opción (acción o navegación). */
    activate(item) {
      if (item.action) item.action();
      else if (item.screen) DK.router.go(item.screen, typeof item.params === 'function' ? item.params() : item.params || {});
    },

    /**
     * Pinta un menú.
     * @param {string} menuId
     * @param {Object} [o]
     * @param {'grid'|'stack'|'row'} [o.layout] tarjetas, botones grandes o fila de botones
     * @param {boolean} [o.hotkeys] asigna teclas 1..9 a las opciones
     */
    render(menuId, { layout = 'grid', hotkeys = true } = {}) {
      const { h, tile, btn } = DK.ui;
      const wrap = h('div', { class: 'menu menu-' + layout });
      this.items(menuId).forEach((it, i) => {
        const disabled = it.disabled ? it.disabled() : false;
        const key = hotkeys && i < 9 ? String(i + 1) : null;
        const go = () => this.activate(it);
        if (key && !disabled) DK.keys.on(key, go);
        wrap.append(layout === 'stack' || layout === 'row'
          ? btn({ icon: it.icon, label: val(it.label), desc: val(it.desc), size: layout === 'stack' ? 'lg' : '', variant: it.variant || 'primary', disabled, onClick: go, hotkey: key, tip: layout === 'row' ? val(it.desc) : null })
          : tile({ icon: it.icon, label: val(it.label), desc: val(it.desc), disabled, accent: it.accent, badge: it.badge ? it.badge() : null, onClick: go, hotkey: key }));
      });
      return wrap;
    },
  };
})();
