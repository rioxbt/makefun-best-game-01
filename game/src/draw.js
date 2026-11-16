// Drawing primitives and nothing else: circles, rings, arcs, polygons, gradients, glows and text
// over a 2D canvas context. None of these know anything about the game, which keeps the geometry
// and the rule book apart and lets the renderer read like a description of the scene.

import { FONT } from './config.js';

const TAU = Math.PI * 2;

/** A colour with an alpha, whatever form the colour came in: #rgb, #rrggbb or rgb(). */
export function withAlpha(color, alpha) {
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
    const value = Number.parseInt(full, 16);
    return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
  }
  return color;
}

export function createPainter(context, boxWidth, boxHeight) {
  const fontCache = new Map();

  function setFont(size, weight) {
    const key = `${weight}|${size}`;
    let font = fontCache.get(key);
    if (font === undefined) {
      font = `${weight} ${size}px ${FONT}`;
      fontCache.set(key, font);
    }
    context.font = font;
  }

  return {
    context,

    circle(x, y, radius, color) {
      context.fillStyle = color;
      context.beginPath();
      context.arc(x, y, radius, 0, TAU);
      context.fill();
    },

    /** A soft ball of light: bright at the centre, gone at the rim. */
    glow(x, y, radius, color, alpha) {
      if (radius <= 0 || alpha <= 0) return;
      const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, withAlpha(color, alpha));
      gradient.addColorStop(0.45, withAlpha(color, alpha * 0.42));
      gradient.addColorStop(1, withAlpha(color, 0));
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(x, y, radius, 0, TAU);
      context.fill();
    },

    ring(x, y, radius, width, color) {
      context.strokeStyle = color;
      context.lineWidth = width;
      context.beginPath();
      context.arc(x, y, radius, 0, TAU);
      context.stroke();
    },

    /** A band of an annulus: the shield's own shape. */
    arcBand(x, y, radius, from, to, width, color) {
      context.strokeStyle = color;
      context.lineWidth = width;
      context.lineCap = 'round';
      context.beginPath();
      context.arc(x, y, radius, from, to);
      context.stroke();
      context.lineCap = 'butt';
    },

    /** A closed polygon from a list of [x, y] offsets, rotated by `spin` and placed at (x, y). */
    polygon(x, y, points, spin, color) {
      const cos = Math.cos(spin);
      const sin = Math.sin(spin);
      context.fillStyle = color;
      context.beginPath();
      for (let i = 0; i < points.length; i += 1) {
        const px = x + points[i][0] * cos - points[i][1] * sin;
        const py = y + points[i][0] * sin + points[i][1] * cos;
        if (i === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      context.closePath();
      context.fill();
    },

    /** A stroked polygon, for shapes that read better as outlines in the dark. */
    polygonOutline(x, y, points, spin, width, color) {
      const cos = Math.cos(spin);
      const sin = Math.sin(spin);
      context.strokeStyle = color;
      context.lineWidth = width;
      context.lineJoin = 'round';
      context.beginPath();
      for (let i = 0; i < points.length; i += 1) {
        const px = x + points[i][0] * cos - points[i][1] * sin;
        const py = y + points[i][0] * sin + points[i][1] * cos;
        if (i === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      context.closePath();
      context.stroke();
    },

    line(x1, y1, x2, y2, width, color) {
      context.strokeStyle = color;
      context.lineWidth = width;
      context.beginPath();
      context.moveTo(x1, y1);
      context.lineTo(x2, y2);
      context.stroke();
    },

    /** A straight-sided box, optionally with rounded corners. */
    box(x, y, width, height, radius, color) {
      context.fillStyle = color;
      context.beginPath();
      if (radius <= 0) context.rect(x, y, width, height);
      else if (typeof context.roundRect === 'function') context.roundRect(x, y, width, height, radius);
      else context.rect(x, y, width, height);
      context.fill();
    },

    boxOutline(x, y, width, height, radius, lineWidth, color) {
      context.strokeStyle = color;
      context.lineWidth = lineWidth;
      context.beginPath();
      if (radius <= 0) context.rect(x, y, width, height);
      else if (typeof context.roundRect === 'function') context.roundRect(x, y, width, height, radius);
      else context.rect(x, y, width, height);
      context.stroke();
    },

    /** The abyss behind everything: a vertical gradient, written into the field box only. */
    gradient(x, y, width, height, top, bottom) {
      const gradient = context.createLinearGradient(x, y, x, y + height);
      gradient.addColorStop(0, top);
      gradient.addColorStop(1, bottom);
      context.fillStyle = gradient;
      context.fillRect(x, y, width, height);
    },

    /** A dark or coloured wash that thickens toward the edges: the hurt flash and the dying light. */
    vignette(x, y, inner, outer, color, alpha) {
      if (alpha <= 0) return;
      const gradient = context.createRadialGradient(x, y, inner, x, y, outer);
      gradient.addColorStop(0, withAlpha(color, 0));
      gradient.addColorStop(0.55, withAlpha(color, alpha * 0.35));
      gradient.addColorStop(1, withAlpha(color, alpha));
      context.fillStyle = gradient;
      context.fillRect(0, 0, boxWidth, boxHeight);
    },

    /** A flat wash over the whole field. */
    wash(color, alpha) {
      if (alpha <= 0) return;
      context.fillStyle = withAlpha(color, alpha);
      context.fillRect(0, 0, boxWidth, boxHeight);
    },

    text(value, x, y, size, color, align = 'left', baseline = 'top', weight = '600') {
      setFont(size, weight);
      context.fillStyle = color;
      context.textAlign = align;
      context.textBaseline = baseline;
      context.fillText(value, x, y);
    },

    /** Text with a halo behind it, for the few things that must read over a busy field. */
    textGlow(value, x, y, size, color, align, baseline, weight) {
      setFont(size, weight);
      context.save();
      context.shadowColor = withAlpha(color, 0.85);
      context.shadowBlur = size * 0.6;
      context.fillStyle = color;
      context.textAlign = align;
      context.textBaseline = baseline;
      context.fillText(value, x, y);
      context.fillText(value, x, y);
      context.restore();
    },
  };
}
