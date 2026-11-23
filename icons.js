/**
 * Minimalist 1.5px-stroke geometric line icon library (Lucide-aligned)
 * Shared between WeChat Mini-Program (via SVG Data-URI) and Web Simulator (inline SVG or Data-URI).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Icons = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const ICONS = {
    round:
      '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/><path d="M12 4v4.5M12 15.5V20M4 12h4.5M15.5 12H20"/>',
    square:
      '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="8.5" y="8.5" width="7" height="7" rx="0.5"/><path d="M4 4l4.5 4.5M20 4l-4.5 4.5M4 20l4.5-4.5M20 20l-4.5-4.5"/>',
    search:
      '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    close:
      '<path d="M18 6L6 18M6 6l12 12"/>',
    star:
      '<polygon points="12 3 14.8 8.7 21 9.6 16.5 14 17.6 20.2 12 17.3 6.4 20.2 7.5 14 3 9.6 9.2 8.7 12 3"/>',
    starFilled:
      '<polygon fill="currentColor" points="12 3 14.8 8.7 21 9.6 16.5 14 17.6 20.2 12 17.3 6.4 20.2 7.5 14 3 9.6 9.2 8.7 12 3"/>',
    bag:
      '<path d="M6 8h12l-1 12H7L6 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    dice:
      '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1" fill="currentColor"/><circle cx="15" cy="9" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="9" cy="15" r="1" fill="currentColor"/><circle cx="15" cy="15" r="1" fill="currentColor"/>',
    chevLeft:
      '<path d="M15 18l-6-6 6-6"/>',
    chevRight:
      '<path d="M9 18l6-6-6-6"/>',
    rotate:
      '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
    swap:
      '<path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/>',
    phone:
      '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
    monitor:
      '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    sweep:
      '<path d="M12 3l1.9 5.8L19.7 10.7l-5.8 1.9L12 18.4l-1.9-5.8L4.3 10.7l5.8-1.9z"/><path d="M19 4l.6 1.8L21.4 6.4l-1.8.6L19 8.8l-.6-1.8L16.6 6.4l1.8-.6z"/>'
  };

  function svg(name, color, size) {
    const body = ICONS[name] || '';
    const s = size || 16;
    const stroke = color || 'currentColor';
    const resolvedBody = body.replace(/currentColor/g, stroke);
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" width="' +
      s +
      '" height="' +
      s +
      '" viewBox="0 0 24 24" fill="none" stroke="' +
      stroke +
      '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      resolvedBody +
      '</svg>'
    );
  }

  function uri(name, color, size) {
    const raw = svg(name, color || '#525252', size || 18);
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(raw);
  }

  return {
    ICONS: ICONS,
    svg: svg,
    uri: uri
  };
});
