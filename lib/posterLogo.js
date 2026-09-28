import { LOGO_SVG_INNER, LOGO_VIEWBOX_WIDTH, LOGO_VIEWBOX_HEIGHT } from "./logoMarkup";

export { LOGO_VIEWBOX_WIDTH, LOGO_VIEWBOX_HEIGHT };

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
