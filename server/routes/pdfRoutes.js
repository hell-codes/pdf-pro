const express = require('express');
const upload = require('../middleware/upload');
const controller = require('../controllers/pdfController');

const router = express.Router();
const many = upload.array('files', 20);

router.post('/merge', many, controller.mergePdfs);
router.post('/split', many, controller.splitPdf);
router.post('/rotate', many, controller.rotatePdf);
router.post('/delete-pages', many, controller.deletePages);
router.post('/rearrange', many, controller.rearrangePages);
router.post('/watermark', many, controller.addWatermark);
router.post('/page-numbers', many, controller.addPageNumbers);
router.post('/extract-images', many, controller.extractImages);
router.post('/images-to-pdf', many, controller.imagesToPdf);
router.post('/pdf-to-jpg', many, controller.pdfToJpg);
router.post('/compress', many, controller.compressPdf);
router.post('/word-to-pdf', many, controller.wordToPdf);
router.post('/pdf-to-word', many, controller.pdfToWord);
router.post('/protect', many, controller.protectPdf);
router.post('/unlock', many, controller.unlockPdf);

module.exports = router;
