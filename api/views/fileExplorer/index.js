import express from 'express';
import permit from './../../../permissions/permission';
import * as fileExplorerController from './fileExplorer.controller';
import { catchError } from './../../../errors/error';

let router = express.Router({ mergeParams: true });

//Search
router.get('/:repositoryUid/file/details', permit('file/details'), catchError(fileExplorerController.getFileSummaryDetails));

module.exports = router;