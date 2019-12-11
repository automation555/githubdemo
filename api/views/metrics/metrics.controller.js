
import async from 'async';
let sqlQuery;
export async function getMetricDetails(req,res,next)
{
    // define json
    var metricDetailsJson =    
    {
        "total_components":0,   // Total no. direct and indirect children of node 
        "metrics": []  
    };

    async.parallel(
    {
        total_components: function(callback)
        {
            sqlQuery = `select * from get_node_components_count($1,$2,$3)`;
            req.corona.query(sqlQuery, [req.query.project_id, req.query.snapshot_id, req.query.node_id],next)
            .then(data=>{
                callback(null, data);
            });
        },
        violating_metric_details: function(callback)
        {
            sqlQuery = `select * from get_node_metric_violating_components_count($1,$2,$3)`;
            req.corona.query(sqlQuery, [req.query.snapshot_id, req.query.node_id, req.query.project_id],next)
                .then(data => {
                    callback(null, data);
                });
        }
    },
    //Callback function, called once all above functions in array are executed.
    //If there is an error in any of the above functions then its called immediately without continuing
    // with remaining functions
    function(err, results){
        metricDetailsJson.total_components = results.total_components[0];
        metricDetailsJson.metrics          = results.violating_metric_details;
        res.json(metricDetailsJson);        
    });       
}
