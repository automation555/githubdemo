import express from 'express';
let router = express.Router({ mergeParams: true });
import * as kpiDashBoardController from './kpiDashboard.controller';
import { catchError } from './../../../errors/error';
import permit from '../../../permissions/permission';

router.get('/:repositoryUid/dashboard/kpi/details',permit('kpi/details'), catchError(kpiDashBoardController.getKpiDetails));
router.get('/:repositoryUid/dashboard/kpi/details/pdf',permit('kpi/details/pdf'), catchError(kpiDashBoardController.getKpiDetails));

module.exports = router;