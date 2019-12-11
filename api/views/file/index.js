import express from 'express';
import permit from './../../../permissions/permission';
import * as fileController from './file.controller';
import { catchError } from './../../../errors/error';

let router = express.Router({ mergeParams: true });

//Search
router.get('/:repositoryUid/file', permit('repositories/:repositoryUid/file'), catchError(fileController.getFile));

module.exports = router;