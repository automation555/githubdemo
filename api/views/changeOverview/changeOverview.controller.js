import * as cf from './../../../utils/common-functions';
import async from 'async';
var sqlQuery;

function composeJSONResponse(projectid, snapshotid, rating, req, res, callback,next)
{
    //defining the projects Json array
    var project =  {
                        project_details: { snapshot :{ id:"", ts:"", tn:""}, loc:"", executable_loc:"",components:"",rating:"", hotspots:"", hotspots_loc:"" },
                        categories:[
                                        { type: "",rating: 0, issues:{} },
                                        { type: "",rating: 0, issues:{} },
                                        { type: "duplication",rating: 0, value:0,  },
                                        { type: "",rating: 0, issues:{} },
                                    ] 
                    };          
      var locType   = new Array('LOC','NOS');

    async.parallel({
        project_details: function(callback)
        {
            //project details
            sqlQuery = `select rating from get_subsystems_details_with_rating($1,$2,$3)`;
            req.corona.query(sqlQuery, [projectid, rating, snapshotid],next)
                .then(data => {
                    callback(null, data);
                });
        },
        snapshot_details: function(callback)
        {
            sqlQuery = `select id, max(timestamp) as ts from snapshots where id=$1 group by id`;
            req.corona.query(sqlQuery, [snapshotid],next)
                .then(data => {
                    callback(null, data);
                });
        },
        loc_details:function(callback)
        {
            sqlQuery = `select round(ms.value) as loc from nodes n,node_types nt,measurements ms,measures m
                            where nt.id=n.nodetype
                            and nt.classification='SUBSYSTEM' and n.subsystem_id=$1
                            and ms.nodeid=n.id  and ms.measureid=m.id
                            and m.measurename=$2 and ms.snapshotid=$3`;
            req.corona.query(sqlQuery, [projectid, locType[0], snapshotid],next)
                .then(data => {
                    callback(null, data);
                });
        },
        executable_loc_details:function(callback)
        {
            sqlQuery = `select round(ms.value) as executable_loc from nodes n,node_types nt,measurements ms,measures m
                        where nt.id=n.nodetype
                        and nt.classification='SUBSYSTEM' and n.subsystem_id=$1
                        and ms.nodeid=n.id  and ms.measureid=m.id
                        and m.measurename=$2 and ms.snapshotid=$3`;
            req.corona.query(sqlQuery, [projectid, locType[1], snapshotid],next)
                .then(data => {
                    callback(null, data);
                });
        },
        hotspot_details: function(callback)
        {
            //hotspot details
            sqlQuery = `select * from get_hotspots_detail($1,$2,$3)`;
            req.corona.query(sqlQuery, [projectid, rating, snapshotid],next)
                .then(data => {
                    callback(null, data);
                });
        },
        design_rating: function(callback)
        {
            //Design ratings
            sqlQuery = `select 'design_issues' as type,get_subsystem_rating($1,'antiPatternRating',$2) rating`;
            req.corona.query(sqlQuery, [projectid, snapshotid],next)
                .then(data => {
                    callback(null, data);
                });
        },
        metric_rating: function(callback)
        {
            //Metric rating
            sqlQuery = `select 'metrics' as type,get_subsystem_rating($1,'metricRating',$2) rating`;
            req.corona.query(sqlQuery, [projectid, snapshotid],next)
                .then(data => {
                    callback(null, data);
                });
        },
        clone_rating: function(callback)
        {
            //Duplication rating
            sqlQuery = `select get_subsystem_rating($1,'cloneRating',$2) as rating`;
            req.corona.query(sqlQuery, [projectid, snapshotid],next)
                .then(data => {
                    callback(null, data);
                });
        },
        codequality_rating: function(callback)
        {
            //Metric rating
            sqlQuery = `select 'code_issues' as type,get_subsystem_rating($1,'codeQualityRating',$2) rating`;
            req.corona.query(sqlQuery, [projectid, snapshotid],next)
                .then(data => {
                    callback(null, data);
                });
        }

    },
    //Callback function, called once all above functions in array are executed.
    //If there is an error in any of the above functions then its called immediately without continuing
    // with remaining functions
    function(err, results){
        
        results.project_details.rating = cf.convertToRange(results.project_details[0].rating);
        project.project_details.loc            = results.loc_details[0].loc;
        project.project_details.executable_loc = results.executable_loc_details[0].executable_loc;
        project.project_details.rating         = cf.convertToRange(results.project_details[0].rating);
        project.project_details.hotspots       = results.hotspot_details[0].hotspots;
        project.project_details.hotspots_loc   = results.hotspot_details[0].hotspots_loc;

        project.project_details.snapshot.id    = results.snapshot_details[0].id;
        project.project_details.snapshot.ts    = results.snapshot_details[0].ts;
                    
        project.categories[0].type   = results.design_rating[0].type;
        project.categories[0].rating = cf.convertToRange(results.design_rating[0].rating);    
        
        project.categories[1].type   = results.metric_rating[0].type;
        project.categories[1].rating = cf.convertToRange(results.metric_rating[0].rating);                                      
        
        project.categories[2].rating = cf.convertToRange(results.clone_rating[0].rating);    

        project.categories[3].rating = cf.convertToRange(results.codequality_rating[0].rating);   
        project.categories[3].type   = results.codequality_rating[0].type; 
        project.categories[3].issues = results.code_issues;
        return callback(null,project);  

    });

}

// function getPluginName()
// {
//     var pluginName = 'Change Overview';
//     return pluginName;
// }

export async function getChangeComponent (req,res,next) {
    var projectid,snapshotid,snapshotidNew;
    if(req.query.project_id != "" && req.query.snapshot_id_old != "" && req.query.snapshot_id_new != ""){
        projectid      = req.query.project_id;
        snapshotid     = req.query.snapshot_id_old;
        snapshotidNew = req.query.snapshot_id_new;
    }
    else{
        return next(new errors.BadRequest("Please enter valid parameters).", 1000));
    }
    var count          = 5;

    var outputJson =    {
                            "total_changed_components" : "",
                            "components_added":"",
                            "components_removed":"",
                            "hotspots_added":"",        // new added hotspot
                            "hotspots_created":"",      // new existing hotspot
                            "hotspots_deleted":"",      // deleted hotspot
                            "hotspots_removed":"",      // existing deleted hotspot
                            "hotspots_improved":"",     // existing improved hotspot
                            "hotspots_deteriorated":"", // existing deteriorated hotspot
                            "changed_components" : [],
                            "added_components" :  [],   // added components
                            "removed_components": []    // removed components
                        };
        async.parallel({
        change_node_details: function(callback)
        {
            sqlQuery = `select * from get_changeoverview_details($1,$2,$3,$4)`;
            req.corona.query(sqlQuery, [projectid, snapshotid, snapshotidNew, count],next)
                .then(data => {
                    callback(null, data);
                });
        },
        changeoverview_count_details:function(callback)
        {
            sqlQuery = `select (select * from get_changeoverview_node_detail_counts($1,$2,$3,1)) as new_hotspot,
                        (select * from get_changeoverview_node_detail_counts($1,$2,$3,2)) as old_hotspot,
                        (select * from get_changeoverview_node_detail_counts($1,$2,$3,3)) as changed_nodes`;
            req.corona.query(sqlQuery, [projectid, snapshotid, snapshotidNew],next)
                .then(data => {
                    callback(null, data);
                });
        },
        new_added_hotspots: function(callback)
        {
        	sqlQuery = `select (select * from get_new_hotpsot_count($1,$2,$3))as cnt`;
            req.corona.query(sqlQuery, [projectid, snapshotid, snapshotidNew],next)
                .then(data => {
                    callback(null, data);
                });
        },
        old_deleted_hotspots:function(callback)
        {
        	sqlQuery = `select (select * from get_removed_hotpsot_count($1,$2,$3))as cnt`;
            req.corona.query(sqlQuery, [projectid, snapshotid, snapshotidNew],next)
                .then(data => {
                    callback(null, data);
                });
        },
        changeoverview_new_old_node_details:function(callback)
        {
            sqlQuery = `select * from get_changeoverview_new_old_nodes($1,$2,$3)`;
            req.corona.query(sqlQuery, [projectid, snapshotid, snapshotidNew],next)
                .then(data => {
                    callback(null, data);
                });
        },
        new_added_node_deatails:function(callback)
        {
            sqlQuery = `select * from get_changeoverview_new_added_components($1,$2,$3,$4)`;
            req.corona.query(sqlQuery, [snapshotidNew, snapshotid, projectid, count],next)
                .then(data => {
                    callback(null, data);
                });
        },
        improved_hostpot_count:function(callback)
        {
        	sqlQuery = `select (select * from get_improved_deteriorated_hostpot_count($1,$2,$3,1)) as cnt`;
            req.corona.query(sqlQuery, [projectid, snapshotid, snapshotidNew],next)
                .then(data => {
                    callback(null, data);
                });
        },
        deteriorated_hostpot_count:function(callback)
        {
        	sqlQuery = `select (select * from get_improved_deteriorated_hostpot_count($1,$2,$3,2)) as cnt`;
            req.corona.query(sqlQuery, [projectid, snapshotid, snapshotidNew],next)
                .then(data => {
                    callback(null, data);
                });
        },
        changeoverview_removed_compo_detail:function(callback)
        {
        	sqlQuery = `select * from get_changeoverview_removed_nodes_details($1,$2,$3,5)`;
            req.corona.query(sqlQuery, [projectid, snapshotid, snapshotidNew],next)
                .then(data => {
                    callback(null, data);
                });
        }

    },
    //Callback function, called once all above functions in array are executed.
    //If there is an error in any of the above functions then its called immediately without continuing
    // with remaining functions
    function(err, results){
        
        outputJson.total_changed_components = results.changeoverview_count_details[0].changed_nodes;
        outputJson.components_added = results.changeoverview_new_old_node_details[0].components_added;
        outputJson.components_removed = results.changeoverview_new_old_node_details[0].components_removed;
        outputJson.hotspots_added = results.new_added_hotspots[0].cnt; 
        outputJson.hotspots_created = results.changeoverview_count_details[0].new_hotspot;
        outputJson.hotspots_deleted = results.old_deleted_hotspots[0].cnt; 
        outputJson.hotspots_removed = results.changeoverview_count_details[0].old_hotspot;
        outputJson.hotspots_improved = results.improved_hostpot_count[0].cnt;
        outputJson.hotspots_deteriorated = results.deteriorated_hostpot_count[0].cnt;
        
        outputJson.changed_components.push(results.change_node_details);
        outputJson.added_components.push(results.new_added_node_deatails);
        outputJson.removed_components.push(results.changeoverview_removed_compo_detail);

        res.json(outputJson);            
           
    
    });                    

}
export async function getChangeOverview (req,res,next) {
    var projectid,snapshotid,snapshotidNew;
    if(req.query.project_id != "" && req.query.snapshot_id_old != "" && req.query.snapshot_id_new != ""){
        projectid      = req.query.project_id;
        snapshotid     = req.query.snapshot_id_old;
        snapshotidNew = req.query.snapshot_id_new;
    }
    else{
        return next(new errors.BadRequest("Please enter valid parameters).", 1000));
    }
    var rating         = 'overallRating';
    async.parallel([
        function(callback)
        {
            composeJSONResponse(projectid, snapshotid, rating, req, res, callback,next);
        },
        function(callback)
        {
            composeJSONResponse(projectid, snapshotidNew, rating, req, res, callback,next);
        }
    ],
    //Callback function, called once all above functions in array are executed.
    //If there is an error in any of the above functions then its called immediately without continuing
    // with remaining functions
    function(err, results){
        res.json(results);
    });            
}


export async function getRatingDiff(req, res,next)
{
    var snapshotidOld,snapshotidNew;
    if(req.query.snapshot_id_old != "" && req.query.snapshot_id_new != ""){
        snapshotidOld = req.query.snapshot_id_old;
        snapshotidNew = req.query.snapshot_id_new;
    }
    else{
        return next(new errors.BadRequest("Please enter valid parameters).", 1000));
       
    }
    var ratingType    = new Array('antiPatternRating','cloneRating','codeQualityRating','metricRating');

    var projectSnapshotsRatingDetails =  {
                                                categories: [ { },{ },{ },{ } ]
                                            };

    async.parallel({
        antipattern_details: function(callback)
        {
            sqlQuery = `select 'design_issues' as type,
                        (select * from get_snapshot_rating_new_violations($1,$2,$3))as new_node_count ,
                        (select * from get_snapshot_rating_improve_detorate_count($1,$2,$3,1))as improved_node_count,
                        (select * from get_snapshot_rating_improve_detorate_count($1,$2,$3,2))as deteriorated_node_count`;
            req.corona.query(sqlQuery, [snapshotidOld, snapshotidNew, ratingType[0]],next)
                .then(data => {
                    callback(null, data);
                });
        },
        clone_details:function(callback)
        {
            sqlQuery = `select 'duplication' as type,
                        (select * from get_snapshot_rating_new_violations($1,$2,$3))as new_node_count ,
                        (select * from get_snapshot_rating_improve_detorate_count($1,$2,$3,1))as improved_node_count,
                        (select * from get_snapshot_rating_improve_detorate_count($1,$2,$3,2))as deteriorated_node_count`;
            req.corona.query(sqlQuery, [snapshotidOld, snapshotidNew, ratingType[1]],next)
                .then(data => {
                    callback(null, data);
                });
        },
        codequality_details:function(callback)
        {
            sqlQuery = `select 'code_quality' as type,
                        (select * from get_snapshot_rating_new_violations($1,$2,$3))as new_node_count ,
                        (select * from get_snapshot_rating_improve_detorate_count($1,$2,$3,1))as improved_node_count,
                        (select * from get_snapshot_rating_improve_detorate_count($1,$2,$3,2))as deteriorated_node_count`;
            req.corona.query(sqlQuery, [snapshotidOld, snapshotidNew, ratingType[2]],next)
                .then(data => {
                    callback(null, data);
                });
        },
        metric_details:function(callback)
        {
            sqlQuery = `select 'metrics' as type,
                        (select * from get_snapshot_rating_new_violations($1,$2,$3))as new_node_count ,
                        (select * from get_snapshot_rating_improve_detorate_count($1,$2,$3,1))as improved_node_count,
                        (select * from get_snapshot_rating_improve_detorate_count($1,$2,$3,2))as deteriorated_node_count`;
            req.corona.query(sqlQuery, [snapshotidOld, snapshotidNew, ratingType[3]],next)
                .then(data => {
                    callback(null, data);
                });
        }

    },
    //Callback function, called once all above functions in array are executed.
    //If there is an error in any of the above functions then its called immediately without continuing
    // with remaining functions
    function(err, results){    
        projectSnapshotsRatingDetails.categories[0] = results.antipattern_details;
        projectSnapshotsRatingDetails.categories[1] = results.clone_details;
        projectSnapshotsRatingDetails.categories[2] = results.codequality_details;
        projectSnapshotsRatingDetails.categories[3] = results.metric_details;

        res.json(projectSnapshotsRatingDetails);
    });

}