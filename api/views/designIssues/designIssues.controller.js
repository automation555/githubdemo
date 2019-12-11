/**
 * Module dependencies.
 */

import async from 'async';
let sqlQuery;

export async function getDesignissues(req,res,next)
{
    let ouputJson =
    {
        "component_level_antipattern_list":[],
        "method_level_antipattern_list":[],
        "dataList": []
    };

    async.parallel({
    	component_antipattern_details: function(callback)
        {
            sqlQuery = `select rt.id as ruletypeid,rt.acronym as type,rt.criticality  from ruletypes rt where rt.classification='COMPONENTS'`;
            req.corona.query(sqlQuery, [],next)
                .then(data=>{
                    callback(null, data);
                });
        },
        subcomponent_antipattern_details: function(callback)
        {
           sqlQuery = `select rt.id as ruletypeid,rt.acronym as type,rt.criticality  from ruletypes rt where rt.classification='SUBCOMPONENTS'`;
            req.corona.query(sqlQuery, [],next)
                .then(data=>{
                    callback(null, data);
                });
        },
        node_antipattern_details: function(callback)
        {
            sqlQuery = `select * from get_antipattern_issues_distribution($1,$2,$3,'${req.query.antipattern_type}') `;
            req.corona.query(sqlQuery, [req.query.node_id, req.query.snapshot_id, req.query.project_id],next)
                .then(data=>{
                    callback(null, data);
                });
        },
        all_components_antipattern_details: function(callback)
        {
            sqlQuery = `select rt.acronym as type,case when details.cnt is null then 0
                        else details.cnt end as value from  ruletypes rt  left outer join
                         (select ro.ruletypeid,count(*) as cnt from rule_occurrences ro
                           INNER JOIN nodes n ON ro.nodeid = n.id
                           where n.parentid=$1
                           and n.id= ro.nodeid and n.excluded = false
                           and ro.snapshotid=$2
                           and n.nodetype in (select nt.id from node_types nt where nt.classification='COMPONENTS')
                            group by ro.ruletypeid
                        ) as details on rt.id = details.ruletypeid
                        where rt.classification='COMPONENTS'`;
            req.corona.query(sqlQuery, [req.query.node_id, req.query.snapshot_id],next)
                .then(data=>{
                    callback(null, data);
                });
        },
        all_subcomponents_antipattern_details: function(callback)
        {
            sqlQuery = `select * from get_component_level_subcomponent_antipattern_issues($1, $2)`;
            req.corona.query(sqlQuery, [req.query.node_id, req.query.snapshot_id],next)
                .then(data=>{
                    callback(null, data);
                });
        }

    },
    //Callback function, called once all above functions in array are executed.
    //If there is an error in any of the above functions then its called immediately without continuing
    // with remaining functions
    function(err, results){
        
        ouputJson.component_level_antipattern_list = results.component_antipattern_details;
        ouputJson.method_level_antipattern_list    = results.subcomponent_antipattern_details;
        ouputJson.dataList.push(results.node_antipattern_details);

        let components = {};
        if(req.query.antipattern_type == 'C')
            components.components_designissue_detail = results.all_components_antipattern_details;    
        else
            components.subcomponents_designissue_detail = results.all_subcomponents_antipattern_details;    
        
        ouputJson.dataList.push(components);
        res.json(ouputJson);
           
    });       
}


