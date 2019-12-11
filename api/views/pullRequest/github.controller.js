import * as log from './../../../logs/logger';
import request from 'request';
import * as cf from '../../../utils/common-functions';
import * as pullRequestService from './pullRequest.service';
import * as scanController from './scan.controller';
import async from 'async';
import * as webhookController from './webhook.controller';
import _ from 'lodash';
const errors = require('throw.js');
var GITHUB_BASE_API_URL = 'https://api.github.com/';  // Cloud
const API_VERSION = 'v3';
const PER_PAGE = 50;   // Max per page
const WEBHOOK_URL = '/api/views/repositories/pullrequests/webhooks';

function getBaseApiUrl(serverType, baseUrl) {
    if (serverType == 'onpremise') {
        GITHUB_BASE_API_URL = `${baseUrl}/api/${API_VERSION}/`;
    }
    else if (serverType == 'cloud') {
        GITHUB_BASE_API_URL = 'https://api.github.com/';
    }
}

export function getUpdateStatusDetails(updateInfo) {
    if (updateInfo.isVcSupport) {
        updateInfo.headerData['Authorization'] = "token " + updateInfo.repoPass;
    }
    else if (updateInfo.repoType == 'private') {
        // Git providers
        updateInfo.headerData['Authorization'] = "Basic " +
            cf.getEncryptedBasicToken(updateInfo.repoUser, updateInfo.repoPass);
    }
    updateInfo.headerData['User-Agent'] = 'Awesome-Octocat-Ap';
    updateInfo.cloudApiUrl = `${updateInfo.repoUrl}/statuses/${updateInfo.sourceCommitId}`;
    return updateInfo;
}
export function getUpdateStatusInfo(infoObj) {

    infoObj.jsonBody = {
        "state": infoObj.status,
        "context": "Embold",
        "target_url": infoObj.domainURL
    };
    switch (infoObj.status) {
        case 'INPROGRESS':
            infoObj.jsonBody.state = "pending";
            infoObj.jsonBody.description = "Embold Scan Pending.";
            break;
        case 'SUCCESSFUL':
            infoObj.jsonBody.state = "success";
            if (_.isEmpty(infoObj.issuesCount)) {
                infoObj.jsonBody.description = "Scan Successful, no issues data found.";
            }
            else {
                if (infoObj.issuesCount.totalAddedMajorIssues > 0) {
                    infoObj.jsonBody.state = 'failure';
                }
                infoObj.jsonBody.description = scanController.getDescription(infoObj.issuesCount);
            }
            break;
        case 'FAILED':
            infoObj.jsonBody.state = "failure";
            infoObj.jsonBody.description = "Embold Scan Failed.";
            break;
        case 'STOPPED':
            infoObj.jsonBody.state = 'error';
            infoObj.jsonBody.description = "Embold Scan Error.";
            break;
        default:
            log.error("No status found for update to remote");
            break;
    }

    return infoObj;
}

//polling related data
export function getPrData(prMetaData) {
    let tasks = [];
    getBaseApiUrl(prMetaData.serverType, prMetaData.baseUrl);
    prMetaData.headerData = getHeaderData(prMetaData);
    prMetaData.cloudApiUrl = GITHUB_BASE_API_URL + 'repos/' + prMetaData.repoOwner + '/' + prMetaData.repoSlug + '/pulls';
    prMetaData.queryParams = (prMetaData.lastPollDt) ? { "per_page": PER_PAGE } : { "state": "open", "per_page": PER_PAGE };
    // Last polling timestamp not null then get all w.r.t. last polling timestamp else get only open
    prMetaData.queryString = (prMetaData.lastPollDt) ? `is:pr repo:${prMetaData.repoOwner}/${prMetaData.repoSlug} state:open state:closed updated:>=${prMetaData.lastPollDt}` : '';
    (prMetaData.lastPollDt) ? tasks = [getPRListByRepoForGithubSearch(prMetaData.cloudApiUrl, prMetaData.headerData, prMetaData.queryParams, prMetaData.queryString, prMetaData.repoProvider, prMetaData.baseUrl, false, 1, [], prMetaData.tenantUid)] : tasks = [getPRListByRepoForGithub(prMetaData.cloudApiUrl, prMetaData.headerData, prMetaData.queryParams, prMetaData.queryString, prMetaData.repoProvider, false, 1, [], prMetaData.tenantUid)];
    return tasks;
}

function getPRListByRepoForGithubSearch(cloudApiUrl, headerData, queryParams, queryString, vcType, baseUrl, hasPages, pageNo, totalPrList, tenantUid) {
    let searchApiUrl = baseUrl + 'search/issues?q=' + queryString;
    log.debug("Searching for pull requests from Github API URL: " + searchApiUrl, { 'tenantUid': tenantUid });
    return new Promise((resolve, reject) => {
        request({
            url: searchApiUrl,
            method: "GET",
            headers: headerData
        }, function (error, resp, body) {
            if (!error && resp.statusCode == 200) {
                body = JSON.parse(body);
                if (body.total_count > 0) {
                    // Sync loop through single pr api
                    async.forEachSeries(body.items, function (item, callback) {
                        let prNumber = item.number;
                        // Get single pr data
                        let singlePrApiUrl = cloudApiUrl + "/" + prNumber;
                        request({
                            url: singlePrApiUrl,
                            method: "GET",
                            headers: headerData
                        }, function (err, response, payload) {
                            payload = JSON.parse(payload);
                            if (!err && response.statusCode == 200) {
                                // Prepare list
                                totalPrList = totalPrList.concat(payload);
                                callback();
                            } else {
                                reject(new errors.ServiceUnavailable(vcType + " service unavailable: " + singlePrApiUrl, 1021));
                                callback();
                            }
                        });
                    },
                        function (err) {
                            if (err) {
                                return err;
                            }
                            // Result
                            let resultData = {
                                "type": vcType,
                                "list": totalPrList
                            };
                            resolve(resultData);
                        });
                } else {
                    // Empty
                    let resultData = {
                        "type": vcType,
                        "list": totalPrList
                    };
                    log.debug("No PRs found for Github URL: " + searchApiUrl, { 'tenantUid': tenantUid });
                    resolve(resultData);
                }
            } else {
                log.error('No valid response from Github URL: ' + searchApiUrl, { 'tenantUid': tenantUid });
                log.error(error, { 'tenantUid': tenantUid });
                reject(new errors.ServiceUnavailable(vcType + " service unavailable: " + searchApiUrl, 1021));
            }
        });
    });
}

function getPRListByRepoForGithub(cloudApiUrl, headerData, queryParams, queryString, vcType, hasPages, pageNo, totalPrList, tenantUid) {
    queryParams = (!hasPages) ? queryParams : {};
    log.debug("Fetching pull requests from Github API URL: " + cloudApiUrl, { 'tenantUid': tenantUid });
    return new Promise((resolve, reject) => {
        request({
            url: cloudApiUrl,
            method: "GET",
            headers: headerData,
            useQuerystring: true,
            rejectUnauthorized: false,
            qs: queryParams
        }, function (error, resp, body) {
            if (error) {
                log.error('Cannot access Github URL: ' + cloudApiUrl, { 'tenantUid': tenantUid });
                log.error(error, { 'tenantUid': tenantUid });
                reject(new errors.ServiceUnavailable(vcType + " service unavailable: " + cloudApiUrl, 1021));
            } else if (resp.statusCode == 200) {
                body = JSON.parse(body);
                let respHeaders = (typeof resp.headers != 'undefined') ? resp.headers : '';
                // Check list has next pages
                let rhd = cf.extractNextPageLink(respHeaders);
                hasPages = (typeof rhd.hasPages !== 'undefined') ? rhd.hasPages : false;
                // Override with next page url
                cloudApiUrl = (typeof rhd.hasPages !== 'undefined' && rhd.hasPages) ? rhd.nextPageLink : cloudApiUrl;
                if (hasPages) {
                    totalPrList = totalPrList.concat(body);
                    pageNo++;
                    resolve(getPRListByRepoForGithub(cloudApiUrl, headerData, queryParams, queryString, vcType, hasPages, pageNo, totalPrList, tenantUid));
                } else {
                    totalPrList = totalPrList.concat(body);
                    let resultData = {
                        "type": vcType,
                        "list": totalPrList
                    };
                    resolve(resultData);
                }
            } else {
                log.error('No valid response from Github URL: ' + cloudApiUrl, { 'tenantUid': tenantUid });
                log.error(error, { 'tenantUid': tenantUid });
                reject(new errors.ServiceUnavailable(vcType + " service unavailable: " + cloudApiUrl, 1021));
            }
        });
    });
}

export function processPrData(prMetaData) {
    // Unknown repository object
    let isUnknownRepo = (typeof prMetaData.pullrequest.head.repo === 'undefined' || !prMetaData.pullrequest.head.repo) ? true : false;
    if (!isUnknownRepo) {
        // Replace sha
        let sourceCommitUrl = prMetaData.pullrequest.head.repo.commits_url.replace("{/sha}", "/" + prMetaData.pullrequest.head.sha);
        prMetaData.req.body = {
            "repositoryUrl": prMetaData.pullrequest.repoMeta.repoUrl,
            "payload": {
                "id": prMetaData.pullrequest.number,
                "title": prMetaData.pullrequest.title,
                "description": prMetaData.pullrequest.body,
                "actor": {
                    "displayName": prMetaData.pullrequest.user.login,
                    "avatar": prMetaData.pullrequest.user.avatar_url
                },
                "createdOn": prMetaData.pullrequest.created_at,
                "updatedOn": prMetaData.pullrequest.updated_at,
                "sourceBranch": prMetaData.pullrequest.head.ref,
                "destinationBranch": prMetaData.pullrequest.base.ref,
                "destinationCommitId": prMetaData.pullrequest.base.sha,
                "sourceCommitId": prMetaData.pullrequest.head.sha,
                "sourceCommitUrl": sourceCommitUrl,
                "repoUrl": prMetaData.pullrequest.head.repo.url,
                "destinationRepoUrl": prMetaData.pullrequest.base.repo.url,
                "commitUrl": prMetaData.pullrequest.commits_url,
                "vcType": prMetaData.repoProvider,
                "prState": prMetaData.prState,
                "fork": prMetaData.pullrequest.head.repo.fork,
                "projectId": '',
                "projectNamespace": ''
            }
        };
        if (_.includes(webhookController.GH_PR_STATES, prMetaData.prState)) {
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
    } else {
        log.info('Github unknown repo for pull request ID: ' + prMetaData.pullrequest.number, { 'tenantUid': prMetaData.tenantUid });
        prMetaData.callback();
    }
}


//pullRequestService related payload data
export function getProcessPayload(payloadMetaData) {
    payloadMetaData.headerData = getHeaderData(payloadMetaData);
    // Prepare diffstat url
    payloadMetaData.fileDataUrl = `${payloadMetaData.payload.repoUrl}/compare/${payloadMetaData.payload.destinationCommitId}...${payloadMetaData.payload.sourceCommitId}`;
    payloadMetaData.queryParams = {
        "per_page": PER_PAGE
    };
}

export function getCommitsPayload(payloadCommitsMeta) {
    payloadCommitsMeta.resolve({
        "noOfCommits": payloadCommitsMeta.totalCommits
    });
}

export function getFilesPayload(payloadFileMeta) {
    payloadFileMeta.totalFilesChanged = payloadFileMeta.totalFilesChanged + (payloadFileMeta.fileDetails.files).length;
    payloadFileMeta.totalFilesAdded = payloadFileMeta.totalFilesAdded + ((payloadFileMeta.fileDetails.files).filter(d => d.status == 'added')).length;
    payloadFileMeta.totalfilesRemoved = payloadFileMeta.totalfilesRemoved + ((payloadFileMeta.fileDetails.files).filter(d => d.status == 'removed')).length;
    // File list
    payloadFileMeta.oldFileList = _.map(payloadFileMeta.fileDetails.files, 'filename');
    payloadFileMeta.newFileList = _.map(payloadFileMeta.fileDetails.files, 'filename');
    // Exclude
    payloadFileMeta.oldFileList = _.without(payloadFileMeta.oldFileList, undefined);
    payloadFileMeta.newFileList = _.without(payloadFileMeta.newFileList, undefined);
    // Total
    payloadFileMeta.oldFileListAll = payloadFileMeta.oldFileListAll.concat(payloadFileMeta.oldFileList);
    payloadFileMeta.newFileListAll = payloadFileMeta.newFileListAll.concat(payloadFileMeta.newFileList);
    // Check list has next pages
    let rhd = cf.extractNextPageLink(payloadFileMeta.respHeaders);
    payloadFileMeta.hasPages = (typeof rhd.hasPages !== 'undefined') ? rhd.hasPages : false;
    // Override with next page url
    payloadFileMeta.fileDataUrl = (typeof rhd.hasPages !== 'undefined' && rhd.hasPages) ? rhd.nextPageLink : payloadFileMeta.fileDataUrl;
}

function getHeaderData(headerDataMeta) {
    if (headerDataMeta.isVcSupport) {
        headerDataMeta.headerData['Authorization'] = "token " + headerDataMeta.repoPass;
    } else if (headerDataMeta.repoType == 'private') {
        headerDataMeta.headerData['Authorization'] = "Basic " + cf.getEncryptedBasicToken(headerDataMeta.repoUser, headerDataMeta.repoPass);
    }
    headerDataMeta.headerData['User-Agent'] = 'Awesome-Octocat-Ap';
    return headerDataMeta.headerData;
}
/* hook creation code start */
export function getWebhookDetails(hookMeta) {
    try {
        getBaseApiUrl(hookMeta.serverType, hookMeta.base_url);
        //  Example Api - https://api.github.com/repos/repos/:owner/:repo/hooks/:hook_id
        let repoOwner = cf.getUsernameByUrl(hookMeta.repo_url);
        let gitDecryptedPassword = cf.decryptStringWithAES(hookMeta.password);
        let gitBasicToken = '';
        if (hookMeta.is_vc_support) {
            gitBasicToken = "token " + gitDecryptedPassword;
        } else if (hookMeta.repoUrlType == 'private') {
            gitBasicToken = "Basic " + cf.getEncryptedBasicToken(hookMeta.repo_username, hookMeta.repo_password);
        }
        let gitRepoName = cf.getRepoNameByUrl(hookMeta.repo_url);

        let url = `${GITHUB_BASE_API_URL}repos/${repoOwner}/${hookMeta.repo_slug}/hooks`;
        url += (hookMeta.webhook_id !== "") ? '/' + hookMeta.webhook_id : '';
        let userAgent = 'Awesome-Octocat-Ap';

        return webhookController.getSingleHook(url, gitBasicToken, userAgent)
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
            getBaseApiUrl(hookMeta.serverType, hookMeta.base_url);

            // Prepare url
            url = `${GITHUB_BASE_API_URL}repos/${hookMeta.repo_owner}/${hookMeta.repo_slug}/hooks`;

            url += (hookMeta.webhook_id !== "") ? '/' + hookMeta.webhook_id : '';
            // Public api url
            HOOK_URL = _.trimEnd(hookMeta.public_url, '/') + WEBHOOK_URL;

            // Headers
            headerData = {
                "content-type": "application/json",
                "User-Agent": "Awesome-Octocat-Ap"
            };

            // Basic auth
            if (hookMeta.is_vc_support) {
                headerData['Authorization'] = "token " + hookMeta.repo_password;
            } else if (hookMeta.repoUrlType == 'private') {
                headerData['Authorization'] = "Basic " + cf.getEncryptedBasicToken(hookMeta.repo_username, hookMeta.repo_password);
            }

            // only for onpremise. For cloud this logic will change with sundomain cloud url
            let requestData = {
                "name": "web",
                "active": true,
                "events": [
                    "pull_request"
                ],
                "config": {
                    "url": HOOK_URL,
                    "content_type": "json"
                }
            };

            request({
                url: url,
                method: (hookMeta.webhook_id !== '') ? 'PATCH' : 'POST',
                headers: headerData,
                json: requestData,
                rejectUnauthorized: false
            }, function (error, response, body) {
                if (body != "" && typeof body != 'undefined') {
                    resolve(body);
                } else {
                    log.error('No valid response from Github URL: ' + url, { 'tenantUid': hookMeta.tenantUid });
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

export function isPublicUrl(jsonData) {
    return new Promise((resolve, reject) => {
        getBaseApiUrl(jsonData.serverType, jsonData.baseUrl);
        let url = `${GITHUB_BASE_API_URL}repos/${jsonData.repoOwner}/${jsonData.repoSlug}`;
        request({
            url: url,
            method: "GET",
            headers: {
                "content-type": "application/json",
                "User-Agent": "Awesome-Octocat-Ap"
            }
        }, function (error, resp, body) {
            if (error || resp.statusCode === 403 || resp.statusCode === 404) {
                reject(false);
            } else {
                let bodyData = JSON.parse(body);
                resolve(!bodyData.private);
            }
        });
    });
}
