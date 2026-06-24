/* Logo CCC en azul marino para exportación PDF */
(function (window) {
  "use strict";

  window.PEA = window.PEA || {};

  function svgToDataUrl(svg) {
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  function getLogoDataUrl() {
    var navy = "#0F2A4A";
    var svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="280" viewBox="0 0 1200 280">',
      '<rect width="1200" height="280" fill="white"/>',
      '<g fill="none" stroke="' + navy + '" stroke-width="10">',
      '<path d="M40 28h230v190c0 10-4 22-14 34-35 18-71 25-101 25s-66-7-101-25c-10-12-14-24-14-34V28z"/>',
      '<path d="M78 63h62v26h70V63h33v150c-24 13-56 19-88 19s-64-6-88-19V63h11z"/>',
      '</g>',
      '<circle cx="155" cy="206" r="16" fill="' + navy + '"/>',
      '<text x="330" y="132" fill="' + navy + '" font-family="Georgia,serif" font-size="112" font-weight="700" letter-spacing="8">ITSQMET</text>',
      '<line x1="330" y1="162" x2="1130" y2="162" stroke="' + navy + '" stroke-width="6"/>',
      '<text x="330" y="222" fill="' + navy + '" font-family="Georgia,serif" font-size="42" font-weight="700" letter-spacing="5">FORMANDO PROFESIONALES DE ÉLITE</text>',
      '</svg>'
    ].join("");

    return svgToDataUrl(svg);
  }

  window.PEA.cccLogo = {
    getDataUrl: getLogoDataUrl
  };
})(window);
