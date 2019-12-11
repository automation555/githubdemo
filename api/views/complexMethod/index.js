import express from 'express';
let router = express.Router({ mergeParams: true });
import * as complexMethodController from './complexMethod.controller';
import { catchError } from './../../../errors/error';
import permit from '../../../permissions/permission';

router.get('/:repositoryUid/list/testhungrymethods',permit('list/testhungrymethods') ,catchError(complexMethodController.getData));
module.exports = router;



