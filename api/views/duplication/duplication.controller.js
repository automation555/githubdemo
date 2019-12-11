/*** Module dependencies.  */

import async from 'async';
let sqlQuery;
export async function getDuplicationDetails(req,res,next)
{
    let duplicationNodeJson = { 
                                    dataList : []
                                };                                
           
    async.parallel({
        node_duplication_details: function(callback)
        {
            sqlQuery = `select * from get_node_loc_duplicateloc_details($1,$2,$3)`;
            req.corona.query(sqlQuery, [req.query.project_id, req.query.snapshot_id, req.query.node_id],next)
                .then(data=>{
                    callback(null, data);
                });
        },
        node_modules_exec_loc:function(callback)
        {
            sqlQuery = `select * from get_node_module_execloc_details($1,$2,$3)`;
            req.corona.query(sqlQuery, [req.query.project_id, req.query.snapshot_id, req.query.node_id],next)
                .then(data=>{
                    callback(null, data);
                });        
        },
        node_exec_loc: function(callback)
        {
           sqlQuery = `select case when sum(ms.value) is null then 0 else sum(ms.value) end as exec_loc from nodes n,node_types nt,measurements ms,measures m  
                        where n.parentid=$1 
                        and n.nodetype=nt.id  
                        and nt.classification='COMPONENTS' 
                        and n.subsystem_id=$2      
                        and n.id= ms.nodeid                
                        and ms.snapshotid=$3
                        and ms.measureid=m.id              
                        and m.measurename='LOC'`;
            req.corona.query(sqlQuery, [req.query.node_id, req.query.project_id, req.query.snapshot_id],next)
                .then(data=>{
                    callback(null, data);
                });    
        },
        node_dup_loc: function(callback)
        {
           sqlQuery = `select case when sum(cs.totalduplicationlinecount) is null then 0 else sum(cs.totalduplicationlinecount) end  as dup_loc from nodes n,node_types nt,clonestatistics cs 
                         where n.parentid=$1
                         and n.nodetype=nt.id  
                         and nt.classification='COMPONENTS' 
                         and n.subsystem_id=$2 
                         and n.id=cs.nodeid  
                         and cs.snapshotid=$3`;
            req.corona.query(sqlQuery, [req.query.node_id, req.query.project_id, req.query.snapshot_id],next)
                .then(data=>{
                    callback(null, data);
                });
        }                
    },
    //Callback function, called once all above functions in array are executed.
    //If there is an error in any of the above functions then its called immediately without continuing
    // with remaining functions
    function(err, results){
       
        let i=0;
        for(i=0; i< results.node_duplication_details.length;i++ )
        {
            for(j=0;j<results.node_modules_exec_loc.length ;j++)
                if(results.node_duplication_details[i].id == results.node_modules_exec_loc[j].id)   
                    results.node_duplication_details[i].exec_loc = results.node_modules_exec_loc[j].exec_loc;   
        }
        duplicationNodeJson.dataList.push(results.node_duplication_details);
        let components = { 'components_duplication_detail' : { "exec_loc":"" , "duplicate_loc":"" }  };
        components.components_duplication_detail.exec_loc      = results.node_exec_loc[0].exec_loc;
        components.components_duplication_detail.duplicate_loc = results.node_dup_loc[0].dup_loc;

        duplicationNodeJson.dataList.push(components);
        res.json(duplicationNodeJson);
    });
}
