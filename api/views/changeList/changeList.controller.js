import async from 'async';
import * as cf from '../../../utils/common-functions'
/**
 * Expose methods.
 */
// module.exports.getPluginName          = getPluginName;
// module.exports.addRoutes              = addRoutes;
// module.exports.getChangeList          = getChangeList;
// module.exports.getChangeListParamters = getChangeListParamters;

var sqlQuery;
// function addRoutes()
// {
//     gamma.get('/projects/getchangelist',getChangeList);
//     gamma.get('/projects/getchangelistparamters',getChangeListParamters);
// }

export async function getChangeListParamters(req,res,next)
{
    composeChangeListParametersJSONResponse(req,res,next);
}

export async function getChangeList(req, res,next)
{
    composeChangeListJSONResponse(req,res,next);
}

function composeChangeListParametersJSONResponse(req,res,next)
{
    var flag        = "";
    if (Object.keys(req.query).length == 2 ){ flag = 'y'; }else{  flag='n'; }
    var changelistParametersJson =  {
                                        "ratings":[],
                                        "metrics":[],
                                        "type":[],
                                        "duplication":[]
                                    };
    var duplicationJson =[
    {"id":1,"name":"no_of_clones"},
	{"id":2,"name":"clone_loc"},
	{"id":3,"name":"no_of_blocks"},
	{"id":4,"name":"duplication_percentage"}
	];

    async.parallel({
        ratings_details: function(callback)
        {
            sqlQuery = `select * from get_ratings($1)`;
            req.corona.query(sqlQuery, [req.query.project_id],next)
                .then(data => {
                    callback(null, data);
                });
        },
        metric_details: function(callback)
        {
            sqlQuery = `select * from get_measures_threshold($1)`;
            req.corona.query(sqlQuery, [req.query.project_id],next)
                .then(data => {
                    data = data.filter(d => (d.name != 'NOPM' && d.name != 'NOSM'));
                    callback(null, data);
                });
        },
        nodetype_details: function(callback)
        {
            sqlQuery = `select * from get_node_types($1,$2)`;
            req.corona.query(sqlQuery, [req.query.project_id, flag],next)
                .then(data => {
                    callback(null, data);
                });
        }
    },
    //Callback function, called once all above functions in array are executed.
    //If there is an error in any of the above functions then its called immediately without continuing
    // with remaining functions
    function(err, results){
        
        changelistParametersJson.ratings = results.ratings_details;
        changelistParametersJson.metrics = results.metric_details;
        changelistParametersJson.type    = results.nodetype_details;
        changelistParametersJson.duplication = duplicationJson;
        res.json(changelistParametersJson);
           

    });

}

function hasId(data,id)
{
    var items = Object.keys(data);
    var cnt =0;
    items.forEach(function(item) {
      if(data[item].nodeid == id){
        cnt++;
      }
    });
    return cnt;
}

function composeChangeListJSONResponse(req,res,next)
{
    var checkedParameters;
    if(req.query.checked_parameters != ""){
        checkedParameters  = JSON.parse(req.query.checked_parameters);
    }
    else {
        return next(new errors.BadRequest("Please enter valid parameters).", 1000));

    }

    if(checkedParameters.selected == 'ratings'){
        composeRatingDetailsJson(req,res,next);
    }
    else{
        composeMeasureDetailsJson(req,res,next);
    }
}

function composeRatingDetailsJson(req,res,next)
{
    var changelistJson =    {
                                "total_components":{  value: "0"  },
                                "components":[]
                            };
    //get the url paramters
    var projectId,selectedSnapshots,selectedSortParameter,sortId,sortOrder,rating,count,componentType,status,offset;
    var checkedParameters;
    if(req.query.project_id !="" && req.query.snapshot_id_old !="" && req.query.snapshot_id_new !="" && req.query.selected_sort_parameter !="" && req.query.checked_parameters!="" && selectedSortParameter != "")
    {
        projectId                  = JSON.parse(req.query.project_id);
        selectedSnapshots          = {};
        selectedSnapshots.old_id   = JSON.parse(req.query.snapshot_id_old);
        selectedSnapshots.new_id   = JSON.parse(req.query.snapshot_id_new);
        selectedSortParameter     = JSON.parse(req.query.selected_sort_parameter);
        checkedParameters          = JSON.parse(req.query.checked_parameters);
        sortId                      = selectedSortParameter.parameter_id;
        sortOrder                   = selectedSortParameter.sort_type;
        rating                      = checkedParameters.ratings;
        count                       = JSON.parse(req.query.count);
        offset                      = JSON.parse(req.query.start_index);
        componentType              = (checkedParameters.type).join(',');
        status                      = 0;

        if(checkedParameters.status =='Improved' ) {
            status = 1;
        }
        else if (checkedParameters.status =='Deteriorated') {
            status = 2;
        }
        else if(checkedParameters.status =='New' || checkedParameters.status =='hotspots_created'){
            status = 3;
        }
        else if(checkedParameters.status =='Old' || checkedParameters.status =='hotspots_removed') {
            status = 4;
        }
        else if(checkedParameters.status == 'hotspots_improved'){
            status = 5;
        }
        else if(checkedParameters.status == 'hotspots_deteriorated'){
            status = 6;
        }
        if (componentType == ''){
            componentType = '00';
        }
    }
    else
    {
        return next(new errors.BadRequest("Please enter valid parameters).", 1000));

    }

    async.parallel({
        changelist_details: function(callback)
        {
            sqlQuery = `select * from get_changelist_details_ratings($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`;
            req.corona.query(sqlQuery, [projectId, componentType, selectedSnapshots.old_id, selectedSnapshots.new_id, count, offset, status, sortOrder, sortId, rating],next)
                .then(data => {
                    callback(null, data);
                });
        },
        changelist_details_new_nodes: function(callback)
        {
            sqlQuery = `select * from get_new_nodes($1,$2,$3)`;
            req.corona.query(sqlQuery, [selectedSnapshots.old_id, selectedSnapshots.new_id, rating],next)
                .then(data => {
                    callback(null, data);
                });
        },
        changelist_details_total_count: function(callback)
        {
            sqlQuery = `select count(*) as rating_count from get_changelist_ratings_count($1,$2,$3,$4,$5)`;
            req.corona.query(sqlQuery, [selectedSnapshots.old_id, selectedSnapshots.new_id, status, rating, componentType],next)
                .then(data => {
                    callback(null, data);
                });
        }
    },
    //Callback function, called once all above functions in array are executed.
    //If there is an error in any of the above functions then its called immediately without continuing
    // with remaining functions
    function(err, results){
 
                for(var j=0; j < results.changelist_details.length ;j++)
                {
                    var nodeDetail =
                                {
                                    "id"   : "",
                                    "name" : "",
                                    "type" : "",
                                    "sig"  : "",
                                    "new"  : "",
                                    "parameters":   [
                                                        {
                                                          "name" : "",
                                                          "value": "",
                                                          "diff" : ""
                                                        },
                                                        {
                                                          "name" : "",
                                                          "value": "",
                                                          "diff" : ""
                                                        },
                                                        {
                                                          "name" : "",
                                                          "value": "",
                                                          "diff" : ""
                                                        },
                                                        {
                                                          "name" : "",
                                                          "value": "",
                                                          "diff" : ""
                                                        },
                                                        {
                                                          "name" : "",
                                                          "value": "",
                                                          "diff" : ""
                                                        }
                                                    ]
                                };

                    if(hasId(results.changelist_details_new_nodes,results.changelist_details[j].id)){
                        nodeDetail.new = "true";
                    }
                    else{
                        nodeDetail.new = "false";
                    }

                        nodeDetail.id   = results.changelist_details[j].id;
                        nodeDetail.name = results.changelist_details[j].name;
                        nodeDetail.type = results.changelist_details[j].type;
                        nodeDetail.sig  = results.changelist_details[j].sig;

                        if(results.changelist_details[j].antipatternratingdiff == null ) {results.changelist_details[j].antipatternratingdiff = "0";}
                        if(results.changelist_details[j].metricratingdiff == null )      {results.changelist_details[j].metricratingdiff      = "0";}
                        if(results.changelist_details[j].cloneratingdiff == null )       {results.changelist_details[j].cloneratingdiff       = "0";}
                        if(results.changelist_details[j].codequalityratingdiff == null ) {results.changelist_details[j].codequalityratingdiff = "0";}
                        if(results.changelist_details[j].overallratingdiff == null )     {results.changelist_details[j].overallratingdiff     = "0";}


                        nodeDetail.parameters[0].name  = "antiPatternRating";
                        nodeDetail.parameters[0].value = cf.convertToRange(results.changelist_details[j].antipatternrating);
                        nodeDetail.parameters[0].diff  = results.changelist_details[j].antipatternratingdiff ;

                        nodeDetail.parameters[1].name  = "metricRating";
                        nodeDetail.parameters[1].value = cf.convertToRange(results.changelist_details[j].metricrating);
                        nodeDetail.parameters[1].diff  = results.changelist_details[j].metricratingdiff;

                        nodeDetail.parameters[2].name  = "cloneRating";
                        nodeDetail.parameters[2].value = cf.convertToRange(results.changelist_details[j].clonerating);
                        nodeDetail.parameters[2].diff  = results.changelist_details[j].cloneratingdiff;

                        nodeDetail.parameters[3].name  = "codeQualityRating";
                        nodeDetail.parameters[3].value = cf.convertToRange(results.changelist_details[j].codequalityrating);
                        nodeDetail.parameters[3].diff  = results.changelist_details[j].codequalityratingdiff;

                        nodeDetail.parameters[4].name  = "overallRating";
                        nodeDetail.parameters[4].value = cf.convertToRange(results.changelist_details[j].overallrating);
                        nodeDetail.parameters[4].diff  = results.changelist_details[j].overallratingdiff;

                        changelistJson.components.push(nodeDetail);

                }
                changelistJson.total_components.value = results.changelist_details_total_count[0].rating_count;
                res.json(changelistJson);
           
        
    });
}


function composeMeasureDetailsJson(req,res,next)
{
    var changelistJson =    {
                                "total_components":{  value: 0 },
                                "components":[]
                            };

    //get the url paramters
    var projectId,selectedSnapshots,selectedSortParameter,sortId,sortOrder,count,componentType,status,offset;
    var checkedParameters, metric;
    if(req.query.project_id !="" && req.query.snapshot_id_old !="" && req.query.snapshot_id_new !="" && req.query.snapshot_id_new !="" && req.query.selected_sort_parameter!="" && req.query.checked_parameters !="" && selectedSortParameter!="")
    {
        projectId                  = JSON.parse(req.query.project_id);
        selectedSnapshots          = {};
        selectedSnapshots.old_id   = JSON.parse(req.query.snapshot_id_old);
        selectedSnapshots.new_id   = JSON.parse(req.query.snapshot_id_new);
        selectedSortParameter     = JSON.parse(req.query.selected_sort_parameter);
        checkedParameters          = JSON.parse(req.query.checked_parameters);
        metric                      = checkedParameters.metrics;
        sortId                      = selectedSortParameter.parameter_id;
        sortOrder                   = selectedSortParameter.sort_type;
        count                       = JSON.parse(req.query.count);
        offset                      = JSON.parse(req.query.start_index);
        componentType              = (checkedParameters.type).join(',');
        status                      = 0;

        if(checkedParameters.status =='Improved' ){
            status = 1;
        }
        else if (checkedParameters.status =='Deteriorated'){
            status = 2;
        }
        else if(checkedParameters.status =='New' || checkedParameters.status =='hotspots_created') {
            status = 3;
        }
        else if(checkedParameters.status =='Old' || checkedParameters.status =='hotspots_removed') {
            status = 4;
        }
        else if(checkedParameters.status == 'hotspots_improved') {
            status = 5;
        }
        else if(checkedParameters.status == 'hotspots_deteriorated'){
            status = 6;
        }
        if(selectedSnapshots.old_id > selectedSnapshots.new_id) {
            var oldidTemp             = selectedSnapshots.old_id;
            selectedSnapshots.old_id = selectedSnapshots.new_id;
            selectedSnapshots.new_id = oldidTemp;
        }
        if (componentType == ''){
            componentType = '00';
        }
    }
    else 
    {
        return next(new errors.BadRequest("Please enter valid parameters).", 1000));

    }

    async.parallel({
        changelist_details: function(callback)
        {
            sqlQuery = `select * from get_changelist_details_measures($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) as metric_details`;
            req.corona.query(sqlQuery, [projectId, componentType, selectedSnapshots.old_id, selectedSnapshots.new_id, count, offset, status, sortOrder, sortId, metric],next)
                .then(data => {
                    callback(null, data);
                });
        },
        changelist_details_new_nodes: function(callback)
        {
            sqlQuery = `select * from get_new_nodes($1,$2,5)`;
            req.corona.query(sqlQuery, [selectedSnapshots.old_id, selectedSnapshots.new_id],next)
                .then(data => {
                    callback(null, data);
                });
        },
        changelist_details_total_count: function(callback)
        {
            sqlQuery = `select count(*) as measure_count from get_changelist_measures_count($1,$2,$3,$4,$5)`;
            req.corona.query(sqlQuery, [selectedSnapshots.old_id, selectedSnapshots.new_id, status, metric, componentType],next)
                .then(data => {
                    callback(null, data);
                });
        }
    },
    //Callback function, called once all above functions in array are executed.
    //If there is an error in any of the above functions then its called immediately without continuing
    // with remaining functions
    function(err, results) {
        
        var nodeDetail = {},
            diffValue = 0,
            key;
        if(results.changelist_details[0].metric_details)
        {
            for(var j=0;j<results.changelist_details[0].metric_details.length;j++)
            {
                nodeDetail              = {};
                nodeDetail.parameters   = [];
                if(hasId(results.changelist_details_new_nodes,results.changelist_details[0].metric_details[j].id)) {
                    nodeDetail.new = "true";
                }
                else{
                    nodeDetail.new = "false";
                }

                for(key in (results.changelist_details[0].metric_details[j]))
                {
                    var value = (results.changelist_details[0].metric_details[j][key])?results.changelist_details[0].metric_details[j][key]:0;
                    if(key != 'id' && key != 'name' && key != 'type' && key != 'sig' && key.indexOf('diff') == -1){
                        diffValue = (results.changelist_details[0].metric_details[j][key+'diff'])?results.changelist_details[0].metric_details[j][key+'diff']:0;
                        nodeDetail.parameters.push({'name':key,'value':value,'diff':diffValue});
                    }
                    else if(key.indexOf('diff') == -1){
                        nodeDetail[key] = value;
                    }
                }
                changelistJson.components.push(nodeDetail);
            }
        }
        changelistJson.total_components.value = results.changelist_details_total_count[0].measure_count;
        res.json(changelistJson);
    
        });
}