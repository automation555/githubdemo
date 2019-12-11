
import async from 'async';
import log from './../../../utils/logger';
import { getCodeIssuesTagsKpis } from './../../v1/repository/codeIssues/codeIssues.services';
const errors = require('throw.js'); 

/**
 * Expose methods.
 */
// module.exports.getPluginName = getPluginName;
// module.exports.addRoutes     = addRoutes;
// module.exports.getCodeissues = getCodeissues;
// function addRoutes(){
// 	gamma.get('/codeissues/getcodeissues',codeIssues);
// }

// function getPluginName(){
// 	let pluginName = 'Code Issues Details ';
// 	return pluginName;
// }

let sqlQuery;

export async function codeIssues(req,res,next){
	if (req.query.plot_by == 'issue_name'){
		getCodeissuesByName(req, res, req.query.node_id, req.query.snapshot_id, req.query.project_id,next);
	}else{
		getCodeissues(req, res, req.query.node_id, req.query.snapshot_id, req.query.project_id,next);
	}
}

function getCodeissues(req,res,nodeId,snapshotId,repositoryId,next){
	let outputJson =
		{
			"issueTypeList" : [],
			"dataList" : []
		};
	async.parallel({
		issuetype_details: function(callback){
			sqlQuery = `select distinct(category) as type,
                        case  when category='critical' then 1
                        when category='high' then 2
                        when category='medium' then 3
                        when category='low' then 4
                        when category='uncategorised' then 5
                        when category='info' then 6
                        end as id from code_issues order by id`;
			req.corona.query(sqlQuery, [],next)
            .then(data => {
	            callback(null, data);
            });
		},
		codeissue_details: function(callback){
            //sqlQuery = `select * from get_code_issues_distribution_by_file($1,$2)`;
            sqlQuery = `select * from get_code_issues_distribution_modules_criticality($1, $2, $3)`;
			req.corona.query(sqlQuery, [nodeId, repositoryId, snapshotId], next)
            .then(data => {
	            callback(null, data);
            });
		},
		code_issues_component_details: function(callback){
			sqlQuery = `select ci.category as type,count(*) as value  from nodes n,node_types nt,code_issues_occurrences co,code_issues ci
                        where n.subsystem_id=$1
                        and n.parentid=$2
                        and n.nodetype=nt.id
                        and nt.classification='COMPONENTS'
                        and n.id=co.component_id
                        and co.snapshot_id=$3 
                        and co.is_suppress = false
                        and ci.id=co.code_issue_id
                        group by ci.category`;
			req.corona.query(sqlQuery, [repositoryId, nodeId, snapshotId],next)
            .then(data => {
	            callback(null, data);
            });
		}
	},
    //Callback function, called once all above functions in array are executed.
    //If there is an error in any of the above functions then its called immediately without continuing
    // with remaining functions
    function(err, results){
        outputJson.issueTypeList = results.issuetype_details;
        (results.codeissue_details).map(d => {
            d.code_issue = (d.code_issue).map(d1 => {
                d1.type = d1['f1'];
                d1.value = d1['f2'];
                delete d1['f1'];
                delete d1['f2'];
                return d1;
            })
            return d;
        });
        outputJson.dataList.push(results.codeissue_details);
		let components = { 'components_codeissue_detail' : { }  };
		components.components_codeissue_detail = results.code_issues_component_details;
		outputJson.dataList.push(components);
		res.json(outputJson);
    });
}

function getCodeissuesByName(req,res,nodeId,snapshotId,repositoryId,next){
	let outputJson =
		{
			"issueNameList" : [],
			"dataList"      : []
		};

	async.parallel({
		issuename_details: function(callback){
			sqlQuery = `select  distinct id,name, category as criticality,
                        case  when category='critical' then 1
                        when category='high' then 2
                        when category='medium' then 3
                        when category='low' then 4
                        when category='uncategorised' then 5
                        when category='info' then 6
                        end as seviority from code_issues order by seviority`;
			req.corona.query(sqlQuery, [],next)
            .then(data => {
	            callback(null, data);
            });
		},
		codeissue_details_withname: function(callback){
            //sqlQuery = `select * from get_code_issuename_distribution_by_file($1,$2)`;
            sqlQuery = `select * from get_code_issues_distribution_modules_issuetype($1,$2,$3)`;
	        req.corona.query(sqlQuery, [nodeId, repositoryId, snapshotId],next)
            .then(data => {
                callback(null, data);
            });
		},
		code_issues_component_details: function(callback){
			sqlQuery = `select ci.name as name,count(*) as value  from nodes n,node_types nt,code_issues_occurrences co,code_issues ci
                        where n.subsystem_id=$1
                        and n.parentid=$2
                        and n.nodetype=nt.id
                        and nt.classification='COMPONENTS'
                        and n.id=co.component_id
                        and co.snapshot_id=$3
                        and co.is_suppress = false
                        and ci.id=co.code_issue_id
                        group by ci.name`;
			req.corona.query(sqlQuery, [repositoryId, nodeId, snapshotId],next)
            .then(data => {
                callback(null, data);
            });
		}
	},
    //Callback function, called once all above functions in array are executed.
    //If there is an error in any of the above functions then its called immediately without continuing
    // with remaining functions
    function(err, results) {
        outputJson.issueNameList = results.issuename_details;
        getCodeIssuesTagsKpis(req, results.issuename_details, next, 'name')
        .then(codeIssuesData=>{
            results.issuename_details = codeIssuesData;
            (results.codeissue_details_withname).map(d => {
                d.code_issue = (d.code_issue).map(d1 => {
                    d1.name = d1['f2'];
                    d1.value = d1['f3'];
                    d1.type = d1['f4'];
                    let issueMetadata = (outputJson.issueNameList).filter(codeIssue=>codeIssue.name == d1.name);
                    if(issueMetadata.length) {
                        d1.kpis = (issueMetadata[0].kpi) ? issueMetadata[0].kpi : [];
                        d1.tags = (issueMetadata[0].tags) ? issueMetadata[0].tags : [];
                    }
                    delete d1['f1'];
                    delete d1['f2'];
                    delete d1['f3'];
                    delete d1['f4'];
                    return d1;
                })
                return d;
            });
            
            outputJson.dataList.push(results.codeissue_details_withname);
            let components = { 'components_codeissue_detail' : { }  };
            components.components_codeissue_detail = results.code_issues_component_details;
            outputJson.dataList.push(components);
            
            res.status(200).json(outputJson);
        })
        .catch(error =>{
            return next(new errors.InternalServerError(error.message, 1018));
        })
    });
}
