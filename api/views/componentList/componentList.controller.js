

import async from 'async';
import * as cf from '../../../utils/common-functions';
var sqlQuery;
var componentList, checkedParameters;
export async function getComponentList(req,res,next)
{
    if(req.query.checked_parameters != "")
    {
       checkedParameters = JSON.parse(req.query.checked_parameters);
    }
    else
    {
        return next(new errors.BadRequest("Please enter valid parameters).", 1000));
    }

    if(checkedParameters.selected == 'ratings')
    {
        if(checkedParameters.ruletypeid != '' )
        {
            //rating data from node summary
            composeJsonRatingNodeSummary(req,res,next);
        }
        else if(checkedParameters.metricid != '')
        {
            composeJsonRatingViolation(req,res,next);
        }
        else
        {
            //rating data from hotspot distribution
            composeJsonRatingHotspot(req,res,next);
        }
    }
    else if(checkedParameters.selected == 'duplication')
    {
        if(checkedParameters.metricid != '')
        {
            composeJsonDuplicationViolation(req,res,next);
        }
        else if(checkedParameters.ruletypeid != '' )
        {
            composeJsonDuplicationDetail(req,res,next);
        }
        else
        {
            composeJsonDuplicationHotspot(req,res,next);
        }

    }
    else if (checkedParameters.selected == 'metrics')
    {
        if(checkedParameters.ruletypeid != '' )
        {
            //metric data from node summary
            composeJsonMetricNodeSummary(req,res,next);
        }
        else if(checkedParameters.metricid != '' )
        {
            //metric data for particular node violating particular measure
            composeJsonMetricViolation(req,res,next);
        }
        else
        {
            //metric data from hotspot distribution
            composeJsonMetricHotspot(req,res,next);
        }
    }
}

function buildComponentList(row, callback) {
	var nodeDetail = {};
	nodeDetail.parameters = [];
	for (var key in row) {
		var value = (row[key]) ? row[key] : 0;
		if (key != 'id' && key != 'name' && key != 'type' && key != 'sig' && key != 'risk' && key != 'synopsis'){
			nodeDetail.parameters.push({
				'name': key,
				'value': (checkedParameters.selected == 'ratings')?cf.convertToRange(value):value
			});
		}else if(key == 'risk') {
			nodeDetail[key] = (value == 0) ? 'NA' : parseFloat(value).toFixed(2);
		}else {
			nodeDetail[key] = (key == 'risk') ? parseFloat(value).toFixed(2) : value;
		}
	}
	componentList.components.push(nodeDetail);
	callback.call();
}

function composeJsonRatingNodeSummary(req,res,next){
	componentList =
	{
		"total_components": { value: "" },
		"components": []
	};
	var projectId, snapshotId, nodeId, selectedSortParameter, sortId, sortOrder, count, offset, ruletypeId, nodeType;
    if(req.query.project_id != "" && req.query.snapshot_id != snapshotId && req.query.node_id != "" && req.query.selected_sort_parameter != "" && selectedSortParameter.parameter_id != "" && selectedSortParameter.sort_type != ""){
        projectId              = JSON.parse(req.query.project_id);
        snapshotId             = JSON.parse(req.query.snapshot_id);
        nodeId                 = JSON.parse(req.query.node_id);
        selectedSortParameter = JSON.parse(req.query.selected_sort_parameter);
        sortId                  = selectedSortParameter.parameter_id;
        sortOrder               = selectedSortParameter.sort_type;
        count                   = JSON.parse(req.query.count);
        offset                  = JSON.parse(req.query.start_index);
        ruleTypeId             = JSON.parse(checkedParameters.ruletypeid);
        nodeType               = (checkedParameters.type).join(',');
        if (nodeType == '') {
            nodeType = '00';
        }
    }
    else {
        return next(new errors.BadRequest("Please enter valid parameters).", 1000));

    }
	async.parallel({
		component_list_data: function(callback){
			sqlQuery = `select * from get_component_details_ratings_node_summarry($1,$2,$3,$4,$5,$6,$7,$8,$9)`;
			req.corona.query(sqlQuery, [projectId, snapshotId, nodeId, count, offset, sortOrder, sortId, ruletypeId, nodeType],next)
            .then(data => {
                callback(null, data);
            });
		},
		component_list_count: function(callback){
			sqlQuery = `select count(*) as cnt from get_component_details_ratings_node_summarry($1,$2,$3,0,$4,$5,$6,$7,$8)`;
			req.corona.query(sqlQuery, [projectId, snapshotId, nodeId, offset, sortOrder, sortId, ruletypeId, nodeType],next)
            .then(data => {
                callback(null, data);
            });
		}
	},
    //Callback function, called once all above functions in array are executed.
    //If there is an error in any of the above functions then its called immediately without continuing
    // with remaining functions
    function(err, results) {

        async.forEach(results.component_list_data, buildComponentList, function (err1, result) {
            componentList.total_components.value = results.component_list_count[0].cnt;
            res.json(componentList);
        });
    });
}

function composeJsonRatingHotspot(req,res,next)
{
    componentList =
        {
            "total_components": { value: "" },
            "components": []
        };
    var nodeId,projectId,snapshotId,snapshotIdOld,showImmediateComp,codeIssueType,codeIssueName,showDupliComp,selectedSortParameter,sortId,sortOrder,count,offset,hotspotType,nodeType,status;
    if(req.query.project_id !="" && req.query.snapshot_id !="" && checkedParameters !="" &&selectedSortParameter !="")
    {
        projectId          = JSON.parse(req.query.project_id);
        snapshotId         = JSON.parse(req.query.snapshot_id);
        showImmediateComp = checkedParameters.showImmediateComponents;
        codeIssueType     = checkedParameters.codeissuetype;
        codeIssueName     = checkedParameters.codeissuename;
        showDupliComp     = checkedParameters.showDuplicateComponents;
        if ( req.query.snapshot_id_old != undefined ) {
            snapshotIdOld = JSON.parse(req.query.snapshot_id_old);
        }
        else {
            snapshotIdOld = 0;
        }
        nodeId     = JSON.parse(req.query.node_id);

        selectedSortParameter = JSON.parse(req.query.selected_sort_parameter);
        sortId                  = selectedSortParameter.parameter_id;
        sortOrder               = selectedSortParameter.sort_type;
        count                   = JSON.parse(req.query.count);
        offset                  = JSON.parse(req.query.start_index);
        hotspotType            = checkedParameters.hotspottype[0];
        nodeType               = (checkedParameters.type).join(',');
        status                  = checkedParameters.status[0];
        if(nodeType == '') {
            nodeType = '00';
        }
    }
    else
    {
        return next(new errors.BadRequest("Please enter valid parameters).", 1000));
    }

    async.parallel({
        component_list_data: function(callback)
        {
            sqlQuery = `select * from get_component_details_ratings_hotspot($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`;
            req.corona.query(sqlQuery, [projectId, snapshotId, snapshotIdOld, nodeId, count, offset, sortOrder, sortId, hotspotType, nodeType, status, showImmediateComp, codeIssueType, showDupliComp, codeIssueName],next)
                .then(data => {
                    callback(null, data);
                });
        },
        component_list_count: function(callback)
        {
            sqlQuery = `select (select * from get_component_details_ratings_hotspot_count($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11))as cnt`;
            req.corona.query(sqlQuery, [projectId, snapshotId, snapshotIdOld, nodeId, hotspotType, nodeType, status, showImmediateComp, codeIssueType, showDupliComp, codeIssueName],next)
                .then(data => {
                    callback(null, data);
                });
        }
    },
    //Callback function, called once all above functions in array are executed.
    //If there is an error in any of the above functions then its called immediately without continuing
    // with remaining functions
    function(err, results){

        async.forEach(results.component_list_data, buildComponentList,function(err1, result) {
            componentList.total_components.value = results.component_list_count[0].cnt;
            res.json(componentList);
        });
           
    });
}

function composeJsonRatingViolation(req,res,next)
{
    var projectId, snapshotId, nodeId, selectedSortParameter, sortId, sortOrder, count, offset, hotspotType, metricId, nodeType, status;
    componentList =
        {
            "total_components": { value: "" },
            "components": []
        };
        if(req.query.project_id != "" && req.query.snapshot_id != "" && req.query.node_id != "" && selectedSortParameter != "" && selectedSortParameter != "" && checkedParameters != "") {
            projectId              = JSON.parse(req.query.project_id);
            snapshotId             = JSON.parse(req.query.snapshot_id);
            nodeId                 = JSON.parse(req.query.node_id);
            selectedSortParameter = JSON.parse(req.query.selected_sort_parameter);
            sortId                  = selectedSortParameter.parameter_id;
            sortOrder               = selectedSortParameter.sort_type;
            count                   = JSON.parse(req.query.count);
            offset                  = JSON.parse(req.query.start_index);
            hotspotType            = checkedParameters.hotspottype[0];
            nodeType               = (checkedParameters.type).join(',');
            status                  = checkedParameters.status[0];
            metricId               = checkedParameters.metricid;
            if (nodeType == '') {
                nodeType = '00';
            }
        }
        else{
            return next(new errors.BadRequest("Please enter valid parameters).", 1000));
        }

    async.parallel({
        component_list_data: function(callback)
        {
            sqlQuery = `select * from get_component_details_ratings_violations($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`;
            req.corona.query(sqlQuery, [projectId, snapshotId, nodeId, count, offset, sortOrder, sortId, hotspotType, nodeType, status, metricId],next)
                .then(data => {
                    callback(null, data);
                });
        },
        component_list_count: function(callback)
        {
            sqlQuery = `select(select * from get_component_details_ratings_violations_count($1,$2,$3,$4,$5,$6,$7))as cnt`;
            req.corona.query(sqlQuery, [projectId, snapshotId, nodeId, hotspotType, nodeType, status, metricId],next)
                .then(data => {
                    callback(null, data);
                });
        }
    },
    //Callback function, called once all above functions in array are executed.
    //If there is an error in any of the above functions then its called immediately without continuing
    // with remaining functions
    function(err, results){
        async.forEach(results.component_list_data, buildComponentList, function (err1, result) {
            componentList.total_components.value = results.component_list_count[0].cnt;
            res.json(componentList);
        
        });
    });
}

function composeJsonDuplicationHotspot(req,res,next)
{
    var nodeId,projectId,snapshotId,snapshotIdOld,showImmediateComp,codeIssueType,codeIssueName,showDupliComp,selectedSortParameter,sortId,sortOrder,count,offset,hotspotType,nodeType,status;
    componentList =
        {
            "total_components": { value: "" },
            "components": []
        };
        if(req.query.project_id !="" && req.query.snapshot_id !="" && checkedParameters != "")
        {
            projectId          = JSON.parse(req.query.project_id);
            snapshotId         = JSON.parse(req.query.snapshot_id);
            showImmediateComp = checkedParameters.showImmediateComponents;
            codeIssueType     = checkedParameters.codeissuetype;
            codeIssueName     = checkedParameters.codeissuename;
            showDupliComp     = checkedParameters.showDuplicateComponents;
    
            if ( req.query.snapshot_id_old != undefined ) {
                snapshotIdOld = JSON.parse(req.query.snapshot_id_old);
            }
            else {
                snapshotIdOld = 0;
            }
    
            nodeId                 = JSON.parse(req.query.node_id);
            selectedSortParameter = JSON.parse(req.query.selected_sort_parameter);
            sortId                  = selectedSortParameter.parameter_id;
            sortOrder               = selectedSortParameter.sort_type;
            count                   = JSON.parse(req.query.count);
            offset                  = JSON.parse(req.query.start_index);
            hotspotType            = checkedParameters.hotspottype[0];
            nodeType               = (checkedParameters.type).join(',');
            status                  = checkedParameters.status[0];
            if (nodeType == '') {
                nodeType = '00';
            }
        }
        else{
            return next(new errors.BadRequest("Please enter valid parameters).", 1000));
        }

    async.parallel({
        component_list_data: function (callback) {
            sqlQuery = `select * from get_component_details_duplication_hotspot($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`;
            req.corona.query(sqlQuery, [projectId, snapshotId, snapshotIdOld, nodeId, count, offset, sortOrder, sortId, nodeType, hotspotType, status, showImmediateComp, codeIssueType, showDupliComp, codeIssueName],next)
                .then(data => {
                    callback(null, data);
                });
        },
        component_list_count: function (callback) {
            sqlQuery = `select count(*) as cnt from get_component_details_duplication_hotspot($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`;
            req.corona.query(sqlQuery, [projectId, snapshotId, snapshotIdOld, nodeId, 99999999, 0, sortOrder, sortId, nodeType, hotspotType, status, showImmediateComp, codeIssueType, showDupliComp, codeIssueName],next)
                .then(data => {
                    callback(null, data);
                });
        }
    },
    //Callback function, called once all above functions in array are executed.
    //If there is an error in any of the above functions then its called immediately without continuing
    // with remaining functions
    function(err, results){
        async.forEach(results.component_list_data, buildComponentList, function (err1, result) {
            componentList.total_components.value = results.component_list_count[0].cnt;
            res.json(componentList);
        });

    });
}

function composeJsonDuplicationDetail(req,res,next) {
    var nodeId,projectId,snapshotId,showImmediateComp,codeIssueType,showDupliComp,selectedSortParameter,sortId,sortOrder,count,offset,ruletypeId,nodeType;
    componentList =
        {
            "total_components": { value: "" },
            "components": []
        };
        if(req.query.project_id != "" && req.query.snapshot_id !="" && req.query.node_id !="" && selectedSortParameter != "" && checkedParameters!= "")
        {
            projectId         = JSON.parse(req.query.project_id);
            snapshotId        = JSON.parse(req.query.snapshot_id);
            nodeId            = JSON.parse(req.query.node_id);
    
            selectedSortParameter = JSON.parse(req.query.selected_sort_parameter);
            sortId                  = selectedSortParameter.parameter_id;
            sortOrder               = selectedSortParameter.sort_type;
            count                   = JSON.parse(req.query.count);
            offset                  = JSON.parse(req.query.start_index);
            nodeType               = (checkedParameters.type).join(',');
            showImmediateComp     = checkedParameters.showImmediateComponents;
            codeIssueType         = checkedParameters.codeissuetype;
            showDupliComp         = checkedParameters.showDuplicateComponents;
    
            if (checkedParameters.ruletypeid != '') {
                ruleTypeId = JSON.parse(checkedParameters.ruletypeid);
            }
            else {
                ruleTypeId = 0;
            }
    
            if (nodeType == '') {
                nodeType = '00';
            }
        }
        else {
            return next(new errors.BadRequest("Please enter valid parameters).", 1000));
    
        }

    var showImmediateCompCondition, params = [];

    if(showImmediateComp) {
        showImmediateCompCondition = `and  n.parentid = $1 `;
    }
    else {
        showImmediateCompCondition = ` and n.path like any(values('%.'||$1||'.%'),($1||'.%')) `;
    }
    params.push(nodeId, snapshotId);

    var codeIssuesCondition = '';
    if(codeIssueType != '')
    {
        codeIssuesCondition = `INNER JOIN code_issues_occurrences co on co.component_id=n.id 
                                and co.snapshot_id=$2 
                                and co.code_issue_id in(select ci.id from code_issues ci where ci.category=$3 )`;
        params.push(codeIssueType);
    }
    params.push(ruletypeId, projectId);
    async.parallel({
        component_list_data: function(callback)
        {
            sqlQuery = `select * from get_component_details_duplication_summary($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`;

            req.corona.query(sqlQuery, [projectId, snapshotId, nodeId, ruletypeId, count, offset, sortOrder, sortId, nodeType, showImmediateComp, codeIssueType, showDupliComp],next)
                .then(data => {
                    callback(null, data);
                });
        },
        component_list_count: function(callback)
        {
            if(codeIssueType != '')
            {
                sqlQuery = `select count(*) as cnt from nodes n INNER JOIN  rule_occurrences ro on n.id=ro.nodeid ${codeIssuesCondition}  
                        where ro.snapshotid=$2 
                        and ro.ruletypeid = $4  
                        and n.nodetype in (${nodeType})  
                        ${showImmediateCompCondition}  
                        and n.subsystem_id=$5`;
            }
            else
            {
                sqlQuery = `select count(*) as cnt from nodes n INNER JOIN  rule_occurrences ro on n.id=ro.nodeid ${codeIssuesCondition}  
                        where ro.snapshotid=$2 
                        and ro.ruletypeid = $3  
                        and n.nodetype in (${nodeType})  
                        ${showImmediateCompCondition}  
                        and n.subsystem_id=$4`;
            }
            req.corona.query(sqlQuery, params)
                .then(data => {
                    callback(null, data);
                });
        },
        count_without_antipattern: function(callback)
        {
            sqlQuery = `select count(*) as cnt from nodes n  INNER JOIN nodes_snapshots ns on n.id=ns.nodeid  
                        INNER JOIN node_types nt on n.nodetype=nt.id  
                        INNER JOIN clonestatistics  cs on n.id=cs.nodeid and cs.snapshotid=ns.snapshotid
                        and ns.snapshotid=$2 and nt.classification='COMPONENTS'  
                        ${showImmediateCompCondition} 
                        and n.excluded = false`;
            req.corona.query(sqlQuery, [nodeId, snapshotId],next)
                .then(data => {
                    callback(null, data);
                });
        },
        count_without_antipattern_duplication: function(callback)
        {
            sqlQuery = `select count(*) as cnt from nodes n  INNER JOIN nodes_snapshots ns on n.id=ns.nodeid  
                        INNER JOIN node_types nt on n.nodetype=nt.id  
                        and ns.snapshotid=$2 and nt.classification='COMPONENTS'  
                        ${showImmediateCompCondition} 
                        and n.excluded = false`;

            req.corona.query(sqlQuery, [nodeId, snapshotId],next)
                .then(data => {
                    callback(null, data);
                });
        }
    },
    //Callback function, called once all above functions in array are executed.
    //If there is an error in any of the above functions then its called immediately without continuing
    // with remaining functions
    function(err, results){
        async.forEach(results.component_list_data, buildComponentList, function (err1, result) {

            if (ruletypeId == 0) {
                if (showDupliComp) {
                    componentList.total_components.value = results.count_without_antipattern[0].cnt;
                }
                else {
                    componentList.total_components.value = results.count_without_antipattern_duplication[0].cnt;
                }
            }
            else {
                componentList.total_components.value = results.component_list_count[0].cnt;
            }
            res.json(componentList);
        });
    });
}

function composeJsonDuplicationViolation(req,res,next)
{
    var projectId,snapshotId,nodeId,selectedSortParameter,sortId,sortOrder,count,offset,metricId,nodeType;
    componentList =
        {
            "total_components": { value: "" },
            "components": []
        };
        if(req.query.project_id != "" && req.query.snapshot_id !="" && req.query.node_id !="" && req.query.selected_sort_parameter !="" && selectedSortParameter !="" && req.query.count != "" && req.query.start_index != ""){
            projectId              = JSON.parse(req.query.project_id);
            snapshotId             = JSON.parse(req.query.snapshot_id);
            nodeId                 = JSON.parse(req.query.node_id);
            selectedSortParameter = JSON.parse(req.query.selected_sort_parameter);
            sortId                  = selectedSortParameter.parameter_id;
            sortOrder               = selectedSortParameter.sort_type;
            count                   = JSON.parse(req.query.count);
            offset                  = JSON.parse(req.query.start_index);
            nodeType               = (checkedParameters.type).join(',');
            metricId               = checkedParameters.metricid;
            if (nodeType == '') {
                nodeType = '00';
            }
        }
       else
        {
            return next(new errors.BadRequest("Please enter valid parameters).", 1000));
        }

    async.parallel({
        component_list_data: function(callback)
        {
            sqlQuery = `select * from get_component_details_duplication_violation($1,$2,$3,$4,$5,$6,$7,$8,$9)`;
            req.corona.query(sqlQuery, [projectId, snapshotId, nodeId, metricId, count, offset, sortOrder, sortId, nodeType],next)
                .then(data => {
                    callback(null, data);
                });
        },
        component_list_count: function(callback)
        {

            sqlQuery = `select count(*) as cnt from get_component_details_duplication_violation($1,$2,$3,$4,99999999,0,$5,$6,$7)`;
            req.corona.query(sqlQuery, [projectId, snapshotId, nodeId, metricId, sortOrder, sortId, nodeType],next)
                .then(data => {
                    callback(null, data);
                });
        }
    },
    //Callback function, called once all above functions in array are executed.
    //If there is an error in any of the above functions then its called immediately without continuing
    // with remaining functions
    function(err, results){

        async.forEach(results.component_list_data, buildComponentList, function (err1, result) {
            
            componentList.total_components.value = results.component_list_count[0].cnt;
            res.json(componentList);
        
        });

    });
}

function composeJsonMetricNodeSummary(req,res,next)
{
    var projectId, snapshotId, nodeId, selectedSortParameter, sortId, sortOrder, count, offset, ruletypeId,nodeType;
    componentList =
        {
            "total_components": { value: "" },
            "components": []
        };
        if(req.query.project_id !="" && req.query.snapshot_id !="" && req.query.node_id != "" && req.query.selected_sort_parameter !=""&&  req.query.count !="" || req.query.start_index !="")
        {
            projectId              = JSON.parse(req.query.project_id);
            snapshotId             = JSON.parse(req.query.snapshot_id);
            nodeId                 = JSON.parse(req.query.node_id);
            selectedSortParameter = JSON.parse(req.query.selected_sort_parameter);
            sortId                  = selectedSortParameter.parameter_id;
            sortOrder               = selectedSortParameter.sort_type;
            count                   = JSON.parse(req.query.count);
            offset                  = JSON.parse(req.query.start_index);
            ruletypeId             = JSON.parse(checkedParameters.ruletypeid);
            nodeType               = (checkedParameters.type).join(',');
            if (nodeType == '') {
                nodeType = '00';
            }
        }
        else
        {
            return next(new errors.BadRequest("Please enter valid parameters).", 1000));
    
        }

    async.parallel({
        component_list_data: function(callback)
        {
            sqlQuery = `select * from get_component_details_measures_node_summarry($1,$2,$3,$4,$5,$6,$7,$8,$9) as metric_details`;
            req.corona.query(sqlQuery, [projectId, snapshotId, count, offset, ruletypeId, nodeId, sortOrder, sortId, nodeType],next)
                .then(data => {
                    callback(null, data[0].metric_details);
                });
        },
        component_list_count: function(callback)
        {
            sqlQuery = `select(select * from get_count_component_details_measures_node_summary($1,$2,$3,$4,$5)) as cnt`;
            req.corona.query(sqlQuery, [projectId, snapshotId, ruletypeId, nodeId, nodeType],next)
                .then(data => {
                    callback(null, data);
                });
        }
    },
    //Callback function, called once all above functions in array are executed.
    //If there is an error in any of the above functions then its called immediately without continuing
    // with remaining functions
    function(err, results) {
        async.forEach(results.component_list_data, buildComponentList, function (err1, result) {
            componentList.total_components.value = results.component_list_count[0].cnt;
            res.json(componentList);
        });
    });
}

function composeJsonMetricHotspot(req,res,next)
{
    var nodeId,projectId,snapshotId,snapShotIdOld,showImmediateComp,codeIssueType,codeIssueName,showDupliComp,selectedSortParameter,sortId,sortOrder,count,offset,hotspotType,nodeType,status;
    componentList =
        {
            "total_components": { value: "" },
            "components": []
        };
        if(req.query.project_id != "" && req.query.snapshot_id != "" && checkedParameters != "")
        {
            projectId          = JSON.parse(req.query.project_id);
            snapshotId         = JSON.parse(req.query.snapshot_id);
            showImmediateComp = checkedParameters.showImmediateComponents;
            codeIssueType     = checkedParameters.codeissuetype;
            codeIssueName     = checkedParameters.codeissuename;
            showDupliComp     = checkedParameters.showDuplicateComponents;
    
            if (req.query.snapshot_id_old) {
                snapshotIdOld = JSON.parse(req.query.snapshot_id_old);
            }
            else {
                snapshotIdOld = 0;
            }
    
            nodeId            = JSON.parse(req.query.node_id);
            selectedSortParameter = JSON.parse(req.query.selected_sort_parameter);
            sortId                  = selectedSortParameter.parameter_id;
            sortOrder               = selectedSortParameter.sort_type;
            count                   = JSON.parse(req.query.count);
            offset                  = JSON.parse(req.query.start_index);
            hotspotType            = checkedParameters.hotspottype[0];
            nodeType               = (checkedParameters.type).join(',');
            status                  = checkedParameters.status[0];
    
            if (nodeType == '') {
                nodeType = '00';
            }
        }
        else
        {
            return next(new errors.BadRequest("Please enter valid parameters).", 1000));
    
        }

    if(!snapShotIdOld) {
        snapShotIdOld = 0;
    }

    async.parallel({
        component_list_data: function(callback)
        {
            sqlQuery = `select * from get_component_details_measures_hotspot($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) as metric_details`;
            req.corona.query(sqlQuery, [projectId, snapshotId, snapShotIdOld, count, offset, nodeId, sortOrder, sortId, hotspotType, nodeType, status, showImmediateComp, codeIssueType, showDupliComp, codeIssueName],next)
                .then(data => {
                    callback(null, data[0].metric_details);
                });
        },
        component_list_count: function(callback)
        {
            sqlQuery = `select (select * from get_component_details_measures_hotspot_count($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15))as cnt`;
            req.corona.query(sqlQuery, [projectId, snapshotId, snapShotIdOld, count, offset, nodeId, sortOrder, sortId, hotspotType, nodeType, status, showImmediateComp, codeIssueType, showDupliComp, codeIssueName],next)
                .then(data => {
                    callback(null, data);
                });
        }
    },
    //Callback function, called once all above functions in array are executed.
    //If there is an error in any of the above functions then its called immediately without continuing
    // with remaining functions
    function(err, results){
        async.forEach(results.component_list_data, buildComponentList, function (err1, result) {
                componentList.total_components.value = results.component_list_count[0].cnt;
                res.json(componentList);
        });
    });
}


function composeJsonMetricViolation(req,res,next)
{
    var projectId,snapshotId,nodeId,selectedSortParameter,sortId,sortOrder,count,offset,metricId,nodeType;
    componentList =
        {
            "total_components": { value: "" },
            "components": []
        };
        if(req.query.project_id !="" && req.query.snapshot_id != "" && req.query.node_id !="" && req.query.selected_sort_parameter !="" && req.query.start_index !="" && req.query.count != "")
        {
            projectId              = JSON.parse(req.query.project_id);
            snapshotId             = JSON.parse(req.query.snapshot_id);
            nodeId                 = JSON.parse(req.query.node_id);
            selectedSortParameter = JSON.parse(req.query.selected_sort_parameter);
            sortId                  = selectedSortParameter.parameter_id;
            sortOrder               = selectedSortParameter.sort_type;
            count                   = JSON.parse(req.query.count);
            offset                  = JSON.parse(req.query.start_index);
            nodeType               = (checkedParameters.type).join(',');
            metricId               = checkedParameters.metricid;
            if (nodeType == '') {
                nodeType = '00';
            }
        }
        else
        {
            return next(new errors.BadRequest("Please enter valid parameters).", 1000));
    
        }

    async.parallel({
        component_list_data: function(callback)
        {
            sqlQuery = `select * from get_component_details_measures_violation($1,$2,$3,$4,$5,$6,$7,$8,$9) as metric_details`;
            req.corona.query(sqlQuery, [projectId, snapshotId, count, offset, nodeId, sortOrder, sortId, nodeType, metricId],next)
                .then(data => {
                    callback(null, data[0].metric_details);
                });
        },
        component_list_count: function(callback)
        {
            sqlQuery = `select (select * from get_component_details_measures_violation_count($1,$2,$3,$4,$5,$6,$7)) as cnt`;
            req.corona.query(sqlQuery, [projectId, snapshotId, count, offset, nodeId, nodeType, metricId],next)
                .then(data => {
                    callback(null, data);
                });
        }
    },
    //Callback function, called once all above functions in array are executed.
    //If there is an error in any of the above functions then its called immediately without continuing
    // with remaining functions
    function(err, results){
       
        async.forEach(results.component_list_data, buildComponentList, function (err1, result) {
            componentList.total_components.value = results.component_list_count[0].cnt;
            res.json(componentList);
        });
    
    });
}

