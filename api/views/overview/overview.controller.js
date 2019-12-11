import * as cf from './../../../utils/common-functions';
import async from 'async';
import _ from 'underscore';
import log from './../../../utils/logger';
let sqlQuery;
export async function index(req, res, next) {
    let projectId,snapshotId,rating,nodeId;
    if(req.query.project_id !="" || req.query.snapshot_id !="" || req.query.snapshot_id !=""){
        projectId = req.query.project_id;
        snapshotId = req.query.snapshot_id;
        nodeId = req.query.node_id;
        rating    = 'overallRating';
    }
    else{
        return next(new errors.BadRequest("Please enter valid parameters).", 1000));
    }

    if(snapshotId == null )
    {
        sqlQuery = `select * from get_snap_max_id($1)`;
        req.corona.query(sqlQuery, [projectId],next)
        .then(data=>{
            return callToJson(projectId,nodeId, data[0].get_snap_max_id, rating, req, res, next);
        });
    }
    else
    {
       return callToJson(projectId, nodeId,snapshotId, rating,req, res, next);
    }
}
function callToJson (projectId,nodeId, getSnapId, rating, req, res,next)
{
    async.parallel([
        function(callback)
        {
            composeJSONResponse(projectId,nodeId, getSnapId, rating, req, res, callback,next);
        }
    ],
    function(err, results){
        res.json(results[0]);
    });

}

function composeJSONResponse(projectId,nodeId, snaphShotId, rating, req, res, callback,next)
{
    //defining the projects Json array
    var project =  {
                        project_details: { snapshot :{ id:"", ts:"", tn:"" , version:"" }, loc:"", executable_loc:"",components:"",rating:"",last_run_ts:"", hotspots:"", hotspots_loc:"" },
                        health_trend: [],
                        categories:[
                                        { type: "",rating: 0, component_issue_details:{} , subcomponent_issue_details:{} },
                                        { type: "",rating: 0},
                                        { type: "duplication",rating: 0, value:0, duplication_details: { clones: 0, average_clone_size: 0, duplicate_components:0 } },
                                        { type: "",rating: 0,code_issue_details: { } },
                                        { type: "overallRating" }
                                    ]
                    };

    var locType   = new Array('LOC','NOS');

    async.parallel({
        project_details: function(callback)
        {
            //project details
            sqlQuery = `select components,rating from get_subsystems_details_with_rating($1,'${rating}',$2)`;
            req.corona.query(sqlQuery, [projectId, snaphShotId],next)
                .then(data=>{
                    callback(null,data);
                });
        },
        snapshot_details: function(callback)
        {
            sqlQuery = `select id, max(timestamp) as ts,version from snapshots where id=$1 group by id `;
            req.corona.query(sqlQuery, [snaphShotId],next)
                .then(data => {
                    callback(null, data);
                });
        },
        loc_details:function(callback)
        {
            sqlQuery = `select * from (select * from get_node_measure_count($1,'${locType[0]}',$2,$3) as loc) u
                        cross join (select * from get_node_measure_count($1,'${locType[1]}',$2,$3) as executable_loc) p`;
            req.corona.query(sqlQuery, [projectId, snaphShotId, nodeId],next)
                .then(data => {
                    callback(null, data);
                });
        },
        hotspot_details: function(callback)
        {
            //hotspot details
            sqlQuery = `select * from get_hotspots_detail($1,'${rating}',$2)`;
            req.corona.query(sqlQuery, [projectId, snaphShotId],next)
                .then(data => {
                    callback(null, data);
                });
        },
        health_trend: function(callback)
        {
            //health trend details
            sqlQuery = `select * from get_subsystems_health_trend($1,'${rating}')`;
            req.corona.query(sqlQuery, [projectId],next)
                .then(data => {
                    callback(null, data);
                });
        },
        design_rating: function(callback)
        {
            //Design ratings
            sqlQuery = `select 'design_issues' as type,get_subsystem_rating($1,'antiPatternRating',$2) rating`;
            req.corona.query(sqlQuery, [projectId, snaphShotId],next)
                .then(data => {
                    callback(null, data);
                });
        },
        design_issues_components: function(callback)
        {
            //design issue count and component
            sqlQuery = `select * from get_subsystems_component_subcomponent_design_issue_details($1,$2,'C')`;
            req.corona.query(sqlQuery, [projectId, snaphShotId],next)
                .then(data => {
                    callback(null, data);
                });
        },
		design_issues_subcomponents: function(callback)
        {
            //design issue count and component
            sqlQuery = `select * from get_subsystems_component_subcomponent_design_issue_details($1,$2,'S')`;
            req.corona.query(sqlQuery, [projectId, snaphShotId],next)
                .then(data => {
                    callback(null, data);
                });
        },
        metric_rating: function(callback)
        {
            //Metric rating
            sqlQuery = `select 'metrics' as type,get_subsystem_rating($1,'metricRating',$2) rating`;
            req.corona.query(sqlQuery, [projectId, snaphShotId],next)
                .then(data => {
                    callback(null, data);
                });
        },
        metric_details: function(callback)
		{
			sqlQuery = `select * from get_metric_violating_components_count($1,$2)`;
            req.corona.query(sqlQuery, [snaphShotId, projectId],next)
                .then(data => {
                    callback(null, data);
                });
		},
        clone_loc: function(callback)
        {
            sqlQuery = `select (select * from get_node_duplicate_loc_count($1,$2)) as duplicate_loc`;
            req.corona.query(sqlQuery, [snaphShotId, nodeId],next)
                .then(data => {
                    callback(null, data);
                });
        },
        clone_rating: function(callback)
        {
            //Duplication rating
            sqlQuery = `select get_subsystem_rating($1,'cloneRating',$2) as rating,
                        get_subsystem_clone_value($1,$2)as value`;
            req.corona.query(sqlQuery, [projectId, snaphShotId],next)
                .then(data => {
                    callback(null, data);
                });
        },
		clone_details: function(callback)
		{
			sqlQuery = `select sum(numberofclones)as clones ,(sum(totalduplicationlinecount)/count(*)) as average_clone_size,count(*) as duplicate_components
                         from 	clonestatistics,nodes n  where snapshotid=$1 and n.id=clonestatistics.nodeid and n.subsystem_id=$2 and n.excluded=false`;
            req.corona.query(sqlQuery, [snaphShotId, projectId],next)
                .then(data => {
                    callback(null, data);
                });
		},
        codequality_rating: function(callback)
        {
            sqlQuery = `select 'code_issues' as type,get_subsystem_rating($1,'codeQualityRating',$2) rating`;
            req.corona.query(sqlQuery, [projectId, snaphShotId],next)
                .then(data => {
                    callback(null, data);
                });
        },
        code_issues_details: function(callback)
		{
			sqlQuery = `select * from get_overall_code_issues($1,$2);`;
            req.corona.query(sqlQuery, [projectId, snaphShotId],next)
                .then(data => {
                    callback(null, data);
                });
		},
        code_issues_exist: function(callback)
        {
           sqlQuery = `select count(*) as cnt from code_issues`;
            req.corona.query(sqlQuery, [],next)
                .then(data => {
                    callback(null, data);
                });
        },
        critical_components: function (callback)
        {
            sqlQuery = `select * from (
                                        SELECT rv.nodeid, r.rating, n.displayname, n.signature, nt.classification, rv.rating_value,
                                            ROW_NUMBER() OVER (PARTITION BY ratingid
                                                    ORDER BY rating_value ASC
                                                    )
                                            AS rn
                                        FROM ratings_values rv, ratings r, nodes n, node_types nt
                                        where rv.ratingid = r.id and snapshotid = $1
                                        and rv.nodeid=n.id
                                        and n.subsystem_id=$2
                                        and n.nodetype = nt.id
                                        and nt.classification = 'COMPONENTS'
                                        ORDER BY rv.ratingid, rn
                                        ) completeData
                                        where completeData.rn <=5`;
            req.corona.query(sqlQuery, [snaphShotId, projectId],next)
                .then(data => {
                    callback(null, data);
                });
        }
    },
    //Callback function, called once all above functions in array are executed.
    //If there is an error in any of the above functions then its called immediately without continuing
    // with remaining functions
    function(err, results){
        if(typeof results.project_details == 'undefined' )
        {
            res.json(project);
			//return callback(project,null);
		}
        else
        {

            if(results.project_details[0] != null)
            {
                var i=0;

                project.project_details.loc = results.loc_details[0].loc;
                project.project_details.executable_loc = results.loc_details[0].executable_loc;
                project.project_details.components = results.project_details[0].components;
                project.project_details.rating = cf.convertToRange(results.project_details[0].rating);
                project.project_details.hotspots = results.hotspot_details[0].hotspots;
                project.project_details.hotspots_loc = results.hotspot_details[0].hotspots_loc;

                project.project_details.snapshot.id = results.snapshot_details[0].id;
                project.project_details.snapshot.ts = results.snapshot_details[0].ts;
                project.project_details.snapshot.version = results.snapshot_details[0].version;

                /*for(i=0; i<results.health_trend.length; i++)
                {
                    results.health_trend[i].rating = cf.convertToRange(results.health_trend[i].rating);
                }*/
                (results.health_trend).forEach(d=>d.rating=cf.convertToRange(d.rating));

                project.health_trend         = results.health_trend;
                project.categories[0].type   = results.design_rating[0].type;
                project.categories[0].rating = cf.convertToRange(results.design_rating[0].rating);

                for(i=0; i < results.design_issues_components.length; i++)
                {
                    project.categories[0].component_issue_details[results.design_issues_components[i].criticality] = results.design_issues_components[i].count;
                }

                for(i=0; i < results.design_issues_subcomponents.length; i++)
                {
                    project.categories[0].subcomponent_issue_details[results.design_issues_subcomponents[i].criticality] = results.design_issues_subcomponents[i].count;
                }

                let sortArray = ['critical', 'high', 'medium', 'med', 'low', 'info'];
                let finalComponentIssueDetails = {}, finalSubcomponentIssueDetails = {};
                sortArray.forEach(d => {
                    if (project.categories[0].component_issue_details[d])
                        finalComponentIssueDetails[d] = project.categories[0].component_issue_details[d];

                    if (project.categories[0].subcomponent_issue_details[d])
                        finalSubcomponentIssueDetails[d] = project.categories[0].subcomponent_issue_details[d];
                });
                project.categories[0].component_issue_details = finalComponentIssueDetails;
                project.categories[0].subcomponent_issue_details = finalSubcomponentIssueDetails;

                project.categories[1].type   = results.metric_rating[0].type;
                project.categories[1].rating = cf.convertToRange(results.metric_rating[0].rating);

                project.categories[1].metric_details = {};
                (results.metric_details).forEach(d => { project.categories[1].metric_details[d.type] = d.value});

                project.categories[2].rating = cf.convertToRange(results.clone_rating[0].rating);
                project.categories[2].value  = results.clone_rating[0].value == null ? 0 : results.clone_rating[0].value;

                project.categories[2].duplication_details.clones               = results.clone_details[0].clones== null ? 0 : results.clone_details[0].clones;
                project.categories[2].duplication_details.duplicate_loc        = results.clone_loc[0].duplicate_loc== null ? 0 : results.clone_loc[0].duplicate_loc;
                project.categories[2].duplication_details.average_clone_size   = results.clone_details[0].average_clone_size== null ? 0 : results.clone_details[0].average_clone_size;
                project.categories[2].duplication_details.duplicate_components = results.clone_details[0].duplicate_components== null ? 0 : results.clone_details[0].duplicate_components;

                if(results.code_issues_exist.cnt == 0){
                    project.categories[3].rating = 'NA';
                }else{
                    project.categories[3].rating = cf.convertToRange(results.codequality_rating[0].rating);
                }
                project.categories[3].type   = results.codequality_rating[0].type;
                if(results.code_issues_details.length) // if code issues are not present
                {
                    sortArray = ['critical', 'high', 'medium', 'low', 'uncategorised'];
                    var finalCodeIssues = {},
                        filterCodeIssue = [];
                    sortArray.forEach(d => {
                        filterCodeIssue = (results.code_issues_details).filter(d1 => d1.category == d);
                        if (filterCodeIssue.length) {
                            finalCodeIssues[d] = filterCodeIssue[0].value;
                        }
                    });
                    project.categories[3].code_issue_details = finalCodeIssues;
                }
                else{
                    project.categories[3].rating = 'NA';
                }

                project.critical_components = _.groupBy(results.critical_components, 'rating');
                //project.node_list = results.overall_node_list;

                return callback(null,project);
            }
            else
            {
                res.json(project);
            }
        }

    });

}


