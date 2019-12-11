import express from 'express';
var router = express.Router({ mergeParams: true });
import * as overViewChangeController from './changeOverview.controller';
import permit from '../../../permissions/permission';
import { catchError } from './../../../errors/error';
router.get('/:repositoryUid/overview/changes',permit('overview/changes'), catchError(overViewChangeController.getChangeOverview));
router.get('/:repositoryUid/overview/changes/components',permit('overview/changes/components'), catchError(overViewChangeController.getChangeComponent));
router.get('/:repositoryUid/overview/changes/components/pdf',permit('overview/changes/components/pdf'), catchError(overViewChangeController.getChangeComponent));
router.get('/:repositoryUid/overview/changes/ratings',permit('overview/changes/ratings'), catchError(overViewChangeController.getRatingDiff));

module.exports = router;
