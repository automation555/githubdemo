import express from 'express';
var router = express.Router({ mergeParams: true });
import * as summaryController from './summary.controller';
import { catchError } from './../../../errors/error';
import permit from './../../../permissions/permission';

router.get('/:repositoryUid/summary',permit('repositories/:repositoryUid/summary'), catchError(summaryController.getNodeSummary));
router.get('/:repositoryUid/language',permit('repositories/:repositoryUid/language'), catchError(summaryController.getActiveLanguage));
router.get('/:repositoryUid/language/pdf',permit('repositories/:repositoryUid/language/pdf'), catchError(summaryController.getActiveLanguage));
router.get('/:repositoryUid/summary/locandcomponents',permit('repositories/:repositoryUid/locandcomponents'), catchError(summaryController.getLocAndComponents));

router.get('/:repositoryUid/componentsummary',permit('repositories/:repositoryUid/componentsummary'), catchError(summaryController.getComponentSummary));

router.get('/:repositoryUid/filesummary',permit('repositories/:repositoryUid/filesummary'), catchError(summaryController.getFileSummary));

module.exports = router;