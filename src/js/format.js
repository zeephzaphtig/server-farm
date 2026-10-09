/* Number and time formatting. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.Fmt = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const SUF = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc', 'SxDc', 'SpDc', 'OcDc', 'NoDc',
    'Vg', 'UVg', 'DVg', 'TVg', 'QaVg', 'QiVg', 'SxVg', 'SpVg', 'OcVg', 'NoVg', 'Tg', 'UTg', 'DTg'];
  let notation = 'short';

  /** 3 significant digits, rounded down so you never see more than you have. */
  function num(n) {
    if (!isFinite(n)) return n > 0 ? 'MAX' : '0';
    if (n < 0) return '-' + num(-n);
    if (n < 1000) {
      if (n < 10) return trim((Math.floor(n * 100) / 100).toFixed(n < 1 ? 2 : 1));
      if (n < 100) return trim((Math.floor(n * 10) / 10).toFixed(1));
      return String(Math.floor(n));
    }
    const e = Math.floor(Math.log10(n) + 1e-9);
    if (notation === 'sci' || e >= SUF.length * 3) {
      const m = Math.floor(n / Math.pow(10, e - 2)) / 100;
      return m.toFixed(2) + 'e' + e;
    }
    const g = Math.floor(e / 3), m = n / Math.pow(10, g * 3);
    const digits = m >= 100 ? 0 : m >= 10 ? 1 : 2;
    const f = Math.pow(10, digits);
    return (Math.floor(m * f + 1e-7) / f).toFixed(digits) + SUF[g];
  }
  function trim(s) { return s.indexOf('.') >= 0 ? s.replace(/\.?0+$/, '') : s; }
  const money = (n) => '$' + num(n);

  function time(sec) {
    sec = Math.max(0, Math.floor(sec));
    const d = Math.floor(sec / 86400), h = Math.floor(sec / 3600) % 24, m = Math.floor(sec / 60) % 60, s = sec % 60;
    if (d) return `${d}d ${h}h`;
    if (h) return `${h}h ${m}m`;
    if (m) return `${m}m ${s}s`;
    return `${s}s`;
  }

  return { num, money, time, setNotation(n) { notation = n === 'sci' ? 'sci' : 'short'; }, get notation() { return notation; } };
});
