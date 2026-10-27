(function () {
  'use strict';
  try {
    var saved = localStorage.getItem('tyspace-theme');
    var theme = saved || (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark');
  } catch (e) { /* retain the safe dark default */ }
}());
