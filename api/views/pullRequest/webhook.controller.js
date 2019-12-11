import * as log from './../../../logs/logger';
import request from 'request';
import _ from 'lodash';
import * as db from './../../../component/db';
import * as pullRequestService from './pullRequest.service';
import * as gammaConfig from './../../../core/config';
import async from 'async';
import * as pullRequestInterfaceController from './pullRequestInterface.controller';
import * as cf from './../../../utils/common-functions';

const errors = require('throw.js');
export const BB_PR_STATES = ["open", "merged", "declined"];
export const GH_PR_STATES = ["open", "closed"];
export const GL_PR_STATES = ["opened", "closed", "merged"];
export const BB_PR_EVENTS = ['pullrequest:created', 'pullrequest:updated', 'pullrequest:fulfilled', 'pullrequest:rejected'];
export const BB_PR_SERVER_EVENTS = ['pr:opened', 'pr:modified', 'pr:declined', 'pr:merged'];
// Poll only when pr scan enabled

export async function index(req, res, next) {
    let repositoryUid = req.params.repositoryUid;
    let sqlQuery = `select s.pr_enable, t.public_url FROM subsystems s INNER JOIN tenant t ON (s.tenant_id = t.id) WHERE subsystem_uid = $1`;
    return db.gammaDbPool.query(sqlQuery, [repositoryUid])
        .then(result => {
            let data = result[0];
            data.webhook_exist = false;
            data.public_url = (data.public_url !== null && data.public_url !== "") ? true : false;
            res.status(200).json(data);
        });
}

export async function create(req, res, next) {
    let repositoryUid = req.params.repositoryUid;
    let tenantUid = req.session.tenantUid;
    return processWebhook(repositoryUid, req.session.tenant_id, tenantUid)
        .then(repoDetails => {
            return res.status(200).json(repoDetails);
        })
        .catch(error => {
            log.error("Error in creating Webhook for repoUid: " + repositoryUid, { 'tenantUid': tenantUid });
            log.error(JSON.stringify(error), { 'tenantUid': tenantUid });
            return res.status(404).json(error);
        });
}

export async function update(req, res, next) {
    let repositoryUid = req.params.repositoryUid;
    let tenantUid = req.session.tenantUid;
    return processUpdateWebhook(repositoryUid, req.session.tenant_id, tenantUid)
        .then(repoDetails => {
            return res.status(200).json(repoDetails);
        })
        .catch(error => {
            log.error('Error in updating webhook for repoUid: ' + repositoryUid + JSON.stringify(error), { 'tenantUid': tenantUid });
            return res.status(404).json(error);
        });
}

export async function createHook(req, res, next) {
    let repositoryUid = req.params.repositoryUid;
    let tenantUid = (req.session) ? req.session.tenant_uid : '';
    let enable = Boolean(req.body.enable);
    if (enable === true || enable === 'true') {
        let sqlQuery = `UPDATE subsystems SET pr_enable = ${enable} WHERE subsystem_uid = $1 AND tenant_id = $2`;
        return db.gammaDbPool.query(sqlQuery, [repositoryUid, req.session.tenant_id])
            .then(result => {
                return processWebhook(repositoryUid, req.session.tenant_id)
                    .then(repoDetails => {
                        return res.status(200).json(repoDetails);
                    })
                    .catch(error => {
                        log.error("Error in creating webhook for repoUid: " + repositoryUid, { 'tenantUid': tenantUid });
                        log.error(JSON.stringify(error));
                        return res.status(404).json(error);
                    });
            });
    }
}

export async function listen(req, res, next) {
    let tenantUid = (req.session) ? req.session.tenant_uid : '';
    // listen to webhook for review requests -> call review request service
    if ((gammaConfig.enablePRScan === true || gammaConfig.enablePRScan === "true")) {
        // Headers
        let requestBody, xUserAgent, uaArr, prState, ghUserAgent, xBbHookUuid, xGlEvent, eventProvider, eventName, eventAction, isPREvent, serverType;
        requestBody = req.body;
        serverType = 'cloud';
        xUserAgent = (typeof req.headers['user-agent'] !== 'undefined' && req.headers['user-agent']) ? req.headers['user-agent'].toLowerCase() : '';
        uaArr = (xUserAgent != "") ? xUserAgent.split("/") : [];
        ghUserAgent = (uaArr.length) ? uaArr[0] : "";
        xBbHookUuid = (typeof req.headers['x-hook-uuid'] !== 'undefined' && req.headers['x-hook-uuid']) ? req.headers['x-hook-uuid'] : '';
        xGlEvent = (typeof req.headers['x-gitlab-event'] !== 'undefined' && req.headers['x-gitlab-event']) ? req.headers['x-gitlab-event'] : '';
        xBbRequestId = (typeof req.headers['x-request-id'] !== 'undefined' && req.headers['x-request-id']) ? req.headers['x-request-id'] : '';

        // Validate headers and events
        if (xUserAgent != "" && xUserAgent.includes('bitbucket') && xBbHookUuid != "") {
            eventProvider = 'bitbucket';
            eventName = (typeof requestBody.pullrequest.type !== 'undefined' && requestBody.pullrequest.type) ? requestBody.pullrequest.type : '';
            eventAction = (typeof req.headers['x-event-key'] !== 'undefined' && req.headers['x-event-key']) ? req.headers['x-event-key'] : '';
            isPREvent = (eventName == 'pullrequest' && _.includes(BB_PR_EVENTS, eventAction)) ? true : false;
        } else if (ghUserAgent != "" && ghUserAgent == "github-hookshot") {
            eventProvider = 'github';
            eventName = (typeof req.headers['x-github-event'] !== 'undefined' && req.headers['x-github-event']) ? req.headers['x-github-event'] : '';
            eventAction = (typeof requestBody.action !== 'undefined') ? requestBody.action : '';
            isPREvent = (eventName == 'pull_request' && _.includes(['opened', 'synchronize', 'closed', 'reopened'], eventAction)) ? true : false;
        } else if (xGlEvent != "" && xGlEvent == "Merge Request Hook") {
            eventProvider = 'gitlab';
            eventName = (typeof requestBody.event_type !== 'undefined') ? requestBody.event_type : '';
            eventAction = (typeof requestBody.event_type !== 'undefined') ? requestBody.event_type : '';
            isPREvent = (eventName == 'merge_request') ? true : false;
            serverType = 'onpremise';
        } else if (xUserAgent != "" && xUserAgent.includes('bitbucket') && xBbRequestId != "") {
            eventProvider = 'bitbucket';
            eventAction = (typeof req.headers['x-event-key'] !== 'undefined' && req.headers['x-event-key']) ? req.headers['x-event-key'] : '';
            eventName == 'pullrequest';
            isPREvent = (_.includes(BB_PR_SERVER_EVENTS, eventAction)) ? true : false;
            serverType = 'onpremise';
        }

        // Payload process
        if (eventProvider == 'bitbucket' && isPREvent && serverType == 'cloud') {
            log.info('Listening to Bitbucket cloud webhook payload', { 'tenantUid': tenantUid });
            prState = (requestBody.pullrequest.state).toLowerCase();
            let payload = {
                "id": requestBody.pullrequest.id,
                "title": requestBody.pullrequest.title,
                "description": requestBody.pullrequest.description,
                "actor": {
                    "displayName": requestBody.actor.display_name,
                    "avatar": requestBody.actor.links.avatar.href
                },
                "createdOn": requestBody.pullrequest.created_on,
                "updatedOn": requestBody.pullrequest.updated_on,
                "sourceBranch": requestBody.pullrequest.source.branch.name,
                "destinationBranch": requestBody.pullrequest.destination.branch.name,
                "destinationCommitId": requestBody.pullrequest.destination.commit.hash,
                "sourceCommitId": requestBody.pullrequest.source.commit.hash,
                "sourceCommitUrl": requestBody.pullrequest.source.commit.links.self.href,
                "repoUrl": requestBody.pullrequest.source.repository.links.self.href,
                "destinationRepoUrl": requestBody.pullrequest.destination.repository.links.self.href,
                "commitUrl": requestBody.pullrequest.links.commits.href,
                "vcType": "bitbucket",
                "prState": prState,
                "fork": false,
                "pullRequestEvent": eventAction,
                "projectId": "",
                "projectNamespace": ""
            };
            req.body.repositoryUrl = requestBody.repository.links.html.href;
            req.body.payload = payload;
            if (_.includes(BB_PR_STATES, prState)) {
                pullRequestService.filterReposByLanguage(req, true);
            }
            res.status(200).json("Received payload");
        } else if (eventProvider == 'bitbucket' && isPREvent && serverType == 'onpremise') {
            log.info('Listening to Bitbucket server webhook payload', { 'tenantUid': tenantUid });
            prState = (requestBody.pullRequest.state).toLowerCase();
            let payload = {
                "id": requestBody.pullRequest.id,
                "title": requestBody.pullRequest.title,
                "description": "",
                "actor": {
                    "displayName": requestBody.actor.displayName,
                    // "avatar": requestBody.actor.links.avatar.href
                },
                "createdOn": new Date(requestBody.pullRequest.createdDate),
                "updatedOn": new Date(requestBody.pullRequest.updatedDate),
                "sourceBranch": requestBody.pullRequest.fromRef.displayId,
                "destinationBranch": requestBody.pullRequest.toRef.displayId,
                "destinationCommitId": requestBody.pullRequest.toRef.latestCommit,
                "sourceCommitId": requestBody.pullRequest.fromRef.latestCommit,

                // "sourceCommitUrl": requestBody.pullrequest.source.commit.links.self.href,
                // "repoUrl": requestBody.pullRequest.source.repository.links.self.href,
                // "destinationRepoUrl": requestBody.pullRequest.destination.repository.links.self.href,
                // "commitUrl": prMetaData.pullRequest.links.self[0].href+'/commits',
                "commitUrl": "",
                "vcType": "bitbucket",
                "prState": prState,
                "fork": false,
                "pullRequestEvent": eventAction,
                "projectId": "",
                "projectNamespace": ""
            };

            let repositoryUrl = requestBody.pullRequest.fromRef.repository.links.clone[1].href;
            // req.body.repositoryUrl = repositoryUrl.replace('.git', '');
            req.body.repositoryUrl = cf.trimStringFromEnd(repositoryUrl, '.git');
            
            req.body.payload = payload;

            if (_.includes(BB_PR_STATES, prState)) {
                pullRequestService.filterReposByLanguage(req, true);
            }
            res.status(200).json("Received payload");
        } else if (eventProvider == 'github' && isPREvent && (serverType == 'cloud' || serverType == 'onpremise')) {
            log.info('Listening to Github webhook payload', { 'tenantUid': tenantUid });
            prState = (requestBody.pull_request.state).toLowerCase();
            // Unknown repository object
            let isUnknownRepo = (typeof requestBody.pull_request.head.repo === 'undefined' || !requestBody.pull_request.head.repo) ? true : false;
            if (!isUnknownRepo) {
                let sourceCommitUrl = requestBody.pull_request.head.repo.commits_url.replace("{/sha}", "/" + requestBody.pull_request.head.sha);
                let payload = {
                    "id": requestBody.pull_request.number,
                    "title": requestBody.pull_request.title,
                    "description": requestBody.pull_request.body,
                    "actor": {
                        "displayName": requestBody.pull_request.user.login,
                        "avatar": requestBody.pull_request.user.avatar_url
                    },
                    "createdOn": requestBody.pull_request.created_at,
                    "updatedOn": requestBody.pull_request.updated_at,
                    "sourceBranch": requestBody.pull_request.head.ref,
                    "destinationBranch": requestBody.pull_request.base.ref,
                    "destinationCommitId": requestBody.pull_request.base.sha,
                    "sourceCommitId": requestBody.pull_request.head.sha,
                    "sourceCommitUrl": sourceCommitUrl,
                    "repoUrl": requestBody.pull_request.head.repo.url,
                    "destinationRepoUrl": requestBody.pull_request.base.repo.url,
                    "commitUrl": requestBody.pull_request.commits_url,
                    "vcType": "github",
                    "prState": prState,
                    "fork": requestBody.pull_request.head.repo.fork,
                    "pullRequestEvent": eventAction,
                    "projectId": "",
                    "projectNamespace": ""
                };
                req.body.repositoryUrl = requestBody.repository.html_url;
                req.body.payload = payload;
                if (_.includes(GH_PR_STATES, prState)) {
                    pullRequestService.filterReposByLanguage(req, true);
                }
            } else {
                log.info('Unknown repository for pull request id: ' + requestBody.pull_request.number, { 'tenantUid': tenantUid });
            }
            res.status(200).json("Received payload");
        } else if (eventProvider == 'gitlab' && isPREvent) {
            log.info('Listening to Gitlab webhook payload for repository: ' + requestBody.project.web_url, { 'tenantUid': tenantUid });
            objectAttributes = (typeof requestBody.object_attributes !== 'undefined') ? requestBody.object_attributes : null;
            if (objectAttributes) {
                prState = (objectAttributes.state).toLowerCase();
                let isForked = (objectAttributes.source_project_id != objectAttributes.target_project_id) ? true : false;
                let payload = {
                    "id": objectAttributes.iid,
                    "title": objectAttributes.title,
                    "description": objectAttributes.description,
                    "actor": {
                        "displayName": requestBody.user.name,
                        "avatar": requestBody.user.avatar_url
                    },
                    "createdOn": objectAttributes.created_at,
                    "updatedOn": objectAttributes.updated_at,
                    "sourceBranch": objectAttributes.source_branch,
                    "destinationBranch": objectAttributes.target_branch,
                    "destinationCommitId": objectAttributes.merge_commit_sha,
                    "sourceCommitId": objectAttributes.last_commit.id,
                    "sourceCommitUrl": '',
                    "repoUrl": requestBody.project.web_url,
                    "destinationRepoUrl": '',
                    "commitUrl": (typeof objectAttributes.url !== 'undefined') ? `${objectAttributes.url}/commits` : '',
                    "vcType": "gitlab",
                    "prState": prState,
                    "fork": isForked,
                    "pullRequestEvent": eventAction,
                    "projectId": (typeof requestBody.project !== 'undefined') ? requestBody.project.id : '',
                    "projectNamespace": (typeof requestBody.project !== 'undefined') ? encodeURIComponent(requestBody.project.path_with_namespace) : ''
                };
                req.body.repositoryUrl = requestBody.project.web_url;
                req.body.payload = payload;
                if (_.includes(GL_PR_STATES, prState)) {
                    pullRequestService.filterReposByLanguage(req, true);
                }
            }
            res.status(200).json("Received payload");
        } else {
            log.info('Did not listen to the event = ' + eventName + ' action : ' + eventAction, { 'tenantUid': tenantUid });
            return next(new errors.Forbidden(null, 1007));
        }
    }
    else {
        let repoUrl = req.body.repository.links.html.href;
        log.info('Pull request not enabled for repo: ' + repoUrl, { 'tenantUid': tenantUid });
    }
}

export function processWebhook(repositoryUid, tenantId, poll = false, tenantUid = '') {
    return new Promise((resolve, reject) => {
        let sqlQuery = `select subs.subsystem_id, subs.subsystem_repository_url, subs.pr_enable, subs.subsystem_repository_user_name, subs.url_type,
                        subs.subsystem_repository_password, subs.master_repository_id,-- mrd.user_name, mrd.password,
                        CASE subs.master_repository_id WHEN 0 THEN subs.subsystem_repository_user_name
                                ELSE mrd.user_name
                        END as user_name,
                        CASE subs.master_repository_id WHEN 0 THEN subs.subsystem_repository_password
                                ELSE mrd.password
                        END as password,
                        mrd.master_repository_type_id, mrd.master_repository_url,
                        CASE subs.master_repository_id WHEN 0 THEN subs.additional_details
                            ELSE mrd.additional_details
                        END as additional_details,
                        subs.subsystem_repository_additional_info->'project_id' as project_id,
                        mrt.type_name, t.public_url from subsystems subs
                        LEFT JOIN master_repository_details mrd on mrd.id=subs.master_repository_id
                        LEFT JOIN tenant as t ON(subs.tenant_id = t.id)
                        LEFT JOIN master_repository_types mrt on (subs.subsystem_repository_type = mrt.id)
                        WHERE subs.subsystem_uid = $1`;
        db.gammaDbPool.query(sqlQuery, [repositoryUid])
            .then(subsystemResult => {
                let repoUrl = subsystemResult[0].subsystem_repository_url;
                let username = subsystemResult[0].subsystem_repository_user_name;
                let password = subsystemResult[0].subsystem_repository_password;
                let subsystemId = subsystemResult[0].subsystem_id;
                // use ngrok url for onpremise pulic url and for cloud user public embold url i.e portal.embold.io
                let publicUrl = (gammaConfig.is_cloud === false || gammaConfig.enablePRScan === "false") ? subsystemResult[0].public_url : process.env.WEBHOOK_BASE_URL;
                let repoType = (subsystemResult[0].type_name) ? subsystemResult[0].type_name.toLowerCase() : '';
                let urlType = (subsystemResult[0].url_type) ? subsystemResult[0].url_type.toLowerCase() : '';
                let serverType = (subsystemResult[0].additional_details) ? subsystemResult[0].additional_details.account_type : '';
                // Required for gitlab only
                let projectId = (_.isUndefined(subsystemResult[0].project_id) || _.isNull(subsystemResult[0].project_id)) ? '' : subsystemResult[0].project_id;
                // Parse url
                let repositoryData = subsystemResult[0];
                let repoMeta = pullRequestService.getRepositoryProvider(repositoryData, serverType);
                let isVcSupport = (repoMeta.isVcSupport) ? repoMeta.isVcSupport : '';
                let isGitSupport = (repoMeta.isGitSupport) ? repoMeta.isGitSupport : '';

                let hookMeta = {
                    webhook_id: '',
                    project_id: projectId,
                    repo_type: repoType,
                    username: username,
                    password: password,
                    public_url: publicUrl,
                    repo_url: repoUrl,
                    is_vc_support: _.isUndefined(repoMeta.isVcSupport) ? '' : repoMeta.isVcSupport,
                    repo_slug: _.isUndefined(repoMeta.repoSlug) ? '' : repoMeta.repoSlug,
                    repo_owner: _.isUndefined(repoMeta.repoOwner) ? '' : repoMeta.repoOwner,
                    repo_username: _.isUndefined(repoMeta.username) ? '' : repoMeta.username,
                    repo_password: _.isUndefined(repoMeta.password) ? '' : repoMeta.password,
                    base_url: _.isUndefined(repoMeta.baseUrl) ? '' : repoMeta.baseUrl, // use for gitlab only onprem
                    repoUrlType: _.isUndefined(repoMeta.repoType) ? '' : repoMeta.repoType,
                    serverType,
                    tenantUid
                }
                let repositoryUrlType = getRepoUrlType(repoMeta, repoType, repoMeta.providerName);
                // db check for github and bitbucket url
                dbCheckHookUrlExist(tenantId, repoUrl)
                    .then(data => {
                        if (data.length > 0) {
                            // get existing webhook details
                            if (poll) {
                                // hook exist in db and in version control add create webhook subsystem
                                //pullRequestService.createWebhookSubsystem(data[0].id, subsystemId, true);
                                resolve(true);
                            } else {
                                if (publicUrl !== null && publicUrl !== "") {
                                    hookMeta.webhook_id = (_.isUndefined(data[0].webhook_id) || _.isNull(data[0].webhook_id)) ? '' : data[0].webhook_id;
                                    // get webhook details depending upon type
                                    pullRequestInterfaceController.setRepoProviderContext(repositoryUrlType, serverType).getWebhookDetails(hookMeta)
                                        .then(webhookResponse => {
                                            webhookResponse = (!_.isNull(webhookResponse) && !_.isUndefined(webhookResponse)) ? JSON.parse(webhookResponse) : '';
                                            if (webhookResponse !== '' && (webhookResponse.type == 'error' || webhookResponse.message === "Not Found")) {
                                                hookMeta.webhook_id = '';
                                                // hook exist in db but error in retriving from version control
                                                if (isVcSupport || isGitSupport) {
                                                    pullRequestInterfaceController.setRepoProviderContext(repositoryUrlType, serverType).createWebhook(hookMeta)
                                                        .then(response => {
                                                            if (response.type === 'error') {
                                                                let webhookStatus = { active: false, webhook_message: response.error.message };
                                                                updateDbWebhook(tenantId, data[0].id, hookMeta.webhook_id, subsystemId, webhookStatus);
                                                                log.info('Webhook created successfully', { 'tenantUid': tenantUid });
                                                                resolve(data[0].id);
                                                            } else {
                                                                let webhookId = _.isUndefined(response.uuid) ? response.id : response.uuid.replace(/[{}]/g, "");
                                                                let webhookStatus = { active: response.active };
                                                                updateDbWebhook(tenantId, data[0].id, webhookId, subsystemId, webhookStatus);
                                                                log.info('Updated already existing webhook in database successfully for ' + repoType.toLowerCase(), { 'tenantUid': tenantUid });
                                                                resolve(data[0].id);
                                                            }
                                                        })
                                                        .catch(err => {
                                                            log.error("Error in fetching " + repoType.toLowerCase() + "webhook from version control", { 'tenantUid': tenantUid });
                                                            log.error(JSON.stringify(err), { 'tenantUid': tenantUid });
                                                            resolve(hookMeta.webhook.id);
                                                        });
                                                }
                                            } else {
                                                // hook exist in db and in version control add create webhook subsystem
                                                //pullRequestService.createWebhookSubsystem(data[0].id, subsystemId, true);
                                                log.trace("webhook exists in db, version control add create webhook subsystem", { 'tenantUid': tenantUid });
                                                resolve(true);
                                            }
                                        });
                                } else {
                                    let error = 'Public URL does not exist';
                                    log.error(error, { 'tenantUid': tenantUid });
                                    reject(error);
                                }
                            }
                        } else {
                            // create new webhook for onpremise polling request
                            if (poll && (isVcSupport || isGitSupport)) {
                                let webhookStatus = { active: false };
                                createDbWebhook(tenantId, repoUrl, webhookStatus, null, subsystemId);
                                resolve(true);
                            } else {
                                if (publicUrl !== null && publicUrl !== "") {
                                    // create new webhook for cloud

                                    if (isVcSupport || isGitSupport) {
                                        pullRequestInterfaceController.setRepoProviderContext(repositoryUrlType, serverType).createWebhook(hookMeta)
                                            .then(response => {
                                                if (response.type === 'error') {
                                                    let webhookStatus = { active: false, webhook_message: response.error.message };
                                                    createDbWebhook(tenantId, repoUrl, webhookStatus, null, subsystemId)
                                                        .then(data => {
                                                            resolve(data[0].id);
                                                        });
                                                } else {
                                                    let webhookId = _.isUndefined(response.uuid) ? response.id : response.uuid.replace(/[{}]/g, "");
                                                    let webhookStatus = { active: response.active };
                                                    createDbWebhook(tenantId, repoUrl, webhookStatus, webhookId, subsystemId)
                                                        .then(data => {
                                                            log.info('Webhook created successfully', { 'tenantUid': tenantUid });
                                                            resolve(data[0].id);
                                                        });
                                                }
                                            })
                                            .catch(err => {
                                                log.error(`Error in creating ${repoType} webhook with url: ${repoUrl} for tenant_id: ${tenantId} with error: ${JSON.stringify(err)}`, { 'tenantUid': tenantUid });
                                                reject(false);
                                            });
                                    }
                                } else {
                                    log.error("Public URL does not exist", { 'tenantUid': tenantUid });
                                    reject(false);
                                }
                            }
                        }
                    }).catch(err => {
                        log.error("No Webhooks data found in db for repository: " + repoUrl + "Error : " + err, { 'tenantUid': tenantUid });
                        reject(false);
                    });
                // end webhook code
            });
    });
}

export function processUpdateWebhook(tenantId, tenantUid) {
    return new Promise((resolve, reject) => {
        let sqlQuery = `select subs.subsystem_id,subs.subsystem_uid, subs.url_type,subs.tenant_id, subs.subsystem_repository_url,
        subs.pr_enable, subs.subsystem_repository_user_name,
        subs.subsystem_repository_password, subs.master_repository_id, --mrd.user_name, mrd.password,
         CASE subs.master_repository_id WHEN 0 THEN subs.subsystem_repository_user_name
                ELSE mrd.user_name
        END as user_name,
        CASE subs.master_repository_id WHEN 0 THEN subs.subsystem_repository_password
                ELSE mrd.password
        END as password,
        mrd.master_repository_type_id, mrd.master_repository_url, --mrd.additional_details,
        CASE subs.master_repository_id WHEN 0 THEN subs.additional_details
            ELSE mrd.additional_details
        END as additional_details,
        subs.subsystem_repository_additional_info->'project_id' as project_id,
        mrt.type_name,wh.id, wh.webhook_id, t.public_url from subsystems as subs
        LEFT JOIN master_repository_details mrd on mrd.id=subs.master_repository_id
        LEFT JOIN tenant as t on (subs.tenant_id = t.id)
        LEFT JOIN master_repository_types mrt on (subs.subsystem_repository_type = mrt.id)
        LEFT JOIN webhooks wh ON (subs.subsystem_repository_url = wh.repository_url)
        where subs.pr_enable = true AND subs.tenant_id = $1`;

        db.gammaDbPool.query(sqlQuery, [tenantId])
            .then(subsystemResult => {
                // Loop subsystems
                async.eachSeries(subsystemResult, function (subsystem, callback) {
                    if (subsystem.id === null) {
                        processWebhook(subsystem.subsystem_uid, subsystem.tenant_id)
                            .then(repoDetails => {
                                resolve(true);
                                callback();
                            })
                            .catch(error => {
                                log.error('Error while updating public URL for repoUid: ' + subsystem.subsystem_uid, { 'tenantUid': tenantUid });
                                log.error(JSON.stringify(error), { 'tenantUid': tenantUid });
                                reject(false);
                                callback();
                            });
                    } else {
                        // Update webhook url only
                        let repoUrl = subsystem.subsystem_repository_url;
                        let username = subsystem.subsystem_repository_user_name;
                        let password = subsystem.subsystem_repository_password;
                        let webhookId = (_.isUndefined(subsystem.webhook_id) || _.isNull(subsystem.webhook_id)) ? '' : subsystem.webhook_id;
                        let hookId = subsystem.id;
                        let subsystemId = subsystem.subsystem_id;
                        // use ngrok url for onpremise pulic url and for cloud user public embold url i.e portal.embold.io
                        let publicUrl = (gammaConfig.is_cloud === false || gammaConfig.enablePRScan === "false") ? subsystem.public_url : process.env.WEBHOOK_BASE_URL;
                        let repoType = (subsystem.type_name) ? subsystem.type_name.toLowerCase() : '';
                        let urlType = (subsystem.url_type) ? subsystem.url_type.toLowerCase() : '';
                        let serverType = (subsystem.additional_details) ? subsystem.additional_details.account_type : '';
                        // Required for gitlab only
                        let projectId = (_.isUndefined(subsystem.project_id) || _.isNull(subsystem.project_id)) ? '' : subsystem.project_id;
                        // Parse url
                        let repoMeta = pullRequestService.getRepositoryProvider(subsystem, serverType);

                        let hookMeta = {
                            webhook_id: webhookId,
                            project_id: projectId,
                            repo_type: repoType,
                            username: username,
                            password: password,
                            public_url: publicUrl,
                            repo_url: repoUrl,
                            is_vc_support: _.isUndefined(repoMeta.isVcSupport) ? '' : repoMeta.isVcSupport,
                            repo_slug: _.isUndefined(repoMeta.repoSlug) ? '' : repoMeta.repoSlug,
                            repo_owner: _.isUndefined(repoMeta.repoOwner) ? '' : repoMeta.repoOwner,
                            repo_username: _.isUndefined(repoMeta.username) ? '' : repoMeta.username,
                            repo_password: _.isUndefined(repoMeta.password) ? '' : repoMeta.password,
                            repoUrlType: _.isUndefined(repoMeta.repoType) ? '' : repoMeta.repoType,
                            serverType,
                            tenantUid,
                            base_url: _.isUndefined(repoMeta.baseUrl) ? '' : repoMeta.baseUrl, // use for gitlab only onprem
                        };
                        let repositoryUrlType = getRepoUrlType(repoMeta, repoType, repoMeta.providerName);
                        // create webhook or update webhook with with specific context like github/bitbucket/gitlab
                        pullRequestInterfaceController.setRepoProviderContext(repositoryUrlType, serverType).createWebhook(hookMeta)
                            .then(response => {
                                if (response.type === 'error' || !_.isUndefined(response.error)) {
                                    log.trace("Error response got while updating webhook", { 'tenantUid': tenantUid });
                                    let message = _.isUndefined(response.error.message) ? (_.isUndefined(response.message) ? '' : response.message) : response.error.message;
                                    let webhookStatus = {
                                        active: false,
                                        webhook_message: message
                                    };
                                    updateDbWebhook(tenantId, hookId, webhookId, subsystemId, webhookStatus);
                                    resolve(true);
                                    callback();
                                } else {
                                    let webhookId = _.isUndefined(response.uuid) ? response.id : response.uuid.replace(/[{}]/g, "");
                                    let status = _.isUndefined(response.active) ? false : response.active;
                                    let webhookStatus = {
                                        active: status
                                    };
                                    updateDbWebhook(tenantId, hookId, webhookId, subsystemId, webhookStatus);
                                    resolve(true);
                                    callback();
                                }
                            })
                            .catch(err => {
                                log.error(`Error in updating ${repoType} webhook with url: ${repoUrl} for tenant_id: ${tenantId} with error: ${JSON.stringify(err)}`, { 'tenantUid': tenantUid });
                                reject(false);
                            });
                    }
                }, function (err) {
                    if (err) {
                        log.error("Error occurred in updating public URL", { 'tenantUid': tenantUid });
                        log.error(err);
                    }
                    log.info('Public url updated for all webhooks successfully', { 'tenantUid': tenantUid });
                });
            });
    });
}

function dbCheckHookUrlExist(tenantId, repoUrl) {
    let sqlQuery = `select id, webhook_id from webhooks where lower(repository_url) = $1 AND tenant_id = $2`;
    return db.gammaDbPool.query(sqlQuery, [repoUrl.toLowerCase(), tenantId])
        .then(result => {
            return result;
        });
}

export function updateDbWebhook(tenantId, id, webhookId, webhookStatus) {
    let metadata = "metadata";
    _.forEach(webhookStatus, (value, key) => {
        metadata = 'jsonb_set(' + metadata + '::jsonb, \'{' + key + '}\',\'\"' + value + '\"\'::jsonb)';
    });

    let sqlQuery = `update webhooks set webhook_id = $1 , metadata = ${metadata} where id = $2 AND tenant_id = $3 `;
    return db.gammaDbPool.query(sqlQuery, [webhookId, id, tenantId])
        .then(result => {
            return result;
        });
}

export function createDbWebhook(tenantId, repoUrl, status, webhookid, subsystemId) {
    let webhookStatusValue = status;
    let sqlQuery = `insert into webhooks(repository_url,tenant_id,metadata,webhook_id) values($1,$2,$3,$4) ON CONFLICT DO NOTHING returning id`;
    return db.gammaDbPool.query(sqlQuery, [repoUrl, tenantId, webhookStatusValue, webhookid])
        .then(result => {
            //return createWebhookSubsystem(result[0].id, subsystemId, true);
            return result;
        });
}

export function getSingleHook(url, token, userAgent) {
    return new Promise((resolve, reject) => {
        let headerData = {
            "content-type": "application/json",
            "Authorization": token
        };
        if (typeof userAgent != 'undefined' && userAgent != undefined) {
            headerData['User-Agent'] = userAgent;
        }
        request({
            url: url,
            method: 'GET',
            headers: headerData,
            rejectUnauthorized: false
        }, function (error, response, body) {
            if (body != "" && typeof body != 'undefined') {
                resolve(body);
            } else {
                reject(error);
            }
        });
    });
}

function getRepoUrlType(repoMeta, repoType, urlType) {
    let repositoryUrltype;
    if ((repoMeta.isVcSupport && repoType == 'github') || (repoMeta.isGitSupport && urlType == 'github')) {
        repositoryUrltype = 'github';
    } else if ((repoMeta.isVcSupport && repoType == 'bitbucket') || (repoMeta.isGitSupport && urlType == 'bitbucket')) {
        repositoryUrltype = 'bitbucket';
    } else if ((repoMeta.isVcSupport && repoType == 'gitlab') || (repoMeta.isGitSupport && urlType == 'gitlab')) {
        repositoryUrltype = 'gitlab';
    }
    return repositoryUrltype;
}
