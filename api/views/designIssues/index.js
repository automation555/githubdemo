import express from 'express';
let router = express.Router({ mergeParams: true });
import * as designIssuesController from './designIssues.controller';
import { catchError } from './../../../errors/error';
import permit from './../../../permissions/permission';
router.get('/:repositoryUid/distribution/designissues',permit('distribution/designissues') ,catchError(designIssuesController.getDesignissues));
router.get('/:repositoryUid/distribution/designissues/pdf',permit('distribution/designissues/pdf') ,catchError(designIssuesController.getDesignissues));

module.exports = router;



