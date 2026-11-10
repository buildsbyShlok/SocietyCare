const router = require('express').Router();
const authenticate = require('../middleware/authenticate');
const admin = require('../middleware/authorize')('ADMIN');
const { endpoint } = require('../utils/workspace');
const billing = require('../services/billing.service');
router.use(authenticate);
router.get(
  '/',
  endpoint((req) => billing.listBills(req.user)),
);
router.post(
  '/',
  admin,
  endpoint((req) => billing.issueBill(req.body), 201),
);
router.post(
  '/:id/payment',
  admin,
  endpoint((req) => billing.verifyPayment(req.params.id, req.body, req.user), 201),
);
module.exports = router;
