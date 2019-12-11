import express from 'express';
let router = express.Router({ mergeParams: true });
import * as heatMapController from './heatMap.controller';
import { catchError } from './../../../errors/error';
import permit from '../../../permissions/permission';
router.get('/:repositoryUid/heatmap',permit('heatMap/') ,catchError(heatMapController.getHeatmap));

module.exports = router;