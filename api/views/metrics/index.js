import express from 'express';
let router = express.Router({ mergeParams: true });
import * as metricsController from './metrics.controller';
import { catchError } from './../../../errors/error';
import permit from '../../../permissions/permission'
router.get('/:repositoryUid/distribution/metricviolations',permit('distribution/metricviolations') ,catchError(metricsController.getMetricDetails));
router.get('/:repositoryUid/distribution/metricviolations/pdf',permit('distribution/metricviolations/pdf') ,catchError(metricsController.getMetricDetails));

module.exports = router;



