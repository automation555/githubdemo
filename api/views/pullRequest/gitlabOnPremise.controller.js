import * as log from './../../../logs/logger';
import request from 'request';
import * as cf from './../../../utils/common-functions';
import * as pullRequestService from './pullRequest.service';
import * as webhookController from './../../views/pullRequest/webhook.controller';
import * as scanController from './scan.controller';
import _ from 'lodash';
const errors = require('throw.js');
const API_VERSION = 'v4';   // Latest
const PER_PAGE = 100;   // Max per page
const WEBHOOK_URL = '/api/views/repositories/pullrequests/webhooks';

//polling related data
export function getPrData(prMetaData) {
    let tasks = [];
    prMetaData.headerData = getHeaderData(prMetaData);
    prMetaData.cloudApiUrl = prMetaData.baseUrl + '/api/' + API_VERSION + '/projects/' + prMetaData.projectId + '/merge_requests';
    prMetaData.queryParams = { "per_page": PER_PAGE };
    // Last polling timestamp not null then get all w.r.t. last polling timestamp else get only open
    prMetaData.queryString = (prMetaData.lastPollDt) ? `state=all&updated_after>=${prMetaData.lastPollDt}` : `state=opened`;
    tasks = [getPRListByRepo(prMetaData.cloudApiUrl, prMetaData.headerData, prMetaData.queryParams, prMetaData.queryString, prMetaData.repoProvider, false, 1, [], prMetaData.tenantUid)];
    return tasks;
}

export function getUpdateStatusDetails(updateInfo) {
    let srcUrl = `${updateInfo.baseUrl}/api/${API_VERSION}/projects`
    updateInfo.headerData['Authorization'] = "Bearer " + updateInfo.repoPass;
    updateInfo.cloudApiUrl = `${srcUrl}/${updateInfo.projectId}/statuses/${updateInfo.sourceCommitId}`;
    return updateInfo;
}

export function getUpdateStatusInfo(infoObj) {
    infoObj.jsonBody = {};
    let description;
    let gitLabStatus;

    switch (infoObj.status) {
        case 'INPROGRESS':
            gitLabStatus = 'running';
            description = "Embold Scan Running."
            break;
        case 'SUCCESSFUL':
            gitLabStatus = 'success';
            if (_.isEmpty(infoObj.issuesCount)) {
                description = "Scan Successful, no issues data found.";
            }
            else {
                if (infoObj.issuesCount.totalAddedMajorIssues > 0) {
                    gitLabStatus = 'failed';
                }
                description = scanController.getDescription(infoObj.issuesCount);
            }
            break;
        case 'FAILED':
            gitLabStatus = 'failed';
            description = "Embold Scan Failed.";
            break;
        case 'STOPPED':
            gitLabStatus = 'cancelled';
            description = "Embold Scan Cancelled.";
            break;
        default:
            log.error("No status found for update to remote");
            break;
    }
    infoObj.cloudApiUrl = `${infoObj.cloudApiUrl}?state=${gitLabStatus}&context=Embold&description=${description}&target_url=${infoObj.domainURL}`;
    return infoObj;
}

function getPRListByRepo(cloudApiUrl, headerData, queryParams, queryString, vcType, hasPages, pageNo, totalPrList, tenantUid) {
    queryParams = (!hasPages) ? queryParams : {};
    cloudApiUrl = (!hasPages) ? cloudApiUrl + '?' + queryString : cloudApiUrl;
    log.debug("Fetching pull requests from Gitlab API URL: " + cloudApiUrl, { 'tenantUid': tenantUid });
    return new Promise((resolve, reject) => {
        request({
            url: cloudApiUrl,
            method: "GET",
            headers: headerData,
            useQuerystring: true,
            qs: queryParams
        }, function (error, resp, body) {
            if (error) {
                log.error('Cannot access Gitlab URL: ' + cloudApiUrl, { 'tenantUid': tenantUid });
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
                    resolve(getPRListByRepo(cloudApiUrl, headerData, queryParams, queryString, vcType, hasPages, pageNo, totalPrList));
                } else {
                    totalPrList = totalPrList.concat(body);
                    let resultData = {
                        "type": vcType,
                        "list": totalPrList
                    };
                    resolve(resultData);
                }
            } else {
                log.error('No valid response from Gitlab URL: ' + cloudApiUrl, { 'tenantUid': tenantUid });
                log.error(error, { 'tenantUid': tenantUid });
                reject(new errors.ServiceUnavailable(vcType + " service unavailable: " + cloudApiUrl, 1021));
            }
        });
    });
}

export function processPrData(prMetaData) {
    let baseUrl = (typeof prMetaData.pullrequest.repoMeta !== 'undefined' && typeof prMetaData.pullrequest.repoMeta.baseUrl !== 'undefined') ? prMetaData.pullrequest.repoMeta.baseUrl : '';
    let commitUrl = `${baseUrl}/api/${API_VERSION}/projects/${prMetaData.pullrequest.project_id}/merge_requests/${prMetaData.pullrequest.iid}/commits`;
    // If project id differs then consider as forked otherwise its same
    let isForked = (prMetaData.pullrequest.source_project_id != prMetaData.pullrequest.target_project_id) ? true : false;
    prMetaData.req.body = {
        "repositoryUrl": prMetaData.pullrequest.repoMeta.repoUrl,
        "payload": {
            "id": prMetaData.pullrequest.iid,
            "title": prMetaData.pullrequest.title,
            "description": prMetaData.pullrequest.description,
            "actor": {
                "displayName": prMetaData.pullrequest.author.name,
                "avatar": prMetaData.pullrequest.author.avatar_url
            },
            "createdOn": prMetaData.pullrequest.created_at,
            "updatedOn": prMetaData.pullrequest.updated_at,
            "sourceBranch": prMetaData.pullrequest.source_branch,
            "destinationBranch": prMetaData.pullrequest.target_branch,
            "destinationCommitId": (typeof prMetaData.pullrequest.merge_commit_sha !== 'undefined' && prMetaData.pullrequest.merge_commit_sha) ? prMetaData.pullrequest.merge_commit_sha : '',
            "sourceCommitId": prMetaData.pullrequest.sha,
            "sourceCommitUrl": '',
            "repoUrl": prMetaData.repoUrl,
            "destinationRepoUrl": '',
            "commitUrl": commitUrl,
            "vcType": prMetaData.repoProvider,
            "prState": prMetaData.prState,
            "fork": isForked,
            "projectId": prMetaData.pullrequest.project_id,
            "projectNamespace": ''
        }
    };
    if (_.includes(webhookController.GL_PR_STATES, prMetaData.prState)) {
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
    payloadMetaData.fileDataUrl = `${payloadMetaData.baseUrl}/api/${API_VERSION}/projects/${payloadMetaData.payload.projectId}/repository/compare?from=${payloadMetaData.payload.destinationBranch}&to=${payloadMetaData.payload.sourceBranch}`;
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
    payloadFileMeta.totalFilesChanged = payloadFileMeta.totalFilesChanged + (payloadFileMeta.fileDetails.diffs).length;
    payloadFileMeta.totalFilesAdded = payloadFileMeta.totalFilesAdded + ((payloadFileMeta.fileDetails.diffs).filter(d => d.new_file == true)).length;
    payloadFileMeta.totalfilesRemoved = payloadFileMeta.totalfilesRemoved + ((payloadFileMeta.fileDetails.diffs).filter(d => d.deleted_file == true)).length;
    // File list
    payloadFileMeta.oldFileList = _.map(payloadFileMeta.fileDetails.diffs, 'old_path');
    payloadFileMeta.newFileList = _.map(payloadFileMeta.fileDetails.diffs, 'new_path');
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
        headerDataMeta.headerData['Authorization'] = "Bearer " + headerDataMeta.repoPass;
    } else if (headerDataMeta.repoType == 'private') {
        headerDataMeta.headerData['Authorization'] = "Basic " + cf.getEncryptedBasicToken(headerDataMeta.repoUser, headerDataMeta.repoPass);
    }
    return headerDataMeta.headerData;
}

/* hook creation code start */
export function getWebhookDetails(hookMeta) {
    try {
        // Example Api - https://gitlab.example.com/api/v4/projects/:id/hooks/:hook_id
        let decryptedPassword = cf.decryptStringWithAES(hookMeta.password);
        let autherizationToken = '';
        if (hookMeta.is_vc_support) {
            autherizationToken = "Bearer " + decryptedPassword;
        } else if (hookMeta.repoUrlType == 'private') {
            autherizationToken = "Basic " + cf.getEncryptedBasicToken(hookMeta.repo_username, hookMeta.repo_password);
        }
        let url = `${hookMeta.base_url}/api/${API_VERSION}/projects/${hookMeta.project_id}/hooks`;
        url += (hookMeta.webhook_id !== "") ? '/' + hookMeta.webhook_id : '';
        return webhookController.getSingleHook(url, autherizationToken)
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
            url = `${hookMeta.base_url}/api/${API_VERSION}/projects/${hookMeta.project_id}/hooks`;
            url += (hookMeta.webhook_id !== "") ? '/' + hookMeta.webhook_id : '';

            // Headers
            headerData = {
                "content-type": "application/json"
            };

            // Basic auth
            if (hookMeta.is_vc_support) {
                headerData['Authorization'] = "Bearer " + hookMeta.repo_password;
            } else if (hookMeta.repoUrlType == 'private') {
                headerData['Authorization'] = "Basic " + cf.getEncryptedBasicToken(hookMeta.repo_username, hookMeta.repo_password);
            }

            // Public api url
            HOOK_URL = _.trimEnd(hookMeta.public_url, '/') + WEBHOOK_URL;

            // only for onpremise. For cloud this logic will change with sundomain cloud url
            let requestData = {
                "id": new Date().getTime(),
                "url": HOOK_URL,
                "merge_requests_events": true
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
                    log.error('No valid response from Gitlab URL: ' + url, { 'tenantUid': hookMeta.tenantUid });
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

export function getProjectIdByNamespace(jsonData) {
    let projectId = '', projectNamespace, projectNamespaceEncoded, projectApiUrl, headerData = [];
    // Extract namespace from web url
    projectNamespace = getProjectNamespaceFromUrl(jsonData.repoUrl);
    // URL encoding
    projectNamespaceEncoded = encodeURIComponent(projectNamespace);
    // Prepare project api endpoint - http://<ip_address>:<port>/api/v4/projects/org_name%2Fproject_name
    projectApiUrl = jsonData.baseUrl + '/api/' + API_VERSION + '/projects/' + projectNamespaceEncoded;
    // Set headers gitlab only support private_token
    headerData['Authorization'] = "Bearer " + jsonData.repoPass;
    log.debug('Fetching projects list from Gitlab API URL: ' + projectApiUrl);
    return new Promise((resolve, reject) => {
        request({
            url: projectApiUrl,
            method: "GET",
            headers: headerData,
        }, function (error, resp, body) {
            if (error) {
                log.error('Cannot access Gitlab URL: ' + projectApiUrl);
                reject(new errors.ServiceUnavailable("Gitlab service unavailable: " + projectApiUrl, 1021));
            } else if (resp.statusCode == 200) {
                body = JSON.parse(body);
                projectId = (!_.isUndefined(body.id)) ? body.id : '';
                resolve(projectId);
            } else {
                log.error('No valid response from Gitlab URL: ' + projectApiUrl);
                reject(projectId);
            }
        });
    });
}

function getProjectNamespaceFromUrl(repoWebUrl) {
    let parts, projectNamespace;
    parts = _.split(repoWebUrl, "/");
    // [ 'http:', '', '192.168.2.48:9999', 'pankajorg', 'techno', '' ]
    parts = _.compact(parts);
    // [ 'http:', '192.168.2.48:9999', 'pankajorg', 'techno' ]
    parts.splice(0, 2);
    projectNamespace = _.join(parts, "/");
    return projectNamespace;
}