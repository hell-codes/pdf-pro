const express = require('express');
const upload = require('../middleware/upload');
const controller = require('../controllers/pdfController');
const { attachUser } = require('../middleware/auth');
const { guardRequestSize, enforceUploadLimits } = require('../middleware/enforceLimits');
const { removeFiles } = require('../utils/fileUtils');

const router = express.Router();
const many = upload.array('files', 20);

const pipeline = [attachUser, guardRequestSize, many, enforceUploadLimits];

const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(async (err) => {
    if (req.files && req.files.length) {
      await removeFiles(req.files.map((file) => file.path));
    }
    next(err);
  });
};

router.post('/merge', pipeline, asyncHandler(controller.mergePdfs));
router.post('/split', pipeline, asyncHandler(controller.splitPdf));
router.post('/rotate', pipeline, asyncHandler(controller.rotatePdf));
router.post('/delete-pages', pipeline, asyncHandler(controller.deletePages));
router.post('/rearrange', pipeline, asyncHandler(controller.rearrangePages));
router.post('/watermark', pipeline, asyncHandler(controller.addWatermark));
router.post('/page-numbers', pipeline, asyncHandler(controller.addPageNumbers));
router.post('/extract-images', pipeline, asyncHandler(controller.extractImages));
router.post('/images-to-pdf', pipeline, asyncHandler(controller.imagesToPdf));
router.post('/pdf-to-jpg', pipeline, asyncHandler(controller.pdfToJpg));
router.post('/compress', pipeline, asyncHandler(controller.compressPdf));
router.post('/word-to-pdf', pipeline, asyncHandler(controller.wordToPdf));
router.post('/pdf-to-word', pipeline, asyncHandler(controller.pdfToWord));
router.post('/protect', pipeline, asyncHandler(controller.protectPdf));
router.post('/unlock', pipeline, asyncHandler(controller.unlockPdf));

module.exports = router;
