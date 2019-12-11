
import * as cf from '../../../utils/common-functions';
import async from 'async';
import _ from 'underscore';
import { getCodeIssuesTagsKpis } from './../../v1/repository/codeIssues/codeIssues.services';
const errors = require('throw.js');

export async function getDuplicationOccurrence (req,res,next) {
    var responseJson = { "component_list":[] };

    async.parallel({
            clone_details: function(callback) {
                let sqlQuery = `select c.id as clone_id,c.firstline as clone_name, c.linecount as clone_size from clones c where c.id=$1`;
                req.corona.query(sqlQuery, [req.query.clone_id],next)
                    .then(data => {
                        callback(null, data);
                    });
            },
            component_details: function(callback) {
                let sqlQuery = `select * from get_clone_component_details($1,$2) where id <> $3`;
                req.corona.query(sqlQuery, [req.query.snapshot_id, req.query.clone_id, req.query.component_id],next)
                    .then(data => {
                        callback(null, data);
                    });
            },
            file_details: function(callback) {
                let sqlQuery = `select * from get_clone_component_file_details($1,$2)`;
                req.corona.query(sqlQuery, [req.query.snapshot_id, req.query.clone_id],next)
                    .then(data => {
                        callback(null, data);
                    });
            },
            occur_details: function(callback){
                let sqlQuery = `select * from get_clone_component_file_occurence_details($1,$2)`;
                req.corona.query(sqlQuery, [req.query.snapshot_id, req.query.clone_id],next)
                    .then(data => {
                        callback(null, data);
                    });
            }
        },
        //Callback function, called once all above functions in array are executed.
        //If there is an error in any of the above functions then its called immediately without continuing
        // with remaining functions
        function(err, results) {

            // assign clone details

            responseJson = results.clone_details[0];
            // assign component details in which clone exists

            responseJson.component_list = results.component_details;

            var i = 0,counter=0,counter1=0;
            for(i=0; i < results.component_details.length ; i++)
            {
                var j=0;
                for(j=0; j< results.file_details.length ;j ++ )
                {
                    counter = -1;
                    if(results.component_details[i].id == results.file_details[j].id )
                    {

                        results.component_details[i].files= [];
                        // assign files details in which clone exists
                        results.component_details[i].files.push(results.file_details[j]);
                        counter++;

                        var k=0;
                        counter1 = -1;
                        for(k=0; k < results.occur_details.length; k++)
                        {

                            if(results.occur_details[k].nodeid == results.file_details[j].id && results.occur_details[k].fileid == results.file_details[j].fileid )
                            {
                                if(counter1 == -1)
                                    results.component_details[i].files[counter].occurrence = [];
                                counter1++;
                                // assign clone occurrence detail in particular file ( start, end lines)
                                results.component_details[i].files[counter].occurrence.push(results.occur_details[k]);
                            }
                        }
                    }

                }
            }
            // output response json
            res.json(responseJson);

        });

}

export function getComponentSummary(req, res,next) {
    var loc_type   = new Array('LOC','NOS');
    var component_summary = {
        "component_name": "",
        "component_type": "",
        "sig": "",
        "rating": [],
        "antipatterns": [

        ],
        "metrics": [

        ],
        "duplication": {
            "duplicate_loc": "",
            "clones": "",
            "occurences": ""
        },
        "issues_count": "",
        'code_issues': [],
        "loc_details":{
            "exec_loc":"",
            "total_loc":""
        },
        "issues":"",
        "tasks":"",
        "tags_data":[]
    };

    async.parallel({
            component_details: function(callback) {
                let sqlQuery = `select * from get_component_details($1,$2,$3)`;
                req.corona.query(sqlQuery, [req.query.project_id, req.query.snapshot_id, req.query.component_id],next)
                    .then(data => {
                        callback(null, data);
                    });
            },
            risk_details: function (callback) {
                let sqlQuery = `select rating,synopsis from relevance where nodeid=$1 and snapshot_id=$2`;
                req.corona.query(sqlQuery, [req.query.component_id, req.query.snapshot_id],next)
                    .then(data => {
                        callback(null, data);
                    });
            },
            rating_details: function(callback) {
                let sqlQuery = `select * from get_component_rating_details($1,$2,$3)`;
                req.corona.query(sqlQuery, [req.query.project_id, req.query.snapshot_id, req.query.component_id],next)
                    .then(data => {
                        if (data.length && data[0].name)
                            callback(null, data);
                        else {
                            var error = new Error();
                            error.code = 'GAMMA_NO_DATA_FOR_SNAPSHOT';
                            callback(error, null);
                        }
                    });
            },
            antipattern_details: function(callback) {
                let sqlQuery = `select name,synopsis,(select '') as first_detected from get_component_antipattern_details($1,$2)`;
                req.corona.query(sqlQuery, [req.query.snapshot_id, req.query.component_id],next)
                    .then(data => {
                        callback(null, data);
                    });
            },
            metric_details: function(callback) {
                let sqlQuery = `select * from get_component_metric_details($1,$2,$3)`;
                req.corona.query(sqlQuery, [req.query.project_id, req.query.snapshot_id, req.query.component_id],next)
                    .then(data => {
                        callback(null, data);
                    });
            },
            code_issues_details: function(callback) {
                let sqlQuery = `select co.id as issue_id ,ci.name,co.file_id,ci.category as type,co.synopsis,co.line_num  as line_number from code_issues ci,code_issues_occurrences co
                             where co.code_issue_id=ci.id and co.snapshot_id=$1 and co.component_id=$2`;
                req.corona.query(sqlQuery, [req.query.snapshot_id, req.query.component_id],next)
                    .then(data => {
                        callback(null, data);
                    });
            },
            duplication_details: function(callback) {
                let sqlQuery = `select * from get_component_clone_details($1,$2)`;
                req.corona.query(sqlQuery, [req.query.snapshot_id, req.query.component_id],next)
                    .then(data => {
                        callback(null, data);
                    });
            },
            loc_count_details:function(callback)
            {
                let sqlQuery = `select (select * from get_node_measure_count($1,$2,$3,$4)) as loc,
                            (select * from get_node_measure_count($1,$5,$3,$4)) as total_loc`;
                req.corona.query(sqlQuery, [req.query.project_id, loc_type[1], req.query.snapshot_id, req.query.component_id, loc_type[0]],next)
                    .then(data => {
                        callback(null, data);
                    });
            } ,
            get_issues: function (callback) {
                let sqlQuery = `select sum(count) from (select count(*) from get_code_issues_for_node($1,$2)
                            UNION ALL select count(*) from get_designissues_for_node($1,$2)) as data`;
                req.corona.query(sqlQuery, [req.query.component_id, req.query.snapshot_id],next)
                    .then(data => {
                        callback(null, data);
                    });
            },
            get_allocated_tag: function (callback) {
                let sqlQuery = `select tag_uid from node_tags where subsystem_id=$1 and node_tags.node_id=$2`;
                req.corona.query(sqlQuery,[req.query.project_id, req.query.component_id],next)
                .then(data=>{
                    var uid_string  = (_.pluck(data,'tag_uid')).join("','");
                    uid_string      = `'${uid_string}'`;
                    let sqlQuery = `select tc.id,tc.name,t.tag_uid||':'||t.name||':'||t.tag_color as allocated_tags from tags t,tag_category tc where tc.id=t.category_id and tag_uid in(${uid_string})`;
                    req.gamma.query(sqlQuery,[],next)
                    .then(data1=>{
                        callback(null,data1);
                    });
                });
            }
        },
        //Callback function, called once all above functions in array are executed.
        //If there is an error in any of the above functions then its called immediately without continuing
        // with remaining functions
        function(err, results) {

            // assign component basic details
            component_summary.component_name = results.component_details.component_name;
            component_summary.component_type = results.component_details.component_type;
            component_summary.sig            = results.component_details.sig;
            if (results.risk_details.length) {
                component_summary.risk = parseFloat(results.risk_details[0].rating).toFixed(2);
                component_summary.synopsis = results.risk_details[0].synopsis;
            }
            else {
                component_summary.risk = 'NA';
                component_summary.synopsis = '';
            }

            // assign rating values
            if (results.rating_details[0].name != null) component_summary.rating = results.rating_details;
            // assign antipattern values
            if (results.antipattern_details[0].name != null) component_summary.antipatterns = results.antipattern_details;
            //assign metric values
            if (results.metric_details.length > 0 && results.metric_details[0].type != null) component_summary.metrics = results.metric_details;

            if (results.duplication_details[0].duplicate_loc == null) results.duplication_details[0].duplicate_loc = "";
            if (results.duplication_details[0].clones == null) results.duplication_details[0].clones = "";
            if (results.duplication_details[0].occurences == null) results.duplication_details[0].occurences = "";
            //assign duplication values
            component_summary.duplication.duplicate_loc = results.duplication_details[0].duplicate_loc;
            component_summary.duplication.clones        = results.duplication_details[0].clones;
            component_summary.duplication.occurences    = results.duplication_details[0].occurences;
            if (results.code_issues_details.length > 0 && results.code_issues_details != null) {
                results.code_issues_details.forEach(code_issue=>{
                    code_issue.formed_issue_id = "CI"+code_issue.issue_id;
                    code_issue.issue_id = code_issue.issue_id;
                    component_summary.code_issues.push(code_issue);
                });
            }

            component_summary.issues    = results.get_issues[0].sum;
            component_summary.loc_details.exec_loc=results.loc_count_details[0].loc;
            component_summary.loc_details.total_loc = results.loc_count_details[0].total_loc;
            component_summary.tags_data = results.get_allocated_tag;

            res.json(component_summary);


        });

}

export async function getComponentSummaryDetails(req, res,next) {
    var component_summary_details = {
        'files': [],
        'code_issues': [],
        'antipatterns': [],
        'duplication': []
    };

    async.parallel({
            files_details: function(callback) {
                let sqlQuery = `select * from get_component_file_details($1,$2,$3)`;
                req.corona.query(sqlQuery, [req.query.project_id ,req.query.snapshot_id, req.query.component_id],next)
                    .then(data => {
                        callback(null, data);
                    });
            },
            file_metric_details: function(callback) {
                let sqlQuery = `select * from get_file_metric_data($1, $2, $3)`;
                req.corona.query(sqlQuery, [req.query.component_id, req.query.project_id, req.query.snapshot_id],next)
                    .then(data => {
                        callback(null, data);
                    });
            },
            occurence_details: function(callback) {
                let sqlQuery = `select * from get_clone_occurrence_details($1,$2) order by cloneid`;
                req.corona.query(sqlQuery, [req.query.snapshot_id, req.query.component_id],next)
                    .then(data => {
                        callback(null, data);
                    });
            },
            code_issues_details: function(callback) {
                let sqlQuery = `select co.id as issue_id,ci.name,co.file_id,ci.category as type,co.synopsis,co.line_num  as line_number,ax.name as module_name,ci.name as rule_key,co.is_suppress,co.suppression_id,co.code_issue_id from code_issues ci inner join code_issues_occurrences co on  co.code_issue_id=ci.id and co.snapshot_id=$1 and co.component_id=$2 inner join auxmods ax on ax.id=ci.auxmod_id`;
                req.corona.query(sqlQuery, [req.query.snapshot_id, req.query.component_id],next)
                    .then(data => {
                        callback(null, data);
                    });
            },
            antipattern_details: function(callback) {
                let sqlQuery = `select * from get_component_file_antipattern_details($1,$2,$3)`;
                req.corona.query(sqlQuery, [req.query.project_id, req.query.snapshot_id, req.query.component_id],next)
                    .then(data => {
                        callback(null, data);
                    });
            },
            clone_details: function(callback) {
                let sqlQuery = `select * from get_component_duplication_file_details($1,$2)`;
                req.corona.query(sqlQuery, [req.query.snapshot_id, req.query.component_id],next)
                    .then(data => {
                        callback(null, data);
                    });
            }
        },
        //Callback function, called once all above functions in array are executed.
        //If there is an error in any of the above functions then its called immediately without continuing
        // with remaining functions
        function(err, results) {
            var i;
            if (results.files_details != null && results.files_details.length > 0)
            {

                for (i = 0; i < results.files_details.length; i++)
                {
                    var path = results.files_details[i].sig;
                    path = cf.replace_slash(path);

                    var files_details_json = {
                        "id": "",
                        "name": "",
                        "language": "",
                        "start_line":"",
                        "end_line":"",
                        "file_path": "",
                        "file_method_metrics":[]
                    };

                    files_details_json.id         = results.files_details[i].id;
                    files_details_json.start_line = results.files_details[i].start_line;
                    files_details_json.end_line   = results.files_details[i].end_line;
                    files_details_json.name       = results.files_details[i].name;
                    files_details_json.language   = results.files_details[i].language;
                    files_details_json.file_path  = path;
                    files_details_json.file_method_metrics = (results.file_metric_details).filter(d => d.file_id == results.files_details[i].id);

                    component_summary_details.files.push(files_details_json);
                }

            }

            if (results.code_issues_details.length > 0 && results.code_issues_details != null) {
                results.code_issues_details.forEach(code_issue=>{
                    code_issue.formed_issue_id = "CI"+code_issue.issue_id;
                    code_issue.issue_id = code_issue.issue_id;
                    component_summary_details.code_issues.push(code_issue);
                });
            }

            if (results.antipattern_details != null && results.antipattern_details.length > 0) {
                results.antipattern_details.forEach(antipattern=>{
                    antipattern.formed_issue_id = "DI"+antipattern.issue_id;
                    component_summary_details.antipatterns.push(antipattern);
                });
            }

            // Duplication details
            var arr = [];
            for (i = 0; i < results.clone_details.length; i++)
            {
                var clone_details = {
                    'clone_name': "", // first line of the clone
                    'synopsis': "",
                    'clone_size': "", // LOC of clone
                    'occurrence': [],
                    'occurrenceInOtherComponents': {
                        'component_count': "",
                        'occurrence': ""
                    }
                };
                if (results.clone_details[i].clone_id == null && results.clone_details[i].clone_name == null && results.clone_details[i].occurrence == null && results.clone_details[i].component_count == null) {
                    //no elements added
                    //arr.push();
                } else {
                    if (results.clone_details[i].clone_name      == null) results.clone_details[i].clone_name = '';
                    //if(results.clone_details[i].synopsis       == null) results.clone_details[i].synopsis = '';
                    if (results.clone_details[i].clone_size      == null) results.clone_details[i].clone_size = '';
                    if (results.clone_details[i].component_count == null) results.clone_details[i].component_count = '';
                    if (results.clone_details[i].occurrence      == null) results.clone_details[i].occurrence = '';

                    if (results.occurence_details[0].file_id == null) {
                        results.occurence_details[0].file_id = '';
                        results.occurence_details[0].first_line_no = '';
                        results.occurence_details[0].last_line_no = '';
                    }

                    // clone details
                    clone_details.clone_name = results.clone_details[i].clone_name;
                    clone_details.clone_size = results.clone_details[i].clone_size;

                    // occurrence in component
                    var arr1 = [];
                    for (var k = 0; k < results.occurence_details.length; k++) {
                        if (results.occurence_details[k].cloneid == results.clone_details[i].cloneid) {
                            arr1.push(results.occurence_details[k]);
                        }

                    }

                    clone_details.occurrence = arr1;

                    // occurrence in other components details
                    clone_details.occurrenceInOtherComponents.component_count = results.clone_details[i].component_count;
                    clone_details.occurrenceInOtherComponents.occurrence      = results.clone_details[i].occurrence;

                    arr.push(clone_details);
                }

            }
            component_summary_details.duplication = arr;

            if (component_summary_details.code_issues.length) {
                getCodeIssuesTagsKpis(req, component_summary_details.code_issues, next)
                .then(codeIssues=>{
                    component_summary_details.code_issues = codeIssues;
                    res.json(component_summary_details);
                })
                .catch(error=>{
                    return next(new errors.InternalServerError(error.message, 1018));
                });
            }
            else {
                res.json(component_summary_details);
            }

    });
}

function getComponentGraphDetails(req, res,next) {
    var metric_rating_graph_details = {
        "snapshotList": []
    };

    async.parallel({
            component_details_graph: function(callback) {
                let sqlQuery = `select * from get_compenent_graph_details($1,$2,$3,$4)`;
                req.corona.query(sqlQuery, [req.query.project_id, req.query.component_id, req.query.parameter_type, req.query.parameter_id],next)
                    .then(data=>{
                        callback(null, data);
                    });
            }

        },
        //Callback function, called once all above functions in array are executed.
        //If there is an error in any of the above functions then its called immediately without continuing
        // with remaining functions
        function(err, results) {

            var i = "";
            var arr = [];
            for (i = 0; i < results.component_details_graph.length; i++) {
                if (results.component_details_graph[i].name != null) {
                    var graph_json = {
                        "ts": "",
                        "id": "",
                        "parameter": {
                            "name": "",
                            "value": ""
                        }
                    };
                    graph_json.ts                = results.component_details_graph[i].ts;
                    graph_json.id                = results.component_details_graph[i].id;
                    graph_json.parameter.name = results.component_details_graph[i].name;

                    if (req.query.parameter_type == 'ratings') {
                        graph_json.parameter.value = cf.convertToRange(results.component_details_graph[i].value);
                    } else {
                        graph_json.parameter.value = results.component_details_graph[i].value;
                    }


                    arr.push(graph_json);
                } else {
                    var graph_json_null = {
                        "ts": "",
                        "id": "",
                        "parameter": {}

                    };
                    graph_json_null.ts = results.component_details_graph[i].ts;
                    graph_json_null.id = results.component_details_graph[i].id;
                    arr.push(graph_json_null);
                }
            }
            metric_rating_graph_details.snapshotList = arr;
            res.json(metric_rating_graph_details);

        });
}
