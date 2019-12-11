import async from 'async';
import * as logger from '../../../utils/common-functions';
import _ from 'underscore';
import request from 'request';
import * as cf from '../../../utils/common-functions'
var log = logger.LOG;


/**
 * Expose methods.
 */
export async function index(req, res, next) {
    return getData(req,res,next);
}

function getData(req,res,next)
{
    var sql_query = ``;
    var key_mapping={
        "overallRating": "overall_rating",
        "cloneRating": "duplication",
        "antiPatternRating": "design_rating",
        "codeQualityRating": "code_quality",
        "metricRating": "metrics"
    };
   /*  req.gamma.query(sql_query, [req.query.node_id])
        .then(data => res.json(data)); */
    var dashboardData = {
        // "git":{
        //     data:{
        //         added:84,
        //         removed:132
        //     },
        //     contributors:[
        //         {id:123,name:"Ramesh",loc:22,imagePath:""},
        //         {id:124,name:"Suresh",loc:-12,imagePath:""}
        //     ]
        // },
        "tasks":{
           /*  blocker:5,bugs:20,task:45 */
        },
        "quality_profile":{
            status:"failed",
            data:[],
            name:''
        },
        "overall_rating":{
            float_type:1
        },
        "design_rating":{
            rating: 0,
            float_value: null,
            float_type: 1
        },
        "code_quality":{
            rating: 0,
            float_value: null,
            float_type: 0
        },
        "metrics": {
            rating: 0,
            float_value: null,
            float_type: 0
        },
        "duplication":{
            rating: 0,
            float_value: null,
            float_type: 1
        },
        "hotspots":{
            rating: 0,
            float_value: null,
            float_type: 1
        },
        "unit_tests":{
            value: 0,
            total:0,
            status: "passed"
        },
        "code_coverage":{
            rating: null,
            float_value: 0,
            float_type: 0
        },
        "test_coverage":{
            rating:0
        },
        "commitHistory":{
            status:"failed"
        }
    };
    var ratingData={
        "new":[],
        "old":[]
    };
    async.parallel({
        ratings_data: function (callback) {
            var sql_query = `SELECT rv.snapshotid, json_agg(r.rating ||':'|| rv.rating_value) FROM ratings_values rv, ratings r WHERE rv.ratingid = r.id AND nodeid = $2 AND snapshotid IN (SELECT id FROM snapshots WHERE subsystem_id = $1 AND id= $3 AND (status = 'P' or status = 'K') ORDER BY id DESC LIMIT 2) GROUP BY rv.snapshotid ORDER BY snapshotid DESC `;
            req.corona.query(sql_query, [req.query.repository_id, req.query.node_id, req.query.snapshot_id],next)
                .then(data => {
                    var obj = {},toPick, float_value;
                    for (var j = 0; j < data.length; j++) {
                        obj = {};
                        for (var i = 0; i < data[j].json_agg.length; i++) {
                            var split = data[j].json_agg[i].split(':');
                            obj[split[0].trim()] = split[1].trim();
                        }
                         if (j == 0)
                             ratingData.new.push(obj) ;
                        else
                             ratingData.old.push(obj) ;
                    }
                    dashboardData.overall_rating.rating = parseInt(_.pick(ratingData.new[0], 'overallRating').overallRating).toFixed(2);
                    dashboardData.overall_rating.float_value = parseInt(_.pick(ratingData.new[0], 'overallRating').overallRating) - parseInt(_.pick(ratingData.old[0], 'overallRating').overallRating);

                    if(data.length) {
                        for (var i = 0; i < data[0].json_agg.length; i++) {
                            toPick = _.values(_.pick(key_mapping, data[0].json_agg[i].split(':')[0]))[0];
                            dashboardData[toPick].rating = parseFloat(_.values(_.pick(ratingData.new[0], data[0].json_agg[i].split(':')[0]))[0]).toFixed(2);

                            if (ratingData.old.length)
                                float_value = (parseFloat(_.values(_.pick(ratingData.new[0], data[0].json_agg[i].split(':')[0]))[0]) - parseFloat(_.values(_.pick(ratingData.old[0], data[0].json_agg[i].split(':')[0]))[0])).toFixed(2);
                            else
                                float_value=null;
                            dashboardData[toPick].float_value = float_value;
                            if(float_value > 0)
                                dashboardData[toPick].float_type=1;
                            else
                                dashboardData[toPick].float_type = 0;
                        }
                    }
                    callback(null, data);
                });
            },
            hotspots: function(callback) {
                var sql_hotspot_query = `SELECT rv.snapshotid, count(rv.rating_value)
                                    FROM ratings_values rv inner join  ratings r
                                    on rv.ratingid = r.id
                                    AND nodeid in (select n.id from nodes n where subsystem_id =$1 and n.classification = 'T')
                                    AND snapshotid IN (SELECT id FROM snapshots WHERE subsystem_id = $1 AND id= $2 AND (status = 'P' or status = 'K') ORDER BY id DESC LIMIT 2)
                                    AND r.rating = 'overallRating'
                                    AND rv.rating_value < 0
                                    GROUP BY rv.snapshotid
                                    ORDER BY snapshotid DESC;`;
                req.corona.query(sql_hotspot_query, [req.query.repository_id, req.query.snapshot_id],next)
                .then(response => {
                    if (response.length)
                        dashboardData.hotspots.rating = response[0].count;
                    if (response.length > 1)
                        dashboardData.hotspots.float_value = response[0].count - response[1].count;

                    callback(null, response);
                });
            },
            quality_profile: function(callback) {
                sql_query = `select name, qp_data from quality_profile where id = (select qp_id from subsystems where subsystem_uid = $1) `;
                req.gamma.query(sql_query, [req.params.repositoryUid],next)
                    .then(result => {
                        if (result[0])
                        {
                            dashboardData.quality_profile.name = result[0].name;
                            var profile_data = result;
                            sql_query = `select * from get_quality_profile_data($1, $2, $3)`;
                            req.corona.query(sql_query, [req.query.node_id, req.query.repository_id, req.query.snapshot_id],next)
                            .then(data=>{
                                for (var k = 0; k < result.length; k++) {
                                    for (var i = 0; i < result[k].qp_data.qp_data.length; i++) {
                                        var status = '';
                                        switch (result[k].qp_data.qp_data[i].name) {
                                            case 'criticalHotspots':
                                                if(data[0].critical_hotspots === null){
                                                    data[0].critical_hotspots = 0;
                                                }
                                                status = checkStatus(result[k].qp_data.qp_data[i].rule, result[k].qp_data.qp_data[i].value, (data.length > 0 ? data[0].critical_hotspots : '0'));
                                                profile_data[k].qp_data.qp_data[i].actual_value = (data.length > 0 ? data[0].critical_hotspots : 0);
                                                break;
                                            case 'criticalCodeIssues':
                                                if(data[0].critical_code_issues === null){
                                                    data[0].critical_code_issues = 0;
                                                }
                                                status = checkStatus(result[k].qp_data.qp_data[i].rule, result[k].qp_data.qp_data[i].value, data[0].critical_code_issues);
                                                profile_data[k].qp_data.qp_data[i].actual_value = data[0].critical_code_issues;
                                                break;
                                            case 'duplicationPercentage':
                                                if(data[0].duplication_percentage === null){
                                                    data[0].duplication_percentage = 0;
                                                }
                                                else if (data[0].duplication_percentage > 100)
                                                    data[0].duplication_percentage = 100;
                                                status = checkStatus(result[k].qp_data.qp_data[i].rule, result[k].qp_data.qp_data[i].value, data[0].duplication_percentage);
                                                profile_data[k].qp_data.qp_data[i].actual_value = data[0].duplication_percentage;
                                                dashboardData.duplication.rating = data[0].duplication_percentage;
                                                break;
                                            case 'overallRating':
                                                if(data[0].overall_rating === null){
                                                    data[0].overall_rating = 0;
                                                }
                                                status = checkStatus(result[k].qp_data.qp_data[i].rule, result[k].qp_data.qp_data[i].value, data[0].overall_rating);
                                                profile_data[k].qp_data.qp_data[i].actual_value = data[0].overall_rating;
                                                break;
                                        }
                                        profile_data[k].qp_data.qp_data[i].status = status;
                                    }
                                }
                                dashboardData.quality_profile.data = profile_data[0].qp_data.qp_data;
                                var statusArray = _.findWhere(profile_data[0].qp_data.qp_data, { status: 'failed' });
                                if (statusArray == undefined)
                                    dashboardData.quality_profile.status = 'passed';
                                else
                                    dashboardData.quality_profile.status = 'failed';

                                callback(null, data);
                            });
                        }
                        else
                        {
                            callback(null, []);
                        }
                    });
            },
            task_details: function (callback) {

                /*
                Description: Initially the query fetched task count only at the root level. The change made now fetches task at
                child level as well
                create date: 20-june-2018
                Author: Abhijit Sanke
                */
                sql_query = `SELECT tc.task_criticality_name, COUNT(task_id)
                            FROM task t, task_criticality tc, task_status ts, subsystems sub
                            WHERE t.task_criticality = tc.task_criticality_id
                            AND t.task_status = ts.task_status_id
                            AND ts.task_status_name IN ('open', 'reopened')
                            AND(node_id = $1 OR node_path like any(values('%.' || $1 || '.%'), ($1 || '.%')))
                            AND sub.subsystem_uid = t.subsystem_uid
                            AND sub.tenant_id = $2
                            GROUP BY tc.task_criticality_name`;

                /*sql_query = `SELECT tc.task_criticality_name, COUNT(task_id)
                            FROM task t, task_criticality tc, task_status ts, subsystems sub
                            WHERE t.task_criticality = tc.task_criticality_id
                            AND t.task_status = ts.task_status_id
                            AND ts.task_status_name IN ('open','reopened')
                            AND (node_id = $1 OR node_path LIKE '$1')
                            AND sub.subsystem_uid = t.subsystem_uid
                            AND sub.tenant_id =$2
                            GROUP BY tc.task_criticality_name `;*/
                req.gamma.query(sql_query, [req.query.node_id, req.session.tenant_id],next)
                    .then(data => {
                        // var jiraDetailsArray = getJiraDetails(req, res, next);
                        // log.info(jiraDetailsArray);
                        var key, value;
                        for(var i=0; i<data.length; i++){
                            key = _.values(data[i])[0];
                            value = _.values(data[i])[1];
                            dashboardData.tasks[key] = value;
                        }
                        callback(null, data);
                    });
            },
            test_hungry: function (callback) {

                sql_query = `select count(ro.nodeid) as value
                            from rule_occurrences ro
                            join ruletypes rt on ro.ruletypeid=rt.id
                            join nodes n on n.id=ro.nodeid
                            join nodes np on n.parentid = np.id
                            join measurements m
                            on (ro.snapshotid = m.snapshotid and ro.nodeid = m.nodeid)
                            left join method_coverage mc
                            on (ro.nodeid = mc.nodeid and ro.snapshotid = mc.snapshotid)
                            where rt.name='TestHungry'
                            and ro.snapshotid = (SELECT id FROM snapshots WHERE subsystem_id = $1 AND id=$2 AND (status = 'P' or status = 'K') ORDER BY id DESC LIMIT 1)
                            and m.measureid = (select id from measures where measurename='LOC')
                            and m.value > 0
                            and np.kind is not null
                            and ((COALESCE( mc.linescovered , 0.01 ))/m.value) < 0.5`;
                req.corona.query(sql_query, [req.query.repository_id, req.query.snapshot_id],next)
                    .then(data => {
                        if(data.length)
                            dashboardData.test_coverage.rating = data[0].value;
                        callback(null, data);
                    });
            },
            unit_tests: function (callback) {
                sql_query = `select test_status,count(id) from unit_test
                        where test_snapshot_id = (SELECT id FROM snapshots WHERE subsystem_id = $1 AND id=$2 AND (status = 'P' or status = 'K') ORDER BY id DESC LIMIT 1)
                        group by test_status `;
                req.corona.query(sql_query, [req.query.repository_id, req.query.snapshot_id],next)
                    .then(data => {
                        if(data.length)
                        {
                            var total_count = 0;
                            data.forEach(function(element) {
                                if(element.test_status != 'IGNORED')
                                    total_count = total_count + parseInt(element.count);
                            });
                            dashboardData.unit_tests.value = (data.filter(d=>(d.test_status).trim() == 'SUCCESS'))[0].count;
                            dashboardData.unit_tests.total = total_count;
                            dashboardData.unit_tests.status= 'passed';
                        }
                        callback(null, data);
                    });
            },
            code_coverage: function (callback) {

                sql_query = `select mc.snapshotid,m.value as total_lines, sum(mc.linescovered) as covered_lines from method_coverage mc, measurements m
                            where mc.snapshotid = m.snapshotid
                            and m.measureid = (select id from measures where measurename='LOC')
                            and mc.snapshotid in (SELECT id FROM snapshots WHERE subsystem_id = $1 AND id=$3 AND (status = 'P' or status = 'K') ORDER BY id DESC LIMIT 2)
                            and m.nodeid=$2
                            group by mc.snapshotid,m.value
                            order by snapshotid desc `;
                req.corona.query(sql_query, [req.query.repository_id, req.query.node_id, req.query.snapshot_id],next)
                    .then(data => {
                        if(data.length)
                        {
                            if(data.length == 2)
                            {
                                dashboardData.code_coverage.rating      = parseInt(data[0].covered_lines) / parseInt(data[0].total_lines) *100;
                                dashboardData.code_coverage.float_value = (parseInt(data[0].covered_lines) / parseInt(data[0].total_lines) * 100) - (parseInt(data[1].covered_lines) / parseInt(data[1].total_lines) * 100);
                                if (dashboardData.code_coverage.float_value > 0)
                                    dashboardData.code_coverage.float_type = 1
                                else
                                    dashboardData.code_coverage.float_type = 0;
                            }
                            else
                            {
                                dashboardData.code_coverage.rating      = parseInt(data[0].covered_lines) / parseInt(data[0].total_lines) * 100;
                                dashboardData.code_coverage.float_value = dashboardData.code_coverage.rating;
                                dashboardData.code_coverage.float_type = 1;
                            }
                        }
                        callback(null, data);
                    });
            }
        },
    //Callback function, called once all above functions in array are executed.
    //If there is an error in any of the above functions then its called immediately without continuing
    // with remaining functions
    function () {
        res.json(dashboardData);
    });
}

export function getJiraDetails(req, res, next) {
    var sql_query = `select * from jira_details where repository_uid = $1 and tenant_id =$2`;
    req.gamma.query(sql_query, [req.params.repositoryUid, req.session.tenant_id])
    .then(data=>{
        if (data.length > 0) {
            var fileDTO = '';
            if (data[0].type == 'open') {

                fileDTO = {
                    "username": 'anonymous',
                    "password": 'anonymous'
                };
            }else{
                fileDTO = {
                    "username": cf.decryptStringWithAES(data[0].username),
                    "password": cf.decryptStringWithAES(data[0].password)
                };
            }
            request({
                url: data[0].host_name + 'rest/auth/1/session',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                rejectUnauthorized: false,
                json: fileDTO
            }, function (error, response, body) {
                if (error) {
                      reject(new errors.ServiceUnavailable("Embold service unavailable", 1021));

                }
                else {
                    if (response.statusCode == 500) {
                        log.info("INTERNAL SERVER ERROR");
                        reject(new errors.ServiceUnavailable("Embold service unavailable", 1021));
                       
                    }
                    else if (response.statusCode == 404) {
                        log.info("GAMMA SERVICE IS DOWN :== DISCARDING");
                        reject(new errors.ServiceUnavailable("Embold service unavailable", 1021));
                        
                    }
                    else {
                        var session = body.session;
                        var request_string = '';
                        if (data[0].type == 'open') {
                            request_string = {
                                url: data[0].host_name + 'rest/api/2/project/' + data[0].project_key.toUpperCase(),
                                method: 'GET',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                rejectUnauthorized: false,
                                json: {}
                            }
                        } else {
                            request_string = {
                                url: data[0].host_name + 'rest/api/2/project/' + data[0].project_key.toUpperCase(),
                                method: 'GET',
                                headers: {
                                    cookie: session.name + '=' + session.value,
                                    'Content-Type': 'application/json'
                                },
                                rejectUnauthorized: false,
                                json: {}
                            }
                        }
                        request(request_string, function (error, response, body) {
                            if (error) {
                                reject(new errors.ServiceUnavailable("Embold service unavailable", 1021));               
                            }
                            else {
                                if (response.statusCode == 500) {
                                    log.info("INTERNAL SERVER ERROR");
                                    reject(new errors.ServiceUnavailable("Embold service unavailable", 1021));

                                }
                                else if (response.statusCode == 404) {
                                    log.info("GAMMA SERVICE IS DOWN :== DISCARDING");
                                        reject(new errors.ServiceUnavailable("Embold service unavailable", 1021));          
                                }
                                else {
                                    log.debug(response.body.id);
                                    var request_string2 = '';
                                    if (data[0].type == 'open') {
                                        request_string2 = {
                                            url: data[0].host_name + 'rest/gadget/1.0/stats/generate.json?projectOrFilterId=project-' + response.body.id + '&statType=issuetype&includeResolvedIssues=true&sortDirection=desc&sortBy=total',
                                            method: 'GET',
                                            headers: {
                                                'Content-Type': 'application/json'
                                            },
                                            rejectUnauthorized: false,
                                            json: {}
                                        }
                                    } else {
                                        request_string2 = {
                                            url: data[0].host_name + 'rest/gadget/1.0/stats/generate.json?projectOrFilterId=project-' + response.body.id + '&statType=issuetype&includeResolvedIssues=true&sortDirection=desc&sortBy=total',
                                            method: 'GET',
                                            headers: {
                                                cookie: session.name + '=' + session.value,
                                                'Content-Type': 'application/json'
                                            },
                                            rejectUnauthorized: false,
                                            json: {}
                                        }
                                    }

                                    request(request_string2, function (error, response, body) {
                                        if (error) {
                                                reject(new errors.ServiceUnavailable("Embold service unavailable", 1021));
                                           
                                        }
                                        else {
                                            if (response.statusCode == 500) {
                                                log.info("INTERNAL SERVER ERROR");
                                                reject(new errors.ServiceUnavailable("Embold service unavailable", 1021));

                                            }
                                            else if (response.statusCode == 404) {
                                                log.info("GAMMA SERVICE IS DOWN :== DISCARDING");
                                                reject(new errors.ServiceUnavailable("Embold service unavailable", 1021));

                                            }
                                            else {
                                                log.debug(response.body);
                                            }
                                        }
                                    });
                                }
                            }
                        });
                    }

                }
            });
        }
        // res.json(data);
    });
}

function checkStatus(rule,threshold_value,actual_value){

    var status = '';
    if(rule === 'LESS'){
        if(parseFloat(actual_value) <= parseFloat(threshold_value)){
            status = 'success';
        }else{
            status = 'failed';
        }
    }else{
        if(parseFloat(actual_value) >= parseFloat(threshold_value)){
            status = 'success';
        }else{
            status = 'failed';
        }
    }
    return status;
}
