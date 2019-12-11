import express from 'express';
let router = express.Router({ mergeParams: true });
import * as duplicationController from './duplication.controller';
import { catchError } from './../../../errors/error';
import permit from '../../../permissions/permission';
router.get('/:repositoryUid/distribution/duplication',permit('distribution/duplication'), catchError(duplicationController.getDuplicationDetails));

module.exports = router;



