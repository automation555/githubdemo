import express from 'express';
let router = express.Router({ mergeParams: true });
import * as codeController from './codeCoverage.controller';
import { catchError } from './../../../errors/error';
import permit from '../../../permissions/permission';

router.get('/:repositoryUid/distribution/coverage',permit('distribution/coverage'), catchError(codeController.getCoverageDistribution));
router.get('/:repositoryUid/list/coverage',permit('list/coverage'), catchError(codeController.getCoverageOverall));
router.get('/:repositoryUid/component/coverage',permit('component/coverage') ,catchError(codeController.getCoverageExplorer));

module.exports = router;



