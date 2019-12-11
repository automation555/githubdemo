import express from 'express';
let router = express.Router({ mergeParams: true });
import * as changeListController from './changeList.controller';
import { catchError } from './../../../errors/error';
import permit from '../../../permissions/permission';
router.get('/:repositoryUid/list/changes',permit('list/changes'),catchError(changeListController.getChangeList));
module.exports = router;



