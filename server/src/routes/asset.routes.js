const router = require('express').Router();
const service = require('../services/asset.service');
const { endpoint, field } = require('../utils/workspace');

const rateLimit = require('express-rate-limit');
router.get('/qr/:qrToken', rateLimit({
  windowMs: 60000, limit: 60, standardHeaders: true, legacyHeaders: false,
  message: { message: 'Too many QR lookups. Please wait a minute and try again.' },
}), (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); },
endpoint(req => require('../services/qr-report.service').identifyAsset(req.params.qrToken)));

router.use(require('../middleware/authenticate'), require('../middleware/authorize')('ADMIN'));
router.param('id', (req, res, next, id) => {
  try { field(id, 'asset ID', 100); next(); } catch (error) { next(error); }
});
router.get('/', endpoint(req => service.listAssets(req.query, req.user)));
router.post('/', endpoint(req => service.createAsset(req.body, req.user), 201));
router.get('/:id/complaints', endpoint(req => service.assetComplaints(req.params.id, req.query, req.user)));
router.get('/:id', endpoint(req => service.getAsset(req.params.id, req.user)));
router.put('/:id', endpoint(req => service.updateAsset(req.params.id, req.body, req.user)));
router.patch('/:id/status', endpoint(req => service.setAssetStatus(req.params.id, req.body, req.user)));
router.delete('/:id', endpoint(req => service.deleteAsset(req.params.id, req.user)));
module.exports = router;
