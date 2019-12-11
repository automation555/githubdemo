// gamma.get('/partitions/processbat', processBat);

import express from 'express';
let router = express.Router({ mergeParams: true });
import * as partitionsController from './partitions.controller';
import { catchError } from './../../../errors/error';
import permit from '../../../permissions/permission';
router.get('/:repositoryUid/component/partitions',permit('component/partitions'), catchError(partitionsController.processBat));

module.exports = router;



