import async from 'async';
import _ from 'underscore';
import * as log from './../../../logs/logger';
import moment from 'moment';
import * as pollingInterfaceController from './pollingInterface.controller';
import { getCodeIssuesTagsKpis } from './../../v1/repository/codeIssues/codeIssues.services';
import * as gamma from './../../../core/gamma';
const errors = require('throw.js');
var pullRequestList;

export async function index(req, res, next) {
    let repositoryId = req.query.repositoryId;
    let tenantUid = (req.session) ? req.session.tenant_uid : '';
    getPullRequestData(req, next)
    .then(result => {
        if ((result.pullRequests).length) {
            var prIds = _.pluck(result.pullRequests,"review_request_id");

            return getIssuesData(req, next, prIds, repositoryId)
            .then(coronaData => {
                let dataObj={};
                _.each(result.pullRequests,function(item){
                    dataObj = _.findWhere(coronaData, {"review_id":item.review_request_id});
                    item.issues=dataObj?dataObj.summary.pr_summary:{};
                });
                res.status(200).json(result);
            })
            .catch(error=>{
                log.error("Error in getting PR issues data from db.", {'tenantUid': tenantUid});
                log.error(error, {'tenantUid': tenantUid});
                res.status(200).json([]);
            });

        } else {
            log.info("Pull request data not found in db", {'tenantUid': tenantUid});
            return next(new errors.CustomError("NoContentToDisplay", "No content to display", 204, 1026));
        }
    })
    .catch(error=>{
        log.error("Error in fetching pull request data from db", {'tenantUid': tenantUid});
        return next(error, {'tenantUid': tenantUid});
    });
}


export async function refreshData(req, res, next){
    let tenantUid = (req.session) ? req.session.tenant_uid : '';
    pollingInterfaceController.refreshPRList(req)
    // pollingController.refreshPRList(req)
        .then(result => {
            log.info('Refresh PR data successful for repoUid: ' + req.params.repositoryUid, {'tenantUid': tenantUid});
            res.status(200).json({ status: 'success', message: gamma.i18next.t('server.success_message.development_history.refresh_pr'), details: gamma.i18next.t('server.success_message.development_history.refresh_pr')});
        })
        .catch(error => {
            log.error('Refresh PR data failed for repoUid: ' + req.params.repositoryUid, {'tenantUid': tenantUid});
            res.status(200).json({ status: 'fail', message: gamma.i18next.t('server.error_message.development_history.refresh_pr'), details: gamma.i18next.t('server.error_message.development_history.refresh_pr') });
        });

}

// get all pull request list item
function getPullRequestData(req, next) {
    return new Promise((resolve, reject)=>{
        let sqlQuery;
        let repoUid = req.params.repositoryUid;
        let startDate = (typeof req.query.startDate !== 'undefined' && req.query.startDate !== '') ? moment(req.query.startDate,'DD-MM-YYYY').utc().local().format('YYYY-MM-DD') : req.query.startDate;
        let endDate =  (typeof req.query.endDate !== 'undefined' && req.query.endDate !== '' ) ? moment(req.query.endDate,'DD-MM-YYYY').utc().local().format('YYYY-MM-DD') : req.query.endDate;
        let authorName = req.query.authorName;
        let searchString =req.query.searchString;
        let startIndex = req.query.startIndex;
        let stopIndex = req.query.stopIndex;
        if(req.query.prStatusArr == undefined){
            req.query.prStatusArr = [];
        }
        pullRequestList = {
            "totalPullRequests" : 0,
            "pullRequests": []
        }

        async.parallel({
            pullRequest_list_data : function(callback)
            {
                sqlQuery =  `select * from get_pullrequest_list($1,$2,$3,$4,$5,$6,$7,$8)`;
                req.gamma.query(sqlQuery,[repoUid,req.query.prStatusArr,startDate, endDate,authorName,searchString, startIndex, stopIndex], next)
                .then(data =>{
                    callback(null, data);
                })
            },
            pullRequest_list_count : function(callback)
            {
                sqlQuery = `select (select * from get_pullrequest_list_count($1, $2, $3, $4, $5, $6)) as cnt`;
                req.gamma.query(sqlQuery,[repoUid,req.query.prStatusArr,startDate, endDate, authorName,searchString], next)
                .then(data=>{
                    callback(null, data);
                })
            }
        },
        function(err, results){
            if (err) {
                //log.error(err);
            }
            else{
                (results.pullRequest_list_data).map(d=>{
                    d.scanInProgress = (d.status == 'IN_PROGRESS')? true : false ;
                });
                pullRequestList.totalPullRequests = parseInt(results.pullRequest_list_count[0].cnt);
                pullRequestList.pullRequests = results.pullRequest_list_data;
                _.each(pullRequestList.pullRequests,function(item,i){
                    pullRequestList.pullRequests[i].primary_data =_.pick(item.primary_data, 'commits','filesAdded','filesRemoved','filesChanged','id','title','actor','createdOn','updatedOn','prState');
                });
                resolve(pullRequestList);
            }
        });
    });
}

export async function getPRDetail(req, res, next) {
    let prId = req.params.pullRequestId;
    let repositoryUid = req.params.repositoryUid;
    let repositoryId = req.query.repositoryId;
    let tenantUid = (req.session) ? req.session.tenant_uid : '';

    Promise.all([getPullRequestDetail(req, next, prId, repositoryUid), getIssuesData(req, next, [prId],repositoryId)] )
    .then(result => {
       if (result.length) {
            let prList = [], prIssueData = {}, prPrimaryIssuesData = {};

            if(result[1][0]){
                prList = result[1][0].details.pr_details;
                prIssueData = result[1][0].details;
                prPrimaryIssuesData = result[1][0].summary.pr_summary;
            }
            // get KPI detail for each rule key
            function getKPIDetail(prItem, callback) {
                getCodeIssuesTagsKpis(req, prItem.code_issues, next, 'rulekey')
                .then(codeIssuesData=>{
                    prItem.code_issues = codeIssuesData;
                    return callback(null, prItem);
                })
                .catch(error => {
                    log.error("Error in getting KPI details for repoUid:"+repositoryUid, {'tenantUid': tenantUid});
                    return callback(error, prItem);
                });
            }
            async.forEach(prList, getKPIDetail, function(err, kpiList) {
                if (err) {
                    log.error("Error in getting KPI details for repoUid:"+repositoryUid, {'tenantUid': tenantUid});
                    log.error(err);
                    return next(err);
                } else {
                    let prDetail = {
                        primaryPrData : result[0][0],
                        issueData: prIssueData,
                        primaryIssueData : prPrimaryIssuesData,
                        reData: []
                    };
                   res.status(200).json(prDetail);
                }
            });
        } else {
            log.error("Pull request details and issues data not found in db for repoUid:"+ repositoryUid, {'tenantUid': tenantUid});
            return next(new errors.CustomError("NoContentToDisplay", "No content to display", 204, 1026));
        }
    });
}

export async function getMetaData(req, res, next){
    let repoUid = req.params.repositoryUid;
    let tenantUid = (req.session) ? req.session.tenant_uid : '';
    let sqlQuery = `select distinct(rr.primary_data->>'prState') as pr_state from review_requests rr inner join review_request_queue rrq on rr.id=rrq.review_request_id where rrq.repository_uid = $1 order by pr_state desc`;
    return req.gamma.query(sqlQuery, [repoUid], next)
    .then(metaData=>{
        if(metaData.length){
            res.status(200).json(metaData);
        }
        else{
            log.warn("Pull request metadata not found in db for repoUid: "+ repoUid, {'tenantUid': tenantUid});
            return next(new errors.CustomError("NoContentToDisplay", "No content to display", 204, 1026));
        }
    });
}

export async function getAuthors(req, res, next){
    let searchTerm = req.query.author_name;
    let tenantUid = (req.session) ? req.session.tenant_uid : '';
    if (searchTerm == "null" || searchTerm == undefined ){
        searchTerm = '';
    }
    let sqlQuery = `select distinct(rr.primary_data->'actor'->>'displayName') as author_name,
                    (rr.primary_data->'actor'->>'avatar') as avatar
                    from review_requests rr inner join review_request_queue rrq on rr.id=rrq.review_request_id
                    where rrq.repository_uid = $1 and
                    rr.primary_data->'actor'->>'displayName' ilike $2`;
                    searchTerm = `%${searchTerm}%`;
            return req.gamma.query(sqlQuery, [req.params.repositoryUid,searchTerm], next)
            .then(queryData =>{
                if (queryData.length){
                    let authorDetails = _.map(queryData, function(value, key){
                        return {'author_name': value.author_name, 'avatar' : value.avatar}
                    });
                    res.status(200).json(authorDetails);
                    //res.status(200).json(_.pluck(queryData,'author_name'));
                }
                else{
                    log.info("Authors data not found for repoUid: " + req.params.repositoryUid, {'tenantUid': tenantUid});
                    return next(new errors.CustomError("NoContentToDisplay", "No content to display", 204, 1026));
                }
            })
            .catch(error => {
                log.error("Error while fetching Authors data from db for repoUid: " + req.params.repositoryUid, {'tenantUid': tenantUid});
                return next(error);
            });
}
// get pull request detail for each request
function getPullRequestDetail(req, next, prId,repoUid) {
    return new Promise((resolve, reject)=>{
        let sqlQuery = `select * from review_requests rr inner join webhooks w on
                    rr.webhook_id = w.id inner join subsystems s on
                    w.repository_url = s.subsystem_repository_url
                    and s.subsystem_uid = $1
                    and rr.review_request_id = $2`;
        return req.gamma.query(sqlQuery, [repoUid, prId], next)
        .then(result => {
            resolve(result);
        });
    });
}
// get code and design issue data
function getIssuesData(req, next, prIds, repoId) {
    let sqlQuery = "select * from review_request where review_id =any ($1) and subsystem_id = $2";
    return req.corona.query(sqlQuery, [prIds,repoId], next)
    .then(result => {
        return result;
    });
}