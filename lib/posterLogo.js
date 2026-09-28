import { LOGO_SVG_INNER, LOGO_VIEWBOX_WIDTH, LOGO_VIEWBOX_HEIGHT, ISOLOGO_SVG_INNER, ISOLOGO_VIEWBOX } from "./logoMarkup";

export { LOGO_VIEWBOX_WIDTH, LOGO_VIEWBOX_HEIGHT, ISOLOGO_SVG_INNER };

// El isologo (solo el escudo, sin texto) no tiene id ni clip-path -- a
// diferencia del logo completo, se puede incrustar tal cual las veces que
// haga falta sin necesidad de sufijo. Su recuadro real (medido con
// getBBox, no el viewBox 0..912 del archivo completo) arranca desplazado,
// así que para ubicarlo en un punto (destX, destY) con un ancho dado hay
// que compensar ese desplazamiento -- ver isologoTransform más abajo.
const [ISOLOGO_X, ISOLOGO_Y, ISOLOGO_WIDTH, ISOLOGO_HEIGHT] = ISOLOGO_VIEWBOX.split(" ").map(Number);
export { ISOLOGO_X, ISOLOGO_Y, ISOLOGO_WIDTH, ISOLOGO_HEIGHT };

// Transform SVG para dibujar el isologo con un ancho dado, con su esquina
// superior izquierda real (no la del viewBox del archivo original) en
// (destX, destY).
export function isologoTransform(destX, destY, targetWidth) {
  const scale = targetWidth / ISOLOGO_WIDTH;
  const tx = destX - ISOLOGO_X * scale;
  const ty = destY - ISOLOGO_Y * scale;
  return { transform: `translate(${tx}, ${ty}) scale(${scale})`, height: ISOLOGO_HEIGHT * scale };
}

// El logo se incrusta más de una vez en el mismo póster (marca de agua +
// logo de encabezado). El SVG original define sus <clipPath> con ids
// fijos (clippath, clippath-1, ...) -- si se pega la misma marca dos
// veces tal cual, esos ids chocan. Esta función le agrega un sufijo único
// a cada copia (tanto al id="..." como a su referencia url(#...)), para
// que cada instancia quede autocontenida y no dependa de cuál gane el
// choque.
export function logoMarkupWithSuffix(suffix) {
  return LOGO_SVG_INNER
    .replace(/id="(clippath[-\w]*)"/g, (_m, id) => `id="${id}-${suffix}"`)
    .replace(/url\(#(clippath[-\w]*)\)/g, (_m, id) => `url(#${id}-${suffix})`);
}
