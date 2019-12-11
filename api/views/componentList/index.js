import express from 'express';
let router = express.Router({ mergeParams: true });
import * as componentListController from './componentList.controller';
import { catchError } from './../../../errors/error';
import permit from '../../../permissions/permission';


router.get('/:repositoryUid/list/components',permit('list/components'), catchError(componentListController.getComponentList));
router.get('/:repositoryUid/list/components/pdf',permit('list/components/pdf'), catchError(componentListController.getComponentList));

module.exports = router;



