import express from 'express';
let router = express.Router({ mergeParams: true });
import * as codeIssuesController from './codeIssues.controller';
import { catchError } from './../../../errors/error';
import permit from './../../../permissions/permission';

router.get('/:repositoryUid/distribution/codeissues', permit('distribution/codeissues'),catchError(codeIssuesController.codeIssues));
router.get('/:repositoryUid/distribution/codeissues/pdf', permit('distribution/codeissues/pdf'),catchError(codeIssuesController.codeIssues));

module.exports = router;



