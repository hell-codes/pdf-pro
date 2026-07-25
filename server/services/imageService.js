const fs = require('fs-extra');
const path = require('path');
const sharp = require('sharp');
const archiver = require('archiver');
const { PDFDocument } = require('pdf-lib');
const { buildOutputPath, buildTempPath } = require('../utils/fileUtils');

async function imagesToPdf(filePaths, options = {}) {
  const { pageSize = 'auto', margin = 0 } = options;
  const doc = await PDFDocument.create();

  for (const filePath of filePaths) {
    const buffer = await sharp(filePath)
      .rotate() 
      .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer();

    const image = await doc.embedJpg(buffer);
    let { width, height } = image;

    if (pageSize === 'a4') {
      const A4 = [595.28, 841.89];
      const scale = Math.min(A4[0] / width, A4[1] / height);
      const page = doc.addPage(A4);
      const drawW = width * scale - margin * 2;
      const drawH = height * scale - margin * 2;
      page.drawImage(image, {
        x: (A4[0] - drawW) / 2,
        y: (A4[1] - drawH) / 2,
        width: drawW,
        height: drawH,
      });
    } else {
      const page = doc.addPage([width, height]);
      page.drawImage(image, { x: 0, y: 0, width, height });
    }
  }

  const outPath = buildOutputPath('images-to-pdf.pdf');
  await fs.writeFile(outPath, await doc.save());
  return outPath;
}

async function pdfToJpg(filePath, options = {}) {
  const { quality = 90, dpi = 150 } = options;
  let convert;
  try {
    convert = require('pdf-poppler');
  } catch (err) {
    throw new Error(
      'PDF to JPG requires the "pdf-poppler" package and the system Poppler utilities (pdftoppm) to be installed on the server.'
    );
  }

  const tempDir = buildTempPath('pdf-to-jpg-out').replace(path.extname(buildTempPath('x')), '');
  await fs.ensureDir(tempDir);
  const baseName = 'page';

  try {
    await convert.convert(filePath, {
      format: 'jpeg',
      out_dir: tempDir,
      out_prefix: baseName,
      page: null, 
      scale: Math.round((dpi / 72) * 100),
    });
  } catch (err) {
    await fs.remove(tempDir);
    throw new Error('Failed to rasterize PDF pages. Ensure Poppler is installed on the server.');
  }

  const files = (await fs.readdir(tempDir)).filter((f) => f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.jpeg'));
  if (!files.length) {
    await fs.remove(tempDir);
    throw new Error('No pages could be converted to images.');
  }

  const outPath = buildOutputPath('pdf-to-jpg.zip');
  const output = fs.createWriteStream(outPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  await new Promise(async (resolve, reject) => {
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);

    for (const file of files.sort()) {
      const fullPath = path.join(tempDir, file);
      const optimized = await sharp(fullPath).jpeg({ quality: parseInt(quality, 10) || 90 }).toBuffer();
      archive.append(optimized, { name: file });
    }
    archive.finalize();
  });

  await fs.remove(tempDir);
  return outPath;
}

async function compressPdf(filePath, options = {}) {
  const { quality = 'medium' } = options; // low | medium | high (compression strength)
  const bytes = await fs.readFile(filePath);
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });

  const objectsPerTick = quality === 'high' ? 20 : quality === 'low' ? 200 : 60;

  const outBytes = await doc.save({
    useObjectStreams: true,
    addDefaultPage: false,
    objectsPerTick,
  });

  const outPath = buildOutputPath('compressed.pdf');
  await fs.writeFile(outPath, outBytes);
  return outPath;
}

module.exports = { imagesToPdf, pdfToJpg, compressPdf };
