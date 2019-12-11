import express from 'express';
let router = express.Router({ mergeParams: true });
import * as componentExplorerController from './componentExplorer.controller';
import { catchError } from './../../../errors/error';
import permit from '../../../permissions/permission';

router.get('/:repositoryUid/component/details',permit('component/details'), catchError(componentExplorerController.getComponentSummaryDetails));
router.get('/:repositoryUid/component/duplicationoccurrence',permit('component/details'), catchError(componentExplorerController.getDuplicationOccurrence));
// router.get('/:repositoryUid/snapshots/snapshotId/components/nodeId', catchError(componentExplorerController.getDuplicationOccurrence));

module.exports = router;



