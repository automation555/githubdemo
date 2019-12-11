import * as log from './../../../logs/logger';
import request from 'request';
import * as cf from './../../../utils/common-functions';
import * as pullRequestService from './pullRequest.service';
import * as webhookController from './../../views/pullRequest/webhook.controller';
import _ from 'lodash';
import * as scanController from './scan.controller';
const errors = require('throw.js');
const BITBUCKET_BASE_API_URL = 'https://api.bitbucket.org/2.0/';  // Cloud
const API_VERSION = '2.0';   // Latest
const PER_PAGE = 50;    // Max per page
const WEBHOOK_URL = '/api/views/repositories/pullrequests/webhooks';

//polling related data
export function getPrData(prMetaData) {
    let tasks = [];
    prMetaData.headerData = getHeaderData(prMetaData);
    prMetaData.cloudApiUrl = BITBUCKET_BASE_API_URL + "repositories/" + prMetaData.repoOwner + "/" + prMetaData.repoSlug + "/pullrequests";
    prMetaData.queryParams = { "pagelen": PER_PAGE };
    // Last polling timestamp not null then get all w.r.t. last polling timestamp else get only open
    prMetaData.queryString = (prMetaData.lastPollDt) ? `(state="open" OR state="merged" OR state="declined") AND updated_on>="${prMetaData.lastPollDt}"` : `state="open"`;
    tasks = [getPRListByRepoForBitbucket(prMetaData.cloudApiUrl, prMetaData.headerData, prMetaData.queryParams, prMetaData.queryString, prMetaData.repoProvider, false, 1, [], prMetaData.tenantUid)];
    return tasks;
}

function getPRListByRepoForBitbucket(cloudApiUrl, headerData, queryParams, queryString, vcType, hasPages, pageNo, totalPrList, tenantUid) {
    queryParams = (!hasPages) ? queryParams : {};
    cloudApiUrl = (!hasPages) ? cloudApiUrl + '?q=' + queryString : cloudApiUrl;
    log.debug("Fetching pull requests from Bitbucket cloud API URL: " + cloudApiUrl, { 'tenantUid': tenantUid });

    return new Promise((resolve, reject) => {
        request({
            url: cloudApiUrl,
            method: "GET",
            headers: headerData,
            useQuerystring: true,
            qs: queryParams
        }, function (error, resp, body) {
            if (error) {
                log.error('Cannot access Bitbucket cloud URL: ' + cloudApiUrl, { 'tenantUid': tenantUid });
                log.error(error, { 'tenantUid': tenantUid });
                reject(new errors.ServiceUnavailable(vcType + " service unavailable: " + cloudApiUrl, 1021));
            } else if (resp.statusCode == 200) {
                body = JSON.parse(body);
                // Check list has next pages
                hasPages = (body.hasOwnProperty('next')) ? true : false;
                // Override with next page url
                cloudApiUrl = (hasPages) ? body.next : cloudApiUrl;
                if (hasPages) {
                    totalPrList = totalPrList.concat(body.values);
                    pageNo++;
                    resolve(getPRListByRepoForBitbucket(cloudApiUrl, headerData, queryParams, queryString, vcType, hasPages, pageNo, totalPrList));
                } else {
                    totalPrList = totalPrList.concat(body.values);
                    let resultData = {
                        "type": vcType,
                        "list": totalPrList
                    };
                    resolve(resultData);
                }
            } else {
                log.error('No valid response from Bitbucket cloud URL: ' + cloudApiUrl, { 'tenantUid': tenantUid });
                log.error(error, { 'tenantUid': tenantUid });
                reject(new errors.ServiceUnavailable(vcType + " service unavailable: " + cloudApiUrl, 1021));
            }
        });
    });
}

export function processPrData(prMetaData) {
    prMetaData.req.body = {
        "repositoryUrl": prMetaData.pullrequest.repoMeta.repoUrl,
        "payload": {
            "id": prMetaData.pullrequest.id,
            "title": prMetaData.pullrequest.title,
            "description": prMetaData.pullrequest.description,
            "actor": {
                "displayName": prMetaData.pullrequest.author.display_name,
                "avatar": prMetaData.pullrequest.author.links.avatar.href
            },
            "createdOn": prMetaData.pullrequest.created_on,
            "updatedOn": prMetaData.pullrequest.updated_on,
            "sourceBranch": prMetaData.pullrequest.source.branch.name,
            "destinationBranch": prMetaData.pullrequest.destination.branch.name,
            "destinationCommitId": (prMetaData.pullrequest.destination.commit) ? prMetaData.pullrequest.destination.commit.hash : '',
            "sourceCommitId": (prMetaData.pullrequest.source.commit) ? prMetaData.pullrequest.source.commit.hash : '',
            "sourceCommitUrl": prMetaData.pullrequest.source.commit.links.self.href,
            "repoUrl": prMetaData.pullrequest.source.repository.links.self.href,
            "destinationRepoUrl": prMetaData.pullrequest.destination.repository.links.self.href,
            "commitUrl": prMetaData.pullrequest.links.commits.href,
            "vcType": prMetaData.repoProvider,
            "prState": prMetaData.prState,
            "fork": false,
            "projectId": '',
            "projectNamespace": ''
        }
    };
    if (_.includes(webhookController.BB_PR_STATES, prMetaData.prState)) {
        pullRequestService.filterReposByLanguage(prMetaData.req, false)
            .then(() => {
                prMetaData.callback();
            })
            .catch((err) => {
                log.error(err);
                prMetaData.callback();
            });
    } else {
        prMetaData.callback();
    }
}

//pullRequestService related payload data
export function getProcessPayload(payloadMetaData) {
    payloadMetaData.headerData = getHeaderData(payloadMetaData);
    // Prepare diffstat url
    payloadMetaData.fileDataUrl = `${payloadMetaData.payload.repoUrl}/diffstat/${payloadMetaData.payload.sourceCommitId}..${payloadMetaData.payload.destinationCommitId}`;
    payloadMetaData.queryParams = {
        "pagelen": PER_PAGE
    };
}

export function getCommitsPayload(payloadCommitsMeta) {
    request({
        url: `${payloadCommitsMeta.url}`,
        method: 'GET',
        timeout: 20000,
        headers: payloadCommitsMeta.headerData,
        rejectUnauthorized: false,
        useQuerystring: true,
        qs: payloadCommitsMeta.queryParams
    },
        function (error, response, body) {
            if (error) {
                log.error('Cannot access Bitbucket cloud URL: ' + payloadCommitsMeta.url, { 'tenantUid': payloadCommitsMeta.tenantUid });
                log.error(error, { 'tenantUid': payloadCommitsMeta.tenantUid });
                reject(new errors.ServiceUnavailable(payloadCommitsMeta.repoProvider + " service unavailable: " + payloadCommitsMeta.url, 1021));
            } else if (response.statusCode == 200) {
                let commitDetails = JSON.parse(body);
                // Summation
                payloadCommitsMeta.totalCommits = payloadCommitsMeta.totalCommits + commitDetails.values.length;
                // Check list has next pages
                payloadCommitsMeta.hasPages = (commitDetails.hasOwnProperty('next')) ? true : false;
                // Override with next page url
                payloadCommitsMeta.url = (payloadCommitsMeta.hasPages) ? commitDetails.next : payloadCommitsMeta.url;
                if (payloadCommitsMeta.hasPages) {
                    payloadCommitsMeta.resolve(pullRequestService.getCommitData(payloadCommitsMeta.url, payloadCommitsMeta.headerData, payloadCommitsMeta.repoProvider, payloadCommitsMeta.totalCommits, payloadCommitsMeta.prID, payloadCommitsMeta.queryParams, payloadCommitsMeta.hasPages, payloadCommitsMeta.serverType, payloadCommitsMeta.tenantUid));
                } else {
                    payloadCommitsMeta.resolve({
                        "noOfCommits": payloadCommitsMeta.totalCommits
                    });
                }
            } else {
                log.error('No valid response from Bitbucket cloud URL: ' + payloadCommitsMeta.url, { 'tenantUid': payloadCommitsMeta.tenantUid });
                log.error(error, { 'tenantUid': payloadCommitsMeta.tenantUid });
                payloadCommitsMeta.reject(new errors.ServiceUnavailable(payloadCommitsMeta.repoProvider + " service unavailable: " + payloadCommitsMeta.url, 1021));
            }
        });
}

export function getFilesPayload(payloadFileMeta) {
    payloadFileMeta.totalFilesChanged = payloadFileMeta.totalFilesChanged + (payloadFileMeta.fileDetails.values).length;
    payloadFileMeta.totalFilesAdded = payloadFileMeta.totalFilesAdded + ((payloadFileMeta.fileDetails.values).filter(d => d.status == 'added')).length;
    payloadFileMeta.totalfilesRemoved = payloadFileMeta.totalfilesRemoved + ((payloadFileMeta.fileDetails.values).filter(d => d.status == 'removed')).length;

    // File list
    payloadFileMeta.oldFileList = _.map(payloadFileMeta.fileDetails.values, 'old.path');
    payloadFileMeta.newFileList = _.map(payloadFileMeta.fileDetails.values, 'new.path');
    // Exclude
    payloadFileMeta.oldFileList = _.without(payloadFileMeta.oldFileList, undefined);
    payloadFileMeta.newFileList = _.without(payloadFileMeta.newFileList, undefined);
    // Total
    payloadFileMeta.oldFileListAll = payloadFileMeta.oldFileListAll.concat(payloadFileMeta.oldFileList);
    payloadFileMeta.newFileListAll = payloadFileMeta.newFileListAll.concat(payloadFileMeta.newFileList);
    // Check list has next pages
    payloadFileMeta.hasPages = (payloadFileMeta.fileDetails.hasOwnProperty('next')) ? true : false;
    // Override with next page url
    payloadFileMeta.fileDataUrl = (payloadFileMeta.hasPages) ? payloadFileMeta.fileDetails.next : payloadFileMeta.fileDataUrl;
}

function getHeaderData(headerDataMeta) {
    if (headerDataMeta.isVcSupport || headerDataMeta.repoType == 'private') {
        headerDataMeta.headerData['Authorization'] = "Basic " + cf.getEncryptedBasicToken(headerDataMeta.repoUser, headerDataMeta.repoPass);
    }
    return headerDataMeta.headerData;
}

/* hook creation code start */
export function getWebhookDetails(hookMeta) {
    try {
        //  Example Api - https://api.bitbucket.org/2.0/repositories/{username}/{repo_slug}/hooks/{uid}
        let decryptedUsername = cf.decryptStringWithAES(hookMeta.username);
        let decryptedPassword = cf.decryptStringWithAES(hookMeta.password);
        let basicToken = "Basic " + cf.getEncryptedBasicToken(decryptedUsername, decryptedPassword);
        let repoName = cf.getRepoNameByUrl(hookMeta.repo_url);
        let url = `${BITBUCKET_BASE_API_URL}repositories/${decryptedUsername}/${repoName}/hooks`;
        url += (hookMeta.webhook_id !== "") ? '/' + hookMeta.webhook_id : '';

        return webhookController.getSingleHook(url, basicToken)
            .then(() => { log.info('Retrieve single hook executed'); })
            .catch((err) => { log.error('Error while Retrieving single hook: ' + err); });
    } catch (error) {
        log.error(error, { 'tenantUid': hookMeta.tenantUid });
    }
}

// create webhook or update webhook
export function createWebhook(hookMeta) {
    try {
        return new Promise((resolve, reject) => {

            let HOOK_URL, headerData, url;

            // Prepare url
            url = `${BITBUCKET_BASE_API_URL}repositories/${hookMeta.repo_owner}/${hookMeta.repo_slug}/hooks`;
            url += (hookMeta.webhook_id !== "") ? '/' + hookMeta.webhook_id : '';
            HOOK_URL = _.trimEnd(hookMeta.public_url, '/') + WEBHOOK_URL;
            // Headers
            headerData = {
                "content-type": "application/json",
                "User-Agent": "Awesome-Octocat-Ap"
            };

            // Basic auth
            if (hookMeta.is_vc_support || hookMeta.repoUrlType == 'private') {
                headerData['Authorization'] = "Basic " + cf.getEncryptedBasicToken(hookMeta.repo_username, hookMeta.repo_password);
            }

            // Public api url
            HOOK_URL = _.trimEnd(hookMeta.public_url, '/') + WEBHOOK_URL;

            // only for onpremise. For cloud this logic will change with sundomain cloud url
            let requestData = {
                "description": "EMBOLD webhook",
                "url": HOOK_URL,
                "active": true,
                "events": webhookController.BB_PR_EVENTS
            };

            request({
                url: url,
                method: (hookMeta.webhook_id !== '') ? 'PUT' : 'POST',
                headers: headerData,
                json: requestData
            }, function (error, response, body) {
                if (body != "" && typeof body != 'undefined') {
                    resolve(body);
                } else {
                    log.error('No valid response from Bitbucket cloud URL: ' + url, { 'tenantUid': hookMeta.tenantUid });
                    log.error(error, { 'tenantUid': hookMeta.tenantUid });
                    reject(error);
                }
            });
        });
    } catch (error) {
        log.error(error);
    }
}

/* hook code end */


/* update status code start */
export function getUpdateStatusDetails(updateInfo) {
    updateInfo.headerData['Authorization'] = "Basic " +
        cf.getEncryptedBasicToken(updateInfo.repoUser, updateInfo.repoPass);
    updateInfo.cloudApiUrl = `${updateInfo.sourceCommitUrl}/statuses/build`;

    return updateInfo;
}
export function getUpdateStatusInfo(infoObj) {
    infoObj.jsonBody = {
        "state": infoObj.status,
        "key": infoObj.reviewRequestId,
        "name": "Embold",
        "url": infoObj.domainURL
    };
    switch (infoObj.status) {
        case 'SUCCESSFUL':
            if (_.isEmpty(infoObj.issuesCount)) {
                infoObj.jsonBody.description = "#" + infoObj.pullRequestId + ": " + "Embold Scan Successful, no issues data found."
            }
            else {
                if (infoObj.issuesCount.totalAddedMajorIssues > 0) {
                    infoObj.jsonBody.state = 'FAILED';
                }
                infoObj.jsonBody.description = "#" + infoObj.pullRequestId + ": " + scanController.getDescription(infoObj.issuesCount);
            }
            break;
        case 'FAILED':
            infoObj.jsonBody.description = "#" + infoObj.pullRequestId + ": " + "Embold Scan Failed.";
            break;
        case 'INPROGRESS':
            infoObj.jsonBody.description = "#" + infoObj.pullRequestId + ": " + "Embold Scan Pending.";
            break;
        case 'STOPPED':
            infoObj.jsonBody.description = "#" + infoObj.pullRequestId + ": " + "Embold Scan Stopped.";
            break;
        default:
            log.error("No status found for update to remote");
            break;
    }
    return infoObj;
}

export function isPublicUrl(jsonData) {
    return new Promise((resolve, reject) => {
        let url = `${BITBUCKET_BASE_API_URL}repositories/${jsonData.repoOwner}/${jsonData.repoSlug}`;
        request({
            url: url,
            method: "GET"
        }, function (error, resp, body) {
            if (error || resp.statusCode === 403 || resp.statusCode === 404) {
                resolve(false);
            } else if (typeof body !== 'undefined') {
                let bodyData = JSON.parse(body);
                if (bodyData.error !== undefined) {
                    resolve(false);
                } else {
                    resolve(!bodyData.is_private);
                }
            }
        });
    });
}