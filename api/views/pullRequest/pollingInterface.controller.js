import * as log from './../../../logs/logger';
import { pickRepoFromPRQueue } from './scan.controller';
import gammaConfig from './../../../core/config';
import * as db from './../../../component/db';
import * as pullRequestService from './pullRequest.service';
import * as pullRequestInterfaceController from './pullRequestInterface.controller';
import async from 'async';
import { processWebhook } from './webhook.controller';
import moment from 'moment';
import _ from 'lodash';
const errors = require('throw.js');
var schedule = require('node-schedule');
const POLLING_PR_CRON_TIME = gammaConfig.polling_pr_cron_time; // Every hour
const PROJECT_ID_PROVIDER = ['gitlab']; // gitlab only

if ((gammaConfig.is_cloud == false) && (gammaConfig.enablePRScan == true) && (POLLING_PR_CRON_TIME !== "undefined" && POLLING_PR_CRON_TIME !== "")) {
    // Cron job: polling on Bitbucket, Github through cloud APIs
    schedule.scheduleJob(POLLING_PR_CRON_TIME, function () {
        log.info('Cron job triggered for polling pull requests');
        startPollingPR();
    })
}

export function startPollingPR() {
    // Get tenants
    getTenants()
        .then(tenants => {
            // Loop tenants
            tenants.forEach(function (tenant) {
                let tenantId = (typeof tenant.id !== 'undefined' && tenant.id != '') ? tenant.id : 0;
                let tenantUid = (typeof tenant.tenant_uid !== 'undefined' && tenant.tenant_uid != '') ? tenant.tenant_uid : 0;
                // Get all repos
                getDistinctUrls(tenantId, tenantUid)
                    .then(repositories => {
                        // Loop repos
                        pollEachRepo(repositories, tenantId, tenantUid);
                    })
                    .catch(error => {
                        log.error("Couldn't get distinct repository URLs to start polling", {'tenantUid': tenantUid});
                        log.debug(error, {'tenantUid': tenantUid});
                    });
            });
        })
        .catch(error => {
            log.error('No tenants found for PR processing');
            log.error(error);
        });
}

function pollEachRepo(repositories, tenantId, tenantUid) {
    var finalPRList = [];
    async.forEachSeries(repositories, function (repository, callback) {
        let repoUrl, repoUid, repoMeta, projectId, lastPollTs;
        repoUrl = (typeof repository.subsystem_repository_url !== 'undefined') ? repository.subsystem_repository_url : '';
        repoUid = (typeof repository.subsystem_uid !== 'undefined') ? repository.subsystem_uid : '';
        getServerType = (repository.additional_details) ? repository.additional_details.account_type : '';
        // Get repository provider meta data
        repoMeta = pullRequestService.getRepositoryProvider(repository, getServerType);
        repoMeta.serverType = getServerType;
        // Get last poll timestamp with project id
        getLastPollTsWithProjectId(repoUrl, tenantId, repoMeta, tenantUid).then(reponseData => {
            lastPollTs = (!_.isUndefined(reponseData.lastPollTs)) ? reponseData.lastPollTs : '';
            projectId = (!_.isUndefined(reponseData.projectId)) ? reponseData.projectId : '';
            if (reponseData.statusCode == 200) {
                lastPollTsData(repoMeta, projectId, repoUid, repoUrl, tenantId, repository, lastPollTs, tenantUid).then(prList => {
                    finalPRList = finalPRList.concat(prList);
                    callback();
                })
                .catch(error => {
                    log.error("Couldn't fetch pull request list for repository: "+ repoUrl, {'tenantUid': tenantUid});

                    log.error(error, {'tenantUid': tenantUid});
                    callback();
                });
            } else {
                log.error('Project id not found for repository: ' + repoUrl, {'tenantUid': tenantUid});
            }
        })
        .catch(error => {
            log.error("Couldn't get last poll time and project id for repository: "+repoUrl, {'tenantUid': tenantUid});
            log.error(error, {'tenantUid': tenantUid});
            callback();
        });
    },
    function (err) {
        if (err) {
            return err;
        }
        processPrList(tenantId, finalPRList, tenantUid);
    });
}

function getTenants() {
    let sqlQuery = `select id, tenant_uid from tenant`;
    return db.gammaDbPool.query(sqlQuery)
        .then(tenants => {
            return new Promise((resolve, reject) => {
                if (tenants.length) {
                    resolve(tenants);
                } else {
                    reject(new errors.CustomError("NoContentToDisplay", "No content to display", 204, 1026));
                }
            });
        });
}

function getDistinctUrls(tenantId, tenantUid) {
    let sqlQuery = `(with x as (select subsystem_uid, subsystem_repository_url, (ROW_NUMBER ()
    OVER ( PARTITION BY subsystem_repository_url ORDER BY last_poll desc))as srno
    from subsystems where pr_enable = true and has_snapshot = true)
    select distinct(subs.subsystem_repository_url), x.subsystem_uid, subs.pr_enable, subs.tenant_id,
    subs.subsystem_repository_user_name,  subs.master_repository_id,
    subs.subsystem_repository_password,
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
     mrt.type_name,
    case when MIN(COALESCE(subs.last_poll,'1000-01-01'))='1000-01-01' then null
                            else MIN(COALESCE(subs.last_poll,'1000-01-01'))
                            end as last_poll
    from subsystems subs
    left join master_repository_details mrd on subs.master_repository_id=mrd.id
    left join master_repository_types mrt on mrt.id=subs.subsystem_repository_type
    inner join x on x.subsystem_repository_url = subs.subsystem_repository_url and x.srno = 1
    where (subs.url_type is not null or mrd.master_repository_type_id !=0)
    and subs.pr_enable=true
    and subs.tenant_id=$1
    and subs.has_snapshot=true
    group by subs.subsystem_repository_url, x.subsystem_uid,
    subs.pr_enable, subs.tenant_id, subs.subsystem_repository_user_name,
    subs.subsystem_repository_password, subs.master_repository_id, subs.subsystem_repository_type, --subs.url_type,
    mrd.user_name, mrd.password, mrd.master_repository_type_id,
    mrd.master_repository_url, subs.additional_details, mrd.additional_details, mrt.type_name);`
    return db.gammaDbPool.query(sqlQuery, [tenantId])
    .then(vcrepositories => {
        return new Promise((resolve, reject) => {
            if (vcrepositories.length) {
                let filteredData = [];
                async.each(vcrepositories, function (value, callback) {
                    filteredData.push(value);
                    callback();
                }, function (err) {
                        if (err) {
                            log.error(JSON.stringify(err), {'tenantUid':tenantUid});
                        } else {
                            resolve(filteredData);
                        }
                    });
                } else {
                    log.info("No repositories with PR enabled", {'tenantUid':tenantUid});
                    reject(new errors.CustomError("NoContentToDisplay", "No content to display", 204, 1026));
                }
            });
        });
}

function lastPollTsData(repoMeta, projectId, repoUid, repoUrl, tenantId, repository, lastPollTs, tenantUid) {
    return new Promise((resolve, reject) => {
        // Required for gitlab only to prepare project api endpoint
        repoMeta.projectId = projectId;
        // Webhook dependency
        processWebhook(repoUid, tenantId, true)
            .then(() => {
        })
        .catch((err) => { log.error('Error in process webhook execution for repoUid: '+repoUid , {'tenantUid': tenantUid}); });
        // Get pr list via api
        getPrList(tenantId, repoMeta, lastPollTs, repository, tenantUid)
            .then(prList => {
                // List
                prList = prList.map(d => {
                    d.repoMeta = repoMeta;
                    return d;
                });
                resolve(prList);
            })
            .catch(error => {
                log.error("Couldn't get pull request for repository: " + repoUrl, {'tenantUid': tenantUid});
                log.error(JSON.stringify(error), {'tenantUid': tenantUid});
                reject();
            });
    });
}

// Refresh PR List
export function refreshPRList(req) {
    return new Promise((resolve, reject) => {
        let repoUrl, repoUid, tenantId,tenantUid, repoMeta, projectId, lastPollTs, finalPRList = [];
        // Request body
        repoUid = (!_.isUndefined(req.params.repositoryUid)) ? req.params.repositoryUid : '';
        tenantId = (!_.isUndefined(req.session.tenant_id)) ? req.session.tenant_id : '';
        tenantUid = (!_.isUndefined(req.session.tenant_uid)) ? req.session.tenant_uid : '';
        pullRequestService.getRepositoryDataForPR(repoUid, tenantId)
            .then(repository => {
                repoUrl = (typeof repository.subsystem_repository_url !== 'undefined') ? repository.subsystem_repository_url : '';
                // Get repository provider meta data
                getServerType = (repository.additional_details) ? repository.additional_details.account_type : '';
                // Get repository provider meta data
                repoMeta = pullRequestService.getRepositoryProvider(repository, getServerType);
                repoMeta.serverType = getServerType;
                // Get last poll timestamp with project id
                getLastPollTsWithProjectId(repoUrl, tenantId, repoMeta, tenantUid).then(reponseData => {
                    lastPollTs = (!_.isUndefined(reponseData.lastPollTs)) ? reponseData.lastPollTs : '';
                    projectId = (!_.isUndefined(reponseData.projectId)) ? reponseData.projectId : '';
                    if (reponseData.statusCode == 200) {
                        lastPollTsData(repoMeta, projectId, repoUid, repoUrl, tenantId, repository, lastPollTs).then(prList => {
                            finalPRList = finalPRList.concat(prList);
                            // Process PR list
                            processPrList(tenantId, finalPRList, tenantUid);
                            resolve();
                        })
                        .catch(error => {
                            log.error("RefreshPRList: Couldn't get pull request list for repository: " + repoUrl, {'tenantUid': tenantUid});
                            log.error(JSON.stringify(error), {'tenantUid': tenantUid});
                            reject();
                        });
                    } else {
                        log.error('RefreshPRList:Project id not found for repository: '+ repoUrl, {'tenantUid': tenantUid});
                    }
                })
                .catch(error => {
                    log.error("RefreshPRList: Couldn't get LastpollTimestamp and project id for repository: " + repoUrl, {'tenantUid': tenantUid});
                    log.error(error, {'tenantUid': tenantUid});
                    reject();
                });
            })
            .catch(error => {
                log.error("RefreshPRList: Couldn't get repository data for Pull request, repoUid: "+ subsystemUid , {'tenantUid': tenantUid} );
                log.error(JSON.stringify(error), {'tenantUid': tenantUid});
                reject();
            });
    });
}

// Keep record of last poll time

function getLastPollTsWithProjectId(repoUrl, tenantId, repoMeta, tenantUid) {
    let lastPollTs = '', jsonData, statusCode = 200;
    let sqlQuery = `select case when MIN(COALESCE(last_poll,'1000-01-01'))='1000-01-01' then null
	                else MIN(COALESCE(last_poll,'1000-01-01'))
                    end as last_poll
                    from subsystems
                    where subsystem_repository_url=$1
                    and tenant_id=$2`;
    if (_.includes(PROJECT_ID_PROVIDER, repoMeta.providerName)) {
        // for gitlab only
        return new Promise((resolve, reject) => {
            jsonData = { "repoUrl": repoMeta.repoUrl, "baseUrl": repoMeta.baseUrl, "repoPass": repoMeta.password };
            pullRequestInterfaceController.setRepoProviderContext(repoMeta.providerName, repoMeta.serverType).getProjectIdByNamespace(jsonData)
                .then(projectId => {
                    statusCode = (typeof projectId !== 'undefined' && projectId && projectId != '') ? 200 : 404;
                    // Get last poll timestamp
                    db.gammaDbPool.query(sqlQuery, [repoUrl, tenantId])
                        .then(info => {
                            lastPollTs = (info.length) ? info[0].last_poll : null;
                            resolve({ "statusCode": statusCode, "lastPollTs": lastPollTs, "projectId": projectId });
                        });
                })
                .catch(err => {
                    log.error("Error while getting project id for repository: "+ repoMeta.repoUrl, {'tenant': tenantUid})
                    log.error(err, {'tenantUid': tenantUid});
                    reject({ "statusCode": statusCode, "lastPollTs": lastPollTs, "projectId": '' });
                });
        })
    } else {
        // for all other providers
        return db.gammaDbPool.query(sqlQuery, [repoUrl, tenantId])
            .then(info => {
                lastPollTs = (info.length) ? info.last_poll : null;
                return { "statusCode": statusCode, "lastPollTs": lastPollTs, "projectId": '' };
            });
    }
}

// Update last poll timestamp
function updateLastPollTs(repoUrl, tenantId, repository) {
    let currentRepoUid = repository.subsystem_uid;
    let sqlQuery = `select last_poll from subsystems where subsystem_uid = $1 and tenant_id = $2`
    db.gammaDbPool.query(sqlQuery, [currentRepoUid, tenantId])
        .then((result) => {
            if (result[0].last_poll == null) {
                let updateQuery = `update subsystems set last_poll = now() where subsystem_repository_url = $1 and last_poll is null and tenant_id = $2 and pr_enable = true`;
                db.gammaDbPool.query(updateQuery, [repoUrl, tenantId])
                    .then(() => { });
            }
            else {
                let updateQuery = `update subsystems set last_poll = now() where subsystem_repository_url = $1 and last_poll is not null and tenant_id = $2 and pr_enable = true`;
                db.gammaDbPool.query(updateQuery, [repoUrl, tenantId])
                    .then(() => { });
            }
        });
        // .catch(error => {
        //     log.error(JSON.stringify(error));
        // });
}

function getPrList(tenantId, repoMeta = '', lastPollTs, repository, tenantUid) {
    return new Promise((resolve, reject) => {
        let repoProvider, cloudApiUrl, queryParams, queryString, lastPollDt, tasks = [], dateFormat, serverType;
        // Repo meta
        repoProvider = (typeof repoMeta.providerName !== 'undefined') ? repoMeta.providerName : '';
        serverType = (typeof repoMeta.serverType !== 'undefined') ? repoMeta.serverType : '';
        if (_.includes(['bitbucket', 'Bitbucket'], repoProvider)) { dateFormat = 'YYYY-MM-DD h:mm'; }
        if (_.includes(['github', 'Github'], repoProvider)) { dateFormat = 'YYYY-MM-DD'; }
        if (_.includes(['gitlab', 'Gitlab'], repoProvider)) { dateFormat = 'YYYY-MM-DDTHH:mm:ss.SSS'; }
        let prMetaData = {
            isVcSupport: (typeof repoMeta.isVcSupport !== 'undefined') ? repoMeta.isVcSupport : '',
            repoProvider: repoProvider,
            repoType: (typeof repoMeta.repoType !== 'undefined') ? repoMeta.repoType : '',
            repoSlug: (typeof repoMeta.repoSlug !== 'undefined') ? repoMeta.repoSlug : '',
            repoOwner: (typeof repoMeta.repoOwner !== 'undefined') ? repoMeta.repoOwner : '',
            repoUser: (typeof repoMeta.username !== 'undefined') ? repoMeta.username : '',
            repoPass: (typeof repoMeta.password !== 'undefined') ? repoMeta.password : '',
            repoUrl: (typeof repoMeta.repoUrl !== 'undefined') ? repoMeta.repoUrl : '',
            baseUrl: (typeof repoMeta.baseUrl !== 'undefined') ? _.trimEnd(repoMeta.baseUrl, '/') : '',
            projectId: (typeof repoMeta.projectId !== 'undefined') ? repoMeta.projectId : '',
            // Headers
            headerData: { "content-type": "application/json" },
            cloudApiUrl,
            queryParams,
            queryString,
            // Date time format accepted
            lastPollDt: (typeof lastPollTs !== 'undefined' && lastPollTs) ? moment(lastPollTs).format(dateFormat) : '',
            serverType,
            tenantUid
        }
        // Basic auth
        tasks = pullRequestInterfaceController.setRepoProviderContext(prMetaData.repoProvider, serverType).getPrData(prMetaData);
        // Promise all
        Promise.all(tasks)
            .then(resultData => {
                let prList = (resultData.length > 0) ? resultData[0].list : [];
                log.info('Retrieved ' + prMetaData.repoProvider + ' all pull requests against repo slug: ' + prMetaData.repoSlug + ' with count: ' + ((typeof prList.length !== 'undefined') ? prList.length : 0), {'tenantUid': tenantUid});
                // Update last poll timestamp only after get pr list api success
                updateLastPollTs(prMetaData.repoUrl, tenantId, repository);
                resolve(prList);
            })
            .catch(error => {
                log.error("Error while fetching pull request list for repository: "+ prMetaData.repoUrl, {'tenantUid': tenantUid});
                log.error(error,{'tenantUid': tenantUid});
                resolve([]);
            })
    });
}

function processPrList(tenantId, prList, tenantUid) {
    let repoProvider;
    if (prList.length) {
        log.info('Processing payload started', {'tenantUid': tenantUid});
        // Sync loop
        async.forEachSeries(prList, function (pullrequest, callback) {
            let req = {};
            req.params = {
                "repositoryUid": ''
            };
            req.session = {
                'tenant_uid' : tenantUid
            }
            repoProvider = (typeof pullrequest.repoMeta.providerName !== 'undefined') ? pullrequest.repoMeta.providerName : '';
            serverType = (typeof pullrequest.repoMeta.serverType !== 'undefined') ? pullrequest.repoMeta.serverType : '';
            let prMetaData = {
                req,
                pullrequest,
                repoProvider: (typeof pullrequest.repoMeta.providerName !== 'undefined') ? pullrequest.repoMeta.providerName : '',
                repoUrl: (typeof pullrequest.repoMeta.repoUrl !== 'undefined') ? pullrequest.repoMeta.repoUrl : '',
                prState: (pullrequest.state) ? pullrequest.state.toLowerCase() : '',
                callback,
                serverType,
                tenantUid
            }
            pullRequestInterfaceController.setRepoProviderContext(prMetaData.repoProvider, serverType).processPrData(prMetaData);
        },
            function (err) {
                log.info('Processing payload completed for all PRs', {'tenantUid': tenantUid});
                if (err) {
                    return err;
                }
                let req = {
                    'session': {
                        'tenant_id': tenantId,
                        'tenant_uid': tenantUid
                    },
                    'body': {},
                    'params': {}
                };
                pickRepoFromPRQueue(req);
            });
    } else {
        log.info('No pull requests found for processing', {'tenantUid': tenantUid});
    }
}