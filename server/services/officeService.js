const fs = require('fs-extra');
const path = require('path');
const { buildOutputPath } = require('../utils/fileUtils');

function convertWithLibreOffice(inputBuffer, targetExt) {
  return new Promise((resolve, reject) => {
    let libre;
    try {
      libre = require('libreoffice-convert');
    } catch (err) {
      return reject(
        new Error('This conversion requires the "libreoffice-convert" package and a LibreOffice install on the server.')
      );
    }
    libre.convert(inputBuffer, targetExt, undefined, (err, done) => {
      if (err) {
        return reject(
          new Error(
            'Document conversion failed. Make sure LibreOffice (soffice) is installed and accessible on the server PATH.'
          )
        );
      }
      resolve(done);
    });
  });
}

async function wordToPdf(filePath) {
  const inputBuffer = await fs.readFile(filePath);
  const outputBuffer = await convertWithLibreOffice(inputBuffer, '.pdf');
  const outPath = buildOutputPath(`${path.basename(filePath, path.extname(filePath))}.pdf`);
  await fs.writeFile(outPath, outputBuffer);
  return outPath;
}

async function pdfToWord(filePath) {
  const inputBuffer = await fs.readFile(filePath);
  const outputBuffer = await convertWithLibreOffice(inputBuffer, '.docx');
  const outPath = buildOutputPath(`${path.basename(filePath, path.extname(filePath))}.docx`);
  await fs.writeFile(outPath, outputBuffer);
  return outPath;
}

module.exports = { wordToPdf, pdfToWord };
