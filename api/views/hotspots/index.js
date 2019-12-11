import express from 'express';
let router = express.Router({ mergeParams: true });
import * as hotspotsController from './hotspots.controller';
import { catchError } from './../../../errors/error';
import permit from '../../../permissions/permission';

router.get('/:repositoryUid/distribution/hotspots',permit('distribution/hotspots'),catchError(hotspotsController.getHotspotDistribution));
router.get('/:repositoryUid/distribution/hotspotsbytags',permit('distribution/hotspotsbytags'), catchError(hotspotsController.getTagwiseHotspotDistribution));

module.exports = router;



