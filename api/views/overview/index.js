import express from 'express';
let router = express.Router({ mergeParams: true });
import * as overviewController from './overview.controller';
import { catchError } from './../../../errors/error';
import permit from '../../../permissions/permission';
router.get('/:repositoryUid/overview',permit('overview/'), catchError(overviewController.index));
router.get('/:repositoryUid/overview/pdf',permit('overview/pdf'), catchError(overviewController.index));
// router.get('/:repositoryUid/views/overview/changes', catchError(overViewChangeController.index));
// router.get('/:repositoryUid/views/overview/changes/components', catchError(overViewChangeController.index));
// router.get('/:repositoryUid/views/overview/changes/ratings', catchError(overViewChangeController.index));

module.exports = router;