import express from 'express';
let router = express.Router({ mergeParams: true });
import * as downloadMetricsController from './downloadMetrics.controller';
import { catchError } from './../../../errors/error';
import permit from './../../../permissions/permission';
router.get('/:repositoryUid/download/metrics',permit('download/metrics'),catchError(downloadMetricsController.downloadMetrics));

module.exports = router;



