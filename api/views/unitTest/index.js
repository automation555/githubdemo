import express from 'express';
let router = express.Router({ mergeParams: true });
import * as unitTestController from './unitTest.controller';
import { catchError } from './../../../errors/error';
import permit from '../../../permissions/permission';

router.get('/:repositoryUid/list/unittests',permit('list/unittests') ,catchError(unitTestController.index));
module.exports = router;