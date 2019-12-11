import express from 'express';
let router = express.Router({ mergeParams: true });
import * as commitController from './commit.controller';
import * as scmController from './scm.controller';
import * as issuesController from './issues.controller';
import { catchError } from './../../../errors/error';
import permit from './../../../permissions/permission';

router.get('/:repositoryUid/commits', permit('repositories/:repositoryUid/commits'), catchError(commitController.getCommits));
router.get('/:repositoryUid/commits/search/:searchString', permit('repositories/:repositoryUid/commits/search/:searchString'), catchError(commitController.searchCommit));
router.post('/:repositoryUid/commituseravatars', permit('repositories/:repositoryUid/commituseravatars'), catchError(scmController.commitUserAvatars));
router.get('/:repositoryUid/commits/:commitId', permit('repositories/:repositoryUid/commits/:commitId'), catchError(commitController.showCommit));
router.get('/:repositoryUid/commits/:commitId/codeissues', permit('repositories/:repositoryUid/commits/:commitId/codeissues'), catchError(issuesController.getCodeIssues));
router.get('/:repositoryUid/commits/:commitId/designissues', permit('repositories/:repositoryUid/commits/:commitId/designissues'), catchError(issuesController.getDesignIssues));
router.get('/:repositoryUid/commits/:commitId/file', permit('repositories/:repositoryUid/commits/:commitId/file'), catchError(commitController.getFile));
router.get('/:repositoryUid/commits/:commitId/recos', permit('repositories/:repositoryUid/commits/:commitId/recos'), catchError(scmController.getRecos));

module.exports = router;