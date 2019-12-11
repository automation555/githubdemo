import express from 'express';
let router = express.Router({ mergeParams: true });
import * as pullRequestController from './pullRequest.controller';
import * as webhookController from './webhook.controller';
import * as scanController from './scan.controller';
import { catchError } from './../../../errors/error';
import permit from '../../../permissions/permission';
// import * as pollingController from './polling.controller';
import * as pollingInterfaceController from './pollingInterface.controller';

router.get('/:repositoryUid/pullrequests', permit('pullrequests/'), catchError(pullRequestController.index));
router.get('/:repositoryUid/pullrequests/authors', permit('pullrequests/authors'), catchError(pullRequestController.getAuthors));
router.get('/:repositoryUid/pullrequests/metadata', permit('pullrequests/metadata'), catchError(pullRequestController.getMetaData));
router.get('/:repositoryUid/pullrequests/:pullRequestId', permit('pullrequests/:pullRequestId'), catchError(pullRequestController.getPRDetail));

// this api will listen to webhook from github and bitbucket
router.post('/pullrequests/webhooks', catchError(webhookController.listen));
router.get('/:repositoryUid/webhooks/status', catchError(webhookController.index));
router.post('/:repositoryUid/webhooks/status', catchError(webhookController.createHook));
router.post('/:repositoryUid/webhooks', catchError(webhookController.create));
router.post('/:repositoryUid/prscans/:scanId/status', catchError(scanController.setPRScanStatus));
router.post('/:repositoryUid/pullrequests/:pullRequestId/scan', permit('repositories/:repositoryUid/pullrequests/:pullRequestId/scan'), catchError(scanController.scan));
router.post('/:repositoryUid/prscans/:scanId/abort', permit('repositories/:repositoryUid/prscans/:scanId/abort'), catchError(scanController.abort));

router.put('/:repositoryUid/pullrequests', permit('pullrequests/'), catchError(pullRequestController.refreshData));
module.exports = router;