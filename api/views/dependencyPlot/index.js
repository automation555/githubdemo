import express from 'express';
let router = express.Router({ mergeParams: true });
import * as dependencyPlotController from './dependencyPlot.controller';
import { catchError } from './../../../errors/error';
import permit from '../../../permissions/permission';

router.get('/:repositoryUid/component/dependencies',permit('component/dependencies'), catchError(dependencyPlotController.getDependencyPlot));


module.exports = router;



