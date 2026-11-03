/**
 * ISO/IEC 15417 Code 128 Barcode Generator (Pure TypeScript, Zero External Dependencies)
 * Generates crisp vector SVG barcodes scannable by all commercial 1D and 2D barcode scanners.
 */

// Code 128 symbol patterns (values 0 - 106)
// Each number represents widths of 3 bars and 3 spaces (sum = 11 modules, except stop = 13)
const CODE128_PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213", // 0-9
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132", // 10-19
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211", // 20-29
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313", // 30-39
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331", // 40-49
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111", // 50-59
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214", // 60-69
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111", // 70-79
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141", // 80-89
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141", // 90-99
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112" // 100-106 (106 is STOP pattern)
];

const START_CODE_B = 104;
const STOP_CODE = 106;

/**
 * Encodes an ASCII string into Code 128 (Subset B) module pattern (1s for black bars, 0s for white spaces).
 */
export function encodeCode128(text: string): { modules: number[]; checksum: number } {
  // Subset B starts at ASCII 32 (' ') -> index 0
  const values: number[] = [START_CODE_B];

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 32 && code <= 126) {
      values.push(code - 32);
    } else {
      // Replace non-printable ASCII with space (value 0)
      values.push(0);
    }
  }

  // Calculate modulo 103 checksum
  let checksum = values[0];
  for (let i = 1; i < values.length; i++) {
    checksum += values[i] * i;
  }
  checksum %= 103;
  values.push(checksum);
  values.push(STOP_CODE);

  // Convert pattern codes to binary module array (1 = bar, 0 = space)
  const modules: number[] = [];

  // Quiet zone of 10 modules
  for (let q = 0; q < 10; q++) modules.push(0);

  for (const val of values) {
    const pattern = CODE128_PATTERNS[val];
    let isBar = true;
    for (let p = 0; p < pattern.length; p++) {
      const width = parseInt(pattern[p], 10);
      for (let w = 0; w < width; w++) {
        modules.push(isBar ? 1 : 0);
      }
      isBar = !isBar;
    }
  }

  // Final quiet zone of 10 modules
  for (let q = 0; q < 10; q++) modules.push(0);

  return { modules, checksum };
}

export interface BarcodeSvgOptions {
  height?: number;
  moduleWidth?: number;
  showText?: boolean;
  className?: string;
}

/**
 * Generates an SVG string for a Code 128 barcode.
 */
export function generateCode128Svg(text: string, options: BarcodeSvgOptions = {}): string {
  const {
    height = 60,
    moduleWidth = 2,
    showText = true,
    className = "",
  } = options;

  const { modules } = encodeCode128(text);
  const totalWidth = modules.length * moduleWidth;
  const barHeight = showText ? height - 16 : height;

  // Group continuous bars into rects for optimal SVG size
  const rects: string[] = [];
  let inBar = false;
  let barStart = 0;

  for (let i = 0; i < modules.length; i++) {
    if (modules[i] === 1) {
      if (!inBar) {
        inBar = true;
        barStart = i;
      }
    } else {
      if (inBar) {
        inBar = false;
        const width = (i - barStart) * moduleWidth;
        rects.push(`<rect x="${barStart * moduleWidth}" y="0" width="${width}" height="${barHeight}" fill="#000000"/>`);
      }
    }
  }
  if (inBar) {
    const width = (modules.length - barStart) * moduleWidth;
    rects.push(`<rect x="${barStart * moduleWidth}" y="0" width="${width}" height="${barHeight}" fill="#000000"/>`);
  }

  const textElement = showText
    ? `<text x="${totalWidth / 2}" y="${height - 2}" font-family="monospace, monospace" font-size="12" font-weight="600" text-anchor="middle" fill="#000000" letter-spacing="2">${text}</text>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${height}" width="${totalWidth}" height="${height}" class="${className}" style="display:block;max-width:100%;">${rects.join("")}${textElement}</svg>`;
}
