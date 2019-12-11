import * as log from './../../../logs/logger';
import request from 'request';
import * as db from './../../../component/db';
import * as gammaConfig from './../../../core/config';
import * as cf from './../../../utils/common-functions';
import async from 'async';
import * as gamma from './../../../core/gamma';
import _ from 'lodash';
import * as pullRequestInterfaceController from './pullRequestInterface.controller';
import { pickRepoFromPRQueue, forceFailPRScanRequest } from './scan.controller';
import { URL } from 'url';
import { abortScan } from '../../../services/scan';

const errors = require('throw.js');
const LANGUAGE_EXT_URL = `${gammaConfig.analysisDBDetails.analysisHost}rest/gws/languageExtentions`;
const GIT_CLOUD_PROVIDER = ['bitbucket', 'github', 'gitlab'];
const CPP_NON_HEADER_EXTENSIONS = ['cc', 'ii', 'cpp', 'cxx', 'c++', 'c', 'C', 'i'];
const PR_ABORT_REPO_URL = `${gammaConfig.analysisDBDetails.analysisHost}rest/gws/abortReviewRequest`;

export function filterReposByLanguage(req, isWebhook = false) {
    return new Promise((resolve, reject) => {
        let tenantUid = (req.session) ? req.session.tenant_uid : '';
        getReposForPR(req.body.repositoryUrl)
            .then(PRrepositories => {
                processPayload(req, PRrepositories, isWebhook)
                    .then((reviewRequestDetails) => {
                        if (PRrepositories.length && reviewRequestDetails) {
                            // Sync loop
                            let groupId = cf.generateMD5(reviewRequestDetails.id + '_' + new Date().getTime());
                            async.forEachSeries(PRrepositories, function (PRrepository, callback) {
                                processQueue(reviewRequestDetails, PRrepository, groupId, tenantUid)
                                    .then(() => {
                                        callback();
                                    })
                                    .catch(error => {
                                        log.error("Error while processing review request queue", {'tenantUid': tenantUid});
                                        log.error(error, {'tenantUid': tenantUid});
                                    });
                            },
                                function (err) {
                                    if (err) {
                                        return err;
                                    }
                                    resolve();
                                    if (isWebhook) {
                                        req.session = {};
                                        req.session.tenant_id = PRrepositories[0].tenant_id;
                                        pickRepoFromPRQueue(req);
                                    }

                                });
                        }
                        else {
                            log.info("No Embold repositories found for RepoURL: "+req.body.repositoryUrl, {'tenantUid': tenantUid});
                            resolve();
                        }
                    })
                    .catch(error => {
                        log.error("Error in processing payload data", {'tenantUid': tenantUid});
                        log.error(error, {'tenantUid': tenantUid});
                        resolve();
                    });
            })
            .catch(error => {
                log.error("Error while fetching Embold repositories for RepoURL : "+ req.body.repositoryUrl, {'tenantUid': tenantUid});
                log.error(error, {'tenantUid': tenantUid});
                resolve();
            });
    });
}

export function getReposForPR(url, uniqueLangRepos) {
    let cloneUrl = url + '.git';
    return new Promise((resolve, reject) => {
        let sqlQuery = `select s.subsystem_repository_url, s.subsystem_id as repository_id,s.subsystem_uid as repository_uid ,
                        s.tenant_id , s.subsystem_language_array as language, s.pr_enable,
                        mr.user_name, mr.password, t.tenant_uid, s.master_repository_id, s.url_type, s.subsystem_repository_user_name,
                        s.subsystem_repository_password,
                        CASE s.master_repository_id WHEN 0 THEN s.subsystem_repository_user_name
                            ELSE mr.user_name
                        END as user_name,
                        CASE s.master_repository_id WHEN 0 THEN s.subsystem_repository_password
                            ELSE mr.password
                        END as password,
                        mr.master_repository_type_id, 	mr.master_repository_url, mrt.type_name, --mr.additional_details
                        CASE s.master_repository_id WHEN 0 THEN s.additional_details
                            ELSE mr.additional_details
                        END as additional_details
                        from  subsystems s left join master_repository_details mr on mr.id=s.master_repository_id
                        left join tenant t on s.tenant_id=t.id
                        left join master_repository_types mrt on mrt.id=s.subsystem_repository_type
                        where (s.subsystem_repository_url = $1) and s.pr_enable = true and s.has_snapshot = true`;

        let uniqueRepoQuery = `with x as (select max(s.subsystem_id) as data_id, subsystem_language_array from subsystems s
                            where  (s.subsystem_repository_url) = $1 and s.pr_enable = true
                            group by s.subsystem_language_array)
                            select s.subsystem_repository_url, s.subsystem_id as repository_id,
                            s.subsystem_uid as repository_uid ,
                            s.tenant_id , s.subsystem_language_array as language, s.pr_enable,
                            CASE s.master_repository_id WHEN 0 THEN s.subsystem_repository_user_name
                                ELSE mr.user_name
                            END as user_name,
                            CASE s.master_repository_id WHEN 0 THEN s.subsystem_repository_password
                                ELSE mr.password
                            END as password,
                            t.tenant_uid, s.master_repository_id, s.url_type,
                            s.subsystem_repository_user_name,
                            s.subsystem_repository_password, mr.user_name, mr.password, mr.master_repository_type_id, mr.master_repository_url,
                            mrt.type_name,
                            CASE s.master_repository_id WHEN 0 THEN s.additional_details
                                ELSE mr.additional_details
                            END as additional_details
                            from  subsystems s
                            left join master_repository_details mr on mr.id=s.master_repository_id
                            left join tenant t on s.tenant_id=t.id
                            left join master_repository_types mrt on mrt.id=s.subsystem_repository_type
                            right join x on s.subsystem_id = x.data_id
                            where ((s.subsystem_repository_url = $1)
                            and s.pr_enable = true and s.has_snapshot = true) `;

        let gammaQuery;
        if (uniqueLangRepos == true) {
            gammaQuery = uniqueRepoQuery;
        }
        else {
            gammaQuery = sqlQuery;
        }
        return db.gammaDbPool.query(gammaQuery, [url /*.toLowerCase()*/])
            .then(data => {
                // Loop
                let filteredData = [];
                async.each(data, function (value, callback) {
                    filteredData.push(value);
                    callback();
                }, function (err) {
                    if (err) {
                        log.error(JSON.stringify(err));
                    } else {
                        resolve(filteredData);
                    }
                });
            });
    });
}

export function getSnapshotsCount(tenantUid, subsystemUid) {
    return db.getCoronaDBSubdomainPool(tenantUid)
        .then(dbpool => {
            try {
                sqlQuery = `select count(sn.id) from snapshots sn inner join subsystems ss
                    on ss.id=sn.subsystem_id
                    and ss.subsystem_uid=$1
                    and (sn.status = 'P' or sn.status = 'K')
                    and sn.analysis_mode <> 'R'`;
                return dbpool.query(sqlQuery, [subsystemUid])
                    .then(result => {
                        return result;
                    });
            } catch (error) {
                log.error(JSON.stringify(error), {'tenantUid': tenantUid});
                return error;
            }
        });
}

function processPayload(req, repoDetails, isWebhook) {
    let url, payload, prID, repoMeta, providerName, queryParams, tenantUid;
    return new Promise((resolve, reject) => {
        url = req.body.repositoryUrl;
        tenantUid = (req.session) ? req.session.tenant_uid : '';
        if (typeof repoDetails !== 'undefined' && repoDetails.length && repoDetails[0].pr_enable && (gammaConfig.enablePRScan === true || gammaConfig.enablePRScan === "true")) {
            // Payload data
            payload = req.body.payload;
            getServerType = (repoDetails[0].additional_details) ? repoDetails[0].additional_details.account_type : '';
            // Get repository provider meta data
            repoMeta = getRepositoryProvider(repoDetails[0], getServerType);
            providerName = (typeof repoMeta.providerName !== 'undefined') ? repoMeta.providerName.toLowerCase() : '';
            // Fetch PR ID from payload w.r.t providers
            if (_.includes(['bitbucket'], repoMeta.providerName)) { prID = payload.id; }
            if (_.includes(['github'], repoMeta.providerName)) { prID = payload.number; }
            if (_.includes(['gitlab'], repoMeta.providerName)) { prID = payload.iid; }
            repoMeta.serverType = getServerType;
            //Payload Meta
            let payloadMetaData = {
                repoMeta,
                repoUrl: url,
                isVcSupport: (typeof repoMeta.isVcSupport !== 'undefined') ? repoMeta.isVcSupport : '',
                isGitSupport: (typeof repoMeta.isGitSupport !== 'undefined') ? repoMeta.isGitSupport : '',
                repoProvider: providerName,
                repoType: (typeof repoMeta.repoType !== 'undefined') ? repoMeta.repoType : '',
                repoSlug: (typeof repoMeta.repoSlug !== 'undefined') ? repoMeta.repoSlug : '',
                repoUser: (typeof repoMeta.username !== 'undefined') ? repoMeta.username : '',
                repoPass: (typeof repoMeta.password !== 'undefined') ? repoMeta.password : '',
                repoOwner: (typeof repoMeta.repoOwner !== 'undefined') ? repoMeta.repoOwner : '',
                baseUrl: (typeof repoMeta.baseUrl !== 'undefined') ? repoMeta.baseUrl : '',
                headerData: { "content-type": "application/json" },
                req,
                repoDetails,
                isWebhook,
                url,
                payload,
                prID,
                queryParams,
                tenantUid
            }
            //payload.baseUrl = payloadMetaData.baseUrl;
            pullRequestInterfaceController.setRepoProviderContext(payloadMetaData.repoProvider, repoMeta.serverType).getProcessPayload(payloadMetaData);
            // Process supported provider only ie vc, git or bitbucket and ignore gitlab etc
            if (payloadMetaData.isVcSupport || payloadMetaData.isGitSupport) {
                let reviewRequestDetails = {
                    "commits": 0,
                    "filesAdded": 0,
                    "filesRemoved": 0,
                    "filesChanged": 0,
                    "newFileList": [],
                    "oldFileList": []
                };
                if (!(payload.fork)) {
                    Promise.all([getCommitData(payload.commitUrl, payloadMetaData.headerData, payloadMetaData.repoProvider, 0, payloadMetaData.prID, payloadMetaData.queryParams, false, repoMeta.serverType, payloadMetaData.tenantUid), getFileData(payloadMetaData.fileDataUrl, payload, payloadMetaData.headerData, payloadMetaData.repoProvider, 0, 0, 0, payloadMetaData.queryParams, false, [], [], repoMeta.serverType, tenantUid)])
                        .then(values => {
                            log.trace("Files and commits data found for repoURL: "+ url, {'tenantUid': tenantUid});
                            // For bitbucket pick commits count from commits data, for others from files data
                            reviewRequestDetails = {
                                "commits": (_.includes(['bitbucket'], payloadMetaData.repoProvider)) ? values[0].noOfCommits : values[1].noOfCommits,
                                "filesAdded": values[1].filesAdded,
                                "filesRemoved": values[1].filesRemoved,
                                "filesChanged": values[1].filesChanged,
                                "newFileList": values[1].newFileList,
                                "oldFileList": values[1].oldFileList
                            };
                            // Insert in case of file data found
                            Object.assign(reviewRequestDetails, payload);
                            return insertReviewRequest(reviewRequestDetails, url, isWebhook)
                                .then(reviewRequest => {
                                    reviewRequestDetails.dbId = reviewRequest[0].id;
                                    reviewRequestDetails.fork = false;
                                    resolve(reviewRequestDetails);
                                })
                                .catch(error => {
                                    log.error("Cannot insert into review request for RepoURL: " + url, {'tenantUid': tenantUid});
                                    log.error(error, {'tenantUid': tenantUid});
                                    resolve(reviewRequestDetails);
                                });
                        })
                        .catch(error => {
                            log.error("Couldn't get commits and files data for repoURL: "+ url, {'tenantUid': tenantUid});
                            let errorLog = new errors.InternalServerError(error.message, 1018);
                            log.error(errorLog, {'tenantUid': tenantUid});
                            // Insert in case of no file data found
                            Object.assign(reviewRequestDetails, payload);
                            return insertReviewRequest(reviewRequestDetails, url, isWebhook)
                                .then(reviewRequest => {
                                    reviewRequestDetails.dbId = reviewRequest[0].id;
                                    reviewRequestDetails.fork = false;
                                    resolve(reviewRequestDetails);
                                })
                                .catch(err => {
                                    log.error("Cannot insert into review request for RepoURL: " + url, {'tenantUid': tenantUid});
                                    log.error(err, {'tenantUid': tenantUid});
                                    resolve(reviewRequestDetails);
                                });
                        });
                } else {
                    // Insert in case of forked pr
                    Object.assign(reviewRequestDetails, payload);
                    return insertReviewRequest(reviewRequestDetails, url, isWebhook)
                        .then(reviewRequest => {
                            reviewRequestDetails.dbId = reviewRequest[0].id;
                            reviewRequestDetails.fork = true;
                            resolve(reviewRequestDetails);
                        })
                        .catch(error => {
                            log.error("Cannot insert into review request for forked repos with repoURL: "+ url, {'tenantUid': tenantUid});
                            log.error(error, {'tenantUid': tenantUid});
                            resolve(reviewRequestDetails);
                        });
                }
            }
        } else {
            log.info("No repositories found to process payload for RepoURL: " + url , {'tenantUid': tenantUid});
            resolve();
        }
    });
}

function insertReviewRequest(reviewRequestDetails, url, isWebhook) {
    let cloneUrl = url + '.git';
    let updateStr = `primary_data = $3`;
    if (isWebhook) {
        updateStr = `primary_data = $3, listened_on=now()`;
    }
    let sqlQuery = `insert into review_requests (review_request_id, webhook_id,primary_data, listened_on) values
                    ($1, (select id from webhooks where (repository_url = $2)), $3, now())
                    ON CONFLICT ON CONSTRAINT review_request_repository
                    do update set ${updateStr} returning id `;
    return db.gammaDbPool.query(sqlQuery, [reviewRequestDetails.id, url, reviewRequestDetails])
        .then(reviewRequest => {
            return reviewRequest;
        });
}

function processQueue(reviewRequestDetails, repoDetails, groupId, tenantUid) {
    return new Promise((resolve, reject) => {
        if (reviewRequestDetails.fork) {
            repoDetails.queueStatus = 'FORK';
            return insertReviewRequestQueue(groupId, repoDetails.tenant_id, reviewRequestDetails.dbId, repoDetails, reviewRequestDetails.sourceCommitId, reviewRequestDetails.destinationCommitId, reviewRequestDetails.updatedOn, false)
                .then(() => {
                    resolve();
                })
                .catch(error => {
                    log.debug("Cannot insert into review request queue for forked repo", {'tenantUid': tenantUid});
                    log.error(error, {'tenantUid': tenantUid});
                    reject();
                });
        } else {
            let langArray = _.map(reviewRequestDetails.newFileList, d => {
                return _.last(d.split('.'));
            });
            langArray = _.uniq(langArray);
            let repositoryLanguages = repoDetails.language;
            return getValidLanguageExtensions(repositoryLanguages, tenantUid)
                .then(languageExtensions => {
                    languageExtensions = JSON.parse(languageExtensions);
                    //check list of valid repositories to send scan request => checking extension list (committed files) against allowed extensions in embold
                    let reviewRequestLanguages = [];
                    _.forEach(languageExtensions, (value, key) => {
                        let intersection = _.intersection(value, langArray);
                        if (intersection.length > 0) {
                            reviewRequestLanguages.push(key);
                        }
                    });
                    let intersection = _.intersection(repositoryLanguages, reviewRequestLanguages);
                    if (intersection.length > 0) {
                        if (repositoryLanguages.indexOf('CPP') > -1 || repositoryLanguages.indexOf('C') > -1) {
                            let extIntersection = _.intersection(CPP_NON_HEADER_EXTENSIONS, langArray);
                            if (extIntersection.length > 0) {
                                repoDetails.queueStatus = 'QUEUED';
                            } else {
                                repoDetails.queueStatus = 'NO_FILES';
                            }
                        } else {
                            repoDetails.queueStatus = 'QUEUED';
                        }
                    } else {
                        repoDetails.queueStatus = 'NO_FILES';
                    }

                    return insertReviewRequestQueue(groupId, repoDetails.tenant_id, reviewRequestDetails.dbId, repoDetails, reviewRequestDetails.sourceCommitId, reviewRequestDetails.destinationCommitId, reviewRequestDetails.updatedOn, false)
                        .then(() => {
                            resolve();
                        })
                        .catch(error => {
                            log.debug("Cannot insert into review request queue", {'tenantUid': tenantUid});
                            log.error(error, {'tenantUid': tenantUid});
                            reject();
                        });
                });
        }
    });
}

export function insertReviewRequestQueue(groupId, tenantId, reviewRequestId, reviewRequestRepository, sourceCommitId, destinationCommitId, updatedOn, isManual) {
    return new Promise((resolve, reject) => {
        let repositoryUid = reviewRequestRepository.repository_uid;
        let queueStatus = reviewRequestRepository.queueStatus;
        //let groupId = cf.generateMD5(tenantId + '_' + new Date().getTime());
        let sessionId = cf.generateMD5(tenantId + '_' + repositoryUid + '_' + new Date().getTime());
        let sqlQuery = `select id, source_commit_id, destination_commit_id, status from review_request_queue
                            where review_request_id= $1 and repository_uid = $2 order by id desc limit 1`;
        db.gammaDbPool.query(sqlQuery, [reviewRequestId, repositoryUid])
            .then((queueData) => {
                if (queueData.length) {
                    if (((queueData[0].source_commit_id != sourceCommitId || queueData[0].destination_commit_id != destinationCommitId) &&
                        queueData[0].status != 'QUEUED' && queueData[0].status != 'NO_FILES' && queueData[0].status != 'FORK') ||
                        ((queueData[0].status == 'FAIL' || queueData[0].status == 'ABORT' || queueData[0].status == 'CANCEL') && isManual)) {
                        sqlQuery = `insert into review_request_queue(review_request_id, repository_uid, status, group_id, session_id, source_commit_id, destination_commit_id, updated_on, created_on)
                                    values($1, $2, $3, $4, $5, $6, $7, now(), now())`;
                        db.gammaDbPool.query(sqlQuery, [reviewRequestId, repositoryUid, queueStatus, groupId, sessionId, sourceCommitId, destinationCommitId])
                            .then(() => {
                                gamma.socket.emitReviewRequestStatus(tenantId, {
                                    status: queueStatus,
                                    repositoryUid: repositoryUid,
                                    reviewRequestId: reviewRequestId
                                });
                                resolve();
                            });
                    } else if ((queueData[0].source_commit_id != sourceCommitId || queueData[0].destination_commit_id != destinationCommitId) &&
                        (queueData[0].status == 'QUEUED' || queueData[0].status == 'NO_FILES' || queueData[0].status == 'FORK')) {
                        sqlQuery = `update review_request_queue set group_id = $1 , session_id = $2, source_commit_id = $3, destination_commit_id = $4, updated_on = now(), status = $5
                                    where id=$6`;
                        db.gammaDbPool.query(sqlQuery, [groupId, sessionId, sourceCommitId, destinationCommitId, queueStatus, queueData[0].id])
                            .then(() => {
                                resolve();
                            });
                    } else {
                        resolve();
                    }
                } else {
                    //insert for the 1st time
                    sqlQuery = `insert into review_request_queue(review_request_id, repository_uid, status, group_id, session_id, source_commit_id, destination_commit_id, updated_on, created_on)
                                    values($1, $2, $3, $4, $5, $6, $7, now(), now())`;
                    db.gammaDbPool.query(sqlQuery, [reviewRequestId, repositoryUid, queueStatus, groupId, sessionId, sourceCommitId, destinationCommitId])
                        .then(() => {
                            gamma.socket.emitReviewRequestStatus(tenantId, {
                                status: queueStatus,
                                repositoryUid: repositoryUid,
                                reviewRequestId: reviewRequestId
                            });
                            resolve();
                        });
                }
            });
    });
}

export function getCommitData(url, headerData, repoProvider = '', totalCommits, prID, queryParams, hasPages, serverType, tenantUid) {
    queryParams = (!hasPages) ? queryParams : {};
    return new Promise((resolve, reject) => {
        let payloadCommitsMeta = {
            url,
            headerData,
            repoProvider,
            totalCommits,
            prID,
            queryParams,
            hasPages,
            resolve,
            reject,
            serverType,
            tenantUid
        }
        pullRequestInterfaceController.setRepoProviderContext(payloadCommitsMeta.repoProvider, serverType).getCommitsPayload(payloadCommitsMeta);
    });
}

function getFileData(fileDataUrl, payload, headerData, repoProvider = '', totalFilesChanged, totalFilesAdded, totalfilesRemoved, queryParams, hasPages, oldFileListAll, newFileListAll, serverType, tenantUid) {
    queryParams = (!hasPages) ? queryParams : {};
    // Promise
    return new Promise((resolve, reject) => {
        request({
            url: `${fileDataUrl}`,
            method: 'GET',
            timeout: 20000,
            headers: headerData,
            rejectUnauthorized: false,
            useQuerystring: true,
            qs: queryParams
        },
            function (error, response, body) {
                if (error) {
                    log.error("Cannot access url: " + fileDataUrl, {'tenantUid': tenantUid});
                    log.error(error, {'tenantUid': tenantUid});
                    reject(new errors.ServiceUnavailable(repoProvider + " service unavailable: " + fileDataUrl, 1021));
                } else if (response.statusCode == 200) {
                    let oldFileList, newFileList;
                    let payloadFileMeta = {
                        fileDataUrl,
                        payload,
                        headerData,
                        repoProvider,
                        totalFilesChanged,
                        totalFilesAdded,
                        totalfilesRemoved,
                        queryParams,
                        hasPages,
                        oldFileListAll,
                        newFileListAll,
                        fileDetails: JSON.parse(body),
                        respHeaders: (typeof response.headers != 'undefined') ? response.headers : '',
                        oldFileList,
                        newFileList,
                        serverType
                    }
                    pullRequestInterfaceController.setRepoProviderContext(payloadFileMeta.repoProvider, serverType).getFilesPayload(payloadFileMeta);
                    log.trace("payloadFileMeta for files changed", {'tenantUid': tenantUid});
                    // Recursive
                    if (payloadFileMeta.hasPages) {
                        resolve(getFileData(payloadFileMeta.fileDataUrl, payloadFileMeta.payload, payloadFileMeta.headerData, payloadFileMeta.repoProvider, payloadFileMeta.totalFilesChanged, payloadFileMeta.totalFilesAdded, payloadFileMeta.totalfilesRemoved, payloadFileMeta.queryParams, payloadFileMeta.hasPages, payloadFileMeta.oldFileListAll, payloadFileMeta.newFileListAll, serverType, tenantUid));
                    } else {
                        let fileData = {
                            "filesChanged": payloadFileMeta.totalFilesChanged,
                            "filesAdded": payloadFileMeta.totalFilesAdded,
                            "filesRemoved": payloadFileMeta.totalfilesRemoved,
                            "oldFileList": payloadFileMeta.oldFileListAll,
                            "newFileList": payloadFileMeta.newFileListAll
                        }
                        if (_.includes(['github'], repoProvider)) {
                            fileData.noOfCommits = (typeof payloadFileMeta.fileDetails.total_commits !== 'undefined') ? payloadFileMeta.fileDetails.total_commits : 0;
                        }
                        if (_.includes(['gitlab'], repoProvider)) {
                            fileData.noOfCommits = (typeof payloadFileMeta.fileDetails.commits !== 'undefined') ? payloadFileMeta.fileDetails.commits.length : 0;
                        }
                        resolve(fileData);
                    }
                } else {
                    log.error("No valid response from url: " + fileDataUrl, {'tenantUid': tenantUid});
                    reject(new errors.ServiceUnavailable(repoProvider + " service unavailable: " + fileDataUrl, 1021));
                }

            });
    });
}

function getForkStatus(payload) {
    if ((payload.repoUrl).toLowerCase() != (payload.destinationRepoUrl).toLowerCase()) {
        return true;
    } else {
        return false;
    }
}

function getValidLanguageExtensions(langArray, tenantUid) {
    return new Promise((resolve, reject) => {
        let langUrl = `${LANGUAGE_EXT_URL}?languages=${langArray}`;
        request({
            url: langUrl,
            method: 'GET',
            timeout: 20000,
            headers: {
                'Content-Type': 'application/json'
            },
            rejectUnauthorized: false
        },
            function (error, response, body) {
                if (error) {
                    log.error("Cannot access url :" + langUrl, {'tenantUid': tenantUid});
                    reject(new errors.ServiceUnavailable("Embold service unavailable", 1021));
                } else if (response.statusCode == 200) {
                    resolve(body);
                } else {
                    log.error("No valid response from url: " + langUrl, {'tenantUid': tenantUid});
                    reject(new errors.ServiceUnavailable("Embold service unavailable", 1021));
                }
            });
    });
}

// Find repository service provider
export function getRepositoryProvider(repository, serverType) {
    let repoUrl, isVcSupport, isGitSupport, gitType, vcType, repoType, providerName, repoSlug, repoOwner, encUsername, encPassword, decUsername, decPassword, responseData, subsystemUrl, masterUrl;
    // Storage
    masterRepositoryUrl = (repository.master_repository_url) ? repository.master_repository_url : '';
    repoUrl = (repository.subsystem_repository_url) ? repository.subsystem_repository_url : '';
    // gitType = (repository.url_type) ? repository.url_type.toLowerCase() : '';
    gitType = (repository.pr_enable) ? repository.additional_details ? ((repository.additional_details.repo_provider) ? repository.additional_details.repo_provider.toLowerCase() : (repository.url_type) ? repository.url_type.toLowerCase() : '') : (repository.url_type) ? repository.url_type.toLowerCase() : '' : '';
    isGitSupport = (gitType != '' && _.includes(GIT_CLOUD_PROVIDER, gitType)) ? true : false;
    isVcSupport = (repository.master_repository_type_id && repository.master_repository_type_id > 0) ? true : false;
    vcType = (repository.type_name && repository.type_name != '') ? repository.type_name.toLowerCase() : '';
    providerName = (isVcSupport) ? vcType : gitType;
    // Encrypted
    if (isVcSupport) {
        encUsername = (repository.user_name) ? repository.user_name : '';
        encPassword = (repository.password) ? repository.password : '';
    } else if (isGitSupport) {
        encUsername = (repository.subsystem_repository_user_name) ? repository.subsystem_repository_user_name : '';
        encPassword = (repository.subsystem_repository_password) ? repository.subsystem_repository_password : '';
    }
    // Decrypted
    decUsername = (encUsername == '') ? '' : cf.decryptStringWithAES(encUsername);
    decPassword = (encPassword == '') ? '' : cf.decryptStringWithAES(encPassword);
    // Private or public type
    repoType = (isVcSupport) ? 'private' : (isGitSupport && encUsername != '' && encPassword != '') ? 'private' : 'public';
    // Parse url
    if (_.includes(GIT_CLOUD_PROVIDER, providerName)) {
        urlData = cf.parseGitProviderUrl(repoUrl, providerName, serverType);
        repoSlug = (urlData.slug) ? urlData.slug : '';
        repoOwner = (urlData.owner) ? urlData.owner : '';
    }

    // Trim end of base url containing slash
    if (serverType == 'onpremise') {
        if(isVcSupport) {
            subsystemUrl = new URL(_.trimEnd(repository.subsystem_repository_url, '/'));
            masterUrl = new URL(_.trimEnd(repository.master_repository_url, '/'));
            masterRepositoryUrl = `${subsystemUrl.protocol}//${masterUrl.host}${masterUrl.pathname}`;
        } else {
            subsystemUrl = new URL(_.trimEnd(repository.subsystem_repository_url, '/'));
            masterRepositoryUrl = `${subsystemUrl.protocol}//${subsystemUrl.host}`;
        }
    }

    masterRepositoryUrl = _.trimEnd(masterRepositoryUrl, '/');
    // Response
    responseData = {
        "isVcSupport": isVcSupport,
        "isGitSupport": isGitSupport,
        "providerName": providerName,
        "repoType": repoType,
        "repoSlug": repoSlug,
        "repoOwner": repoOwner,
        "username": decUsername,
        "password": decPassword,
        "repoUrl": repoUrl,
        "baseUrl": masterRepositoryUrl,
        "projectId": ''
    };
    return responseData;
}

// Get repository detail by uid
export function getRepositoryDataForPR(subsystemUid, tenantId) {
    // let sqlQuery = `select * from subsystems where subsystem_uid = $1 and pr_enable=true`;
    let sqlQuery = `select subs.subsystem_uid, subs.pr_enable, subs.tenant_id, subs.subsystem_repository_url,
    subs.subsystem_repository_user_name, subs.subsystem_repository_password, subs.master_repository_id, subs.url_type,
    CASE subs.master_repository_id WHEN 0 THEN subs.subsystem_repository_user_name
        ELSE mrd.user_name
    END as user_name,
    CASE subs.master_repository_id WHEN 0 THEN subs.subsystem_repository_password
        ELSE mrd.password
    END as password,
    CASE subs.master_repository_id WHEN 0 THEN subs.additional_details
        ELSE mrd.additional_details
    END as additional_details,
    mrd.master_repository_type_id, mrt.type_name, mrd.master_repository_url
    from subsystems subs left join master_repository_details mrd on subs.master_repository_id=mrd.id
    left join master_repository_types mrt on mrt.id=subs.subsystem_repository_type
    where (subs.url_type is not null or mrd.master_repository_type_id !=0) and subs.pr_enable=true
    and subs.subsystem_uid=$1 and subs.tenant_id=$2`;
    return db.gammaDbPool.query(sqlQuery, [subsystemUid, tenantId])
        .then(data => {
            return (data.length) ? data[0] : data;
        });
}
export function deleteRepositoryPullRequests(tenantId, repositoryUid, tenantUid){
    updateStatusToRemoved(repositoryUid);
    let selectQuery = `select session_id from review_request_queue where repository_uid = $1
    and status = 'IN_PROGRESS'`;
    return db.gammaDbPool.query(selectQuery, [repositoryUid])
        .then((session)=>{
            if(session.length){
                let sessionId = session[0].session_id;
                abortScan(sessionId, PR_ABORT_REPO_URL)
                    .then(()=>{
                            log.info(`Abort PR request sent to Embold service : [sessionId : ${sessionId}, repoId : ${repositoryUid}`, {'tenantUid': tenantUid});
                        })
                        .catch(error => {
                            log.info(`failing PR scan as Embold service is not available to abort scan [sessionId : ${sessionId}, repoId : ${repositoryUid}`, {'tenantUid': tenantUid});
                            forceFailPRScanRequest(sessionId, repositoryUid, tenantId);
                        });
            }
        });
}

function updateStatusToRemoved(repoUid){
    let updateQuery = `update review_request_queue set status = 'REMOVED' where repository_uid = $1 and status = 'QUEUED'`;
    return db.gammaDbPool.query(updateQuery, [repoUid])
        .then(() => {
        });
}

