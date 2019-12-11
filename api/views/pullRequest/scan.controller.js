import { runScan, getRunAnalysisDTO, abortScan, getScanProgress } from './../../../services/scan';
import * as log from './../../../logs/logger';
import * as cf from './../../../utils/common-functions';
import * as gammaConfig from './../../../core/config';
import * as db from './../../../component/db';
import * as pullRequestService from './pullRequest.service';
import request from 'request';
import * as gamma from './../../../core/gamma';
import _ from 'lodash';
import * as pullRequestInterfaceController from './pullRequestInterface.controller';
const errors = require('throw.js');
const PR_SCAN_REPO_URL = `${gammaConfig.analysisDBDetails.analysisHost}rest/gws/reviewRequest`;
const PR_ABORT_REPO_URL = `${gammaConfig.analysisDBDetails.analysisHost}rest/gws/abortReviewRequest`;
const GET_PROGRESS_SCAN_URL = `${gammaConfig.analysisDBDetails.analysisHost}rest/gws/getProgressReviewRequest`;

export function pickRepoFromPRQueue(req, prevSessionId = '') {
    // check first if any PR scan is in progress
    // if in progress wait
    // else take fist entry from PR queue and send it to GWS and change status to 'IN_PROGRESS'
    let tenantUid = (req.session) ? req.session.tenant_uid : '';
    try {
        let sqlQuery = `select * from review_request_queue where status = 'IN_PROGRESS'`;
        return db.gammaDbPool.query(sqlQuery, [])
            .then(reviewRequest => {
                if (reviewRequest.length == 0) {
                    sqlQuery = `select rq.*, r.primary_data, s.subsystem_id as repository_id , t.tenant_uid from review_request_queue rq, review_requests r , subsystems s , tenant t
                            where rq.repository_uid = s.subsystem_uid and s.tenant_id = t.id and r.id = rq.review_request_id and rq.status = 'QUEUED'
                            order by id limit 1 `;
                    return db.gammaDbPool.query(sqlQuery, [])
                        .then(queueData => {
                            if (queueData.length) {
                                req.body.scanId = queueData[0].session_id;
                                req.body.repositoryId = queueData[0].repository_id;
                                req.params.repositoryUid = queueData[0].repository_uid;
                                let payloadPrimaryData = queueData[0].primary_data;
                                var params = {
                                    'tenant_uid': queueData[0].tenant_uid,
                                    'subsystem_uid': queueData[0].repository_uid
                                };
                                let payloadData = {
                                    "reviewId": payloadPrimaryData.id + "",
                                    "diffUrl": (typeof payloadPrimaryData.repoUrl !== 'undefined') ? `${payloadPrimaryData.repoUrl}/diffstat/${payloadPrimaryData.sourceCommitId}..${payloadPrimaryData.destinationCommitId}` : '',
                                    "oldCommitId": payloadPrimaryData.destinationCommitId,
                                    "newCommitId": payloadPrimaryData.sourceCommitId,
                                    "srcUrl": (typeof payloadPrimaryData.repoUrl !== 'undefined') ? `${payloadPrimaryData.repoUrl}/src/` : '',
                                    "srcDir": cf.actualPath(gammaConfig.analysisDBDetails.data_src, params),
                                    "newFileList": payloadPrimaryData.newFileList,
                                    "oldFileList": payloadPrimaryData.oldFileList,
                                    "sourceBranch": payloadPrimaryData.sourceBranch,
                                    "destinationBranch": payloadPrimaryData.destinationBranch
                                };
                                req.body.payloadData = payloadData;
                                if (prevSessionId != '') {
                                    // match groupId of pull request to prevent multiple updates to same pull request for different repos
                                    getGroupIdFromSession(prevSessionId)
                                        .then(groupId => {
                                            if (groupId != queueData[0].group_id) {
                                                updateScanStatusToRemote(queueData[0].session_id, queueData[0].review_request_id, queueData[0].repository_uid, 'INPROGRESS');
                                            }
                                        })
                                }
                                else {
                                    updateScanStatusToRemote(queueData[0].session_id, queueData[0].review_request_id, queueData[0].repository_uid, 'INPROGRESS');
                                }
                                sendPRScanRequest(req);
                            }
                        });
                }
            })
            .catch(error => {
                log.error("Error while getting in_progress pull request from review_request_queue", {'tenantUid': tenantUid});
                log.error(error, {'tenantUid': tenantUid});
            });
    } catch (error) {
        let errorLog = new errors.InternalServerError(error.message, 1018);
        log.error(errorLog, {'tenantUid': tenantUid});
    }
}

function getGroupIdFromSession(sessionId) {
    sqlQuery = `select group_id from review_request_queue where session_id=$1`;
    return db.gammaDbPool.query(sqlQuery, [sessionId])
        .then(groupResult => {
            if (groupResult.length) {
                return groupResult[0].group_id;
            }
            else {
                return '';
            }
        });
}

export async function scan(req, res, next) {
    let reviewRequestRepositories = {
        "repository_uid": req.params.repositoryUid,
        "queueStatus": "QUEUED"
    };
    let sqlQuery = `select rr.* from review_requests rr, webhooks w, subsystems s where
                    rr.review_request_id = $1 and
                    rr.webhook_id = w.id and
                    w.repository_url = s.subsystem_repository_url and
                    s.subsystem_uid = $2 and s.tenant_id=$3`;
    return req.gamma.query(sqlQuery, [req.params.pullRequestId, req.params.repositoryUid, req.session.tenant_id], next)
        .then(reviewRequestId => {
            if (reviewRequestId.length) {
                let primaryData = reviewRequestId[0].primary_data;
                let groupId = cf.generateMD5(req.session.tenant_id + '_' + new Date().getTime());
                return pullRequestService.insertReviewRequestQueue(groupId, req.session.tenant_id, reviewRequestId[0].id, reviewRequestRepositories, primaryData.sourceCommitId, primaryData.destinationCommitId, primaryData.updatedOn, true)
                    .then(() => {
                        pickRepoFromPRQueue(req);

                        res.status(200).json({
                            status: 'success',
                            message: "Pull request scan started successfully.",
                            details: "Pull request scan started successfully."
                        });
                    });
            }
        })
}

function sendPRScanRequest(req) {
    let tenantUid = (req.session) ? req.session.tenant_uid : '';
    getRunAnalysisDTO(req)
        .then(runScanDTO => {
            PRScanDTO = runScanDTO.responseDTO;
            PRScanDTO.scanSettings.header.sessionId = req.body.scanId;
            PRScanDTO.scanSettings.header.analysisMode = "REVIEW";
            PRScanDTO.scm.repoDTO.payloadData = req.body.payloadData;
            PRScanDTO.scanSettings.dataDir = PRScanDTO.scanSettings.dataDir + '_review';

            let replacedconnString = (PRScanDTO.responseEndPoint.connString).replace('scans', 'prscans');
            replacedconnString = (replacedconnString).replace(gammaConfig.apiVersion, 'views');
            PRScanDTO.responseEndPoint.connString = replacedconnString;

            let splitLocalDirectoryPath = (PRScanDTO.scm.repoDTO.localDirectoryPath).split('checkouts');
            PRScanDTO.scm.repoDTO.localDirectoryPath = splitLocalDirectoryPath[0] + 'reviewdata/' + req.params.repositoryUid + '/' + PRScanDTO.scm.repoDTO.payloadData.reviewId;

            // run PR scan
            runScan(PRScanDTO, PR_SCAN_REPO_URL)
                .then(() => {
                    updatePRQueueStatus({
                        'status': 'IN_PROGRESS',
                        'sessionId': req.body.scanId,
                        'repositoryUid': req.params.repositoryUid,
                        'reviewRequestId': req.body.payloadData.reviewId,
                        'tenantId': PRScanDTO.tenant_id
                    })
                        .then(() => {
                            log.info(`PR scan request sent to Embold service : [sessionId : ${req.body.scanId}, repoId : ${req.params.repositoryUid}`, {'tenantUid': tenantUid});
                        });
                })
                .catch(error => {
                    log.info(`Failing PR scan as Embold service is not available to start scan [sessionId : ${req.body.scanId}, repoId : ${req.params.repositoryUid}]`, {'tenantUid': tenantUid});
                    log.error(error, {'tenantUid': tenantUid});
                    forceFailPRScanRequest(req.body.scanId, req.params.repositoryUid, PRScanDTO.tenant_id);
                });
        })
        .catch(error => {
            log.error("Error while getting RunAnalysisDTO", {'tenantUid': tenantUid});
            log.error(error, {'tenantUid': tenantUid});
        })
}

export async function abort(req, res, next) {
    let tenantUid = (req.session) ? req.session.tenant_uid : '';
    let userId = (req.session) ? req.session.user_id : '';
    let sqlQuery = `select status, review_request_id from review_request_queue where session_id=$1`;
    return req.gamma.query(sqlQuery, [req.params.scanId])
        .then(requestStatus => {
            if (requestStatus.length) {
                if (requestStatus[0].status == 'IN_PROGRESS') {
                    // abort PR scan
                    log.info(`Initiating PR abort request for repository {sessionId : ${req.params.scanId}, repositoryUid : ${req.params.repositoryUid}}`, {'tenantUid':tenantUid, 'userId': userId});
                    abortScan(req.params.scanId, PR_ABORT_REPO_URL)
                        .then(() => {
                            res.status(200).json({
                                status: 'success',
                                message: 'Abort request sent successfully.',
                                details: 'Abort request sent successfully.'
                            });
                        })
                        .catch(error => {
                            log.error(`Could not abort PR scan for repository {sessionId : ${req.params.scanId}, repositoryUid : ${req.params.repositoryUid}} because ${error}`,{'tenantUid':tenantUid, 'userId':userId});
                            log.warn(`Force fail PR scan for repository {sessionId : ${req.params.scanId}, repositoryUid : ${req.params.repositoryUid}}`, {'tenantUid': tenantUid, 'userId':userId});
                            forceFailPRScanRequest(req.params.scanId, req.params.repositoryUid, req.session.tenant_id);
                            return next(error);
                        });
                }
                else if (requestStatus[0].status == 'QUEUED') {
                    updatePRQueueStatus({
                        'status': 'CANCEL',
                        'sessionId': req.params.scanId,
                        'repositoryUid': req.params.repositoryUid,
                        'reviewRequestId': requestStatus[0].review_request_id,
                        'tenantId': req.session.tenant_id
                    })
                    .then(() => {
                        log.info(`Initiating PR abort request for repository {sessionId : ${req.params.scanId}, repositoryUid : ${req.params.repositoryUid}}`, {'tenantUid':tenantUid, 'userId': userId});
                        res.status(200).json({
                            status: 'success',
                            message: 'Abort request sent successfully.',
                            details: 'Abort request sent successfully.'
                        });
                    });
                }
            }
            else {
                log.debug("No entry in review request queue found for session: "+ req.params.scanId, {'tenantUid': tenantUid});
                return next(new errors.CustomError("NoContentToDisplay", "No content to display", 204, 1026));
            }
        });
}

export function forceFailPRScanRequest(scanId, repositoryUid, tenantId) {
    var parsedJson = {};
    parsedJson.status = 'FAIL';
    parsedJson.message = 'ANALYSER_FAILED';
    parsedJson.messageType = 'ERROR';
    parsedJson.sessionId = scanId;
    parsedJson.tenantId = tenantId;
    var req = {
        'params': {
            'repositoryUid': repositoryUid
        },
        'body': parsedJson
    };
    var res = {
        'json': function (data) {
            return true;
        }
    };
    setPRScanStatus(req, res, null);
}

//this function will be called by GWS for scan updates
export async function setPRScanStatus(req, res, next) {
    let parsedJson = {}, status = '';
    try {
        parsedJson = req.body;
        sessionId = parsedJson.sessionId;
        repositoryUid = req.params.repositoryUid;
        status = parsedJson.status;
        tenantId = parsedJson.tenantId;
        message = (parsedJson.message) ? cf.parseString(parsedJson.message) : '';
        log.info(`PR scan status {sessionId : ${sessionId}, repositoryUid : ${repositoryUid}, status : ${status}, message : ${message}}`, {'tenantUid': tenantId});
        res.json({
            "status": 200,
            "message": "OK"
        });
        if (status == 'SUCCESS' || status == 'FAIL' || status == 'ABORT') {
            //log.info(`GWS STATUS [sessionId : ${sessionId}, repoId : ${repositoryUid}, status : ${status}, message : ${message}]`);
            let sqlQuery = `select review_request_id, repository_uid from review_request_queue where session_id=$1`;
            return db.gammaDbPool.query(sqlQuery, [sessionId])
                .then(reviewRequest => {
                    if (reviewRequest.length > 0) {
                        updatePRQueueStatus({
                            'status': status,
                            'sessionId': sessionId,
                            'repositoryUid': repositoryUid,
                            'reviewRequestId': reviewRequest[0].review_request_id,
                            'tenantId': tenantId
                        })
                        .then(() => {
                            sqlQuery = `select count(id) from review_request_queue where review_request_id = $1
                            and (status = 'IN_PROGRESS' OR status = 'QUEUED')`;
                            db.gammaDbPool.query(sqlQuery, [reviewRequest[0].review_request_id])
                                .then(countDetails => {
                                    if (!countDetails.length || parseInt(countDetails[0].count) == 0) {

                                        let updateRemoteStatus;
                                        if (status == 'SUCCESS') {
                                            updateRemoteStatus = 'SUCCESSFUL';
                                        }
                                        else if (status == 'FAIL') {
                                            updateRemoteStatus = 'FAILED';
                                        }
                                        else if (status == 'ABORT') {
                                            updateRemoteStatus = 'STOPPED';
                                        }
                                        else {
                                            updateRemoteStatus = ' ';
                                        }
                                        updateScanStatusToRemote(sessionId, reviewRequest[0].review_request_id, reviewRequest[0].repository_uid, updateRemoteStatus);

                                    }
                                    req.session = {};
                                    req.session.tenant_id = tenantId;
                                    pickRepoFromPRQueue(req, sessionId);
                                });
                        })
                        .catch(error => {
                            log.error("Couldn't update review request queue status for repoUID: " + repositoryUid+"review request id: " + reviewRequest[0].review_request_id);
                            log.error(error);
                        });
                    }
                });
        }
    } catch (error) {
        let errorLog = new errors.InternalServerError(error.message, 1018);
        log.error(errorLog);
    }
}

function updatePRQueueStatus(updateDetails) {
    sqlQuery = `update review_request_queue set status=$1 , updated_on = now() where session_id=$2 and repository_uid=$3`;
    return db.gammaDbPool.query(sqlQuery, [updateDetails.status, updateDetails.sessionId, updateDetails.repositoryUid])
    .then(() => {
        gamma.socket.emitReviewRequestStatus(updateDetails.tenantId, {
            status: updateDetails.status,
            repositoryUid: updateDetails.repositoryUid,
            reviewRequestId: updateDetails.reviewRequestId
        });
        return true;
    })

}
//Get count of major and minor issues to post on VCA account statuses.
function getIssuesCount(issueType) {
    let issuesObj = {
        addedMajorIssues: 0,
        totalAddedIssues: 0,
        fixedMajorIssues: 0,
        totalFixedIssues: 0
    };
    let addedIssuesCheck = { '1': false, '2': true };
    let fixedIssuesCheck = { '1': true, '2': false };
    issuesObj.addedMajorIssues += ((issueType).filter(d => {
        if (_.isEqual(d.occurrence, addedIssuesCheck)) {
            issuesObj.totalAddedIssues++;
        }
        return (_.isEqual(d.occurrence, addedIssuesCheck) && (d.criticality == 'high' || d.criticality == 'critical'));
    })).length;

    issuesObj.fixedMajorIssues += ((issueType).filter(d => {
        if (_.isEqual(d.occurrence, fixedIssuesCheck)) {
            issuesObj.totalFixedIssues++;
        }
        return (_.isEqual(d.occurrence, fixedIssuesCheck) && (d.criticality == 'high' || d.criticality == 'critical'));
    })).length;

    return issuesObj;
}
//This description will be updated on github and Bitbucket accounts along with status
export function getDescription(issuesCount) {
    let descStr = "", addedMajorIssuesDesc = "", addedMinorIssuesDesc = "", fixedMajorIssuesDesc = "", fixedMinorIssuesDesc = "", addedCount = 0, fixCount = 0;

    if (issuesCount.totalAddedMajorIssues > 0) {
        addedCount++;
        addedMajorIssuesDesc = "New Issues: " + issuesCount.totalAddedMajorIssues + " Major";
    }
    if (issuesCount.totalAddedMinorIssues > 0) {
        if (addedCount > 0)
            addedMinorIssuesDesc = ", " + issuesCount.totalAddedMinorIssues + " Minor. ";
        else
            addedMinorIssuesDesc = "New Issues: " + issuesCount.totalAddedMinorIssues + " Minor. ";
    }
    else {
        addedMajorIssuesDesc.concat(". ");
    }
    if (issuesCount.totalFixedMajorIssues > 0) {
        fixCount++;
        fixedMajorIssuesDesc = " Fixed Issues: " + issuesCount.totalFixedMajorIssues + " Major";
    }
    if (issuesCount.totalFixedMinorIssues > 0) {
        if (fixCount > 0)
            fixedMinorIssuesDesc = ", " + issuesCount.totalFixedMinorIssues + " Minor. ";
        else
            fixedMinorIssuesDesc = " Fixed Issues: " + issuesCount.totalFixedMinorIssues + " Minor. ";
    }
    else {
        fixedMajorIssuesDesc.concat(". ");
    }

    descStr = "Embold Scan Complete. " + addedMajorIssuesDesc + addedMinorIssuesDesc
        + fixedMajorIssuesDesc + fixedMinorIssuesDesc;

    return descStr;
}


function getStatusDetails(repository_url, sourceCommitUrl, repoUrl, sourceCommitId, projectId = '', tenantUid = '') {
    return new Promise((resolve, reject) => {
        pullRequestService.getReposForPR(repository_url)
            .then(repoDetails => {
                if (repoDetails.length) {
                    let repoMeta;
                    let serverType = (repoDetails[0].additional_details) ? repoDetails[0].additional_details.account_type : '';
                    repoMeta = pullRequestService.getRepositoryProvider(repoDetails[0], serverType);
                    let updateInfo = {
                        repoUrl,
                        isVcSupport: (typeof repoMeta.isVcSupport !== 'undefined') ? repoMeta.isVcSupport : '',
                        isGitSupport: (typeof repoMeta.isGitSupport !== 'undefined') ? repoMeta.isGitSupport : '',
                        repoProvider: (typeof repoMeta.providerName !== 'undefined') ? repoMeta.providerName : '',
                        repoType: (typeof repoMeta.repoType !== 'undefined') ? repoMeta.repoType : '',
                        repoSlug: (typeof repoMeta.repoSlug !== 'undefined') ? repoMeta.repoSlug : '',
                        repoOwner: (typeof repoMeta.repoOwner !== 'undefined') ? repoMeta.repoOwner : '',
                        repoUser: (typeof repoMeta.username !== 'undefined') ? repoMeta.username : '',
                        repoPass: (typeof repoMeta.password !== 'undefined') ? repoMeta.password : '',
                        baseUrl: (typeof repoMeta.baseUrl !== 'undefined') ? _.trimEnd(repoMeta.baseUrl, '/') : '',
                        // Headers
                        headerData: { "content-type": "application/json" },
                        cloudApiUrl: '',
                        sourceCommitId,
                        sourceCommitUrl,
                        projectId
                    }
                    let statusDetails = pullRequestInterfaceController.setRepoProviderContext(updateInfo.repoProvider, serverType).getUpdateStatusDetails(updateInfo);
                    statusDetails.serverType = serverType;
                    resolve(statusDetails);
                }
                else {
                    var errorMsg = { "error": { "code": 1924, "name": "RepoNotFound", "message": "Repository not found" } };
                    reject(errorMsg, {'tenantUid': tenantUid});
                }

            })
            .catch(error => {
                log.error("Couldn't get Embold repositories to update status details for repository: " + repository_url, {'tenantUid': tenantUid});
                log.error(error, {'tenantUid': tenantUid});
            });
    })
}

export function updateScanStatusToRemote(sessionId, reviewRequestId, repositoryUid, status) {
    log.info(`Updating status => ${status} to remote [reviewRequestId: ${reviewRequestId} sessionId: ${sessionId} repoId : ${repositoryUid}]`);
    try {
        let statusUpdateData = {};
        // let sqlQuery = 'select w.repository_url, mrd.master_repository_url, w.tenant_id, r.review_request_id, r.primary_data, t.tenant_uid from review_requests r, webhooks w, tenant t, subsystems s, master_repository_details mrd where r.webhook_id = w.id and r.id = $1 and t.id=w.tenant_id and s.subsystem_uid = $2 and mrd.id = s.master_repository_id'
        let sqlQuery = `select w.repository_url, mrd.master_repository_url, w.tenant_id, r.review_request_id, r.primary_data, t.tenant_uid
        from review_requests r, webhooks w, tenant t, subsystems s
        left join master_repository_details mrd on mrd.id = s.master_repository_id
        where r.webhook_id = w.id and r.id = $1 and t.id=w.tenant_id and s.subsystem_uid = $2 `
        db.gammaDbPool.query(sqlQuery, [reviewRequestId, repositoryUid])
            .then(webhookDetails => {
                if (webhookDetails.length) {
                    let webhookData = webhookDetails[0].primary_data;
                    let tenantUid  = webhookDetails[0].tenant_uid;
                    let projectId = (typeof webhookData.projectId !== 'undefined' && webhookData.projectId) ? webhookData.projectId : '';
                    let vcType = (typeof webhookData.vcType !== 'undefined') ? webhookData.vcType.toLowerCase() : '';
                    let baseUrl = (typeof webhookDetails[0].master_repository_url !== 'undefined' && webhookData.projectId) ? webhookData.projectId : '';
                    getStatusDetails(webhookDetails[0].repository_url, webhookData.sourceCommitUrl, webhookData.repoUrl, webhookData.sourceCommitId, projectId, tenantUid)
                        .then(updateInfo => {
                            let repoUid = '';
                            return pullRequestService.getReposForPR(webhookDetails[0].repository_url, true)
                                .then(PRrepositories => {
                                    repoUid = _.map(PRrepositories, "repository_uid");
                                    return db.getCoronaDBSubdomainPool(tenantUid)
                                        .then(dbpool => {
                                            let repoIdList = (repoUid != '') ? cf.convertToString(repoUid) : "''";
                                            sqlQuery = `select r.details from review_request r, subsystems s  where r.subsystem_id=s.id and r.review_id = $1 and s.subsystem_uid IN(${repoIdList})`;
                                            return dbpool.query(sqlQuery, [webhookDetails[0].review_request_id])
                                                .then(summary => {
                                                    if ((updateInfo.isVcSupport || updateInfo.isGitSupport) && updateInfo.repoType == 'private') {
                                                        cf.getDomainURL(webhookDetails[0].tenant_id, "id").then(function (domainURL) {
                                                            if (summary.length) {
                                                                let codeIssuesCountObj;
                                                                let addedMajorCodeIssues = 0, totalAddedCodeIssues = 0, fixedMajorCodeIssues = 0, totalFixedCodeIssues = 0;
                                                                let designIssuesCountObj;
                                                                let addedMajorDesignIssues = 0, totalAddedDesignIssues = 0, fixedMajorDesignIssues = 0, totalFixedDesignIssues = 0;

                                                                summary.forEach(summaryDetail => {
                                                                    (summaryDetail.details.pr_details).forEach(prDetail => {
                                                                        codeIssuesCountObj = getIssuesCount(prDetail.code_issues);
                                                                        addedMajorCodeIssues += codeIssuesCountObj.addedMajorIssues;
                                                                        totalAddedCodeIssues += codeIssuesCountObj.totalAddedIssues;
                                                                        fixedMajorCodeIssues += codeIssuesCountObj.fixedMajorIssues;
                                                                        totalFixedCodeIssues += codeIssuesCountObj.totalFixedIssues;
                                                                        //designissues
                                                                        designIssuesCountObj = getIssuesCount(prDetail.design_issues);
                                                                        addedMajorDesignIssues += designIssuesCountObj.addedMajorIssues;
                                                                        totalAddedDesignIssues += designIssuesCountObj.totalAddedIssues;
                                                                        fixedMajorDesignIssues += designIssuesCountObj.fixedMajorIssues;
                                                                        totalFixedDesignIssues += designIssuesCountObj.totalFixedIssues;
                                                                    });
                                                                });

                                                                let issuesCount = {};
                                                                //Added
                                                                let addedMinorCodeIssues = totalAddedCodeIssues - addedMajorCodeIssues;
                                                                let addedMinorDesignIssues = totalAddedDesignIssues - addedMajorDesignIssues;
                                                                issuesCount.totalAddedMinorIssues = addedMinorCodeIssues + addedMinorDesignIssues;
                                                                issuesCount.totalAddedMajorIssues = addedMajorCodeIssues + addedMajorDesignIssues;
                                                                //Fixed
                                                                let fixedMinorCodeIssues = totalFixedCodeIssues - fixedMajorCodeIssues;
                                                                let fixedMinorDesignIssues = totalFixedDesignIssues - fixedMajorDesignIssues;
                                                                issuesCount.totalFixedMinorIssues = fixedMinorCodeIssues + fixedMinorDesignIssues;
                                                                issuesCount.totalFixedMajorIssues = fixedMajorCodeIssues + fixedMajorDesignIssues;
                                                                // Prepare json body

                                                                let infoObj = {
                                                                    issuesCount,
                                                                    status,
                                                                    domainURL,
                                                                    reviewRequestId,
                                                                    pullRequestId: webhookDetails[0].review_request_id,
                                                                    cloudApiUrl: updateInfo.cloudApiUrl,
                                                                    headerData : updateInfo.headerData,
                                                                    tenantUid: tenantUid
                                                                }
                                                                statusUpdateData = pullRequestInterfaceController.setRepoProviderContext(updateInfo.repoProvider, updateInfo.serverType).getUpdateStatusInfo(infoObj);
                                                                statusUpdateData.headerData = updateInfo.headerData;
                                                            }
                                                            else {
                                                                let infoObj = {
                                                                    issuesCount: {},
                                                                    status,
                                                                    domainURL,
                                                                    reviewRequestId,
                                                                    pullRequestId: webhookDetails[0].review_request_id,
                                                                    cloudApiUrl: updateInfo.cloudApiUrl,
                                                                    headerData : updateInfo.headerData,
                                                                    tenantUid: tenantUid
                                                                };
                                                                log.info("Review request data from corona DB not found for repository: "+webhookDetails[0].repository_url+ " RepoUid: " + repositoryUid, {'tenantUid':tenantUid});
                                                                statusUpdateData = pullRequestInterfaceController.setRepoProviderContext(updateInfo.repoProvider, updateInfo.serverType).getUpdateStatusInfo(infoObj);
                                                                statusUpdateData.headerData = updateInfo.headerData;
                                                            }// else
                                                            request({
                                                                url: statusUpdateData.cloudApiUrl,
                                                                method: 'POST',
                                                                timeout: 20000,
                                                                headers: statusUpdateData.headerData,
                                                                rejectUnauthorized: false,
                                                                //Lets post the following key/values as form
                                                                json: statusUpdateData.jsonBody
                                                            },
                                                                function (error, response, body) {
                                                                    if (error) {
                                                                        log.error("Couldn't access url: "+statusUpdateData.cloudApiUrl, {'tenantUid':tenantUid})
                                                                        let errorLog = new errors.ServiceUnavailable(`${vcType} service unavailable`, 1021);
                                                                        log.error(errorLog, {'tenantUid':tenantUid});
                                                                    } else {
                                                                        if (response.statusCode == 200 || response.statusCode == 201 || response.statusCode == 204) {
                                                                            log.info(`Successfully updated status => ${status} to remote for ${vcType} [sessionId: ${sessionId} repoId : ${repositoryUid}]`, {'tenantUid':tenantUid});
                                                                        } else {
                                                                            log.error("No valid response from url:" + statusUpdateData.cloudApiUrl, {'tenantUid':tenantUid});
                                                                            let errorLog = new errors.ServiceUnavailable(`${vcType} service unavailable`, 1021);
                                                                            log.error(errorLog, {'tenantUid':tenantUid});
                                                                        }
                                                                    }
                                                                });
                                                        });
                                                    }
                                                });
                                        });
                                });
                        })
                        .catch(error => {
                            log.error("Couldn't get status update details for repository: " + webhookDetails[0].repository_url, {'tenantUid':tenantUid});
                            log.error(error, {'tenantUid':tenantUid});
                        });
                }
            });
    }
    catch (error) {
        let errorLog = new errors.InternalServerError(error.message, 1018);
        log.error(errorLog);
    }
}

// this is the service which is called periodically to chk if PR scan for given repository is running or not
// it requests to GWS only if difference betwn last updated time and current time is more than gammaConfig.analysisWaitTime
export function getIsPRAliveStatus() {
    try {
        let sqlQuery = `select rrq.*, s.tenant_id, t.tenant_uid from review_request_queue rrq, subsystems s, tenant t
                        where rrq.repository_uid = s.subsystem_uid and t.id = s.tenant_id and status = 'IN_PROGRESS'`;
        return db.gammaDbPool.query(sqlQuery, [])
            .then(reviewRequest => {
                if (reviewRequest.length > 0) { // Scan is in progress for some PR. Now check if its actually running at GWS
                    let scanId = reviewRequest[0].session_id;
                    let tenantId = reviewRequest[0].tenant_id;
                    let tenantUid = reviewRequest[0].tenant_uid;
                    let repositoryUid = reviewRequest[0].repository_uid;
                    let lastUpdatedTimestamp = reviewRequest[0].updated_on;
                    var currentTimestamp = new Date();
                    var difference = currentTimestamp.getTime() - lastUpdatedTimestamp.getTime();
                    var minutes = parseInt(difference / (1000 * 60));
                    if (minutes >= gammaConfig.analysisDBDetails.analysisWaitTime && scanId != '' && scanId) {
                        log.info(`Getting progress status of PR scan {sessionId : ${scanId}, repositoryUid : ${repositoryUid}}`, {'tenantUid':tenantUid});
                        getScanProgress(scanId, GET_PROGRESS_SCAN_URL)
                            .then((body) => {
                                let parsedJson = JSON.parse(body);
                                let oldScanId = scanId + "_1";
                                if ((parsedJson.status == 'PROCESSING' || parsedJson.status == 'START' || parsedJson.status == 'SCHEDULED' || parsedJson.status == 'INITIALIZED' || parsedJson.status == 'ABORTING' ||
                                    ((parsedJson.status == 'SUCCESS' || parsedJson.status == 'ABORT' || parsedJson.status == 'FAIL') && parsedJson.sessionId == oldScanId))
                                    && parsedJson.subsystemId == repositoryUid) {
                                    log.info(`PR scan is running for repository {sessionId : ${scanId}, repositoryUid : ${repositoryUid}, status : ${parsedJson.status}, message : ${parsedJson.message}}`, {'tenantUid': tenantUid});
                                } else if ((parsedJson.status == 'SUCCESS' || parsedJson.status == 'ABORT' || parsedJson.status == 'FAIL') && parsedJson.subsystemId == repositoryUid && parsedJson.sessionId == scanId) {
                                    log.info(`PR Scan is not running for repository {sessionId : ${scanId}, repositoryUid : ${repositoryUid}, status : ${parsedJson.status}, message : ${parsedJson.message}}`, {'tenantUid':tenantUid});
                                    var req = {
                                        'params': {
                                            'repositoryUid': repositoryUid
                                        },
                                        'body': parsedJson
                                    };
                                    var res = {
                                        'json': function (data) {
                                            return true;
                                        }
                                    };
                                    setPRScanStatus(req, res, null);
                                } else //status is false means analysis for given subsystem is not running.So we remove data from analysis queue and add it to analysis history with status as failed
                                {
                                    log.warn(`Force fail PR scan as its not running for repository {sessionId : ${scanId}, repositoryUid : ${repositoryUid}}`, {'tenantUid':tenantUid});
                                    forceFailPRScanRequest(scanId, repositoryUid, tenantId, 'CONTEXT_NOT_FOUND');
                                }
                            })
                            .catch(error => {
                                log.error(error);
                                log.warn(`Force fail PR scan as its not running for repository {sessionId : ${scanId}, repositoryUid : ${repositoryUid}}`, {'tenantUid':tenantUid});
                                forceFailPRScanRequest(scanId, repositoryUid, tenantId);
                            });
                    }
                }
            })

    } catch (error) {
        let errorLog = new errors.InternalServerError(error.message, 1018);
        log.error(errorLog);
    }
}