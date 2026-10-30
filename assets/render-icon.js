// Transforme logo.svg en PNG 1024 × 1024 transparent.
// osascript -l JavaScript render-icon.js logo.svg logo.png [taille]
ObjC.import('Cocoa');

function run(argv) {
  const [src, dest] = argv;
  const size = +(argv[2] || 1024);
  const img = $.NSImage.alloc.initWithContentsOfFile($(src));
  if (img.isNil()) return 'SVG illisible';
  const rep = $.NSBitmapImageRep.alloc.initWithBitmapDataPlanesPixelsWidePixelsHighBitsPerSampleSamplesPerPixelHasAlphaIsPlanarColorSpaceNameBytesPerRowBitsPerPixel(
    null, size, size, 8, 4, true, false, $.NSCalibratedRGBColorSpace, 0, 0);
  rep.size = $.NSMakeSize(size, size);
  $.NSGraphicsContext.saveGraphicsState;
  $.NSGraphicsContext.setCurrentContext($.NSGraphicsContext.graphicsContextWithBitmapImageRep(rep));
  img.drawInRectFromRectOperationFraction($.NSMakeRect(0, 0, size, size), $.NSMakeRect(0, 0, 0, 0), $.NSCompositingOperationSourceOver, 1);
  $.NSGraphicsContext.restoreGraphicsState;
  const png = rep.representationUsingTypeProperties($.NSBitmapImageFileTypePNG, $.NSDictionary.dictionary);
  png.writeToFileAtomically($(dest), true);
  const a = rep.colorAtXY(2, 2), c = rep.colorAtXY(size >> 1, size >> 1);
  return `${size}px, alpha coin=${a.isNil() ? '?' : a.alphaComponent}, alpha centre=${c.isNil() ? '?' : c.alphaComponent}`;
}
