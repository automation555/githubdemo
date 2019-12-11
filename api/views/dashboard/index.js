import express from 'express';
var router = express.Router({ mergeParams: true });
import * as dashboardController from './dashboard.controller';
import { catchError } from './../../../errors/error';
import permit from './../../../permissions/permission';

router.get('/:repositoryUid/dashboard', permit('repositories/:repositoryUid/dashboard'), catchError(dashboardController.index));
router.get('/:repositoryUid/dashboard/pdf', permit('repositories/:repositoryUid/dashboard/pdf'), catchError(dashboardController.index));
module.exports = router;