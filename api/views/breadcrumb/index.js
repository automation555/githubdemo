import express from 'express';
import permit from './../../../permissions/permission';
import * as breadcrumbController from './breadcrumb.controller';
import { catchError } from './../../../errors/error';

let router = express.Router({ mergeParams: true });

//breadcrumb
router.get('/:repositoryUid/breadcrumb', permit('repositories/:repositoryUid/breadcrumb'), catchError(breadcrumbController.getBreadcrumb));
router.get('/:repositoryUid/breadcrumb/pdf', permit('repositories/:repositoryUid/breadcrumb/pdf'), catchError(breadcrumbController.getBreadcrumb));

module.exports = router;